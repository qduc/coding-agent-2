import { SessionConfig } from '../../types';

export class InputSession {
  private config: SessionConfig;
  private isActive: boolean = false;

  constructor(config: SessionConfig) {
    this.config = config;
  }

  start(): void {
    this.isActive = true;
  }

  stop(): void {
    this.isActive = false;
  }

  isSessionActive(): boolean {
    return this.isActive;
  }

  getConfig(): SessionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getWorkingDirectory(): string {
    return this.config.workingDirectory;
  }

  setWorkingDirectory(directory: string): void {
    this.config.workingDirectory = directory;
  }
}