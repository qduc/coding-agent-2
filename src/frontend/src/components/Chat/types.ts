export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date; // Changed from string to Date
  status?: 'streaming' | 'error' | 'completed';
}

export interface ToolExecution {
  id: string;
  toolName: string;
  input?: any;
  output?: string;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  timestamp: Date; // Changed from string to Date
}
