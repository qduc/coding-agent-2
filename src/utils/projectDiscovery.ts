import * as path from 'path';
import * as fs from 'fs-extra';

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

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Run complete project discovery and return structured results
   */
  async discover(): Promise<ProjectDiscoveryResult> {
    const executedAt = new Date();

    try {
      // Run all three discovery commands
      const projectStructure = await this.getProjectStructure();
      const techStack = await this.getTechStack();
      const entryPoints = await this.getEntryPoints();

      // Generate summary
      const summary = this.generateSummary(projectStructure, techStack, entryPoints);

      return {
        projectStructure,
        techStack,
        entryPoints,
        summary,
        executedAt,
        workingDirectory: this.workingDirectory
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
   */
  private createTreeRepresentationNodeJS(): string {
    try {
      // First check if directory exists
      if (!fs.existsSync(this.workingDirectory)) {
        return '';
      }

      const projectName = path.basename(this.workingDirectory);
      const ignoreDirs = new Set(['node_modules', '.git', '__pycache__', 'venv', 'env', 'dist', 'build']);

      const buildTree = (dir: string, prefix: string = '', maxDepth: number = 2, currentDepth: number = 0): string => {
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
          items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');

            result += `${prefix}${connector}${item.name}${item.isDirectory() ? '/' : ''}\n`;

            if (item.isDirectory()) {
              result += buildTree(path.join(dir, item.name), nextPrefix, maxDepth, currentDepth + 1);
            }
          });

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
   * Replaces find command with direct file checks
   */
  private detectTechStackWithNodeJS(): string {
    try {
      // First check if directory exists
      if (!fs.existsSync(this.workingDirectory)) {
        return '';
      }

      let result = '';
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

      for (const check of fileChecks) {
        const filePath = path.join(projectRoot, check.file);
        if (fs.existsSync(filePath)) {
          result += `=== ./${check.file} ===\n`;
          try {
            // Read just the first few lines
            const content = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 20).join('\n');
            result += content + '\n...(truncated)...\n\n';
          } catch (readError) {
            // Silently ignore read errors
            result += '[File exists but couldn\'t read]\n\n';
          }
        }
      }

      // Check src directory for additional dependency files if it exists
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        for (const check of fileChecks) {
          const filePath = path.join(srcDir, check.file);
          if (fs.existsSync(filePath)) {
            result += `=== ./src/${check.file} ===\n`;
            try {
              const content = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 20).join('\n');
              result += content + '\n...(truncated)...\n\n';
            } catch (readError) {
              result += '[File exists but couldn\'t read]\n\n';
            }
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
          entries.push('./' + pattern);
        }
      }

      // Check src directory for entry points if it exists
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        for (const pattern of patterns) {
          const filePath = path.join(srcDir, pattern);
          if (fs.existsSync(filePath)) {
            entries.push('./src/' + pattern);
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
  private generateSummary(structure: string, techStack: string, entryPoints: string[]): string {
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
}
