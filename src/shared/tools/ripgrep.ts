/**
 * Ripgrep Tool - Fast text search with context and filtering
 *
 * Provides advanced text search functionality with support for:
 * - Fast text search across files and directories
 * - Context lines (before/after matches)
 * - File type filtering and custom extensions
 * - Line numbers and file headings
 * - Case-insensitive search and regex patterns
 * - Search statistics and performance metrics
 * - Security filtering to exclude sensitive directories
 */

import fs from 'fs-extra';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { validatePath } from './validation';

/**
 * Parameters for the Ripgrep tool
 */
export interface RipgrepParams {
  /** Search pattern (can be regex) */
  pattern: string;
  /** Directory or file to search in (default: current directory) */
  path?: string;
  /** Include lines after matches for context */
  after?: number;
  /** Include lines before matches for context */
  before?: number;
  /** File types to include (js, ts, py, etc.) */
  types?: string[];
  /** File extensions to include (alternative to types) */
  extensions?: string[];
  /** Whether search should be case-insensitive */
  ignoreCase?: boolean;
  /** Whether to show line numbers */
  lineNumbers?: boolean;
  /** Whether to show file headings */
  heading?: boolean;
  /** Whether to group matches by file */
  group?: boolean;
  /** Whether the pattern is a regex */
  regex?: boolean;
  /** Whether to show search statistics */
  stats?: boolean;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Include hidden files and directories */
  includeHidden?: boolean;
}

/**
 * A single search match
 */
export interface RipgrepMatch {
  /** File path where match was found */
  file: string;
  /** Line number of the match (1-based) */
  lineNumber: number;
  /** Column number of the match (1-based) */
  column: number;
  /** The matched line content */
  line: string;
  /** Context lines before the match */
  beforeContext?: string[];
  /** Context lines after the match */
  afterContext?: string[];
  /** The specific matched text */
  matchedText: string;
}

/**
 * Search statistics
 */
export interface RipgrepStats {
  /** Total files searched */
  filesSearched: number;
  /** Total matches found */
  matchesFound: number;
  /** Total lines scanned */
  linesScanned: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** Files that were skipped (due to binary content, etc.) */
  filesSkipped: number;
}

/**
 * Ripgrep tool result
 */
export interface RipgrepResult {
  /** Array of search matches */
  matches: RipgrepMatch[];
  /** Search pattern used */
  pattern: string;
  /** Directory searched */
  searchPath: string;
  /** Search statistics */
  stats: RipgrepStats;
  /** Whether the search was truncated due to maxResults */
  truncated: boolean;
  /** Total number of matches before truncation */
  totalMatches: number;
}

export class RipgrepTool extends BaseTool {
  readonly name = 'ripgrep';
  readonly description = 'Fast text search across files and directories - USE FOR: plain text search, log analysis, finding literal strings, configuration values. For code structure analysis, function definitions, or semantic patterns, USE AST_GREP instead.';
  private ripgrepPath: string | null = null;

  constructor(context: Partial<ToolContext> = {}) {
    super(context);
    // Find ripgrep path at initialization
    this.ripgrepPath = this.findRipgrepPath();
  }

