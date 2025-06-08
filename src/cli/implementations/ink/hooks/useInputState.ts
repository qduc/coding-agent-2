import { useState, useCallback } from 'react';
import { InputState } from '../types';

export interface InputStateActions {
  setValue: (value: string) => void;
  setCursorPosition: (position: number) => void;
  setMultilineMode: (enabled: boolean) => void;
  showPasteIndicator: () => void;
  insertAtCursor: (text: string) => void;
  deleteAtCursor: (count?: number) => void;
  moveCursor: (delta: number) => void;
  reset: () => void;
}

export interface UseInputStateReturn {
  state: InputState;
  actions: InputStateActions;
}

export function useInputState(initialValue: string = ''): UseInputStateReturn {
  const [state, setState] = useState<InputState>({
    value: initialValue,
    cursorPosition: initialValue.length,
    isMultilineMode: false,
    pasteIndicator: false,
  });

  const setValue = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      value,
      cursorPosition: Math.min(prev.cursorPosition, value.length),
    }));
  }, []);

  const setCursorPosition = useCallback((position: number) => {
    setState(prev => ({
      ...prev,
      cursorPosition: Math.max(0, Math.min(position, prev.value.length)),
    }));
  }, []);

  const setMultilineMode = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      isMultilineMode: enabled,
    }));
  }, []);

  const showPasteIndicator = useCallback(() => {
    setState(prev => ({
      ...prev,
      pasteIndicator: true,
    }));
    
    // Hide indicator after 1 second
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        pasteIndicator: false,
      }));
    }, 1000);
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    setState(prev => {
      const newValue = prev.value.substring(0, prev.cursorPosition) + 
                      text + 
                      prev.value.substring(prev.cursorPosition);
      
      return {
        ...prev,
        value: newValue,
        cursorPosition: prev.cursorPosition + text.length,
        isMultilineMode: prev.isMultilineMode || text.includes('\n'),
      };
    });
  }, []);

  const deleteAtCursor = useCallback((count: number = 1) => {
    setState(prev => {
      if (prev.cursorPosition === 0) return prev;
      
      const deleteStart = Math.max(0, prev.cursorPosition - count);
      const newValue = prev.value.substring(0, deleteStart) + 
                      prev.value.substring(prev.cursorPosition);
      
      return {
        ...prev,
        value: newValue,
        cursorPosition: deleteStart,
      };
    });
  }, []);

  const moveCursor = useCallback((delta: number) => {
    setState(prev => ({
      ...prev,
      cursorPosition: Math.max(0, Math.min(prev.value.length, prev.cursorPosition + delta)),
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      value: '',
      cursorPosition: 0,
      isMultilineMode: false,
      pasteIndicator: false,
    });
  }, []);

  const actions: InputStateActions = {
    setValue,
    setCursorPosition,
    setMultilineMode,
    showPasteIndicator,
    insertAtCursor,
    deleteAtCursor,
    moveCursor,
    reset,
  };

  return { state, actions };
}