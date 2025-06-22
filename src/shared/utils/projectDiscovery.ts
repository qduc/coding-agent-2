import * as path from 'path';
import fs from 'fs-extra';

import { CodeStructureAnalysis, ProjectCacheMetadata } from './codeStructure';
import { CodeAnalyzer } from './codeAnalyzer';
import { Logger } from './logger';

/**
 * Project Discovery Result
 */
export interface ProjectDiscoveryResult {
  projectStructure: string;
  techStack: string;
  entryPoints: string[];
  summary: string;
  executedAt: Date;
  workingDirectory: string;

  // NEW: Enhanced with code structure analysis
  codeStructure?: CodeStructureAnalysis;
  cacheMetadata?: ProjectCacheMetadata;
  isCachedResult?: boolean;
  partiallyUpdated?: string[];
  analysisMetadata?: {
    filesAnalyzed: number;
    filesSkipped: number;
    limitationsApplied: string[];
  };
}

/**
 * Project Discovery Utility - Basic discovery of project structure and tech stack
 *
 * Uses three essential Node.js-based approaches to quickly understand any project:
 * 1. Project structure (pure Node.js file system traversal)
 * 2. Tech stack discovery (direct dependency file checks)
 * 3. Entry points & README discovery (direct file system checks)
 */
export class ProjectDiscovery {
  private workingDirectory: string;
  private codeAnalyzer: CodeAnalyzer;
  private enableCodeAnalysis: boolean;
  private logger: Logger = Logger.getInstance();

  constructor(workingDirectory: string = process.cwd(), enableCodeAnalysis: boolean = true) {
    this.workingDirectory = workingDirectory;
    this.enableCodeAnalysis = enableCodeAnalysis;
    this.codeAnalyzer = new CodeAnalyzer();
  }

  /**
   * Run complete project discovery and return structured results
   * @param forceRefresh Force a refresh of the discovery instead of using cached data
   */
  async discover(forceRefresh: boolean = false): Promise<ProjectDiscoveryResult> {
    const executedAt = new Date();

    // Clear cache if force refresh is set
    if (forceRefresh) {
      this.logger.debug('Forcing refresh of project discovery');
    }

    // If the working directory does not exist, return minimal info
    if (!fs.existsSync(this.workingDirectory)) {
      return {
        projectStructure: '',
        techStack: '',
        entryPoints: [],
        summary: `Basic project in ${path.basename(this.workingDirectory)}`,
        executedAt,
        workingDirectory: this.workingDirectory
      };
    }

    try {
      // Run all three discovery commands
      const projectStructure = await this.getProjectStructure();
      this.logger.debug(`projectStructure length: ${projectStructure.length}`);
      const techStack = await this.getTechStack();
      this.logger.debug(`techStack length: ${techStack.length}`);
      const entryPoints = await this.getEntryPoints();
      this.logger.debug(`entryPoints count: ${entryPoints.length}`);

      let codeStructure: CodeStructureAnalysis | undefined;
      let analysisMetadata = {
        filesAnalyzed: 0,
        filesSkipped: 0,
        limitationsApplied: [] as string[]
      };

      if (this.enableCodeAnalysis) {
        try {
          const { codeStructure: analysis, metadata } = await this.codeAnalyzer.analyzeProject(this.workingDirectory);
          codeStructure = analysis;
          this.logger.debug(`codeStructure: files=${analysis.files.length}, totalSymbols=${analysis.files.reduce((total, file) => total + file.symbols.length, 0)}`);
          analysisMetadata = {
            filesAnalyzed: analysis.files.length,
            filesSkipped: 0, // TODO: track skipped files
            limitationsApplied: [
              `Analyzed ${analysis.files.length} of ${analysis.totalFiles} files`,
              `Max file size: ${this.codeAnalyzer.config.maxFileSize} bytes`,
              `Max total size: ${this.codeAnalyzer.config.maxTotalSize} bytes`
            ]
          };
        } catch (error) {
          this.logger.error('Code analysis failed', error as Error);
          analysisMetadata.limitationsApplied.push('Code analysis failed');
        }
      }

      // Generate summary (after code analysis is complete)
      const summary = this.generateSummary(projectStructure, techStack, entryPoints, codeStructure);
      this.logger.debug(`summary length: ${summary.length}`);

      return {
        projectStructure,
        techStack,
        entryPoints,
        summary,
        executedAt,
        workingDirectory: this.workingDirectory,
        codeStructure,
        analysisMetadata,
        isCachedResult: false,
        partiallyUpdated: []
      };
    } catch (error) {
      // Return minimal info if discovery fails - with silent handling
      return {
        projectStructure: '',
        techStack: '',
        entryPoints: [],
        summary: `Basic project in ${path.basename(this.workingDirectory)}`,
        executedAt,
        workingDirectory: this.workingDirectory
      };
    }
  }

