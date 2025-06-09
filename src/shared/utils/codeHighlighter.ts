import chalk from 'chalk';

// Color mapping for different token types
const colors = {
  keyword: 'blue',
  string: 'green', 
  comment: 'gray',
  number: 'cyan',
  function: 'yellow',
  operator: 'white',
  decorator: 'magenta',
  default: 'white'
};

// Simple regex patterns for common code elements
const patterns = {
  // Keywords from various programming languages
  keyword: /\b(const|let|var|function|class|if|else|for|while|return|import|export|async|await|try|catch|finally|throw|new|this|super|extends|implements|interface|type|enum|namespace|public|private|protected|static|readonly|from|of|in|as|break|case|continue|default|do|switch|void|with|yield|delete|instanceof|typeof|abstract|boolean|byte|char|debugger|double|final|float|goto|int|long|native|short|synchronized|throws|transient|volatile|package|import|module|def|lambda|global|nonlocal|pass|assert|del|elif|except|raise|is|not|and|or|print|struct|union|sizeof|extern|auto|register|typedef|require|include|define|pragma|inline|const|let|var|fn|mut|use|pub|impl|trait|where|match|loop|ref|move|unsafe|override|dyn|macro|rule|static|self|Self|mod|crate)\b/g,
  
  // Strings (double and single quotes)
  string: /(["'`])((?:\\\1|(?:(?!\1).))*)\1/g,
  
  // Comments (single line and multi-line)
  comment: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
  
  // Numbers (integers, floats, hex, binary, octal, scientific notation)
  number: /\b(0x[a-fA-F0-9]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
  
  // Function calls (word followed by parentheses)
  function: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
  
  // Common operators
  operator: /[+\-*/=<>!&|%^~?:]/g,

  // Decorators/Annotations
  decorator: /@([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g
};

/**
 * Simple code highlighter for terminal output
 */
export class CodeHighlighter {
  /**
   * Highlight code with basic syntax highlighting
   */
  static highlight(code: string, language?: string): string {
    let highlighted = code;
    let languagePatterns = { ...patterns };

    // Apply language-specific patterns if available
    if (language) {
      languagePatterns = this.getLanguagePatterns(language) || languagePatterns;
    }

    // Apply highlighting patterns in order of precedence
    // Comments first to avoid highlighting keywords in comments
    highlighted = highlighted.replace(languagePatterns.comment || patterns.comment, (match) => chalk.gray(match));
    
    // Strings second to avoid highlighting keywords in strings
    highlighted = highlighted.replace(languagePatterns.string || patterns.string, (match) => chalk.green(match));

    // Keywords
    highlighted = highlighted.replace(languagePatterns.keyword || patterns.keyword, (match) => chalk.blue(match));

    // Numbers
    highlighted = highlighted.replace(languagePatterns.number || patterns.number, (match) => chalk.cyan(match));

    // Function calls
    highlighted = highlighted.replace(languagePatterns.function || patterns.function, (match) => chalk.yellow(match));

    // Operators
    highlighted = highlighted.replace(languagePatterns.operator || patterns.operator, (match) => chalk.white(match));
    
    // Decorators/Annotations (if present in the patterns)
    if (patterns.decorator) {
      highlighted = highlighted.replace(patterns.decorator, (match) => chalk.magenta(match));
    }

    return highlighted;
  }
  
  /**
   * Get available color for a token type
   */
  static getColor(tokenType: string): string {
    return colors[tokenType as keyof typeof colors] || colors.default;
  }

  /**
   * Get language-specific patterns for better syntax highlighting
   */
  private static getLanguagePatterns(language: string): typeof patterns | null {
    switch (language.toLowerCase()) {
      case 'python':
        return {
          ...patterns,
          keyword: /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g,
          comment: /#.*$|'''[\s\S]*?'''|\"\"\"|[\s\S]*?\"\"\"/gm,
          decorator: /@([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g
        };
      case 'html':
        return {
          ...patterns,
          keyword: /\b(html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|h1|h2|h3|h4|h5|h6|form|input|button|select|option|label|script|style|link|meta)\b/g,
          string: /(["'])((?:\\\1|(?:(?!\1).))*)\1/g,
          comment: /<!--[\s\S]*?-->/g,
          tag: /<\/?([^\s>/=]+)(\s+[^\s>/=]+=("[^"]*"|'[^']*'|[^\s"'`=<>/]+))*\s*\/?>/g
        };
      case 'css':
        return {
          ...patterns,
          keyword: /\b(body|div|span|p|a|img|ul|ol|li|table|tr|td|th|h1|h2|h3|h4|h5|h6|\@media|\@keyframes|\@font-face|\@import)\b/g,
          comment: /\/\*[\s\S]*?\*\//g,
          selector: /[^{}\s][^{}]*(?=\s*\{)/g,
          property: /([\w-]+)(?=\s*:)/g
        };
      case 'sql':
        return {
          ...patterns,
          keyword: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|AS|ON|SET|VALUES|INTO|NULL|NOT|IS|IN|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX)\b/gi,
          comment: /--.*$|\/\*[\s\S]*?\*\//gm,
          string: /(["'])((?:\\\1|(?:(?!\1).))*)\1/g
        };
      default:
        return null;
    }
  }
}