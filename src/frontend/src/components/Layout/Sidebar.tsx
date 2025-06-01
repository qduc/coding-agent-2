import { useState } from 'react';
import { cn } from '../../utils/cn';
import Button from '../Common/Button';

type SidebarTab = 'files' | 'tools' | 'sessions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed md:relative z-30 w-64 h-full bg-gray-800 border-r border-gray-700 transition-all duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Explorer</h2>
          </div>

          <div className="flex border-b border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 rounded-none',
                activeTab === 'files' ? 'bg-gray-700' : ''
              )}
              onClick={() => setActiveTab('files')}
            >
              Files
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 rounded-none',
                activeTab === 'tools' ? 'bg-gray-700' : ''
              )}
              onClick={() => setActiveTab('tools')}
            >
              Tools
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 rounded-none',
                activeTab === 'sessions' ? 'bg-gray-700' : ''
              )}
              onClick={() => setActiveTab('sessions')}
            >
              Sessions
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {activeTab === 'files' && (
              <div className="space-y-1">
                {/* File explorer content would go here */}
                <div className="text-sm text-gray-400 p-2">
                  File explorer coming soon
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-1">
                {/* Tools content would go here */}
                <div className="text-sm text-gray-400 p-2">
                  Tools coming soon
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="space-y-1">
                {/* Sessions content would go here */}
                <div className="text-sm text-gray-400 p-2">
                  Sessions coming soon
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
