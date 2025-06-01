import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { socketService } from '../services/socketService';

export const useWebSocket = (url: string) => {
  const { dispatch } = useAppContext();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5; // Or from config

  const connect = useCallback(() => {
    if (!url) {
      console.warn('WebSocket URL is not provided. Skipping connection.');
      dispatch({ type: 'SET_ERROR', payload: 'WebSocket URL not configured.' });
      return;
    }
    // Avoid multiple connections
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    socketRef.current = socketService.connect(url);

    if (socketRef.current) {
      socketRef.current.onopen = () => {
        console.log('WebSocket connected');
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true }); // Assuming true means connected
        reconnectAttempts.current = 0;
      };

      socketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false }); // Assuming false means disconnected
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current += 1;
            console.log(`WebSocket attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connect();
          }, Math.min(30000, 1000 * (2 ** reconnectAttempts.current))); // Exponential backoff
        }
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        // The 'error' event for browser WebSockets is a generic Event.
        // It doesn't carry a specific error message like an Error object.
        dispatch({ type: 'SET_ERROR', payload: 'WebSocket connection error. Check console for details.' });
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
