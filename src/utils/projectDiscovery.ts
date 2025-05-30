import { execSync } from 'child_process';
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
 * Uses three essential commands to quickly understand any project:
 * 1. Project structure (tree command or fallback)
 * 2. Tech stack discovery (find dependency files)
 * 3. Entry points & README discovery
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
   * Command 1: Project structure using tree
   * Falls back to improved directory visualization if tree is not available
   */
  private async getProjectStructure(): Promise<string> {
    try {
      // Try tree command first, redirecting stderr to /dev/null to suppress "command not found" messages
      const treeCommand = `tree -I 'node_modules|.git|__pycache__|*.pyc|venv|env|dist|build' -L 2 2>/dev/null`;
      const result = execSync(treeCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 10000
      });
      return result.trim();
    } catch (error) {
      // Check if it's a command not found error vs other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCommandNotFound =
        errorMessage.includes('command not found') ||
        errorMessage.includes('not recognized') ||
        errorMessage.includes('No such file');

      // Enhanced fallback: Create a tree-like representation using find + ls
      try {
        if (isCommandNotFound) {
          return this.createTreeRepresentation();
        } else {
          // If it's not a command not found error, we can try basic find as last resort
          const findCommand = `find . -maxdepth 2 -type d | grep -v -E '(node_modules|\.git|__pycache__|venv|env|dist|build)' | sort 2>/dev/null`;
          const result = execSync(findCommand, {
            cwd: this.workingDirectory,
            encoding: 'utf8',
            timeout: 10000
          });
          return `Directory structure:\n${result.trim()}`;
        }
      } catch (fallbackError) {
        // Last resort: list top-level directories
        try {
          const lsCommand = `ls -la | grep '^d' | awk '{print $9}' | grep -v -E '(node_modules|\.git|__pycache__|venv|env|dist|build)' 2>/dev/null`;
          const result = execSync(lsCommand, {
            cwd: this.workingDirectory,
            encoding: 'utf8',
            timeout: 5000
          });
          return `${result.trim()}`;
        } catch (lastResortError) {
          // Silently return empty string instead of error message
          return '';
        }
      }
    }
  }

  /**
   * Create a tree-like representation using find, ls, and basic text formatting
   * This mimics the tree command output with basic indentation
   */
  private createTreeRepresentation(): string {
    try {
      // Get project name
      const projectName = path.basename(this.workingDirectory);

      // Get all directories first (excluding filtered ones)
      const findDirsCommand = `find . -type d -not -path "*/\\.*" -not -path "*/node_modules*" -not -path "*/venv*" -not -path "*/env*" -not -path "*/dist*" -not -path "*/build*" -maxdepth 2 | sort 2>/dev/null`;
      const dirs = execSync(findDirsCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 10000
      }).trim().split('\n');

      // Get top-level files (excluding filtered ones)
      const findRootFilesCommand = `find . -maxdepth 1 -type f -not -path "*/\\.*" | sort 2>/dev/null`;
      const rootFiles = execSync(findRootFilesCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 5000
      }).trim().split('\n').filter(f => f !== '');

      // Build tree representation
      let result = `${projectName}/\n`;

      // Add directories with proper indentation
      for (const dir of dirs) {
        if (dir === '.') continue;

        // Count depth based on path separators
        const depth = dir.split('/').length - 1;
        const indent = '│   '.repeat(depth - 1);
        const name = dir.split('/').pop() || '';

        // For level 1 directories, add │── prefix
        // For level 2+ directories, add proper indentation
        if (depth === 1) {
          result += `├── ${name}/\n`;
        } else if (depth === 2) {
          result += `${indent}├── ${name}/\n`;
        }
      }

      // Add root files
      for (const file of rootFiles) {
        if (file === '.') continue;
        const name = file.replace('./', '');
        result += `├── ${name}\n`;
      }

      // Add summary line
      const dirCount = dirs.length - 1; // -1 for the '.' entry
      const fileCount = rootFiles.length;
      result += `\n${dirCount} director${dirCount === 1 ? 'y' : 'ies'}, ${fileCount} file${fileCount === 1 ? '' : 's'}`;

      return result;
    } catch (error) {
      // If our advanced approach fails, use the basic approach
      const findCommand = `find . -maxdepth 2 -type d | grep -v -E '(node_modules|\.git|__pycache__|venv|env|dist|build)' | sort 2>/dev/null`;
      const result = execSync(findCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 10000
      });
      return `Directory structure:\n${result.trim()}`;
    }
  }

  /**
   * Command 2: Tech stack discovery by finding dependency files
   */
  private async getTechStack(): Promise<string> {
    try {
      const findCommand = `find . -maxdepth 2 \\( -name "package.json" -o -name "requirements.txt" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pom.xml" -o -name "composer.json" \\) -exec echo "=== {} ===" \\; -exec head -20 {} \\; 2>/dev/null`;

      const result = execSync(findCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 10000
      });

      if (result.trim()) {
        return result.trim();
      } else {
        // If the find command didn't error but found nothing, try more direct approach
        return this.detectTechStackFallback();
      }
    } catch (error) {
      // If find command fails, try manual detection approach
      return this.detectTechStackFallback();
    }
  }

  /**
   * Fallback method for tech stack detection when the find command fails
   * Uses direct file checks and simple content analysis
   */
  private detectTechStackFallback(): string {
    try {
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
        { file: 'build.gradle', type: 'Java/Gradle' }
      ];

      for (const check of fileChecks) {
        const filePath = path.join(projectRoot, check.file);
        if (fs.existsSync(filePath)) {
          result += `=== ./${check.file} ===\n`;
          try {
            // Read just the first few lines
            const content = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 15).join('\n');
            result += content + '\n...(truncated)...\n\n';
          } catch (readError) {
            // Silently ignore read errors
            result += '\n';
          }
        }
      }

      // Additional logic for typescript detection
      const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
      if (fs.existsSync(tsConfigPath)) {
        result += '=== ./tsconfig.json ===\n[TypeScript project detected]\n\n';
      }

      // Silently return empty string if nothing was found
      return result.trim();
    } catch (error) {
      // Silent error handling
      return '';
    }
  }

  /**
   * Command 3: Entry points and README discovery
   */
  private async getEntryPoints(): Promise<string[]> {
    try {
      const findCommand = `find . -maxdepth 2 \\( -name "README*" -o -name "main.*" -o -name "app.*" -o -name "index.*" \\) | head -5 2>/dev/null`;

      const result = execSync(findCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        timeout: 10000
      });

      return result.trim().split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      // Fallback: direct file checking
      try {
        const entries = [];
        const projectRoot = this.workingDirectory;

        // Common entry point patterns
        const patterns = [
          'README.md', 'README.txt', 'README',
          'index.js', 'index.ts', 'index.py', 'index.php',
          'main.js', 'main.ts', 'main.py', 'main.go',
          'app.js', 'app.ts', 'app.py'
        ];

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

        return entries;
      } catch (fallbackError) {
        // Silent fallback - empty array
        return [];
      }
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
