import fs from 'fs-extra';
import * as path from 'path';
import { CodeSymbol, FileAnalysis } from './codeStructure';
import { Logger } from './logger';

/**
 * Tree-sitter based parser for code analysis
 * Currently implements regex-based parsing as a fallback
 * TODO: Implement full tree-sitter integration when web-tree-sitter is properly configured
 */
export class TreeSitterParser {
  private logger: Logger = Logger.getInstance();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // For now, no initialization needed for regex-based parsing
    this.initialized = true;
    this.logger.debug('TreeSitterParser initialized (regex-based)');
  }

  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    if (!this.initialized) {
      await this.initialize();
    }

    const language = this.detectLanguage(filePath);
    if (!language) {
      return {
        filePath,
        language: 'unknown',
        symbols: [],
        imports: [],
        exports: [],
        errors: ['Unsupported or unknown language']
      };
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      const analysis: FileAnalysis = {
        filePath,
        language,
        symbols: [],
        imports: [],
        exports: [],
        errors: []
      };

      // Analyze based on language using regex patterns
      switch (language) {
        case 'typescript':
        case 'javascript':
          this.analyzeJavaScriptCode(content, analysis);
          break;
        case 'python':
          this.analyzePythonCode(content, analysis);
          break;
        case 'rust':
          this.analyzeRustCode(content, analysis);
          break;
        default:
          analysis.errors.push(`Analysis not implemented for language: ${language}`);
      }

      return analysis;
    } catch (error) {
      this.logger.error(`Error analyzing file ${filePath}:`, error as Error);
      return {
        filePath,
        language,
        symbols: [],
        imports: [],
        exports: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();

    const extensionMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.py': 'python',
      '.rs': 'rust'
    };

    return extensionMap[ext] || null;
  }

  private analyzeJavaScriptCode(content: string, analysis: FileAnalysis): void {
    const lines = content.split('\n');

    // Extract functions
    const functionRegex = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>)/gm;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        analysis.symbols.push({
          name,
          type: 'function',
          startLine: lineNumber,
          endLine: lineNumber, // Simplified for regex approach
          isExported: match[0].includes('export'),
          isAsync: match[0].includes('async')
        });
      }
    }

    // Extract classes
    const classRegex = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'class',
        startLine: lineNumber,
        endLine: lineNumber,
        isExported: match[0].includes('export')
      });
    }

    // Extract interfaces
    const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/gm;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'interface',
        startLine: lineNumber,
        endLine: lineNumber,
        isExported: match[0].includes('export')
      });
    }

    // Extract type aliases
    const typeRegex = /^(?:export\s+)?type\s+(\w+)/gm;
    while ((match = typeRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'type',
        startLine: lineNumber,
        endLine: lineNumber,
        isExported: match[0].includes('export')
      });
    }

    // Extract constants and variables
    const varRegex = /^(?:export\s+)?(?:const|let|var)\s+(\w+)/gm;
    while ((match = varRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: match[0].includes('const') ? 'constant' : 'variable',
        startLine: lineNumber,
        endLine: lineNumber,
        isExported: match[0].includes('export')
      });
    }

    // Extract imports
    const importRegex = /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
    while ((match = importRegex.exec(content)) !== null) {
      analysis.imports.push(match[1]);
    }

    // Extract require imports
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (!analysis.imports.includes(match[1])) {
        analysis.imports.push(match[1]);
      }
    }

    // Extract exports
    const exportRegex = /^export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)?\s*([^;{]+)/gm;
    while ((match = exportRegex.exec(content)) !== null) {
      analysis.exports.push(match[1].trim());
    }
  }

  private analyzePythonCode(content: string, analysis: FileAnalysis): void {
    const lines = content.split('\n');

    // Extract functions
    const functionRegex = /^(?:async\s+)?def\s+(\w+)/gm;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'function',
        startLine: lineNumber,
        endLine: lineNumber,
        isAsync: match[0].includes('async')
      });
    }

    // Extract classes
    const classRegex = /^class\s+(\w+)/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'class',
        startLine: lineNumber,
        endLine: lineNumber
      });
    }

    // Extract imports
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      const module = match[1] || match[2].split(',')[0].trim();
      analysis.imports.push(module);
    }
  }

  private analyzeRustCode(content: string, analysis: FileAnalysis): void {
    const lines = content.split('\n');

    // Extract functions
    const functionRegex = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'function',
        startLine: lineNumber,
        endLine: lineNumber,
        visibility: match[0].includes('pub') ? 'public' : 'private',
        isAsync: match[0].includes('async')
      });
    }

    // Extract structs
    const structRegex = /^(?:pub\s+)?struct\s+(\w+)/gm;
    while ((match = structRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'class',
        startLine: lineNumber,
        endLine: lineNumber,
        visibility: match[0].includes('pub') ? 'public' : 'private'
      });
    }

    // Extract enums
    const enumRegex = /^(?:pub\s+)?enum\s+(\w+)/gm;
    while ((match = enumRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      analysis.symbols.push({
        name: match[1],
        type: 'enum',
        startLine: lineNumber,
        endLine: lineNumber,
        visibility: match[0].includes('pub') ? 'public' : 'private'
      });
    }

    // Extract use statements
    const useRegex = /^use\s+([^;]+);/gm;
    while ((match = useRegex.exec(content)) !== null) {
      analysis.imports.push(match[1]);
    }
  }
}
