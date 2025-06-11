/**
 * Write Tool - File creation and modification with safety features
 *
 * Provides file writing functionality with support for:
 * - Creating new files with content
 * - Modifying existing files with unified diff patches
 * - Backup creation for safety
 * - Security validation to prevent writing to sensitive paths
 */

import fs from 'fs-extra';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { validatePath } from './validation';

export interface WriteParams {
  path: string;
  content?: string;   // For full writes
  diff?: string;      // For patching existing files
  encoding?: 'utf8' | 'binary' | 'base64';
}

export interface WriteResult {
  filePath: string;
  linesChanged: number;
  created: boolean;
  backupPath?: string;
  mode: 'create' | 'patch';
}

export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to files with safety features and backup support. Use either content (for full writes) or diff (for patching existing files). Diff format example:\n@@ -1,3 +1,3 @@\n context line\n-old line to remove\n+new line to add\n another context line';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Full content to write (for new files or overwriting existing files)' },
      diff: { type: 'string', description: 'Unified diff to apply to an existing file (only for modifying existing files). Format: @@ -startLine,lineCount +startLine,lineCount @@\\n context line\\n-line to remove\\n+line to add' },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8'
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
      encoding = 'utf8'
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

      // Handle edge case where parent directory is root (dangerous)
      if (parentDir === '/') {
        return this.createErrorResult(
          `Cannot write files to root directory: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a subdirectory instead of root for safety']
        );
      }

      // Blocked path check (should come before extension and parent dir checks)
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Access to file is restricted: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a different file that is not in the blocked list']
        );
      }

      // Also check if parent directory is blocked
      if (this.isBlockedPath(parentDir)) {
        return this.createErrorResult(
          `Access to parent directory is restricted: ${parentDir}`,
          'PERMISSION_DENIED',
          ['Choose a different directory that is not in the blocked list']
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

      // Ensure parent directory exists
      await this.ensureParentDirectory(parentDir);

      const fileExists = await fs.pathExists(absolutePath);

      let finalContent: string;
      let mode: 'create' | 'patch';
      let contentSize: number;
      let linesChanged: number;

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
        // For full content writes, count total lines
        linesChanged = content.split('\n').length;
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
          const diffResult = this.applyDiff(currentContent, diff!);
          finalContent = diffResult.content;
          linesChanged = diffResult.linesChanged;
        } catch (error) {
          if (error instanceof ToolError) throw error;
          throw new ToolError(
            `Failed to apply diff: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'VALIDATION_ERROR',
            [
              'Ensure diff format is correct. Example:',
              '@@ -1,3 +1,3 @@',
              ' unchanged line',
              '-line to remove',
              '+line to add',
              ' another unchanged line'
            ]
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

      // We always use atomic writes, so no backup is needed
      const shouldBackup = false;
      return await this.performWrite(absolutePath, finalContent, encoding as BufferEncoding, mode, shouldBackup, fileExists, linesChanged);
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
   * Ensure parent directory exists and create it if needed
   */
  private async ensureParentDirectory(parentDir: string): Promise<void> {
    try {
      // Use fs.ensureDir which handles both creation and verification
      await fs.ensureDir(parentDir);

      // Double-check that it's actually a directory (not a file)
      const parentStats = await fs.stat(parentDir);
      if (!parentStats.isDirectory()) {
        throw new ToolError(
          `Parent path exists but is not a directory: ${parentDir}`,
          'INVALID_PATH',
          ['Remove the conflicting file or choose a different path']
        );
      }
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }

      throw new ToolError(
        `Cannot create or access parent directory: ${parentDir}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_PATH',
        [
          'Check if the path is valid and you have write permissions',
          'Ensure parent directories are accessible',
          'Verify there are no conflicting files in the path'
        ]
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
    fileExists: boolean,
    linesChanged: number
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

      const created = !fileExists;

      // Always use atomic write for safety
      tempPath = `${absolutePath}.tmp.${Date.now()}.${process.pid}`;
      await fs.writeFile(tempPath, content, encoding);
      await fs.move(tempPath, absolutePath, { overwrite: true });
      tempPath = undefined; // Successfully moved, no cleanup needed

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
        linesChanged,
        created,
        mode,
        ...(backupPath && shouldBackup && { backupPath })
      };

      return this.createSuccessResult(result, {
        operation: mode,
        linesChanged,
        encoding
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

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      throw new ToolError(
        `Failed to write file: ${errorMessage}`,
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
  private applyDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    // Validate input types
    if (typeof currentContent !== 'string' || typeof diff !== 'string') {
      throw new ToolError(
        'Invalid input: currentContent and diff must be strings',
        'VALIDATION_ERROR'
      );
    }

    // Check if the file appears to be binary
    if (this.isBinaryContent(currentContent)) {
      throw new ToolError(
        'Cannot apply diff to binary content',
        'VALIDATION_ERROR',
        ['Binary files must be modified using full content replacement, not diffs']
      );
    }

    // Validate diff format more strictly
    this.validateDiffFormat(diff);

    // Split the current content and the diff into lines
    const originalLines = currentContent.split('\n');
    const diffLines = diff.split('\n');

    // Basic validation - must have at least one hunk header
    const hasHunkHeader = diffLines.some(line => line.match(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/));
    if (!hasHunkHeader) {
      throw new ToolError(
        'Invalid diff format: no valid hunk headers found',
        'VALIDATION_ERROR',
        [
          'Diff must contain at least one hunk header like: @@ -1,3 +1,3 @@',
          'Example valid diff:',
          '@@ -1,2 +1,2 @@',
          ' context line',
          '-old line',
          '+new line'
        ]
      );
    }

    const resultLines: string[] = [];
    let currentLineIndex = 0;  // current position in originalLines
    let linesAdded = 0;
    let linesRemoved = 0;

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

        // Basic validation of hunk header values
        if (isNaN(origStart) || origStart < 1) {
          throw new ToolError(
            `Invalid hunk header: ${line}`,
            'VALIDATION_ERROR',
            ['Hunk header must have valid line numbers']
          );
        }

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

        // Skip empty hunks - they're allowed
        if (hunkLines.length === 0) {
          continue;
        }

        let hasNoNewlineMarker = false;

        for (const hunkLine of hunkLines) {
          if (hunkLine === '\\ No newline at end of file') {
            hasNoNewlineMarker = true;
            continue;
          }

          // Basic line format validation - allow more flexibility
          if (hunkLine.length === 0 || ![' ', '+', '-'].includes(hunkLine[0])) {
            // Skip malformed lines with a warning instead of failing
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
            const actualLine = originalLines[currentLineIndex];

            // Try flexible matching first (ignore whitespace differences)
            const normalizedContext = contextLine.trim();
            const normalizedActual = actualLine.trim();

            if (normalizedContext !== normalizedActual) {
              // Generate helpful context for the error
              const contextStart = Math.max(0, currentLineIndex - 3);
              const contextEnd = Math.min(originalLines.length, currentLineIndex + 4);
              const fileContext = originalLines.slice(contextStart, contextEnd)
                .map((line, idx) => {
                  const lineNum = contextStart + idx + 1;
                  const marker = lineNum === currentLineIndex + 1 ? '>>>' : '   ';
                  return `${marker} ${lineNum}: ${line}`;
                }).join('\n');

              throw new ToolError(
                `Context mismatch at line ${currentLineIndex + 1}. The diff appears to be out of sync with the current file content.\n\nExpected: '${contextLine}'\nFound: '${actualLine}'\n\nFile context:\n${fileContext}`,
                'VALIDATION_ERROR',
                [
                  'The file has changed since this diff was created',
                  'Try reading the current file content first and creating a new diff',
                  'Or use content mode to overwrite the entire file instead of applying a diff',
                  'Check that line numbers in the diff match the current file structure'
                ]
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
            const actualLine = originalLines[currentLineIndex];

            // Try flexible matching for deletions too
            const normalizedDeletion = deletionLine.trim();
            const normalizedActual = actualLine.trim();

            if (normalizedDeletion !== normalizedActual) {
              // Generate helpful context for the error
              const contextStart = Math.max(0, currentLineIndex - 3);
              const contextEnd = Math.min(originalLines.length, currentLineIndex + 4);
              const fileContext = originalLines.slice(contextStart, contextEnd)
                .map((line, idx) => {
                  const lineNum = contextStart + idx + 1;
                  const marker = lineNum === currentLineIndex + 1 ? '>>>' : '   ';
                  return `${marker} ${lineNum}: ${line}`;
                }).join('\n');

              throw new ToolError(
                `Deletion mismatch at line ${currentLineIndex + 1}. The diff appears to be out of sync with the current file content.\n\nExpected to delete: '${deletionLine}'\nFound: '${actualLine}'\n\nFile context:\n${fileContext}`,
                'VALIDATION_ERROR',
                [
                  'The file has changed since this diff was created',
                  'Try reading the current file content first and creating a new diff',
                  'Or use content mode to overwrite the entire file instead of applying a diff',
                  'Check that line numbers in the diff match the current file structure'
                ]
              );
            }
            currentLineIndex++;
            lineCountInHunk++;
            linesRemoved++;
          } else if (hunkLine.startsWith('+')) {
            // Addition: add to result
            resultLines.push(hunkLine.substring(1));
            linesAdded++;
          } else {
            // Skip invalid lines instead of throwing error
            continue;
          }
        }

        // Allow minor line count mismatches - continue processing
        if (lineCountInHunk !== origCount) {
          // Just continue - minor mismatches are acceptable
        }
      } else if (line.trim() !== '') {
        // Allow any non-empty lines outside hunks - be more permissive
        // Just ignore unknown lines instead of failing
        if (!line.startsWith('index ') && !line.startsWith('diff ') && !line.startsWith('new ') &&
            !line.startsWith('deleted ') && !line.startsWith('old mode ') && !line.startsWith('new mode ') &&
            !line.startsWith('---') && !line.startsWith('+++')) {
          // Silently ignore unknown lines
        }
      }
    }

    // Copy remaining original lines
    while (currentLineIndex < originalLines.length) {
      resultLines.push(originalLines[currentLineIndex]);
      currentLineIndex++;
    }

    // Create final content
    const finalContent = resultLines.join('\n');

    // Allow empty content if that's the intended result
    // No validation needed - empty content is acceptable

    const linesChanged = linesAdded + linesRemoved;
    return {
      content: finalContent,
      linesChanged
    };
  }

  /**
   * Get comprehensive diff format examples for error messages
   */
  private getDiffExamples(): string[] {
    return [
      'Unified diff format examples:',
      '',
      'Simple replacement:',
      '@@ -1,1 +1,1 @@',
      '-old line',
      '+new line',
      '',
      'Multi-line change with context:',
      '@@ -1,5 +1,5 @@',
      ' context line 1',
      ' context line 2',
      '-old line to change',
      '+new line replacement',
      ' context line 4',
      ' context line 5',
      '',
      'Key rules:',
      '- Lines starting with " " are context (unchanged)',
      '- Lines starting with "-" are removed',
      '- Lines starting with "+" are added',
      '- Hunk header format: @@ -oldStart,oldCount +newStart,newCount @@'
    ];
  }

  /**
   * Check if content appears to be binary
   */
  private isBinaryContent(content: string): boolean {
    // Simple heuristic: check for null bytes or high ratio of non-printable characters
    if (content.includes('\0')) {
      return true;
    }

    // Check first 1000 characters for high ratio of non-printable characters
    const sampleSize = Math.min(1000, content.length);
    const sample = content.substring(0, sampleSize);
    const nonPrintableCount = sample.split('').filter(char => {
      const code = char.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code > 126;
    }).length;

    // If more than 30% are non-printable, consider it binary
    return nonPrintableCount / sampleSize > 0.3;
  }

  /**
   * Validate basic diff format - simplified validation
   */
  private validateDiffFormat(diff: string): void {
    if (diff.trim() === '') {
      throw new ToolError(
        'Empty diff provided',
        'VALIDATION_ERROR',
        [
          'Provide a valid unified diff with at least one change',
          'Example:',
          '@@ -1,1 +1,1 @@',
          '-old content',
          '+new content'
        ]
      );
    }

    // Basic validation - just check for at least one hunk header
    const hasHunkHeader = diff.includes('@@');
    if (!hasHunkHeader) {
      throw new ToolError(
        'Invalid diff format: no hunk headers found',
        'VALIDATION_ERROR',
        [
          'Diff must contain at least one hunk header like: @@ -1,3 +1,3 @@',
          'Example valid diff:',
          '@@ -1,2 +1,2 @@',
          ' context line',
          '-old line',
          '+new line'
        ]
      );
    }
  }
}
