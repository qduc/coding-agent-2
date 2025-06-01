import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';
import MainLayout from './components/Layout/MainLayout';

// Lazy-loaded pages
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

function App() {
  return (
    <>
      <MainLayout>
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
      </MainLayout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!bg-background !text-foreground !border',
        }}
      />
    </>
  );
}

export default App;
