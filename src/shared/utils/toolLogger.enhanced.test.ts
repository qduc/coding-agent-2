/**
 * Enhanced ToolLogger tests - Focus on write tool failure logging
 */

import { ToolLogger } from './toolLogger';
import { configManager } from '../core/config';

// Mock dependencies
jest.mock('./logger');
jest.mock('./toolEvents');
jest.mock('../core/config');
jest.mock('chalk', () => ({
  red: (str: string) => str,
  yellow: (str: string) => str,
  gray: (str: string) => str,
  default: {
    red: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
  }
}));

describe('ToolLogger Enhanced Write Failure Logging', () => {
  let originalConsoleError: any;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    // Mock console.error to capture output
    originalConsoleError = console.error;
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    // Mock configManager to enable tool console logging
    (configManager.getConfig as jest.Mock).mockReturnValue({
      enableToolConsole: true
    });
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  describe('logToolResult for write tool failures', () => {
    it('should log enhanced details for write tool failures with content', () => {
      const toolName = 'write';
      const success = false;
      const result = new Error('Permission denied');
      const args = {
        path: '/test/file.txt',
        content: 'Line 1\nLine 2\nLine 3',
        encoding: 'utf8'
      };

      ToolLogger.logToolResult(toolName, success, result, args);

      // Verify that console.error was called with detailed failure information
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/━━━ WRITE TOOL FAILURE ━━━/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Tool: write/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Error: Permission denied/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Arguments passed to tool:/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Target file: \/test\/file\.txt/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Content: 3 lines, 20 chars/));
    });

    it('should log enhanced details for write tool failures with diff', () => {
      const toolName = 'write';
      const success = false;
      const result = new Error('Invalid diff format');
      const args = {
        path: '/test/file.txt',
        diff: '@@ -1,2 +1,2 @@\n context\n-old line\n+new line',
        encoding: 'utf8'
      };

      ToolLogger.logToolResult(toolName, success, result, args);

      // Verify that console.error was called with detailed failure information
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/━━━ WRITE TOOL FAILURE ━━━/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Error: Invalid diff format/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Target file: \/test\/file\.txt/));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringMatching(/Diff: 4 lines/));
    });

    it('should not show enhanced logging when enableToolConsole is false', () => {
      // Mock configManager to disable tool console logging
      (configManager.getConfig as jest.Mock).mockReturnValue({
        enableToolConsole: false
      });

      const toolName = 'write';
      const success = false;
      const result = new Error('Permission denied');
      const args = {
        path: '/test/file.txt',
        content: 'test content'
      };

      ToolLogger.logToolResult(toolName, success, result, args);

      // Verify that console.error was NOT called for enhanced output
      expect(mockConsoleError).not.toHaveBeenCalledWith(expect.stringMatching(/━━━ WRITE TOOL FAILURE ━━━/));
    });

    it('should use standard logging for non-write tool failures', () => {
      const toolName = 'read';
      const success = false;
      const result = new Error('File not found');
      const args = { path: '/test/file.txt' };

      ToolLogger.logToolResult(toolName, success, result, args);

      // Verify that enhanced write tool logging was NOT used
      expect(mockConsoleError).not.toHaveBeenCalledWith(expect.stringMatching(/━━━ WRITE TOOL FAILURE ━━━/));
    });
  });

  describe('getCondensedOutcome for write tool failures', () => {
    it('should provide enhanced error context for write failures', () => {
      const toolName = 'write';
      const success = false;
      const result = new Error('Permission denied');
      const args = {
        path: '/test/file.txt',
        content: 'Line 1\nLine 2\nLine 3'
      };

      // Access the private method via array notation
      const outcome = (ToolLogger as any).getCondensedOutcome(toolName, success, result, args);

      expect(outcome).toContain('failed to /test/file.txt (3 lines): Permission denied');
    });

    it('should provide enhanced error context for write failures with diff', () => {
      const toolName = 'write';
      const success = false;
      const result = new Error('Invalid diff');
      const args = {
        path: '/test/file.txt',
        diff: '@@ -1,2 +1,2 @@\n context\n-old\n+new'
      };

      const outcome = (ToolLogger as any).getCondensedOutcome(toolName, success, result, args);

      expect(outcome).toContain('failed to /test/file.txt (diff: 4 lines): Invalid diff');
    });

    it('should handle string error results', () => {
      const toolName = 'write';
      const success = false;
      const result = 'File is read-only';
      const args = {
        path: '/test/file.txt',
        content: 'test'
      };

      const outcome = (ToolLogger as any).getCondensedOutcome(toolName, success, result, args);

      expect(outcome).toContain('failed to /test/file.txt (1 lines): File is read-only');
    });
  });
});
