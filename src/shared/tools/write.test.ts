/**
 * Tests for Write Tool - File creation and modification
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WriteTool, WriteParams, WriteResult } from './write';
import { ToolError, ToolContext } from './types';
import { toolContextManager } from '../utils/ToolContextManager';

jest.mock('../utils/ToolContextManager', () => {
  const actual = jest.requireActual('../utils/ToolContextManager');
  return {
    toolContextManager: {
      ...actual.toolContextManager,
      recordFileWrite: jest.fn(),
      validateWriteOperation: jest.fn(() => ({
        isValid: true,
        warnings: [],
        suggestions: []
      })),
      validateSearchReplaceOperation: jest.fn(() => ({ isValid: true })),
      reset: actual.toolContextManager.reset?.bind(actual.toolContextManager),
      getFileInfo: actual.toolContextManager.getFileInfo?.bind(actual.toolContextManager)
    }
  };
});
jest.mock('../../cli/approval/ApprovalManager', () => ({
  requestApproval: jest.fn(() => Promise.resolve('approved'))
}));

describe('WriteTool', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-test-'));
    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.txt', '.js', '.ts', '.json', '.md'],
      blockedPaths: ['node_modules', '.git', '.env']
    };
    writeTool = new WriteTool(testContext);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  async function createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(writeTool.name).toBe('write');
    });

    it('should have valid schema', () => {
      const schema = writeTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('path');
      expect(schema.properties.path.type).toBe('string');
      expect(schema.properties.content?.type).toBe('string');
      expect(schema.properties.search?.type).toBe('string');
      expect(schema.properties.replace?.type).toBe('string');
    });
  });

  describe('Parameter Validation', () => {
    it('should require path parameter', async () => {
      const result = await writeTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
    });

    it('should require either content or search parameter', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt')
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Must provide content or search parameter');
    });

    it('should not allow mixing modes', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt'),
        content: 'test content',
        search: 'old text'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Cannot mix modes');
    });

    it('should require replace when search is provided', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt'),
        search: 'old text'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Search-replace mode requires both search and replace');
    });

    it('should validate file extensions', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.exe'),
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_FILE_TYPE');
    });
  });

  describe('Security Validation', () => {
    it('should block writes to blocked paths', async () => {
      const blockedDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(blockedDir);

      const result = await writeTool.execute({
        path: path.join(blockedDir, 'test.txt'),
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should block writes to root directory', async () => {
      const result = await writeTool.execute({
        path: '/test.txt',
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Content Mode', () => {
    it('should create new file with content', async () => {
      const filePath = path.join(tempDir, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await writeTool.execute({
        path: filePath,
        content
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.created).toBe(true);
      expect(output.mode).toBe('create');

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = await createTestFile('existing.txt', 'original content');
      const newContent = 'new content';

      const result = await writeTool.execute({
        path: filePath,
        content: newContent
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.created).toBe(false);
      expect(output.mode).toBe('patch');

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(newContent);
    });

    it('should handle empty content', async () => {
      const filePath = path.join(tempDir, 'empty.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: ''
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('');
    });

    it('should create parent directories', async () => {
      const filePath = path.join(tempDir, 'deep', 'nested', 'file.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: 'nested content'
      });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);
    });
  });

  describe('Search-Replace Mode', () => {
    it('should perform exact string replacement', async () => {
      const filePath = await createTestFile('test.txt', 'Hello old world');

      const result = await writeTool.execute({
        path: filePath,
        search: 'old',
        replace: 'new'
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.mode).toBe('search-replace');
      expect(output.replacements).toBe(1);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('Hello new world');
    });

    it('should handle multiple replacements', async () => {
      const filePath = await createTestFile('test.txt', 'old old old');

      const result = await writeTool.execute({
        path: filePath,
        search: 'old',
        replace: 'new'
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.replacements).toBe(3);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('new new new');
    });

    it('should handle multiline search and replace', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nold content\nline3');

      const result = await writeTool.execute({
        path: filePath,
        search: 'old content',
        replace: 'new content'
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nnew content\nline3');
    });

    it('should fail when search string not found', async () => {
      const filePath = await createTestFile('test.txt', 'Hello world');

      const result = await writeTool.execute({
        path: filePath,
        search: 'nonexistent',
        replace: 'replacement'
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Search string not found');
    });

    it('should fail on non-existent file', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'nonexistent.txt'),
        search: 'old',
        replace: 'new'
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Cannot perform search-replace on non-existent file');
    });

    it('should use fuzzy matching as fallback', async () => {
      const filePath = await createTestFile('test.txt', 'Hello  world\nSecond line');

      // Search for multi-line block with slight differences
      const result = await writeTool.execute({
        path: filePath,
        search: 'Hello world\nSecond line',  // Missing extra space in first line
        replace: 'Goodbye world\nSecond line'
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('Goodbye world');
    });

    it('should fail search-replace if file has not been read yet', async () => {
      const filePath = await createTestFile('unread.txt', 'foo bar');
      // Do not call read tool or recordFileRead for this file
      // Remove any prior record via reset (public API)
      if (toolContextManager.reset) toolContextManager.reset();
      // Override mock to simulate file not read
      (toolContextManager.validateSearchReplaceOperation as jest.Mock).mockReturnValueOnce({ isValid: false, message: 'File has not been read yet' });
      const result = await writeTool.execute({
        path: filePath,
        search: 'foo',
        replace: 'baz'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toMatch(/file has not been read/i);
    });
  });

  describe('Encoding Support', () => {
    it('should handle utf8 encoding', async () => {
      const filePath = path.join(tempDir, 'utf8.txt');
      const content = 'Hello 世界 🌍';

      const result = await writeTool.execute({
        path: filePath,
        content,
        encoding: 'utf8'
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle base64 encoding', async () => {
      const filePath = path.join(tempDir, 'base64.txt');
      const originalContent = 'Hello, World!';
      const base64Content = Buffer.from(originalContent).toString('base64');

      const result = await writeTool.execute({
        path: filePath,
        content: base64Content,
        encoding: 'base64'
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(originalContent);
    });

    it('should reject invalid encoding', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt'),
        content: 'test',
        encoding: 'invalid' as any
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Invalid encoding');
    });
  });

  describe('Error Handling', () => {
    it('should reject empty search string', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const result = await writeTool.execute({
        path: filePath,
        search: '',
        replace: 'new'
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Empty search string');
    });

    it('should detect binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF]).toString('utf8');
      const filePath = await createTestFile('binary.txt', binaryContent);

      const result = await writeTool.execute({
        path: filePath,
        search: 'test',
        replace: 'new'
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).message).toContain('Cannot search-replace binary content');
    });

    it('should record operations', async () => {
      const filePath = path.join(tempDir, 'test.txt');

      await writeTool.execute({
        path: filePath,
        content: 'test'
      });

      expect(toolContextManager.recordFileWrite).toHaveBeenCalledWith(filePath, true);
    });
  });

  describe('File Size Limits', () => {
    it('should reject content exceeding size limit', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const result = await writeTool.execute({
        path: path.join(tempDir, 'large.txt'),
        content: largeContent
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('FILE_TOO_LARGE');
    });

    it('should accept content within size limit', async () => {
      const acceptableContent = 'x'.repeat(1024 * 1024); // 1MB

      const result = await writeTool.execute({
        path: path.join(tempDir, 'acceptable.txt'),
        content: acceptableContent
      });

      expect(result.success).toBe(true);
    });
  });
});