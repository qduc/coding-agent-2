import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProjectDiscovery } from '../utils/projectDiscovery';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('ProjectDiscovery with Code Analysis', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-discovery-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should discover project with code structure analysis', async () => {
    // Create a mini TypeScript project
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'express': '^4.18.0',
        'typescript': '^5.0.0'
      },
      scripts: {
        start: 'node dist/index.js',
        build: 'tsc'
      }
    }, null, 2));

    await fs.writeFile(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist'
      }
    }, null, 2));

    // Create source files
    await fs.ensureDir(path.join(tempDir, 'src'));

    await fs.writeFile(path.join(tempDir, 'src/index.ts'), `
import express from 'express';
import { UserService } from './services/userService';

const app = express();
const userService = new UserService();

app.get('/users/:id', async (req, res) => {
  const user = await userService.getUser(parseInt(req.params.id));
  res.json(user);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`);

    await fs.ensureDir(path.join(tempDir, 'src/services'));
    await fs.writeFile(path.join(tempDir, 'src/services/userService.ts'), `
export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  async getUser(id: number): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Date.now(),
      ...userData
    };
    this.users.push(user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }
}
`);

    await fs.writeFile(path.join(tempDir, 'README.md'), `
# Test Project

This is a test Express.js TypeScript project.

## Features
- User management API
- TypeScript support
- Express.js web server
`);

    const discovery = new ProjectDiscovery(tempDir, true);
    const result = await discovery.discover();

    // Basic project discovery
    expect(result.projectStructure).toContain('src/');
    expect(result.projectStructure).toContain('package.json');
    expect(result.techStack).toContain('express');
    expect(result.techStack).toContain('typescript');
    expect(result.entryPoints).toContain('src/index.ts');

    // Code structure analysis
    expect(result.codeStructure).toBeDefined();
    expect(result.codeStructure!.files.length).toBeGreaterThan(0);
    expect(result.codeStructure!.languageBreakdown.typescript).toBeGreaterThan(0);
    expect(result.codeStructure!.totalSymbols).toBeGreaterThan(0);

    // Check for specific symbols
    const userServiceFile = result.codeStructure!.files.find(f =>
      f.filePath.includes('userService.ts')
    );
    expect(userServiceFile).toBeDefined();
    expect(userServiceFile!.symbols.some(s => s.name === 'User')).toBe(true);
    expect(userServiceFile!.symbols.some(s => s.name === 'UserService')).toBe(true);
    expect(userServiceFile!.imports).toHaveLength(0); // No imports in this file
    expect(userServiceFile!.exports.length).toBeGreaterThan(0);

    // Analysis metadata
    expect(result.analysisMetadata).toBeDefined();
    expect(result.analysisMetadata!.filesAnalyzed).toBeGreaterThan(0);
    expect(result.analysisMetadata!.limitationsApplied).toBeDefined();

    // Summary should mention code analysis
    expect(result.summary).toContain('TypeScript');
    expect(result.executedAt).toBeInstanceOf(Date);
  });

  it('should handle projects without code analysis enabled', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'simple-project',
      version: '1.0.0'
    }, null, 2));

    const discovery = new ProjectDiscovery(tempDir, false);
    const result = await discovery.discover();

    expect(result.codeStructure).toBeUndefined();
    expect(result.analysisMetadata).toBeDefined();
    expect(result.analysisMetadata!.filesAnalyzed).toBe(0);
  });

  it('should gracefully handle code analysis failures', async () => {
    // Create a normal package.json
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'failure-test',
      version: '1.0.0'
    }, null, 2));

    // Mock the CodeAnalyzer to throw an error
    const discovery = new ProjectDiscovery(tempDir, true);
    const originalAnalyzeProject = discovery['codeAnalyzer'].analyzeProject;
    discovery['codeAnalyzer'].analyzeProject = jest.fn().mockRejectedValue(new Error('Mock analysis failure'));

    const result = await discovery.discover();

    // Should still return basic project info even if code analysis fails
    expect(result.projectStructure).toBeDefined();
    expect(result.techStack).toBeDefined();
    expect(result.analysisMetadata!.limitationsApplied).toContain('Code analysis failed');

    // Restore original method
    discovery['codeAnalyzer'].analyzeProject = originalAnalyzeProject;
  });

  it('should provide performance metrics', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'perf-test',
      version: '1.0.0'
    }, null, 2));

    await fs.writeFile(path.join(tempDir, 'index.js'), `
function test() {
  console.log('Hello world');
}
`);

    const startTime = Date.now();
    const discovery = new ProjectDiscovery(tempDir, true);
    const result = await discovery.discover();
    const endTime = Date.now();

    expect(result.codeStructure?.analysisTimeMs).toBeDefined();
    expect(result.codeStructure!.analysisTimeMs).toBeGreaterThan(0);
    expect(result.codeStructure!.analysisTimeMs).toBeLessThan(endTime - startTime + 100); // Some tolerance
  });
});
