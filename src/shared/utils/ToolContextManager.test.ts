/**
 * Tests for ToolContextManager - File access tracking and validation
 */

import { ToolContextManager } from './ToolContextManager';

describe('ToolContextManager', () => {
  let manager: ToolContextManager;

  beforeEach(() => {
    manager = ToolContextManager.getInstance();
    manager.reset(); // Clear state between tests
  });

  describe('file access tracking', () => {
    it('should track file reads', () => {
      const filePath = '/test/file.txt';
      const contentHash = 'abc123';

      manager.recordFileRead(filePath, contentHash);

      const fileInfo = manager.getFileInfo(filePath);
      expect(fileInfo).toBeDefined();
      expect(fileInfo!.path).toBe(filePath);
      expect(fileInfo!.readCount).toBe(1);
      expect(fileInfo!.contentHash).toBe(contentHash);
      expect(fileInfo!.lastRead).toBeDefined();
    });

    it('should track file writes', () => {
      const filePath = '/test/file.txt';

      manager.recordFileWrite(filePath, true);

      const fileInfo = manager.getFileInfo(filePath);
      expect(fileInfo).toBeDefined();
      expect(fileInfo!.writeCount).toBe(1);
      expect(fileInfo!.lastWrite).toBeDefined();
    });

    it('should normalize file paths', () => {
      manager.recordFileRead('\\test\\file.txt');
      manager.recordFileRead('/test//file.txt');

      const fileInfo1 = manager.getFileInfo('/test/file.txt');
      const fileInfo2 = manager.getFileInfo('\\test\\file.txt');

      expect(fileInfo1).toBeDefined();
      expect(fileInfo2).toBeDefined();
      expect(fileInfo1!.readCount).toBe(2); // Both reads recorded for same normalized path
    });
  });

  describe('write validation', () => {
    it('should reject diff operations without prior read', () => {
      const filePath = '/test/file.txt';

      const validation = manager.validateWriteOperation(filePath, true);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings.join(' ')).toMatch(/DIFF OPERATION WITHOUT READ/);
      expect(validation.suggestions.join(' ')).toMatch(/use the read tool first/i);
    });

    it('should allow diff operations after recent read', () => {
      const filePath = '/test/file.txt';

      // Record a recent read
      manager.recordFileRead(filePath, 'hash123');

      const validation = manager.validateWriteOperation(filePath, true);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should warn about stale reads', async () => {
      const filePath = '/test/file.txt';

      // Record a read and manually set it to be old
      manager.recordFileRead(filePath, 'hash123');
      const fileInfo = manager.getFileInfo(filePath)!;
      // Set to 10 minutes ago (beyond the 5 minute window)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      fileInfo.lastRead = tenMinutesAgo;

      const validation = manager.validateWriteOperation(filePath, true);

      expect(validation.isValid).toBe(true); // Still valid but with warnings
      expect(validation.warnings.join(' ')).toMatch(/STALE READ/);
    });

    it('should warn about file modifications after read', () => {
      const filePath = '/test/file.txt';

      // Record read then write
      manager.recordFileRead(filePath, 'hash123');
      manager.recordFileWrite(filePath, true);
      
      // Manually adjust timestamps to ensure write is after read
      const fileInfo = manager.getFileInfo(filePath)!;
      const readTime = new Date(Date.now() - 1000); // 1 second ago
      const writeTime = new Date(Date.now()); // Now
      fileInfo.lastRead = readTime;
      fileInfo.lastWrite = writeTime;

      const validation = manager.validateWriteOperation(filePath, true);

      expect(validation.warnings.join(' ')).toMatch(/FILE MODIFIED/);
    });

    it('should allow content mode without read', () => {
      const filePath = '/test/file.txt';

      const validation = manager.validateWriteOperation(filePath, false);

      expect(validation.isValid).toBe(true);
    });

    it('should warn about repeated write failures', () => {
      const filePath = '/test/file.txt';

      // Record multiple failed writes
      manager.recordFileWrite(filePath, false);
      manager.recordFileWrite(filePath, false);
      manager.recordFileWrite(filePath, false);

      const validation = manager.validateWriteOperation(filePath, false);

      expect(validation.warnings.join(' ')).toMatch(/REPEATED FAILURES/);
    });
  });

  describe('tool history', () => {
    it('should track tool calls', () => {
      manager.recordToolCall('read', true, '/test/file.txt');
      manager.recordToolCall('write', false, '/test/file2.txt');

      const history = manager.getRecentHistory();

      expect(history).toHaveLength(2);
      expect(history[0].toolName).toBe('read');
      expect(history[0].success).toBe(true);
      expect(history[1].toolName).toBe('write');
      expect(history[1].success).toBe(false);
    });

    it('should limit history size', () => {
      // Record more than the history limit
      for (let i = 0; i < 150; i++) {
        manager.recordToolCall('test', true);
      }

      const history = manager.getRecentHistory(200); // Request more than limit

      expect(history.length).toBeLessThanOrEqual(100); // Should be capped at maxHistorySize
    });
  });

  describe('cleanup', () => {
    it('should remove old entries during cleanup', () => {
      const filePath = '/test/old-file.txt';

      // Record access and manually set to old timestamp
      manager.recordFileRead(filePath);
      const fileInfo = manager.getFileInfo(filePath)!;
      fileInfo.lastRead = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      manager.cleanup();

      const fileInfoAfterCleanup = manager.getFileInfo(filePath);
      expect(fileInfoAfterCleanup).toBeUndefined();
    });
  });
});