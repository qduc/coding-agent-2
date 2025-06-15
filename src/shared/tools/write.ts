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
import { logger } from '../utils/logger';

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
  readonly description = 'Write content to files. Provides two modes:\n\n1) Content mode: Provide full file content to create new files or replace existing ones\n2) Diff mode: Provide a diff to selectively modify parts of an existing file';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Full content to write (for new files or overwriting existing files)' },
      diff: { type: 'string', description: 'Diff to apply to an existing file. REQUIRES at least one addition (+) or deletion (-) line.\n\nFormat examples:\n\nBasic format:\n```\nexisting line before\n-old line to remove\n+new line to add\nexisting line after\n```\n\nMultiple changes (separate with ... or @@):\n```\nfunction greet(name) {\n-  console.log("Hello, " + name);\n+  console.log("Hi there, " + name + "!");\n  return "greeting complete";\n...\n-  return "greeting complete";\n+  return "greeting sent successfully";\n}\n```\n\nKey requirements:\n- Include context lines (unchanged lines) to locate where changes apply\n- Context must uniquely identify the location in the file\n- Use + for additions, - for deletions\n- Context lines must match existing file content exactly' }
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
          // Use logger to avoid interfering with Ink rendering
          logger.warn('⚠️ Write operation warnings', {
            warnings: validation.warnings,
            filePath: absolutePath
          }, 'WRITE_TOOL');
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
   *
   * The diff parser supports simple format and segmented format:
   * - Simple: Uses context matching to find the location automatically
   * - Segmented: Uses "..." or "@@" separators for distant changes
   * - Validates only one matching context exists for safety
   * - Maintains all safety checks to prevent corruption
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

    // Check if this is a segmented diff with ... or @@ separators
    if (diff.includes('\n...\n') || diff.includes('\n...\r\n') || diff.startsWith('...') || diff.endsWith('...') ||
        diff.includes('\n@@\n') || diff.includes('\n@@\r\n') || diff.startsWith('@@') || diff.endsWith('@@')) {
      return this.applySegmentedDiff(currentContent, diff);
    } else {
      return this.applySimpleDiff(currentContent, diff);
    }
  }

  /**
   * Apply simple diff format without hunk headers - uses context matching
   */
  private applySimpleDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    const originalLines = currentContent.split('\n');
    const diffLines = diff.split('\n')
      .filter(line => line.trim() !== '')
      .filter(line => {
        // Filter out traditional diff headers and hunk headers
        return !line.startsWith('--- ') && 
               !line.startsWith('+++ ') && 
               !line.startsWith('diff ') &&
               !line.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
      });

    if (diffLines.length === 0) {
      throw new ToolError(
        'No valid diff lines found',
        'VALIDATION_ERROR',
        ['Diff must contain at least one line']
      );
    }

    // Extract context lines to find matching location
    // Context lines are any lines that represent existing content (not starting with +)
    const contextLines = diffLines
      .filter(line => !line.startsWith('+'))
      .map(line => {
        if (line.startsWith(' ')) return line.substring(1);
        if (line.startsWith('-')) return line.substring(1);
        return line;
      });

    if (contextLines.length === 0) {
      throw new ToolError(
        'Simple diff format requires at least one context line for location matching',
        'VALIDATION_ERROR',
        [
          'Add context lines to help locate where changes should be applied',
          'Context lines are any lines that represent existing content (not starting with +)',
          'Example:',
          'existing line before',
          '-old line to change',
          '+new line to add',
          'existing line after'
        ]
      );
    }

    // Find all possible matching locations
    const matchingLocations = this.findContextMatches(originalLines, contextLines);

    if (matchingLocations.length === 0) {
      throw new ToolError(
        'No matching context found in file',
        'VALIDATION_ERROR',
        [
          'The context lines in the diff do not match any location in the file',
          'Use the read tool to get current file content',
          'Ensure context lines match exactly (ignoring whitespace differences)'
        ]
      );
    }

    if (matchingLocations.length > 1) {
      throw new ToolError(
        `Multiple matching contexts found at lines: ${matchingLocations.map(loc => loc + 1).join(', ')}`,
        'VALIDATION_ERROR',
        [
          'The context is ambiguous - it matches multiple locations in the file',
          'Add more specific context lines to uniquely identify the location',
          'Or use traditional diff format with @@ hunk headers for precise targeting'
        ]
      );
    }

    // Apply the diff at the single matching location
    const matchLocation = matchingLocations[0];
    return this.applySimpleDiffAtLocation(originalLines, diffLines, matchLocation);
  }

  /**
   * Find all locations where the context lines match
   */
  private findContextMatches(originalLines: string[], contextLines: string[]): number[] {
    const matches: number[] = [];

    // Search for context pattern in the original file
    for (let i = 0; i <= originalLines.length - contextLines.length; i++) {
      let allMatch = true;

      for (let j = 0; j < contextLines.length; j++) {
        if (!this.contextMatches(contextLines[j], originalLines[i + j])) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        matches.push(i);
      }
    }

    return matches;
  }

  /**
   * Apply simple diff at a specific location
   */
  private applySimpleDiffAtLocation(
    originalLines: string[],
    diffLines: string[],
    startLocation: number
  ): { content: string; linesChanged: number } {
    const resultLines: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;
    let originalIndex = 0;
    let diffIndex = 0;

    // Detect base indentation from the original file at the match location
    let baseIndentation = '';
    if (startLocation < originalLines.length) {
      const originalLine = originalLines[startLocation];
      const match = originalLine.match(/^(\s*)/);
      if (match) {
        baseIndentation = match[1];
      }
    }

    // Copy lines before the match location
    while (originalIndex < startLocation) {
      resultLines.push(originalLines[originalIndex]);
      originalIndex++;
    }

    // Process the diff at the matching location
    while (diffIndex < diffLines.length) {
      const diffLine = diffLines[diffIndex];
      diffIndex++;

      if (diffLine.startsWith('-')) { // Deletion
        // Skip the original line (delete it)
        originalIndex++;
        linesRemoved++;
      } else if (diffLine.startsWith('+')) { // Addition
        let addedContent = diffLine.substring(1);
        
        // Smart indentation: only apply base indentation if the diff doesn't already specify indentation
        // and if we're in a code context that requires consistent indentation
        // For now, be conservative and use the content as-is from the diff
        resultLines.push(addedContent);
        linesAdded++;
      } else { // Context line (anything that doesn't start with + or -)
        // For context lines, use the content from the diff (which represents the desired final state)
        const contextContent = diffLine.startsWith(' ') ? diffLine.substring(1) : diffLine;
        resultLines.push(contextContent);
        originalIndex++;
      }
    }

    // Copy remaining original lines
    while (originalIndex < originalLines.length) {
      resultLines.push(originalLines[originalIndex]);
      originalIndex++;
    }

    const finalContent = resultLines.join('\n');
    const linesChanged = linesAdded + linesRemoved;

    return {
      content: finalContent,
      linesChanged
    };
  }

  /**
   * Apply segmented diff format with ... or @@ separators between distant sections
   */
  private applySegmentedDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    const originalLines = currentContent.split('\n');

    // First, remove traditional diff headers
    let cleanedDiff = diff.split('\n')
      .filter(line => {
        return !line.startsWith('--- ') && 
               !line.startsWith('+++ ') && 
               !line.startsWith('diff ') &&
               !line.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
      })
      .join('\n');

    // Split diff into segments by ... or @@ separator
    // Handle cases where separators appear at the beginning/end of diff
    // Remove leading separators (@@, ...) that might cause empty first segments
    cleanedDiff = cleanedDiff.replace(/^(@@|\.\.\.)\s*\n/, '');

    const segments = cleanedDiff
      .split(/\n\.\.\.\n|\n\.\.\.\r\n|\n@@\n|\n@@\r\n/)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0 && segment !== '@@' && segment !== '...');

    if (segments.length === 0) {
      throw new ToolError(
        'No valid segments found in segmented diff',
        'VALIDATION_ERROR',
        ['Segmented diff must contain at least one segment between ... separators']
      );
    }

    // Parse each segment and find its location
    interface DiffSegment {
      diffLines: string[];
      startLocation: number;
      endLocation: number;
    }

    const parsedSegments: DiffSegment[] = [];
    let totalLinesChanged = 0;

    for (let i = 0; i < segments.length; i++) {
      const segmentDiff = segments[i];
      const segmentLines = segmentDiff.split('\n')
        .filter(line => line.trim() !== '')
        .filter(line => {
          // Filter out any remaining headers that might be in segments
          return !line.startsWith('--- ') && 
                 !line.startsWith('+++ ') && 
                 !line.startsWith('diff ') &&
                 !line.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
        });

      if (segmentLines.length === 0) {
        continue; // Skip empty segments
      }

      // Extract context lines from this segment (same logic as simple diff)
      const contextLines = segmentLines
        .filter(line => !line.startsWith('+'))
        .map(line => {
          if (line.startsWith(' ')) return line.substring(1);
          if (line.startsWith('-')) return line.substring(1);
          return line;
        });

      if (contextLines.length === 0) {
        throw new ToolError(
          `Segment ${i + 1} has no context lines for location matching`,
          'VALIDATION_ERROR',
          ['Each segment must contain at least one context line (line not starting with +)']
        );
      }

      // Find matching locations for this segment
      const matchingLocations = this.findContextMatches(originalLines, contextLines);

      if (matchingLocations.length === 0) {
        throw new ToolError(
          `No matching context found for segment ${i + 1}`,
          'VALIDATION_ERROR',
          [
            `Segment ${i + 1} context does not match any location in the file`,
            'Ensure each segment has correct context lines'
          ]
        );
      }

      if (matchingLocations.length > 1) {
        throw new ToolError(
          `Segment ${i + 1} has ambiguous context - matches multiple locations: ${matchingLocations.map(loc => loc + 1).join(', ')}`,
          'VALIDATION_ERROR',
          [
            `Add more specific context to segment ${i + 1} to uniquely identify its location`,
            'Each segment must have unique context within the file',
            'Use "..." or "@@" on its own line to separate different segments of changes'
          ]
        );
      }

      const startLocation = matchingLocations[0];
      const endLocation = startLocation + contextLines.length - 1;

      parsedSegments.push({
        diffLines: segmentLines,
        startLocation,
        endLocation
      });
    }

    // Validate segments are in order and don't overlap
    for (let i = 1; i < parsedSegments.length; i++) {
      const prevSegment = parsedSegments[i - 1];
      const currentSegment = parsedSegments[i];

      if (currentSegment.startLocation <= prevSegment.endLocation) {
        throw new ToolError(
          `Segments ${i} and ${i + 1} overlap or are out of order`,
          'VALIDATION_ERROR',
          [
            'Segments must appear in the same order as they appear in the file',
            'Segments cannot overlap - they must target different parts of the file'
          ]
        );
      }
    }

    // Apply all segments in reverse order to avoid offset issues
    let workingContent = originalLines.slice(); // Copy of original

    for (let i = parsedSegments.length - 1; i >= 0; i--) {
      const segment = parsedSegments[i];

      // Apply this single segment to the working content
      const segmentResult = this.applySimpleDiffAtLocation(
        workingContent,
        segment.diffLines,
        segment.startLocation
      );

      workingContent = segmentResult.content.split('\n');
      totalLinesChanged += segmentResult.linesChanged;
    }

    const finalContent = workingContent.join('\n');

    return {
      content: finalContent,
      linesChanged: totalLinesChanged
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

    // Smart indentation matching - normalize indentation differences
    const normalizeIndentation = (str: string) => {
      const trimmed = str.trim();
      if (trimmed === '') return '';
      
      // Detect if this is a code line that should preserve relative indentation
      // but allow different base indentation levels
      const leadingWhitespace = str.match(/^(\s*)/)?.[1] || '';
      const content = str.substring(leadingWhitespace.length);
      
      // If both strings have content, compare just the content part
      if (content.trim() !== '') {
        return content;
      }
      
      return trimmed;
    };

    if (normalizeIndentation(expected) === normalizeIndentation(actual)) return true;

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
   * Validate basic diff format - supports simple and segmented formats
   */
  private validateDiffFormat(diff: string): void {
    if (diff.trim() === '') {
      throw new ToolError(
        'Empty diff provided',
        'VALIDATION_ERROR',
        ['Please provide a valid diff with at least one change']
      );
    }

    // Check for at least one actual change (+ or - line)
    const hasChanges = /^[+-]/m.test(diff);
    if (!hasChanges) {
      throw new ToolError(
        'Invalid diff: no additions or deletions found',
        'VALIDATION_ERROR',
        [
          'The diff must contain at least one line that starts with + or -',
          'Example format:',
          ' context line',
          '-old line',
          '+new line'
        ]
      );
    }
  }
}
