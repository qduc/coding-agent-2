import fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';
import { ProjectCacheMetadata, CodeStructureAnalysis } from './codeStructure';
import { Logger } from './logger';

export interface CachedProjectAnalysis {
  metadata: ProjectCacheMetadata;
  codeStructure: CodeStructureAnalysis;
  projectStructure: string;
  techStack: string;
  entryPoints: string[];
  summary: string;
}

export class ProjectCacheManager {
  private cacheDir: string;
  private readonly CACHE_VERSION = '1.0.0';
  private logger: Logger = Logger.getInstance();

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(os.homedir(), '.coding-agent', 'cache');
    fs.ensureDirSync(this.cacheDir);
  }

  async shouldInvalidateCache(projectPath: string): Promise<boolean> {
    try {
      const cacheFile = this.getCacheFilePath(projectPath);
      if (!await fs.pathExists(cacheFile)) {
        this.logger.debug('Cache does not exist', { cacheFile });
        return true;
      }

      const cached = await fs.readJson(cacheFile);
      if (cached.metadata.version !== this.CACHE_VERSION) {
        this.logger.debug('Cache version mismatch', {
          cachedVersion: cached.metadata.version,
          currentVersion: this.CACHE_VERSION
        });
        return true;
      }

      const metadata = await this.generateCacheMetadata(projectPath);
      const maxAgeMs = (cached.metadata.maxCacheAgeHours || 24) * 60 * 60 * 1000;
      const cacheAge = Date.now() - new Date(cached.metadata.lastAnalyzed).getTime();

      if (cacheAge > maxAgeMs) {
        this.logger.debug('Cache expired', {
          ageHours: cacheAge / (60 * 60 * 1000),
          maxAgeHours: maxAgeMs / (60 * 60 * 1000)
        });
        return true;
      }

      if (cached.metadata.gitCommitHash &&
          cached.metadata.gitCommitHash !== metadata.gitCommitHash) {
        this.logger.debug('Git commit hash changed', {
          oldHash: cached.metadata.gitCommitHash,
          newHash: metadata.gitCommitHash
        });
        return true;
      }

      if (cached.metadata.configFilesHash !== metadata.configFilesHash) {
        this.logger.debug('Config files changed', {
          oldHash: cached.metadata.configFilesHash,
          newHash: metadata.configFilesHash
        });
        return true;
      }

      if (cached.metadata.directoryStructureHash !== metadata.directoryStructureHash) {
        this.logger.debug('Directory structure changed', {
          oldHash: cached.metadata.directoryStructureHash,
          newHash: metadata.directoryStructureHash
        });
        return true;
      }

      this.logger.debug('Cache is valid');
      return false;
    } catch (error) {
      this.logger.error('Cache validation failed', error as Error);
      return true;
    }
  }

  async getCache(projectPath: string): Promise<CachedProjectAnalysis | null> {
    try {
      const cacheFile = this.getCacheFilePath(projectPath);
      if (await fs.pathExists(cacheFile)) {
        return await fs.readJson(cacheFile);
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to read cache', error as Error);
      return null;
    }
  }

  async saveCache(projectPath: string, analysis: CachedProjectAnalysis): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(projectPath);
      await fs.ensureDir(path.dirname(cacheFile));
      await fs.writeJson(cacheFile, analysis, { spaces: 2 });
      this.logger.debug('Cache saved successfully', { cacheFile });
    } catch (error) {
      this.logger.error('Failed to save cache', error as Error);
    }
  }

  async generateCacheMetadata(projectPath: string): Promise<ProjectCacheMetadata> {
    const configFiles = ['package.json', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml'];
    const configFilesHash = await this.hashConfigFiles(projectPath, configFiles);
    const directoryStructureHash = await this.hashDirectoryStructure(projectPath);
    const gitCommitHash = await this.getGitCommitHash(projectPath);
    const fileCountByDirectory = await this.getFileCountByDirectory(projectPath);
    const entryPointsMtime = await this.getEntryPointsMtime(projectPath);

    return {
      version: this.CACHE_VERSION,
      lastAnalyzed: new Date(),
      projectPath,
      gitCommitHash,
      configFilesHash,
      directoryStructureHash,
      fileCountByDirectory,
      entryPointsMtime,
      maxCacheAgeHours: 24
    };
  }

  private getCacheFilePath(projectPath: string): string {
    const projectHash = crypto.createHash('md5').update(projectPath).digest('hex');
    return path.join(this.cacheDir, `${projectHash}.json`);
  }

  private async hashConfigFiles(projectPath: string, configFiles: string[]): Promise<string> {
    const hash = crypto.createHash('md5');

    for (const file of configFiles) {
      const filePath = path.join(projectPath, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8');
        hash.update(content);
      }
    }

    return hash.digest('hex');
  }

  private async hashDirectoryStructure(projectPath: string): Promise<string> {
    const hash = crypto.createHash('md5');

    const walk = async (dir: string, relativePath: string = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of sortedEntries) {
          if (entry.name.startsWith('.git')) continue;
          if (entry.name === 'node_modules') continue;

          const entryPath = path.join(relativePath, entry.name);
          hash.update(`${entry.isDirectory() ? 'D' : 'F'}:${entryPath}\n`);

          if (entry.isDirectory()) {
            await walk(path.join(dir, entry.name), entryPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(projectPath);
    return hash.digest('hex');
  }

  private async getGitCommitHash(projectPath: string): Promise<string | undefined> {
    try {
      const gitDir = path.join(projectPath, '.git');
      if (await fs.pathExists(gitDir)) {
        const result = execSync('git rev-parse HEAD', {
          cwd: projectPath,
          encoding: 'utf-8'
        });
        return result.trim();
      }
    } catch (error) {
      // Git not available or not a git repo
    }
    return undefined;
  }

  private async getFileCountByDirectory(projectPath: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const walk = async (dir: string, relativePath: string = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let fileCount = 0;

        for (const entry of entries) {
          if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;

          if (entry.isFile()) {
            fileCount++;
          } else if (entry.isDirectory()) {
            const subPath = path.join(relativePath, entry.name);
            await walk(path.join(dir, entry.name), subPath);
          }
        }

        if (fileCount > 0) {
          counts[relativePath || '.'] = fileCount;
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(projectPath);
    return counts;
  }

  private async getEntryPointsMtime(projectPath: string): Promise<Record<string, Date>> {
    const entryPoints = ['package.json', 'index.js', 'index.ts', 'main.py', 'src/main.ts'];
    const mtimes: Record<string, Date> = {};

    for (const entryPoint of entryPoints) {
      const filePath = path.join(projectPath, entryPoint);
      try {
        const stats = await fs.stat(filePath);
        mtimes[entryPoint] = stats.mtime;
      } catch (error) {
        // File doesn't exist
      }
    }

    return mtimes;
  }
}
