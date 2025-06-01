export interface ChatState {
    messages: Array<{
        id: string;
        content: string;
        sender: 'user' | 'bot';
        timestamp: Date;
    }>;
    currentMessage: string;
}

export type ChatAction =
    | { type: 'ADD_MESSAGE'; payload: { content: string; sender: 'user' | 'bot' } }
    | { type: 'UPDATE_CURRENT_MESSAGE'; payload: string }
    | { type: 'CLEAR_MESSAGES' };
