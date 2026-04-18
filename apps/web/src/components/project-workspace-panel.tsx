'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, FolderOpen, Loader2, PencilLine, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';

import { usePresence } from '@/lib/animation/use-presence';
import type { CorpusCatalogEntry, ProjectDetailResponse, ProjectPaperSession, ProjectSearchThread, ProjectSummary } from '@/lib/types';

type ProjectWorkspacePanelProps = {
  open: boolean;
  loading: boolean;
  disabled?: boolean;
  scopeSaving?: boolean;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  detail: ProjectDetailResponse | null;
  corpusCatalog: CorpusCatalogEntry[];
  error: string | null;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onRenameProject: (projectId: string, title: string) => void;
  onUpdateProjectScope: (projectId: string, selectedCorpora: string[]) => void;
  onClearProject: () => void;
  onDeleteProject: () => void;
  onRestoreThread: (thread: ProjectSearchThread) => void;
  onOpenPaperSession: (session: ProjectPaperSession) => void;
};

type ScopeCheckboxState = 'all' | 'some' | 'none';

function formatCorpusLabel(corpusKey: string): string {
  const [venue, year, track] = corpusKey.split('/');
  if (!venue || !year || !track) {
    return corpusKey;
  }
  return `${venue.toUpperCase()} ${year} ${track}`;
}

function summarizeScope(selectedCorpora: string[], catalogKeys: Set<string>): string {
  const availableCount = selectedCorpora.filter((corpus) => catalogKeys.has(corpus)).length;
  const unavailableCount = selectedCorpora.length - availableCount;
  if (availableCount === 0 && unavailableCount === 0) {
    return 'No corpus selected';
  }
  if (availableCount === 1 && unavailableCount === 0) {
    return formatCorpusLabel(selectedCorpora.find((corpus) => catalogKeys.has(corpus)) ?? selectedCorpora[0] ?? '');
  }
  if (unavailableCount > 0) {
    return `${availableCount} active • ${unavailableCount} unavailable`;
  }
  return `${availableCount} corpora selected`;
}

function ScopeCheckbox({
  state,
  disabled,
  onChange,
}: {
  state: ScopeCheckboxState;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = state === 'some';
    }
  }, [state]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={state === 'all'}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function relativeTimeLabel(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) {
    return 'Unknown';
  }
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

function formatResultCounts(thread: ProjectSearchThread): string {
  const satisfied = thread.result_counts.satisfied ?? 0;
  const partial = thread.result_counts.partial ?? 0;
  return `${satisfied} satisfied • ${partial} partial`;
}

