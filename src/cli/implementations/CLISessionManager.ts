import { ISessionManager, Message } from '../../shared/interfaces/ISessionManager';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';

export class CLISessionManager implements ISessionManager {
  sessionId: string;
  conversationHistory: Message[] = [];
  private persistencePath: string;

  constructor(persistenceDir?: string) {
    this.sessionId = uuidv4();
    this.persistencePath = path.join(
      persistenceDir || path.join(process.cwd(), '.sessions'),
      `${this.sessionId}.json`
    );
  }

  async loadSession(): Promise<void> {
    try {
      if (await fs.pathExists(this.persistencePath)) {
        const data = await fs.readJson(this.persistencePath);
        this.conversationHistory = data.conversationHistory || [];
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async saveSession(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.persistencePath));
      await fs.writeJson(this.persistencePath, {
        sessionId: this.sessionId,
        conversationHistory: this.conversationHistory
      });
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }

  addMessage(message: Message): void {
    this.conversationHistory.push(message);
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}
