/**
 * Write Tool - File creation and modification with safety features
 *
 * Provides file writing functionality with support for:
 * - Creating new files with content
 * - Modifying existing files with unified diff patches
 * - Backup creation for safety
 * - Security validation to prevent writing to sensitive paths
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { validatePath } from './validation';

export interface WriteParams {
  path: string;
  content?: string;   // For full writes
  diff?: string;      // For patching existing files
  encoding?: 'utf8' | 'binary' | 'base64';
  backup?: boolean;
  createDirs?: boolean;
  atomic?: boolean;
}

export interface WriteResult {
  filePath: string;
  bytesWritten: number;
  created: boolean;
  backupPath?: string;
  mode: 'create' | 'patch';
}

export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to files with safety features and backup support. Use either content (for full writes) or diff (for patching existing files)';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Full content to write (for new files or overwriting existing files)' },
      diff: { type: 'string', description: 'Unified diff to apply to an existing file (only for modifying existing files)' },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8'
      },
      backup: {
        type: 'boolean',
        description: 'Create backup before modifying existing file',
        default: true
      },
      createDirs: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist',
        default: true
      },
      atomic: {
        type: 'boolean',
        description: 'Use atomic write operation (write to temp file then move)',
        default: true
      }
    },
    required: ['path'],
    additionalProperties: false
  };

  protected async executeImpl(params: WriteParams): Promise<ToolResult> {
    const {
      path: filePath,
      content,
      diff,
      encoding = 'utf8',
      backup = true,
      createDirs = true,
      atomic = true
    } = params;

    // Validate that exactly one of content or diff is provided
    if (content === undefined && diff === undefined) {
      return this.createErrorResult(
        'Either content or diff must be provided',
        'VALIDATION_ERROR',
        ['Provide either content for full writes or diff for patching existing files']
      );
    }

    if (content !== undefined && diff !== undefined) {
      return this.createErrorResult(
        'Cannot provide both content and diff',
        'VALIDATION_ERROR',
        ['Choose either content for full writes or diff for patching existing files']
      );
    }

    // Explicitly validate encoding
    const allowedEncodings = ['utf8', 'binary', 'base64'];
    if (typeof encoding !== 'string' || !allowedEncodings.includes(encoding)) {
      return this.createErrorResult(
        `Invalid encoding: ${encoding}. Must be one of: utf8, binary, base64`,
        'VALIDATION_ERROR',
        ['Use a valid encoding: utf8, binary, or base64']
      );
    }

    try {
      // Validate the path
      try {
        validatePath(filePath, { allowAbsolute: true });
      } catch (error) {
        if (error instanceof ToolError) throw error;
        throw new ToolError(`Invalid file path: ${filePath}`, 'INVALID_PATH', ['Ensure the path is valid and not blocked']);
      }

      const absolutePath = path.resolve(filePath);
      const parentDir = path.dirname(absolutePath);

      // Blocked path check (should come before extension and parent dir checks)
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Access to file is restricted: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a different file that is not in the blocked list']
        );
      }

      // Only check extension if path and parent are valid and not blocked
      if (
        this.context.allowedExtensions.length > 0 &&
        !this.context.allowedExtensions.some(ext => absolutePath.endsWith(ext))
      ) {
        return this.createErrorResult(
          `File extension not allowed: ${filePath}`,
          'INVALID_FILE_TYPE',
          ['Use an allowed file extension']
        );
      }

      // Consolidated directory handling
      await this.ensureParentDirectory(parentDir, createDirs);

      const fileExists = await fs.pathExists(absolutePath);

      let finalContent: string;
      let mode: 'create' | 'patch';
      let contentSize: number;

      if (content !== undefined) {
        // Full content write
        mode = 'create';
        if (fileExists) {
          mode = 'patch'; // Actually overwriting existing file
        }

        // Check content size
        contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce content size to under ${this.context.maxFileSize} bytes`, 'Consider writing the content in smaller chunks']
          );
        }

        finalContent = content;
      } else {
        // Diff mode
        mode = 'patch';
        if (!fileExists) {
          return this.createErrorResult(
            `File does not exist: ${filePath}. Cannot apply diff to non-existent file.`,
            'VALIDATION_ERROR',
            ['Create the file first with a content write', 'Check the file path']
          );
        }

        // Apply unified diff
        const currentContent = await fs.readFile(absolutePath, 'utf8');
        try {
          finalContent = this.applyDiff(currentContent, diff!);
        } catch (error) {
          if (error instanceof ToolError) throw error;
          throw new ToolError(
            `Failed to apply diff: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'VALIDATION_ERROR'
          );
        }

        // Check content size for patched content
        contentSize = Buffer.byteLength(finalContent, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Patched content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce patch size to keep content under ${this.context.maxFileSize} bytes`]
          );
        }
      }

      const shouldBackup = backup && fileExists && !atomic; // Backup only for existing files and non-atomic writes
      return await this.performWrite(absolutePath, finalContent, encoding as BufferEncoding, mode, shouldBackup, atomic, fileExists, contentSize);
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  private isBlockedPath(targetPath: string): boolean {
    const normalizedPath = path.normalize(targetPath);
    const pathParts = normalizedPath.split(path.sep);
    return this.context.blockedPaths.some(blockedPattern => {
      return pathParts.some(part => {
        return (
          part === blockedPattern ||
          normalizedPath.includes(blockedPattern) ||
          normalizedPath.startsWith('/etc/') ||
          normalizedPath.startsWith('/usr/') ||
          normalizedPath.startsWith('/bin/') ||
          normalizedPath.startsWith('/sbin/') ||
          normalizedPath.includes('node_modules') ||
          normalizedPath.includes('.git')
        );
      });
    });
  }

  /**
   * Consolidated parent directory handling
   */
  private async ensureParentDirectory(parentDir: string, createDirs: boolean): Promise<void> {
    const parentExists = await fs.pathExists(parentDir);

    if (!parentExists && !createDirs) {
      throw new ToolError(
        `Parent directory does not exist: ${parentDir}`,
        'INVALID_PATH',
        ['Set createDirs: true to create parent directories']
      );
    }

    if (!parentExists && createDirs) {
      try {
        await fs.ensureDir(parentDir);
      } catch (error) {
        throw new ToolError(
          `Cannot create parent directory: ${parentDir}`,
          'INVALID_PATH',
          ['Check if the path is valid and you have permissions']
        );
      }
    }

    // Verify the parent is actually a directory
    let parentStats: fs.Stats;
    try {
      parentStats = await fs.stat(parentDir);
    } catch (error) {
      throw new ToolError(
        `Parent directory does not exist or is not accessible: ${parentDir}`,
        'INVALID_PATH',
        ['Check if the path is valid and you have permissions']
      );
    }

    if (!parentStats.isDirectory()) {
      throw new ToolError(
        `Parent path is not a directory: ${parentDir}`,
        'INVALID_PATH',
        ['Check if the path is valid and you have permissions']
      );
    }
  }

  /**
   * Optimized write operation with atomic writes and intelligent backup handling
   */
  private async performWrite(
    absolutePath: string,
    content: string,
    encoding: BufferEncoding,
    mode: 'create' | 'patch',
    shouldBackup: boolean,
    atomic: boolean,
    fileExists: boolean,
    contentSize: number
  ): Promise<ToolResult> {
    let backupPath: string | undefined;
    let tempPath: string | undefined;

    try {
      // Create backup only if needed (non-atomic overwrite with backup enabled)
      if (shouldBackup) {
        backupPath = `${absolutePath}.backup.${Date.now()}`;
        try {
          await fs.copy(absolutePath, backupPath);
        } catch (error) {
          // Non-fatal error - continue without backup
        }
      }

      let bytesWritten = 0;
      const created = !fileExists;

      if (atomic) {
        // Use atomic write
        tempPath = `${absolutePath}.tmp.${Date.now()}.${process.pid}`;
        await fs.writeFile(tempPath, content, encoding);
        await fs.move(tempPath, absolutePath, { overwrite: true });
        bytesWritten = contentSize;
        tempPath = undefined; // Successfully moved, no cleanup needed
      } else {
        // Direct write (non-atomic)
        await fs.writeFile(absolutePath, content, encoding);
        bytesWritten = contentSize;
      }

      // Clean up backup if everything succeeded and it was temporary
      if (backupPath && !shouldBackup) {
        try {
          await fs.remove(backupPath);
        } catch (error) {
          // Non-fatal cleanup error
        }
      }

      const result: WriteResult = {
        filePath: absolutePath,
        bytesWritten,
        created,
        mode,
        ...(backupPath && shouldBackup && { backupPath })
      };

      return this.createSuccessResult(result, {
        operation: mode,
        fileSize: bytesWritten,
        encoding,
        atomic
      });

    } catch (error) {
      // Cleanup on error
      if (tempPath) {
        try {
          await fs.remove(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      // Restore from backup if available
      if (backupPath && await fs.pathExists(backupPath)) {
        try {
          await fs.move(backupPath, absolutePath, { overwrite: true });
        } catch (restoreError) {
          // Log restore failure but don't mask original error
        }
      }

      throw new ToolError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PERMISSION_DENIED',
        [
          'Check write permissions for the file and directory',
          'Ensure the file is not locked by another process',
          'Verify there is enough disk space'
        ]
      );
    }
  }

  /**
   * Apply unified diff to existing content
   */
  private applyDiff(currentContent: string, diff: string): string {
    // Split the current content and the diff into lines
    const originalLines = currentContent.split('\n');
    const diffLines = diff.split('\n');

    // Basic validation - must have at least one hunk header
    const hasHunkHeader = diffLines.some(line => line.match(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/));
    if (!hasHunkHeader) {
      throw new ToolError(
        'Invalid diff format: no valid hunk headers found',
        'VALIDATION_ERROR'
      );
    }

    const resultLines: string[] = [];
    let currentLineIndex = 0;  // current position in originalLines

    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];
      i++;

      // Skip file headers
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        continue;
      }

      // Check for hunk header
      const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkHeaderMatch) {
        const origStart = parseInt(hunkHeaderMatch[1], 10);
        const origCount = parseInt(hunkHeaderMatch[2] || '1', 10);
        // const patchedStart = parseInt(hunkHeaderMatch[3], 10);
        // const patchedCount = parseInt(hunkHeaderMatch[4] || '1', 10);

        // Copy lines from currentLineIndex to origStart-1 (0-based index: origStart-1)
        while (currentLineIndex < origStart - 1) {
          if (currentLineIndex >= originalLines.length) {
            throw new ToolError(
              `Hunk starts beyond end of file (line ${origStart})`,
              'VALIDATION_ERROR'
            );
          }
          resultLines.push(originalLines[currentLineIndex]);
          currentLineIndex++;
        }

        // Process the hunk lines
        let lineCountInHunk = 0;
        let j = i;
        // Collect all lines until next hunk or end of diff
        while (j < diffLines.length && !diffLines[j].startsWith('@@')) {
          j++;
        }
        const hunkLines = diffLines.slice(i, j);
        i = j;  // move outer index to next hunk

        for (const hunkLine of hunkLines) {
          if (hunkLine === '\\ No newline at end of file') {
            // Ignore this marker
            continue;
          }

          if (hunkLine.startsWith(' ')) {
            // Context line: must match
            if (currentLineIndex >= originalLines.length) {
              throw new ToolError(
                `Context line beyond end of file at line ${currentLineIndex + 1}`,
                'VALIDATION_ERROR'
              );
            }
            const contextLine = hunkLine.substring(1);
            if (originalLines[currentLineIndex] !== contextLine) {
              throw new ToolError(
                `Context mismatch at line ${currentLineIndex + 1}: expected '${contextLine}', found '${originalLines[currentLineIndex]}'`,
                'VALIDATION_ERROR'
              );
            }
            resultLines.push(contextLine);
            currentLineIndex++;
            lineCountInHunk++;
          } else if (hunkLine.startsWith('-')) {
            // Deletion: must match and skip
            if (currentLineIndex >= originalLines.length) {
              throw new ToolError(
                `Deletion beyond end of file at line ${currentLineIndex + 1}`,
                'VALIDATION_ERROR'
              );
            }
            const deletionLine = hunkLine.substring(1);
            if (originalLines[currentLineIndex] !== deletionLine) {
              throw new ToolError(
                `Deletion mismatch at line ${currentLineIndex + 1}: expected '${deletionLine}', found '${originalLines[currentLineIndex]}'`,
                'VALIDATION_ERROR'
              );
            }
            currentLineIndex++;
            lineCountInHunk++;
          } else if (hunkLine.startsWith('+')) {
            // Addition: add to result
            resultLines.push(hunkLine.substring(1));
          } else {
            throw new ToolError(
              `Invalid diff line: ${hunkLine}`,
              'VALIDATION_ERROR'
            );
          }
        }

        // Verify we processed the expected number of original lines
        if (lineCountInHunk !== origCount) {
          throw new ToolError(
            `Hunk line count mismatch: expected ${origCount} original lines, processed ${lineCountInHunk}`,
            'VALIDATION_ERROR'
          );
        }
      } else {
        // Skip lines that are not part of a hunk (like index lines)
      }
    }

    // Copy remaining original lines
    while (currentLineIndex < originalLines.length) {
      resultLines.push(originalLines[currentLineIndex]);
      currentLineIndex++;
    }

    return resultLines.join('\n');
  }
}
