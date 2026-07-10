import { NextRequest, NextResponse } from 'next/server';
import { appError, errorMessage } from '@/lib/api-error';
import { callChatCompletion } from '@/lib/openai-compatible';
import { effectiveSettings, paperViewer } from '@/lib/workbench-store';

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { paper_id?: string; query?: string };
  if (!payload.paper_id || !payload.query?.trim()) {
    return appError('bad_request', 'paper_id and query are required.');
  }
  const viewer = paperViewer(payload.paper_id);
  if (!viewer) {
    return appError('not_found', 'Paper not found.');
  }
  if (!viewer.evidence_units.length) {
    return appError('not_ready', 'This paper has not been indexed yet.', 'Wait for indexing to finish before asking paper-level questions.');
  }
  const settings = effectiveSettings();
  try {
    const messages = [
      { role: 'system' as const, content: 'Answer chemistry paper questions using only the supplied paper text. Keep the answer concise.' },
      {
        role: 'user' as const,
        content: [
          `Question: ${payload.query.trim()}`,
          `Paper title: ${viewer.title}`,
          `Abstract: ${viewer.abstract}`,
          'Evidence:',
          ...viewer.evidence_units.map((unit) => `[${unit.heading}, pp. ${unit.page_start}-${unit.page_end}] ${unit.text}`),
        ].join('\n\n'),
      },
    ];
    let answer = '';
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        answer = await callChatCompletion(settings, messages, Math.min(1024, settings.max_context_tokens));
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
    if (lastError) throw lastError;
    const answerTerms = new Set(`${payload.query} ${answer}`.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []);
    const citation =
      viewer.evidence_units
        .filter((unit) => unit.text.trim().length >= 80)
        .map((unit) => {
          const unitTerms = new Set(unit.text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []);
          const score = [...answerTerms].filter((term) => unitTerms.has(term)).length;
          return { unit, score };
        })
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.unit.page_start - right.unit.page_start ||
            right.unit.text.length - left.unit.text.length,
        )[0]?.unit ?? viewer.evidence_units[0];
    return NextResponse.json({
      paper_id: viewer.paper_id,
      model: settings.qa_model,
      answer,
      citations: [
        {
          evidence_id: citation.evidence_id,
          page_start: citation.page_start,
          page_end: citation.page_end,
          section_path: [citation.heading],
          snippet: citation.text,
        },
      ],
    });
  } catch (error) {
    return appError('provider_error', errorMessage(error, 'Paper QA failed.'), 'Check the Paper QA provider settings and try again.');
  }
}
