import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { socketService } from '../services/socketService';

export const useWebSocket = (url: string) => {
  const { dispatch } = useAppContext();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    socketRef.current = socketService.connect(url);

    if (socketRef.current) {
      socketRef.current.onopen = () => {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        reconnectAttempts.current = 0;
      };

      socketRef.current.onclose = () => {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, 1000 * reconnectAttempts.current);
        }
      };

      socketRef.current.onerror = (error) => {
        dispatch({ type: 'SET_ERROR', payload: error });
      };
    }
  }, [url, dispatch]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
  }, []);

  return { sendMessage };
};
