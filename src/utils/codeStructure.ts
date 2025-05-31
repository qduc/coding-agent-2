/**
 * Code structure analysis types for tree-sitter based parsing
 */

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'enum' | 'type';
  startLine: number;
  endLine: number;
  parameters?: string[];
  returnType?: string;
  isExported?: boolean;
  isAsync?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  errors: string[];
}

export interface CodeStructureAnalysis {
  files: FileAnalysis[];
  totalFiles: number;
  totalSymbols: number;
  languageBreakdown: Record<string, number>;
  analysisTimeMs: number;
}

export interface CodeAnalysisConfig {
  maxFiles: number;           // e.g., 100 files max
  maxFileSize: number;        // e.g., 1MB per file
  maxTotalSize: number;       // e.g., 50MB total
  analysisDepth: 'summary' | 'detailed' | 'full';
  timeoutMs: number;          // e.g., 30 seconds
  priorityPatterns: string[]; // files to always include
  excludePatterns: string[];  // additional exclude patterns
}

export interface ProjectCacheMetadata {
  version: string;
  lastAnalyzed: Date;
  projectPath: string;
  gitCommitHash?: string;
  configFilesHash: string;
  directoryStructureHash: string;
  fileCountByDirectory: Record<string, number>;
  entryPointsMtime: Record<string, Date>;
  maxCacheAgeHours: number;
}
