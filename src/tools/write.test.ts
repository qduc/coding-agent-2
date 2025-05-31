/**
 * Tests for Write Tool - File writing and modification with safety features
 *
 * Comprehensive test suite covering:
 * - Basic file writing (create, append, overwrite)
 * - Backup creation and restore
 * - Directory creation
 * - Encoding support (utf8, binary, base64)
 * - File size limits
 * - Security validation and blocked paths
 * - Error cases (file exists, permission denied, invalid params, etc.)
 * - Edge cases and boundary conditions
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WriteTool, WriteParams, WriteResult } from './write';
import { ToolError, ToolContext } from './types';

describe('WriteTool', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-test-'));
    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 1024 * 1024, // 1MB
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.txt', '.md', '.json'],
      blockedPaths: ['node_modules', '.git', '.env']
    };
    writeTool = new WriteTool(testContext);
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(writeTool.name).toBe('write');
    });
    it('should have a description', () => {
      expect(writeTool.description).toBeDefined();
      expect(typeof writeTool.description).toBe('string');
      expect(writeTool.description.length).toBeGreaterThan(0);
    });
    it('should have valid schema', () => {
      const schema = writeTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('path');
      expect(schema.required).toContain('content');
      expect(schema.properties.path.type).toBe('string');
      expect(schema.properties.content.type).toBe('string');
      expect(schema.properties.encoding.enum).toContain('utf8');
      expect(schema.properties.mode.enum).toContain('create');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const result = await writeTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
    it('should validate path type', async () => {
      const result = await writeTool.execute({ path: 123, content: 'abc' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
    it('should validate encoding enum', async () => {
      const result = await writeTool.execute({ path: 'file.txt', content: 'abc', encoding: 'invalid' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
    it('should validate mode enum', async () => {
      const result = await writeTool.execute({ path: 'file.txt', content: 'abc', mode: 'invalid' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Basic File Writing', () => {
    it('should create a new file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const result = await writeTool.execute({ path: filePath, content: 'hello' });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('hello');
    });
    it('should not overwrite existing file in create mode', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'old');
      const result = await writeTool.execute({ path: filePath, content: 'new', mode: 'create' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
      expect(await fs.readFile(filePath, 'utf8')).toBe('old');
    });
    it('should overwrite file in overwrite mode', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'old');
      const result = await writeTool.execute({ path: filePath, content: 'new', mode: 'overwrite' });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('new');
    });
    it('should append to file in append mode', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'a');
      const result = await writeTool.execute({ path: filePath, content: 'b', mode: 'append' });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('ab');
    });
    it('should create parent directories if needed', async () => {
      const filePath = path.join(tempDir, 'a', 'b', 'c.txt');
      const result = await writeTool.execute({ path: filePath, content: 'x', createDirs: true });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('x');
    });
  });

  describe('Backup and Restore', () => {
    it('should create a backup when overwriting', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'old');
      const result = await writeTool.execute({ path: filePath, content: 'new', mode: 'overwrite', backup: true });
      expect(result.success).toBe(true);
      const backupPath = (result.output as WriteResult).backupPath;
      expect(backupPath).toBeDefined();
      expect(await fs.readFile(backupPath!, 'utf8')).toBe('old');
    });
  });

  describe('Encoding Support', () => {
    it('should write utf8 by default', async () => {
      const filePath = path.join(tempDir, 'utf8.txt');
      const result = await writeTool.execute({ path: filePath, content: 'héllo' });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('héllo');
    });
    it('should write binary content', async () => {
      const filePath = path.join(tempDir, 'bin.txt');
      const content = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString('binary');
      const result = await writeTool.execute({ path: filePath, content, encoding: 'binary' });
      expect(result.success).toBe(true);
      const buf = await fs.readFile(filePath);
      expect(buf[0]).toBe(0x00);
      expect(buf[1]).toBe(0x01);
    });
    it('should write base64 content', async () => {
      const filePath = path.join(tempDir, 'b64.txt');
      const content = Buffer.from('hello').toString('base64');
      const result = await writeTool.execute({ path: filePath, content, encoding: 'base64' });
      expect(result.success).toBe(true);
      const buf = await fs.readFile(filePath);
      expect(buf.toString('base64')).toBe(content);
    });
  });

  describe('File Size Limits', () => {
    it('should enforce file size limits', async () => {
      const smallContext = { ...testContext, maxFileSize: 10 };
      const smallTool = new WriteTool(smallContext);
      const filePath = path.join(tempDir, 'big.txt');
      const result = await smallTool.execute({ path: filePath, content: 'x'.repeat(100) });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('Security and Blocked Paths', () => {
    it('should block writing to node_modules', async () => {
      const filePath = path.join(tempDir, 'node_modules', 'bad.txt');
      const result = await writeTool.execute({ path: filePath, content: 'x' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });
    it('should block writing to .env', async () => {
      const filePath = path.join(tempDir, '.env');
      const result = await writeTool.execute({ path: filePath, content: 'SECRET' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });
    it('should respect allowedExtensions', async () => {
      const restrictiveContext = { ...testContext, allowedExtensions: ['.md'] };
      const restrictiveTool = new WriteTool(restrictiveContext);
      const filePath = path.join(tempDir, 'file.txt');
      const result = await restrictiveTool.execute({ path: filePath, content: 'x' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_FILE_TYPE');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid path', async () => {
      const result = await writeTool.execute({ path: '/dev/null/invalid', content: 'x' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_PATH');
    });
    it('should handle permission denied', async () => {
      if (process.platform !== 'win32') {
        const filePath = path.join(tempDir, 'restricted.txt');
        await fs.writeFile(filePath, 'x');
        await fs.chmod(filePath, 0o000);
        const result = await writeTool.execute({ path: filePath, content: 'y', mode: 'overwrite' });
        expect(result.success).toBe(false);
        expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
        await fs.chmod(filePath, 0o644);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const filePath = path.join(tempDir, 'empty.txt');
      const result = await writeTool.execute({ path: filePath, content: '' });
      expect(result.success).toBe(true);
      expect(await fs.readFile(filePath, 'utf8')).toBe('');
    });
    it('should handle relative paths', async () => {
      const filePath = 'rel.txt';
      const cwd = process.cwd();
      process.chdir(tempDir);
      try {
        const result = await writeTool.execute({ path: filePath, content: 'rel' });
        expect(result.success).toBe(true);
        expect(await fs.readFile(path.join(tempDir, filePath), 'utf8')).toBe('rel');
      } finally {
        process.chdir(cwd);
      }
    });
    it('should handle symlinks if supported', async () => {
      const target = path.join(tempDir, 'target.txt');
      const symlink = path.join(tempDir, 'link.txt');
      await fs.writeFile(target, 'target');
      try {
        await fs.symlink(target, symlink);
        const result = await writeTool.execute({ path: symlink, content: 'new', mode: 'overwrite' });
        expect(result.success).toBe(true);
        expect(await fs.readFile(target, 'utf8')).toBe('new');
      } catch (e) {
        if ((e as any).code !== 'EPERM') throw e;
      }
    });
  });
});
