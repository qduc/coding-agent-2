// src/shared/utils/modelMatcher.ts
// Smart utility for matching informal model names to official model IDs with advanced capabilities

export interface ModelMatchInfo {
  officialName: string;
  score: number;
  matchType: 'exact' | 'substring' | 'fuzzy';
}

export const MODEL_ALIASES: Record<string, string[]> = {
  // Anthropic Claude Models
  'claude-3-opus-20240229': ['opus', 'opus-3', 'claude-opus', 'claude-3-opus', 'claude-opus-3', 'claude-3'],
  'claude-3-sonnet-20240229': ['sonnet', 'sonnet-3', 'claude-sonnet', 'claude-3-sonnet', 'claude-sonnet-3', 'claude-3'],
  'claude-3-haiku-20240307': ['haiku', 'haiku-3', 'claude-haiku', 'claude-3-haiku', 'claude-haiku-3', 'claude-3'],
  'claude-3-haiku-20240307-v2': ['haiku-v2', 'haiku2', 'haiku 2', 'claude-haiku-v2'],

  // OpenAI Models
  'gpt-4o': ['4o', 'gpt-4o', 'gpt4o', 'openai-4o', 'flash', 'omni', 'gpt4'],
  'gpt-4-turbo': ['4-turbo', 'gpt-4-turbo', 'gpt4-turbo', 'turbo', 'gpt4 turbo', 'gpt4'],
  'gpt-4-1106-preview': ['4.1', 'gpt-4.1', 'gpt-4-1106', 'gpt4-1106', 'preview'],
  'gpt-3.5-turbo': ['3.5', 'gpt-3.5', 'gpt3.5', 'openai-3.5', 'chatgpt'],

  // Google Gemini Models
  'gemini-pro': ['gemini', 'gemini-pro', 'google-gemini', 'pro', 'gemini-1.0-pro'],
  'gemini-1.5-pro': ['gemini-1.5', '1.5-pro', 'gemini-pro-1.5', 'advanced'],
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