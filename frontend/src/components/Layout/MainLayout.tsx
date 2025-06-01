import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import { cn } from '../../utils/cn';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <div className={cn(
      'flex flex-col h-screen bg-gray-900 text-gray-100',
      darkMode ? 'dark' : ''
    )}>
      <Header 
        onMenuToggle={toggleSidebar}
        onDarkModeToggle={toggleDarkMode}
        darkMode={darkMode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
        />
        
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
