/**
 * Tests for Ripgrep Tool
 */

import { RipgrepTool, RipgrepParams, RipgrepResult } from './ripgrep';
import { ToolError } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('RipgrepTool', () => {
  let ripgrepTool: RipgrepTool;
  let tempDir: string;

  beforeEach(async () => {
    ripgrepTool = new RipgrepTool();
    const tmpBase = path.join(__dirname, 'tmp');
    await fs.ensureDir(tmpBase);
    tempDir = await fs.mkdtemp(path.join(tmpBase, 'ripgrep-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const createTestFiles = async () => {
    // Create test directory structure with various file types
    await fs.ensureDir(path.join(tempDir, 'src'));
    await fs.ensureDir(path.join(tempDir, 'tests'));
    await fs.ensureDir(path.join(tempDir, 'docs'));

    // JavaScript files
    await fs.writeFile(
      path.join(tempDir, 'src', 'auth.js'),
      `function login(user, password) {
  if (!user || !password) {
    throw new Error('UserNotFound');
  }
  return authenticate(user, password);
}

function logout(session) {
  session.destroy();
}

const API_ENDPOINT = '/api/v1/users';
`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'api.js'),
      `const express = require('express');
const app = express();

app.get('/api/v1/users', (req, res) => {
  // Legacy endpoint - to be deprecated
  res.json({ users: [] });
});

app.post('/api/v2/users', (req, res) => {
  // New endpoint
  res.json({ success: true });
});
`
    );

    // TypeScript files
    await fs.writeFile(
      path.join(tempDir, 'src', 'database.ts'),
      `import { Connection } from 'mysql';

export class Database {
  private connection: Connection;

  async connect(): Promise<void> {
    this.connection = await db.connect();
  }

  async query(sql: string): Promise<any[]> {
    return this.connection.query(sql);
  }

  async exec(command: string): Promise<void> {
    await this.connection.exec(command);
  }
}
`
    );

    // Test files
    await fs.writeFile(
      path.join(tempDir, 'tests', 'auth.test.js'),
      `describe('Authentication', () => {
  it('should throw UserNotFound for invalid credentials', () => {
    expect(() => login('', '')).toThrow('UserNotFound');
  });

  it('should handle /api/v1/users endpoint', () => {
    // Test legacy endpoint
    expect(true).toBe(true);
  });
});
`
    );

    // Documentation
    await fs.writeFile(
      path.join(tempDir, 'docs', 'api.md'),
      `# API Documentation

## Authentication Endpoints

- \`POST /api/v1/users\` - Legacy endpoint (deprecated)
- \`POST /api/v2/users\` - New user creation endpoint

## Error Handling

The API may return \`UserNotFound\` errors in certain cases.
`
    );

    // Hidden file
    await fs.writeFile(
      path.join(tempDir, '.env'),
      `API_KEY=secret123
PASSWORD=supersecret
`
    );
  };

  describe('Basic Functionality', () => {
    it('should be properly initialized', () => {
      expect(ripgrepTool.name).toBe('ripgrep');
      expect(ripgrepTool.description).toContain('Fast text search');
    });

    it('should have correct schema', () => {
      const schema = ripgrepTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties.pattern).toBeDefined();
      expect(schema.required).toContain('pattern');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty pattern', async () => {
      const result = await ripgrepTool.execute({
        pattern: ''
      });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.message).toContain('pattern cannot be empty');
    });

    it('should reject invalid search path', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'test',
        path: '/nonexistent/path'
      });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.message).toContain('Invalid search path');
    });

    it('should reject file as search path', async () => {
      await createTestFiles();
      const filePath = path.join(tempDir, 'src', 'auth.js');

      const result = await ripgrepTool.execute({
        pattern: 'test',
        path: filePath
      });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.message).toContain('not a directory');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should find basic text matches', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      const match = output.matches.find(
        m => m.matchedText === 'UserNotFound' && m.file.includes('auth.js')
      );
      expect(match).toBeDefined();
    });

    it('should support case-insensitive search', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'usernotfound',
        path: tempDir,
        ignoreCase: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should filter by file types', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir,
        types: ['js']
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      // Should find matches in .js files but not in .md files
      const jsMatches = output.matches.filter(m => m.file.endsWith('.js'));
      const mdMatches = output.matches.filter(m => m.file.endsWith('.md'));

      expect(jsMatches.length).toBeGreaterThan(0);
      expect(mdMatches.length).toBe(0);
    });

    it('should filter by extensions', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'database',
        path: tempDir,
        extensions: ['.ts']
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      // Should only find matches in .ts files
      output.matches.forEach(match => {
        expect(match.file).toMatch(/\.ts$/);
      });
    });

    it('should support regex patterns', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api/(v[12])/users',
        path: tempDir,
        regex: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should provide context lines', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir,
        before: 2,
        after: 1
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      const match = output.matches.find(m => m.beforeContext && m.afterContext);
      expect(match).toBeDefined();
      expect(match!.beforeContext!.length).toBeGreaterThan(0);
      expect(match!.afterContext!.length).toBeGreaterThan(0);
    });

    it('should respect maxResults limit', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api',
        path: tempDir,
        maxResults: 2
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeLessThanOrEqual(2);
    });

    it('should include hidden files when requested', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'secret',
        path: tempDir,
        includeHidden: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      const hiddenMatch = output.matches.find(m => m.file.includes('.env'));
      expect(hiddenMatch).toBeDefined();
    });

    it('should exclude hidden files by default', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'secret',
        path: tempDir,
        includeHidden: false
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      const hiddenMatch = output.matches.find(m => m.file.includes('.env'));
      expect(hiddenMatch).toBeUndefined();
    });
  });

  describe('Search Statistics', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should provide search statistics', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api',
        path: tempDir,
        stats: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      expect(output.stats).toBeDefined();
      expect(output.stats.filesSearched).toBeGreaterThan(0);
      expect(output.stats.matchesFound).toBeGreaterThan(0);
      expect(output.stats.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Security and Blocked Paths', () => {
    it('should respect blocked paths', async () => {
      await createTestFiles();

      // Create a node_modules directory with content
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await fs.writeFile(
        path.join(nodeModulesDir, 'package.js'),
        'const blocked = "this should not be found";'
      );

      const result = await ripgrepTool.execute({
        pattern: 'blocked',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      // Should not find matches in node_modules
      const blockedMatches = output.matches.filter(m =>
        m.file.includes('node_modules')
      );
      expect(blockedMatches.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid regex patterns', async () => {
      await createTestFiles();

      const result = await ripgrepTool.execute({
        pattern: '[unclosed',
        path: tempDir,
        regex: true
      });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.message).toContain('Invalid regex pattern');
    });

    it('should return empty results for no matches', async () => {
      await createTestFiles();

      const result = await ripgrepTool.execute({
        pattern: 'nonexistentpattern12345',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBe(0);
      expect(output.stats.matchesFound).toBe(0);
    });
  });

  describe('File Type Mappings', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should support web file types', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api',
        path: tempDir,
        types: ['web']
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      // Should find matches in JS/TS files but not MD files
      const webMatches = output.matches.filter(m =>
        m.file.endsWith('.js') || m.file.endsWith('.ts')
      );
      const nonWebMatches = output.matches.filter(m =>
        m.file.endsWith('.md')
      );

      expect(webMatches.length).toBeGreaterThan(0);
      expect(nonWebMatches.length).toBe(0);
    });
  });

  describe('Use Case Examples', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should support code archaeology use case', async () => {
      // Find all auth-related code with context
      const result = await ripgrepTool.execute({
        pattern: 'auth|login|session',
        path: tempDir,
        regex: true,
        types: ['js'],
        before: 3,
        after: 3
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      // Should have context lines
      const matchWithContext = output.matches.find(m =>
        m.beforeContext || m.afterContext
      );
      expect(matchWithContext).toBeDefined();
    });

    it('should support bug detective use case', async () => {
      // Find error with line numbers and headings
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir,
        lineNumbers: true,
        heading: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      const match = output.matches[0];
      expect(match.lineNumber).toBeGreaterThan(0);
      expect(match.file).toBeDefined();
    });

    it('should support API migration use case', async () => {
      // Find all references to old API endpoint
      const result = await ripgrepTool.execute({
        pattern: '/api/v1/users',
        path: tempDir,
        types: ['web']
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      // Should find in both code and test files
      const codeMatch = output.matches.find(m => m.file.includes('src/'));
      const testMatch = output.matches.find(m => m.file.includes('tests/'));

      expect(codeMatch).toBeDefined();
      expect(testMatch).toBeDefined();
    });

    it('should support pattern mining use case', async () => {
      // Find database connection patterns
      const result = await ripgrepTool.execute({
        pattern: 'db\\.(connect|query|exec)',
        path: tempDir,
        regex: true,
        after: 2,
        group: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should support security sweep use case', async () => {
      // Find potential secrets
      const result = await ripgrepTool.execute({
        pattern: '(password|api_key|secret).{0,20}=.{0,50}',
        path: tempDir,
        regex: true,
        ignoreCase: true,
        includeHidden: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      // Should find in .env file
      const envMatch = output.matches.find(m => m.file.includes('.env'));
      expect(envMatch).toBeDefined();
    });

    it('should support refactoring reconnaissance use case', async () => {
      // Find function usage with stats
      const result = await ripgrepTool.execute({
        pattern: 'login',
        path: tempDir,
        stats: true
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.stats.matchesFound).toBeGreaterThan(0);
      expect(output.stats.filesSearched).toBeGreaterThan(0);
      expect(output.totalMatches).toBe(output.matches.length);
    });
  });
});
