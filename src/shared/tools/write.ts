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
    oneOf: [
      { required: ['content'] },
      { required: ['diff'] }
    ],
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
    if (!content && !diff) {
      return this.createErrorResult(
        'Either content or diff must be provided',
        'VALIDATION_ERROR',
        ['Provide either content for full writes or diff for patching existing files']
      );
    }

    if (content && diff) {
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
    const currentLines = currentContent.split('\n');
    const diffLines = diff.split('\n');

    // We'll reconstruct the file line by line
    const resultLines: string[] = [];
    let currentLineIndex = 0;

    // State for the current hunk
    let hunkStartLine = 0;
    let hunkLineCount = 0;
    let hunkLines: string[] = [];
    let inHunk = false;

    for (const diffLine of diffLines) {
      if (diffLine.startsWith('--- ') || diffLine.startsWith('+++ ')) {
        // Skip file header lines
        continue;
      }

      if (diffLine.startsWith('@@')) {
        // Start of a new hunk
        if (inHunk) {
          // Apply the previous hunk
          this.applyHunk(resultLines, currentLines, hunkStartLine, hunkLineCount, hunkLines);
          hunkLines = [];
        }

        // Parse hunk header: @@ -startLine,lineCount +startLine,lineCount @@
        const hunkHeader = diffLine.match(/@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!hunkHeader) {
          throw new ToolError(`Invalid hunk header: ${diffLine}`, 'VALIDATION_ERROR');
        }

        // The start line in the original file (1-based)
        hunkStartLine = parseInt(hunkHeader[1], 10);
        hunkLineCount = parseInt(hunkHeader[2] || '1', 10);
        inHunk = true;
        hunkLines = [];
        continue;
      }

      if (inHunk) {
        hunkLines.push(diffLine);
      }
    }

    // Apply the last hunk if we were in one
    if (inHunk) {
      this.applyHunk(resultLines, currentLines, hunkStartLine, hunkLineCount, hunkLines);
    }

    // Append any remaining lines after the last hunk
    while (currentLineIndex < currentLines.length) {
      resultLines.push(currentLines[currentLineIndex]);
      currentLineIndex++;
    }

    return resultLines.join('\n');
  }

  private applyHunk(
    resultLines: string[],
    currentLines: string[],
    hunkStartLine: number,
    hunkLineCount: number,
    hunkLines: string[]
  ) {
    // Convert to 0-based index for the start of the hunk in the original file
    const startIndex = hunkStartLine - 1;

    // First, push all lines from the current file up to the start of the hunk
    while (currentLineIndex < startIndex) {
      resultLines.push(currentLines[currentLineIndex]);
      currentLineIndex++;
    }

    // Now process the hunk
    let hunkIndex = 0;
    let lineCount = 0;

    while (hunkIndex < hunkLines.length) {
      const line = hunkLines[hunkIndex];
      hunkIndex++;

      if (line.startsWith(' ')) {
        // Context line: should match the current file
        const contextLine = line.substring(1);
        if (currentLines[currentLineIndex] !== contextLine) {
          throw new ToolError(
            `Context mismatch at line ${currentLineIndex + 1}. Expected: '${contextLine}', found: '${currentLines[currentLineIndex]}'`,
            'VALIDATION_ERROR'
          );
        }
        resultLines.push(contextLine);
        currentLineIndex++;
        lineCount++;
      } else if (line.startsWith('-')) {
        // Deletion: skip the line in the original file
        const deletionLine = line.substring(1);
        if (currentLines[currentLineIndex] !== deletionLine) {
          throw new ToolError(
            `Deletion mismatch at line ${currentLineIndex + 1}. Expected: '${deletionLine}', found: '${currentLines[currentLineIndex]}'`,
            'VALIDATION_ERROR'
          );
        }
        currentLineIndex++;
        lineCount++;
      } else if (line.startsWith('+')) {
        // Insertion: add the new line
        resultLines.push(line.substring(1));
      } else {
        // Invalid line in hunk
        throw new ToolError(`Invalid diff line: ${line}`, 'VALIDATION_ERROR');
      }
    }

    // After processing the hunk, skip the remaining lines in the original hunk (if any)
    const linesToSkip = hunkLineCount - lineCount;
    for (let i = 0; i < linesToSkip; i++) {
      currentLineIndex++;
    }
  }
}