export function ProjectWorkspacePanel({
  open,
  loading,
  disabled = false,
  scopeSaving = false,
  projects,
  currentProjectId,
  detail,
  corpusCatalog,
  error,
  onClose,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onUpdateProjectScope,
  onClearProject,
  onDeleteProject,
  onRestoreThread,
  onOpenPaperSession,
}: ProjectWorkspacePanelProps) {
  const currentProject = detail?.project ?? null;
  const { mounted, phase } = usePresence(open, 180);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const catalogKeys = useMemo(() => new Set(corpusCatalog.map((entry) => entry.corpus_key)), [corpusCatalog]);
  const groupedCatalog = useMemo(() => {
    const grouped = new Map<string, Map<number, CorpusCatalogEntry[]>>();
    for (const entry of corpusCatalog) {
      const venueMap = grouped.get(entry.venue) ?? new Map<number, CorpusCatalogEntry[]>();
      const yearEntries = venueMap.get(entry.year) ?? [];
      yearEntries.push(entry);
      yearEntries.sort((left, right) => left.track.localeCompare(right.track));
      venueMap.set(entry.year, yearEntries);
      grouped.set(entry.venue, venueMap);
    }
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([venue, years]) => ({
        venue,
        years: Array.from(years.entries())
          .sort((left, right) => left[0] - right[0])
          .map(([year, entries]) => ({ year, entries })),
      }));
  }, [corpusCatalog]);
  const selectedCorpora = currentProject?.selected_corpora ?? [];
  const unavailableSelected = useMemo(
    () => selectedCorpora.filter((corpus) => !catalogKeys.has(corpus)),
    [catalogKeys, selectedCorpora],
  );
  const scopeSummary = useMemo(
    () => summarizeScope(selectedCorpora, catalogKeys),
    [catalogKeys, selectedCorpora],
  );
  const selectorDisabled = disabled || scopeSaving || !currentProject;

  useEffect(() => {
    if (editingProjectId && !projects.some((project) => project.project_id === editingProjectId)) {
      setEditingProjectId(null);
      setDraftTitle('');
    }
  }, [editingProjectId, projects]);

  const startEditing = (projectId: string, title: string) => {
    setEditingProjectId(projectId);
    setDraftTitle(title);
  };

  const stopEditing = () => {
    setEditingProjectId(null);
    setDraftTitle('');
  };

  const commitRename = (projectId: string, currentTitle: string) => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      stopEditing();
      return;
    }
    if (nextTitle !== currentTitle) {
      onRenameProject(projectId, nextTitle);
    }
    stopEditing();
  };

  const handlePanelClose = () => {
    stopEditing();
    onClose();
  };

  useEffect(() => {
    if (!open) {
      stopEditing();
    }
  }, [open]);

  const updateScope = (nextCorpora: string[]) => {
    if (!currentProject || selectorDisabled) {
      return;
    }
    onUpdateProjectScope(
      currentProject.project_id,
      Array.from(new Set(nextCorpora)).sort((left, right) => left.localeCompare(right)),
    );
  };

  const toggleCorpus = (corpusKey: string, checked: boolean) => {
    if (checked) {
      updateScope([...selectedCorpora, corpusKey]);
      return;
    }
    updateScope(selectedCorpora.filter((corpus) => corpus !== corpusKey));
  };

  const toggleGroup = (corpusKeys: string[], checked: boolean) => {
    if (checked) {
      updateScope([...selectedCorpora, ...corpusKeys]);
      return;
    }
    updateScope(selectedCorpora.filter((corpus) => !corpusKeys.includes(corpus)));
  };

  const checkboxState = (corpusKeys: string[]): ScopeCheckboxState => {
    const selectedCount = corpusKeys.filter((corpus) => selectedCorpora.includes(corpus)).length;
    if (selectedCount === 0) {
      return 'none';
    }
    if (selectedCount === corpusKeys.length) {
      return 'all';
    }
    return 'some';
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div
        data-state={phase}
        className="psa-overlay-backdrop fixed inset-0 z-[80] bg-slate-950/20"
        onClick={handlePanelClose}
      />
      <aside
        data-state={phase}
        className="psa-side-panel-surface fixed inset-y-0 left-0 z-[90] flex w-full max-w-[390px] flex-col border-r border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
      >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
              <div>
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-400">Workspace</div>
                <div className="mt-1 text-[1rem] font-black tracking-tight text-slate-950">
                  {currentProject?.title ?? 'Workspaces'}
                </div>
              </div>
              <button
                type="button"
                onClick={handlePanelClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <button
                type="button"
                disabled={disabled}
                onClick={onCreateProject}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-[0.74rem] font-bold uppercase tracking-[0.18em] text-slate-700 shadow-scholar-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                New workspace
              </button>

              <div className="mt-6">
                <div className="mb-3 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">Workspaces</div>
                <div className="space-y-2">
                  {projects.map((project) => {
                    const isActive = project.project_id === currentProjectId;
                    const isEditing = editingProjectId === project.project_id;
                    return (
                      <div
                        key={project.project_id}
                        className={`rounded-[1.15rem] border px-4 py-3 transition ${
                          isActive
                            ? 'border-indigo-200 bg-indigo-50/80 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div className="rounded-[0.95rem] border border-indigo-200 bg-white px-3 py-2.5 shadow-scholar-sm">
                                <input
                                  value={draftTitle}
                                  autoFocus
                                  disabled={disabled}
                                  onChange={(event) => setDraftTitle(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      commitRename(project.project_id, project.title);
                                    }
                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      stopEditing();
                                    }
                                  }}
                                  className="w-full border-none bg-transparent text-[0.95rem] font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                                  placeholder="Workspace name"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={disabled || (loading && isActive)}
                                onClick={() => onSelectProject(project.project_id)}
                                className="min-w-0 w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                <div className="truncate text-[0.95rem] font-semibold">{project.title}</div>
                              </button>
                            )}
                            <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {project.search_thread_count} searches • {project.paper_session_count} paper chats • {(project.selected_corpora ?? []).length} corpora
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => commitRename(project.project_id, project.title)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Save ${project.title}`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={stopEditing}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Cancel rename ${project.title}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => startEditing(project.project_id, project.title)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-white/80 text-slate-400 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`Rename ${project.title}`}
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {isActive ? <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-7 flex items-center gap-3">
                <button
                  type="button"
                  disabled={disabled || !currentProject}
                  onClick={onClearProject}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onDeleteProject}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

              {loading ? (
                <div className="mt-7 flex items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-[0.82rem] font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading workspace
                </div>
              ) : null}

              {error ? (
                <div className="mt-7 rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-[0.84rem] leading-6 text-rose-700">
                  {error}
                </div>
              ) : null}

              {currentProject ? (
                <div className="mt-8 rounded-[1.45rem] border border-slate-200 bg-white/92 p-4 shadow-scholar-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">Search scope</div>
                      <div className="mt-1 text-[1rem] font-black tracking-tight text-slate-950">{scopeSummary}</div>
                    </div>
                    {scopeSaving ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[0.64rem] font-bold uppercase tracking-[0.18em] text-indigo-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving
                      </div>
                    ) : null}
                  </div>

                  {unavailableSelected.length > 0 ? (
                    <div className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[0.82rem] leading-6 text-amber-700">
                      This workspace still references unavailable corpora. Remove them before searching again.
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectorDisabled}
                      onClick={() => updateScope(corpusCatalog.map((entry) => entry.corpus_key))}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={selectorDisabled}
                      onClick={() => updateScope([])}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {groupedCatalog.length === 0 ? (
                      <div className="rounded-[1.1rem] border border-dashed border-slate-200 px-4 py-4 text-[0.84rem] leading-6 text-slate-500">
                        No published corpora are currently available in the online search catalog.
                      </div>
                    ) : groupedCatalog.map((venueGroup) => {
                      const venueCorpusKeys = venueGroup.years.flatMap((yearGroup) => yearGroup.entries.map((entry) => entry.corpus_key));
                      return (
                        <div key={venueGroup.venue} className="rounded-[1.15rem] border border-slate-200 bg-slate-50/75 p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <ScopeCheckbox
                                state={checkboxState(venueCorpusKeys)}
                                disabled={selectorDisabled}
                                onChange={(checked) => toggleGroup(venueCorpusKeys, checked)}
                              />
                              <div>
                                <div className="text-[0.78rem] font-bold uppercase tracking-[0.18em] text-slate-800">{venueGroup.venue}</div>
                                <div className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  {venueCorpusKeys.length} corpora
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-3">
                            {venueGroup.years.map((yearGroup) => {
                              const yearCorpusKeys = yearGroup.entries.map((entry) => entry.corpus_key);
                              return (
                                <div key={`${venueGroup.venue}-${yearGroup.year}`} className="rounded-[1rem] border border-white/90 bg-white px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <ScopeCheckbox
                                        state={checkboxState(yearCorpusKeys)}
                                        disabled={selectorDisabled}
                                        onChange={(checked) => toggleGroup(yearCorpusKeys, checked)}
                                      />
                                      <div className="text-[0.8rem] font-semibold text-slate-800">{yearGroup.year}</div>
                                    </div>
                                    <div className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {yearGroup.entries.reduce((sum, entry) => sum + entry.papers, 0)} papers
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-2">
                                    {yearGroup.entries.map((entry) => (
                                      <label
                                        key={entry.corpus_key}
                                        className="flex items-center justify-between gap-3 rounded-[0.95rem] border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                                      >
                                        <div className="flex items-center gap-3">
                                          <ScopeCheckbox
                                            state={selectedCorpora.includes(entry.corpus_key) ? 'all' : 'none'}
                                            disabled={selectorDisabled}
                                            onChange={(checked) => toggleCorpus(entry.corpus_key, checked)}
                                          />
                                          <div>
                                            <div className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-slate-700">
                                              {entry.track}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="rounded-full border border-white/90 bg-white px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                          {entry.papers} papers
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {unavailableSelected.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <div className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-amber-600">Unavailable corpus</div>
                      {unavailableSelected.map((corpusKey) => (
                        <div
                          key={corpusKey}
                          className="flex items-center justify-between gap-3 rounded-[1rem] border border-amber-200 bg-white px-3 py-2.5"
                        >
                          <div className="text-[0.78rem] font-semibold text-slate-700">{formatCorpusLabel(corpusKey)}</div>
                          <button
                            type="button"
                            disabled={selectorDisabled}
                            onClick={() => toggleCorpus(corpusKey, false)}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                  Recent searches
                </div>
                <div className="space-y-2">
                  {(detail?.threads ?? []).length ? (
                    (detail?.threads ?? []).slice(0, 8).map((thread) => (
                      <button
                        key={thread.thread_id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onRestoreThread(thread)}
                        className="w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="line-clamp-2 text-[0.9rem] font-medium leading-6 text-slate-800">{thread.query}</div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          <span>{formatResultCounts(thread)}</span>
                          <span>{relativeTimeLabel(thread.updated_at)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-4 text-[0.86rem] leading-6 text-slate-500">
                      Search threads will appear here after you run queries inside this workspace.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.22em] text-slate-400">
                  <Clock3 className="h-3.5 w-3.5" />
                  Recent paper chats
                </div>
                <div className="space-y-2">
                  {(detail?.paper_sessions ?? []).length ? (
                    (detail?.paper_sessions ?? []).slice(0, 8).map((session) => (
                      <button
                        key={`${session.paper_id}-${session.updated_at}`}
                        type="button"
                        disabled={disabled || !session.source_thread_id}
                        onClick={() => onOpenPaperSession(session)}
                        className="w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="line-clamp-2 text-[0.9rem] font-medium leading-6 text-slate-800">
                          {session.paper_title || session.paper_id}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          <span>{(session.chat_history ?? []).length} turns</span>
                          <span>{relativeTimeLabel(session.updated_at)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-4 text-[0.86rem] leading-6 text-slate-500">
                      Paper chat sessions will appear here after you talk with a paper inside this workspace.
                    </div>
                  )}
                </div>
              </div>
            </div>
      </aside>
    </>
  );
}
