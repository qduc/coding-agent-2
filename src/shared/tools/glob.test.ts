/**
 * Tests for Glob Tool - Pattern matching for file discovery
 *
 * Comprehensive test suite covering:
 * - Basic glob pattern matching
 * - Advanced glob patterns (wildcards, character classes, negation)
 * - Multiple pattern support
 * - Recursive pattern matching with depth limits
 * - Security validation and blocked paths
 * - Case sensitivity handling
 * - Performance with large directory structures
 * - Parameter validation
 * - Edge cases and boundary conditions
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { GlobTool, GlobParams, GlobResult, GlobMatch } from './glob';
import { ToolError, ToolContext } from '../types';

describe('GlobTool', () => {
  let globTool: GlobTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-tool-test-'));

    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', '.env']
    };

    globTool = new GlobTool(testContext);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(globTool.name).toBe('glob');
    });

    it('should have a description', () => {
      expect(globTool.description).toBeDefined();
      expect(typeof globTool.description).toBe('string');
      expect(globTool.description.length).toBeGreaterThan(0);
    });

    it('should have valid schema', () => {
      const schema = globTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('pattern');

      // Check required properties
      expect(schema.properties.pattern).toBeDefined();
      expect(schema.properties.pattern.type).toBe('string');

      // Check optional properties
      expect(schema.properties.patterns?.type).toBe('array');
      expect(schema.properties.cwd?.type).toBe('string');
      expect(schema.properties.includeHidden?.type).toBe('boolean');
      expect(schema.properties.maxDepth?.type).toBe('number');
      expect(schema.properties.caseSensitive?.type).toBe('boolean');
      expect(schema.properties.followSymlinks?.type).toBe('boolean');
    });

    it('should return function call schema', () => {
      const functionSchema = globTool.getFunctionCallSchema();
      expect(functionSchema.name).toBe('glob');
      expect(functionSchema.description).toBe(globTool.description);
      expect(functionSchema.parameters).toBe(globTool.schema);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required pattern parameter', async () => {
      const result = await globTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate pattern parameter type', async () => {
      const result = await globTool.execute({ pattern: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate patterns array type', async () => {
      const result = await globTool.execute({
        pattern: '*.txt',
        patterns: ['*.js', 123, '*.ts']
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate maxDepth bounds', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '**/*',
        maxDepth: 25
      });
      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid parameters', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*.js',
        patterns: ['*.ts', '*.json'],
        cwd: tempDir,
        includeHidden: true,
        maxDepth: 5,
        caseSensitive: false,
        followSymlinks: false
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Basic Pattern Matching', () => {
    it('should match simple wildcard patterns', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*.js',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.matches.length).toBeGreaterThan(0);
      output.matches.forEach(match => {
        expect(match.name).toMatch(/\.js$/);
      });
    });

    it('should match character class patterns', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: 'file[0-9].txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.matches.length).toBeGreaterThan(0);
      output.matches.forEach(match => {
        expect(match.name).toMatch(/^file[0-9]\.txt$/);
      });
    });

    it('should match recursive patterns', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '**/*.js',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.matches.length).toBeGreaterThan(0);

      // Should include files from subdirectories
      const nestedMatches = output.matches.filter(match =>
        match.relativePath.includes(path.sep)
      );
      expect(nestedMatches.length).toBeGreaterThan(0);
    });

    it('should handle question mark wildcards', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: 'file?.txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      output.matches.forEach(match => {
        expect(match.name).toMatch(/^file.\.txt$/);
      });
    });

    it('should include match metadata', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*.txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const match = output.matches[0];
      expect(match.name).toBeDefined();
      expect(match.path).toBeDefined();
      expect(match.relativePath).toBeDefined();
      expect(match.type).toMatch(/^(file|directory)$/);
      expect(match.size).toBeGreaterThanOrEqual(0);
      expect(match.modified).toBeDefined();
      expect(typeof match.modified.getTime).toBe('function');
    });
  });

  describe('Multiple Pattern Support', () => {
    it('should match multiple patterns with OR logic', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*.js',
        patterns: ['*.ts', '*.json'],
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const extensions = new Set(
        output.matches.map(match => path.extname(match.name))
      );
      expect(extensions.has('.js')).toBe(true);
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.json')).toBe(true);
    });

    it('should handle negation patterns', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*',
        patterns: ['!*.log', '!*.tmp'],
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      // Should not include .log or .tmp files
      const hasLogFiles = output.matches.some(match => match.name.endsWith('.log'));
      const hasTmpFiles = output.matches.some(match => match.name.endsWith('.tmp'));
      expect(hasLogFiles).toBe(false);
      expect(hasTmpFiles).toBe(false);
    });

    it('should combine inclusion and exclusion patterns', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: 'src/**/*.js',
        patterns: ['!**/*.min.js', '!**/test/**'],
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      // Should include .js files but exclude .min.js and test directories
      output.matches.forEach(match => {
        expect(match.name).toMatch(/\.js$/);
        expect(match.name).not.toMatch(/\.min\.js$/);
        expect(match.relativePath).not.toMatch(/\/test\//);
      });
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case sensitive by default', async () => {
      await createMixedCaseFiles();

      const result = await globTool.execute({
        pattern: '*.TXT',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      output.matches.forEach(match => {
        expect(match.name).toMatch(/\.TXT$/);
        expect(match.name).not.toMatch(/\.txt$/);
      });
    });

    it('should support case insensitive matching', async () => {
      await createMixedCaseFiles();

      const result = await globTool.execute({
        pattern: '*.txt',
        caseSensitive: false,
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const extensions = new Set(
        output.matches.map(match => path.extname(match.name).toLowerCase())
      );
      expect(extensions.has('.txt')).toBe(true);
    });
  });

  describe('Hidden Files and Directories', () => {
    it('should exclude hidden files by default', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const hiddenFiles = output.matches.filter(match => match.name.startsWith('.'));
      expect(hiddenFiles).toHaveLength(0);
    });

    it('should include hidden files when requested', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '.*',
        includeHidden: true,
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const hiddenFiles = output.matches.filter(match => match.name.startsWith('.'));
      expect(hiddenFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Depth Limiting', () => {
    it('should respect maxDepth parameter', async () => {
      await createDeepStructure();

      const result = await globTool.execute({
        pattern: '**/*',
        maxDepth: 2,
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      output.matches.forEach(match => {
        const depth = match.relativePath.split(path.sep).length - 1;
        expect(depth).toBeLessThanOrEqual(2);
      });
    });

    it('should handle unlimited depth by default', async () => {
      await createDeepStructure();

      const result = await globTool.execute({
        pattern: '**/*.txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      // Should find files at various depths
      const depths = output.matches.map(match =>
        match.relativePath.split(path.sep).length - 1
      );
      const maxDepth = Math.max(...depths);
      expect(maxDepth).toBeGreaterThan(2);
    });
  });

  describe('Security and Blocked Paths', () => {
    it('should exclude blocked paths from results', async () => {
      await createTestStructure();
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await fs.writeFile(path.join(nodeModulesDir, 'blocked.js'), 'blocked');

      const result = await globTool.execute({
        pattern: '**/*.js',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;

      const blockedFiles = output.matches.filter(match =>
        match.relativePath.includes('node_modules')
      );
      expect(blockedFiles).toHaveLength(0);
    });

    it('should block access to sensitive directory as cwd', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);

      const result = await globTool.execute({
        pattern: '*',
        cwd: nodeModulesDir
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });

    it('should validate cwd path exists', async () => {
      const result = await globTool.execute({
        pattern: '*',
        cwd: path.join(tempDir, 'nonexistent')
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large numbers of matches', async () => {
      await createLargeStructure();

      const result = await globTool.execute({
        pattern: '**/*.txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.totalMatches).toBeGreaterThan(50);
      expect(output.matches.length).toBeGreaterThan(0);
    });

    it('should include performance metadata', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '**/*',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata!.executionTime).toBe('number');
      expect(result.metadata!.executionTime).toBeGreaterThanOrEqual(0);

      const output = result.output as GlobResult;
      expect(output.performanceInfo).toBeDefined();
      expect(typeof output.performanceInfo.filesScanned).toBe('number');
      expect(typeof output.performanceInfo.directoriesTraversed).toBe('number');
    });

    it('should handle timeout gracefully', async () => {
      // Create a tool with very short timeout for testing
      const timeoutContext = { ...testContext, timeout: 1 };
      const timeoutTool = new GlobTool(timeoutContext);

      await createLargeStructure();

      const result = await timeoutTool.execute({
        pattern: '**/*',
        cwd: tempDir
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('OPERATION_TIMEOUT');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty pattern gracefully', async () => {
      const result = await globTool.execute({
        pattern: '',
        cwd: tempDir
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid glob patterns', async () => {
      const result = await globTool.execute({
        pattern: '[invalid',
        cwd: tempDir
      });

      expect(result.success).toBe(false);
      expect((result.error as ToolError).code).toBe('INVALID_PATTERN');
    });

    it('should provide helpful error messages', async () => {
      const result = await globTool.execute({
        pattern: '[unclosed',
        cwd: tempDir
      });

      expect(result.success).toBe(false);
      const error = result.error as ToolError;
      expect(error.message).toContain('pattern');
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle patterns with no matches', async () => {
      await createTestStructure();

      const result = await globTool.execute({
        pattern: '*.nonexistent',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.matches).toHaveLength(0);
      expect(output.totalMatches).toBe(0);
    });

    it('should handle very long file paths', async () => {
      const longPath = 'a'.repeat(50);
      const nestedDir = path.join(tempDir, longPath, longPath, longPath);
      await fs.ensureDir(nestedDir);
      await fs.writeFile(path.join(nestedDir, 'deep.txt'), 'content');

      const result = await globTool.execute({
        pattern: '**/*.txt',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      const longPathMatch = output.matches.find(match =>
        match.relativePath.length > 100
      );
      expect(longPathMatch).toBeDefined();
    });

    it('should handle special characters in file names', async () => {
      const specialFiles = ['file space.txt', 'file(paren).txt', 'file&amp.txt'];
      for (const filename of specialFiles) {
        await fs.writeFile(path.join(tempDir, filename), 'content');
      }

      const result = await globTool.execute({
        pattern: 'file*',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const output = result.output as GlobResult;
      expect(output.matches.length).toBe(specialFiles.length);
    });

    it('should handle symlinks when configured', async () => {
      await createTestStructure();
      const symlinkPath = path.join(tempDir, 'symlink-dir');

      try {
        await fs.symlink(path.join(tempDir, 'src'), symlinkPath);

        const result = await globTool.execute({
          pattern: '**/*.js',
          followSymlinks: true,
          cwd: tempDir
        });

        expect(result.success).toBe(true);
        const output = result.output as GlobResult;

        const symlinkMatches = output.matches.filter(match =>
          match.relativePath.startsWith('symlink-dir/')
        );
        expect(symlinkMatches.length).toBeGreaterThan(0);
      } catch (error) {
        // Skip test if symlinks not supported
        if ((error as any).code !== 'EPERM') {
          throw error;
        }
      }
    });
  });

  // Helper functions for setting up test data
  async function createTestStructure(): Promise<void> {
    // Create various file types
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
    await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("test");');
    await fs.writeFile(path.join(tempDir, 'file3.ts'), 'const x: string = "test";');
    await fs.writeFile(path.join(tempDir, 'config.json'), '{}');
    await fs.writeFile(path.join(tempDir, 'app.log'), 'log entry');
    await fs.writeFile(path.join(tempDir, 'temp.tmp'), 'temporary');
    await fs.writeFile(path.join(tempDir, '.hidden.txt'), 'hidden');

    // Create subdirectory structure
    const srcDir = path.join(tempDir, 'src');
    await fs.ensureDir(srcDir);
    await fs.writeFile(path.join(srcDir, 'index.js'), 'main file');
    await fs.writeFile(path.join(srcDir, 'utils.ts'), 'utilities');

    const testDir = path.join(srcDir, 'test');
    await fs.ensureDir(testDir);
    await fs.writeFile(path.join(testDir, 'app.test.js'), 'test file');

    // Create files for character class testing
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(path.join(tempDir, `file${i}.txt`), `content ${i}`);
    }
  }

  async function createMixedCaseFiles(): Promise<void> {
    await fs.writeFile(path.join(tempDir, 'lower.txt'), 'lowercase');
    await fs.writeFile(path.join(tempDir, 'UPPER.TXT'), 'uppercase');
    await fs.writeFile(path.join(tempDir, 'Mixed.Txt'), 'mixed case');
  }

  async function createDeepStructure(): Promise<void> {
    let currentDir = tempDir;

    for (let i = 1; i <= 6; i++) {
      currentDir = path.join(currentDir, `level${i}`);
      await fs.ensureDir(currentDir);
      await fs.writeFile(path.join(currentDir, `file${i}.txt`), `content at level ${i}`);
    }
  }

  async function createLargeStructure(): Promise<void> {
    // Create many files and directories
    for (let i = 0; i < 20; i++) {
      const dir = path.join(tempDir, `dir${i}`);
      await fs.ensureDir(dir);

      for (let j = 0; j < 10; j++) {
        await fs.writeFile(path.join(dir, `file${j}.txt`), `content ${i}-${j}`);
        await fs.writeFile(path.join(dir, `script${j}.js`), `console.log(${i}-${j});`);
      }
    }
  }
});
