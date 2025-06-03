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

  return (
    <aside className={cn('flex flex-col h-full bg-gray-800 border-r border-gray-700', className)}>
      <div className="flex flex-col h-full">
        {/* Optional: Mobile close button inside sidebar */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2
            className={cn(
              'text-lg font-semibold transition-opacity duration-200',
              isOpen ? 'opacity-100' : 'md:opacity-0 md:w-0 md:overflow-hidden'
            )}
          >
            Explorer
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-200"
            aria-label="Close sidebar"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
          />
        </div>

        <div className="flex border-b border-gray-700">
          {(['files', 'tools', 'sessions'] as SidebarTab[]).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 rounded-none py-3 px-2 text-xs md:text-sm', // Adjusted padding/text size
                activeTab === tab ? 'bg-gray-700' : ''
              )}
              onClick={() => setActiveTab(tab)}
            >
              {/* Icon could go here, always visible */}
              <span
                className={cn(
                  'capitalize transition-opacity duration-200',
                  isOpen ? 'opacity-100' : 'md:opacity-0 md:w-0 md:overflow-hidden md:pointer-events-none'
                )}
              >
                {tab}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div
            className={cn(
              'transition-opacity duration-200',
              isOpen ? 'opacity-100' : 'md:opacity-0 md:pointer-events-none'
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