  /**
   * Command 1: Project structure using Node.js file system
   * Creates a tree-like representation without shell commands
   */
  private async getProjectStructure(): Promise<string> {
    try {
      return this.createTreeRepresentationNodeJS();
    } catch (error) {
      // Silent error handling - return empty string
      return '';
    }
  }

  /**
   * Create a tree-like representation using Node.js filesystem APIs
   * This replaces shell commands with pure Node.js implementation
   * Trimmed: Only top 10 items per directory
   */
  private createTreeRepresentationNodeJS(): string {
    try {
      // First check if directory exists
      if (!fs.existsSync(this.workingDirectory)) {
        return '';
      }

      const projectName = path.basename(this.workingDirectory);
      const ignoreDirs = new Set([
        'node_modules', 'vendor', '__pycache__', '.venv', 'venv', 'dist',
        'build', 'target', '.git', '.idea', '.vscode', 'coverage', '.cache'
      ]);

      // Read root .gitignore and add directory entries to ignoreDirs
      try {
        const gitignorePath = path.join(this.workingDirectory, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
          gitignoreContent.split('\n').forEach(line => {
            const trimmed = line.trim();

            // Skip comments, empty lines, and negations
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return;

            // Skip complex patterns with wildcards
            if (trimmed.includes('*') || trimmed.includes('?') || trimmed.includes('[')) return;

            // Handle directory patterns
            if (trimmed.endsWith('/')) {
              // Explicit directory: "build/"
              ignoreDirs.add(trimmed.slice(0, -1));
            } else if (!trimmed.includes('/')) {
              // Simple top-level pattern: "logs", "temp", "node_modules"
              ignoreDirs.add(trimmed);
            } else {
              // Path pattern: "src/temp" -> ignore the root "src"
              const rootDir = trimmed.split('/')[0];
              if (rootDir && !rootDir.includes('.')) {
                ignoreDirs.add(rootDir);
              }
            }
          });
        }
      } catch (e) {
        // Ignore errors reading .gitignore
      }

      const buildTree = (dir: string, prefix: string = '', maxDepth: number = 3, currentDepth: number = 0): string => {
        if (currentDepth >= maxDepth) return '';

        try {
          const items = fs.readdirSync(dir, { withFileTypes: true })
            .filter(item => !item.name.startsWith('.') && !ignoreDirs.has(item.name))
            .sort((a, b) => {
              // Directories first, then files
              if (a.isDirectory() && !b.isDirectory()) return -1;
              if (!a.isDirectory() && b.isDirectory()) return 1;
              return a.name.localeCompare(b.name);
            });

          let result = '';
          const displayItems = items.slice(0, 10);
          displayItems.forEach((item, index) => {
            const isLast = index === displayItems.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');

            result += `${prefix}${connector}${item.name}${item.isDirectory() ? '/' : ''}\n`;

            if (item.isDirectory()) {
              result += buildTree(path.join(dir, item.name), nextPrefix, maxDepth, currentDepth + 1);
            }
          });
          if (items.length > 10) {
            result += `${prefix}...and ${items.length - 10} more\n`;
          }
          return result;
        } catch (error) {
          return '';
        }
      };

      const projectTree = buildTree(this.workingDirectory);
      const directoryCount = (projectTree.match(/├── .+\/$/gm) || []).length + (projectTree.match(/└── .+\/$/gm) || []).length;
      const fileCount = (projectTree.match(/├── [^\/]+$/gm) || []).length + (projectTree.match(/└── [^\/]+$/gm) || []).length;

      return `${projectName}/\n${projectTree}\n${directoryCount} director${directoryCount === 1 ? 'y' : 'ies'}, ${fileCount} file${fileCount === 1 ? '' : 's'}`;
    } catch (error) {
      return '';
    }
  }

