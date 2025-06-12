/**
 * Tool Context Manager - Tracks tool execution patterns to prevent common errors
 *
 * Tracks file access patterns across tool calls to:
 * - Detect write-without-read scenarios
 * - Prevent diff mismatches by validating file access history
 * - Provide intelligent warnings for risky operations
 * - Track tool execution context for better error prevention
 */

export interface FileAccessInfo {
  path: string;
  lastRead?: Date;
  lastWrite?: Date;
  readCount: number;
  writeCount: number;
  contentHash?: string; // Hash of last read content
}

export interface ToolCallInfo {
  toolName: string;
  timestamp: Date;
  filePath?: string;
  operation?: 'read' | 'write' | 'other';
  success: boolean;
}

export class ToolContextManager {
  private static instance: ToolContextManager;
  private fileAccess = new Map<string, FileAccessInfo>();
  private toolHistory: ToolCallInfo[] = [];
  private readonly maxHistorySize = 100;
  private readonly readValidityWindow = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): ToolContextManager {
    if (!ToolContextManager.instance) {
      ToolContextManager.instance = new ToolContextManager();
    }
    return ToolContextManager.instance;
  }

  /**
   * Record a file read operation
   */
  recordFileRead(filePath: string, contentHash?: string): void {
    const normalizedPath = this.normalizePath(filePath);
    const now = new Date();

    const existing = this.fileAccess.get(normalizedPath) || {
      path: normalizedPath,
      readCount: 0,
      writeCount: 0
    };

    existing.lastRead = now;
    existing.readCount++;
    if (contentHash) {
      existing.contentHash = contentHash;
    }

    this.fileAccess.set(normalizedPath, existing);
    this.addToolHistory({
      toolName: 'read',
      timestamp: now,
      filePath: normalizedPath,
      operation: 'read',
      success: true
    });
  }

  /**
   * Record a file write operation
   */
  recordFileWrite(filePath: string, success: boolean): void {
    const normalizedPath = this.normalizePath(filePath);
    const now = new Date();

    const existing = this.fileAccess.get(normalizedPath) || {
      path: normalizedPath,
      readCount: 0,
      writeCount: 0
    };

    if (success) {
      existing.lastWrite = now;
      existing.writeCount++;
      // Clear content hash since file has been modified
      existing.contentHash = undefined;
    }

    this.fileAccess.set(normalizedPath, existing);
    this.addToolHistory({
      toolName: 'write',
      timestamp: now,
      filePath: normalizedPath,
      operation: 'write',
      success
    });
  }

  /**
   * Record any tool call
   */
  recordToolCall(toolName: string, success: boolean, filePath?: string): void {
    this.addToolHistory({
      toolName,
      timestamp: new Date(),
      filePath: filePath ? this.normalizePath(filePath) : undefined,
      operation: this.getOperationType(toolName),
      success
    });
  }

  /**
   * Validate if a write operation should proceed based on read history
   */
  validateWriteOperation(filePath: string, isDiff: boolean): { 
    isValid: boolean; 
    warnings: string[]; 
    suggestions: string[];
  } {
    const normalizedPath = this.normalizePath(filePath);
    const fileInfo = this.fileAccess.get(normalizedPath);
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // For diff operations, we need recent read access
    if (isDiff) {
      if (!fileInfo || !fileInfo.lastRead) {
        return {
          isValid: false,
          warnings: [
            '🚨 DIFF OPERATION WITHOUT READ: Attempting to apply diff without reading the file first',
            'This is likely to cause context mismatch errors'
          ],
          suggestions: [
            '🔧 SOLUTION: Use the read tool first to get current file content',
            '🔧 Then generate the diff based on the actual current state',
            '🔧 Alternative: Use content mode instead of diff to overwrite the file'
          ]
        };
      }

      // Check if read is recent enough
      const timeSinceRead = Date.now() - fileInfo.lastRead.getTime();
      if (timeSinceRead > this.readValidityWindow) {
        warnings.push(
          `⚠️ STALE READ: File was last read ${Math.round(timeSinceRead / 1000 / 60)} minutes ago`,
          'File content may have changed since last read'
        );
        suggestions.push(
          '🔧 Consider reading the file again to ensure current state',
          '🔧 Use content mode if you want to overwrite regardless of changes'
        );
      }

      // Check if file was written to after last read
      if (fileInfo.lastWrite && fileInfo.lastRead && fileInfo.lastWrite > fileInfo.lastRead) {
        warnings.push(
          '⚠️ FILE MODIFIED: File was written to after last read',
          'Diff may not apply correctly to current file state'
        );
        suggestions.push(
          '🔧 Read the file again to get the current state',
          '🔧 Generate a new diff based on current content'
        );
      }
    }

    // Check for repeated write failures
    const recentFailures = this.getRecentWriteFailures(normalizedPath);
    if (recentFailures > 2) {
      warnings.push(
        `⚠️ REPEATED FAILURES: ${recentFailures} recent write failures for this file`,
        'There may be a persistent issue with this file'
      );
      suggestions.push(
        '🔧 Check file permissions and locks',
        '🔧 Try a different approach or file path',
        '🔧 Use content mode instead of diff if diff operations are failing'
      );
    }

    // Only block on critical errors - warnings are allowed
    const hasCriticalError = isDiff && (!fileInfo || !fileInfo.lastRead);
    
    return {
      isValid: !hasCriticalError,
      warnings,
      suggestions
    };
  }

  /**
   * Get file access information
   */
  getFileInfo(filePath: string): FileAccessInfo | undefined {
    return this.fileAccess.get(this.normalizePath(filePath));
  }

  /**
   * Get recent tool history
   */
  getRecentHistory(limit: number = 10): ToolCallInfo[] {
    return this.toolHistory.slice(-limit);
  }

  /**
   * Clear old entries to prevent memory bloat
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours

    // Clean up file access info older than 24 hours
    for (const [path, info] of this.fileAccess.entries()) {
      const lastActivity = Math.max(
        info.lastRead?.getTime() || 0,
        info.lastWrite?.getTime() || 0
      );
      
      if (lastActivity < cutoff) {
        this.fileAccess.delete(path);
      }
    }

    // Clean up tool history
    this.toolHistory = this.toolHistory.filter(entry => 
      entry.timestamp.getTime() > cutoff
    );
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.fileAccess.clear();
    this.toolHistory = [];
  }

  private normalizePath(filePath: string): string {
    // Basic path normalization - could be enhanced with path.resolve
    return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  private addToolHistory(info: ToolCallInfo): void {
    this.toolHistory.push(info);
    
    // Keep history size manageable
    if (this.toolHistory.length > this.maxHistorySize) {
      this.toolHistory = this.toolHistory.slice(-this.maxHistorySize);
    }
  }

  private getOperationType(toolName: string): 'read' | 'write' | 'other' {
    if (toolName.toLowerCase().includes('read')) return 'read';
    if (toolName.toLowerCase().includes('write')) return 'write';
    return 'other';
  }

  private getRecentWriteFailures(filePath: string): number {
    const recentWindow = Date.now() - (10 * 60 * 1000); // 10 minutes
    return this.toolHistory.filter(entry => 
      entry.filePath === filePath &&
      entry.operation === 'write' &&
      !entry.success &&
      entry.timestamp.getTime() > recentWindow
    ).length;
  }
}

// Export singleton instance
export const toolContextManager = ToolContextManager.getInstance();