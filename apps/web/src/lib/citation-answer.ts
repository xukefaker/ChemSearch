export type CitationAnswer = {
  answer: string;
  citationIds: string[];
};

function jsonCandidates(content: string) {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const candidates = [cleaned];
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(cleaned.slice(start, index + 1));
        break;
      }
    }
  }
  return [...new Set(candidates.filter(Boolean))];
}

export function parseCitationAnswer(content: string): CitationAnswer {
  let lastError: unknown = null;
  for (const candidate of jsonCandidates(content)) {
    try {
      const payload = JSON.parse(candidate) as { answer?: unknown; citation_ids?: unknown };
      const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
      if (!answer) throw new Error('The structured answer is missing `answer`.');
      if (!Array.isArray(payload.citation_ids) || !payload.citation_ids.every((item) => typeof item === 'string')) {
        throw new Error('The structured answer is missing a string array named `citation_ids`.');
      }
      return {
        answer,
        citationIds: [...new Set(payload.citation_ids.map((item) => item.trim()).filter(Boolean))],
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The provider did not return a valid JSON answer.');
}
