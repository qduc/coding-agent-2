import React, { useState, useEffect } from 'react';
import { FileContent } from './types';
import { FileIcon } from './FileIcons'; // Ensure this component is theme-aware
import { cn } from '@/lib/utils';
import { AlertTriangle, Image as ImageIcon, FileText } from 'lucide-react'; // Example icons

interface FileViewerProps {
  file: FileContent;
  maxSize?: number;
}

const getLanguageFromExtension = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c': return 'c';
    case 'cpp': return 'cpp';
    case 'h': return 'c';
    case 'hpp': return 'cpp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'rb': return 'ruby';
    case 'php': return 'php';
    case 'sh': return 'bash';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    default: return 'text';
  }
};

export const FileViewer: React.FC<FileViewerProps> = ({ file, maxSize = 1024 * 1024 }) => {
  const [isImage, setIsImage] = useState(false);
  const [isBinary, setIsBinary] = useState(false);
  const [content, setContent] = useState('');

  useEffect(() => {
    const extension = file.path.split('.').pop()?.toLowerCase();
    setIsImage(['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension || ''));
    setIsBinary(file.isBinary || false);

    if (file.isBinary) {
      setContent('Binary content not displayed');
    } else {
      setContent(file.content);
    }
  }, [file]);

  if (file.error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-destructive bg-destructive/10 rounded-md">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error Loading File</h3>
        <p className="text-sm text-center">{file.error}</p>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="p-4 flex items-center justify-center h-full bg-muted/20">
        <img
          src={`data:image/${file.path.split('.').pop()};base64,${file.content}`}
          alt={file.path}
          className="max-w-full max-h-full object-contain rounded-md shadow-md"
        />
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="h-12 w-12 mb-4" /> {/* Or use your FileIcon */}
        <h3 className="text-lg font-semibold mb-2">Binary File</h3>
        <p className="text-sm">Content not displayed.</p>
      </div>
    );
  }

  const language = getLanguageFromExtension(file.path);

  return (
    <div className="file-viewer p-4 h-full overflow-auto bg-background text-foreground">
      {file.isTruncated && (
        <div className="mb-2 p-3 rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 text-sm flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
          File is too large, showing first {maxSize} bytes
        </div>
      )}
      {/*
        For syntax highlighting, ensure your theme (e.g., for Prism.js or Highlight.js)
        is compatible with both light and dark modes, or uses CSS variables.
        You might need to conditionally apply a light/dark theme to the <pre> element
        or use a library that handles this automatically with Tailwind's dark mode.
        Example: if using a library that adds its own background, you might need to override it.
      */}
      <pre className={cn(
         `language-${language}`,
         'p-4 rounded-md bg-muted text-muted-foreground overflow-auto text-sm', // Base styling for the code block
         // Add specific syntax highlighting theme classes here if needed
         // e.g., 'prism-theme-light dark:prism-theme-dark'
      )}>
        <code>
          {content}
        </code>
      </pre>
    </div>
  );
};
