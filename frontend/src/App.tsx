import { lazy, Suspense, ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';

import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import NotFound from './pages/NotFound';
import MainLayout from './components/Layout/MainLayout';

// Import Context Providers
import { AppProvider } from './context/AppContext';
import { ConfigProvider } from './context/ConfigContext';
import { ChatProvider } from './context/ChatContext';
import { FileSystemProvider } from './context/FileSystemContext';
import { useTheme } from './hooks/useTheme'; // Import useTheme

// Lazy-loaded pages
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

interface GlobalProvidersProps {
  children: ReactNode;
}

// Component to wrap all providers and theme logic
function GlobalProviders({ children }: GlobalProvidersProps) {
  const { darkMode } = useTheme(); // Initialize theme

  return (
    <div className={darkMode ? 'dark' : ''}>
      {children}
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
        <AppProvider>
          <ConfigProvider> {/* For useTheme and other config-dependent hooks */}
            <ChatProvider>
              <FileSystemProvider>
                <GlobalProviders> {/* Applies dark mode class */}
                  <MainLayout>
                    <Suspense fallback={<LoadingSpinner fullScreen />}>
                      <ErrorBoundary fallback={ // Changed from fallbackRender to fallback
                        <div role="alert" className="p-4">
                          <h2 className="text-lg font-bold">Something went wrong</h2>
                          <p className="text-red-500">An unexpected error occurred.</p> {/* Static message as fallback expects ReactNode */}
                          <button onClick={() => window.location.reload()}>Reload</button>
                        </div>
                      }>
                        <Routes>
                          <Route path="/" element={<ChatPage />} />
                          <Route path="/chat" element={<ChatPage />} /> {/* Explicit /chat route */}
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
                      // Ensure styles are compatible with Tailwind JIT
                      // Using explicit classes for background/text/border
                      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg',
                    }}
                  />
                </GlobalProviders>
              </FileSystemProvider>
            </ChatProvider>
          </ConfigProvider>
        </AppProvider>
    </HelmetProvider>
  );
}

export default App;
