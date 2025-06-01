import { useState } from 'react';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import { FileToolbar } from './FileToolbar';
import { FileSystemNode, FileContent, FileViewMode } from './types';

interface FileExplorerProps {
  nodes: FileSystemNode[];
  selectedFile?: FileContent | null;
  onFileSelect: (path: string) => void;
  onToggleDirectory: (path: string, isOpen: boolean) => void;
  onRefresh?: () => void;
  className?: string;
}

export const FileExplorer = ({
  nodes,
  selectedFile,
  onFileSelect,
  onToggleDirectory,
  onRefresh,
  className = '',
}: FileExplorerProps) => {
  const [viewMode, setViewMode] = useState<FileViewMode>('list');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <FileToolbar 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={onRefresh || (() => {})}
      />
      <div className="flex flex-1 overflow-hidden">
        <FileTree
          nodes={nodes}
          selectedPath={selectedFile?.path}
          onSelect={onFileSelect}
          onToggle={onToggleDirectory}
          className="w-64 border-r"
        />
        <div className="flex-1 overflow-auto">
          {selectedFile && <FileViewer file={selectedFile} />}
        </div>
      </div>
    </div>
  );
};
