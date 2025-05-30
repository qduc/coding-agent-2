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
import { ToolSchema, ToolResult, ToolError } from './types';
import { validatePath } from './validation';

/**
 * Parameters for the Write tool
 */
export interface WriteParams {
  /** File path to write to */
  path: string;
  /** Content to write */
  content: string;
  /** File encoding (default: utf8) */
  encoding?: 'utf8' | 'binary' | 'base64';
  /** Write mode: create, append, or overwrite */
  mode?: 'create' | 'append' | 'overwrite';
  /** Create backup before overwriting */
  backup?: boolean;
  /** Create directories if they don't exist */
  createDirs?: boolean;
}

/**
 * Write tool result
 */
export interface WriteResult {
  /** File path that was written */
  filePath: string;
  /** Number of bytes written */
  bytesWritten: number;
  /** Whether the file was newly created */
  created: boolean;
  /** Path to backup file if created */
  backupPath?: string;
  /** Write mode used */
  mode: string;
}

export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to files with safety features and backup support';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to write to'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
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

    try {
      // Validate the path
      try {
        validatePath(filePath, { allowAbsolute: true });
      } catch (error) {
        if (error instanceof ToolError) {
          throw error;
        }
        throw new ToolError(
          `Invalid file path: ${filePath}`,
          'INVALID_PATH',
          ['Ensure the path is valid and not blocked']
        );
      }

      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Check for blocked paths
      if (this.isBlockedPath(absolutePath)) {
        return this.createErrorResult(
          `Writing to this path is restricted: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a different file path that is not in the blocked list']
        );
      }

      // Check if content exceeds size limits
      const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
      if (contentSize > this.context.maxFileSize) {
        return this.createErrorResult(
          `Content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
          'FILE_TOO_LARGE',
          [
            `Reduce content size to under ${this.context.maxFileSize} bytes`,
            'Consider writing the content in smaller chunks'
          ]
        );
      }

      const fileExists = await fs.pathExists(absolutePath);
      const parentDir = path.dirname(absolutePath);
      let backupPath: string | undefined;

      // Handle different write modes
      if (mode === 'create' && fileExists) {
        return this.createErrorResult(
          `File already exists: ${filePath}`,
          'VALIDATION_ERROR',
          [
            'Use mode "overwrite" to replace the existing file',
            'Use mode "append" to add content to the end',
            'Choose a different file name'
          ]
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
          console.warn(`Warning: Could not create backup file: ${error}`);
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
            await fs.move(backupPath, absolutePath);
          } catch (restoreError) {
            // Log restore failure but don't mask original error
            console.warn(`Warning: Could not restore backup after write failure: ${restoreError}`);
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
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR'
      );
    }
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
          normalizedPath.includes(blockedPattern) ||
          // Special check for system directories
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
