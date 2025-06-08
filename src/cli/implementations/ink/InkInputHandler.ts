import React from 'react';
import { render } from 'ink';
import { IInputHandler } from '../../../shared/interfaces/IInputHandler';
import { IToolExecutionContext } from '../../../shared/interfaces/IToolExecutionContext';
import { InputComponent } from './components/InputComponent';
import { InkServiceFactory } from './services/InkServiceFactory';
import { CompletionManager } from './services/completion/CompletionManager';
import { ClipboardManager } from './services/clipboard/ClipboardManager';
import { InputSession } from './services/session/InputSession';
import { InteractiveSession } from './services/session/InteractiveSession';
import { InputCallbacks, InputOptions } from './types';

export class InkInputHandler implements IInputHandler {
  private serviceFactory: InkServiceFactory;
  private completionManager: CompletionManager;
  private clipboardManager: ClipboardManager;
  private inputSession: InputSession;
  private interactiveSession: InteractiveSession;

  private inputPromise: Promise<string> | null = null;
  private inputResolve: ((value: string) => void) | null = null;
  private unmountFunction: (() => void) | null = null;

  constructor(execContext?: IToolExecutionContext) {
    this.serviceFactory = new InkServiceFactory(execContext);
    this.completionManager = this.serviceFactory.createCompletionManager();
    this.clipboardManager = this.serviceFactory.createClipboardManager();
    this.inputSession = this.serviceFactory.createInputSession();
    this.interactiveSession = this.serviceFactory.createInteractiveSession();
  }

  async readInput(prompt?: string): Promise<string> {
    this.inputPromise = new Promise<string>((resolve) => {
      this.inputResolve = resolve;
    });

    const callbacks: InputCallbacks = {
      onSubmit: (input: string) => {
        if (this.inputResolve) {
          this.inputResolve(input);
          this.inputResolve = null;
        }
        if (this.unmountFunction) {
          this.unmountFunction();
          this.unmountFunction = null;
        }
      },
      onExit: () => {
        console.log('Exiting...');
        process.exit(0);
      }
    };

    const options: InputOptions = {
      prompt: prompt || 'Enter your message (Enter to send, Esc to cancel):',
      initialInput: '',
    };

    if (!this.inputSession.isSessionActive()) {
      const { unmount } = render(
        React.createElement(InputComponent, {
          callbacks,
          options,
          completionManager: this.completionManager,
          clipboardManager: this.clipboardManager,
        })
      );
      this.unmountFunction = unmount;
    }

    const result = await this.inputPromise;
    this.inputPromise = null;

    // Handle quit commands
    if (this.isQuitCommand(result)) {
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
    this.interactiveSession.start();
    this.interactiveSession.setCallbacks({ onInput, onEnd });

    try {
      const callbacks: InputCallbacks = {
        onSubmit: async (input: string) => {
          try {
            await this.interactiveSession.handleInput(input);

            // Re-render for next input if session is still active
            if (this.interactiveSession.isSessionActive()) {
              await this.renderInteractiveInput();
            }
          } catch (error) {
            console.error('Error in interactive mode:', error);
            this.interactiveSession.endSession();
          }
        },
        onExit: () => {
          this.interactiveSession.endSession();
        }
      };

      await this.renderInteractiveInput(callbacks);

    } catch (error) {
      console.error('Error in interactive mode:', error);
    } finally {
      this.cleanup();
    }
  }

  private async renderInteractiveInput(callbacks?: InputCallbacks): Promise<void> {
    if (!callbacks) {
      // Default callbacks for re-rendering
      callbacks = {
        onSubmit: async (input: string) => {
          await this.interactiveSession.handleInput(input);
          if (this.interactiveSession.isSessionActive()) {
            await this.renderInteractiveInput();
          }
        },
        onExit: () => {
          this.interactiveSession.endSession();
        }
      };
    }

    return new Promise<void>((resolve) => {
      const options: InputOptions = {
        prompt: '💬 Your Message (Enter to send, Enter again for multi-line):',
      };

      const { unmount } = render(
        React.createElement(InputComponent, {
          callbacks: {
            ...callbacks,
            onSubmit: (input: string) => {
              unmount();
              callbacks!.onSubmit(input);
              resolve();
            },
            onExit: () => {
              unmount();
              callbacks!.onExit();
              resolve();
            }
          },
          options,
          completionManager: this.completionManager,
          clipboardManager: this.clipboardManager,
        })
      );

      this.unmountFunction = unmount;
    });
  }

  close(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.unmountFunction) {
      this.unmountFunction();
      this.unmountFunction = null;
    }
    this.inputSession.stop();
    this.interactiveSession.stop();
    process.removeAllListeners('SIGINT');
  }

  private isQuitCommand(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return normalized === 'q' || normalized === 'quit';
  }
}