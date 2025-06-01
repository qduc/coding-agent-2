import { useCallback } from 'react';
import { useChatContext } from '../context/ChatContext';
import { useWebSocket } from './useWebSocket';
import { apiService } from '../services/apiService';

export const useChat = () => {
  const { state, dispatch } = useChatContext();
  const { sendMessage } = useWebSocket(process.env.REACT_APP_WS_URL || '');

  const sendChatMessage = useCallback(async (message: string) => {
    dispatch({ type: 'SET_STREAMING', payload: true });
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'user', content: message } });

    try {
      sendMessage(message);
    } catch (error) {
      dispatch({ type: 'SET_STREAMING', payload: false });
      dispatch({ type: 'ADD_MESSAGE', payload: { role: 'system', content: 'Error sending message' } });
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
