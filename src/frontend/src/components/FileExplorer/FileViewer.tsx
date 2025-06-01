import React, { useState, useEffect } from 'react';
import { FileContent } from './types';
import { Prism as SyntaxHighlighter } from 'prism-react-renderer';
import { FileIcon } from './FileIcons';

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
    setIsBinary(file.isBinary);
    
    if (file.isBinary) {
      setContent('Binary content not displayed');
    } else {
      setContent(file.content);
    }
  }, [file]);

  if (file.error) {
    return (
      <div className="file-viewer-error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">{file.error}</div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="file-viewer-image">
        <img 
          src={`data:image/${file.path.split('.').pop()};base64,${file.content}`} 
          alt={file.path} 
        />
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="file-viewer-binary">
        <FileIcon node={{ name: file.path, path: file.path, type: 'file' }} />
        <div className="binary-message">Binary file content not displayed</div>
      </div>
    );
  }

  const language = getLanguageFromExtension(file.path);

  return (
    <div className="file-viewer">
      {file.isTruncated && (
        <div className="file-viewer-warning">
          File is too large, showing first {maxSize} bytes
        </div>
      )}
      <SyntaxHighlighter language={language}>
        {content}
      </SyntaxHighlighter>
    </div>
  );
};
