import { TreeSitterParser } from './treeSitterParser';

describe('TreeSitterParser', () => {
  let parser: TreeSitterParser;

  beforeAll(() => {
    parser = new TreeSitterParser();
  });

  it('should detect JavaScript files', () => {
    expect(parser.detectLanguage('test.js')).toBe('javascript');
    expect(parser.detectLanguage('test.jsx')).toBe('javascript');
  });

  it('should detect TypeScript files', () => {
    expect(parser.detectLanguage('test.ts')).toBe('typescript');
    expect(parser.detectLanguage('test.tsx')).toBe('typescript');
  });

  it('should return null for unsupported languages', () => {
    expect(parser.detectLanguage('test.py')).toBeNull();
    expect(parser.detectLanguage('test.go')).toBeNull();
  });

  it('should return supported languages', () => {
    const langs = parser.getSupportedLanguages();
    expect(langs).toContain('javascript');
    expect(langs).toContain('typescript');
  });
});
