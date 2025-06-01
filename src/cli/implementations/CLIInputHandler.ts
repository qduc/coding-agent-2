import * as readline from 'readline';
import { IInputHandler } from '../../shared/interfaces/IInputHandler';

export class CLIInputHandler implements IInputHandler {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async readInput(prompt?: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt || '> ', (answer) => {
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
}
