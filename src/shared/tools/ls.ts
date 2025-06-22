/**
 * LS Tool - Directory listing with metadata and filtering
 *
 * Provides directory listing functionality with support for:
 * - Basic directory listing with file metadata
 * - Glob pattern filtering
 * - Recursive traversal with depth limits
 * - Hidden file inclusion/exclusion
 * - Security filtering to exclude sensitive directories
 */

import fs from 'fs-extra';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import { validatePath } from './validation';

/**
 * Parameters for the LS tool
 */
export interface LSParams {
  /** Directory path to list */
  path: string;
  /** Glob pattern to filter files (optional) */
  pattern?: string;
  /** Include hidden files and directories */
  includeHidden?: boolean;
  /** Directory traversal depth (0=current only, 1=one level, -1=unlimited) */
  depth?: number;
}

/**
 * File entry with metadata
 */
export interface FileEntry {
  /** File or directory name */
  name: string;
  /** Full path to the file/directory */
  path: string;
  /** Relative path from the listing root */
  relativePath: string;
  /** File type */
  type: 'file' | 'directory' | 'symlink';
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modified date */
  modified: Date;
  /** File permissions (readable format) */
  permissions: string;
  /** Is hidden file/directory */
  hidden: boolean;
}

/**
 * LS tool result
 */
export interface LSResult {
  /** Directory being listed */
  directory: string;
  /** Array of file entries */
  entries: FileEntry[];
  /** Total number of entries found */
  totalCount: number;
  /** Whether results were filtered */
  filtered: boolean;
  /** Pattern used for filtering (if any) */
  pattern?: string;
}

export class LSTool extends BaseTool {
  readonly name = 'ls';
  readonly description = 'List directory contents with metadata and optional filtering';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list'
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts", "src/**/*.js")'
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories',
        default: false
      },
      depth: {
        type: 'number',
        description: 'Directory traversal depth (0=current only, 1=one level, -1=unlimited)',
        default: 1
      }
    },
    required: ['path'],
    additionalProperties: false
  };

  protected async executeImpl(params: LSParams, abortSignal?: AbortSignal): Promise<ToolResult> {
    const {
      path: targetPath,
      pattern,
      includeHidden = false,
      depth = 1
    } = params;

    try {
      // Validate the path
      validatePath(targetPath, { allowAbsolute: true, mustExist: true });

      // Resolve to absolute path
      const absolutePath = path.resolve(targetPath);

      // Check if it's a directory
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        return this.createErrorResult(
          `Path is not a directory: ${targetPath}`,
          'INVALID_PATH',
          ['Provide a directory path instead of a file']
        );
      }

      // Check for blocked paths
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Access to directory is restricted: ${targetPath}`,
          'PERMISSION_DENIED',
          ['Choose a different directory that is not in the blocked list']
        );
      }

      // List directory contents
      // depth=0 or depth=1: current directory only (non-recursive)
      // depth>1: recursive to that depth
      // depth=-1: unlimited recursive
      const recursive = depth > 1 || depth === -1;
      const maxDepth = depth === -1 ? 100 : (depth <= 1 ? 0 : depth - 1);

      const entries = await this.listDirectory(
        absolutePath,
        {
          pattern,
          includeHidden,
          recursive,
          maxDepth,
          currentDepth: 0
        }
      );

      const result: LSResult = {
        directory: absolutePath,
        entries,
        totalCount: entries.length,
        filtered: !!pattern,
        pattern
      };

      return this.createSuccessResult(result, {
        entriesFound: entries.length,
        directoryListed: absolutePath
      });

    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DIRECTORY_ERROR'
      );
    }
  }

  /**
   * Recursively list directory contents
   */
  private async listDirectory(
    dirPath: string,
    options: {
      pattern?: string;
      includeHidden: boolean;
      recursive: boolean;
      maxDepth: number;
      currentDepth: number;
    }
  ): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const { pattern, includeHidden, recursive, maxDepth, currentDepth } = options;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativePath = path.relative(this.context.workingDirectory, itemPath);

        // Skip hidden files if not included
        const isHidden = item.startsWith('.');
        if (isHidden && !includeHidden) {
          continue;
        }

        try {
          const stats = await fs.stat(itemPath);
          const entry = await this.createFileEntry(item, itemPath, relativePath, stats, isHidden);

          // Apply pattern filtering
          if (pattern && !this.matchesPattern(entry, pattern)) {
            continue;
          }

          entries.push(entry);

          // Recursively process subdirectories
          if (
            entry.type === 'directory' &&
            recursive &&
            currentDepth < maxDepth &&
            !this.isBlockedPath(itemPath)
          ) {
            const subEntries = await this.listDirectory(itemPath, {
              ...options,
              currentDepth: currentDepth + 1
            });
            entries.push(...subEntries);
          }
        } catch (error) {
          // Skip inaccessible files/directories
          continue;
        }
      }
    } catch (error) {
      throw new ToolError(
        `Cannot read directory: ${dirPath}`,
        'PERMISSION_DENIED'
      );
    }

    return entries.sort((a, b) => {
      // Sort: directories first, then files, alphabetically within each group
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Create a file entry with metadata
   */
  private async createFileEntry(
    name: string,
    fullPath: string,
    relativePath: string,
    stats: fs.Stats,
    isHidden: boolean
  ): Promise<FileEntry> {
    let type: 'file' | 'directory' | 'symlink' = 'file';

    if (stats.isDirectory()) {
      type = 'directory';
    } else if (stats.isSymbolicLink()) {
      type = 'symlink';
    }

    return {
      name,
      path: fullPath,
      relativePath,
      type,
      size: type === 'directory' ? 0 : stats.size,
      modified: stats.mtime,
      permissions: this.formatPermissions(stats.mode),
      hidden: isHidden
    };
  }

  /**
   * Format file permissions as readable string
   */
  private formatPermissions(mode: number): string {
    const permissions = (mode & parseInt('777', 8)).toString(8);
    const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

    return permissions
      .split('')
      .map(digit => perms[parseInt(digit)])
      .join('');
  }

  /**
   * Check if a file entry matches the given pattern
   */
  private matchesPattern(entry: FileEntry, pattern: string): boolean {
    // Match against both the file name and relative path
    return (
      minimatch(entry.name, pattern) ||
      minimatch(entry.relativePath, pattern) ||
      minimatch(entry.path, pattern)
    );
  }  /**
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
