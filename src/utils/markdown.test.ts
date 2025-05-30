import { MarkdownRenderer } from './markdown';

// Mock chalk to return identifiable strings for testing
jest.mock('chalk', () => ({
  bold: jest.fn((text) => `BOLD(${text})`),
  italic: jest.fn((text) => `ITALIC(${text})`),
  cyan: Object.assign(jest.fn((text) => `CYAN(${text})`), {
    bold: jest.fn((text) => `CYAN_BOLD(${text})`)
  }),
  gray: Object.assign(jest.fn((text) => `GRAY(${text})`), {
    inverse: jest.fn((text) => `GRAY_INVERSE(${text})`),
    italic: jest.fn((text) => `GRAY_ITALIC(${text})`)
  }),
  green: jest.fn((text) => `GREEN(${text})`),
  blue: Object.assign(jest.fn((text) => `BLUE(${text})`), {
    underline: jest.fn((text) => `BLUE_UNDERLINE(${text})`),
    bold: jest.fn((text) => `BLUE_BOLD(${text})`)
  }),
  yellow: Object.assign(jest.fn((text) => `YELLOW(${text})`), {
    bold: jest.fn((text) => `YELLOW_BOLD(${text})`)
  }),
  magenta: jest.fn((text) => `MAGENTA(${text})`)
}));

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('render() - Basic Functionality', () => {
    test('should render headers correctly', () => {
      const input = `# Main Header
## Sub Header
### Small Header`;

      const result = MarkdownRenderer.render(input);

      expect(result).toContain('BLUE_BOLD(Main Header)');
      expect(result).toContain('CYAN_BOLD(Sub Header)');
      expect(result).toContain('YELLOW_BOLD(Small Header)');
    });

    test('should render bold text with ** and __', () => {
      const input = 'This is **bold** and this is __also bold__.';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('BOLD(bold)');
      expect(result).toContain('BOLD(also bold)');
    });

    test('should render italic text with * and _', () => {
      const input = 'This is *italic* and this is _also italic_.';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('ITALIC(italic)');
      expect(result).toContain('ITALIC(also italic)');
    });

    test('should render inline code with backticks', () => {
      const input = 'Use the `console.log()` function.';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY_INVERSE( console.log() )');
    });

    test('should render unordered lists', () => {
      const input = `- Item 1
* Item 2
+ Item 3`;

      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GREEN(  • ) Item 1');
      expect(result).toContain('GREEN(  • ) Item 2');
      expect(result).toContain('GREEN(  • ) Item 3');
    });

    test('should render ordered lists', () => {
      const input = `1. First item
2. Second item
10. Tenth item`;

      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GREEN(  1. First item)');
      expect(result).toContain('GREEN(  2. Second item)');
      expect(result).toContain('GREEN(  10. Tenth item)');
    });

    test('should render blockquotes', () => {
      const input = '> This is a quote\n> Multi-line quote';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY(│ )ITALIC(This is a quote)');
      expect(result).toContain('GRAY(│ )ITALIC(Multi-line quote)');
    });

    test('should render horizontal rules', () => {
      const input = 'Before\n---\nAfter';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY(────────────────────────────────────────────────────────)');
    });

    test('should render links', () => {
      const input = 'Check out [Google](https://google.com) for search.';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('BLUE_UNDERLINE(Google)GRAY( (https://google.com))');
    });
  });

  describe('render() - Code Blocks', () => {
    test('should render simple code blocks', () => {
      const input = '```\nconst x = 1;\nconsole.log(x);\n```';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY(┌─ code ─');
      expect(result).toContain('GRAY(│ )const x = 1;');
      expect(result).toContain('GRAY(│ )console.log(x);');
      expect(result).toContain('GRAY(└────────────────────────────────────────────────────────)');
    });

    test('should render code blocks with language', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY(┌─ javascript ─');
      expect(result).toContain('GRAY(│ )const x = 1;');
    });

    test('should handle empty code blocks', () => {
      const input = '```\n\n```';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('GRAY(┌─ code ─');
      expect(result).toContain('GRAY(└────────────────────────────────────────────────────────)');
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
    test('should handle empty input', () => {
      const result = MarkdownRenderer.render('');
      expect(result).toBe('');
    });

    test('should handle input with only whitespace', () => {
      const result = MarkdownRenderer.render('   \n  \n  ');
      expect(result).toBe('   \n  \n  ');
    });

    test('should handle mixed markdown and plain text', () => {
      const input = 'Regular text **bold** more text `code` end.';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('Regular text BOLD(bold) more text GRAY_INVERSE( code ) end.');
    });

    test('should handle nested markdown patterns', () => {
      const input = '**Bold text with `code` inside**';
      const result = MarkdownRenderer.render(input);

      // Should handle both bold and code
      expect(result).toContain('BOLD(Bold text with GRAY_INVERSE( code ) inside)');
    });

    test('should handle malformed markdown gracefully', () => {
      const input = '**unclosed bold\n`unclosed code\n[unclosed link(';
      const result = MarkdownRenderer.render(input);

      // Should not crash and return something reasonable
      expect(result).toContain('**unclosed bold');
      expect(result).toContain('`unclosed code');
    });

    test('should handle special characters in code blocks', () => {
      const input = '```\n<script>alert("xss")</script>\n```';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('<script>alert("xss")</script>');
    });

    test('should handle very long lines', () => {
      const longLine = 'a'.repeat(1000);
      const input = `\`\`\`\n${longLine}\n\`\`\``;
      const result = MarkdownRenderer.render(input);

      expect(result).toContain(longLine);
    });

    test('should handle multiple consecutive formatting', () => {
      const input = '**bold1** **bold2** `code1` `code2`';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('BOLD(bold1)');
      expect(result).toContain('BOLD(bold2)');
      expect(result).toContain('GRAY_INVERSE( code1 )');
      expect(result).toContain('GRAY_INVERSE( code2 )');
    });

    test('should handle headers at different positions', () => {
      const input = 'Text before\n# Header\nText after\n## Another\nEnd';
      const result = MarkdownRenderer.render(input);

      expect(result).toContain('BLUE_BOLD(Header)');
      expect(result).toContain('CYAN_BOLD(Another)');
      expect(result).toContain('Text before');
      expect(result).toContain('Text after');
    });
  });

  describe('Performance and Complex Cases', () => {
    test('should handle large documents efficiently', () => {
      const sections = Array.from({ length: 100 }, (_, i) =>
        `## Section ${i}\nThis is **content** for section ${i} with \`code\` examples.`
      );
      const input = sections.join('\n\n');

      const start = Date.now();
      const result = MarkdownRenderer.render(input);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(result).toContain('CYAN_BOLD(Section 0)');
      expect(result).toContain('CYAN_BOLD(Section 99)');
    });

    test('should handle mixed content types', () => {
      const input = `# Main Title

Here's some **bold** text and *italic* text.

\`\`\`javascript
const example = "code block";
console.log(example);
\`\`\`

- List item 1
- List item 2

> This is a blockquote
> with multiple lines

[Link example](https://example.com)

| Table | Example |
|-------|---------|
| Row 1 | Data 1  |
| Row 2 | Data 2  |

---

End of document.`;

      const result = MarkdownRenderer.renderWithCodeHighlight(input);

      expect(result).toContain('BLUE_BOLD(Main Title)');
      expect(result).toContain('BOLD(bold)');
      expect(result).toContain('ITALIC(italic)');
      expect(result).toContain('MAGENTA(const)');
      expect(result).toContain('GREEN(  • ) List item 1');
      expect(result).toContain('GRAY(│ )ITALIC(This is a blockquote)');
      expect(result).toContain('BLUE_UNDERLINE(Link example)');
    });
  });
});
