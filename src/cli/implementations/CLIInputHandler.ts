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

  close() {
    this.rl.close();
  }

  // Handle SIGINT (Ctrl+C) gracefully
  setupInterruptHandler() {
    this.rl.on('SIGINT', () => {
      this.rl.question('Exit? (y/n) ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          process.exit(0);
        }
      });
    });
  }
}
