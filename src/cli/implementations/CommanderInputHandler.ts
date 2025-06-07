// Using dynamic import for inquirer since it's an ESM module
let inquirer: any = null;
import * as readline from 'readline';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';
import { GlobTool, GlobMatch } from '../../shared/tools/glob';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../shared/tools/types';

export class CommanderInputHandler implements IInputHandler {
  private globTool: GlobTool;
  private toolContext: ToolContext;
  private rl: readline.Interface | null = null;

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
    return new Promise((resolve) => {
      let currentInput = '';
      let showingFileList = false;
      let fileList: string[] = [];
      let filteredFiles: string[] = [];
      let selectedIndex = 0;
      let currentAtPosition = -1;
      let partialPath = '';

      // Create readline interface for character-by-character input
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });

      // Show initial prompt
      process.stdout.write(prompt || 'You (@ for files, q to quit): ');

      // Handle raw keyboard input
      const handleInput = async (key: string, data: any) => {
        const keyName = data.name;
        const ctrl = data.ctrl;
        const shift = data.shift;

        // Handle Ctrl+C
        if (ctrl && keyName === 'c') {
          console.log('\nExiting...');
          this.cleanup();
          process.exit(0);
        }

        // Handle Enter
        if (keyName === 'return') {
          if (showingFileList && filteredFiles.length > 0) {
            // Insert selected file
            const selectedFile = filteredFiles[selectedIndex];
            const beforeAt = currentInput.substring(0, currentAtPosition);
            const afterPartial = currentInput.substring(currentAtPosition + 1 + partialPath.length);
            currentInput = beforeAt + '@' + selectedFile + afterPartial;
            this.hideFileList();
            showingFileList = false;
            this.redrawInput(currentInput);
          } else {
            // Submit input
            this.cleanup();
            console.log();
            
            const trimmedInput = currentInput.trim();
            if (trimmedInput.toLowerCase() === 'q' || trimmedInput.toLowerCase() === 'quit') {
              console.log('Exiting...');
              process.exit(0);
            }
            
            resolve(trimmedInput);
          }
          return;
        }

        // Handle Tab (same as Enter for file selection)
        if (keyName === 'tab') {
          if (showingFileList && filteredFiles.length > 0) {
            const selectedFile = filteredFiles[selectedIndex];
            const beforeAt = currentInput.substring(0, currentAtPosition);
            const afterPartial = currentInput.substring(currentAtPosition + 1 + partialPath.length);
            currentInput = beforeAt + '@' + selectedFile + afterPartial;
            this.hideFileList();
            showingFileList = false;
            this.redrawInput(currentInput);
          }
          return;
        }

        // Handle arrow keys for file list navigation
        if (showingFileList) {
          if (keyName === 'up') {
            selectedIndex = Math.max(0, selectedIndex - 1);
            this.showFileList(filteredFiles, selectedIndex, partialPath);
            return;
          }
          if (keyName === 'down') {
            selectedIndex = Math.min(filteredFiles.length - 1, selectedIndex + 1);
            this.showFileList(filteredFiles, selectedIndex, partialPath);
            return;
          }
          if (keyName === 'escape') {
            this.hideFileList();
            showingFileList = false;
            return;
          }
        }

        // Handle backspace
        if (keyName === 'backspace') {
          if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1);
            this.redrawInput(currentInput);
            
            // Update file list if we're in @ mode
            if (showingFileList) {
              const result = this.parseAtContext(currentInput);
              if (result) {
                currentAtPosition = result.position;
                partialPath = result.partial;
                filteredFiles = this.filterFiles(fileList, partialPath);
                selectedIndex = 0;
                this.showFileList(filteredFiles, selectedIndex, partialPath);
              } else {
                this.hideFileList();
                showingFileList = false;
              }
            }
          }
          return;
        }

        // Handle regular character input
        if (key && key.length === 1 && !ctrl) {
          currentInput += key;
          this.redrawInput(currentInput);

          // Check if we just typed @
          if (key === '@') {
            fileList = await this.getAllRelevantFiles();
            filteredFiles = fileList;
            selectedIndex = 0;
            currentAtPosition = currentInput.length - 1;
            partialPath = '';
            showingFileList = true;
            this.showFileList(filteredFiles, selectedIndex, '');
          }
          // If we're already showing files, filter them
          else if (showingFileList) {
            const result = this.parseAtContext(currentInput);
            if (result) {
              currentAtPosition = result.position;
              partialPath = result.partial;
              filteredFiles = this.filterFiles(fileList, partialPath);
              selectedIndex = 0;
              this.showFileList(filteredFiles, selectedIndex, partialPath);
            } else {
              this.hideFileList();
              showingFileList = false;
            }
          }
        }
      };

      // Enable raw mode for character-by-character input
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (buffer) => {
        const key = buffer.toString();
        const data = this.parseKeyData(buffer);
        handleInput(key, data);
      });
    });
  }

  private cleanup() {
    if (this.rl) {
      this.rl.close();
    }
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('data');
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
      // Register SIGINT handler for graceful exit
      process.on('SIGINT', () => {
        console.log('\nExiting...');
        onEnd();
        process.exit(0);
      });

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
      this.close();
    }
  }

  private isExitCommand(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return normalized === 'exit' || 
           normalized === 'quit' || 
           normalized === 'q' || 
           normalized === ':q';
  }

  close() {
    // Clean up any resources
    this.cleanup();
    process.removeAllListeners('SIGINT');
  }

  /**
   * Parse keyboard input data to extract key information
   */
  private parseKeyData(buffer: Buffer): any {
    const str = buffer.toString();
    
    // Common key mappings
    if (str === '\r' || str === '\n') return { name: 'return' };
    if (str === '\t') return { name: 'tab' };
    if (str === '\x1b') return { name: 'escape' };
    if (str === '\x7f' || str === '\b') return { name: 'backspace' };
    if (str === '\x03') return { name: 'c', ctrl: true };
    
    // Arrow keys
    if (str === '\x1b[A') return { name: 'up' };
    if (str === '\x1b[B') return { name: 'down' };
    if (str === '\x1b[C') return { name: 'right' };
    if (str === '\x1b[D') return { name: 'left' };
    
    return { name: str, ctrl: false, shift: false };
  }

  /**
   * Parse @ context from current input
   */
  private parseAtContext(input: string): { position: number; partial: string } | null {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex === -1) return null;
    
    const afterAt = input.substring(lastAtIndex + 1);
    const spaceIndex = afterAt.indexOf(' ');
    const partial = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
    
    return { position: lastAtIndex, partial };
  }

  /**
   * Get all relevant files for the dropdown
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
        .slice(0, 50); // Limit for performance
    } catch (error) {
      return [];
    }
  }

  /**
   * Filter files using fuzzy search (like fzf)
   */
  private filterFiles(files: string[], partial: string): string[] {
    if (!partial) return files.slice(0, 10);
    
    const matches = files
      .map(file => ({
        file,
        score: this.fuzzyScore(file, partial),
        matchIndices: this.fuzzyMatchIndices(file, partial)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => {
        // Sort by score (higher is better), then by file length (shorter is better)
        if (b.score !== a.score) return b.score - a.score;
        return a.file.length - b.file.length;
      })
      .slice(0, 10) // Show max 10 files in dropdown
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
    
    // Bonus for matching file extension
    const patternExt = this.getFileExtension(pattern);
    const textExt = this.getFileExtension(text);
    if (patternExt && textExt && patternExt === textExt) {
      score += 25;
    }
    
    return score;
  }

  /**
   * Get indices of fuzzy matches for highlighting
   */
  private fuzzyMatchIndices(text: string, pattern: string): number[] {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();
    const indices: number[] = [];
    
    let textIndex = 0;
    let patternIndex = 0;
    
    while (textIndex < text.length && patternIndex < pattern.length) {
      if (textLower[textIndex] === patternLower[patternIndex]) {
        indices.push(textIndex);
        patternIndex++;
      }
      textIndex++;
    }
    
    return indices;
  }

  /**
   * Extract file extension from path
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    
    if (lastDot > lastSlash && lastDot > 0) {
      return filePath.substring(lastDot).toLowerCase();
    }
    
    return '';
  }

  /**
   * Show file list dropdown with fuzzy match highlighting
   */
  private showFileList(files: string[], selectedIndex: number, partial: string = '') {
    // Clear any existing file list
    this.hideFileList();
    
    if (files.length === 0) {
      process.stdout.write('\n  (no matching files)');
      return;
    }
    
    // Show up to 10 files
    const displayFiles = files.slice(0, 10);
    
    for (let i = 0; i < displayFiles.length; i++) {
      const file = displayFiles[i];
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? '> ' : '  ';
      
      // Highlight fuzzy matches
      const highlightedFile = this.highlightFuzzyMatches(file, partial, isSelected);
      
      process.stdout.write(`\n${prefix}${highlightedFile}`);
    }
  }

  /**
   * Highlight fuzzy matches in file name (like fzf)
   */
  private highlightFuzzyMatches(text: string, pattern: string, isSelected: boolean): string {
    if (!pattern) {
      const color = isSelected ? '\x1b[36m' : '\x1b[90m'; // Cyan for selected, gray for others
      const reset = '\x1b[0m';
      return `${color}${text}${reset}`;
    }
    
    const matchIndices = this.fuzzyMatchIndices(text, pattern);
    const baseColor = isSelected ? '\x1b[36m' : '\x1b[90m'; // Cyan for selected, gray for others
    const highlightColor = isSelected ? '\x1b[1;93m' : '\x1b[1;33m'; // Bright yellow for matches
    const reset = '\x1b[0m';
    
    let result = baseColor;
    let lastIndex = 0;
    
    for (const matchIndex of matchIndices) {
      // Add text before match
      result += text.substring(lastIndex, matchIndex);
      // Add highlighted match character
      result += highlightColor + text[matchIndex] + baseColor;
      lastIndex = matchIndex + 1;
    }
    
    // Add remaining text
    result += text.substring(lastIndex) + reset;
    
    return result;
  }

  /**
   * Hide file list dropdown
   */
  private hideFileList() {
    // Move cursor up and clear lines (this is a simplified approach)
    // In a real implementation, you'd track how many lines were written
    for (let i = 0; i < 12; i++) {
      process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
    }
  }

  /**
   * Redraw the current input line
   */
  private redrawInput(input: string) {
    // Clear current line and redraw
    process.stdout.write('\r\x1b[2K');
    process.stdout.write('You (@ for files, q to quit): ' + input);
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
