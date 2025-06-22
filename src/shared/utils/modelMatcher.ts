// src/shared/utils/modelMatcher.ts
// Smart utility for matching informal model names to official model IDs with advanced capabilities

export interface ModelMatchInfo {
  officialName: string;
  score: number;
  matchType: 'exact' | 'substring' | 'fuzzy';
}

export const MODEL_ALIASES: Record<string, string[]> = {
  // Anthropic Claude 4 Models (Latest - 2025)
  'claude-sonnet-4-20250514': [
    'sonnet-4', 'claude-sonnet-4', 'sonnet4', 'claude4-sonnet', 'claude-sonnet-4-0', 'claude-sonnet-4', 'sonnet', 'sonnet4-2025', 'claude4', 'claude4sonnet', 'claude-4-sonnet'
  ],
  'claude-opus-4-20250514': [
    'opus-4', 'claude-opus-4', 'opus4', 'claude4-opus', 'claude-opus-4-0', 'claude-opus-4', 'opus', 'opus4-2025', 'claude4', 'claude4opus', 'claude-4-opus'
  ],

  // Anthropic Claude 3.7 Models (Current Top Performers)
  'claude-3-7-sonnet-20250219': [
    'sonnet-3.7', 'claude-3.7-sonnet', 'claude-sonnet-3.7', '3.7-sonnet', 'sonnet3.7', 'claude-3-7', 'claude-3-7-sonnet-latest', 'claude3.7', 'claude3.7sonnet', 'claude-3-7-sonnet', 'sonnet-3.7-2025', 'claude3-7sonnet', 'claude-3-7-sonnet-20250219', 'sonnet3-7', 'sonnet-3-7', 'claude3-7', 'claude3-7-sonnet'
  ],
  'claude-3-7-sonnet-thinking': [
    'sonnet-3.7-thinking', 'claude-3.7-thinking', 'thinking-3.7', 'extended-thinking'
  ],

  // Anthropic Claude 3.5 Models (Still Strong)
  'claude-3-5-sonnet-20241022': [
    'sonnet-3.5', 'claude-3.5-sonnet', 'claude-sonnet-3.5', '3.5-sonnet', 'sonnet3.5', 'claude-3-5-sonnet-latest', 'claude3.5', 'claude3.5sonnet', 'claude-3-5-sonnet', 'sonnet-3.5-2024', 'claude3-5sonnet', 'claude-3-5-sonnet-20241022', 'sonnet3-5', 'sonnet-3-5', 'claude3-5', 'claude3-5-sonnet'
  ],
  'claude-3-5-haiku-20241022': [
    'haiku-3.5', 'claude-3.5-haiku', 'claude-haiku-3.5', '3.5-haiku', 'haiku3.5', 'haiku', 'claude-3-5-haiku-latest', 'claude3.5haiku', 'claude-3-5-haiku', 'haiku-3.5-2024', 'claude3-5haiku', 'claude-3-5-haiku-20241022', 'haiku3-5', 'haiku-3-5', 'claude3-5', 'claude3-5-haiku'
  ],

  // OpenAI GPT-4 Series (2025 Updates)
  'gpt-4.1': ['4.1', 'gpt-4.1', 'gpt4.1', 'coding-focused', 'developer'],

  // OpenAI o-series (Reasoning Models)
  'o4-mini': ['o4-mini', 'o4-mini-model', 'reasoning-mini', 'o4-small'],
  'o4-mini-high': ['o4-mini-high', 'o4-high', 'reasoning-high'],

  // Google Gemini 2.5 Models (Latest)
  'gemini-2.5-pro': ['gemini-2.5', 'gemini-2.5-pro', 'pro-2.5', 'gemini25', 'gem-2.5', 'thinking-gemini'],
  'gemini-2.5-flash': ['flash', 'flash-2.5', 'gemini-flash-2.5', '2.5-flash', 'fast-gemini'],
  'gemini-2.5-flash-lite': ['flash-lite', 'gemini-lite', 'lite-2.5', 'cheap-gemini'],

  // DeepSeek Models (Strong Coding & Cost-Effective)
  'deepseek-r1': ['deepseek-r1', 'r1', 'deepseek-reasoning', 'ds-r1', 'reasoning-deepseek'],
  'deepseek-v3': ['deepseek-v3', 'v3', 'deepseek-3', 'ds-v3'],
  'deepseek-v3-0324': ['deepseek-v3-0324', 'v3-0324', 'deepseek-latest'],
  'deepseek-coder': ['deepseek-coder', 'ds-coder', 'deepseek-code'],

  // Mistral Models (Coding Specialists)
  'codestral-25.01': ['codestral', 'codestral-25', 'mistral-code', 'code-25', 'coding-mistral'],
  'mistral-large-2407': ['mistral-large', 'large-2407', 'mistral-l'],
  'mistral-small-3.1': ['mistral-small', 'small-3.1', 'mistral-s'],

  // Qwen Models (Alibaba)
  'qwen2.5-max': ['qwen-max', 'qwen2.5-max', 'qw-max', 'qwen-2.5-max'],
  'qwen2.5-coder-32b': ['qwen-coder', 'qwen2.5-coder', 'qw-coder', 'qwen-32b'],
  'qwen2.5-7b-instruct-1m': ['qwen-1m', 'qwen-long', 'qw-1m', 'million-context'],
  'qwen2.5-14b-instruct-1m': ['qwen-14b-1m', 'qwen-large-1m', 'qw-14b-1m'],

  // Meta Llama Models
  'llama-3.3-70b': ['llama-3.3', 'llama3.3', 'meta-3.3', 'llama-70b'],
  'llama-3.1-405b': ['llama-405b', 'llama3.1-405b', 'llama-3.1', 'meta-405b'],
};

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function matchModelName(input: string, options: { fuzzyThreshold?: number } = {}): string | null {
  const { fuzzyThreshold = 2 } = options;
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // First pass: Exact match
  for (const [official, aliases] of Object.entries(MODEL_ALIASES)) {
    for (const alias of aliases) {
      const cleanedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleaned === cleanedAlias) return official;
    }
  }

  // Second pass: Substring match
  for (const [official, aliases] of Object.entries(MODEL_ALIASES)) {
    for (const alias of aliases) {
      const cleanedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleaned.length > 1 && cleanedAlias.includes(cleaned)) return official;
    }
  }

  // Third pass: Fuzzy matching
  let bestMatch: { model: string; score: number } | null = null;
  for (const [official, aliases] of Object.entries(MODEL_ALIASES)) {
    for (const alias of aliases) {
      const cleanedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const distance = levenshteinDistance(cleaned, cleanedAlias);
      const score = distance / Math.max(cleaned.length, cleanedAlias.length);

      if (score <= fuzzyThreshold / 10 && (!bestMatch || score < bestMatch.score)) {
        bestMatch = { model: official, score };
      }
    }
  }

  return bestMatch ? bestMatch.model : null;
}

