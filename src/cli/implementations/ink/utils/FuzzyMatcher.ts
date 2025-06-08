export interface FuzzyMatch {
  item: string;
  score: number;
}

export class FuzzyMatcher {
  /**
   * Filter items using fuzzy search (like fzf)
   */
  static filter(items: string[], pattern: string): string[] {
    if (!pattern) return items.slice(0, 20);

    const matches = items
      .map(item => ({
        item,
        score: this.calculateScore(item, pattern)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => {
        // Sort by score (higher is better), then by item length (shorter is better)
        if (b.score !== a.score) return b.score - a.score;
        return a.item.length - b.item.length;
      })
      .map(match => match.item);

    return matches;
  }

  /**
   * Calculate fuzzy match score (higher = better match)
   */
  static calculateScore(text: string, pattern: string): number {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    if (textLower === patternLower) return 1000; // Exact match
    if (textLower.startsWith(patternLower)) return 900; // Prefix match

    let score = 0;
    let textIndex = 0;
    let patternIndex = 0;
    let consecutiveMatches = 0;
    let firstMatchIndex = -1;

    while (textIndex < text.length && patternIndex < pattern.length) {
      const textChar = textLower[textIndex];
      const patternChar = patternLower[patternIndex];

      if (textChar === patternChar) {
        if (firstMatchIndex === -1) firstMatchIndex = textIndex;

        // Bonus for consecutive matches
        consecutiveMatches++;
        score += 10 + (consecutiveMatches * 5);

        // Bonus for matches at word boundaries
        if (textIndex === 0 || text[textIndex - 1] === '/' || text[textIndex - 1] === '.' || text[textIndex - 1] === '-' || text[textIndex - 1] === '_') {
          score += 15;
        }

        // Bonus for camelCase matches
        if (textIndex > 0 && text[textIndex].toUpperCase() === text[textIndex] && text[textIndex - 1].toLowerCase() === text[textIndex - 1]) {
          score += 10;
        }

        patternIndex++;
      } else {
        consecutiveMatches = 0;
      }

      textIndex++;
    }

    // Did we match all pattern characters?
    if (patternIndex < pattern.length) return 0;

    // Bonus for shorter files (more relevant)
    score += Math.max(0, 100 - text.length);

    // Bonus for earlier first match
    if (firstMatchIndex >= 0) {
      score += Math.max(0, 50 - firstMatchIndex);
    }

    return score;
  }

  /**
   * Get filtered matches with scores
   */
  static getMatches(items: string[], pattern: string): FuzzyMatch[] {
    if (!pattern) {
      return items.slice(0, 20).map(item => ({ item, score: 0 }));
    }

    return items
      .map(item => ({
        item,
        score: this.calculateScore(item, pattern)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.item.length - b.item.length;
      });
  }
}