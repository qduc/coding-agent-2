import { 
  matchModelName, 
  findModelMatches, 
  getModelName 
} from './modelMatcher';

describe('Smart Model Matcher', () => {
  describe('matchModelName', () => {
    it('should match exact model names', () => {
      expect(matchModelName('opus')).toBe('claude-3-opus-20240229');
      expect(matchModelName('gpt-4o')).toBe('gpt-4o');
      expect(matchModelName('gemini-pro')).toBe('gemini-pro');
    });

    it('should match substring model names', () => {
      expect(matchModelName('claude-opus')).toBe('claude-3-opus-20240229');
      expect(matchModelName('4 turbo')).toBe('gpt-4-turbo');
    });

    it('should perform fuzzy matching', () => {
      expect(matchModelName('claud')).toBe('claude-3-sonnet-20240229');
      expect(matchModelName('gpt4')).toBe('gpt-4o');
    });

    it('should return null for unrecognized models', () => {
      expect(matchModelName('unknown-model')).toBeNull();
    });
  });

  describe('findModelMatches', () => {
    it('should return multiple matches with scores', () => {
      const matches = findModelMatches('claude');
      expect(matches.length).toBeGreaterThan(1);
      expect(matches[0].officialName).toMatch(/claude-3-/);
      expect(matches[0].score).toBeGreaterThan(0);
    });

    it('should rank matches by relevance', () => {
      const matches = findModelMatches('opus');
      expect(matches[0].officialName).toBe('claude-3-opus-20240229');
      expect(matches[0].score).toBe(1);
    });
  });

  describe('getModelName', () => {
    it('should return matched model name or original input', () => {
      expect(getModelName('opus')).toBe('claude-3-opus-20240229');
      expect(getModelName('totally-unknown-model')).toBe('totally-unknown-model');
    });
  });
});