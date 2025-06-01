import { useCallback } from 'react';
import { useFileSystemContext } from '../context/FileSystemContext';
import { apiService } from '../services/apiService';

export const useFileSystem = () => {
  const { state, dispatch } = useFileSystemContext();

  const loadFileTree = useCallback(async () => {
    dispatch({ type: 'SET_FILE_OPERATION', payload: true });
    try {
      const fileTree = await apiService.getFileTree();
      dispatch({ type: 'SET_FILE_TREE', payload: fileTree });
    } catch (error) {
      console.error('Error loading file tree:', error);
    } finally {
      dispatch({ type: 'SET_FILE_OPERATION', payload: false });
    }
  }, [dispatch]);

  const openFile = useCallback(async (filePath: string) => {
    dispatch({ type: 'SET_FILE_OPERATION', payload: true });
    try {
      const fileContent = await apiService.getFileContent(filePath);
      dispatch({ type: 'SET_CURRENT_FILE', payload: { path: filePath, content: fileContent } });
    } catch (error) {
      console.error('Error opening file:', error);
    } finally {
      dispatch({ type: 'SET_FILE_OPERATION', payload: false });
    }
  }, [dispatch]);

  return {
    fileTree: state.fileTree,
    currentFile: state.currentFile,
    currentDirectory: state.currentDirectory,
    isFileOperationInProgress: state.isFileOperationInProgress,
    loadFileTree,
    openFile,
  };
};
