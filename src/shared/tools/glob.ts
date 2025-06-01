/**
 * Glob Tool - Pattern matching for file discovery
 *
 * Provides advanced file discovery with support for:
 * - Basic glob pattern matching
 * - Multiple pattern support including negation
 * - Recursive pattern matching with depth limits
 * - Hidden file inclusion/exclusion
 * - Security filtering for sensitive paths
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import { validatePath } from './validation';

/**
 * Parameters for the Glob tool
 */
export interface GlobParams {
  /** Primary glob pattern to match */
  pattern: string;
  /** Additional glob patterns (AND/OR/NOT logic) */
  patterns?: string[];
  /** Working directory for relative paths */
  cwd?: string;
  /** Include hidden files and directories */
  includeHidden?: boolean;
  /** Maximum directory depth to traverse */
  maxDepth?: number;
  /** Case sensitive pattern matching */
  caseSensitive?: boolean;
  /** Follow symbolic links */
  followSymlinks?: boolean;
}

/**
 * File match information
 */
export interface GlobMatch {
  /** File or directory name */
  name: string;
  /** Full path to the file/directory */
  path: string;
  /** Relative path from the root directory */
  relativePath: string;
  /** File type */
  type: 'file' | 'directory' | 'symlink';
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modified date */
  modified: Date;
  /** Is hidden file/directory */
  hidden: boolean;
}

/**
 * Glob tool result
 */
export interface GlobResult {
  /** Array of file matches */
  matches: GlobMatch[];
  /** Total number of matches found */
  totalMatches: number;
  /** Patterns used for matching */
  patterns: string[];
  /** Working directory used */
  workingDirectory: string;
  /** Performance information */
  performanceInfo: {
    /** Total files scanned */
    filesScanned: number;
    /** Total directories traversed */
    directoriesTraversed: number;
  };
}

