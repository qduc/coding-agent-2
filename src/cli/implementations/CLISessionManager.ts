import { ISessionManager, Message } from '../../shared/interfaces/ISessionManager';
import fs from 'fs-extra';
import * as path from 'path';
import { randomUUID } from 'crypto';

export class CLISessionManager implements ISessionManager {
  async startSession(sessionId?: string): Promise<void> {
    this.sessionId = sessionId || randomUUID();
    const dir = path.dirname(this.persistencePath);
    this.persistencePath = path.join(dir, `${this.sessionId}.json`);
    await this.loadSession();
  }

  async endSession(save?: boolean): Promise<void> {
    if (save) {
      await this.saveSession();
    }
    this.clearHistory();
  }

  async saveConversation(filePath?: string): Promise<void> {
    const savePath = filePath || this.persistencePath;
    await fs.ensureDir(path.dirname(savePath));
    await fs.writeJson(savePath, {
      sessionId: this.sessionId,
      conversationHistory: this.conversationHistory
    });
  }

  async loadConversation(sessionId: string): Promise<Message[]> {
    const loadPath = path.join(
      path.dirname(this.persistencePath),
      `${sessionId}.json`
    );
    if (await fs.pathExists(loadPath)) {
      const data = await fs.readJson(loadPath);
      return data.conversationHistory || [];
    }
    return [];
  }
  sessionId: string;
  conversationHistory: Message[] = [];
  private persistencePath: string;

  constructor(persistenceDir?: string) {
    this.sessionId = crypto.randomUUID();
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
