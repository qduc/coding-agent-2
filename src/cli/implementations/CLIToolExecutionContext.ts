import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
import fs from 'fs-extra';
import path from 'path';

export class CLIToolExecutionContext implements IToolExecutionContext {
  permissions = {
    fileSystem: true,
    network: true,
    shell: true
  };

  setContext(context: Partial<Omit<IToolExecutionContext, 'setContext' | 'getContext'>>): void {
    Object.assign(this, context);
  }

  getContext(): Omit<IToolExecutionContext, 'setContext' | 'getContext'> {
    return {
      workingDirectory: this.workingDirectory,
      environment: this.environment,
      permissions: this.permissions
    };
  }

  validateAccess(operation: 'fileSystem' | 'network' | 'shell'): void {
    if (!this.permissions[operation]) {
      throw new Error(`Permission denied for ${operation} operation`);
    }
  }
  workingDirectory: string;
  environment: Record<string, unknown>;
  maxFileSize: number;
  timeout: number;

  constructor(options?: Partial<IToolExecutionContext>) {
    this.workingDirectory = options?.workingDirectory || process.cwd();
    this.environment = { ...process.env, ...options?.environment };
    this.maxFileSize = options?.maxFileSize || 1024 * 1024 * 5; // 5MB default
    this.timeout = options?.timeout || 30000; // 30s default
  }

  async validatePath(filePath: string): Promise<boolean> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.workingDirectory, filePath);

    try {
      await fs.access(absolutePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workingDirectory, filePath);

    const stats = await fs.stat(absolutePath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large (max ${this.maxFileSize} bytes)`);
    }

    return fs.readFile(absolutePath, 'utf-8');
  }
}
