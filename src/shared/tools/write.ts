/**
 * Write Tool - File creation and modification
 *
 * Supports two modes:
 * - Content mode: Create new files or replace existing content
 * - Search-replace mode: Find and replace text with fuzzy matching fallback
 */

import fs from 'fs-extra';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { validatePath } from './validation';
import { toolContextManager } from '../utils/ToolContextManager';
import { logger } from '../utils/logger';
import { eventBus } from '../utils/EventBus';

export interface WriteParams {
  path: string;
  content?: string;
  search?: string;
  replace?: string;
  encoding?: 'utf8' | 'binary' | 'base64';
  searchRegex?: boolean; // If true, treat search as a regex pattern
}

export interface WriteResult {
  filePath: string;
  linesChanged: number;
  created: boolean;
  mode: 'create' | 'patch' | 'search-replace';
  replacements?: number;
}

export class WriteTool extends BaseTool {
  readonly name = 'write';
  readonly description = 'Write content to files with two modes: content (full file) or search-replace (preferred for edits).';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write to' },
      content: { type: 'string', description: 'Full content to write (for new files or overwriting existing files)' },
      search: { type: 'string', description: 'Text to search for in search-replace mode with fuzzy matching fallback or regex if searchRegex is true.' },
      replace: { type: 'string', description: 'Text to replace matches with in search-replace mode.' },
      searchRegex: { type: 'boolean', description: 'If true, treat search as a regex pattern.' }
    },
    required: ['path'],
    additionalProperties: false
  };

  protected async executeImpl(params: WriteParams, abortSignal?: AbortSignal): Promise<ToolResult> {
    const { path: filePath, content, search, replace, encoding = 'utf8', searchRegex = false } = params;

    // Validate mode parameters
    const modes = [content, search].filter(x => x !== undefined);
    if (modes.length === 0) {
      return this.createErrorResult('Must provide content or search parameter', 'VALIDATION_ERROR');
    }
    if (modes.length > 1) {
      return this.createErrorResult('Cannot mix modes - use only one parameter', 'VALIDATION_ERROR');
    }
    if (search !== undefined && replace === undefined) {
      return this.createErrorResult('Search-replace mode requires both search and replace', 'VALIDATION_ERROR');
    }

    if (!['utf8', 'binary', 'base64'].includes(encoding)) {
      return this.createErrorResult(`Invalid encoding: ${encoding}`, 'VALIDATION_ERROR');
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

      // Security and validation checks
      if (parentDir === '/') {
        return this.createErrorResult('Cannot write to root directory', 'PERMISSION_DENIED');
      }
      if (this.isBlockedPath(absolutePath) || this.isBlockedPath(parentDir)) {
        return this.createErrorResult('File path is restricted', 'PERMISSION_DENIED');
      }
      if (this.context.allowedExtensions.length > 0 &&
          !this.context.allowedExtensions.some(ext => absolutePath.endsWith(ext))) {
        return this.createErrorResult('File extension not allowed', 'INVALID_FILE_TYPE');
      }

      // Ensure parent directory exists
      await fs.ensureDir(parentDir);

      const fileExists = await fs.pathExists(absolutePath);

      // Tool context validation
      {
        const validation = toolContextManager.validateWriteOperation(absolutePath, false);
        if (!validation.isValid) {
          return this.createErrorResult(validation.warnings.join('; '), 'VALIDATION_ERROR');
        }
        if (validation.warnings.length > 0) {
          logger.warn('Write warnings', { warnings: validation.warnings, filePath: absolutePath }, 'WRITE_TOOL');
        }
      }

      let finalContent: string;
      let linesChanged: number;
      let mode: 'create' | 'patch' | 'search-replace';
      let replacements = 0;

      if (content !== undefined) {
        // Content mode
        mode = fileExists ? 'patch' : 'create';
        const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(`Content too large: ${contentSize} bytes`, 'FILE_TOO_LARGE');
        }
        finalContent = content;
        linesChanged = content.split('\n').length;
      } else {
        // Search-replace mode
        mode = 'search-replace';
        if (!fileExists) {
          return this.createErrorResult('Cannot perform search-replace on non-existent file', 'VALIDATION_ERROR');
        }
        // For search-replace mode, ensure file has been read before allowing operation
        const searchReplaceValidation = toolContextManager.validateSearchReplaceOperation(absolutePath);
        if (!searchReplaceValidation.isValid) {
          return this.createErrorResult(searchReplaceValidation.message || 'File must be read before search-replace.', 'VALIDATION_ERROR');
        }
        const currentContent = await fs.readFile(absolutePath, 'utf8');
        let result;
        if (searchRegex) {
          try {
            result = this.performRegexSearchReplace(currentContent, search!, replace!);
          } catch (error) {
            if (error instanceof ToolError) throw error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new ToolError(`Regex search-replace failed: ${message}`, 'UNKNOWN_ERROR');
          }
        } else {
          result = this.performSearchReplace(currentContent, search!, replace!);
        }
        finalContent = result.content;
        linesChanged = result.linesChanged ?? 0;
        replacements = result.replacements;

        const contentSize = Buffer.byteLength(finalContent, encoding as BufferEncoding);
        if (contentSize > this.context.maxFileSize) {
          return this.createErrorResult(`Replaced content too large: ${contentSize} bytes`, 'FILE_TOO_LARGE');
        }
      }

      // Approval check before destructive action (eventBus-based)
      const approval = await new Promise<string>((resolve) => {
        eventBus.emit('approval-request', {
          details: {
            type: 'write',
            path: filePath,
            diff: undefined // Optionally add diff preview
          },
          callback: resolve
        });
      });
      if (approval === 'denied') {
        return this.createErrorResult('Write denied by user approval', 'PERMISSION_DENIED');
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
        mode,
        ...(mode === 'search-replace' && { replacements })
      };

      return this.createSuccessResult(result, { operation: mode, linesChanged, encoding });

    } catch (error) {
      toolContextManager.recordFileWrite(filePath, false);
      if (error instanceof ToolError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolError(`Write failed: ${message}`, 'UNKNOWN_ERROR');
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

  private performSearchReplace(content: string, search: string, replace: string): {
    content: string;
    linesChanged: number;
    replacements: number;
  } {
    if (!search.trim()) {
      throw new ToolError('Empty search string', 'VALIDATION_ERROR');
    }
    if (this.isBinaryContent(content)) {
      throw new ToolError('Cannot search-replace binary content', 'VALIDATION_ERROR');
    }

    const originalLines = content.split('\n');

    try {
      const result = this.performAdvancedSearchReplace(content, search, replace);
      const resultLines = result.content.split('\n');

      // Calculate lines changed
      let linesChanged = 0;
      const minLines = Math.min(originalLines.length, resultLines.length);

      for (let i = 0; i < minLines; i++) {
        if (originalLines[i] !== resultLines[i]) {
          linesChanged++;
        }
      }
      linesChanged += Math.abs(resultLines.length - originalLines.length);

      return {
        content: result.content,
        linesChanged,
        replacements: result.replacements
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolError(`Search-replace failed: ${message}`, 'UNKNOWN_ERROR');
    }
  }

  private performAdvancedSearchReplace(content: string, search: string, replace: string): {
    content: string;
    replacements: number;
  } {
    // First: exact string match
    if (content.includes(search)) {
      let replacements = 0;
      let index = 0;
      while ((index = content.indexOf(search, index)) !== -1) {
        replacements++;
        index += search.length;
      }
      return { content: content.replaceAll(search, replace), replacements };
    }

    // Second: fuzzy matching fallback
    const fuzzyResult = this.performFuzzySearchReplace(content, search, replace);
    if (fuzzyResult.replacements > 0) {
      logger.warn('Used fuzzy matching', {
        search, replacements: fuzzyResult.replacements, similarity: fuzzyResult.similarity
      }, 'WRITE_TOOL');
      return { content: fuzzyResult.content, replacements: fuzzyResult.replacements };
    }

    throw new ToolError(`Search string not found: ${search}`, 'VALIDATION_ERROR');
  }

  private performFuzzySearchReplace(content: string, search: string, replace: string): {
    content: string;
    replacements: number;
    similarity: number;
  } {
    const lines = content.split('\n');
    const searchLines = search.split('\n');
    const replaceLines = replace.split('\n');
    const threshold = 0.7;

    let bestMatch: { startLine: number; endLine: number; similarity: number } | null = null;

    // Find best matching block
    for (let i = 0; i <= lines.length - searchLines.length; i++) {
      const block = lines.slice(i, i + searchLines.length);
      const similarity = this.calculateSimilarity(searchLines, block);

      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { startLine: i, endLine: i + searchLines.length - 1, similarity };
      }
    }

    if (!bestMatch) {
      return { content, replacements: 0, similarity: 0 };
    }

    const resultLines = [
      ...lines.slice(0, bestMatch.startLine),
      ...replaceLines,
      ...lines.slice(bestMatch.endLine + 1)
    ];

    return {
      content: resultLines.join('\n'),
      replacements: 1,
      similarity: bestMatch.similarity
    };
  }

  private calculateSimilarity(searchLines: string[], candidateLines: string[]): number {
    if (searchLines.length !== candidateLines.length) return 0;

    let totalChars = 0;
    let matchingChars = 0;

    for (let i = 0; i < searchLines.length; i++) {
      const search = searchLines[i].trim();
      const candidate = candidateLines[i].trim();

      totalChars += Math.max(search.length, candidate.length);

      const minLength = Math.min(search.length, candidate.length);
      for (let j = 0; j < minLength; j++) {
        if (search[j] === candidate[j]) matchingChars++;
      }
    }

    return totalChars > 0 ? matchingChars / totalChars : 0;
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

  private performRegexSearchReplace(content: string, search: string, replace: string): {
    content: string;
    replacements: number;
    linesChanged: number;
  } {
    let regex: RegExp;
    try {
      regex = new RegExp(search, 'g');
    } catch (e) {
      throw new ToolError(`Invalid regex pattern: ${search}`, 'VALIDATION_ERROR');
    }
    if (this.isBinaryContent(content)) {
      throw new ToolError('Cannot search-replace binary content', 'VALIDATION_ERROR');
    }
    const matches = content.match(regex);
    if (!matches) {
      throw new ToolError(`Regex pattern not found: ${search}`, 'VALIDATION_ERROR');
    }
    const newContent = content.replace(regex, replace);
    const originalLines = content.split('\n');
    const resultLines = newContent.split('\n');
    let linesChanged = 0;
    const minLines = Math.min(originalLines.length, resultLines.length);
    for (let i = 0; i < minLines; i++) {
      if (originalLines[i] !== resultLines[i]) {
        linesChanged++;
      }
    }
    linesChanged += Math.abs(resultLines.length - originalLines.length);
    return {
      content: newContent,
      replacements: matches.length,
      linesChanged
    };
  }

  /**
   * Get human-readable output for display formatting
   */
  getHumanReadableOutput(params: WriteParams, success: boolean, result?: any): string {
    if (!success) {
      let errorMsg = 'Unknown error';
      if (result instanceof Error) {
        errorMsg = result.message;
      } else if (typeof result === 'string' && result.trim()) {
        errorMsg = result;
      } else if (typeof result === 'object' && result !== null && result.message) {
        errorMsg = result.message;
      }
      return `\n${errorMsg}`;
    }

    const path = params.path;
    let context = path ? ` ${path}` : '';

    if (params.search && params.replace) {
      // Search-replace mode formatting
      const mode = params.searchRegex ? 'search-replace (regex)' : 'search-replace';
      if (typeof result === 'object' && result !== null) {
        const replacements = result.replacements || 0;
        const linesChanged = result.linesChanged || 0;
        return `${context}\n• ${replacements} replacements, ${linesChanged}L changed`;
      }
      return `${context} • search-replace completed`;
    } else if (params.content !== undefined) {
      // Content mode formatting
      if (typeof result === 'object' && result?.linesChanged) {
        return `${context}\n• ${result.linesChanged}L changed`;
      } else if (params.content) {
        const lines = params.content.split('\n').length;
        return `${context} • ${lines}L written`;
      }
      return `${context} • saved`;
    }

    return `${context} • completed`;
  }
}