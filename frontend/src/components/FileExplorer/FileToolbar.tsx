import { Button } from '@/components/ui/button';
import { RefreshCw, List, Grid } from 'lucide-react'; // Optional icons
import { cn } from '@/lib/utils';
import { FileViewMode } from './types';

interface FileToolbarProps {
  viewMode: FileViewMode;
  onViewModeChange: (mode: FileViewMode) => void;
  onRefresh: () => void; // Added onRefresh prop
}

export const FileToolbar = ({
  viewMode,
  onViewModeChange,
  onViewModeChange,
  onRefresh,
}: FileToolbarProps) => {
  return (
    <div className="flex items-center justify-between p-2 border-b border-border bg-muted/50">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">File Explorer</span>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> {/* Optional icon */}
          Refresh
        </Button>
      </div>
      <div className="flex space-x-1"> {/* Reduced space for icon buttons if used */}
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="sm" // or "icon" if only using icons
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-4 w-4 md:mr-2" /> {/* Optional icon, hide text on small screens */}
          <span className="hidden md:inline">List</span>
        </Button>
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="sm" // or "icon"
          onClick={() => onViewModeChange('grid')}
        >
          <Grid className="h-4 w-4 md:mr-2" /> {/* Optional icon */}
          <span className="hidden md:inline">Grid</span>
        </Button>
      </div>
    </div>
  );
};
