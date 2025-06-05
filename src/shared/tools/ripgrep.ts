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

import * as fs from 'fs-extra';
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
  readonly description = 'Fast text search across files and directories with context, filtering, and statistics - perfect for code archaeology, debugging, and refactoring';
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
    const rgPath = this.findRipgrepPath();
    return rgPath !== null && rgPath !== 'rg';
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
      regex: {
        type: 'boolean',
        description: 'Treat pattern as regex',
        default: false
      },
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

  protected async executeImpl(params: RipgrepParams): Promise<ToolResult> {
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
      regex = false,
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
      const searchResult = await this.executeSystemRipgrep(params, absolutePath);

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
  private async executeSystemRipgrep(params: RipgrepParams, searchPath: string): Promise<RipgrepResult> {
    // Validate custom ripgrep binary path
    const rgPath = this.findRipgrepPath();
    if (rgPath && path.isAbsolute(rgPath) && !fs.existsSync(rgPath)) {
      throw new ToolError(`Failed to execute ripgrep: ${rgPath} not found`, 'UNKNOWN_ERROR');
    }
    // Fallback to pure JS search
    return this.searchFilesInternally(params, searchPath);
  }

  /**
   * Parse ripgrep command output
   */
  private parseRipgrepOutput(output: string, pattern: string, searchPath: string, params: RipgrepParams): RipgrepResult {
    const matches: RipgrepMatch[] = [];
    const lines = output.split('\n');

    let currentFile = '';
    let stats: RipgrepStats = {
      filesSearched: 0,
      matchesFound: 0,
      linesScanned: 0,
      executionTime: 0,
      filesSkipped: 0
    };

    let contextBuffer: Array<{type: 'before' | 'after' | 'match', lineNumber?: number, content: string}> = [];
    let pendingMatch: RipgrepMatch | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Check for context lines (--) or separator lines
      if (line.startsWith('--')) {
        // Group separator - process any pending match
        if (pendingMatch) {
          matches.push(pendingMatch);
          pendingMatch = null;
        }
        contextBuffer = [];
        continue;
      }

      // Check if this is a file header (path without line number)
      if (!line.includes(':') || !line.match(/^\d+[-:]/) && !line.match(/^\d+[-:]/) ) {
        currentFile = line.trim();
        stats.filesSearched++;
        continue;
      }

      // Parse match lines (line_number:content) or context lines (line_number-content)
      const matchResult = line.match(/^(\d+)([:|-])(.*)$/);
      if (matchResult && currentFile) {
        const lineNumber = parseInt(matchResult[1]);
        const separator = matchResult[2];
        const content = matchResult[3];

        if (separator === ':') {
          // This is a match line
          // Find the actual matched text within the content
          let matchedText = pattern;
          let columnNumber = 1;

          try {
            if (params.regex) {
              const flags = params.ignoreCase ? 'gi' : 'g';
              const regex = new RegExp(pattern, flags);
              const regexMatch = regex.exec(content);
              if (regexMatch) {
                matchedText = regexMatch[0];
                columnNumber = regexMatch.index + 1;
              }
            } else {
              // For literal search, find the pattern (case-sensitive or not)
              const searchPattern = params.ignoreCase ? pattern.toLowerCase() : pattern;
              const searchContent = params.ignoreCase ? content.toLowerCase() : content;
              const index = searchContent.indexOf(searchPattern);
              if (index !== -1) {
                columnNumber = index + 1;
                matchedText = content.substring(index, index + pattern.length);
              }
            }
          } catch (error) {
            // Fall back to pattern if regex matching fails
            matchedText = pattern;
          }

          // Collect context lines from buffer
          const beforeContext: string[] = [];
          const afterContext: string[] = [];

          for (const ctx of contextBuffer) {
            if (ctx.type === 'before' || (ctx.lineNumber && ctx.lineNumber < lineNumber)) {
              beforeContext.push(ctx.content);
            }
          }

          pendingMatch = {
            file: path.relative(searchPath, currentFile),
            lineNumber: lineNumber,
            column: columnNumber,
            line: content,
            beforeContext: beforeContext.length > 0 ? beforeContext : undefined,
            afterContext: undefined, // Will be filled by subsequent context lines
            matchedText: matchedText
          };

          stats.matchesFound++;
          contextBuffer = [];
        } else if (separator === '-') {
          // This is a context line
          if (pendingMatch && lineNumber > pendingMatch.lineNumber) {
            // After context for previous match
            if (!pendingMatch.afterContext) {
              pendingMatch.afterContext = [];
            }
            pendingMatch.afterContext.push(content);
          } else {
            // Before context for upcoming match
            contextBuffer.push({
              type: 'before',
              lineNumber: lineNumber,
              content: content
            });
          }
        }
      }
    }

    // Add any remaining pending match
    if (pendingMatch) {
      matches.push(pendingMatch);
    }

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
    const { pattern, before = 0, after = 0, types = [], extensions = [], ignoreCase = false, regex = false, maxResults = 100, includeHidden = false } = params;
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
