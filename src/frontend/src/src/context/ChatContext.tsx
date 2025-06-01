import React, { createContext, useContext, useReducer } from 'react';
import { ChatState, ChatAction } from '../types';

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  activeTool: null,
  sessionId: null,
};

const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

const reducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload };
    case 'SET_SESSION':
      return { ...state, sessionId: action.payload };
    case 'CLEAR_CHAT':
      return { ...state, messages: [] };
    default:
      return state;
  }
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
