import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';
import { GlobTool, GlobMatch } from '../../shared/tools/glob';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../shared/tools/types';
import * as path from 'path';
import chalk from 'chalk';

// Component for handling user input
const InputComponent = ({ 
  onSubmit, 
  prompt = 'You (@ + TAB for files, q to quit): ',
  initialInput = '',
  fileCompletions = [],
  showCompletions = false,
  onExit,
  onTabCompletion
}: { 
  onSubmit: (input: string) => void;
  prompt?: string;
  initialInput?: string;
  fileCompletions?: string[];
  showCompletions?: boolean;
  onExit: () => void;
  onTabCompletion: (partialPath: string) => void;
}) => {
  const [input, setInput] = useState(initialInput);
  const [cursorPosition, setCursorPosition] = useState(initialInput.length);
  const { exit } = useApp();

  useInput((inputChar: string, key: any) => {
    if (key.return) {
      // Submit on Enter
      onSubmit(input);
      setInput('');
      setCursorPosition(0);
      return;
    }

    if (key.escape || (key.ctrl && inputChar === 'c')) {
      // Exit on Escape or Ctrl+C
      onExit();
      exit();
      return;
    }

    if (key.backspace || key.delete) {
      // Handle backspace
      if (cursorPosition > 0) {
        setInput((prev: string) => prev.substring(0, cursorPosition - 1) + prev.substring(cursorPosition));
        setCursorPosition((prev: number) => Math.max(0, prev - 1));
      }
      return;
    }

    if (key.leftArrow) {
      // Move cursor left
      setCursorPosition((prev: number) => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      // Move cursor right
      setCursorPosition((prev: number) => Math.min(input.length, prev + 1));
      return;
    }

    if (key.tab && input.includes('@')) {
      // Handle tab completion for files
      const lastAtIndex = input.lastIndexOf('@');
      const afterAt = input.substring(lastAtIndex + 1);
      const partialPath = afterAt.split(/\s/)[0]; // Get path until next space

      // Request file completions
      onTabCompletion(partialPath);

      if (fileCompletions.length > 0 && showCompletions) {
        // Use the first completion
        const beforeAt = input.substring(0, lastAtIndex + 1);

        // Replace the partial path with the completion
        const newInput = beforeAt + fileCompletions[0];
        setInput(newInput);
        setCursorPosition(newInput.length);
      }
      return;
    }

    // Regular input handling
    if (!key.ctrl && !key.meta && inputChar && inputChar.length === 1) {
      setInput((prev: string) => 
        prev.substring(0, cursorPosition) + inputChar + prev.substring(cursorPosition)
      );
      setCursorPosition((prev: number) => prev + 1);
    }
  });

  return (
    <>
      <Box>
        <Text color="green">{prompt}</Text>
        <Text>{input}</Text>
      </Box>
      {showCompletions && fileCompletions.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {fileCompletions.slice(0, 5).map((completion, index) => (
            <Text key={index} color="blue">{completion}</Text>
          ))}
        </Box>
      )}
    </>
  );
};

export class InkInputHandler implements IInputHandler {
  private globTool: GlobTool;
  private toolContext: ToolContext;
  private inputPromise: Promise<string> | null = null;
  private inputResolve: ((value: string) => void) | null = null;
  private fileCompletions: string[] = [];
  private showCompletions: boolean = false;
  private inkModule: any = null;
  private reactModule: any = null;

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
  }

  async readInput(prompt?: string): Promise<string> {
    this.inputPromise = new Promise<string>((resolve) => {
      this.inputResolve = resolve;
    });

    // Render the Ink component
    const { unmount } = render(
      <InputComponent 
        onSubmit={(input) => {
          if (this.inputResolve) {
            this.inputResolve(input);
            this.inputResolve = null;
          }
          unmount();
        }}
        prompt={prompt || 'You (@ + TAB for files, q to quit): '}
        fileCompletions={this.fileCompletions}
        showCompletions={this.showCompletions}
        onExit={() => {
          console.log('Exiting...');
          process.exit(0);
        }}
        onTabCompletion={async (partialPath) => {
          this.fileCompletions = await this.getFileCompletions(partialPath);
          this.showCompletions = this.fileCompletions.length > 0;
        }}
      />
    );

    const result = await this.inputPromise;
    this.inputPromise = null;

    // Handle quit commands
    if (result.trim().toLowerCase() === 'q' || 
        result.trim().toLowerCase() === 'quit') {
      console.log('Exiting...');
      process.exit(0);
    }

    return result;
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
    try {
      while (true) {
        const input = await this.readInput();
        if (this.isExitCommand(input)) {
          onEnd();
          break;
        }
        await onInput(input);
      }
    } catch (error) {
      console.error('Error in interactive mode:', error);
    }
  }

  private isExitCommand(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return normalized === '/exit' || 
           normalized === '/quit' || 
           normalized === '/q';
  }

  close() {
    // Clean up any resources
    process.removeAllListeners('SIGINT');
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