// Enhanced match finding with scoring and match type
export function findModelMatches(input: string, options: { fuzzyThreshold?: number } = {}): ModelMatchInfo[] {
  const { fuzzyThreshold = 2 } = options;
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches: ModelMatchInfo[] = [];

  for (const [official, aliases] of Object.entries(MODEL_ALIASES)) {
    for (const alias of aliases) {
      const cleanedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      let matchType: ModelMatchInfo['matchType'] = 'exact';
      let score = 1;

      if (cleaned === cleanedAlias) {
        matches.push({ officialName: official, score, matchType });
      } else if (cleaned.length > 1 && cleanedAlias.includes(cleaned)) {
        matchType = 'substring';
        score = 0.7;
        matches.push({ officialName: official, score, matchType });
      } else {
        const distance = levenshteinDistance(cleaned, cleanedAlias);
        const calculatedScore = 1 - (distance / Math.max(cleaned.length, cleanedAlias.length));

        if (calculatedScore >= (1 - (fuzzyThreshold / 10))) {
          matchType = 'fuzzy';
          score = calculatedScore;
          matches.push({ officialName: official, score, matchType });
        }
      }
    }
  }

  // Sort matches by score in descending order
  return matches.sort((a, b) => b.score - a.score);
}

// Export a simplified matching function for quick use
export const getModelName = (input: string) => matchModelName(input) || input;