import { cn } from '../../utils/cn';
import Button from '../Common/Button';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  darkMode: boolean;
  onMenuToggle: () => void;
  onDarkModeToggle: () => void;
  connectionStatus?: ConnectionStatus;
}

export default function Header({
  darkMode,
  onMenuToggle,
  onDarkModeToggle,
  connectionStatus = 'disconnected'
}: HeaderProps) {
  const statusColors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500'
  };

  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onMenuToggle}
          className="md:hidden"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          }
        />
        <h1 className="text-xl font-bold">Code Assistant</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <span className="hidden md:inline mr-2 text-sm">Status:</span>
          <div className={cn(
            'w-3 h-3 rounded-full',
            statusColors[connectionStatus]
          )} />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDarkModeToggle}
          icon={
            darkMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )
          }
        />

        <Button
          variant="ghost"
          size="sm"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>
    </header>
  );
}
