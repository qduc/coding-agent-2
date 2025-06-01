interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
}

interface FileInfo {
  name: string;
  size: number;
  modified: Date;
}

export const apiService = {
  // Chat operations
  sendMessage: (content: string): Promise<ChatMessage> => {
    return Promise.resolve({
      id: 'stub-id',
      content,
      timestamp: new Date()
    });
  },

  getMessages: (): Promise<ChatMessage[]> => {
    return Promise.resolve([]);
  },

  // File system operations
  readFile: (path: string): Promise<string> => {
    return Promise.resolve('');
  },

  writeFile: (path: string, content: string): Promise<void> => {
    return Promise.resolve();
  },

  listFiles: (): Promise<FileInfo[]> => {
    return Promise.resolve([]);
  },

  // Configuration operations
  getConfig: (key: string): Promise<any> => {
    return Promise.resolve(null);
  },

  setConfig: (key: string, value: any): Promise<void> => {
    return Promise.resolve();
  }
};

export type ApiService = typeof apiService;
