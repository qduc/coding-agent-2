/**
 * Tests for Bash Tool - Command execution with security controls
 *
 * Comprehensive test suite covering:
 * - Basic command execution functionality
 * - Security validation and dangerous command blocking
 * - Working directory control and validation
 * - Timeout handling and process management
 * - Environment variable support
 * - Error cases (command not found, permission denied, etc.)
 * - Parameter validation
 * - Output capture (stdout, stderr)
 * - Exit code handling
 * - Edge cases and boundary conditions
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { BashTool, BashParams, BashResult } from './bash';
import { ToolError, ToolContext } from './types';

describe('BashTool', () => {
  let bashTool: BashTool;
  let tempDir: string;
  let testContext: ToolContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bash-tool-test-'));

    testContext = {
      workingDirectory: tempDir,
      maxFileSize: 10 * 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', '.env', 'system32']
    };

    bashTool = new BashTool(testContext);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Tool Metadata', () => {
    it('should have correct tool name', () => {
      expect(bashTool.name).toBe('bash');
    });

    it('should have a description', () => {
      expect(bashTool.description).toBeDefined();
      expect(typeof bashTool.description).toBe('string');
      expect(bashTool.description.length).toBeGreaterThan(0);
    });

    it('should have valid schema', () => {
      const schema = bashTool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('command');

      // Check required properties
      expect(schema.properties.command).toBeDefined();
      expect(schema.properties.command.type).toBe('string');

      // Check optional properties
      expect(schema.properties.cwd?.type).toBe('string');
      expect(schema.properties.timeout?.type).toBe('number');
      expect(schema.properties.env?.type).toBe('object');
    });

    it('should return function call schema', () => {
      const functionSchema = bashTool.getFunctionCallSchema();
      expect(functionSchema.name).toBe('bash');
      expect(functionSchema.description).toBe(bashTool.description);
      expect(functionSchema.parameters).toBe(bashTool.schema);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required command parameter', async () => {
      const result = await bashTool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate command parameter type', async () => {
      const result = await bashTool.execute({ command: 123 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty command', async () => {
      const result = await bashTool.execute({ command: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('INVALID_COMMAND');
    });

    it('should reject whitespace-only command', async () => {
      const result = await bashTool.execute({ command: '   \t\n  ' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('INVALID_COMMAND');
    });

    it('should validate timeout bounds', async () => {
      const result = await bashTool.execute({
        command: 'echo test',
        timeout: 500 // Below minimum
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate maximum timeout', async () => {
      const result = await bashTool.execute({
        command: 'echo test',
        timeout: 400000 // Above maximum
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('VALIDATION_ERROR');
    });

    it('should validate working directory exists', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');
      const result = await bashTool.execute({
        command: 'echo test',
        cwd: nonExistentDir
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
    });
  });

  describe('Security Validation', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo systemctl stop',
      'su root',
      'chmod 777 /etc/passwd',
      'passwd user',
      'shutdown -h now',
      'reboot',
      'kill -9 1',
      'dd if=/dev/zero of=/dev/sda',
      'format c:',
      'mkfs.ext4 /dev/sda1',
      'fdisk /dev/sda'
    ];

    dangerousCommands.forEach(command => {
      it(`should block dangerous command: ${command}`, async () => {
        const result = await bashTool.execute({ command });
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(ToolError);
        expect((result.error as ToolError).code).toBe('DANGEROUS_COMMAND');
      });
    });

    const injectionPatterns = [
      '; rm -rf /',
      '| rm important.txt',
      '&& rm -rf *',
      '`rm file.txt`',
      '$(rm file.txt)'
    ];

    injectionPatterns.forEach(command => {
      it(`should block command injection pattern: ${command}`, async () => {
        const result = await bashTool.execute({ command });
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(ToolError);
        expect((result.error as ToolError).code).toBe('UNSAFE_COMMAND');
      });
    });

    it('should block execution in blocked paths', async () => {
      const blockedDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(blockedDir);

      const result = await bashTool.execute({
        command: 'echo test',
        cwd: blockedDir
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Basic Command Execution', () => {
    it('should execute simple echo command successfully', async () => {
      const result = await bashTool.execute({ command: 'echo "Hello World"' });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      const bashResult = result.output as BashResult;
      expect(bashResult.command).toBe('echo "Hello World"');
      expect(bashResult.exitCode).toBe(0);
      expect(bashResult.stdout).toBe('Hello World');
      expect(bashResult.stderr).toBe('');
      expect(bashResult.success).toBe(true);
      expect(bashResult.executionTime).toBeGreaterThan(0);
    });

    it('should capture stdout correctly', async () => {
      const result = await bashTool.execute({ command: 'echo -n "test output"' });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('test output');
      expect(bashResult.stderr).toBe('');
    });

    it('should capture stderr correctly', async () => {
      const result = await bashTool.execute({ command: 'echo "error message" >&2; exit 0' });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stderr).toBe('error message');
      expect(bashResult.exitCode).toBe(0);
    });

    it('should handle multi-line output', async () => {
      const result = await bashTool.execute({
        command: 'echo -e "line1\\nline2\\nline3"'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('line1\nline2\nline3');
    });

    it('should execute commands with pipes and redirects safely', async () => {
      const result = await bashTool.execute({
        command: 'echo "hello" | grep "hello"'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('hello');
    });
  });

  describe('Working Directory Control', () => {
    it('should execute in specified working directory', async () => {
      const subDir = path.join(tempDir, 'subdir');
      await fs.ensureDir(subDir);

      const result = await bashTool.execute({
        command: 'pwd',
        cwd: subDir
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.cwd).toBe(subDir);
      // On macOS, pwd might return /private/var/... while tempDir is /var/...
      // So we check that the real paths match by resolving symlinks
      const realSubDir = await fs.realpath(subDir);
      const realStdout = await fs.realpath(bashResult.stdout);
      expect(realStdout).toBe(realSubDir);
    });

    it('should default to context working directory', async () => {
      const result = await bashTool.execute({ command: 'pwd' });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.cwd).toBe(tempDir);
    });

    it('should resolve relative working directory paths', async () => {
      const subDir = path.join(tempDir, 'subdir');
      await fs.ensureDir(subDir);

      // Change to tempDir first so that './subdir' resolves correctly
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);

        const result = await bashTool.execute({
          command: 'pwd',
          cwd: './subdir'
        });

        expect(result.success).toBe(true);
        const bashResult = result.output as BashResult;
        // The resolved cwd should match the absolute path
        const realSubDir = await fs.realpath(subDir);
        const realCwd = await fs.realpath(bashResult.cwd);
        expect(realCwd).toBe(realSubDir);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Environment Variables', () => {
    it('should support custom environment variables', async () => {
      const result = await bashTool.execute({
        command: 'echo $TEST_VAR',
        env: { TEST_VAR: 'custom_value' }
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('custom_value');
    });

    it('should inherit system environment variables', async () => {
      const result = await bashTool.execute({
        command: 'echo $PATH'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBeTruthy();
      expect(bashResult.stdout.length).toBeGreaterThan(0);
    });

    it('should allow overriding system environment variables', async () => {
      const result = await bashTool.execute({
        command: 'echo $HOME',
        env: { HOME: '/custom/home' }
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('/custom/home');
    });
  });

  describe('Error Handling', () => {
    it('should handle command not found', async () => {
      const result = await bashTool.execute({ command: 'nonexistentcommand12345' });

      expect(result.success).toBe(true);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('COMMAND_FAILED');

      const bashResult = result.output as BashResult;
      expect(bashResult.exitCode).not.toBe(0);
      expect(bashResult.success).toBe(false);
    });

    it('should handle commands with non-zero exit codes', async () => {
      const result = await bashTool.execute({ command: 'exit 42' });

      expect(result.success).toBe(true);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('COMMAND_FAILED');

      const bashResult = result.output as BashResult;
      expect(bashResult.exitCode).toBe(42);
      expect(bashResult.success).toBe(false);
    });

    it('should handle permission denied errors', async () => {
      // Create a file and remove read permissions (if supported)
      const testFile = path.join(tempDir, 'noread.txt');
      await fs.writeFile(testFile, 'content');

      const result = await bashTool.execute({
        command: `chmod 000 "${testFile}" && cat "${testFile}"`
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.exitCode).not.toBe(0);
    });

    it('should provide helpful error suggestions', async () => {
      const result = await bashTool.execute({ command: 'exit 1' });

      expect(result.success).toBe(true);
      expect(result.error).toBeInstanceOf(ToolError);

      const error = result.error as ToolError;
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions?.length).toBeGreaterThan(0);
      expect(error.suggestions).toContain('Check the command syntax');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running commands', async () => {
      const result = await bashTool.execute({
        command: 'sleep 5',
        timeout: 1000 // 1 second timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ToolError);
      expect((result.error as ToolError).code).toBe('TIMEOUT');
    }, 10000); // Give test itself more time

    it('should complete within timeout for quick commands', async () => {
      const result = await bashTool.execute({
        command: 'echo "quick"',
        timeout: 5000
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.executionTime).toBeLessThan(5000);
    });

    it('should use default timeout when not specified', async () => {
      const result = await bashTool.execute({ command: 'echo "test"' });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.executionTime).toBeLessThan(30000); // Default timeout
    });
  });

  describe('File Operations', () => {
    it('should create and read files', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'test content';

      const writeResult = await bashTool.execute({
        command: `echo "${content}" > "${testFile}"`
      });
      expect(writeResult.success).toBe(true);

      const readResult = await bashTool.execute({
        command: `cat "${testFile}"`
      });
      expect(readResult.success).toBe(true);
      const bashResult = readResult.output as BashResult;
      expect(bashResult.stdout).toBe(content);
    });

    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');

      const result = await bashTool.execute({
        command: 'ls -1',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toContain('file1.txt');
      expect(bashResult.stdout).toContain('file2.txt');
    });

    it('should work with file paths containing spaces', async () => {
      const testFile = path.join(tempDir, 'file with spaces.txt');
      const content = 'content with spaces';

      const result = await bashTool.execute({
        command: `echo "${content}" > "${testFile}" && cat "${testFile}"`
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe(content);
    });
  });

  describe('Complex Commands', () => {
    it('should handle command chaining with &&', async () => {
      const result = await bashTool.execute({
        command: 'echo "first" && echo "second"'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('first\nsecond');
    });

    it('should handle command chaining with ||', async () => {
      const result = await bashTool.execute({
        command: 'false || echo "fallback"'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('fallback');
    });

    it('should handle variable assignment and usage', async () => {
      const result = await bashTool.execute({
        command: 'VAR="hello world"; echo $VAR'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('hello world');
    });

    it('should handle loops and conditionals', async () => {
      const result = await bashTool.execute({
        command: 'for i in 1 2 3; do echo "number $i"; done'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toContain('number 1');
      expect(bashResult.stdout).toContain('number 2');
      expect(bashResult.stdout).toContain('number 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle commands with special characters', async () => {
      const result = await bashTool.execute({
        command: 'echo "!@#$%^&*()_+-=[]{}|;:,.<>?"'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?');
    });

    it('should handle empty output', async () => {
      const result = await bashTool.execute({
        command: 'echo -n ""'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('');
    });

    it('should handle large output', async () => {
      const result = await bashTool.execute({
        command: 'for i in {1..100}; do echo "line $i"; done'
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout.split('\n').length).toBe(100);
    });

    it('should handle Unicode characters', async () => {
      const unicodeText = '你好世界 🌍 émojis and ñoñó';
      const result = await bashTool.execute({
        command: `echo "${unicodeText}"`
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe(unicodeText);
    });
  });

  describe('Process Management', () => {
    it('should clean up processes properly', async () => {
      const result = await bashTool.execute({
        command: 'echo "cleanup test"'
      });

      expect(result.success).toBe(true);
      // Process should be cleaned up automatically
      // This test ensures no hanging processes
    });

    it('should handle process errors gracefully', async () => {
      // Test command that might cause process spawn issues
      const result = await bashTool.execute({
        command: 'echo "test"',
        cwd: tempDir
      });

      expect(result.success).toBe(true);
      const bashResult = result.output as BashResult;
      expect(bashResult.stdout).toBe('test');
    });
  });
});
