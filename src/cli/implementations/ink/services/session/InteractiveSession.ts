import { InputSession } from './InputSession';

export interface InteractiveSessionCallbacks {
  onInput: (input: string) => Promise<void>;
  onEnd: () => void;
}

export class InteractiveSession extends InputSession {
  private callbacks?: InteractiveSessionCallbacks;

  setCallbacks(callbacks: InteractiveSessionCallbacks): void {
    this.callbacks = callbacks;
  }

  async handleInput(input: string): Promise<void> {
    if (!this.callbacks) {
      throw new Error('No callbacks set for interactive session');
    }

    if (this.isExitCommand(input)) {
      this.callbacks.onEnd();
      this.stop();
      return;
    }

    await this.callbacks.onInput(input);
  }

  endSession(): void {
    if (this.callbacks) {
      this.callbacks.onEnd();
    }
    this.stop();
  }

  private isExitCommand(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return normalized === '/exit' || 
           normalized === '/quit' || 
           normalized === '/q' ||
           normalized === 'q' ||
           normalized === 'quit';
  }
}