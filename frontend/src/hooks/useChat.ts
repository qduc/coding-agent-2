import { useCallback } from 'react';
import { useChatContext } from '../context/ChatContext';
import { useWebSocket } from './useWebSocket';
// import { apiService } from '../services/apiService';
import { ChatMessage } from '../types/chat'; // Ensure ChatMessage type is imported

export const useChat = () => {
  const { state, dispatch } = useChatContext();
  const { sendMessage } = useWebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3001'); // Using Vite environment variables

  const sendChatMessage = useCallback(async (messageContent: string) => {
    dispatch({ type: 'SET_STREAMING', payload: true });

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), // Modern browsers
      role: 'user',
      content: messageContent,
      timestamp: new Date(), // Store as Date object, format on display
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

    try {
      sendMessage(messageContent); // Assuming WebSocket expects just the content string
    } catch (error) {
      console.error("Error sending chat message:", error);
      dispatch({ type: 'SET_STREAMING', payload: false });
      const systemErrorMessage: ChatMessage = {
        id: crypto.randomUUID(), // Modern browsers
        role: 'system',
        content: 'Error sending message. Please try again.',
        timestamp: new Date(), // Store as Date object
      };
      dispatch({ type: 'ADD_MESSAGE', payload: systemErrorMessage });
    }
  }, [sendMessage, dispatch]);

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR_CHAT' });
  }, [dispatch]);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    sendMessage: sendChatMessage,
    clearChat,
  };
};
