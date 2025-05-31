import * as fs from 'fs-extra';
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
      this.logger.error('Cache validation failed', { error });
      return true;
    }
  }

  // ... rest of the implementation remains the same as previously shown ...
}
