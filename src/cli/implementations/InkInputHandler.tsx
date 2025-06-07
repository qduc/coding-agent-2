import React, { useState, useEffect, useCallback } from 'react';
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
  prompt = 'You (@ for files, / for commands, q to quit): ',
  initialInput = '',
  onExit,
  getFileCompletions,
  getCommandCompletions
}: { 
  onSubmit: (input: string) => void;
  prompt?: string;
  initialInput?: string;
  onExit: () => void;
  getFileCompletions: (partialPath: string) => Promise<string[]>;
  getCommandCompletions: (partialCommand: string) => string[];
}) => {
  const [input, setInput] = useState(initialInput);
  const [cursorPosition, setCursorPosition] = useState(initialInput.length);
  const [completions, setCompletions] = useState<string[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const [showCompletions, setShowCompletions] = useState(false);
  const [completionType, setCompletionType] = useState<'file' | 'command' | null>(null);
  const { exit } = useApp();

  // Update completions based on current input
  const updateCompletions = useCallback(async (currentInput: string) => {
    const lastAtIndex = currentInput.lastIndexOf('@');
    const lastSlashIndex = currentInput.lastIndexOf('/');
    
    // Check for file completion after @
    if (lastAtIndex !== -1 && (lastSlashIndex === -1 || lastAtIndex > lastSlashIndex)) {
      const afterAt = currentInput.substring(lastAtIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      const partialPath = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
      
      if (partialPath.length >= 0) { // Show completions immediately after @
        const fileCompletions = await getFileCompletions(partialPath);
        setCompletions(fileCompletions);
        setCompletionType('file');
        setShowCompletions(fileCompletions.length > 0);
        setSelectedCompletion(0);
        return;
      }
    }
    
    // Check for command completion after / at start of input
    if (currentInput.startsWith('/')) {
      const partialCommand = currentInput.substring(1);
      const commandCompletions = getCommandCompletions(partialCommand);
      setCompletions(commandCompletions);
      setCompletionType('command');
      setShowCompletions(commandCompletions.length > 0);
      setSelectedCompletion(0);
      return;
    }
    
    // Hide completions
    setShowCompletions(false);
    setCompletions([]);
    setCompletionType(null);
  }, [getFileCompletions, getCommandCompletions]);

  // Update completions when input changes
  useEffect(() => {
    updateCompletions(input);
  }, [input, updateCompletions]);

  useInput((inputChar: string, key: any) => {
    if (key.return) {
      if (showCompletions && completions.length > 0) {
        // Insert selected completion
        const selectedItem = completions[selectedCompletion];
        
        if (completionType === 'file') {
          const lastAtIndex = input.lastIndexOf('@');
          const afterAt = input.substring(lastAtIndex + 1);
          const spaceIndex = afterAt.indexOf(' ');
          const partialPath = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
          const beforeAt = input.substring(0, lastAtIndex + 1);
          const afterPartial = spaceIndex === -1 ? '' : afterAt.substring(spaceIndex);
          
          const newInput = beforeAt + selectedItem + afterPartial;
          setInput(newInput);
          setCursorPosition(beforeAt.length + selectedItem.length);
          setShowCompletions(false);
        } else if (completionType === 'command') {
          setInput('/' + selectedItem);
          setCursorPosition(selectedItem.length + 1);
          setShowCompletions(false);
        }
        return;
      }
      
      // Submit on Enter
      onSubmit(input);
      setInput('');
      setCursorPosition(0);
      setShowCompletions(false);
      return;
    }

    if (key.escape || (key.ctrl && inputChar === 'c')) {
      // Exit on Escape or Ctrl+C
      onExit();
      exit();
      return;
    }

    if (key.tab) {
      if (showCompletions && completions.length > 0) {
        // Insert first completion on Tab
        const selectedItem = completions[0];
        
        if (completionType === 'file') {
          const lastAtIndex = input.lastIndexOf('@');
          const afterAt = input.substring(lastAtIndex + 1);
          const spaceIndex = afterAt.indexOf(' ');
          const partialPath = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
          const beforeAt = input.substring(0, lastAtIndex + 1);
          const afterPartial = spaceIndex === -1 ? '' : afterAt.substring(spaceIndex);
          
          const newInput = beforeAt + selectedItem + afterPartial;
          setInput(newInput);
          setCursorPosition(beforeAt.length + selectedItem.length);
        } else if (completionType === 'command') {
          setInput('/' + selectedItem);
          setCursorPosition(selectedItem.length + 1);
        }
        setShowCompletions(false);
      }
      return;
    }

    if (key.upArrow && showCompletions) {
      // Navigate up in completions
      setSelectedCompletion((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow && showCompletions) {
      // Navigate down in completions
      setSelectedCompletion((prev) => Math.min(completions.length - 1, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      // Handle backspace
      if (cursorPosition > 0) {
        const newInput = input.substring(0, cursorPosition - 1) + input.substring(cursorPosition);
        setInput(newInput);
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

    // Regular input handling
    if (!key.ctrl && !key.meta && inputChar && inputChar.length === 1) {
      const newInput = input.substring(0, cursorPosition) + inputChar + input.substring(cursorPosition);
      setInput(newInput);
      setCursorPosition((prev: number) => prev + 1);
    }
  });

  return (
    <>
      <Box>
        <Text color="green">{prompt}</Text>
        <Text>{input}</Text>
      </Box>
      {showCompletions && completions.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          <Text color="gray">
            {completionType === 'file' ? '📁 Files:' : '⚡ Commands:'}
          </Text>
          {completions.slice(0, 8).map((completion, index) => (
            <Text 
              key={index} 
              color={index === selectedCompletion ? "cyan" : "blue"}
              backgroundColor={index === selectedCompletion ? "blue" : undefined}
            >
              {index === selectedCompletion ? '> ' : '  '}{completion}
            </Text>
          ))}
          {completions.length > 8 && (
            <Text color="gray">  ... and {completions.length - 8} more</Text>
          )}
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
        prompt={prompt || 'You (@ for files, / for commands, q to quit): '}
        onExit={() => {
          console.log('Exiting...');
          process.exit(0);
        }}
        getFileCompletions={this.getFileCompletions.bind(this)}
        getCommandCompletions={this.getCommandCompletions.bind(this)}
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
   * Get command completions for / commands
   */
  private getCommandCompletions(partialCommand: string): string[] {
    const availableCommands = [
      'help',
      'exit',
      'quit', 
      'q',
      'clear',
      'history',
      'status',
      'config'
    ];

    if (partialCommand === '') {
      return availableCommands;
    }

    return availableCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(partialCommand.toLowerCase())
    );
  }

  /**
   * Get file completions based on partial path
   */
  private async getFileCompletions(partialPath: string): Promise<string[]> {
    try {
      // Get all relevant files for fuzzy matching
      const allFiles = await this.getAllRelevantFiles();

      if (partialPath === '') {
        // No partial path - show recent/common files
        return allFiles.slice(0, 20);
      }

      // Perform fuzzy filtering
      const filteredFiles = this.filterFiles(allFiles, partialPath);
      return filteredFiles.slice(0, 20);

    } catch (error) {
      return [];
    }
  }

  /**
   * Get all relevant files for fuzzy matching
   */
  private async getAllRelevantFiles(): Promise<string[]> {
    try {
      const result = await this.globTool.execute({
        pattern: '**/*',
        cwd: this.toolContext.workingDirectory,
        includeHidden: false,
        maxDepth: 3, // Reasonable depth for dropdown
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
        .slice(0, 100); // Limit for performance
    } catch (error) {
      return [];
    }
  }

  /**
   * Filter files using fuzzy search (like fzf)
   */
  private filterFiles(files: string[], partial: string): string[] {
    if (!partial) return files.slice(0, 20);

    const matches = files
      .map(file => ({
        file,
        score: this.fuzzyScore(file, partial)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => {
        // Sort by score (higher is better), then by file length (shorter is better)
        if (b.score !== a.score) return b.score - a.score;
        return a.file.length - b.file.length;
      })
      .map(match => match.file);

    return matches;
  }

  /**
   * Calculate fuzzy match score (higher = better match)
   */
  private fuzzyScore(text: string, pattern: string): number {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    if (textLower === patternLower) return 1000; // Exact match
    if (textLower.startsWith(patternLower)) return 900; // Prefix match

    let score = 0;
    let textIndex = 0;
    let patternIndex = 0;
    let consecutiveMatches = 0;
    let firstMatchIndex = -1;

    while (textIndex < text.length && patternIndex < pattern.length) {
      const textChar = textLower[textIndex];
      const patternChar = patternLower[patternIndex];

      if (textChar === patternChar) {
        if (firstMatchIndex === -1) firstMatchIndex = textIndex;

        // Bonus for consecutive matches
        consecutiveMatches++;
        score += 10 + (consecutiveMatches * 5);

        // Bonus for matches at word boundaries
        if (textIndex === 0 || text[textIndex - 1] === '/' || text[textIndex - 1] === '.' || text[textIndex - 1] === '-' || text[textIndex - 1] === '_') {
          score += 15;
        }

        // Bonus for camelCase matches
        if (textIndex > 0 && text[textIndex].toUpperCase() === text[textIndex] && text[textIndex - 1].toLowerCase() === text[textIndex - 1]) {
          score += 10;
        }

        patternIndex++;
      } else {
        consecutiveMatches = 0;
      }

      textIndex++;
    }

    // Did we match all pattern characters?
    if (patternIndex < pattern.length) return 0;

    // Bonus for shorter files (more relevant)
    score += Math.max(0, 100 - text.length);

    // Bonus for earlier first match
    if (firstMatchIndex >= 0) {
      score += Math.max(0, 50 - firstMatchIndex);
    }

    return score;
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
