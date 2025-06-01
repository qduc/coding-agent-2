/**
 * Write Tool - File creation and modification with safety features
 *
 * Provides file writing functionality with support for:
 * - Creating new files with content
 * - Appending to existing files
 * - Overwriting files with confirmation
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
  content?: string;
  encoding?: 'utf8' | 'binary' | 'base64';
  mode?: 'create' | 'patch';
  backup?: boolean;
  createDirs?: boolean;
  atomic?: boolean;
  // Patch-specific parameters
  patches?: Array<{
    startLine: number;
    endLine?: number;
    originalContent?: string;  // For validation
    newContent: string;
  }>;
  validateContext?: boolean;
}

export interface WriteResult {
  filePath: string;
  bytesWritten: number;
  created: boolean;
  backupPath?: string;
  mode: string;
}

export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to files with safety features and backup support';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Content to write to the file (required for create mode)' },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8'
      },
      mode: {
        type: 'string',
        description: 'Write mode: create (new file) or patch (modify existing)',
        enum: ['create', 'patch'],
        default: 'create'
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
      },
      patches: {
        type: 'array',
        description: 'Array of patches to apply (required for patch mode)',
        items: {
          type: 'object',
          properties: {
            startLine: { type: 'number', description: 'Starting line number (1-based)' },
            endLine: { type: 'number', description: 'Ending line number (1-based), defaults to startLine' },
            originalContent: { type: 'string', description: 'Original content for validation' },
            newContent: { type: 'string', description: 'New content to replace with' }
          }
        }
      },
      validateContext: {
        type: 'boolean',
        description: 'Validate original content matches before applying patches',
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
      encoding = 'utf8',
      mode = 'create',
      backup = true,
      createDirs = true,
      atomic = true,
      patches,
      validateContext = true
    } = params;

    // Explicitly validate mode
    const allowedModes = ['create', 'patch'];
    if (typeof mode !== 'string' || !allowedModes.includes(mode)) {
      return this.createErrorResult(
        `Invalid mode: ${mode}. Must be one of: create, patch`,
        'VALIDATION_ERROR',
        ['Use a valid mode: create or patch']
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

    // Validate mode-specific parameters
    if (mode === 'create' && !content) {
      return this.createErrorResult(
        'Content is required for create mode',
        'VALIDATION_ERROR',
        ['Provide content parameter for create mode']
      );
    }

    if (mode === 'patch' && (!patches || patches.length === 0)) {
      return this.createErrorResult(
        'Patches array is required for patch mode',
        'VALIDATION_ERROR',
        ['Provide patches parameter for patch mode']
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

      // Handle different modes
      if (mode === 'create') {
        if (fileExists) {
          return this.createErrorResult(
            `File already exists: ${filePath}`,
            'VALIDATION_ERROR',
            ['Use patch mode to modify existing files', 'Choose a different filename']
          );
        }

        // Check content size for create mode
        const contentSize = Buffer.byteLength(content!, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce content size to under ${this.context.maxFileSize} bytes`, 'Consider writing the content in smaller chunks']
          );
        }

        const shouldBackup = false; // No backup needed for new files
        return await this.performWrite(absolutePath, content!, encoding as BufferEncoding, mode, shouldBackup, atomic, fileExists, contentSize);
      } else if (mode === 'patch') {
        if (!fileExists) {
          return this.createErrorResult(
            `File does not exist: ${filePath}`,
            'VALIDATION_ERROR',
            ['Create the file first with create mode', 'Check the file path']
          );
        }

        // Apply patches and get the modified content
        const patchedContent = await this.applyPatches(absolutePath, patches!, validateContext);

        // Check content size for patched content
        const contentSize = Buffer.byteLength(patchedContent, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Patched content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce patch size to keep content under ${this.context.maxFileSize} bytes`]
          );
        }

        const shouldBackup = backup && !atomic; // Backup only if not using atomic writes
        return await this.performWrite(absolutePath, patchedContent, encoding as BufferEncoding, mode, shouldBackup, atomic, fileExists, contentSize);
      }

      // This should never happen due to validation above
      return this.createErrorResult(
        `Unsupported mode: ${mode}`,
        'VALIDATION_ERROR',
        ['Use a valid mode: create or patch']
      );

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
    mode: string,
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

      if (atomic && (mode === 'patch' || mode === 'create')) {
        // Use atomic write for create and patch modes
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
   * Apply patches to existing file content
   */
  private async applyPatches(
    filePath: string,
    patches: Array<{
      startLine: number;
      endLine?: number;
      originalContent?: string;
      newContent: string;
    }>,
    validateContext: boolean
  ): Promise<string> {
    // Read current file content
    const currentContent = await fs.readFile(filePath, 'utf8');
    const lines = currentContent.split('\n');

    // Validate and sort patches by line number (reverse order to maintain line numbers)
    const sortedPatches = patches
      .map(patch => ({
        ...patch,
        endLine: patch.endLine || patch.startLine
      }))
      .sort((a, b) => b.startLine - a.startLine); // Reverse order

    // Validate patch line numbers
    for (const patch of sortedPatches) {
      if (patch.startLine < 1 || patch.startLine > lines.length) {
        throw new ToolError(
          `Patch start line ${patch.startLine} is out of range (file has ${lines.length} lines)`,
          'VALIDATION_ERROR'
        );
      }
      if (patch.endLine < patch.startLine || patch.endLine > lines.length) {
        throw new ToolError(
          `Patch end line ${patch.endLine} is out of range or before start line`,
          'VALIDATION_ERROR'
        );
      }
    }

    // Apply patches in reverse order
    for (const patch of sortedPatches) {
      const startIdx = patch.startLine - 1; // Convert to 0-based
      const endIdx = patch.endLine - 1;

      // Validate original content if provided
      if (validateContext && patch.originalContent !== undefined) {
        const originalLines = lines.slice(startIdx, endIdx + 1);
        const originalText = originalLines.join('\n');

        if (originalText !== patch.originalContent) {
          throw new ToolError(
            `Original content validation failed at lines ${patch.startLine}-${patch.endLine}. Expected content does not match actual content.`,
            'VALIDATION_ERROR'
          );
        }
      }

      // Apply the patch
      const newLines = patch.newContent.split('\n');
      lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
    }

    return lines.join('\n');
  }
}
