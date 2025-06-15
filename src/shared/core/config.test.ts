import { detectProviderFromModel } from './config';

describe('detectProviderFromModel', () => {
  // OpenAI models
  it('should detect OpenAI models', () => {
    expect(detectProviderFromModel('gpt-4o')).toBe('openai');
    expect(detectProviderFromModel('4o')).toBe('openai');
    expect(detectProviderFromModel('openai flash')).toBe('openai');
    expect(detectProviderFromModel('gpt-3.5-turbo')).toBe('openai');
  });

  // Anthropic models
  it('should detect Anthropic models', () => {
    expect(detectProviderFromModel('claude-3-opus')).toBe('anthropic');
    expect(detectProviderFromModel('opus')).toBe('anthropic');
    expect(detectProviderFromModel('claude-3-sonnet')).toBe('anthropic');
    expect(detectProviderFromModel('sonnet')).toBe('anthropic');
  });

  // Gemini models
  it('should detect Gemini models', () => {
    expect(detectProviderFromModel('gemini-pro')).toBe('gemini');
    expect(detectProviderFromModel('gemini')).toBe('gemini');
    expect(detectProviderFromModel('pro')).toBe('gemini');
  });

  // Fallback for unrecognized models
  it('should fallback to OpenAI for unrecognized models', () => {
    expect(detectProviderFromModel('unknown-model')).toBe('openai');
    expect(detectProviderFromModel('random-123')).toBe('openai');
  });
});