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
  content: string;
  encoding?: 'utf8' | 'binary' | 'base64';
  mode?: 'create' | 'append' | 'overwrite';
  backup?: boolean;
  createDirs?: boolean;
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
      content: { type: 'string', description: 'Content to write to the file' },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8'
      },
      mode: {
        type: 'string',
        description: 'Write mode: create (fail if exists), append (add to end), overwrite (replace)',
        enum: ['create', 'append', 'overwrite'],
        default: 'create'
      },
      backup: {
        type: 'boolean',
        description: 'Create backup before overwriting existing file',
        default: true
      },
      createDirs: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist',
        default: true
      }
    },
    required: ['path', 'content'],
    additionalProperties: false
  };

  protected async executeImpl(params: WriteParams): Promise<ToolResult> {
    const {
      path: filePath,
      content,
      encoding = 'utf8',
      mode = 'create',
      backup = true,
      createDirs = true
    } = params;

    // Explicitly validate mode
    const allowedModes = ['create', 'append', 'overwrite'];
    if (typeof mode !== 'string' || !allowedModes.includes(mode)) {
      return this.createErrorResult(
        `Invalid mode: ${mode}. Must be one of: create, append, overwrite`,
        'VALIDATION_ERROR',
        ['Use a valid mode: create, append, or overwrite']
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

      // Check if parent directory exists or can be created
      const parentExists = await fs.pathExists(parentDir);
      if (!parentExists && !createDirs) {
        return this.createErrorResult(
          `Parent directory does not exist: ${parentDir}`,
          'INVALID_PATH',
          ['Set createDirs: true to create parent directories']
        );
      }
      // If parent directory does not exist and createDirs is true, try to create it
      if (!parentExists && createDirs) {
        try {
          await fs.ensureDir(parentDir);
        } catch (error) {
          return this.createErrorResult(
            `Cannot create parent directory: ${parentDir}`,
            'INVALID_PATH',
            ['Check if the path is valid and you have permissions']
          );
        }
      }
      // After ensureDir, check if parentDir is a directory
      let parentStats: fs.Stats | undefined;
      try {
        parentStats = await fs.stat(parentDir);
      } catch (error) {
        return this.createErrorResult(
          `Parent directory does not exist or is not accessible: ${parentDir}`,
          'INVALID_PATH',
          ['Check if the path is valid and you have permissions']
        );
      }
      if (!parentStats.isDirectory()) {
        return this.createErrorResult(
          `Parent path is not a directory: ${parentDir}`,
          'INVALID_PATH',
          ['Check if the path is valid and you have permissions']
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
      // Check content size
      const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
      if (contentSize > this.context.maxFileSize) {
        return this.createErrorResult(
          `Content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
          'FILE_TOO_LARGE',
          [`Reduce content size to under ${this.context.maxFileSize} bytes`, 'Consider writing the content in smaller chunks']
        );
      }
      const fileExists = await fs.pathExists(absolutePath);
      let backupPath: string | undefined;
      // Handle create mode
      if (mode === 'create' && fileExists) {
        return this.createErrorResult(
          `File already exists: ${filePath}`,
          'VALIDATION_ERROR',
          ['Use mode "overwrite" to replace the existing file', 'Use mode "append" to add content to the end', 'Choose a different file name']
        );
      }
      // Create parent directories if needed
      if (createDirs && !await fs.pathExists(parentDir)) {
        try {
          await fs.ensureDir(parentDir);
        } catch (error) {
          return this.createErrorResult(
            `Cannot create parent directory: ${parentDir}`,
            'PERMISSION_DENIED',
            ['Check write permissions for the parent directory']
          );
        }
      }
      // Create backup if overwriting and backup is enabled
      if (mode === 'overwrite' && fileExists && backup) {
        backupPath = `${absolutePath}.backup.${Date.now()}`;
        try {
          await fs.copy(absolutePath, backupPath);
        } catch (error) {
          // Non-fatal error - continue without backup
        }
      }
      // Write the content
      let bytesWritten = 0;
      const created = !fileExists || mode === 'overwrite';
      try {
        if (mode === 'append') {
          await fs.appendFile(absolutePath, content, encoding as BufferEncoding);
          bytesWritten = contentSize;
        } else {
          await fs.writeFile(absolutePath, content, encoding as BufferEncoding);
          bytesWritten = contentSize;
        }
      } catch (error) {
        // If we created a backup, try to restore it
        if (backupPath && await fs.pathExists(backupPath)) {
          try {
            await fs.move(backupPath, absolutePath, { overwrite: true });
          } catch (restoreError) {
            // Log restore failure but don't mask original error
          }
        }
        return this.createErrorResult(
          `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'PERMISSION_DENIED',
          [
            'Check write permissions for the file and directory',
            'Ensure the file is not locked by another process',
            'Verify there is enough disk space'
          ]
        );
      }
      const result: WriteResult = {
        filePath: absolutePath,
        bytesWritten,
        created,
        mode,
        ...(backupPath && { backupPath })
      };
      return this.createSuccessResult(result, {
        operation: mode,
        fileSize: bytesWritten,
        encoding
      });
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
}
