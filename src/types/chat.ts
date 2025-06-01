import { ChatMessage, ToolExecution } from '../frontend/src/components/Chat/types';

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
