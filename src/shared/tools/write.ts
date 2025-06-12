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
import { toolContextManager } from '../utils/ToolContextManager';

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
  readonly description = 'Write content to files with safety features. Provides two modes:\n\n1) Content mode: Provide full file content to create new files or replace existing ones\n2) Diff mode: Provide a unified diff to selectively modify parts of an existing file';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Full content to write (for new files or overwriting existing files)' },
      diff: { type: 'string', description: 'Unified diff to apply to an existing file. Format uses standard git-style unified diff notation with context. IMPORTANT: Only one hunk (section starting with @@ line) is allowed per tool call.\n\nExample:\n@@ -2,3 +2,4 @@\n  line of context\n-line to remove\n+line to replace it with\n+another line to add\n  more context\n\nContext lines (starting with space) help verify the location. Lines to remove start with - and lines to add start with +.' },
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

      // Validate write operation based on tool call history (skip in test environment)
      const isDiffMode = diff !== undefined;
      const isTestMode = process.env.NODE_ENV === 'test';
      
      if (!isTestMode) {
        const validation = toolContextManager.validateWriteOperation(absolutePath, isDiffMode);
        
        if (!validation.isValid) {
          // Create a detailed error with context from validation
          const errorMessage = validation.warnings.join('\n') + '\n\n' + validation.suggestions.join('\n');
          
          return this.createErrorResult(
            errorMessage,
            'VALIDATION_ERROR',
            validation.suggestions
          );
        }

        // Log warnings even if we proceed
        if (validation.warnings.length > 0) {
          // Use ToolLogger to log warnings for visibility
          console.warn('⚠️ Write operation warnings:', validation.warnings.join(', '));
        }
      }

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
      const result = await this.performWrite(absolutePath, finalContent, encoding as BufferEncoding, mode, shouldBackup, fileExists, linesChanged);
      
      // Record successful write operation
      toolContextManager.recordFileWrite(absolutePath, true);
      
      return result;
    } catch (error) {
      // Record failed write operation
      toolContextManager.recordFileWrite(filePath, false);
      
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
  /**
   * Apply a unified diff to existing content
   * 
   * The diff parser has been simplified to be more forgiving while maintaining safety:
   * - Improved context matching with multiple normalization strategies
   * - Clearer error messages when problems occur
   * - More robust handling of common diff format variations
   * - Maintains safety checks to prevent corruption
   *
   * @param currentContent The current content of the file
   * @param diff The unified diff to apply
   * @returns The patched content and number of lines changed
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

    // Basic validation of diff format
    this.validateDiffFormat(diff);

    // Split the current content and the diff into lines
    const originalLines = currentContent.split('\n');
    const diffLines = diff.split('\n');

    const resultLines: string[] = [];
    let currentLineIndex = 0;  // current position in originalLines
    let linesAdded = 0;
    let linesRemoved = 0;

    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];
      i++;

      // Skip file headers and known metadata
      if (line.startsWith('--- ') || line.startsWith('+++ ') || 
          this.isKnownMetadata(line)) {
        continue;
      }

      // Check for hunk header
      const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkHeaderMatch) {
        const origStart = parseInt(hunkHeaderMatch[1], 10);
        const origCount = parseInt(hunkHeaderMatch[2] || '1', 10);

        // Validate hunk header line numbers
        if (isNaN(origStart) || origStart < 1) {
          throw new ToolError(
            `Invalid hunk header: ${line}`,
            'VALIDATION_ERROR',
            ['Hunk header must have valid line numbers']
          );
        }

        // Copy lines from current position to hunk start
        while (currentLineIndex < origStart - 1) {
          if (currentLineIndex >= originalLines.length) {
            throw new ToolError(
              `Hunk starts beyond end of file at line ${origStart}`,
              'VALIDATION_ERROR',
              ['The diff references a line that does not exist in the file']
            );
          }
          resultLines.push(originalLines[currentLineIndex]);
          currentLineIndex++;
        }

        // Process the hunk lines
        // Collect all lines until next hunk header or end of diff
        let j = i;
        while (j < diffLines.length && !diffLines[j].startsWith('@@')) {
          j++;
        }
        const hunkLines = diffLines.slice(i, j);
        i = j;  // move outer index to next hunk

        if (hunkLines.length === 0) continue; // Skip empty hunks

        for (const hunkLine of hunkLines) {
          // Skip newline markers
          if (hunkLine === '\\ No newline at end of file') {
            continue;
          }

          // Skip invalid lines
          if (hunkLine.length === 0 || ![' ', '+', '-'].includes(hunkLine[0])) {
            continue;
          }

          if (hunkLine.startsWith(' ')) { // Context line
            if (currentLineIndex >= originalLines.length) {
              throw new ToolError(
                `Context line references line ${currentLineIndex + 1} which is beyond the end of file`,
                'VALIDATION_ERROR',
                ['The diff references a line that does not exist in the file']
              );
            }

            const contextLine = hunkLine.substring(1);
            const actualLine = originalLines[currentLineIndex];

            // Improved forgiving matching - normalize whitespace completely
            if (!this.contextMatches(contextLine, actualLine)) {
              throw new ToolError(
                `Context mismatch at line ${currentLineIndex + 1}. Diff is out of sync with file content.`,
                'VALIDATION_ERROR',
                [
                  'Use the read tool to get current file content before creating a diff',
                  'Verify line numbers match the current file structure'
                ]
              );
            }

            resultLines.push(contextLine);
            currentLineIndex++;
          } else if (hunkLine.startsWith('-')) { // Deletion
            if (currentLineIndex >= originalLines.length) {
              throw new ToolError(
                `Cannot delete line ${currentLineIndex + 1} - beyond end of file`,
                'VALIDATION_ERROR',
                ['The diff attempts to delete a line that does not exist']
              );
            }

            const deletionLine = hunkLine.substring(1);
            const actualLine = originalLines[currentLineIndex];

            // Use same matching logic as context lines for consistency
            if (!this.contextMatches(deletionLine, actualLine)) {
              throw new ToolError(
                `Deletion mismatch at line ${currentLineIndex + 1}. Diff is out of sync with file content.`,
                'VALIDATION_ERROR',
                [
                  'Use the read tool to get current file content before creating a diff',
                  'Verify line numbers match the current file structure'
                ]
              );
            }

            currentLineIndex++;
            linesRemoved++;
          } else if (hunkLine.startsWith('+')) { // Addition
            resultLines.push(hunkLine.substring(1));
            linesAdded++;
          }
        }
      } else if (line.trim() !== '') {
        // Silently ignore unknown non-empty lines outside of hunks
        continue;
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
   * Improved context matching with multiple normalization strategies
   */
  private contextMatches(expected: string, actual: string): boolean {
    // Try exact match first (fastest)
    if (expected === actual) return true;

    // Try basic whitespace normalization
    if (expected.trim() === actual.trim()) return true;

    // Try more aggressive normalization (collapse all whitespace)
    const normalizeAggressively = (str: string) => str.trim().replace(/\s+/g, ' ');
    if (normalizeAggressively(expected) === normalizeAggressively(actual)) return true;

    // Consider partial matching for long lines (useful for long lines with minor changes)
    if (expected.length > 40 && actual.length > 40) {
      // Check if most of the content matches using Levenshtein distance or other similarity metric
      // This is a simplified implementation - just checks if 70% of characters match in order
      let matchCount = 0;
      const minLength = Math.min(expected.length, actual.length);
      for (let i = 0; i < minLength; i++) {
        if (expected[i] === actual[i]) matchCount++;
      }
      if (matchCount / minLength > 0.7) return true;
    }

    return false;
  }

  /**
   * Check if a line is known git diff metadata
   */
  private isKnownMetadata(line: string): boolean {
    return !!line.match(/^(index |diff |new |deleted |old mode |new mode |similarity index |rename |copy |Binary files |---|\\ No newline)/);
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
    // Quick check: If it contains null bytes, it's definitely binary
    if (content.includes('\0')) {
      return true;
    }

    // Check first 1000 characters for non-printable characters
    const sample = content.substring(0, 1000);

    // Look for high concentration of control characters (except tabs, newlines, etc)
    const nonPrintableCount = Array.from(sample).filter(char => {
      const code = char.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code > 126;
    }).length;

    // If more than 10% are non-printable, consider it binary
    return nonPrintableCount > sample.length * 0.1;
  }

  /**
   * Validate basic diff format
   */
  private validateDiffFormat(diff: string): void {
    if (diff.trim() === '') {
      throw new ToolError(
        'Empty diff provided',
        'VALIDATION_ERROR',
        ['Please provide a valid unified diff with at least one change']
      );
    }

    // Check for at least one hunk header with valid format
    const hunkHeaderRegex = /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/g;
    const hunkMatches = diff.match(hunkHeaderRegex);

    if (!hunkMatches) {
      throw new ToolError(
        'Invalid diff format: no valid hunk headers found',
        'VALIDATION_ERROR',
        [
          'Diff must contain at least one valid hunk header',
          'Example of valid diff:',
          '@@ -1,3 +1,3 @@',
          ' context line',
          '-old line',
          '+new line'
        ]
      );
    }

    // Ensure only one hunk is present per diff operation
    if (hunkMatches.length > 1) {
      throw new ToolError(
        'Multiple hunks found in diff. Only one hunk is allowed per operation.',
        'VALIDATION_ERROR',
        [
          'Split your changes into separate write operations, one hunk per call',
          'Each hunk should modify one specific area of the file',
          'Example of valid single hunk:',
          '@@ -1,3 +1,4 @@',
          ' context line',
          '-old line',
          '+new line',
          '+another new line'
        ]
      );
    }

    // Check for at least one actual change (+ or - line)
    const hasChanges = /^[+-]/m.test(diff);
    if (!hasChanges) {
      throw new ToolError(
        'Invalid diff: no additions or deletions found',
        'VALIDATION_ERROR',
        ['The diff must contain at least one line that starts with + or -']
      );
    }
  }
}
