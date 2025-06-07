import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';
import { GlobTool, GlobMatch } from '../../shared/tools/glob';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../shared/tools/types';
import { BoxRenderer } from '../../shared/utils/boxRenderer';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

// Component for handling user input
const InputComponent = ({ 
  onSubmit, 
  prompt = 'Enter your message (Ctrl+Enter to send, Esc to cancel):',
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
  const [isMultilineMode, setIsMultilineMode] = useState(false);
  const [pasteIndicator, setPasteIndicator] = useState(false);
  const { exit } = useApp();

  // Function to get clipboard content
  const getClipboardContent = useCallback((): string => {
    try {
      // Try different clipboard commands based on platform
      let clipboardContent = '';
      
      if (process.platform === 'darwin') {
        // macOS
        clipboardContent = execSync('pbpaste', { encoding: 'utf8' });
      } else if (process.platform === 'linux') {
        // Linux - try xclip first, then xsel
        try {
          clipboardContent = execSync('xclip -selection clipboard -o', { encoding: 'utf8' });
        } catch {
          try {
            clipboardContent = execSync('xsel --clipboard --output', { encoding: 'utf8' });
          } catch {
            // Fallback: try wl-paste for Wayland
            clipboardContent = execSync('wl-paste', { encoding: 'utf8' });
          }
        }
      } else if (process.platform === 'win32') {
        // Windows
        clipboardContent = execSync('powershell.exe -Command "Get-Clipboard"', { encoding: 'utf8' });
      }
      
      return clipboardContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    } catch (error) {
      // Clipboard access failed - could show a warning
      return '';
    }
  }, []);

  // Handle paste operation
  const handlePaste = useCallback(() => {
    const clipboardContent = getClipboardContent();
    if (clipboardContent) {
      // Insert clipboard content at cursor position
      const newInput = input.substring(0, cursorPosition) + clipboardContent + input.substring(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition + clipboardContent.length);
      
      // Show paste indicator briefly
      setPasteIndicator(true);
      setTimeout(() => setPasteIndicator(false), 1000);
      
      // If pasted content has newlines, switch to multiline mode
      if (clipboardContent.includes('\n')) {
        setIsMultilineMode(true);
      }
    }
  }, [input, cursorPosition, getClipboardContent]);

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
      if (key.ctrl) {
        // Ctrl+Enter: Submit message
        onSubmit(input);
        setInput('');
        setCursorPosition(0);
        setShowCompletions(false);
        setIsMultilineMode(false);
        return;
      }
      
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
      
      // If we have input and not in multiline mode, send it
      if (input.trim() && !isMultilineMode) {
        onSubmit(input);
        setInput('');
        setCursorPosition(0);
        setShowCompletions(false);
        setIsMultilineMode(false);
        return;
      }
      
      // Regular Enter: Add newline for multi-line input
      const newInput = input.substring(0, cursorPosition) + '\n' + input.substring(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition + 1);
      setIsMultilineMode(true);
      return;
    }

    if (key.escape || (key.ctrl && inputChar === 'c')) {
      // Exit on Escape or Ctrl+C
      onExit();
      exit();
      return;
    }

    if (key.ctrl && inputChar === 'v') {
      // Handle paste operation
      handlePaste();
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

  // Create the input box display
  const inputBoxTitle = pasteIndicator 
    ? '📋 Pasted! (Enter or Ctrl+Enter to send)'
    : isMultilineMode 
      ? '💬 Multi-line Message (Ctrl+Enter to send)' 
      : '💬 Your Message (Enter to send, Enter again for multi-line)';
  
  const inputBox = BoxRenderer.createInputBox(
    inputBoxTitle,
    input,
    cursorPosition,
    {
      maxWidth: Math.min(80, (process.stdout.columns || 80) - 4),
      minHeight: isMultilineMode ? 5 : 3,
      placeholder: input === '' ? 'Type your message here... (@ for files, / for commands, Ctrl+V to paste)' : undefined,
      showCursor: true
    }
  );

  const helpText = chalk.gray.dim(
    pasteIndicator
      ? '📋 Content pasted successfully! • Enter to send • Esc to cancel'
      : isMultilineMode 
        ? '💡 Tip: Use @ for files, / for commands • Ctrl+V to paste • Ctrl+Enter to send • Esc to cancel'
        : '💡 Tip: Use @ for files, / for commands • Ctrl+V to paste • Enter to send (Enter again for multi-line) • Esc to cancel'
  );

  return (
    <>
      <Box flexDirection="column">
        <Text>{inputBox}</Text>
        <Text>{helpText}</Text>
      </Box>
      {showCompletions && completions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>
            {completionType === 'file' ? '📁 File Completions:' : '⚡ Command Completions:'}
          </Text>
          <Box flexDirection="column" marginLeft={2}>
            {completions.slice(0, 8).map((completion, index) => (
              <Text 
                key={index} 
                color={index === selectedCompletion ? "black" : "blue"}
                backgroundColor={index === selectedCompletion ? "cyan" : undefined}
              >
                {index === selectedCompletion ? '▶ ' : '  '}{completion}
              </Text>
            ))}
            {completions.length > 8 && (
              <Text color="gray">  ... and {completions.length - 8} more (↑/↓ to navigate)</Text>
            )}
          </Box>
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
  private unmountFunction: (() => void) | null = null;
  private isInteractiveMode: boolean = false;
  
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

    // Only render if not in interactive mode (for single-use inputs)
    if (!this.isInteractiveMode) {
      const { unmount } = render(
        <InputComponent 
          onSubmit={(input) => {
            if (this.inputResolve) {
              this.inputResolve(input);
              this.inputResolve = null;
            }
            unmount();
          }}
          prompt={prompt || 'Enter your message (Enter to send, Esc to cancel):'}
          onExit={() => {
            console.log('Exiting...');
            process.exit(0);
          }}
          getFileCompletions={this.getFileCompletions.bind(this)}
          getCommandCompletions={this.getCommandCompletions.bind(this)}
        />
      );
    }

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
    this.isInteractiveMode = true;
    
    try {
      // Render the persistent input component once
      const { unmount } = render(
        <InputComponent 
          onSubmit={async (input) => {
            if (this.isExitCommand(input)) {
              onEnd();
              unmount();
              return;
            }
            
            // Unmount Ink to allow console output during processing
            unmount();
            
            // Resolve the current input promise if waiting
            if (this.inputResolve) {
              this.inputResolve(input);
              this.inputResolve = null;
            }
          }}
          prompt='💬 Your Message (Enter to send, Enter again for multi-line):'
          onExit={() => {
            onEnd();
            unmount();
          }}
          getFileCompletions={this.getFileCompletions.bind(this)}
          getCommandCompletions={this.getCommandCompletions.bind(this)}
        />
      );
      
      this.unmountFunction = unmount;

      // Handle the interactive loop
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
    } finally {
      this.isInteractiveMode = false;
      if (this.unmountFunction) {
        this.unmountFunction();
        this.unmountFunction = null;
      }
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
    if (this.unmountFunction) {
      this.unmountFunction();
      this.unmountFunction = null;
    }
    this.isInteractiveMode = false;
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
