/**
 * AstGrep Tool - AST-based structural code search and transformation
 *
 * Provides advanced code analysis functionality with support for:
 * - Structural pattern matching using code syntax as patterns
 * - Multi-language support via tree-sitter
 * - Code transformation and rewriting capabilities
 * - Custom rule definitions and configurations
 * - Performance-optimized search across large codebases
 */

import fs from 'fs-extra';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { validatePath } from './validation';

/**
 * Parameters for the AstGrep tool
 */
export interface AstGrepParams {
  /** Pattern to search for (written as code syntax) */
  pattern?: string;
  /** Language to search in (auto-detect if not specified) */
  language?: string;
  /** Paths to search in (files or directories) */
  paths?: string[];
  /** Rewrite pattern for code transformation */
  rewrite?: string;
  /** Custom rule definition (YAML format as string) */
  rule?: string;
  /** Path to configuration file */
  config?: string;
  /** Output format (text, json, csv) */
  format?: 'text' | 'json' | 'csv';
  /** Include context lines around matches */
  context?: number;
  /** Maximum number of matches to return */
  limit?: number;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Search in hidden files and directories */
  includeHidden?: boolean;
  /** Update files in place when using rewrite */
  updateInPlace?: boolean;
}

/**
 * A single AST match result
 */
export interface AstGrepMatch {
  /** File path where match was found */
  file: string;
  /** Line number of the match (1-based) */
  line: number;
  /** Column number of the match (1-based) */
  column: number;
  /** The matched code snippet */
  text: string;
  /** Context lines before the match */
  beforeContext?: string[];
  /** Context lines after the match */
  afterContext?: string[];
  /** Language of the matched code */
  language: string;
  /** Transformed text (when using rewrite) */
  replacement?: string;
}

/**
 * Search statistics
 */
export interface AstGrepStats {
  /** Total files processed */
  filesProcessed: number;
  /** Total matches found */
  matchesFound: number;
  /** Files that were transformed */
  filesTransformed: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** Files that were skipped */
  filesSkipped: number;
}

/**
 * AstGrep tool result
 */
export interface AstGrepResult {
  /** Array of matches */
  matches: AstGrepMatch[];
  /** Pattern or rule used */
  query: string;
  /** Search paths */
  searchPaths: string[];
  /** Search statistics */
  stats: AstGrepStats;
  /** Whether results were truncated due to limit */
  truncated: boolean;
  /** Mode used (search, rewrite, rule) */
  mode: 'search' | 'rewrite' | 'rule';
}

export class AstGrepTool extends BaseTool {
  readonly name = 'ast_grep';
  readonly description = '**STRONGLY RECOMMENDED** Advanced structural code search and transformation using AST patterns - USE THIS INSTEAD OF RIPGREP for code analysis, refactoring, finding function definitions, class patterns, and semantic code structures across multiple languages. This is the preferred tool for understanding code structure and relationships.';
  private astGrepPath: string | null = null;

  constructor(context: Partial<ToolContext> = {}) {
    super(context);
    this.astGrepPath = this.findAstGrepPath();
  }

