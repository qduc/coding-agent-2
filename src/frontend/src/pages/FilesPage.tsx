import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import { FileExplorer } from '../components/FileExplorer/FileExplorer';
import { FileToolbar } from '../components/FileExplorer/FileToolbar';
import { useFileSystem } from '../hooks/useFileSystem';
import { useEffect } from 'react';

// Define a basic interface for FileToolbarProps based on common usage
// This assumes FileToolbar accepts an onRefresh prop.
interface FileToolbarProps {
  onRefresh: () => void;
  // Add other props as needed if FileToolbar component is provided later
  // e.g., viewMode, onViewModeChange, sortBy, onSortByChange, sortDirection, onSortDirectionChange
}

export default function FilesPage() {
  const {
    fileTree,
    currentFile,
    loadFileTree,
    openFile,
    isLoading, // Use isLoading from hook
  } = useFileSystem();

  useEffect(() => {
    // Load file tree only if it's empty and not currently loading
    if (!fileTree.length && !isLoading) {
      loadFileTree();
    }
  }, [loadFileTree, fileTree, isLoading]);

  // Placeholder for onToggleDirectory if it needs to update context state
  const handleToggleDirectory = (path: string, isOpen: boolean) => {
    console.log(`Directory ${path} toggled to ${isOpen ? 'open' : 'closed'}`);
    // Future: dispatch an action to update the fileTree state in context
  };

  return (
    <MainLayout>
      <Helmet>
        <title>Files | DevAssistant</title>
        <meta name="description" content="Project file explorer" />
      </Helmet>
      <div className="flex flex-col h-full">
        <FileToolbar
          onRefresh={loadFileTree} // Pass onRefresh prop
        />
        <FileExplorer
          className="flex-1"
          nodes={fileTree}
          selectedFile={currentFile}
          onFileSelect={openFile}
          onToggleDirectory={handleToggleDirectory}
          // isLoading prop is not part of FileExplorerProps based on summary, so not passed
        />
      </div>
    </MainLayout>
  );
}
