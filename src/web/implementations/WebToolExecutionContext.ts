import { IToolExecutionContext } from '../../shared/interfaces';
import { WebOutputHandler } from './WebOutputHandler';

/**
 * Web-based tool execution context
 */
export class WebToolExecutionContext implements IToolExecutionContext {
  public readonly workingDirectory: string;
  public environment: Record<string, unknown>;
  public permissions: {
    fileSystem: boolean;
    network: boolean;
    shell: boolean;
  };

  constructor(
    private outputHandler: WebOutputHandler,
    workingDirectory: string = process.cwd(),
    permissions?: { fileSystem?: boolean; network?: boolean; shell?: boolean }
  ) {
    this.workingDirectory = workingDirectory;
    this.environment = process.env as Record<string, unknown>;
    this.permissions = {
      fileSystem: permissions?.fileSystem ?? true,
      network: permissions?.network ?? true,
      shell: permissions?.shell ?? true
    };
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.workingDirectory;
  }

  /**
   * Log tool execution message
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    switch (level) {
      case 'error':
        this.outputHandler.writeError(message);
        break;
      case 'warn':
        this.outputHandler.writeOutput(`⚠️ ${message}`, { color: 'warning' });
        break;
      default:
        this.outputHandler.writeOutput(`ℹ️ ${message}`, { color: 'secondary' });
        break;
    }
  }

  /**
   * Report tool execution progress
   */
  reportProgress(message: string): void {
    this.outputHandler.sendToolStatus('current', 'progress', message);
  }

  /**
   * Get environment variables
   */
  getEnvironment(): Record<string, string> {
    return process.env as Record<string, string>;
  }

  /**
   * Check if running in interactive mode (always true for web)
   */
  isInteractive(): boolean {
    return true;
  }

  /**
   * Get platform information
   */
  getPlatform(): { os: string; arch: string; node: string } {
    return {
      os: process.platform,
      arch: process.arch,
      node: process.version
    };
  }

  /**
   * Create a child context for nested tool execution
   */
  createChildContext(workingDirectory?: string): IToolExecutionContext {
    return new WebToolExecutionContext(
      this.outputHandler,
      workingDirectory || this.workingDirectory,
      this.permissions
    );
  }

  /**
   * Update execution context
   */
  setContext(context: Partial<Omit<IToolExecutionContext, 'setContext' | 'getContext'>>): void {
    if (context.environment) {
      this.environment = { ...this.environment, ...context.environment };
    }
    if (context.permissions) {
      this.permissions = { ...this.permissions, ...context.permissions };
    }
  }

  /**
   * Get current context
   */
  getContext(): Omit<IToolExecutionContext, 'setContext' | 'getContext'> {
    return {
      workingDirectory: this.workingDirectory,
      environment: { ...this.environment },
      permissions: { ...this.permissions },
      validateAccess: this.validateAccess.bind(this)
    };
  }

  /**
   * Validate access for a specific tool operation
   */
  validateAccess(operation: 'fileSystem' | 'network' | 'shell'): void {
    if (!this.permissions[operation]) {
      throw new Error(`Access denied: ${operation} operations are not permitted in this context`);
    }
  }
}
