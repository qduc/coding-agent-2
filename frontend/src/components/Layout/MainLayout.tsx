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
  const [darkMode, setDarkMode] = useState(true); // This darkMode state is for the Header's icon, useTheme handles global theme

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleDarkMode = () => setDarkMode(!darkMode); // This toggles the icon, useTheme handles actual theme change

  return (
    <div className={cn(
      'h-screen grid grid-rows-[auto_1fr_auto] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
      // On desktop, sidebar open: 250px for sidebar, rest for main
      // On desktop, sidebar closed: 60px for sidebar, rest for main
      // On mobile, sidebar is an overlay, so main content takes full width (implicitly 1 column)
      sidebarOpen ? 'md:grid-cols-[250px_1fr]' : 'md:grid-cols-[60px_1fr]'
    )}>
      <Header 
        onMenuToggle={toggleSidebar}
        onDarkModeToggle={toggleDarkMode} // This toggle is for the Header's icon state
        darkMode={darkMode} // This darkMode is for the Header's icon state
        // Spans both columns on desktop, first (and only) column on mobile
        className="col-start-1 md:col-span-2 border-b border-gray-200 dark:border-gray-700"
      />
      
      {/* Sidebar for Desktop and Mobile Overlay Trigger */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={toggleSidebar} // Used for the internal mobile close button in Sidebar
        className={cn(
          // Base styles for sidebar appearance (e.g., background, text color)
          // These are mostly set within Sidebar.tsx, but can be augmented here.
          'transition-all duration-300 ease-in-out', // For smooth width transition on desktop
          'overflow-y-auto', // Allow sidebar content to scroll if it overflows

          // Mobile: Fixed position, full height, slides in from left, high z-index
          'fixed inset-y-0 left-0 z-40 w-[250px] transform md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',

          // Desktop: Static position, part of the grid
          'md:static md:inset-auto md:z-auto md:translate-x-0 md:block',
          'md:row-start-2 md:col-start-1' // Placed in the second row, first column
        )}
      />

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      <main className="row-start-2 col-start-1 md:col-start-2 overflow-y-auto p-4">
        {children}
      </main>

      <StatusBar 
        className="col-start-1 md:col-span-2 border-t border-gray-200 dark:border-gray-700"
        // Pass other necessary props like connectionStatus, etc.
      />
    </div>
  );
}
