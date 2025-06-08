import { IToolExecutionContext } from '../../../../shared/interfaces/IToolExecutionContext';
import { ToolContext } from '../../../../shared/tools/types';
import { CompletionManager } from './completion/CompletionManager';
import { FileCompletionProvider } from './completion/FileCompletionProvider';
import { CommandCompletionProvider } from './completion/CommandCompletionProvider';
import { ClipboardManager } from './clipboard/ClipboardManager';
import { InputSession } from './session/InputSession';
import { InteractiveSession } from './session/InteractiveSession';
import { SessionConfig } from '../types';

export class InkServiceFactory {
  private toolContext: ToolContext;
  private sessionConfig: SessionConfig;

  constructor(execContext?: IToolExecutionContext) {
    this.toolContext = {
      workingDirectory: execContext?.workingDirectory || process.cwd(),
      maxFileSize: 10 * 1024 * 1024,
      timeout: 5000,
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
    };

    this.sessionConfig = {
      workingDirectory: this.toolContext.workingDirectory,
      maxFileSize: this.toolContext.maxFileSize,
      timeout: this.toolContext.timeout,
      allowHidden: this.toolContext.allowHidden,
      allowedExtensions: this.toolContext.allowedExtensions,
      blockedPaths: this.toolContext.blockedPaths,
    };
  }

  createCompletionManager(): CompletionManager {
    const manager = new CompletionManager();
    
    // Add completion providers
    manager.addProvider(new FileCompletionProvider(this.toolContext));
    manager.addProvider(new CommandCompletionProvider());
    
    return manager;
  }

  createClipboardManager(): ClipboardManager {
    return new ClipboardManager();
  }

  createInputSession(): InputSession {
    return new InputSession(this.sessionConfig);
  }

  createInteractiveSession(): InteractiveSession {
    return new InteractiveSession(this.sessionConfig);
  }

  getToolContext(): ToolContext {
    return { ...this.toolContext };
  }

  getSessionConfig(): SessionConfig {
    return { ...this.sessionConfig };
  }

  updateWorkingDirectory(directory: string): void {
    this.toolContext.workingDirectory = directory;
    this.sessionConfig.workingDirectory = directory;
  }
}