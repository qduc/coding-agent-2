import fs from 'fs-extra';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { TreeSitterParser } from './treeSitterParser';
import { ProjectCacheManager } from './projectCache';
import {
  CodeAnalysisConfig,
  CodeStructureAnalysis,
  FileAnalysis,
  ProjectCacheMetadata
} from './codeStructure';
import { Logger } from './logger';

export class CodeAnalyzer {
  private parser: TreeSitterParser;
  private cacheManager: ProjectCacheManager;
  public readonly config: CodeAnalysisConfig;
  private logger: Logger = Logger.getInstance();

  constructor(config?: Partial<CodeAnalysisConfig>) {
    this.parser = new TreeSitterParser();
    this.cacheManager = new ProjectCacheManager();
    this.config = {
      maxFiles: 100,
      maxFileSize: 1024 * 1024, // 1MB
      maxTotalSize: 50 * 1024 * 1024, // 50MB
      analysisDepth: 'detailed',
      timeoutMs: 30000, // 30 seconds
      priorityPatterns: [
        'src/**/*.{ts,js,tsx,jsx}',
        'lib/**/*.{ts,js,tsx,jsx}',
        'index.{ts,js}',
        'main.{ts,js}',
        'app.{ts,js}',
        'package.json',
        'tsconfig.json'
      ],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.{ts,js}',
        '**/*.spec.{ts,js}',
        '.git/**',
        'coverage/**'
      ],
      ...config
    };
  }

  async analyzeProject(projectPath: string): Promise<{
    codeStructure: CodeStructureAnalysis;
    isCached: boolean;
    metadata: ProjectCacheMetadata;
  }> {
    const startTime = Date.now();
    const shouldInvalidate = await this.cacheManager.shouldInvalidateCache(projectPath);

    if (!shouldInvalidate) {
      try {
        const cached = await this.cacheManager.getCache(projectPath);
        if (cached) {
          return {
            codeStructure: cached.codeStructure,
            isCached: true,
            metadata: cached.metadata
          };
        }
      } catch (error) {
        this.logger.warn('Failed to load cache, performing fresh analysis');
      }
    }

    const analysis = await this.performAnalysis(projectPath);
    analysis.analysisTimeMs = Date.now() - startTime;

    const metadata = await this.cacheManager.generateCacheMetadata(projectPath);

    try {
      await this.cacheManager.saveCache(projectPath, {
        codeStructure: analysis,
        metadata,
        projectStructure: '',
        techStack: '',
        entryPoints: [],
        summary: ''
      });
    } catch (error) {
      this.logger.warn('Failed to save cache', error as Error);
    }

    return {
      codeStructure: analysis,
      isCached: false,
      metadata
    };
  }

  private async performAnalysis(projectPath: string): Promise<CodeStructureAnalysis> {
    const files = await this.discoverFiles(projectPath);
    const analyses = await this.analyzeFiles(files, projectPath);
    return this.aggregateResults(analyses);
  }

  private async discoverFiles(projectPath: string): Promise<string[]> {
    try {
      const allFiles = await this.getAllFiles(projectPath);
      const filteredFiles = allFiles
        .filter(file => {
          const relativePath = path.relative(projectPath, file);
          return !this.config.excludePatterns.some(pattern => minimatch(relativePath, pattern));
        });

      return this.prioritizeFiles(filteredFiles, projectPath);
    } catch (error) {
      this.logger.error('Failed to discover files', error as Error);
      return [];
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    };

    await walk(dir);
    return files;
  }

  private prioritizeFiles(files: string[], projectPath: string): string[] {
    const prioritized: string[] = [];
    const remaining: string[] = [];

    // Apply priority patterns first
    for (const file of files) {
      const relativePath = path.relative(projectPath, file);
      if (this.config.priorityPatterns.some(pattern => minimatch(relativePath, pattern))) {
        prioritized.push(file);
      } else {
        remaining.push(file);
      }
    }

    // Apply maxFiles limit
    return [...prioritized, ...remaining].slice(0, this.config.maxFiles);
  }

  private async analyzeFiles(files: string[], projectPath: string): Promise<FileAnalysis[]> {
    const analyses: FileAnalysis[] = [];
    let totalSize = 0;

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.size > this.config.maxFileSize) {
          this.logger.debug(`Skipping large file: ${file} (${stats.size} bytes)`);
          continue;
        }

        totalSize += stats.size;
        if (totalSize > this.config.maxTotalSize) {
          this.logger.debug(`Reached max total size (${this.config.maxTotalSize} bytes)`);
          break;
        }

        const analysis = await this.parser.analyzeFile(file);
        analyses.push(analysis);
      } catch (error) {
        this.logger.error(`Failed to analyze file ${file}`, error as Error);
      }
    }

    return analyses;
  }

  private aggregateResults(analyses: FileAnalysis[]): CodeStructureAnalysis {
    const languageBreakdown: Record<string, number> = {};
    let totalSymbols = 0;

    for (const analysis of analyses) {
      languageBreakdown[analysis.language] = (languageBreakdown[analysis.language] || 0) + 1;
      totalSymbols += analysis.symbols.length;
    }

    return {
      files: analyses,
      totalFiles: analyses.length,
      totalSymbols,
      languageBreakdown,
      analysisTimeMs: 0 // Will be set by caller
    };
  }
}
