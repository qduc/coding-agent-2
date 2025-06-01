export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date; // Changed from string to Date
}

export interface ChatState {
    messages: ChatMessage[];
    isStreaming: boolean;
    activeTool: any;
    sessionId: string | null;
}

export type ChatAction =
    | { type: 'ADD_MESSAGE'; payload: ChatMessage }
    | { type: 'SET_STREAMING'; payload: boolean }
    | { type: 'SET_ACTIVE_TOOL'; payload: any }
    | { type: 'SET_SESSION'; payload: string | null }
    | { type: 'CLEAR_CHAT' };
