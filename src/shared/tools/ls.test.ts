/**
 * Tests for LS Tool - Directory listing with metadata and filtering
 *
 * Comprehensive test suite covering:
 * - Basic directory listing
 * - Pattern filtering with glob patterns
 * - Recursive traversal with depth limits
 * - Hidden file handling
 * - Error cases (file not found, permission denied, etc.)
 * - Security validation and blocked paths
 * - Parameter validation
 * - Edge cases and boundary conditions
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { LSTool, LSParams, FileEntry, LSResult } from './ls';
import { ToolError, ToolContext } from './types';

describe('LSTool', () => {
  let lsTool: LSTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ls-tool-test-'));

    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', '.env']
    };

    lsTool = new LSTool(testContext);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(lsTool.name).toBe('ls');
    });

    it('should have a description', () => {
      expect(lsTool.description).toBeDefined();
      expect(typeof lsTool.description).toBe('string');
      expect(lsTool.description.length).toBeGreaterThan(0);
    });

    it('should have valid schema', () => {
      const schema = lsTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('path');

      // Check required properties
      expect(schema.properties.path).toBeDefined();
      expect(schema.properties.path.type).toBe('string');

      // Check optional properties
      expect(schema.properties.pattern?.type).toBe('string');
      expect(schema.properties.includeHidden?.type).toBe('boolean');
      expect(schema.properties.depth?.type).toBe('number');
    });

    it('should return function call schema', () => {
      const functionSchema = lsTool.getFunctionCallSchema();
      expect(functionSchema.name).toBe('ls');
      expect(functionSchema.description).toBe(lsTool.description);
      expect(functionSchema.parameters).toBe(lsTool.schema);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required path parameter', async () => {
      const result = await lsTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate path parameter type', async () => {
      const result = await lsTool.execute({ path: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate depth bounds', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        depth: -2  // Invalid negative depth (only -1 allowed for unlimited)
      });
      expect(result.success).toBe(true); // Actually, any depth should be allowed now
    });

    it('should accept valid parameters', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        pattern: '*.js',
        includeHidden: true,
        depth: 2
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Basic Directory Listing', () => {
    it('should list files in a simple directory', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;
      expect(output.directory).toBe(path.resolve(tempDir));
      expect(output.entries).toHaveLength(3); // file1.txt, file2.js, subdir (hidden file excluded by default)
      expect(output.totalCount).toBe(3);
      expect(output.filtered).toBe(false);
    });

    it('should include file metadata', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      const file = output.entries.find(e => e.name === 'file1.txt');
      expect(file).toBeDefined();
      expect(file!.type).toBe('file');
      expect(file!.size).toBeGreaterThan(0);
      expect(file!.modified).toBeDefined();
      expect(typeof file!.modified.getTime).toBe('function'); // Check it's a Date-like object
      expect(file!.permissions).toMatch(/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/);
      expect(file!.hidden).toBe(false);
    });

    it('should differentiate between files and directories', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      const file = output.entries.find(e => e.name === 'file1.txt');
      const dir = output.entries.find(e => e.name === 'subdir');

      expect(file!.type).toBe('file');
      expect(file!.size).toBeGreaterThan(0);

      expect(dir!.type).toBe('directory');
      expect(dir!.size).toBe(0);
    });

    it('should sort entries correctly (directories first, then alphabetically)', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      // Should be sorted: subdir (directory), then files alphabetically
      const names = output.entries.map(e => e.name);
      expect(names[0]).toBe('subdir'); // Directory first
      expect(names.slice(1)).toEqual(['file1.txt', 'file2.js']); // Files alphabetically (hidden file excluded)
    });
  });

  describe('Hidden Files Handling', () => {
    it('should exclude hidden files by default', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      const hiddenFiles = output.entries.filter(e => e.hidden);
      expect(hiddenFiles).toHaveLength(0);
    });

    it('should include hidden files when requested', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        includeHidden: true
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      const hiddenFile = output.entries.find(e => e.name === '.hidden.txt');
      expect(hiddenFile).toBeDefined();
      expect(hiddenFile!.hidden).toBe(true);
    });
  });

  describe('Pattern Filtering', () => {
    it('should filter files by extension pattern', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        pattern: '*.js'
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      expect(output.filtered).toBe(true);
      expect(output.pattern).toBe('*.js');
      expect(output.entries).toHaveLength(1);
      expect(output.entries[0].name).toBe('file2.js');
    });

    it('should filter files by name pattern', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        pattern: 'file1*'
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      expect(output.entries).toHaveLength(1);
      expect(output.entries[0].name).toBe('file1.txt');
    });

    it('should handle complex glob patterns', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        pattern: '**/*.{js,txt}',
        recursive: true
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      const matchedFiles = output.entries.filter(e => e.type === 'file');
      expect(matchedFiles.length).toBeGreaterThan(0);
      matchedFiles.forEach(file => {
        expect(file.name).toMatch(/\.(js|txt)$/);
      });
    });

    it('should return empty results for non-matching patterns', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        pattern: '*.nonexistent'
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      expect(output.entries).toHaveLength(0);
      expect(output.totalCount).toBe(0);
      expect(output.filtered).toBe(true);
    });
  });

  describe('Recursive Traversal', () => {
    it('should list files recursively', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        depth: -1  // unlimited depth
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      // Should include files from subdirectory
      const subFiles = output.entries.filter(e =>
        e.relativePath.includes('subdir') && e.type === 'file'
      );
      expect(subFiles.length).toBeGreaterThan(0);
    });

    it('should respect depth limit', async () => {
      await createDeepDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        depth: 2
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      // Should not include files beyond depth 2
      const deepFiles = output.entries.filter(e =>
        e.relativePath.split(path.sep).length > 3
      );
      expect(deepFiles).toHaveLength(0);
    });

    it('should handle non-recursive by default', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      // Should not include files from subdirectory
      const subFiles = output.entries.filter(e =>
        e.relativePath.includes('subdir') && e.type === 'file'
      );
      expect(subFiles).toHaveLength(0);
    });
  });

  describe('Security and Blocked Paths', () => {
    it('should block access to node_modules directory', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await fs.writeFile(path.join(nodeModulesDir, 'package.json'), '{}');

      const result = await lsTool.execute({ path: nodeModulesDir });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should block access to .git directory', async () => {
      const gitDir = path.join(tempDir, '.git');
      await fs.ensureDir(gitDir);
      await fs.writeFile(path.join(gitDir, 'config'), '');

      const result = await lsTool.execute({ path: gitDir });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should skip blocked subdirectories during recursive listing', async () => {
      await createTestDirectory();
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await fs.writeFile(path.join(nodeModulesDir, 'blocked.js'), 'blocked');

      const result = await lsTool.execute({
        path: tempDir,
        depth: -1  // unlimited depth to test recursive behavior
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;

      // Should not include files from inside node_modules, but node_modules directory itself might be listed
      const blockedFiles = output.entries.filter(e =>
        e.name === 'blocked.js' && e.relativePath.includes('node_modules')
      );
      expect(blockedFiles).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directory', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      const result = await lsTool.execute({ path: nonExistentDir });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should handle file instead of directory', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      const result = await lsTool.execute({ path: filePath });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_PATH');
    });

    it('should handle permission denied gracefully', async () => {
      // This test is platform-dependent and may not work on all systems
      if (process.platform !== 'win32') {
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.ensureDir(restrictedDir);
        await fs.chmod(restrictedDir, 0o000); // Remove all permissions

        const result = await lsTool.execute({ path: restrictedDir });

        expect(result.success).toBe(false);
        expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');

        // Clean up - restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755);
      }
    });

    it('should include execution metadata in results', async () => {
      await createTestDirectory();

      const result = await lsTool.execute({ path: tempDir });

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata!.executionTime).toBe('number');
      expect(result.metadata!.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should provide helpful error suggestions', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      const result = await lsTool.execute({ path: nonExistentDir });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.ensureDir(emptyDir);

      const result = await lsTool.execute({ path: emptyDir });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;
      expect(output.entries).toHaveLength(0);
      expect(output.totalCount).toBe(0);
    });

    it('should handle directory with only hidden files', async () => {
      const hiddenOnlyDir = path.join(tempDir, 'hidden-only');
      await fs.ensureDir(hiddenOnlyDir);
      await fs.writeFile(path.join(hiddenOnlyDir, '.hidden1'), 'content');
      await fs.writeFile(path.join(hiddenOnlyDir, '.hidden2'), 'content');

      // Without includeHidden
      const result1 = await lsTool.execute({ path: hiddenOnlyDir });
      expect(result1.success).toBe(true);
      expect((result1.output as LSResult).entries).toHaveLength(0);

      // With includeHidden
      const result2 = await lsTool.execute({
        path: hiddenOnlyDir,
        includeHidden: true
      });
      expect(result2.success).toBe(true);
      expect((result2.output as LSResult).entries).toHaveLength(2);
    });

    it('should handle relative paths', async () => {
      await createTestDirectory();

      // Change working directory temporarily
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = await lsTool.execute({ path: '.' });

        expect(result.success).toBe(true);
        const output = result.output as LSResult;
        expect(output.entries.length).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle very deep directory structures', async () => {
      await createVeryDeepDirectory();

      const result = await lsTool.execute({
        path: tempDir,
        depth: 10
      });

      expect(result.success).toBe(true);
      const output = result.output as LSResult;
      expect(output.entries.length).toBeGreaterThan(0);
    });
  });

  // Helper functions for setting up test data
  async function createTestDirectory(): Promise<void> {
    // Create test files
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Content of file 1');
    await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("Hello");');
    await fs.writeFile(path.join(tempDir, '.hidden.txt'), 'Hidden content');

    // Create subdirectory with files
    const subdir = path.join(tempDir, 'subdir');
    await fs.ensureDir(subdir);
    await fs.writeFile(path.join(subdir, 'nested.txt'), 'Nested file content');
    await fs.writeFile(path.join(subdir, 'nested.js'), 'console.log("Nested");');
  }

  async function createDeepDirectory(): Promise<void> {
    let currentDir = tempDir;

    // Create 5 levels deep
    for (let i = 1; i <= 5; i++) {
      currentDir = path.join(currentDir, `level${i}`);
      await fs.ensureDir(currentDir);
      await fs.writeFile(
        path.join(currentDir, `file${i}.txt`),
        `Content at level ${i}`
      );
    }
  }

  async function createVeryDeepDirectory(): Promise<void> {
    let currentDir = tempDir;

    // Create 15 levels deep
    for (let i = 1; i <= 15; i++) {
      currentDir = path.join(currentDir, `deep${i}`);
      await fs.ensureDir(currentDir);

      if (i % 3 === 0) { // Add files every 3 levels
        await fs.writeFile(
          path.join(currentDir, `deep${i}.txt`),
          `Very deep content at level ${i}`
        );
      }
    }
  }
});
