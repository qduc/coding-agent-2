import * as path from 'path';
import { CompletionProvider, CompletionItem, CompletionType } from './CompletionProvider';
import { GlobTool, GlobMatch } from '../../../../../shared/tools/glob';
import { ToolContext } from '../../../../../shared/tools/types';
import { FuzzyMatcher } from '../../utils/FuzzyMatcher';

export class FileCompletionProvider implements CompletionProvider {
  private globTool: GlobTool;
  private toolContext: ToolContext;

  constructor(toolContext: ToolContext) {
    this.toolContext = toolContext;
    this.globTool = new GlobTool(toolContext);
  }

  async getCompletions(partial: string): Promise<CompletionItem[]> {
    try {
      const allFiles = await this.getAllRelevantFiles();

      if (partial === '') {
        return allFiles.slice(0, 20).map(file => ({
          value: file,
          type: 'file' as CompletionType,
        }));
      }

      const filteredFiles = FuzzyMatcher.filter(allFiles, partial);
      return filteredFiles.slice(0, 20).map(file => ({
        value: file,
        type: 'file' as CompletionType,
      }));
    } catch (error) {
      return [];
    }
  }

  canHandle(input: string, cursorPosition: number): boolean {
    const lastAtIndex = input.lastIndexOf('@');
    const lastSlashIndex = input.lastIndexOf('/');

    // Check for file completion after @
    if (lastAtIndex === -1 || lastAtIndex >= cursorPosition) {
      return false;
    }
    
    // Only show completions if we're actively typing after @
    // (not just positioned after a completed file path)
    const afterAt = input.substring(lastAtIndex + 1, cursorPosition);
    const spaceIndex = afterAt.indexOf(' ');
    
    // If there's a space in the file path portion, don't show completions
    // (this means we're past the file path)
    return spaceIndex === -1 && (lastSlashIndex === -1 || lastAtIndex > lastSlashIndex);
  }

  getType(): CompletionType {
    return 'file';
  }

  private async getAllRelevantFiles(): Promise<string[]> {
    try {
      const result = await this.globTool.execute({
        pattern: '**/*',
        cwd: this.toolContext.workingDirectory,
        includeHidden: false,
        maxDepth: 3,
        caseSensitive: false
      });

      if (!result.success || !result.output) {
        return [];
      }

      return result.output.matches
        .filter((match: GlobMatch) => this.isRelevantFile(match))
        .map((match: GlobMatch) => {
          const relativePath = path.relative(this.toolContext.workingDirectory, match.path);
          return match.type === 'directory' ? relativePath + '/' : relativePath;
        })
        .sort()
        .slice(0, 100);
    } catch (error) {
      return [];
    }
  }

  private isRelevantFile(match: GlobMatch): boolean {
    if (match.hidden) return false;

    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.sass', '.html', '.vue', '.svelte', '.php',
      '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.cs', '.vb',
      '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg'
    ];

    const docExtensions = [
      '.md', '.txt', '.rst', '.pdf', '.doc', '.docx'
    ];

    if (match.type === 'directory') return true;

    const ext = path.extname(match.name).toLowerCase();
    return codeExtensions.includes(ext) || docExtensions.includes(ext) || ext === '';
  }
}