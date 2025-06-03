import { useState } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../Common/Button';

type SidebarTab = 'files' | 'tools' | 'sessions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export default function Sidebar({ isOpen, onClose, className }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');

  // Base classes for the sidebar
  const baseClasses = 'flex flex-col h-full bg-gray-800 border-r border-gray-700 fixed inset-y-0 left-0 z-30';
  // Transition classes
  const transitionClasses = 'transition-all duration-300 ease-in-out motion-reduce:transition-none';
  // Width classes based on isOpen state
  const widthClasses = isOpen ? 'w-64' : 'w-0 md:w-20'; // Collapsed to 0 on mobile, 20 (for icons) on md+
  // Classes for content visibility based on isOpen state
  const contentVisibilityClasses = isOpen ? 'opacity-100' : 'opacity-0 md:opacity-100'; // Content fully visible when open, hidden on mobile when closed, icons visible on md+ when closed

  return (
    <aside className={cn(baseClasses, transitionClasses, widthClasses, className)}>
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2
            className={cn(
              'text-lg font-semibold transition-opacity duration-200',
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none' // Hide title completely when closed
            )}
          >
            Explorer
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={cn('text-gray-400 hover:text-gray-200', isOpen ? 'md:hidden' : '')} // Show close button on mobile when open, or always if sidebar is narrow and open
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="flex border-b border-gray-700">
          {(['files', 'tools', 'sessions'] as SidebarTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'primary' : 'ghost'} // Make active tab more prominent
              size="sm"
              className={cn(
                'flex-1 rounded-none py-3 px-2 text-xs md:text-sm justify-center',
                activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              )}
              onClick={() => setActiveTab(tab)}
            >
              {/* Placeholder for Icon - TODO: Add actual icons */}
              <span className={cn(!isOpen && 'md:block hidden')}> {/* Icon placeholder */}
                {tab.substring(0,1).toUpperCase()}
              </span>
              <span
                className={cn(
                  'capitalize transition-opacity duration-200',
                  isOpen ? 'opacity-100 ml-2' : 'opacity-0 w-0 overflow-hidden md:hidden' // Text only visible when open
                )}
              >
                {tab}
              </span>
            </Button>
          ))}
        </div>
        {/* Ensure content area also respects the transition and overflow */}
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden p-2 transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto')}>
          <div
            className={cn(
              'transition-opacity duration-200',
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none md:opacity-100' // Content hidden when sidebar is collapsed on mobile
            )}
          >
            {activeTab === 'files' && (
              <div className="space-y-1">
                <div className="text-sm text-gray-400 p-2">File explorer coming soon</div>
              </div>
            )}
            {activeTab === 'tools' && (
              <div className="space-y-1">
                <div className="text-sm text-gray-400 p-2">Tools coming soon</div>
              </div>
            )}
            {activeTab === 'sessions' && (
              <div className="space-y-1">
                <div className="text-sm text-gray-400 p-2">Sessions coming soon</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
