import * as readline from 'readline';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';
import { GlobTool, GlobMatch } from '../../shared/tools/glob';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../shared/tools/types';

export class CLIInputHandler implements IInputHandler {
  private rl: readline.Interface;
  private globTool: GlobTool;
  private toolContext: ToolContext;

  constructor(execContext?: IToolExecutionContext) {
    // Convert IToolExecutionContext to ToolContext for the glob tool
    this.toolContext = {
      workingDirectory: execContext?.workingDirectory || process.cwd(),
      maxFileSize: 10 * 1024 * 1024,
      timeout: 5000,
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
    };
    
    this.globTool = new GlobTool(this.toolContext);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completer.bind(this)
    });
  }

  async readInput(prompt?: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt || 'You (@ + TAB for files): ', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async readCommand(): Promise<{command: string; args: string[]}> {
    const input = await this.readInput();
    const parts = input.trim().split(/\s+/);
    return {
      command: parts[0] || '',
      args: parts.slice(1)
    };
  }

  async handleInteractiveMode(
    onInput: (input: string) => Promise<void>,
    onEnd: () => void
  ): Promise<void> {
    this.setupInterruptHandler();
    try {
      while (true) {
        const input = await this.readInput();
        if (input.toLowerCase() === 'exit') {
          onEnd();
          break;
        }
        await onInput(input);
      }
    } finally {
      this.close();
    }
  }

  close() {
    this.rl.close();
  }

  private setupInterruptHandler() {
    this.rl.on('SIGINT', () => {
      this.rl.question('Exit? (y/n) ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          process.exit(0);
        }
      });
    });
  }

  /**
   * Tab completion handler for file references with @
   */
  private async completer(line: string): Promise<[string[], string]> {
    try {
      // Only provide completions after @ symbol
      const lastAtIndex = line.lastIndexOf('@');
      if (lastAtIndex === -1) {
        return [[], line];
      }

      // Extract the partial path after @
      const beforeAt = line.substring(0, lastAtIndex + 1);
      const afterAt = line.substring(lastAtIndex + 1);
      const partialPath = afterAt.split(/\s/)[0]; // Get path until next space

      // Get file completions
      const completions = await this.getFileCompletions(partialPath);
      
      // Return completions with the full line context
      const hits = completions.map(completion => beforeAt + completion);
      return [hits, line];

    } catch (error) {
      // Return no completions on error
      return [[], line];
    }
  }

  /**
   * Get file completions based on partial path
   */
  private async getFileCompletions(partialPath: string): Promise<string[]> {
    try {
      // Determine search pattern based on partial path
      let searchPattern: string;
      let searchDir: string;

      if (partialPath === '') {
        // No partial path - show common file types in current directory
        searchPattern = '*';
        searchDir = this.toolContext.workingDirectory;
      } else if (partialPath.endsWith('/')) {
        // Directory path - list contents
        searchPattern = '*';
        searchDir = path.resolve(this.toolContext.workingDirectory, partialPath);
      } else {
        // Partial filename - find matching files
        const dirname = path.dirname(partialPath);
        const basename = path.basename(partialPath);
        searchDir = dirname === '.' ? this.toolContext.workingDirectory : 
                   path.resolve(this.toolContext.workingDirectory, dirname);
        searchPattern = basename === '' ? '*' : `${basename}*`;
      }

      // Use glob tool to find matches
      const result = await this.globTool.execute({
        pattern: searchPattern,
        cwd: searchDir,
        includeHidden: false,
        maxDepth: 1, // Only current directory level for completion
        caseSensitive: false
      });

      if (!result.success || !result.output) {
        return [];
      }

      // Filter and format completions
      const matches = result.output.matches
        .filter((match: GlobMatch) => this.isRelevantFile(match))
        .sort((a: GlobMatch, b: GlobMatch) => {
          // Sort directories first, then files
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 20); // Limit to 20 completions

      // Format completions with relative paths
      return matches.map((match: GlobMatch) => {
        const relativePath = path.relative(this.toolContext.workingDirectory, match.path);
        const formattedPath = relativePath || match.name;
        
        // Add trailing slash for directories
        if (match.type === 'directory') {
          return formattedPath + '/';
        }
        
        return formattedPath;
      });

    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a file is relevant for completion
   */
  private isRelevantFile(match: GlobMatch): boolean {
    // Skip hidden files and irrelevant extensions
    if (match.hidden) return false;
    
    // Common code file extensions
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.sass', '.html', '.vue', '.svelte', '.php',
      '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.cs', '.vb',
      '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg'
    ];
    
    // Common document extensions
    const docExtensions = [
      '.md', '.txt', '.rst', '.pdf', '.doc', '.docx'
    ];
    
    // Always include directories
    if (match.type === 'directory') return true;
    
    // Include files with relevant extensions
    const ext = path.extname(match.name).toLowerCase();
    return codeExtensions.includes(ext) || docExtensions.includes(ext) || ext === '';
  }
}