  /**
   * Check if ast-grep is available on the system
   */
  isAstGrepAvailable(): boolean {
    if (!this.astGrepPath) return false;

    try {
      execSync(`${this.astGrepPath} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find ast-grep command path on the system
   */
  private findAstGrepPath(): string {
    try {
      // Try npx first (for npm installations)
      try {
        execSync('npx ast-grep --version', { stdio: 'ignore' });
        return 'npx ast-grep';
      } catch {
        // Continue to other methods
      }

      // Try global ast-grep installation
      return execSync('which ast-grep', { encoding: 'utf8' }).trim();
    } catch {
      // Check common installation locations
      const commonLocations = [
        // Node.js/npm locations
        'node_modules/.bin/ast-grep',
        './node_modules/.bin/ast-grep',

        // System locations
        '/usr/local/bin/ast-grep',
        '/opt/homebrew/bin/ast-grep',
        '/usr/bin/ast-grep',

        // Cargo/Rust locations
        process.env.HOME ? `${process.env.HOME}/.cargo/bin/ast-grep` : null
      ].filter(Boolean) as string[];

      for (const location of commonLocations) {
        try {
          const stats = fs.statSync(location);
          if (stats.isFile() && (stats.mode & 0o111)) {
            return location;
          }
        } catch {
          continue;
        }
      }

      // Default to npx ast-grep (will be available after npm install)
      return 'npx ast-grep';
    }
  }

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Code pattern to search for (written as normal code syntax, e.g., "function $NAME($$$) { $$$ }")'
      },
      language: {
        type: 'string',
        description: 'Programming language (js, ts, py, rs, go, java, cpp, etc.) - auto-detected if not specified',
        enum: ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'php', 'rb', 'cs', 'kt', 'swift', 'scala', 'dart']
      },
      paths: {
        type: 'array',
        description: 'Files or directories to search in (default: current directory)',
        items: {
          type: 'string'
        }
      },
      rewrite: {
        type: 'string',
        description: 'Replacement pattern for code transformation (use with pattern)'
      },
      rule: {
        type: 'string',
        description: 'Custom rule definition in YAML format as string'
      },
      config: {
        type: 'string',
        description: 'Path to ast-grep configuration file'
      },
      format: {
        type: 'string',
        description: 'Output format',
        enum: ['text', 'json', 'csv'],
        default: 'json'
      },
      context: {
        type: 'number',
        description: 'Number of context lines to show around matches',
        minimum: 0,
        maximum: 10,
        default: 0
      },
      limit: {
        type: 'number',
        description: 'Maximum number of matches to return',
        minimum: 1,
        maximum: 1000,
        default: 100
      },
      include: {
        type: 'array',
        description: 'File patterns to include (e.g., ["*.ts", "*.js"])',
        items: {
          type: 'string'
        }
      },
      exclude: {
        type: 'array',
        description: 'File patterns to exclude (e.g., ["node_modules", "*.test.js"])',
        items: {
          type: 'string'
        }
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories',
        default: false
      },
      updateInPlace: {
        type: 'boolean',
        description: 'Update files in place when using rewrite (CAUTION: modifies files)',
        default: false
      }
    },
    additionalProperties: false
  };

  protected async executeImpl(params: AstGrepParams, abortSignal?: AbortSignal): Promise<ToolResult> {
    const startTime = Date.now();
    const {
      pattern,
      language,
      paths = [this.context.workingDirectory],
      rewrite,
      rule,
      config,
      format = 'json',
      context: contextLines = 0,
      limit = 100,
      include = [],
      exclude = [],
      includeHidden = false,
      updateInPlace = false
    } = params;

    try {
      // Validate that we have at least one search method
      if (!pattern && !rule && !config) {
        return this.createErrorResult(
          'Must provide either pattern, rule, or config parameter',
          'VALIDATION_ERROR',
          ['Provide a pattern: "function $NAME() { $$$ }"', 'Or provide a custom rule definition', 'Or specify a config file path']
        );
      }

      // Check if ast-grep is available
      if (!this.isAstGrepAvailable()) {
        return this.createErrorResult(
          'ast-grep is not available. Please install it using: npm install -g @ast-grep/cli',
          'TOOL_NOT_FOUND',
          ['Install ast-grep: npm install -g @ast-grep/cli', 'Or use npm install @ast-grep/cli for local installation']
        );
      }

      // Validate and resolve search paths
      const resolvedPaths: string[] = [];
      for (const searchPath of paths) {
        try {
          validatePath(searchPath, { allowAbsolute: true, mustExist: true });
          const absolutePath = path.resolve(searchPath);

          // Check for blocked paths
          if (this.isBlockedPath(absolutePath)) {
            continue; // Skip blocked paths
          }

          resolvedPaths.push(absolutePath);
        } catch (error) {
          // Log warning but continue with other paths
          console.warn(`Skipping invalid path: ${searchPath}`);
        }
      }

      if (resolvedPaths.length === 0) {
        return this.createErrorResult(
          'No valid search paths provided',
          'VALIDATION_ERROR',
          ['Provide at least one valid file or directory path']
        );
      }

      // Execute ast-grep search
      const searchResult = await this.executeAstGrep(params, resolvedPaths);

      // Add execution time to stats
      searchResult.stats.executionTime = Date.now() - startTime;

      return this.createSuccessResult(searchResult, {
        matchesFound: searchResult.matches.length,
        searchPaths: resolvedPaths,
        mode: searchResult.mode
      });

    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `AST search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Execute ast-grep command
   */
  private async executeAstGrep(params: AstGrepParams, searchPaths: string[]): Promise<AstGrepResult> {
    const astGrepPath = this.astGrepPath || 'npx ast-grep';

    return new Promise((resolve, reject) => {
      const args = this.buildAstGrepArgs(params, searchPaths);

      const child = spawn(astGrepPath.split(' ')[0], astGrepPath.includes(' ') ? [...astGrepPath.split(' ').slice(1), ...args] : args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.context.workingDirectory
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        // ast-grep returns 0 for success, 1 for no matches, 2+ for errors
        if (code === 0 || code === 1) {
          try {
            const result = this.parseAstGrepOutput(stdout, params, searchPaths);
            resolve(result);
          } catch (error) {
            reject(new ToolError(
              `Failed to parse ast-grep output: ${error instanceof Error ? error.message : 'Unknown error'}`,
              'UNKNOWN_ERROR'
            ));
          }
        } else {
          reject(new ToolError(
            `ast-grep command failed (exit code ${code}): ${stderr || 'Unknown error'}`,
            'UNKNOWN_ERROR'
          ));
        }
      });

      child.on('error', (error) => {
        reject(new ToolError(
          `Failed to execute ast-grep: ${error.message}`,
          'UNKNOWN_ERROR',
          ['Ensure ast-grep is properly installed', 'Check if the command is available in PATH']
        ));
      });
    });
  }

  /**
   * Build ast-grep command arguments
   */
  private buildAstGrepArgs(params: AstGrepParams, searchPaths: string[]): string[] {
    const args: string[] = [];

    // Use 'run' command (default command for search/rewrite)
    args.push('run');

    // Pattern is required for run command
    if (params.pattern) {
      args.push('--pattern', params.pattern);
    }

    // Rewrite functionality
    if (params.rewrite) {
      args.push('--rewrite', params.rewrite);

      if (params.updateInPlace) {
        args.push('--update-all');
      }
    }

    // Language specification
    if (params.language) {
      args.push('--lang', params.language);
    }

    // Output format - use JSON for better parsing
    if (params.format === 'json') {
      args.push('--json=stream');
    }

    // Context lines
    if (params.context && params.context > 0) {
      args.push('--context', params.context.toString());
    }

    // Include patterns using globs
    if (params.include && params.include.length > 0) {
      for (const pattern of params.include) {
        args.push('--globs', pattern);
      }
    }

    // Exclude patterns using globs
    if (params.exclude && params.exclude.length > 0) {
      for (const pattern of params.exclude) {
        args.push('--globs', `!${pattern}`);
      }
    }

    // Hidden files
    if (params.includeHidden) {
      args.push('--no-ignore', 'hidden');
    }

    // Add search paths
    args.push(...searchPaths);

    return args;
  }

  /**
   * Parse ast-grep command output
   */
  private parseAstGrepOutput(output: string, params: AstGrepParams, searchPaths: string[]): AstGrepResult {
    const matches: AstGrepMatch[] = [];
    const stats: AstGrepStats = {
      filesProcessed: 0,
      matchesFound: 0,
      filesTransformed: 0,
      executionTime: 0,
      filesSkipped: 0
    };

    // Determine mode
    let mode: 'search' | 'rewrite' | 'rule' = 'search';
    if (params.rewrite) mode = 'rewrite';
    else if (params.rule || params.config) mode = 'rule';

    // Get query description
    const query = params.pattern || params.rule || params.config || 'unknown';

    if (!output.trim()) {
      // No matches found
      return {
        matches: [],
        query,
        searchPaths,
        stats,
        truncated: false,
        mode
      };
    }

    try {
      if (params.format === 'json') {
        // Parse JSON stream output (--json=stream)
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const jsonMatch = JSON.parse(line);

            // ast-grep JSON format has: file, range: { start: { line, column } }, text, lines, language
            const match: AstGrepMatch = {
              file: this.getRelativePath(jsonMatch.file, searchPaths),
              line: jsonMatch.range?.start?.line || 1,
              column: jsonMatch.range?.start?.column || 1,
              text: jsonMatch.lines || jsonMatch.text || '',
              language: jsonMatch.language || params.language || this.detectLanguage(jsonMatch.file),
              replacement: jsonMatch.replacement
            };

            matches.push(match);
            stats.matchesFound++;
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      } else {
        // Parse text output - ast-grep default format
        const lines = output.split('\n');
        let currentFile = '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // Check if this is a file header
          if (!line.startsWith(' ') && line.includes(':')) {
            const parts = line.split(':');
            if (parts.length >= 3) {
              const filePath = parts[0];
              const lineNum = parseInt(parts[1], 10);
              const colNum = parseInt(parts[2], 10);
              const text = parts.slice(3).join(':').trim();

              if (!isNaN(lineNum) && !isNaN(colNum)) {
                const match: AstGrepMatch = {
                  file: this.getRelativePath(filePath, searchPaths),
                  line: lineNum,
                  column: colNum,
                  text: text,
                  language: params.language || this.detectLanguage(filePath)
                };

                matches.push(match);
                stats.matchesFound++;
              }
            }
          }
        }
      }
    } catch (error) {
      throw new ToolError(
        `Failed to parse ast-grep output: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }

    // Count unique files processed
    const uniqueFiles = new Set(matches.map(m => m.file));
    stats.filesProcessed = uniqueFiles.size;

    if (mode === 'rewrite' && params.updateInPlace) {
      stats.filesTransformed = uniqueFiles.size;
    }

    return {
      matches,
      query,
      searchPaths,
      stats,
      truncated: params.limit ? matches.length >= params.limit : false,
      mode
    };
  }

  /**
   * Get human-readable output for display formatting
   */
  getHumanReadableOutput(params: any, success: boolean, result?: any): string {
    if (!success) {
      const errorMsg = result instanceof Error ? result.message :
                      typeof result === 'string' ? result :
                      result?.message || 'Unknown error';
      return `\n${errorMsg}`;
    }

    if (typeof result === 'object' && result?.matches) {
      const matches = result.matches.length;
      const files = new Set(result.matches.map((match: any) => match.file)).size;
      const mode = result.mode || 'search';
      if (mode === 'rewrite' && result.stats?.filesTransformed) {
        return ` • ${matches} matches, ${result.stats.filesTransformed} files transformed`;
      }
      return ` • ${matches} matches in ${files} files`;
    }
    return ` • searched`;
  }

  /**
   * Check if a path is in the blocked list
   */
  private isBlockedPath(targetPath: string): boolean {
    const normalizedPath = path.normalize(targetPath);
    const pathParts = normalizedPath.split(path.sep);

    return this.context.blockedPaths.some(blockedPattern => {
      return pathParts.some(part => {
        return (
          part === blockedPattern ||
          normalizedPath.includes(blockedPattern) ||
          normalizedPath.includes('node_modules') ||
          normalizedPath.includes('.git') ||
          normalizedPath.includes('dist') ||
          normalizedPath.includes('build')
        );
      });
    });
  }

  /**
   * Get relative path from search paths
   */
  private getRelativePath(filePath: string, searchPaths: string[]): string {
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }

    // Find the best matching search path
    for (const searchPath of searchPaths) {
      if (filePath.startsWith(searchPath)) {
        return path.relative(searchPath, filePath) || path.basename(filePath);
      }
    }

    return path.basename(filePath);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.js': 'js',
      '.jsx': 'jsx',
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.py': 'py',
      '.rs': 'rs',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.php': 'php',
      '.rb': 'rb',
      '.cs': 'cs',
      '.kt': 'kt',
      '.swift': 'swift',
      '.scala': 'scala',
      '.dart': 'dart'
    };

    return languageMap[ext] || 'unknown';
  }
}