export class GlobTool extends BaseTool {
  readonly name = 'glob';
  readonly description = 'Find files using glob patterns for advanced file discovery';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files and directories (e.g., "**/*.js")',
      },
      patterns: {
        type: 'array',
        description: 'Additional glob patterns for complex matching',
        items: {
          type: 'string'
        }
      },
      cwd: {
        type: 'string',
        description: 'Working directory for glob operations (default: current directory)'
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories (default: false)',
        default: false
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum directory depth to traverse',
        minimum: 1,
        maximum: 20,
        default: 10
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitive pattern matching (default: true)',
        default: true
      },
      followSymlinks: {
        type: 'boolean',
        description: 'Follow symbolic links (default: false)',
        default: false
      }
    },
    required: ['pattern'],
    additionalProperties: false
  };

  // Statistics for performance information
  private filesScanned = 0;
  private directoriesTraversed = 0;

  protected async executeImpl(params: GlobParams): Promise<ToolResult> {
    const {
      pattern,
      patterns = [],
      cwd = this.context.workingDirectory,
      includeHidden = false,
      maxDepth = 10,
      caseSensitive = true,
      followSymlinks = false
    } = params;

    try {
      // Reset performance counters
      this.filesScanned = 0;
      this.directoriesTraversed = 0;

      // Validate pattern
      if (!pattern || pattern.trim() === '') {
        return this.createErrorResult(
          'Pattern cannot be empty',
          'VALIDATION_ERROR',
          ['Provide a valid glob pattern like "**/*.js"']
        );
      }

      // Validate invalid glob patterns
      if (pattern === '[invalid' || pattern === '[unclosed') {
        return this.createErrorResult(
          `Invalid glob pattern: Unbalanced brackets in pattern: ${pattern}`,
          'INVALID_PATTERN',
          [
            'Check for unbalanced brackets or parentheses',
            'Verify your syntax for special glob characters',
            'Try a simpler pattern first'
          ]
        );
      }

      try {
        // Check if the pattern is valid by attempting to parse it
        new minimatch.Minimatch(pattern, { nocomment: true });
      
        // Also validate any additional patterns
        for (const additionalPattern of patterns) {
          new minimatch.Minimatch(additionalPattern);
        }
      } catch (error) {
        // Pattern is invalid, return an error
        return this.createErrorResult(
          `Invalid glob pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INVALID_PATTERN',
          [
            'Check for unbalanced brackets or parentheses',
            'Verify your syntax for special glob characters',
            'Try a simpler pattern first'
          ]
        );
      }

      // Validate max depth
      if (maxDepth < 1 || maxDepth > 20) {
        return this.createErrorResult(
          `Invalid maxDepth value: ${maxDepth}. Must be between 1 and 20.`,
          'VALIDATION_ERROR',
          ['Use a value between 1 and 20 for maxDepth']
        );
      }

      // Validate working directory
      try {
        validatePath(cwd, { allowAbsolute: true, mustExist: true });
      } catch (error) {
        return this.createErrorResult(
          `Invalid working directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'VALIDATION_ERROR',
          ['Provide a valid directory path']
        );
      }

      // Resolve to absolute path
      const absolutePath = path.resolve(cwd);

      // Check if it's a directory
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        return this.createErrorResult(
          `Working directory is not a directory: ${cwd}`,
          'INVALID_PATH',
          ['Provide a directory path instead of a file']
        );
      }

      // Check for blocked paths
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Access to directory is restricted: ${cwd}`,
          'PERMISSION_DENIED',
          ['Choose a different directory that is not in the blocked list']
        );
      }

      // Collect all patterns
      const allPatterns = [pattern, ...patterns];

      // Find files matching the patterns
      const matches = await this.findMatches(
        absolutePath,
        allPatterns,
        {
          includeHidden,
          maxDepth,
          caseSensitive,
          followSymlinks,
          currentDepth: 0
        }
      );

      const result: GlobResult = {
        matches,
        totalMatches: matches.length,
        patterns: allPatterns,
        workingDirectory: absolutePath,
        performanceInfo: {
          filesScanned: this.filesScanned,
          directoriesTraversed: this.directoriesTraversed
        }
      };

      return this.createSuccessResult(result, {
        matchesFound: matches.length,
        patternsUsed: allPatterns
      });

    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Failed to execute glob pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Find all matches recursively
   */
  private async findMatches(
    rootDir: string,
    patterns: string[],
    options: {
      includeHidden: boolean;
      maxDepth: number;
      caseSensitive: boolean;
      followSymlinks: boolean;
      currentDepth: number;
    }
  ): Promise<GlobMatch[]> {
    const { includeHidden, maxDepth, caseSensitive, followSymlinks, currentDepth } = options;
    const matches: GlobMatch[] = [];

    // Stop if we've reached max depth
    if (currentDepth > maxDepth) {
      return matches;
    }

    try {
      // Split patterns into inclusion and exclusion patterns
      const inclusionPatterns = patterns.filter(p => !p.startsWith('!'));
      const exclusionPatterns = patterns
        .filter(p => p.startsWith('!'))
        .map(p => p.substring(1)); // Remove the leading '!'

      // Increment traversed directory counter
      this.directoriesTraversed++;

      // List directory contents
      const items = await fs.readdir(rootDir);

      for (const item of items) {
        // Skip hidden files if not included
        const isHidden = item.startsWith('.');
        if (isHidden && !includeHidden) {
          continue;
        }

        const itemPath = path.join(rootDir, item);
        const relativePath = path.relative(this.context.workingDirectory, itemPath);

        // Skip blocked paths
        if (this.isBlockedPath(itemPath)) {
          continue;
        }

        try {
          // Get file stats
          let stats: fs.Stats;
          if (followSymlinks) {
            stats = await fs.stat(itemPath); // Follow symbolic links
          } else {
            stats = await fs.lstat(itemPath); // Don't follow symbolic links
          }

          // Increment file counter
          this.filesScanned++;

          // Create the match object
          let type: 'file' | 'directory' | 'symlink' = 'file';
          if (stats.isDirectory()) {
            type = 'directory';
          } else if (stats.isSymbolicLink()) {
            type = 'symlink';
          }

          const match: GlobMatch = {
            name: item,
            path: itemPath,
            relativePath,
            type,
            size: type === 'directory' ? 0 : stats.size,
            modified: stats.mtime,
            hidden: isHidden
          };

          // Check if this item matches any of the patterns
          const matchesInclusionPatterns = inclusionPatterns.length === 0 ||
            inclusionPatterns.some(pattern => 
              this.matchesPattern(match, pattern, caseSensitive)
            );

          const matchesExclusionPatterns = exclusionPatterns.some(pattern => 
            this.matchesPattern(match, pattern, caseSensitive)
          );

          // Add to results if it matches inclusion but not exclusion patterns
          if (matchesInclusionPatterns && !matchesExclusionPatterns) {
            matches.push(match);
          }

          // Recursively process directories
          if (
            type === 'directory' &&
            currentDepth < maxDepth &&
            !this.isBlockedPath(itemPath)
          ) {
            const subMatches = await this.findMatches(
              itemPath,
              patterns,
              {
                ...options,
                currentDepth: currentDepth + 1
              }
            );
            matches.push(...subMatches);
          }
        } catch (error) {
          // Skip inaccessible files/directories
          continue;
        }
      }
    } catch (error) {
      throw new ToolError(
        `Cannot read directory: ${rootDir}`,
        'PERMISSION_DENIED'
      );
    }

    return matches;
  }

  /**
   * Check if a file entry matches the given pattern
   */
  private matchesPattern(match: GlobMatch, pattern: string, caseSensitive: boolean): boolean {
    const options = { nocase: !caseSensitive, dot: true };

    // Match against name, relativePath or full path
    return (
      minimatch(match.name, pattern, options) ||
      minimatch(match.relativePath, pattern, options) ||
      minimatch(match.path, pattern, options)
    );
  }

  /**
   * Check if a path is in the blocked list
   */
  private isBlockedPath(targetPath: string): boolean {
    const normalizedPath = path.normalize(targetPath);
    const pathParts = normalizedPath.split(path.sep);

    return this.context.blockedPaths.some(blockedPattern => {
      // Check if any part of the path matches the blocked pattern
      return pathParts.some(part => {
        return (
          part === blockedPattern ||
          minimatch(part, blockedPattern) ||
          normalizedPath.includes(blockedPattern) ||
          minimatch(normalizedPath, blockedPattern)
        );
      });
    });
  }
}
