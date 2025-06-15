/**
 * Write Tool - Simplified file creation and modification
 *
 * Provides file writing functionality with support for:
 * - Creating new files with content
 * - Modifying existing files with unified diff patches
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
    const { path: filePath, content, diff, encoding = 'utf8' } = params;

    // Validate exactly one of content or diff is provided
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

    // Validate encoding
    const allowedEncodings = ['utf8', 'binary', 'base64'];
    if (!allowedEncodings.includes(encoding)) {
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

      // Security checks
      if (parentDir === '/') {
        return this.createErrorResult(
          `Cannot write files to root directory: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a subdirectory instead of root for safety']
        );
      }

      if (this.isBlockedPath(absolutePath) || this.isBlockedPath(parentDir)) {
        return this.createErrorResult(
          `Access to file is restricted: ${filePath}`,
          'PERMISSION_DENIED',
          ['Choose a different file that is not in the blocked list']
        );
      }

      // Extension validation
      if (this.context.allowedExtensions.length > 0 &&
          !this.context.allowedExtensions.some(ext => absolutePath.endsWith(ext))) {
        return this.createErrorResult(
          `File extension not allowed: ${filePath}`,
          'INVALID_FILE_TYPE',
          ['Use an allowed file extension']
        );
      }

      // Ensure parent directory exists
      await fs.ensureDir(parentDir);

      const fileExists = await fs.pathExists(absolutePath);
      
      // Tool context validation (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        const isDiffMode = diff !== undefined;
        const validation = toolContextManager.validateWriteOperation(absolutePath, isDiffMode);

        if (!validation.isValid) {
          const errorMessage = validation.warnings.join('\n') + '\n\n' + validation.suggestions.join('\n');
          return this.createErrorResult(errorMessage, 'VALIDATION_ERROR', validation.suggestions);
        }

        if (validation.warnings.length > 0) {
          logger.warn('⚠️ Write operation warnings', {
            warnings: validation.warnings,
            filePath: absolutePath
          }, 'WRITE_TOOL');
        }
      }

      let finalContent: string;
      let linesChanged: number;
      let mode: 'create' | 'patch';

      if (content !== undefined) {
        // Content mode - full file write
        mode = fileExists ? 'patch' : 'create';
        
        // Check content size
        const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce content size to under ${this.context.maxFileSize} bytes`]
          );
        }

        finalContent = content;
        linesChanged = content.split('\n').length;
      } else {
        // Diff mode - patch existing file
        mode = 'patch';
        
        if (!fileExists) {
          return this.createErrorResult(
            `File does not exist: ${filePath}. Cannot apply diff to non-existent file.`,
            'VALIDATION_ERROR',
            ['Create the file first with a content write', 'Check the file path']
          );
        }

        const currentContent = await fs.readFile(absolutePath, 'utf8');
        const patchResult = this.applyDiff(currentContent, diff!);
        finalContent = patchResult.content;
        linesChanged = patchResult.linesChanged;

        // Check patched content size
        const contentSize = Buffer.byteLength(finalContent, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(
            `Patched content size (${contentSize} bytes) exceeds maximum allowed size (${this.context.maxFileSize} bytes)`,
            'FILE_TOO_LARGE',
            [`Reduce patch size to keep content under ${this.context.maxFileSize} bytes`]
          );
        }
      }

      // Perform atomic write
      const tempPath = `${absolutePath}.tmp.${Date.now()}.${process.pid}`;
      await fs.writeFile(tempPath, finalContent, encoding as BufferEncoding);
      await fs.move(tempPath, absolutePath, { overwrite: true });

      // Record successful operation
      toolContextManager.recordFileWrite(absolutePath, true);

      const result: WriteResult = {
        filePath: absolutePath,
        linesChanged,
        created: !fileExists,
        mode
      };

      return this.createSuccessResult(result, {
        operation: mode,
        linesChanged,
        encoding
      });

    } catch (error) {
      // Record failed operation
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
    return this.context.blockedPaths.some(blockedPattern => {
      return normalizedPath.includes(blockedPattern) ||
             normalizedPath.startsWith('/etc/') ||
             normalizedPath.startsWith('/usr/') ||
             normalizedPath.startsWith('/bin/') ||
             normalizedPath.startsWith('/sbin/') ||
             normalizedPath.includes('node_modules') ||
             normalizedPath.includes('.git');
    });
  }

  private applyDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    // Validate inputs
    if (typeof currentContent !== 'string' || typeof diff !== 'string') {
      throw new ToolError('Invalid input: currentContent and diff must be strings', 'VALIDATION_ERROR');
    }

    // Check for binary content
    if (this.isBinaryContent(currentContent)) {
      throw new ToolError(
        'Cannot apply diff to binary content',
        'VALIDATION_ERROR',
        ['Binary files must be modified using full content replacement, not diffs']
      );
    }

    // Validate diff format
    this.validateDiffFormat(diff);

    // Handle segmented vs simple diff
    if (this.isSegmentedDiff(diff)) {
      return this.applySegmentedDiff(currentContent, diff);
    } else {
      return this.applySimpleDiff(currentContent, diff);
    }
  }

  private isSegmentedDiff(diff: string): boolean {
    return diff.includes('\n...\n') || diff.includes('\n@@\n') || 
           diff.startsWith('...') || diff.endsWith('...') ||
           diff.startsWith('@@') || diff.endsWith('@@');
  }

  private applySimpleDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    const originalLines = currentContent.split('\n');
    const diffLines = this.cleanDiffLines(diff);

    // Extract context for location matching
    const contextLines = this.extractContextLines(diffLines);
    if (contextLines.length === 0) {
      throw new ToolError(
        'Simple diff format requires at least one context line for location matching',
        'VALIDATION_ERROR',
        ['Add context lines to help locate where changes should be applied']
      );
    }

    // Find matching locations
    const matchingLocations = this.findContextMatches(originalLines, contextLines);
    
    if (matchingLocations.length === 0) {
      // Try auto-segmentation as fallback for complex diffs
      try {
        return this.applyAutoSegmentedDiff(currentContent, diff);
      } catch (autoError) {
        // If auto-segmentation also fails, throw the original error
        throw new ToolError(
          'No matching context found in file',
          'VALIDATION_ERROR',
          ['The context lines in the diff do not match any location in the file', 'Use the read tool to get current file content']
        );
      }
    }

    if (matchingLocations.length > 1) {
      throw new ToolError(
        `Multiple matching contexts found at lines: ${matchingLocations.map(loc => loc + 1).join(', ')}`,
        'VALIDATION_ERROR',
        ['The context is ambiguous - it matches multiple locations in the file', 'Add more specific context lines']
      );
    }

    return this.applyDiffAtLocation(originalLines, diffLines, matchingLocations[0]);
  }

  private applySegmentedDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    const originalLines = currentContent.split('\n');
    const cleanedDiff = diff.replace(/^(@@|\.\.\.)\s*\n/, '');
    const segments = cleanedDiff
      .split(/\n\.\.\.\n|\n@@\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== '@@' && s !== '...');

    if (segments.length === 0) {
      throw new ToolError('No valid segments found in segmented diff', 'VALIDATION_ERROR');
    }

    // Process each segment
    const segmentData = segments.map((segment, i) => {
      const segmentLines = this.cleanDiffLines(segment);
      const contextLines = this.extractContextLines(segmentLines);
      
      if (contextLines.length === 0) {
        throw new ToolError(`Segment ${i + 1} has no context lines for location matching`, 'VALIDATION_ERROR');
      }

      const matches = this.findContextMatches(originalLines, contextLines);
      if (matches.length === 0) {
        throw new ToolError(`No matching context found for segment ${i + 1}`, 'VALIDATION_ERROR');
      }
      if (matches.length > 1) {
        throw new ToolError(`Segment ${i + 1} has ambiguous context`, 'VALIDATION_ERROR');
      }

      return {
        diffLines: segmentLines,
        startLocation: matches[0],
        endLocation: matches[0] + contextLines.length - 1
      };
    });

    // Validate segments are in order
    for (let i = 1; i < segmentData.length; i++) {
      if (segmentData[i].startLocation <= segmentData[i - 1].endLocation) {
        throw new ToolError('Segments overlap or are out of order', 'VALIDATION_ERROR');
      }
    }

    // Apply segments in reverse order
    let workingContent = originalLines.slice();
    let totalLinesChanged = 0;

    for (let i = segmentData.length - 1; i >= 0; i--) {
      const segment = segmentData[i];
      const result = this.applyDiffAtLocation(workingContent, segment.diffLines, segment.startLocation);
      workingContent = result.content.split('\n');
      totalLinesChanged += result.linesChanged;
    }

    return {
      content: workingContent.join('\n'),
      linesChanged: totalLinesChanged
    };
  }

  private cleanDiffLines(diff: string): string[] {
    return diff.split('\n')
      .filter(line => line.trim() !== '')
      .filter(line => !line.startsWith('--- ') && !line.startsWith('+++ ') && 
                     !line.startsWith('diff ') && !line.match(/^@@ -\d+,\d+ \+\d+,\d+ @@/));
  }

  private extractContextLines(diffLines: string[]): string[] {
    return diffLines
      .filter(line => !line.startsWith('+'))
      .map(line => {
        if (line.startsWith(' ')) return line.substring(1);
        if (line.startsWith('-')) return line.substring(1);
        return line;
      });
  }

  private findContextMatches(originalLines: string[], contextLines: string[]): number[] {
    const matches: number[] = [];

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

  private contextMatches(expected: string, actual: string): boolean {
    if (expected === actual) return true;
    if (expected.trim() === actual.trim()) return true;
    
    // Normalize whitespace differences
    const normalize = (str: string) => str.trim().replace(/\s+/g, ' ');
    return normalize(expected) === normalize(actual);
  }

  private applyDiffAtLocation(originalLines: string[], diffLines: string[], startLocation: number): { content: string; linesChanged: number } {
    const resultLines: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;
    let originalIndex = 0;
    let diffIndex = 0;

    // Copy lines before the match location
    while (originalIndex < startLocation) {
      resultLines.push(originalLines[originalIndex]);
      originalIndex++;
    }

    // Process the diff at the matching location
    while (diffIndex < diffLines.length) {
      const diffLine = diffLines[diffIndex];
      diffIndex++;

      if (diffLine.startsWith('-')) {
        // Deletion - skip the original line
        originalIndex++;
        linesRemoved++;
      } else if (diffLine.startsWith('+')) {
        // Addition - add the new line
        resultLines.push(diffLine.substring(1));
        linesAdded++;
      } else {
        // Context line - use content from diff and advance original
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

    return {
      content: resultLines.join('\n'),
      linesChanged: linesAdded + linesRemoved
    };
  }

  private isBinaryContent(content: string): boolean {
    if (content.includes('\0')) return true;
    
    const sample = content.substring(0, 1000);
    const nonPrintableCount = Array.from(sample).filter(char => {
      const code = char.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code > 126;
    }).length;

    return nonPrintableCount > sample.length * 0.1;
  }

  private applyAutoSegmentedDiff(currentContent: string, diff: string): { content: string; linesChanged: number } {
    const originalLines = currentContent.split('\n');
    const diffLines = this.cleanDiffLines(diff);

    if (diffLines.length === 0) {
      throw new ToolError('No valid diff lines found', 'VALIDATION_ERROR', ['Diff must contain at least one line']);
    }

    // Find insertion points
    const insertions = this.findInsertionPoints(diffLines, originalLines);
    
    if (insertions.length === 0) {
      throw new ToolError(
        'No matching context found in file',
        'VALIDATION_ERROR',
        ['The context lines in the diff do not match any location in the file']
      );
    }

    // Apply insertions in reverse order to maintain line numbers
    let workingContent = originalLines.slice();
    let totalLinesChanged = 0;

    for (let i = insertions.length - 1; i >= 0; i--) {
      const insertion = insertions[i];
      workingContent.splice(insertion.insertAfterLine + 1, 0, ...insertion.additionLines);
      totalLinesChanged += insertion.additionLines.length;
    }

    return {
      content: workingContent.join('\n'),
      linesChanged: totalLinesChanged
    };
  }

  private findInsertionPoints(diffLines: string[], originalLines: string[]): Array<{
    insertAfterLine: number;
    additionLines: string[];
  }> {
    const insertions: Array<{
      insertAfterLine: number;
      additionLines: string[];
    }> = [];

    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];
      
      // Look for context lines followed by additions
      if (!line.startsWith('+') && !line.startsWith('-')) {
        // Collect context leading up to this point
        let contextStart = i;
        while (contextStart > 0 && 
               !diffLines[contextStart - 1].startsWith('+') && 
               !diffLines[contextStart - 1].startsWith('-')) {
          contextStart--;
        }
        
        // Look ahead for additions after this context line
        let j = i + 1;
        const additionLines = [];
        while (j < diffLines.length && diffLines[j].startsWith('+')) {
          additionLines.push(diffLines[j].substring(1)); // Remove the + prefix
          j++;
        }
        
        // If we found additions, find the insertion point
        if (additionLines.length > 0) {
          // Build a context sequence for better matching
          const contextSequence = [];
          for (let k = contextStart; k <= i; k++) {
            const contextLine = diffLines[k];
            if (!contextLine.startsWith('+') && !contextLine.startsWith('-')) {
              const cleanLine = contextLine.startsWith(' ') ? contextLine.substring(1) : contextLine;
              contextSequence.push(cleanLine);
            }
          }
          
          if (contextSequence.length > 0) {
            // Find where this context sequence appears in the original file
            const insertionPoint = this.findSequenceInOriginal(contextSequence, originalLines);
            
            if (insertionPoint >= 0) {
              // Insert after the last line of the matched sequence
              const insertAfterLine = insertionPoint + contextSequence.length - 1;
              insertions.push({
                insertAfterLine,
                additionLines: additionLines
              });
            }
          }
        }
        
        // Move past the additions we just processed
        i = j;
      } else {
        i++;
      }
    }

    // Sort insertions by line number (reverse order for processing)
    insertions.sort((a, b) => b.insertAfterLine - a.insertAfterLine);
    
    return insertions;
  }

  private findSequenceInOriginal(contextSequence: string[], originalLines: string[]): number {
    if (contextSequence.length === 0) return -1;
    
    // Look for the sequence in the original file
    for (let i = 0; i <= originalLines.length - contextSequence.length; i++) {
      let allMatch = true;
      
      for (let j = 0; j < contextSequence.length; j++) {
        if (!this.contextMatches(contextSequence[j], originalLines[i + j])) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        return i; // Return the starting position of the match
      }
    }
    
    // If exact sequence not found, try to match just the last line with additional context
    const lastLine = contextSequence[contextSequence.length - 1];
    const matchingLines = [];
    
    for (let i = 0; i < originalLines.length; i++) {
      if (this.contextMatches(lastLine, originalLines[i])) {
        matchingLines.push(i);
      }
    }
    
    if (matchingLines.length === 1) {
      return matchingLines[0] - contextSequence.length + 1;
    }
    
    // Use additional context to disambiguate if possible
    if (matchingLines.length > 1 && contextSequence.length > 1) {
      const prevContextLine = contextSequence[contextSequence.length - 2];
      
      for (const lineIndex of matchingLines) {
        if (lineIndex > 0 && this.contextMatches(prevContextLine, originalLines[lineIndex - 1])) {
          return lineIndex - contextSequence.length + 1;
        }
      }
    }
    
    return -1; // No unique match found
  }

  private validateDiffFormat(diff: string): void {
    if (diff.trim() === '') {
      throw new ToolError('Empty diff provided', 'VALIDATION_ERROR', ['Please provide a valid diff with at least one change']);
    }

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