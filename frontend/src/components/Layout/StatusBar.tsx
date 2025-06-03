import { ConnectionStatus } from '../types';
import { cn } from '../../utils/cn';

interface StatusBarProps {
  connectionStatus?: ConnectionStatus;
  activeTools?: number;
  sessionName?: string;
  latency?: number;
  className?: string;
}

export default function StatusBar({
  connectionStatus = 'disconnected',
  activeTools = 0,
  sessionName = 'Default',
  latency = 0,
  className,
}: StatusBarProps) {
  const statusColors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500'
  };
  return (
    <footer className={cn(
      'flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-100 text-xs',
      className
    )}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <div className={cn(
            'w-2 h-2 rounded-full mr-2',
            statusColors[connectionStatus]
          )} />
          <span>{connectionStatus}</span>
        </div>

        {activeTools > 0 && (
          <div className="flex items-center">
            <span className="mr-1">Tools:</span>
            <span className="font-medium">{activeTools}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div>
          <span className="mr-1">Session:</span>
          <span className="font-medium">{sessionName}</span>
        </div>

        <div>
          <span className="mr-1">Latency:</span>
          <span className="font-medium">{latency}ms</span>
        </div>
      </div>
    </footer>
  );
}
