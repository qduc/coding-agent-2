import React from 'react';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { useTheme } from './utils/useTheme';
import { MainLayout } from './components/Layout/MainLayout';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { ChatInterface } from './components/Chat/ChatInterface';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { ToolList } from './components/Tools/ToolList';
import { StatusBar } from './components/Layout/StatusBar';

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        <Header 
          darkMode={theme === 'dark'} 
          onMenuToggle={handleMenuToggle}
          onDarkModeToggle={toggleTheme}
        />
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <ChatInterface 
          messages={[]}
          onSendMessage={() => {}}
          isStreaming={false}
        />
        <FileExplorer 
          nodes={[]}
          onFileSelect={() => {}}
          onToggleDirectory={() => {}}
        />
        <ToolList 
          availableTools={[]}
          onToggleTool={() => {}}
        />
        <StatusBar />
      </MainLayout>
    </ErrorBoundary>
  );
};

export default App;
