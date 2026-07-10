import { NextRequest, NextResponse } from 'next/server';
import { appError, errorMessage } from '@/lib/api-error';
import { parseCitationAnswer, type CitationAnswer } from '@/lib/citation-answer';
import { callChatCompletion } from '@/lib/openai-compatible';
import { effectiveSettings, paperViewer } from '@/lib/workbench-store';

const MAX_CITATIONS = 3;

async function callProviderWithRetries(
  settings: ReturnType<typeof effectiveSettings>,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await callChatCompletion(settings, messages, Math.min(1024, settings.max_context_tokens));
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

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
    const evidenceById = new Map(viewer.evidence_units.map((unit) => [unit.evidence_id, unit]));
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: [
          'Answer chemistry paper questions using only the supplied paper evidence.',
          'Return strict JSON only with exactly two fields: `answer` (a concise string) and `citation_ids` (an array of zero to three evidence IDs).',
          'Every citation ID must exactly match an `evidence_id` supplied below and must directly support the answer.',
          'If the evidence is insufficient, say so in the answer and return an empty citation_ids array.',
          'Do not return Markdown fences or any text outside the JSON object.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Question: ${payload.query.trim()}`,
          `Paper title: ${viewer.title}`,
          `Abstract: ${viewer.abstract}`,
          'Evidence:',
          ...viewer.evidence_units.map(
            (unit) =>
              `[evidence_id=${unit.evidence_id}; heading=${unit.heading}; pages=${unit.page_start}-${unit.page_end}] ${unit.text}`,
          ),
        ].join('\n\n'),
      },
    ];

    let structuredAnswer: CitationAnswer | null = null;
    let bestAnswer = '';
    let lastError: unknown = null;
    for (let structuredAttempt = 1; structuredAttempt <= 2; structuredAttempt += 1) {
      let rawAnswer = '';
      try {
        rawAnswer = await callProviderWithRetries(settings, messages);
        const parsed = parseCitationAnswer(rawAnswer);
        bestAnswer = parsed.answer;
        const unknownIds = parsed.citationIds.filter((citationId) => !evidenceById.has(citationId));
        if (unknownIds.length) {
          throw new Error(`The provider returned unknown citation IDs: ${unknownIds.join(', ')}`);
        }
        if (parsed.citationIds.length > MAX_CITATIONS) {
          throw new Error(`The provider returned more than ${MAX_CITATIONS} citation IDs.`);
        }
        structuredAnswer = parsed;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (structuredAttempt < 2) {
          if (rawAnswer) messages.push({ role: 'assistant', content: rawAnswer });
          messages.push({
            role: 'user',
            content: `The previous response was invalid: ${errorMessage(error, 'invalid structured response')}. Return only the required JSON using evidence IDs from the supplied paper.`,
          });
        }
      }
    }
    if (!structuredAnswer && !bestAnswer) throw lastError;
    const answer = structuredAnswer?.answer ?? bestAnswer;
    const citedUnits = (structuredAnswer?.citationIds ?? [])
      .map((citationId) => evidenceById.get(citationId))
      .filter((unit) => unit !== undefined);
    return NextResponse.json({
      paper_id: viewer.paper_id,
      model: settings.qa_model,
      answer,
      citations: citedUnits.map((citation) => ({
        evidence_id: citation.evidence_id,
        page_start: citation.page_start,
        page_end: citation.page_end,
        section_path: [citation.heading],
        snippet: citation.text,
      })),
    });
  } catch (error) {
    return appError('provider_error', errorMessage(error, 'Paper QA failed.'), 'Check the Paper QA provider settings and try again.');
  }
}
