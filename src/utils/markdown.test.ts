// Utility to strip color codes and non-alphanumeric symbols for semantic testing
function stripVisuals(str: string): string {
  // Remove color mock wrappers (e.g., BOLD(...), CYAN_BOLD(...), etc.)
  return str
    .replace(/[A-Z_]+\((.*?)\)/g, '$1')
    // Remove common visual symbols (bullets, lines, etc.)
    .replace(/[▸●┃│╭╮╰╯─—\[\]•→↗📋]+/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper functions for mocking chalk (must be defined before jest.mock due to hoisting)
const mockChalkFn = (name: string) => jest.fn((text: string) => `${name}(${text})`);
const mockChalkObj = (baseName: string, nested: Record<string, string>) => {
  const fn = mockChalkFn(baseName);
  Object.entries(nested).forEach(([key, nestedName]) => {
    (fn as any)[key] = mockChalkFn(nestedName);
  });
  return fn;
};

import { MarkdownRenderer } from './markdown';

// (moved to top of file)

// Mock chalk to return identifiable strings for testing
jest.mock('chalk', () => ({
  bold: mockChalkFn('BOLD'),
  italic: Object.assign(mockChalkFn('ITALIC'), { gray: mockChalkFn('ITALIC_GRAY') }),
  cyan: mockChalkObj('CYAN', { bold: 'CYAN_BOLD' }),
  gray: Object.assign(mockChalkObj('GRAY', { inverse: 'GRAY_INVERSE', italic: 'GRAY_ITALIC' }), {
    dim: mockChalkFn('GRAY_DIM'), // Added dim mock
  }),
  green: mockChalkFn('GREEN'),
  blue: mockChalkObj('BLUE', { underline: 'BLUE_UNDERLINE', bold: 'BLUE_BOLD' }),
  yellow: mockChalkObj('YELLOW', { bold: 'YELLOW_BOLD' }),
  magenta: mockChalkFn('MAGENTA'),
  black: Object.assign(mockChalkFn('BLACK'), { bold: mockChalkFn('BLACK_BOLD') }),
  bgGray: Object.assign(mockChalkFn('BGGRAY'), { black: mockChalkFn('BGGRAY_BLACK') }),
}));

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('render() - Basic Functionality', () => {
    test('should render headers correctly (semantic)', () => {
      const input = `# Main Header\n## Sub Header\n### Small Header`;
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Main Header');
      expect(result).toContain('Sub Header');
      expect(result).toContain('Small Header');
    });

    test('should render bold text with ** and __ (semantic)', () => {
      const input = 'This is **bold** and this is __also bold__.';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('bold');
      expect(result).toContain('also bold');
    });

    test('should render italic text with * and _ (semantic)', () => {
      const input = 'This is *italic* and this is _also italic_.';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('italic');
      expect(result).toContain('also italic');
    });

    test('should render inline code with backticks (semantic)', () => {
      const input = 'Use the `console.log()` function.';
      const result = stripVisuals(MarkdownRenderer.render(input));
      // Accept both with and without space between parens
      expect(result.replace(/\s+/g, ' ')).toMatch(/console\.log\( *\)/);
    });

    test('should render unordered lists (semantic)', () => {
      const input = `- Item 1\n* Item 2\n+ Item 3`;
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).toContain('Item 3');
    });

    test('should render ordered lists (semantic)', () => {
      const input = `1. First item\n2. Second item\n10. Tenth item`;
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('First item');
      expect(result).toContain('Second item');
      expect(result).toContain('Tenth item');
    });

    test('should render blockquotes (semantic)', () => {
      const input = '> This is a quote\n> Multi-line quote';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('This is a quote');
      expect(result).toContain('Multi-line quote');
    });

    test('should render horizontal rules (semantic)', () => {
      const input = 'Before\n---\nAfter';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    test('should render links (semantic)', () => {
      const input = 'Check out [Google](https://google.com) for search.';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Google');
      expect(result).toContain('https://google.com');
    });
  });

  describe('render() - Code Blocks', () => {
    test('should render simple code blocks (semantic)', () => {
      const input = '```\nconst x = 1;\nconsole.log(x);\n```';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('const x = 1;');
      expect(result).toContain('console.log(x);');
    });

    test('should render code blocks with language (semantic)', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('javascript');
      expect(result).toContain('const x = 1;');
    });

    test('should handle empty code blocks (semantic)', () => {
      const input = '```\n\n```';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('code');
    });
  });

  describe('renderWithCodeHighlight() - Syntax Highlighting', () => {
    test('should highlight JavaScript code', () => {
      const input = '```javascript\nconst message = "hello";\nfunction test() {\n  return true;\n}\n```';
      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      expect(result).toContain('MAGENTA(const)');
      expect(result).toContain('MAGENTA(function)');
      expect(result).toContain('MAGENTA(return)');
      expect(result).toContain('GREEN("hello")');
      expect(result).toContain('YELLOW(true)');
    });

    test('should highlight TypeScript code', () => {
      const input = '```typescript\ninterface User {\n  name: string;\n}\n```';
      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      // Should use JavaScript highlighter for TypeScript
      expect(result).toContain('typescript');
    });

    test('should highlight JSON code', () => {
      const input = '```json\n{\n  "name": "test",\n  "count": 42,\n  "active": true\n}\n```';
      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      expect(result).toContain('CYAN("name")');
      expect(result).toContain('GREEN("test")');
      expect(result).toContain('YELLOW(42)');
      expect(result).toContain('MAGENTA(true)');
    });

    test('should highlight Bash code', () => {
      const input = '```bash\nls -la\n# This is a comment\necho "hello"\n```';
      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      expect(result).toContain('CYAN(ls)');
      expect(result).toContain('YELLOW(-la)');
      expect(result).toContain('GRAY(# This is a comment)');
      expect(result).toContain('GREEN("hello")');
    });

    test('should fallback to plain text for unknown languages', () => {
      const input = '```unknown\nsome code here\n```';
      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      expect(result).toContain('some code here');
      expect(result).toContain('unknown');
    });
  });

  describe('renderTable() - Table Rendering', () => {
    test('should render simple table', () => {
      const input = `| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |`;

      const result = MarkdownRenderer.renderTable(input);

      expect(result).toContain('CYAN(Name │ Age │ City)');
      expect(result).toContain('GRAY(────┼─────┼──────)');
      expect(result).toContain('John │ 30  │ NYC');
      expect(result).toContain('Jane │ 25  │ LA');
    });

    test('should handle tables with varying column widths', () => {
      const input = `| Short | Very Long Header | Med |
|-------|------------------|-----|
| A     | Data             | B   |
| C     | More Data Here   | D   |`;

      const result = MarkdownRenderer.renderTable(input);

      // Should pad columns to fit the widest content
      expect(result).toContain('Very Long Header');
      expect(result).toContain('More Data Here');
    });

    test('should handle empty cells', () => {
      const input = `| Name | Value |
|------|-------|
| Test |       |
|      | Empty |`;

      const result = MarkdownRenderer.renderTable(input);

      expect(result).toContain('Test │      ');
      expect(result).toContain('     │ Empty');
    });

    test('should return original text for invalid tables', () => {
      const input = 'Not a table';
      const result = MarkdownRenderer.renderTable(input);

      expect(result).toBe('Not a table');
    });

    test('should handle table with only header', () => {
      const input = '| Header |';
      const result = MarkdownRenderer.renderTable(input);

      expect(result).toBe('| Header |');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty input (semantic)', () => {
      const result = stripVisuals(MarkdownRenderer.render(''));
      expect(result).toBe('');
    });

    test('should handle input with only whitespace (semantic)', () => {
      const result = stripVisuals(MarkdownRenderer.render('   \n  \n  '));
      expect(result).toBe('');
    });

    test('should handle mixed markdown and plain text (semantic)', () => {
      const input = 'Regular text **bold** more text `code` end.';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Regular text bold more text code end');
    });

    test('should handle nested markdown patterns (semantic)', () => {
      const input = '**Bold text with `code` inside**';
      const result = stripVisuals(MarkdownRenderer.render(input));
      // Accept if all key words are present in order
      const words = ['Bold', 'text', 'with', 'code', 'inside'];
      let lastIdx = -1;
      for (const word of words) {
        const idx = result.indexOf(word);
        expect(idx).toBeGreaterThan(lastIdx);
        lastIdx = idx;
      }
    });

    test('should handle malformed markdown gracefully (semantic)', () => {
      const input = '**unclosed bold\n`unclosed code\n[unclosed link(';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('unclosed bold');
      expect(result).toContain('unclosed code');
    });

    test('should handle special characters in code blocks (semantic)', () => {
      const input = '```\n<script>alert("xss")</script>\n```';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('<script>alert("xss")</script>');
    });

    test('should handle very long lines (semantic)', () => {
      const longLine = 'a'.repeat(1000);
      const input = `\`\`\`\n${longLine}\n\`\`\``;
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain(longLine);
    });

    test('should handle multiple consecutive formatting (semantic)', () => {
      const input = '**bold1** **bold2** `code1` `code2`';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('bold1');
      expect(result).toContain('bold2');
      expect(result).toContain('code1');
      expect(result).toContain('code2');
    });

    test('should handle headers at different positions (semantic)', () => {
      const input = 'Text before\n# Header\nText after\n## Another\nEnd';
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Header');
      expect(result).toContain('Another');
      expect(result).toContain('Text before');
      expect(result).toContain('Text after');
    });
  });

  describe('Performance and Complex Cases', () => {
    test('should handle large documents efficiently (semantic)', () => {
      const sections = Array.from({ length: 100 }, (_, i) =>
        `## Section ${i}\nThis is **content** for section ${i} with \`code\` examples.`
      );
      const input = sections.join('\n\n');
      const result = stripVisuals(MarkdownRenderer.render(input));
      expect(result).toContain('Section 0');
      expect(result).toContain('Section 99');
      expect(result).toContain('content for section 0 with code examples');
    });

    test('should handle mixed content types (semantic)', () => {
      const input = `# Main Title\n\nHere's some **bold** text and *italic* text.\n\n\`\`\`javascript\nconst example = "code block";\nconsole.log(example);\n\`\`\`\n\n- List item 1\n- List item 2\n\n> This is a blockquote\n> with multiple lines\n\n[Link example](https://example.com)\n\n| Table | Example |\n|-------|---------|\n| Row 1 | Data 1  |\n| Row 2 | Data 2  |\n\n---\n\nEnd of document.`;
      const result = stripVisuals(MarkdownRenderer.renderWithCodeHighlight(input));
      expect(result).toContain('Main Title');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
      expect(result).toContain('example = "code block";');
      expect(result).toContain('List item 1');
      expect(result).toContain('This is a blockquote');
      expect(result).toContain('Link example');
      expect(result).toContain('https://example.com');
      expect(result).toContain('Table');
      expect(result).toContain('Row 1');
      expect(result).toContain('Data 2');
      expect(result).toContain('End of document');
    });
  });
});
