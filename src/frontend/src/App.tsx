import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './utils/useTheme';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';

// Lazy-loaded pages
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

function App() {
  const { theme } = useTheme();

  return (
    <div className={`app ${theme}`}>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
      
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!bg-background !text-foreground !border',
        }}
      />
    </div>
  );
}

export default App;