  /**
   * Command 2: Tech stack discovery using Node.js file system
   * Replaces find command with direct file checks
   */
  private async getTechStack(): Promise<string> {
    try {
      return this.detectTechStackWithNodeJS();
    } catch (error) {
      // Silent error handling - return empty string
      return '';
    }
  }

  /**
   * Tech stack detection using Node.js file system APIs
   * Trimmed: Only show file names that exist
   */
  private detectTechStackWithNodeJS(): string {
    try {
      // First check if directory exists
      if (!fs.existsSync(this.workingDirectory)) {
        return '';
      }

      const projectRoot = this.workingDirectory;

      // Check for common dependency files directly
      const fileChecks = [
        { file: 'package.json', type: 'Node.js' },
        { file: 'requirements.txt', type: 'Python' },
        { file: 'Cargo.toml', type: 'Rust' },
        { file: 'go.mod', type: 'Go' },
        { file: 'pom.xml', type: 'Java/Maven' },
        { file: 'composer.json', type: 'PHP' },
        { file: 'Gemfile', type: 'Ruby' },
        { file: 'build.gradle', type: 'Java/Gradle' },
        { file: 'tsconfig.json', type: 'TypeScript' }
      ];

      let result = '';
      for (const check of fileChecks) {
        const filePath = path.join(projectRoot, check.file);
        if (fs.existsSync(filePath)) {
          result += `./${check.file}\n`;
        }
      }

      // Check src directory for additional dependency files if it exists
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        for (const check of fileChecks) {
          const filePath = path.join(srcDir, check.file);
          if (fs.existsSync(filePath)) {
            result += `src/${check.file}\n`;
          }
        }
      }

      return result.trim();
    } catch (error) {
      // Silent error handling
      return '';
    }
  }

  /**
   * Command 3: Entry points and README discovery using Node.js file system
   * Replaces find command with direct file checks
   */
  private async getEntryPoints(): Promise<string[]> {
    try {
      return this.findEntryPointsWithNodeJS();
    } catch (error) {
      // Silent fallback - empty array
      return [];
    }
  }

  /**
   * Find entry points using Node.js file system APIs
   * Replaces find command with direct file checks
   */
  private findEntryPointsWithNodeJS(): string[] {
    try {
      // First check if directory exists
      if (!fs.existsSync(this.workingDirectory)) {
        return [];
      }

      const entries: string[] = [];
      const projectRoot = this.workingDirectory;

      // Common entry point patterns
      const patterns = [
        'README.md', 'README.txt', 'README',
        'index.js', 'index.ts', 'index.py', 'index.php',
        'main.js', 'main.ts', 'main.py', 'main.go',
        'app.js', 'app.ts', 'app.py'
      ];

      // Check root directory
      for (const pattern of patterns) {
        const filePath = path.join(projectRoot, pattern);
        if (fs.existsSync(filePath)) {
          entries.push(pattern);
        }
      }

      // Check src directory for entry points if it exists
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        for (const pattern of patterns) {
          const filePath = path.join(srcDir, pattern);
          if (fs.existsSync(filePath)) {
            entries.push('src/' + pattern);
          }
        }
      }

      // Limit to first 5 entries to match original behavior
      return entries.slice(0, 5);
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate a human-readable summary from discovery results
   */
  private generateSummary(structure: string, techStack: string, entryPoints: string[], codeStructure?: CodeStructureAnalysis): string {
    const projectName = path.basename(this.workingDirectory);
    let summary = `${projectName} project analysis:\n\n`;

    // Analyze tech stack
    if (techStack.includes('package.json')) {
      summary += '📦 Node.js/JavaScript project\n';
    }
    if (techStack.includes('requirements.txt')) {
      summary += '🐍 Python project\n';
    }
    if (techStack.includes('Cargo.toml')) {
      summary += '🦀 Rust project\n';
    }
    if (techStack.includes('go.mod')) {
      summary += '🐹 Go project\n';
    }
    if (techStack.includes('pom.xml')) {
      summary += '☕ Java project\n';
    }
    if (techStack.includes('composer.json')) {
      summary += '🐘 PHP project\n';
    }

    // Analyze entry points
    if (entryPoints.length > 0) {
      summary += `\n📁 Key files found: ${entryPoints.join(', ')}\n`;
    }

    // Basic structure info
    if (structure.includes('src')) {
      summary += '📂 Has src/ directory (organized codebase)\n';
    }
    if (structure.includes('test') || structure.includes('tests')) {
      summary += '🧪 Has test directory\n';
    }
    if (structure.includes('docs')) {
      summary += '📚 Has documentation directory\n';
    }

    // Add code structure analysis if available
    if (codeStructure) {
      summary += '\n🔍 Code Analysis:\n';

      // Analyze languages used
      const languages = new Set<string>();
      codeStructure.files.forEach(file => {
        if (file.language) {
          languages.add(file.language);
        }
      });

      if (languages.size > 0) {
        const langDisplay = Array.from(languages)
          .map(lang => {
            // Capitalize properly for common languages
            const langMap: Record<string, string> = {
              'typescript': 'TypeScript',
              'javascript': 'JavaScript',
              'python': 'Python',
              'rust': 'Rust'
            };
            return langMap[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
          })
          .join(', ');
        summary += `   Languages: ${langDisplay}\n`;
      }

      // Count total symbols
      const totalSymbols = codeStructure.files.reduce((total, file) => total + file.symbols.length, 0);
      if (totalSymbols > 0) {
        summary += `   ${totalSymbols} symbols found across ${codeStructure.files.length} files\n`;
      }

      // Show analysis timing
      if (codeStructure.analysisTimeMs && codeStructure.analysisTimeMs > 0) {
        summary += `   Analysis completed in ${codeStructure.analysisTimeMs}ms\n`;
      }
    }

    return summary;
  }

  /**
   * Get a compact summary for system prompt inclusion
   */
  static formatForSystemPrompt(discovery: ProjectDiscoveryResult): string {
    return `PROJECT CONTEXT:
${discovery.summary}

Project Structure:
${discovery.projectStructure}

Tech Stack:
${discovery.techStack}

Entry Points: ${discovery.entryPoints.join(', ') || 'None found'}`;
  }

  /**
   * Analyze project structure (alias for discover with force refresh option)
   */
  async analyze(forceRefresh: boolean = false): Promise<ProjectDiscoveryResult> {
    return this.discover(forceRefresh);
  }

  /**
   * Generate file tree structure
   */
  async getFileTree(maxDepth: number = 3): Promise<any[]> {
    try {
      const baseDir = this.workingDirectory;
      return this.buildFileTree(baseDir, '', 0, maxDepth);
    } catch (error) {
      this.logger.error('Error generating file tree', error as Error);
      return [];
    }
  }

  /**
   * Search for files matching pattern
   */
  async searchFiles(pattern: string): Promise<string[]> {
    try {
      const baseDir = this.workingDirectory;
      const allFiles = await this.listFilesRecursively(baseDir);

      // Simple glob pattern matching
      return allFiles.filter(file => {
        const relativePath = path.relative(baseDir, file);
        return this.matchesGlobPattern(relativePath, pattern);
      });
    } catch (error) {
      this.logger.error('Error searching files', error as Error);
      return [];
    }
  }

  /**
   * Detect technologies used in project
   */
  async detectTechnologies(): Promise<string> {
    try {
      return this.detectTechStackWithNodeJS();
    } catch (error) {
      this.logger.error('Error detecting technologies', error as Error);
      return '';
    }
  }

  /**
   * Build file tree structure
   */
  private buildFileTree(baseDir: string, relativePath: string, currentDepth: number, maxDepth: number): any[] {
    if (currentDepth > maxDepth) return [];

    const currentPath = path.join(baseDir, relativePath);
    const files = fs.readdirSync(currentPath);
    const result = [];

    for (const file of files) {
      // Skip hidden files
      if (file.startsWith('.')) continue;

      const filePath = path.join(currentPath, file);
      const fileRelativePath = path.join(relativePath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        const children = currentDepth < maxDepth
          ? this.buildFileTree(baseDir, fileRelativePath, currentDepth + 1, maxDepth)
          : [];

        result.push({
          path: fileRelativePath,
          name: file,
          type: 'directory',
          children: children
        });
      } else {
        result.push({
          path: fileRelativePath,
          name: file,
          type: 'file',
          size: stats.size
        });
      }
    }

    return result;
  }

  /**
   * List all files recursively
   */
  private async listFilesRecursively(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(entry => {
        const res = path.resolve(dir, entry.name);
        return entry.isDirectory() ? this.listFilesRecursively(res) : res;
      })
    );
    return Array.prototype.concat(...files);
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath);
  }
}
