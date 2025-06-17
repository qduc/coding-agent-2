import React from 'react';
import { render } from 'ink';
import { IInputHandler } from '../../../shared/interfaces/IInputHandler';
import { IToolExecutionContext } from '../../../shared/interfaces/IToolExecutionContext';
import { ChatApp } from './components/ChatApp';
import { InkServiceFactory } from './services/InkServiceFactory';
import { CompletionManager } from './services/completion/CompletionManager';
import { ClipboardManager } from './services/clipboard/ClipboardManager';
import { Agent } from '../../../shared/core/agent';

export class InkChatHandler implements IInputHandler {
  private serviceFactory: InkServiceFactory;
  private completionManager: CompletionManager;
  private clipboardManager: ClipboardManager;
  private unmountFunction: (() => void) | null = null;

  constructor(execContext?: IToolExecutionContext) {
    this.serviceFactory = new InkServiceFactory(execContext);
    this.completionManager = this.serviceFactory.createCompletionManager();
    this.clipboardManager = this.serviceFactory.createClipboardManager();
  }

  async readInput(prompt?: string): Promise<string> {
    throw new Error('InkChatHandler only supports interactive mode. Use readCommand() or handleInteractiveMode().');
  }

  async readCommand(): Promise<{command: string; args: string[]}> {
    throw new Error('InkChatHandler only supports interactive mode. Use handleInteractiveMode().');
  }

  async handleInteractiveMode(
    onInput: (input: string) => Promise<void>,
    onEnd: () => void
  ): Promise<void> {
    // This method signature matches the interface, but InkChatHandler uses a different approach
    // We'll throw an error to indicate this method shouldn't be used
    throw new Error('InkChatHandler uses handleInteractiveChatMode instead of handleInteractiveMode');
  }

  async handleInteractiveChatMode(
    agent: Agent,
    options: {
      verbose?: boolean;
    } = {}
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const handleExit = () => {
        if (this.unmountFunction) {
          this.unmountFunction();
          this.unmountFunction = null;
        }
        resolve();
      };

      const { unmount } = render(
        React.createElement(ChatApp, {
          agent,
          completionManager: this.completionManager,
          clipboardManager: this.clipboardManager,
          options,
          onExit: handleExit,
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
    process.removeAllListeners('SIGINT');
  }
}