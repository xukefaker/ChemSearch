import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export type RetrievalMethod =
  | 'bm25_full_text'
  | 'colbertv2'
  | 'spladepp'
  | 'hybrid_bm25_colbertv2'
  | 'hybrid_bm25_spladepp';

export type QaModel = string;
export type IndexingDevice = 'auto' | 'cpu' | 'cuda';
export type PaperStatus = 'ready' | 'indexing' | 'failed' | 'queued';

export type LibraryPaper = {
  paper_id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  pages: number;
  figures: number;
  status: PaperStatus;
  tags: string[];
  updated_at: string;
  abstract: string;
  preview_label: string;
  file_name?: string;
  source_path?: string;
  content_hash?: string;
  uploaded_at?: string;
  error_message?: string;
};

export type LibraryJob = {
  job_id: string;
  kind: 'upload' | 'parse' | 'index';
  file_name: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  progress: number;
  message: string;
  paper_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type EvidenceUnit = {
  evidence_id: string;
  evidence_type?: string;
  heading: string;
  page_start: number;
  page_end: number;
  text: string;
  caption?: string;
  footnote?: string;
  image_url?: string | null;
  table?: {
    rows: { cells: { text: string; colspan?: number; rowspan?: number; is_header?: boolean }[] }[];
  } | null;
  alias_evidence_ids?: string[];
};

export type PaperViewer = {
  paper_id: string;
  title: string;
  abstract: string;
  evidence_units: EvidenceUnit[];
};

export type WorkbenchSettings = {
  library_path: string;
  retrieval_method: RetrievalMethod;
  qa_model: QaModel;
  qa_base_url: string;
  qa_api_key: string;
  qa_api_key_set?: boolean;
  max_context_tokens: number;
  qa_timeout_seconds: number;
  enable_citations: boolean;
  indexing_device: IndexingDevice;
  cuda_visible_devices: string;
};

type Secrets = {
  qa_api_key?: string;
};

type RawPaperRecord = {
  paper_id?: string;
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  local_pdf_path?: string | null;
  keywords?: string[];
  metadata?: Record<string, unknown>;
};

const defaultSettings: WorkbenchSettings = {
  library_path: '',
  retrieval_method: 'hybrid_bm25_colbertv2',
  qa_model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  qa_base_url: process.env.OPENAI_BASE_URL?.trim() || '',
  qa_api_key: '',
  max_context_tokens: 128000,
  qa_timeout_seconds: 120,
  enable_citations: true,
  indexing_device: 'auto',
  cuda_visible_devices: '',
};

function repoRoot() {
  return resolve(process.cwd(), '../..');
}

export function workbenchDataRoot() {
  return process.env.CHEMSEARCH_WORKBENCH_DATA_DIR || join(repoRoot(), 'data', 'workbench');
}

function dataPath(name: string) {
  return join(workbenchDataRoot(), name);
}

function ensureStore() {
  mkdirSync(workbenchDataRoot(), { recursive: true });
}

function readJson<T>(name: string, fallback: T): T {
  ensureStore();
  try {
    return JSON.parse(readFileSync(dataPath(name), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(name: string, payload: T) {
  ensureStore();
  const target = dataPath(name);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(tmp, target);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const rows: T[] = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      // Ignore one corrupt row and keep the UI usable; the worker will report parse failures separately.
    }
  }
  return rows;
}

function nowIso() {
  return new Date().toISOString();
}

function settingsWithoutSecret(settings: WorkbenchSettings, secrets: Secrets): WorkbenchSettings {
  return {
    ...settings,
    qa_api_key: '',
    qa_api_key_set: Boolean(secrets.qa_api_key || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY),
  };
}

export function listPapers() {
  return mergeRuntimePapers(readJson<LibraryPaper[]>('library.json', []));
}

export function getSettings() {
  return readJson<WorkbenchSettings>('settings.json', defaultSettings);
}

export function getSecrets() {
  return readJson<Secrets>('secrets.local.json', {});
}

export function publicSettings(settings = getSettings()) {
  return settingsWithoutSecret(settings, getSecrets());
}

export function effectiveSettings(settings = getSettings()): WorkbenchSettings {
  const secrets = getSecrets();
  return { ...settings, qa_api_key: secrets.qa_api_key || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || '' };
}

export function saveSettingsPatch(payload: Partial<WorkbenchSettings>) {
  const current = getSettings();
  const secrets = getSecrets();
  const nextSecrets = { ...secrets };
  const nextPayload = { ...payload };
  if (typeof nextPayload.qa_api_key === 'string') {
    if (nextPayload.qa_api_key.trim()) {
      nextSecrets.qa_api_key = nextPayload.qa_api_key.trim();
    }
    delete nextPayload.qa_api_key;
  }
  const next: WorkbenchSettings = {
    ...current,
    ...nextPayload,
    max_context_tokens: Number(nextPayload.max_context_tokens ?? current.max_context_tokens) || current.max_context_tokens,
    qa_timeout_seconds: Number(nextPayload.qa_timeout_seconds ?? current.qa_timeout_seconds) || current.qa_timeout_seconds,
  };
  writeJson('settings.json', next);
  writeJson('secrets.local.json', nextSecrets);
  return settingsWithoutSecret(next, nextSecrets);
}

type RuntimeManifest = {
  normalized_dir?: string;
  deep_chat_normalized_dir?: string;
};

function runtimeManifest(): RuntimeManifest | null {
  const explicit = readJson<RuntimeManifest | null>('runtime_manifest.json', null);
  if (explicit?.normalized_dir) return explicit;

  const root = process.env.CHEMSEARCH_ROOT ? resolve(process.env.CHEMSEARCH_ROOT) : repoRoot();
  const dataDir = process.env.CHEMSEARCH_DATA_DIR ? resolve(root, process.env.CHEMSEARCH_DATA_DIR) : join(root, 'data');
  const normalizedDir = join(dataDir, 'search_current', 'normalized');
  if (!existsSync(join(normalizedDir, 'objects.jsonl'))) return null;

  const deepChatDir = join(normalizedDir, 'deep_chat');
  return {
    normalized_dir: normalizedDir,
    deep_chat_normalized_dir: existsSync(join(deepChatDir, 'evidence_units.jsonl')) ? deepChatDir : undefined,
  };
}

function runtimePaperToLibraryPaper(record: RawPaperRecord): LibraryPaper | null {
  if (!record.paper_id || !record.title) return null;
  const addedAt = typeof record.metadata?.added_at === 'string' ? record.metadata.added_at : undefined;
  return {
    paper_id: record.paper_id,
    title: record.title,
    authors: Array.isArray(record.authors) ? record.authors : [],
    year: Number(record.year || 0),
    venue: record.venue || '',
    pages: 0,
    figures: 0,
    status: 'ready',
    tags: Array.isArray(record.keywords) ? record.keywords.slice(0, 8) : [],
    updated_at: addedAt || nowIso(),
    abstract: record.abstract || '',
    preview_label: '',
    file_name: record.local_pdf_path ? basename(record.local_pdf_path) : `${record.paper_id}.pdf`,
    source_path: record.local_pdf_path || undefined,
    uploaded_at: addedAt,
  };
}

function runtimeLibraryPapers() {
  const manifest = runtimeManifest();
  const papersPath = manifest?.normalized_dir ? join(manifest.normalized_dir, 'papers.jsonl') : '';
  if (!papersPath) return [];
  return readJsonl<RawPaperRecord>(papersPath).map(runtimePaperToLibraryPaper).filter((paper): paper is LibraryPaper => Boolean(paper));
}

function mergeRuntimePapers(localPapers: LibraryPaper[]) {
  const merged = new Map<string, LibraryPaper>();
  for (const paper of runtimeLibraryPapers()) {
    merged.set(paper.paper_id, paper);
  }
  for (const localPaper of localPapers) {
    const runtimePaper = merged.get(localPaper.paper_id);
    if (!runtimePaper) {
      merged.set(localPaper.paper_id, localPaper);
      continue;
    }
    merged.set(localPaper.paper_id, {
      ...localPaper,
      ...runtimePaper,
      file_name: localPaper.file_name || runtimePaper.file_name,
      source_path: runtimePaper.source_path || localPaper.source_path,
      content_hash: localPaper.content_hash,
      uploaded_at: localPaper.uploaded_at || runtimePaper.uploaded_at,
      status: runtimePaper.status,
    });
  }
  return Array.from(merged.values());
}

type RawEvidenceUnit = {
  evidence_id?: string;
  paper_id?: string;
  evidence_type?: string;
  heading?: string;
  page_start?: number;
  page_end?: number;
  text?: string;
  object_ids?: string[];
};

type RawObjectRecord = {
  object_id?: string;
  paper_id?: string;
  object_type?: string;
  page_idx?: number;
  ordinal?: number;
  bbox?: number[];
  section_path?: string[];
  text?: string;
  caption?: string;
  footnote?: string;
  html?: string;
  image_path?: string | null;
};

function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanEvidenceHeading(value?: string | null): string {
  const heading = normalizeEvidenceText(value ?? '');
  const compact = heading.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!heading || compact === 'articleinfo' || compact === 'checkforupdates') {
    return 'Paper text';
  }
  return heading;
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePositiveAttr(attrs: string, name: string): number | undefined {
  const match = attrs.match(new RegExp(`${name}=["']?(\\d+)`, 'i'));
  if (!match) return undefined;
  const value = Number(match[1]);
  return value > 1 ? value : undefined;
}

function parseTablePayload(value: string): EvidenceUnit['table'] {
  if (!/<table/i.test(value)) return null;
  const rows: NonNullable<EvidenceUnit['table']>['rows'] = [];
  for (const rowMatch of value.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: NonNullable<EvidenceUnit['table']>['rows'][number]['cells'] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>/gi)) {
      const text = decodeHtmlText(cellMatch[3]);
      if (!text) continue;
      cells.push({
        text,
        colspan: parsePositiveAttr(cellMatch[2], 'colspan'),
        rowspan: parsePositiveAttr(cellMatch[2], 'rowspan'),
        is_header: cellMatch[1].toLowerCase() === 'th',
      });
    }
    if (cells.length) rows.push({ cells });
  }
  return rows.length ? { rows } : null;
}

function compactEvidenceUnits(units: EvidenceUnit[]): EvidenceUnit[] {
  const seen = new Set<string>();
  return units
    .map((unit) => ({
      ...unit,
      heading: cleanEvidenceHeading(unit.heading),
      text: normalizeEvidenceText(unit.text),
      caption: unit.caption ? normalizeEvidenceText(unit.caption) : unit.caption,
    }))
    .filter((unit) => {
      const hasRenderableObject = Boolean(unit.table?.rows.length || unit.image_url || unit.caption);
      if (unit.text.length < 20 && !hasRenderableObject) return false;
      const compactHeading = unit.heading.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (compactHeading === 'articleinfo' || compactHeading === 'checkforupdates') return false;
      const headingKey = unit.heading.toLowerCase();
      const textKey = (unit.text || unit.caption || unit.image_url || JSON.stringify(unit.table ?? '')).toLowerCase();
      const key = `${headingKey}|${unit.page_start}|${unit.page_end}|${textKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function paperViewer(paperId: string): PaperViewer | null {
  const paper = listPapers().find((item) => item.paper_id === paperId);
  if (!paper) return null;
  const manifest = runtimeManifest();
  const evidencePath = manifest?.deep_chat_normalized_dir ? join(manifest.deep_chat_normalized_dir, 'evidence_units.jsonl') : '';
  const evidenceByObjectId = new Map<string, string[]>();
  if (evidencePath) {
    for (const unit of readJsonl<RawEvidenceUnit>(evidencePath).filter((item) => item.paper_id === paperId && item.evidence_id)) {
      for (const objectId of unit.object_ids ?? []) {
        const aliases = evidenceByObjectId.get(objectId) ?? [];
        aliases.push(unit.evidence_id as string);
        evidenceByObjectId.set(objectId, aliases);
      }
    }
  }

  const objectPath = manifest?.normalized_dir ? join(manifest.normalized_dir, 'objects.jsonl') : '';
  const objectUnits = objectPath
    ? readJsonl<RawObjectRecord>(objectPath)
        .filter((obj) => {
          if (obj.paper_id !== paperId || obj.object_type === 'equation_block') return false;
          return Boolean(obj.text?.trim() || obj.caption?.trim() || obj.image_path || obj.html?.trim());
        })
        .sort((left, right) => Number(left.page_idx || 1) - Number(right.page_idx || 1) || Number(left.ordinal || 0) - Number(right.ordinal || 0))
        .map((obj) => {
          const objectId = obj.object_id || `${paperId}-object`;
          const aliases = evidenceByObjectId.get(objectId) ?? [];
          const page = Number(obj.page_idx || 1);
          const imageName = obj.image_path ? basename(obj.image_path) : '';
          const table = obj.object_type === 'table_block' ? parseTablePayload(obj.html || obj.text || '') : null;
          return {
            evidence_id: `object:${objectId}`,
            evidence_type:
              obj.object_type === 'table_block'
                ? 'table_unit'
                : obj.object_type === 'figure_block'
                  ? 'figure_unit'
                  : obj.object_type === 'list_block'
                    ? 'list_unit'
                    : 'paragraph_unit',
            heading: cleanEvidenceHeading(obj.section_path?.at(-1) || obj.section_path?.[0]),
            page_start: page,
            page_end: page,
            text: table ? '' : obj.text || '',
            caption: obj.caption || undefined,
            footnote: obj.footnote || undefined,
            image_url: imageName ? `/api/papers/${encodeURIComponent(paperId)}/images/${encodeURIComponent(imageName)}` : null,
            table,
            alias_evidence_ids: aliases,
          } satisfies EvidenceUnit;
        })
    : [];

  const evidenceUnits = objectUnits.length
    ? compactEvidenceUnits(objectUnits).slice(0, 240)
    : compactEvidenceUnits(
        evidencePath
          ? readJsonl<RawEvidenceUnit>(evidencePath)
              .filter((unit) => unit.paper_id === paperId && unit.text?.trim() && unit.evidence_type !== 'chunk_unit')
              .map((unit) => ({
                evidence_id: unit.evidence_id || `${paperId}-evidence`,
                evidence_type: unit.evidence_type,
                heading: cleanEvidenceHeading(unit.heading),
                page_start: Number(unit.page_start || 1),
                page_end: Number(unit.page_end || unit.page_start || 1),
                text: unit.text || '',
                table: unit.evidence_type === 'table_unit' ? parseTablePayload(unit.text || '') : null,
              }))
          : [],
      ).slice(0, 80);
  return {
    paper_id: paper.paper_id,
    title: paper.title,
    abstract: paper.abstract,
    evidence_units: evidenceUnits,
  };
}

export function paperImagePath(paperId: string, imageName: string): string | null {
  const safeName = basename(imageName);
  if (!safeName || safeName !== imageName) return null;

  const manifest = runtimeManifest();
  const objectPath = manifest?.normalized_dir ? join(manifest.normalized_dir, 'objects.jsonl') : '';
  if (!objectPath) return null;

  const records = readJsonl<RawObjectRecord>(objectPath);
  const match = records.find(
    (obj) => obj.paper_id === paperId && obj.image_path && basename(obj.image_path) === safeName,
  );
  if (match?.image_path && existsSync(match.image_path)) return match.image_path;
  return null;
}

export function paperPdfPath(paperId: string): string | null {
  const paper = listPapers().find((item) => item.paper_id === paperId);
  if (!paper?.source_path || !existsSync(paper.source_path)) return null;
  return paper.source_path;
}
