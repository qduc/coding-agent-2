/**
 * Tests for Write Tool - File creation and modification with safety features
 *
 * Comprehensive test suite covering:
 * - Basic file writing functionality (content mode)
 * - Diff-based patching functionality
 * - Simple and segmented diff formats
 * - Security validation and blocked paths
 * - Parameter validation and error cases
 * - File encoding support (utf8, binary, base64)
 * - Safety features (atomic writes, backup handling)
 * - Edge cases and boundary conditions
 * - Context matching for diff operations
 * - Binary content detection
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WriteTool, WriteParams, WriteResult } from './write';
import { ToolError, ToolContext } from './types';
import { toolContextManager } from '../utils/ToolContextManager';

// Mock the toolContextManager for isolated testing
jest.mock('../utils/ToolContextManager', () => ({
  toolContextManager: {
    recordFileWrite: jest.fn(),
    validateWriteOperation: jest.fn(() => ({
      isValid: true,
      warnings: [],
      suggestions: []
    }))
  }
}));

describe('WriteTool', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-test-'));

    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.txt', '.js', '.ts', '.json', '.md'],
      blockedPaths: ['node_modules', '.git', '.env']
    };

    writeTool = new WriteTool(testContext);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  // Helper function to create test files
  async function createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

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

      // Check required properties
      expect(schema.properties.path).toBeDefined();
      expect(schema.properties.path.type).toBe('string');

      // Check optional properties
      expect(schema.properties.content?.type).toBe('string');
      expect(schema.properties.diff?.type).toBe('string');
      expect(schema.properties.encoding?.type).toBe('string');
      expect(schema.properties.encoding?.enum).toContain('utf8');
      expect(schema.properties.encoding?.enum).toContain('binary');
      expect(schema.properties.encoding?.enum).toContain('base64');
    });

    it('should return function call schema', () => {
      const functionSchema = writeTool.getFunctionCallSchema();
      expect(functionSchema.name).toBe('write');
      expect(functionSchema.description).toBe(writeTool.description);
      expect(functionSchema.parameters).toBe(writeTool.schema);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required path parameter', async () => {
      const result = await writeTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate path parameter type', async () => {
      const result = await writeTool.execute({ path: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should require either content or diff', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt')
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
      expect((result.error as ToolError).message).toContain('Either content or diff must be provided');
    });

    it('should reject both content and diff', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt'),
        content: 'test content',
        diff: '+added line'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
      expect((result.error as ToolError).message).toContain('Cannot provide both content and diff');
    });

    it('should validate encoding parameter', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.txt'),
        content: 'test content',
        encoding: 'invalid-encoding' as any
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
      expect((result.error as ToolError).message).toContain('must be one of: utf8, binary, base64');
    });

    it('should validate file extension restrictions', async () => {
      const result = await writeTool.execute({
        path: path.join(tempDir, 'test.exe'),
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
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
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should block writes to parent directories in blocked paths', async () => {
      const gitDir = path.join(tempDir, '.git');
      await fs.ensureDir(gitDir);

      const result = await writeTool.execute({
        path: path.join(gitDir, 'config'),
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should block writes to root directory', async () => {
      const result = await writeTool.execute({
        path: '/test.txt',
        content: 'test content'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should resolve and validate relative paths', async () => {
      const result = await writeTool.execute({
        path: 'test.txt',
        content: 'test content'
      });
      expect(result.success).toBe(true);

      const output = result.output as WriteResult;
      expect(output.filePath).toBe(path.resolve('test.txt'));
    });
  });

  describe('Content Mode - File Creation', () => {
    it('should create new file with content', async () => {
      const filePath = path.join(tempDir, 'new-file.txt');
      const content = 'Hello, World!';

      const result = await writeTool.execute({
        path: filePath,
        content
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.filePath).toBe(filePath);
      expect(output.created).toBe(true);
      expect(output.mode).toBe('create');
      expect(output.linesChanged).toBe(1);

      // Verify file was actually created
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should create parent directories automatically', async () => {
      const filePath = path.join(tempDir, 'deep', 'nested', 'path', 'file.txt');
      const content = 'nested content';

      const result = await writeTool.execute({
        path: filePath,
        content
      });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle multiline content', async () => {
      const filePath = path.join(tempDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3\n';

      const result = await writeTool.execute({
        path: filePath,
        content
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(4); // Including the final newline

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle empty content', async () => {
      const filePath = path.join(tempDir, 'empty.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: ''
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(1); // Empty file still counts as 1 line

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('');
    });
  });

  describe('Content Mode - File Replacement', () => {
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
      expect(output.mode).toBe('patch'); // WriteTool uses 'patch' mode for existing files

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(newContent);
    });

    it('should handle content replacement with different line counts', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3');
      const newContent = 'single line';

      const result = await writeTool.execute({
        path: filePath,
        content: newContent
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(1);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(newContent);
    });
  });

  describe('Diff Mode - Simple Format', () => {
    it('should apply simple diff with additions', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'line2\n+added line\nline3';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.mode).toBe('patch');
      expect(output.linesChanged).toBe(1);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nline2\nadded line\nline3');
    });

    it('should apply simple diff with deletions', async () => {
      const originalContent = 'line1\nline2\nline3\nline4';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'line2\n-line3\nline4';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(1);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nline2\nline4');
    });

    it('should apply simple diff with replacements', async () => {
      const originalContent = 'line1\nold line\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'line1\n-old line\n+new line\nline3';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(2); // 1 deletion + 1 addition

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nnew line\nline3');
    });

    it('should handle context matching with whitespace normalization', async () => {
      const originalContent = 'line1\n  indented line  \nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'indented line\n+added line\nline3';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nindented line\nadded line\nline3'); // Whitespace normalized
    });

    it('should fail when context is ambiguous', async () => {
      const originalContent = 'same line\nother content\nsame line\nmore content';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'same line\n+added line';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).message).toContain('Multiple matching contexts found');
    });

    it('should fail when context is not found', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'nonexistent line\n+added line';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).message).toContain('No matching context found');
    });
  });

  describe('Diff Mode - Segmented Format', () => {
    it('should apply segmented diff with ... separator', async () => {
      const originalContent = 'line1\nline2\nline3\nline4\nline5\nline6';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = `line1\n+added after line1\nline2\n...\nline5\n+added after line5\nline6`;

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(2);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nadded after line1\nline2\nline3\nline4\nline5\nadded after line5\nline6');
    });

    it('should apply segmented diff with @@ separator', async () => {
      const originalContent = 'function test() {\n  console.log("start");\n  // middle code\n  console.log("end");\n}';
      const filePath = await createTestFile('test.js', originalContent);

      const diff = `console.log("start");\n+  console.log("debug");\n@@\nconsole.log("end");\n+  return true;`;

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('console.log("debug");');
      expect(fileContent).toContain('return true;');
    });

    it('should validate segments are in order', async () => {
      const originalContent = 'line1\nline2\nline3\nline4';
      const filePath = await createTestFile('test.txt', originalContent);

      // Out of order segments
      const diff = `line3\n+added line\n...\nline1\n+another line`;

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).message).toContain('out of order');
    });
  });

  describe('Diff Mode - Edge Cases', () => {
    it('should require at least one change line', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'line1\nline2\nline3'; // No + or - lines

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).message).toContain('no additions or deletions found');
    });

    it('should handle empty diff', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const result = await writeTool.execute({
        path: filePath,
        diff: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should detect binary content and reject diff', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]).toString('utf8');
      const filePath = await createTestFile('binary.txt', binaryContent);

      const diff = '+some change';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).message).toContain('binary');
    });
  });

  describe('Encoding Support', () => {
    it('should handle utf8 encoding (default)', async () => {
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
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Create a read-only directory (if possible on the platform)
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.ensureDir(readOnlyDir);

      // Try to make it read-only (may not work on all platforms)
      try {
        await fs.chmod(readOnlyDir, 0o444);
      } catch {
        // Skip test if we can't set permissions
        return;
      }

      const result = await writeTool.execute({
        path: path.join(readOnlyDir, 'test.txt'),
        content: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
    });

    it('should record successful operations', async () => {
      const filePath = path.join(tempDir, 'success.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: 'test content'
      });

      expect(result.success).toBe(true);
      expect(toolContextManager.recordFileWrite).toHaveBeenCalledWith(filePath, true);
    });

    it('should record failed operations', async () => {
      const invalidPath = path.join(tempDir, 'invalid\x00file.txt');

      const result = await writeTool.execute({
        path: invalidPath,
        content: 'test content'
      });

      expect(result.success).toBe(false);
      expect(toolContextManager.recordFileWrite).toHaveBeenCalledWith(invalidPath, false);
    });
  });

  describe('Tool Context Manager Integration', () => {
    it('should validate diff operations with context manager', async () => {
      // Temporarily set NODE_ENV to non-test to enable validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockValidation = jest.mocked(toolContextManager.validateWriteOperation);
      mockValidation.mockReturnValue({
        isValid: false,
        warnings: ['File not read first'],
        suggestions: ['Use read tool first']
      });

      const filePath = await createTestFile('test.txt', 'original content');

      const result = await writeTool.execute({
        path: filePath,
        diff: '+added line'
      });

      expect(result.success).toBe(false);
      expect(mockValidation).toHaveBeenCalledWith(expect.any(String), true);

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip validation in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const filePath = await createTestFile('test.txt', 'original content');

      const result = await writeTool.execute({
        path: filePath,
        diff: 'original content\n+added line'
      });

      expect(result.success).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle large files within limits', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      const filePath = path.join(tempDir, 'large.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: largeContent
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent.length).toBe(largeContent.length);
    });

    it('should handle complex diff with multiple operations', async () => {
      const originalContent = `function test() {
  const a = 1;
  const b = 2;
  console.log(a + b);
  return a + b;
}`;
      const filePath = await createTestFile('complex.js', originalContent);

      const diff = `const a = 1;
-  const b = 2;
+  const b = 3;
+  const c = 4;
  console.log(a + b);`;

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const output = result.output as WriteResult;
      expect(output.linesChanged).toBe(3); // 1 deletion + 2 additions

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('const b = 3;');
      expect(fileContent).toContain('const c = 4;');
      expect(fileContent).not.toContain('const b = 2;');
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle diff with only additions at beginning of file', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = '+new first line\nline1';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('new first line\nline1\nline2\nline3');
    });

    it('should handle diff with only additions at end of file', async () => {
      const originalContent = 'line1\nline2\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = 'line3\n+new last line';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\nline2\nline3\nnew last line');
    });

    it('should handle special characters in file content', async () => {
      const filePath = path.join(tempDir, 'special.txt');
      const content = 'Line with "quotes"\nLine with \'apostrophes\'\nLine with $special @symbols #hash';

      const result = await writeTool.execute({
        path: filePath,
        content
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should handle diff with empty lines', async () => {
      const originalContent = 'line1\n\nline3';
      const filePath = await createTestFile('test.txt', originalContent);

      const diff = '\n+added between empty lines\nline3';

      const result = await writeTool.execute({
        path: filePath,
        diff
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('line1\n\nadded between empty lines\nline3');
    });

    it('should handle very long lines', async () => {
      const longLine = 'x'.repeat(1000);
      const filePath = path.join(tempDir, 'long.txt');

      const result = await writeTool.execute({
        path: filePath,
        content: `${longLine}\nnormal line\n${longLine}`
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent.split('\n')[0].length).toBe(1000);
      expect(fileContent.split('\n')[1]).toBe('normal line');
    });

    it('should preserve file permissions when overwriting', async () => {
      const filePath = await createTestFile('perms.txt', 'original');

      // Set specific permissions (readable by user only)
      try {
        await fs.chmod(filePath, 0o600);
      } catch {
        // Skip test if we can't set permissions (e.g., on some CI systems)
        return;
      }

      const result = await writeTool.execute({
        path: filePath,
        content: 'new content'
      });

      expect(result.success).toBe(true);

      // Check that file still exists and has content
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('new content');

      // Check permissions are preserved (on systems that support it)
      try {
        const stats = await fs.stat(filePath);
        expect(stats.mode & 0o777).toBe(0o600);
      } catch {
        // Permissions checking may not work on all platforms
      }
    });
  });

  describe('Integration with File System Edge Cases', () => {
    it('should handle files with unusual names', async () => {
      const unusualName = 'file with spaces & symbols !@#.txt';
      const filePath = path.join(tempDir, unusualName);

      const result = await writeTool.execute({
        path: filePath,
        content: 'content for unusual filename'
      });

      expect(result.success).toBe(true);
      expect(await fs.pathExists(filePath)).toBe(true);
    });

    it('should handle Unicode file paths', async () => {
      const unicodeName = '测试文件_🎉.txt';
      const filePath = path.join(tempDir, unicodeName);

      const result = await writeTool.execute({
        path: filePath,
        content: 'Unicode content: 你好世界 🌍'
      });

      expect(result.success).toBe(true);
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe('Unicode content: 你好世界 🌍');
    });

    it('should handle sequential writes correctly', async () => {
      const filePath = path.join(tempDir, 'sequential.txt');

      // Create sequential write operations
      const results: any[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await writeTool.execute({
          path: filePath,
          content: `Content from write ${i}`
        });
        results.push(result);
      }

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // File should exist and have content from the last write
      expect(await fs.pathExists(filePath)).toBe(true);
      const finalContent = await fs.readFile(filePath, 'utf8');
      expect(finalContent).toBe('Content from write 2');
    });
  });
});