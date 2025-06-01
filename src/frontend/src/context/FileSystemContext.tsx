import React, { createContext, useContext, useReducer } from 'react';
import { FileSystemState, FileSystemAction } from '../types';

const initialState: FileSystemState = {
  fileTree: [],
  currentFile: null,
  currentDirectory: null,
  isFileOperationInProgress: false,
  isLoading: false,
  error: null,
};

const FileSystemContext = createContext<{
  state: FileSystemState;
  dispatch: React.Dispatch<FileSystemAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

const reducer = (state: FileSystemState, action: FileSystemAction): FileSystemState => {
  switch (action.type) {
    case 'SET_FILE_TREE':
      return { ...state, fileTree: action.payload };
    case 'SET_CURRENT_FILE':
      return { ...state, currentFile: action.payload };
    case 'SET_CURRENT_DIRECTORY':
      return { ...state, currentDirectory: action.payload };
    case 'SET_FILE_OPERATION':
      return { ...state, isFileOperationInProgress: action.payload };
    default:
      return state;
  }
};

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <FileSystemContext.Provider value={{ state, dispatch }}>
      {children}
    </FileSystemContext.Provider>
  );
};

export const useFileSystemContext = () => useContext(FileSystemContext);
