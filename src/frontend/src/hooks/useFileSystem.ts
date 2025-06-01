import { useCallback } from 'react';
import { useFileSystemContext } from '../context/FileSystemContext';
import { apiService } from '../services/apiService';
import { FileContent, FileSystemNode } from '../types/file'; // Ensure types are defined and imported

export const useFileSystem = () => {
  const { state, dispatch } = useFileSystemContext();

  const loadFileTree = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const fileTree: FileSystemNode[] = await apiService.getFileTree(); // Assuming apiService.getFileTree returns FileSystemNode[]
      dispatch({ type: 'SET_FILE_TREE', payload: fileTree });
    } catch (error) {
      console.error('Error loading file tree:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message || 'Failed to load file tree.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  const openFile = useCallback(async (filePath: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const content: string = await apiService.getFileContent(filePath); // Assuming returns string
      const fileName = filePath.split(/[\\/]/).pop() || filePath; // Handle both path separators

      const currentFilePayload: FileContent = {
        name: fileName,
        path: filePath,
        content: content,
        // type: 'file', // If your FileContent type has this
        // size: content.length, // If needed
        // modified: new Date(), // If relevant, though backend should provide this for existing files
      };
      dispatch({ type: 'SET_CURRENT_FILE', payload: currentFilePayload });
    } catch (error) {
      console.error('Error opening file:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message || `Failed to open file: ${filePath}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  return {
    fileTree: state.fileTree,
    currentFile: state.currentFile,
    currentDirectory: state.currentDirectory, // Ensure this is managed by context if used
    isLoading: state.isLoading,
    error: state.error,
    loadFileTree,
    openFile,
  };
};
