/**
 * Read tool - Secure file content reading with comprehensive safety measures
 *
 * Features:
 * - Path traversal protection
 * - File size limits to prevent memory exhaustion
 * - Line range support for large files
 * - Binary file detection
 * - Encoding detection and support
 * - Security filtering for sensitive files
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import { validatePath, validateFileExtension } from './validation';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ReadParams {
  path: string;
  encoding?: 'utf8' | 'binary' | 'base64';
  maxSize?: number;
  lines?: {
    start: number;
    end: number;
  };
  preview?: boolean; // If true, read only first few lines for large files
}

export interface ReadResult {
  content: string;
  metadata: {
    filePath: string;
    fileSize: number;
    encoding: string;
    isBinary: boolean;
    lineCount?: number;
    truncated?: boolean;
    previewOnly?: boolean;
  };
}

export class ReadTool extends BaseTool {
  readonly name = 'read';
  readonly description = 'Read file contents with security measures and encoding detection';

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to read (relative or absolute)'
      },
      encoding: {
        type: 'string',
        description: 'Text encoding to use when reading the file',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8'
      },
      maxSize: {
        type: 'number',
        description: 'Maximum file size to read in bytes',
        minimum: 1,
        maximum: 50 * 1024 * 1024, // 50MB max
        default: 10 * 1024 * 1024 // 10MB default
      },
      lines: {
        type: 'object',
        description: 'Read specific line range (1-based indexing)',
        properties: {
          start: { type: 'number', minimum: 1 },
          end: { type: 'number', minimum: 1 }
        }
      },
      preview: {
        type: 'boolean',
        description: 'Read only first 50 lines for large files',
        default: false
      }
    },
    required: ['path']
  };

  protected async executeImpl(params: ReadParams): Promise<ToolResult> {
    const {
      path: filePath,
      encoding = 'utf8',
      maxSize = this.context.maxFileSize,
      lines,
      preview = false
    } = params;

    try {
      // Validate and resolve the path
      const resolvedPath = await this.validateAndResolvePath(filePath);

      // Check if file exists and get stats
      const stats = await fs.stat(resolvedPath);

      if (stats.isDirectory()) {
        return this.createErrorResult(
          `Path is a directory, not a file: ${filePath}`,
          'INVALID_PATH',
          ['Use the ls tool to list directory contents', 'Provide a file path instead']
        );
      }

      // Check file size limits
      if (stats.size > maxSize) {
        return this.createErrorResult(
          `File too large: ${this.formatFileSize(stats.size)} exceeds limit of ${this.formatFileSize(maxSize)}`,
          'FILE_TOO_LARGE',
          [
            'Use the lines parameter to read specific sections',
            'Enable preview mode to read first 50 lines only',
            'Increase maxSize parameter if needed'
          ]
        );
      }

      // Detect if file is binary
      const isBinary = await this.detectBinaryFile(resolvedPath);

      if (isBinary && encoding === 'utf8') {
        return this.createErrorResult(
          'File appears to be binary. Use encoding="binary" or encoding="base64" to read binary files',
          'VALIDATION_ERROR',
          [
            'Use encoding="base64" for binary files',
            'Use encoding="binary" for raw binary data',
            'Use the ls tool to check file type'
          ]
        );
      }

      // Read the file content
      const result = await this.readFileContent(resolvedPath, encoding, lines, preview, stats.size);

      return this.createSuccessResult(result, {
        executionTime: 0, // Will be set by base class
        fileSizeBytes: stats.size,
        isBinary
      });

    } catch (error) {
      // Let the base class handle error conversion
      throw error;
    }
  }

  /**
   * Validate file path and resolve to absolute path with security checks
   */
  private async validateAndResolvePath(filePath: string): Promise<string> {
    // Basic path validation
    validatePath(filePath, { allowAbsolute: true, mustExist: true });

    // Resolve to absolute path
    const resolvedPath = path.resolve(this.context.workingDirectory, filePath);

    // Security check: ensure resolved path doesn't escape working directory for relative paths
    if (!path.isAbsolute(filePath)) {
      const workingDir = path.resolve(this.context.workingDirectory);
      if (!resolvedPath.startsWith(workingDir)) {
        throw new ToolError(
          'Path traversal detected - file is outside working directory',
          'INVALID_PATH',
          ['Use absolute paths if you need to access files outside the project']
        );
      }
    }

    // Check against blocked paths
    const normalizedPath = path.normalize(resolvedPath);
    for (const blockedPattern of this.context.blockedPaths) {
      if (this.matchesPattern(normalizedPath, blockedPattern)) {
        throw new ToolError(
          `Access denied: path matches blocked pattern "${blockedPattern}"`,
          'PERMISSION_DENIED',
          ['This path is blocked for security reasons', 'Contact administrator if access is needed']
        );
      }
    }

    // Validate file extension if restrictions exist
    if (this.context.allowedExtensions.length > 0) {
      validateFileExtension(resolvedPath, this.context.allowedExtensions);
    }

    // Check for hidden files if not allowed
    if (!this.context.allowHidden && this.isHiddenFile(resolvedPath)) {
      throw new ToolError(
        'Access to hidden files is not allowed',
        'PERMISSION_DENIED',
        ['Hidden files are blocked by security policy']
      );
    }

    return resolvedPath;
  }

  /**
   * Detect if a file is binary by reading the first chunk and checking for null bytes
   */
  private async detectBinaryFile(filePath: string): Promise<boolean> {
    try {
      const chunkSize = 512; // Read first 512 bytes
      const buffer = Buffer.alloc(chunkSize);
      const fd = await fs.promises.open(filePath, 'r');

      try {
        const { bytesRead } = await fd.read(buffer, 0, chunkSize, 0);
        const chunk = buffer.subarray(0, bytesRead);

        // Check for null bytes (common indicator of binary files)
        return chunk.includes(0);
      } finally {
        await fd.close();
      }
    } catch (error) {
      // If we can't detect, assume text file
      return false;
    }
  }

  /**
   * Read file content with specified encoding and optional line range
   */
  private async readFileContent(
    filePath: string,
    encoding: string,
    lines?: { start: number; end: number },
    preview?: boolean,
    fileSize?: number
  ): Promise<ReadResult> {
    const metadata: ReadResult['metadata'] = {
      filePath,
      fileSize: fileSize || 0,
      encoding,
      isBinary: encoding !== 'utf8'
    };

    if (encoding === 'binary' || encoding === 'base64') {
      // Read binary files
      const buffer = await fs.readFile(filePath);
      const content = encoding === 'base64' ? buffer.toString('base64') : buffer.toString('binary');

      return {
        content,
        metadata: {
          ...metadata,
          isBinary: true
        }
      };
    }

    // Read text files
    const fileContent = await fs.readFile(filePath, 'utf8');
    const fileLines = fileContent.split('\n');
    metadata.lineCount = fileLines.length;

    let content: string;
    let truncated = false;
    let previewOnly = false;

    if (lines) {
      // Read specific line range
      const { start, end } = lines;

      if (start < 1 || end < start || start > fileLines.length) {
        throw new ToolError(
          `Invalid line range: start=${start}, end=${end}. File has ${fileLines.length} lines`,
          'VALIDATION_ERROR',
          [`Valid range is 1 to ${fileLines.length}`, 'Ensure start <= end and both are positive']
        );
      }

      const selectedLines = fileLines.slice(start - 1, Math.min(end, fileLines.length));
      content = selectedLines.join('\n');
      truncated = end > fileLines.length;

    } else if (preview && fileLines.length > 50) {
      // Preview mode: show first 50 lines
      content = fileLines.slice(0, 50).join('\n');
      previewOnly = true;

    } else {
      // Read entire file
      content = fileContent;
    }

    if (truncated) {
      metadata.truncated = true;
    }
    if (previewOnly) {
      metadata.previewOnly = true;
    }

    return {
      content,
      metadata
    };
  }

  /**
   * Check if a file path matches a blocked pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob-like patterns to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern, 'i');
    return regex.test(filePath) || path.basename(filePath).match(regex) !== null;
  }

  /**
   * Check if a file path represents a hidden file
   */
  private isHiddenFile(filePath: string): boolean {
    const basename = path.basename(filePath);
    return basename.startsWith('.') && basename !== '.' && basename !== '..';
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
