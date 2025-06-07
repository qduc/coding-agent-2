/**
 * Tests for Ripgrep Tool - Practical test cases only
 */

import { RipgrepTool, RipgrepParams, RipgrepResult } from './ripgrep';
import { ToolError } from './types';
import fs from 'fs-extra';
import * as path from 'path';

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
    await fs.ensureDir(path.join(tempDir, 'src'));

    await fs.writeFile(
      path.join(tempDir, 'src', 'auth.js'),
      `function login(user, password) {
  if (!user || !password) {
    throw new Error('UserNotFound');
  }
  return authenticate(user, password);
}

const API_ENDPOINT = '/api/v1/users';
`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'api.js'),
      `const express = require('express');

app.get('/api/v1/users', (req, res) => {
  res.json({ users: [] });
});
`
    );

    await fs.writeFile(
      path.join(tempDir, 'README.md'),
      `# Project

This project has UserNotFound errors.
`
    );
  };

  describe('Basic Functionality', () => {
    it('should be properly initialized', () => {
      expect(ripgrepTool.name).toBe('ripgrep');
      expect(ripgrepTool.description).toContain('Fast text search');
      expect(ripgrepTool.schema.required).toContain('pattern');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty pattern', async () => {
      const result = await ripgrepTool.execute({ pattern: '' });

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

    it('should accept file as search path', async () => {
      await createTestFiles();
      const filePath = path.join(tempDir, 'src', 'auth.js');

      const result = await ripgrepTool.execute({
        pattern: 'login',
        path: filePath
      });

      expect(result.success).toBe(true);
      const data = result.output as RipgrepResult;
      expect(data.matches.length).toBeGreaterThan(0);
      // When searching a single file, should return just the filename
      expect(data.matches[0].file).toBe('auth.js');
    });
  });

  describe('Basic Search', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should find text matches', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);

      const match = output.matches.find(m => m.file.includes('auth.js'));
      expect(match).toBeDefined();
      expect(match?.matchedText).toBe('UserNotFound');
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

    it('should return empty results for no matches', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'nonexistentpattern12345',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBe(0);
    });

    it('should respect maxResults limit', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api',
        path: tempDir,
        maxResults: 1
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Security Features', () => {
    it('should block node_modules directory', async () => {
      await createTestFiles();

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

      const blockedMatches = output.matches.filter(m =>
        m.file.includes('node_modules')
      );
      expect(blockedMatches.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should provide basic search statistics', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'api',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      expect(output.stats).toBeDefined();
      expect(output.stats.executionTime).toBeGreaterThanOrEqual(0);
      expect(output.totalMatches).toBe(output.matches.length);
    });
  });

  describe('Real-world Use Cases', () => {
    beforeEach(async () => {
      await createTestFiles();
    });

    it('should find function definitions', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'function login',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should find API endpoints', async () => {
      const result = await ripgrepTool.execute({
        pattern: '/api/v1/users',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should search across multiple file types', async () => {
      const result = await ripgrepTool.execute({
        pattern: 'UserNotFound',
        path: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as RipgrepResult;

      // Should find in both .js and .md files
      const jsMatch = output.matches.find(m => m.file.endsWith('.js'));
      const mdMatch = output.matches.find(m => m.file.endsWith('.md'));

      expect(jsMatch).toBeDefined();
      expect(mdMatch).toBeDefined();
    });
  });
});
