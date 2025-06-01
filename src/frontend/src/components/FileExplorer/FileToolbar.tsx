import { FileViewMode } from './types';

interface FileToolbarProps {
  viewMode: FileViewMode;
  onViewModeChange: (mode: FileViewMode) => void;
}

export const FileToolbar = ({
  viewMode,
  onViewModeChange,
}: FileToolbarProps) => {
  return (
    <div className="flex items-center justify-between p-2 border-b bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">File Explorer</span>
      </div>
      <div className="flex space-x-2">
        <button
          className={`px-3 py-1 text-sm rounded ${
            viewMode === 'list' 
              ? 'bg-blue-100 dark:bg-blue-900' 
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => onViewModeChange('list')}
        >
          List
        </button>
        <button
          className={`px-3 py-1 text-sm rounded ${
            viewMode === 'grid' 
              ? 'bg-blue-100 dark:bg-blue-900' 
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          onClick={() => onViewModeChange('grid')}
        >
          Grid
        </button>
      </div>
    </div>
  );
};
