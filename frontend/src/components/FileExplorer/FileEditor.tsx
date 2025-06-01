import React, { useState, useEffect } from 'react';
import { FileContent } from './types';
import Editor from '@monaco-editor/react';

interface FileEditorProps {
  file: FileContent;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export const FileEditor: React.FC<FileEditorProps> = ({
  file,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  const [content, setContent] = useState(file.content);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(file.content);
    setHasChanges(false);
  }, [file.path]);

  const handleChange = (value: string = '') => {
    setContent(value);
    setHasChanges(value !== file.content);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(content);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguage = () => {
    const extension = file.path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'jsx': return 'javascript';
      case 'tsx': return 'typescript';
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
      case 'sh': return 'shell';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'html': return 'html';
      case 'css': return 'css';
      default: return 'plaintext';
    }
  };

  return (
    <div className="file-editor">
      <div className="editor-toolbar">
        <button 
          onClick={handleSave} 
          disabled={!hasChanges || isSaving || readOnly}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel}>Cancel</button>
        {hasChanges && <span className="unsaved-changes">Unsaved changes</span>}
        {error && <span className="error-message">{error}</span>}
      </div>
      <Editor
        height="80vh"
        language={getLanguage()}
        value={content}
        onChange={handleChange}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
};
