// Using dynamic import for inquirer since it's an ESM module
let inquirer: any = null;
import * as fs from 'fs-extra';
import * as path from 'path';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';
import { GlobTool, GlobMatch } from '../../shared/tools/glob';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../shared/tools/types';

export class CommanderInputHandler implements IInputHandler {
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
  }

  async readInput(prompt?: string): Promise<string> {
    try {
      // Dynamically import inquirer if not already loaded
      if (!inquirer) {
        inquirer = await import('inquirer');
      }

      const { input } = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'input',
          message: prompt || 'You (q to quit): ',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Please enter a message or type "q" to quit.';
            }
            return true;
          }
        }
      ]);

      const trimmedInput = input.trim();

      // Handle quit commands
      if (trimmedInput.toLowerCase() === 'q' || 
          trimmedInput.toLowerCase() === 'quit') {
        console.log('Exiting...');
        process.exit(0);
      }

      return trimmedInput;
    } catch (error) {
      // Handle Ctrl+C or other interruptions
      console.log('\nExiting...');
      process.exit(0);
    }
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
    process.removeAllListeners('SIGINT');
  }
}
