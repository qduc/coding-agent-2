/**
 * Tests for Read Tool - File content reading with encoding support
 *
 * Comprehensive test suite covering:
 * - Basic file reading functionality
 * - Multiple encoding support (UTF-8, ASCII, binary)
 * - File size limits and validation
 * - Security validation and blocked paths
 * - Error cases (file not found, permission denied, etc.)
 * - Parameter validation
 * - Binary file detection and handling
 * - Edge cases and boundary conditions
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ReadTool, ReadParams, ReadResult } from './read';
import { ToolError, ToolContext } from './types';

describe('ReadTool', () => {
  let readTool: ReadTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-tool-test-'));

    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.txt', '.js', '.ts', '.json', '.md'],
      blockedPaths: ['node_modules', '.git', '.env']
    };

    readTool = new ReadTool(testContext);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(readTool.name).toBe('read');
    });

    it('should have a description', () => {
      expect(readTool.description).toBeDefined();
      expect(typeof readTool.description).toBe('string');
      expect(readTool.description.length).toBeGreaterThan(0);
    });

    it('should have valid schema', () => {
      const schema = readTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('path');

      // Check required properties
      expect(schema.properties.path).toBeDefined();
      expect(schema.properties.path.type).toBe('string');

      // Check optional properties
      expect(schema.properties.encoding?.type).toBe('string');
      expect(schema.properties.encoding?.enum).toContain('utf8');
      expect(schema.properties.maxLines?.type).toBe('number');
      expect(schema.properties.startLine?.type).toBe('number');
      expect(schema.properties.endLine?.type).toBe('number');
    });

    it('should return function call schema', () => {
      const functionSchema = readTool.getFunctionCallSchema();
      expect(functionSchema.name).toBe('read');
      expect(functionSchema.description).toBe(readTool.description);
      expect(functionSchema.parameters).toBe(readTool.schema);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required path parameter', async () => {
      const result = await readTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate path parameter type', async () => {
      const result = await readTool.execute({ path: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate line number bounds', async () => {
      await createTestFile('test.txt', 'line1\nline2\nline3');

      // Test negative start line
      const result1 = await readTool.execute({
        path: path.join(tempDir, 'test.txt'),
        startLine: -1
      });
      expect(result1.success).toBe(false);
      expect((result1.error as ToolError).code).toBe('VALIDATION_ERROR');

      // Test endLine before startLine
      const result2 = await readTool.execute({
        path: path.join(tempDir, 'test.txt'),
        startLine: 5,
        endLine: 2
      });
      expect(result2.success).toBe(false);
      expect((result2.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate encoding parameter', async () => {
      await createTestFile('test.txt', 'test content');

      const result = await readTool.execute({
        path: path.join(tempDir, 'test.txt'),
        encoding: 'invalid-encoding'
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Basic File Reading', () => {
    it('should read simple text file', async () => {
      const content = 'Hello, World!';
      await createTestFile('simple.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'simple.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(content);
      expect(output.filePath).toBe(path.resolve(tempDir, 'simple.txt'));
      expect(output.encoding).toBe('utf8');
      expect(output.size).toBe(Buffer.byteLength(content, 'utf8'));
      expect(output.lineCount).toBe(1);
    });

    it('should read multi-line text file', async () => {
      const content = 'Line 1\nLine 2\nLine 3\n';
      await createTestFile('multiline.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'multiline.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(content);
      expect(output.lineCount).toBe(4); // Including final newline
    });

    it('should include file metadata', async () => {
      const content = 'Test content for metadata';
      await createTestFile('metadata.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'metadata.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.modified).toBeDefined();
      expect(typeof output.modified.getTime).toBe('function');
      expect(output.permissions).toMatch(/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/);
      expect(output.isDirectory).toBe(false);
      expect(output.isSymlink).toBe(false);
    });

    it('should handle empty files', async () => {
      await createTestFile('empty.txt', '');

      const result = await readTool.execute({
        path: path.join(tempDir, 'empty.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe('');
      expect(output.size).toBe(0);
      expect(output.lineCount).toBe(0);
    });
  });

  describe('Encoding Support', () => {
    it('should read UTF-8 encoded files', async () => {
      const content = 'Hello 世界! 🌍';
      await createTestFile('utf8.txt', content, 'utf8');

      const result = await readTool.execute({
        path: path.join(tempDir, 'utf8.txt'),
        encoding: 'utf8'
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(content);
      expect(output.encoding).toBe('utf8');
    });

    it('should read ASCII files', async () => {
      const content = 'ASCII content only';
      await createTestFile('ascii.txt', content, 'ascii');

      const result = await readTool.execute({
        path: path.join(tempDir, 'ascii.txt'),
        encoding: 'ascii'
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(content);
      expect(output.encoding).toBe('ascii');
    });

    it('should handle base64 encoding', async () => {
      const originalContent = 'Hello, World!';
      const base64Content = Buffer.from(originalContent).toString('base64');
      await createTestFile('base64.txt', base64Content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'base64.txt'),
        encoding: 'base64'
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(base64Content);
      expect(output.encoding).toBe('base64');
    });
  });

  describe('Line Range Reading', () => {
    it('should read specific line range', async () => {
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      await createTestFile('lines.txt', lines.join('\n'));

      const result = await readTool.execute({
        path: path.join(tempDir, 'lines.txt'),
        startLine: 2,
        endLine: 4
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe('Line 2\nLine 3\nLine 4');
      expect(output.partialRead).toBe(true);
      expect(output.requestedLines).toEqual({ start: 2, end: 4 });
    });

    it('should limit lines with maxLines parameter', async () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await createTestFile('many-lines.txt', lines.join('\n'));

      const result = await readTool.execute({
        path: path.join(tempDir, 'many-lines.txt'),
        maxLines: 10
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      const outputLines = output.content.split('\n');
      expect(outputLines).toHaveLength(10);
      expect(output.partialRead).toBe(true);
      expect(output.totalLines).toBe(100);
    });

    it('should handle line range beyond file length', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      await createTestFile('short.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'short.txt'),
        startLine: 5,
        endLine: 10
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe('');
      expect(output.partialRead).toBe(true);
    });
  });

  describe('File Size Limits', () => {
    it('should enforce file size limits', async () => {
      // Create a tool with small size limit for testing
      const smallLimitContext = { ...testContext, maxFileSize: 100 };
      const limitedTool = new ReadTool(smallLimitContext);

      const largeContent = 'x'.repeat(200);
      await createTestFile('large.txt', largeContent);

      const result = await limitedTool.execute({
        path: path.join(tempDir, 'large.txt')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('FILE_TOO_LARGE');
    });

    it('should include size information in results', async () => {
      const content = 'Test content with specific size';
      await createTestFile('sized.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'sized.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.size).toBe(Buffer.byteLength(content, 'utf8'));
    });
  });

  describe('Binary File Detection', () => {
    it('should detect and handle binary files', async () => {
      // Create a binary file (image-like content)
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      await fs.writeFile(path.join(tempDir, 'binary.png'), binaryContent);

      const result = await readTool.execute({
        path: path.join(tempDir, 'binary.png')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('BINARY_FILE');
    });

    it('should allow binary files when encoding is specified', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      await fs.writeFile(path.join(tempDir, 'binary.dat'), binaryContent);

      const result = await readTool.execute({
        path: path.join(tempDir, 'binary.dat'),
        encoding: 'hex'
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe('89504e47');
      expect(output.isBinary).toBe(true);
    });
  });

  describe('Security and Blocked Paths', () => {
    it('should block reading from node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await createTestFile(path.join('node_modules', 'package.json'), '{}');

      const result = await readTool.execute({
        path: path.join(nodeModulesDir, 'package.json')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should block reading .env files', async () => {
      await createTestFile('.env', 'SECRET_KEY=secret');

      const result = await readTool.execute({
        path: path.join(tempDir, '.env')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should respect allowedExtensions when configured', async () => {
      const restrictiveContext = {
        ...testContext,
        allowedExtensions: ['.txt', '.js']
      };
      const restrictiveTool = new ReadTool(restrictiveContext);

      await createTestFile('blocked.py', 'print("Hello")');

      const result = await restrictiveTool.execute({
        path: path.join(tempDir, 'blocked.py')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_FILE_TYPE');
    });

    it('should block hidden files when not allowed', async () => {
      await createTestFile('.hidden.txt', 'hidden content');

      const result = await readTool.execute({
        path: path.join(tempDir, '.hidden.txt')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files', async () => {
      const result = await readTool.execute({
        path: path.join(tempDir, 'does-not-exist.txt')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('FILE_NOT_FOUND');
    });

    it('should handle directory instead of file', async () => {
      const dirPath = path.join(tempDir, 'directory');
      await fs.ensureDir(dirPath);

      const result = await readTool.execute({
        path: dirPath
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_PATH');
    });

    it('should handle permission denied', async () => {
      if (process.platform !== 'win32') {
        const restrictedFile = path.join(tempDir, 'restricted.txt');
        await createTestFile('restricted.txt', 'content');
        await fs.chmod(restrictedFile, 0o000);

        const result = await readTool.execute({
          path: restrictedFile
        });

        expect(result.success).toBe(false);
        expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');

        await fs.chmod(restrictedFile, 0o644);
      }
    });

    it('should include execution metadata', async () => {
      await createTestFile('test.txt', 'content');

      const result = await readTool.execute({
        path: path.join(tempDir, 'test.txt')
      });

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata!.executionTime).toBe('number');
      expect(result.metadata!.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with unusual line endings', async () => {
      const content = 'Line 1\r\nLine 2\rLine 3\n';
      await createTestFile('mixed-endings.txt', content);

      const result = await readTool.execute({
        path: path.join(tempDir, 'mixed-endings.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(content);
      expect(output.lineEndings).toEqual(['CRLF', 'CR', 'LF']);
    });

    it('should handle very long lines', async () => {
      const longLine = 'x'.repeat(10000);
      await createTestFile('long-line.txt', longLine);

      const result = await readTool.execute({
        path: path.join(tempDir, 'long-line.txt')
      });

      expect(result.success).toBe(true);
      const output = result.output as ReadResult;
      expect(output.content).toBe(longLine);
      expect(output.hasLongLines).toBe(true);
    });

    it('should handle relative paths', async () => {
      await createTestFile('relative.txt', 'relative content');

      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = await readTool.execute({
          path: './relative.txt'
        });

        expect(result.success).toBe(true);
        const output = result.output as ReadResult;
        expect(output.content).toBe('relative content');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle symlinks when they exist', async () => {
      await createTestFile('original.txt', 'original content');
      const symlinkPath = path.join(tempDir, 'symlink.txt');

      try {
        await fs.symlink(path.join(tempDir, 'original.txt'), symlinkPath);

        const result = await readTool.execute({
          path: symlinkPath
        });

        expect(result.success).toBe(true);
        const output = result.output as ReadResult;
        expect(output.content).toBe('original content');
        expect(output.isSymlink).toBe(true);
      } catch (error) {
        // Skip test if symlinks not supported
        if ((error as any).code !== 'EPERM') {
          throw error;
        }
      }
    });
  });

  // Helper function for creating test files
  async function createTestFile(filename: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    const filePath = path.isAbsolute(filename) ? filename : path.join(tempDir, filename);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, encoding);
  }
});
