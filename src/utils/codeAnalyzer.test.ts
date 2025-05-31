import { describe, it, expect, beforeEach } from '@jest/globals';
import { CodeAnalyzer } from '../utils/codeAnalyzer';
import { TreeSitterParser } from '../utils/treeSitterParser';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('CodeAnalyzer', () => {
  let codeAnalyzer: CodeAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    codeAnalyzer = new CodeAnalyzer({
      maxFiles: 10,
      maxFileSize: 1024 * 100, // 100KB for testing
      maxTotalSize: 1024 * 500, // 500KB for testing
      timeoutMs: 5000
    });

    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-analyzer-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  it('should analyze TypeScript files and extract symbols', async () => {
    // Create a sample TypeScript file
    const tsFile = path.join(tempDir, 'sample.ts');
    const tsContent = `
export interface User {
  id: number;
  name: string;
}

export class UserService {
  async getUser(id: number): Promise<User> {
    return { id, name: 'Test User' };
  }

  createUser(user: User): void {
    console.log('Creating user:', user);
  }
}

export const DEFAULT_CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};

export function formatUserName(user: User): string {
  return user.name.toUpperCase();
}
`;

    await fs.writeFile(tsFile, tsContent);

    const result = await codeAnalyzer.analyzeProject(tempDir);

    expect(result).toBeDefined();
    expect(result.codeStructure).toBeDefined();
    expect(result.codeStructure.files).toHaveLength(1);

    const fileAnalysis = result.codeStructure.files[0];
    expect(fileAnalysis.language).toBe('typescript');
    expect(fileAnalysis.symbols.length).toBeGreaterThan(0);

    // Check for extracted symbols
    const symbolNames = fileAnalysis.symbols.map(s => s.name);
    expect(symbolNames).toContain('User');
    expect(symbolNames).toContain('UserService');
    expect(symbolNames).toContain('DEFAULT_CONFIG');
    expect(symbolNames).toContain('formatUserName');

    // Check symbol types
    const userInterface = fileAnalysis.symbols.find(s => s.name === 'User');
    expect(userInterface?.type).toBe('interface');
    expect(userInterface?.isExported).toBe(true);

    const userServiceClass = fileAnalysis.symbols.find(s => s.name === 'UserService');
    expect(userServiceClass?.type).toBe('class');
    expect(userServiceClass?.isExported).toBe(true);

    const formatFunction = fileAnalysis.symbols.find(s => s.name === 'formatUserName');
    expect(formatFunction?.type).toBe('function');
    expect(formatFunction?.isExported).toBe(true);
  });

  it('should handle multiple file types', async () => {
    // Create JavaScript file
    const jsFile = path.join(tempDir, 'utils.js');
    await fs.writeFile(jsFile, `
function helper() {
  return 'helper';
}

const config = { debug: true };
`);

    // Create Python file
    const pyFile = path.join(tempDir, 'script.py');
    await fs.writeFile(pyFile, `
def process_data(data):
    return data.upper()

class DataProcessor:
    def __init__(self):
        self.processed = []
`);

    const result = await codeAnalyzer.analyzeProject(tempDir);

    expect(result.codeStructure.files).toHaveLength(2);
    expect(result.codeStructure.languageBreakdown).toHaveProperty('javascript');
    expect(result.codeStructure.languageBreakdown).toHaveProperty('python');
  });

  it('should respect file size and count limits', async () => {
    const limitedAnalyzer = new CodeAnalyzer({
      maxFiles: 2,
      maxFileSize: 100, // Very small limit
      maxTotalSize: 1024
    });

    // Create multiple files
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(
        path.join(tempDir, `file${i}.ts`),
        `export function func${i}() { return ${i}; }`
      );
    }

    const result = await limitedAnalyzer.analyzeProject(tempDir);

    // Should respect maxFiles limit
    expect(result.codeStructure.files.length).toBeLessThanOrEqual(2);
  });
});

describe('TreeSitterParser', () => {
  let parser: TreeSitterParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should parse TypeScript functions correctly', async () => {
    const file = path.join(tempDir, 'test.ts');
    await fs.writeFile(file, `
export async function fetchData(url: string): Promise<any> {
  return fetch(url);
}

const processData = (data: any) => {
  return data.map(item => item.id);
};
`);

    const analysis = await parser.analyzeFile(file);

    expect(analysis.language).toBe('typescript');
    expect(analysis.symbols.length).toBeGreaterThan(0);

    const fetchFunction = analysis.symbols.find(s => s.name === 'fetchData');
    expect(fetchFunction).toBeDefined();
    expect(fetchFunction?.type).toBe('function');
    expect(fetchFunction?.isAsync).toBe(true);
    expect(fetchFunction?.isExported).toBe(true);

    const processFunction = analysis.symbols.find(s => s.name === 'processData');
    expect(processFunction).toBeDefined();
    expect(processFunction?.type).toBe('function');
  });

  it('should extract imports and exports', async () => {
    const file = path.join(tempDir, 'imports.ts');
    await fs.writeFile(file, `
import { Component } from 'react';
import fs from 'fs';
import * as path from 'path';

export { Component };
export default class MyComponent extends Component {}
`);

    const analysis = await parser.analyzeFile(file);

    expect(analysis.imports).toContain('react');
    expect(analysis.imports).toContain('fs');
    expect(analysis.imports).toContain('path');
    expect(analysis.exports.length).toBeGreaterThan(0);
  });
});
