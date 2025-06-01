// Backend chat types - independent of frontend components

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    toolCalls?: ToolCall[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  input: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface ChatState {
  messages: ChatMessage[];
  toolExecutions?: ToolExecution[];
  isStreaming?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export interface ChatAction {
  type: string;
  payload?: any;
}
