import React from 'react';
import { FileSystemNode } from './types';

const iconMap: Record<string, string> = {
  default: '📄',
  directory: '📁',
  directoryOpen: '📂',
  image: '🖼️',
  code: '💻',
  json: '📋',
  markdown: '📝',
  pdf: '📕',
  zip: '🗜️',
  audio: '🎵',
  video: '🎬',
  binary: '🔢',
};

const extensionMap: Record<string, string> = {
  js: 'code',
  ts: 'code',
  jsx: 'code',
  tsx: 'code',
  py: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  hpp: 'code',
  go: 'code',
  rs: 'code',
  rb: 'code',
  php: 'code',
  sh: 'code',
  json: 'json',
  md: 'markdown',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  pdf: 'pdf',
  zip: 'zip',
  gz: 'zip',
  tar: 'zip',
  mp3: 'audio',
  wav: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  bin: 'binary',
  dat: 'binary',
};

interface FileIconProps {
  node: FileSystemNode;
  isLoading?: boolean;
  hasError?: boolean;
}

export const FileIcon: React.FC<FileIconProps> = ({ node, isLoading, hasError }) => {
  if (hasError) return <span>❌</span>;
  if (isLoading) return <span>⏳</span>;
  
  if (node.type === 'directory') {
    return <span>{node.isOpen ? iconMap.directoryOpen : iconMap.directory}</span>;
  }

  const extension = node.name.split('.').pop()?.toLowerCase();
  const iconType = extension && extensionMap[extension] || 'default';
  
  return <span>{iconMap[iconType]}</span>;
};