  /**
   * Check if ripgrep is available on the system
   */
  isRipgrepAvailable(): boolean {
    if (!this.ripgrepPath) return false;

    // If it's just 'rg', try to execute it to see if it works
    if (this.ripgrepPath === 'rg') {
      try {
        execSync('rg --version', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }

    // If it's a full path, check if the file exists
    return fs.existsSync(this.ripgrepPath);
  }

  /**
   * Find ripgrep command path on the system
   */
  private findRipgrepPath(): string {
    try {
      // Try to find ripgrep using which command
      return execSync('which rg', { encoding: 'utf8' }).trim();
    } catch {
      // If which command fails, check common ripgrep installation locations
      const commonLocations = [
        // macOS locations
        '/usr/local/bin/rg',
        '/opt/homebrew/bin/rg',
        '/opt/local/bin/rg',

        // Linux locations
        '/usr/bin/rg',
        '/usr/local/bin/rg',
        '/bin/rg',
        '/snap/bin/rg',

        // Other possible locations
        process.env.HOME ? `${process.env.HOME}/.cargo/bin/rg` : null // For Rust/Cargo installations
      ].filter(Boolean) as string[];

      for (const location of commonLocations) {
        try {
          // Check if file exists and is executable
          const stats = fs.statSync(location);
          if (stats.isFile() && (stats.mode & 0o111)) { // Check if executable
            return location;
          }
        } catch {
          // Continue to next location if this one doesn't exist
          continue;
        }
      }

      // If we can't find ripgrep, default to 'rg' and let execution fail with clear error
      return 'rg';
    }
  }

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Search pattern (can be regex)'
      },
      path: {
        type: 'string',
        description: 'Directory or file to search in (default: current directory)'
      },
      after: {
        type: 'number',
        description: 'Number of lines to show after each match',
        minimum: 0,
        maximum: 10
      },
      before: {
        type: 'number',
        description: 'Number of lines to show before each match',
        minimum: 0,
        maximum: 10
      },
      types: {
        type: 'array',
        description: 'File types to include (js, ts, py, cpp, etc.)',
        items: {
          type: 'string'
        }
      },
      extensions: {
        type: 'array',
        description: 'File extensions to include (.js, .ts, .py, etc.)',
        items: {
          type: 'string'
        }
      },
      ignoreCase: {
        type: 'boolean',
        description: 'Case-insensitive search',
        default: false
      },
      lineNumbers: {
        type: 'boolean',
        description: 'Show line numbers',
        default: true
      },
      heading: {
        type: 'boolean',
        description: 'Show file headings',
        default: true
      },
      group: {
        type: 'boolean',
        description: 'Group matches by file',
        default: true
      },
      // regex: {
      //   type: 'boolean',
      //   description: 'Treat pattern as regex',
      //   default: true
      // },
      stats: {
        type: 'boolean',
        description: 'Show search statistics',
        default: false
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        minimum: 1,
        maximum: 1000,
        default: 100
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories',
        default: false
      }
    },
    required: ['pattern'],
    additionalProperties: false
  };

  // File type mappings similar to ripgrep
  private static readonly FILE_TYPE_MAPPINGS: Record<string, string[]> = {
    js: ['.js', '.jsx', '.mjs'],
    ts: ['.ts', '.tsx'],
    py: ['.py', '.pyi', '.pyw'],
    cpp: ['.cpp', '.cc', '.cxx', '.c++', '.C', '.h', '.hpp', '.hh', '.hxx', '.h++'],
    c: ['.c', '.h'],
    java: ['.java'],
    go: ['.go'],
    rust: ['.rs'],
    php: ['.php', '.php3', '.php4', '.php5', '.phtml'],
    rb: ['.rb', '.ruby'],
    css: ['.css', '.scss', '.sass', '.less'],
    html: ['.html', '.htm', '.xhtml'],
    xml: ['.xml', '.xsl', '.xslt'],
    json: ['.json'],
    yaml: ['.yaml', '.yml'],
    md: ['.md', '.markdown'],
    txt: ['.txt'],
    sh: ['.sh', '.bash', '.zsh'],
    sql: ['.sql'],
    web: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.html', '.css', '.scss']
  };

  protected async executeImpl(params: RipgrepParams, abortSignal?: AbortSignal): Promise<ToolResult> {
    const startTime = Date.now();
    const {
      pattern,
      path: searchPath = this.context.workingDirectory,
      after = 0,
      before = 0,
      types = [],
      extensions = [],
      ignoreCase = false,
      lineNumbers = true,
      heading = true,
      group = true,
      regex = true,
      stats = false,
      maxResults = 100,
      includeHidden = false
    } = params;

    try {
      // Validate pattern
      if (!pattern || pattern.trim() === '') {
        return this.createErrorResult(
          'Search pattern cannot be empty',
          'VALIDATION_ERROR',
          ['Provide a non-empty search pattern']
        );
      }

      // Validate and resolve search path
      try {
        validatePath(searchPath, { allowAbsolute: true, mustExist: true });
      } catch (error) {
        return this.createErrorResult(
          `Invalid search path: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'VALIDATION_ERROR',
          ['Provide a valid directory path']
        );
      }

      const absolutePath = path.resolve(searchPath);

      // Check if it's a directory or file
      const stats_fs = await fs.stat(absolutePath);
      const isDirectory = stats_fs.isDirectory();
      const isFile = stats_fs.isFile();

      if (!isDirectory && !isFile) {
        return this.createErrorResult(
          `Search path is neither a directory nor a file: ${searchPath}`,
          'INVALID_PATH',
          ['Provide a valid directory or file path']
        );
      }

      // Check for blocked paths
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Access to directory is restricted: ${searchPath}`,
          'PERMISSION_DENIED',
          ['Choose a different directory that is not in the blocked list']
        );
      }

      // Execute search using system ripgrep
      const searchResult = await this.executeSystemRipgrep(params, absolutePath, isFile);

      // Add execution time to stats
      searchResult.stats.executionTime = Date.now() - startTime;

      return this.createSuccessResult(searchResult, {
        matchesFound: searchResult.matches.length,
        searchPattern: pattern,
        searchPath: absolutePath
      });

    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Execute using system ripgrep command
   */
  private async executeSystemRipgrep(params: RipgrepParams, searchPath: string, isFileSearch: boolean = false): Promise<RipgrepResult> {
    const rgPath = this.ripgrepPath || 'rg';

    // Check if ripgrep is available
    if (!this.isRipgrepAvailable()) {
      // Fallback to pure JS search
      return this.searchFilesInternally(params, searchPath);
    }

    return new Promise((resolve, reject) => {
      const args = this.buildRipgrepArgs(params, searchPath);

      const child = spawn(rgPath, args, {
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
        // ripgrep returns 0 for matches found, 1 for no matches, 2+ for errors
        if (code === 0 || code === 1) {
          try {
            const result = this.parseRipgrepOutput(stdout, params.pattern, searchPath, params, isFileSearch);
            resolve(result);
          } catch (error) {
            reject(new ToolError(
              `Failed to parse ripgrep output: ${error instanceof Error ? error.message : 'Unknown error'}`,
              'UNKNOWN_ERROR'
            ));
          }
        } else {
          reject(new ToolError(
            `ripgrep command failed (exit code ${code}): ${stderr || 'Unknown error'}`,
            'UNKNOWN_ERROR'
          ));
        }
      });

      child.on('error', (error) => {
        // If ripgrep fails to start, fall back to internal search
        this.searchFilesInternally(params, searchPath)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Build ripgrep command arguments
   */
  private buildRipgrepArgs(params: RipgrepParams, searchPath: string): string[] {
    const args: string[] = [];

    // Output format
    args.push('--line-number', '--column', '--no-heading', '--with-filename');

    // Context options
    if (params.before && params.before > 0) {
      args.push('--before-context', params.before.toString());
    }
    if (params.after && params.after > 0) {
      args.push('--after-context', params.after.toString());
    }

    // Case sensitivity
    if (params.ignoreCase) {
      args.push('--ignore-case');
    }

    // File type filtering
    if (params.types && params.types.length > 0) {
      for (const type of params.types) {
        args.push('--type', type);
      }
    }

    // Extension filtering
    if (params.extensions && params.extensions.length > 0) {
      for (const ext of params.extensions) {
        const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
        args.push('--glob', `*.${cleanExt}`);
      }
    }

    // Hidden files
    if (!params.includeHidden) {
      args.push('--hidden');
    }

    // Max results
    if (params.maxResults && params.maxResults > 0) {
      args.push('--max-count', params.maxResults.toString());
    }

    // Pattern handling
    if (params.regex === false) {
      args.push('--fixed-strings');
    }

    // Add the pattern and search path
    args.push(params.pattern);
    args.push(searchPath);

    return args;
  }

  /**
   * Parse ripgrep command output
   */
  private parseRipgrepOutput(output: string, pattern: string, searchPath: string, params: RipgrepParams, isFileSearch: boolean = false): RipgrepResult {
    const matches: RipgrepMatch[] = [];
    const lines = output.split('\n');
    const filesSearched = new Set<string>();

    let stats: RipgrepStats = {
      filesSearched: 0,
      matchesFound: 0,
      linesScanned: 0,
      executionTime: 0,
      filesSkipped: 0
    };

    for (const line of lines) {
      if (!line.trim()) continue;

      // ripgrep output format with --no-heading --with-filename --line-number --column:
      // filepath:line:column:content
      const match = line.match(/^([^:]+):(\d+):(\d+):(.*)$/);

      if (match) {
        const [, filePath, lineStr, columnStr, content] = match;
        const lineNumber = parseInt(lineStr, 10);
        const columnNumber = parseInt(columnStr, 10);

        // Track unique files
        filesSearched.add(filePath);

        // Find the actual matched text within the content
        let matchedText = pattern;

        try {
          if (params.regex !== false) {
            const flags = params.ignoreCase ? 'gi' : 'g';
            const regex = new RegExp(pattern, flags);
            const regexMatch = regex.exec(content);
            if (regexMatch) {
              matchedText = regexMatch[0];
            }
          } else {
            // For literal search, find the pattern (case-sensitive or not)
            const searchPattern = params.ignoreCase ? pattern.toLowerCase() : pattern;
            const searchContent = params.ignoreCase ? content.toLowerCase() : content;
            const index = searchContent.indexOf(searchPattern);
            if (index !== -1) {
              matchedText = content.substring(index, index + pattern.length);
            }
          }
        } catch (error) {
          // Fall back to pattern if regex matching fails
          matchedText = pattern;
        }

        // Create relative path from search path
        let relativePath: string;
        if (isFileSearch) {
          // For single file searches, use just the filename
          relativePath = path.basename(filePath);
        } else if (path.isAbsolute(filePath)) {
          relativePath = path.relative(searchPath, filePath);
        } else {
          relativePath = filePath;
        }

        matches.push({
          file: relativePath,
          lineNumber: lineNumber,
          column: columnNumber,
          line: content,
          beforeContext: undefined, // Context handling would need more complex parsing
          afterContext: undefined,
          matchedText: matchedText
        });

        stats.matchesFound++;

        // Stop if we reached the maximum results
        if (params.maxResults && matches.length >= params.maxResults) {
          break;
        }
      }
    }

    stats.filesSearched = filesSearched.size;
    stats.linesScanned = lines.length;

    return {
      matches,
      pattern,
      searchPath,
      stats,
      truncated: params.maxResults ? matches.length >= params.maxResults : false,
      totalMatches: matches.length
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
      return ` • ${matches} matches in ${files} files`;
    } else if (typeof result === 'string') {
      const lines = result.trim() ? result.split('\n').filter(line => line.trim()).length : 0;
      return ` • ${lines} matches`;
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
   * Pure JavaScript file search fallback when ripgrep binary is unavailable
   */
  private async searchFilesInternally(params: RipgrepParams, searchPath: string): Promise<RipgrepResult> {
    const { pattern, before = 0, after = 0, types = [], extensions = [], ignoreCase = false, regex = true, maxResults = 100, includeHidden = false } = params;
    const matches: RipgrepMatch[] = [];
    const stats: RipgrepStats = { filesSearched: 0, matchesFound: 0, linesScanned: 0, executionTime: 0, filesSkipped: 0 };
    let filesToProcess: string[] = [];

    // Check if searchPath is a file or directory
    const searchStat = await fs.stat(searchPath);

    if (searchStat.isFile()) {
      // If it's a file, just add it to the process list
      filesToProcess.push(searchPath);
    } else {
      // If it's a directory, collect files recursively
      const collect = async (dir: string) => {
        const entries = await fs.readdir(dir);
        for (const name of entries) {
          // Skip hidden if not requested
          if (!includeHidden && name.startsWith('.')) continue;
          const full = path.join(dir, name);
          let stat;
          try { stat = await fs.stat(full); } catch { stats.filesSkipped++; continue; }
          // Skip blocked paths
          if (this.isBlockedPath(full)) {
            stats.filesSkipped++;
            continue;
          }
          if (stat.isDirectory()) {
            // Recurse into subdirectory
            await collect(full);
          } else {
            // Add file to process list
            filesToProcess.push(full);
          }
        }
      };

      // Start collecting files from directory
      await collect(searchPath);
    }

    // Execute search on file content
    const searchInFile = async (file: string) => {
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
          const line = lines[lineNumber];

          // Skip empty lines
          if (line.trim() === '') continue;

          // Check for binary content (skip file if binary)
          if (this.isBinaryContent(line)) {
            stats.filesSkipped++;
            return;
          }

          let matchedText = pattern;
          let columnNumber = 1;
          let foundMatch = false;

          try {
            if (regex) {
              const flags = ignoreCase ? 'gi' : 'g';
              const regex = new RegExp(pattern, flags);
              const regexMatch = regex.exec(line);
              if (regexMatch) {
                matchedText = regexMatch[0];
                columnNumber = regexMatch.index + 1;
                foundMatch = true;
              }
            } else {
              // For literal search, find the pattern (case-sensitive or not)
              const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;
              const searchLine = ignoreCase ? line.toLowerCase() : line;
              const index = searchLine.indexOf(searchPattern);
              if (index !== -1) {
                columnNumber = index + 1;
                matchedText = line.substring(index, index + pattern.length);
                foundMatch = true;
              }
            }
          } catch (error) {
            // Fall back to pattern if regex matching fails
            matchedText = pattern;
          }

          // Only add match if pattern was actually found
          if (foundMatch) {
            // For single file searches, use just the filename; for directory searches, use relative path
            const displayPath = searchStat.isFile() ? path.basename(file) : path.relative(searchPath, file);

            matches.push({
              file: displayPath,
              lineNumber: lineNumber + 1,
              column: columnNumber,
              line: line,
              beforeContext: undefined,
              afterContext: undefined,
              matchedText: matchedText
            });

            stats.matchesFound++;

            // Stop if we reached the maximum results
            if (maxResults > 0 && matches.length >= maxResults) {
              return; // Exit this file's search
            }
          }
        }
      } catch {
        stats.filesSkipped++;
      }
    };

    // Process each collected file
    for (const file of filesToProcess) {
      await searchInFile(file);

      // Stop if we reached the maximum results
      if (maxResults > 0 && matches.length >= maxResults) {
        break;
      }
    }

    stats.executionTime = Date.now() - stats.executionTime;

    return {
      matches,
      pattern,
      searchPath,
      stats,
      truncated: false,
      totalMatches: matches.length
    };
  }

  /**
   * Check if a line of content is binary (non-text)
   */
  private isBinaryContent(content: string): boolean {
    // Heuristic check for binary content - can be refined
    const textSample = content.substring(0, 100);
    return /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(textSample);
  }
}
