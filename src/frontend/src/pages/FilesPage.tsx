import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import { FileExplorer } from '../components/FileExplorer/FileExplorer';
import { FileToolbar } from '../components/FileExplorer/FileToolbar';
import { useFileSystem } from '../hooks/useFileSystem';
import { useEffect } from 'react';

export default function FilesPage() {
  const {
    fileTree,
    currentFile,
    loadFileTree,
    openFile,
    // isLoading, // if FileExplorer needs a loading state
  } = useFileSystem();

  useEffect(() => {
    if (!fileTree.length) { // Load only if not already loaded or empty
      loadFileTree();
    }
  }, [loadFileTree, fileTree]);

  return (
    <MainLayout>
      <Helmet>
        <title>Files | DevAssistant</title>
        <meta name="description" content="Project file explorer" />
      </Helmet>
      <div className="flex flex-col h-full">
        <FileToolbar
          // Pass relevant props, e.g., from useFileSystem or local state
          // onRefresh={loadFileTree}
        />
        <FileExplorer
          className="flex-1"
          nodes={fileTree}
          selectedFile={currentFile}
          onFileSelect={openFile}
          onToggleDirectory={(path, isOpen) => {
            console.log('Toggle directory (implement in useFileSystem):', path, isOpen);
          }}
          // isLoading={isLoading}
        />
      </div>
    </MainLayout>
  );
}
