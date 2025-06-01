import { Logger, LogLevel, logger, logError, logInfo, logDebug } from '../utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('Logger', () => {
  const testLogDir = path.join(os.tmpdir(), 'test-coding-agent-logs');

  beforeEach(async () => {
    // Reset logger singleton
    Logger.resetInstance();

    // Clean up test directory
    if (await fs.pathExists(testLogDir)) {
      await fs.remove(testLogDir);
    }
  });

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testLogDir)) {
      await fs.remove(testLogDir);
    }
  });

  describe('Logger configuration', () => {
    it('should create a logger instance with default configuration', () => {
      const testLogger = Logger.getInstance();
      expect(testLogger).toBeDefined();
      expect(testLogger.getLogLevel()).toBe(LogLevel.INFO);
    });

    it('should allow configuration updates', () => {
      const testLogger = Logger.getInstance({
        level: LogLevel.DEBUG,
        enableFile: false
      });

      testLogger.configure({ level: LogLevel.TRACE });
      expect(testLogger.getLogLevel()).toBe(LogLevel.TRACE);
    });

    it('should check if log levels are enabled correctly', () => {
      const testLogger = Logger.getInstance({ level: LogLevel.WARN });

      expect(testLogger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
      expect(testLogger.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(testLogger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(testLogger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(testLogger.isLevelEnabled(LogLevel.TRACE)).toBe(false);
    });
  });

  describe('File logging', () => {
    it('should create log directory and files when file logging is enabled', async () => {
      const testLogger = Logger.getInstance({
        enableFile: true,
        logDirectory: testLogDir,
        level: LogLevel.DEBUG
      });

      testLogger.info('Test log message');

      // Give it a moment to write
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(await fs.pathExists(testLogDir)).toBe(true);

      const logFiles = await fs.readdir(testLogDir);
      expect(logFiles.length).toBeGreaterThan(0);
      expect(logFiles.some(file => file.startsWith('coding-agent-') && file.endsWith('.log'))).toBe(true);
    });

    it('should write structured log entries to file', async () => {
      const testLogger = Logger.getInstance({
        enableFile: true,
        enableConsole: false,
        logDirectory: testLogDir,
        level: LogLevel.DEBUG
      });

      const testContext = { userId: 123, action: 'test' };
      const testError = new Error('Test error');

      testLogger.error('Test error message', testError, testContext, 'TEST');
      testLogger.info('Test info message', testContext, 'TEST');

      // Give it a moment to write
      await new Promise(resolve => setTimeout(resolve, 100));

      const logFiles = await fs.readdir(testLogDir);
      const logFile = logFiles.find(file => file.endsWith('.log'));
      expect(logFile).toBeDefined();

      const logContent = await fs.readFile(path.join(testLogDir, logFile!), 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line);

      expect(logLines.length).toBe(2);

      const errorLog = JSON.parse(logLines[0]);
      expect(errorLog.level).toBe(LogLevel.ERROR);
      expect(errorLog.message).toBe('Test error message');
      expect(errorLog.context).toEqual(testContext);
      expect(errorLog.error.message).toBe('Test error');
      expect(errorLog.source).toBe('TEST');

      const infoLog = JSON.parse(logLines[1]);
      expect(infoLog.level).toBe(LogLevel.INFO);
      expect(infoLog.message).toBe('Test info message');
      expect(infoLog.context).toEqual(testContext);
      expect(infoLog.source).toBe('TEST');
    });
  });

  describe('Log level filtering', () => {
    it('should only log messages at or below configured level', () => {
      // Mock console methods to capture output
      const originalConsoleLog = console.log;
      let logCallCount = 0;
      console.log = jest.fn(() => { logCallCount++; });

      const testLogger = Logger.getInstance({
        level: LogLevel.WARN,
        enableFile: false,
        enableConsole: true
      });

      testLogger.error('Error message');  // Should log
      testLogger.warn('Warn message');    // Should log
      testLogger.info('Info message');    // Should NOT log
      testLogger.debug('Debug message');  // Should NOT log
      testLogger.trace('Trace message');  // Should NOT log

      expect(logCallCount).toBe(2);

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('API call logging', () => {
    it('should log successful API calls with sanitized data', () => {
      const originalConsoleLog = console.log;
      let logCallCount = 0;
      console.log = jest.fn(() => { logCallCount++; });

      const testLogger = Logger.getInstance({
        level: LogLevel.DEBUG,
        enableFile: false,
        enableConsole: true
      });

      const requestData = {
        apiKey: 'secret-key',
        message: 'Hello world',
        token: 'auth-token'
      };

      const responseData = {
        content: 'Response content',
        usage: { tokens: 100 }
      };

      testLogger.logApiCall('openai', '/chat/completions', 'POST', requestData, responseData);

      expect(logCallCount).toBeGreaterThan(0);

      // Restore console.log
      console.log = originalConsoleLog;
    });

    it('should log API call errors with context', () => {
      const originalConsoleLog = console.log;
      let logCallCount = 0;
      console.log = jest.fn(() => { logCallCount++; });

      const testLogger = Logger.getInstance({
        level: LogLevel.DEBUG,
        enableFile: false,
        enableConsole: true
      });

      const error = new Error('API request failed');
      testLogger.logApiCall('openai', '/chat/completions', 'POST', {}, undefined, error);

      expect(logCallCount).toBeGreaterThan(0);

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('Tool execution logging', () => {
    it('should log successful tool execution', () => {
      const originalConsoleLog = console.log;
      let logCallCount = 0;
      console.log = jest.fn(() => { logCallCount++; });

      const testLogger = Logger.getInstance({
        level: LogLevel.DEBUG,
        enableFile: false,
        enableConsole: true
      });

      const args = { path: '/test/path' };
      const result = { success: true, content: 'file content' };

      testLogger.logToolExecution('read', args, result, undefined, 150);

      expect(logCallCount).toBeGreaterThan(0);

      // Restore console.log
      console.log = originalConsoleLog;
    });

    it('should log tool execution errors', () => {
      const originalConsoleLog = console.log;
      let logCallCount = 0;
      console.log = jest.fn(() => { logCallCount++; });

      const testLogger = Logger.getInstance({
        level: LogLevel.DEBUG,
        enableFile: false,
        enableConsole: true
      });

      const args = { path: '/invalid/path' };
      const error = new Error('File not found');

      testLogger.logToolExecution('read', args, undefined, error, 50);

      expect(logCallCount).toBeGreaterThan(0);

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('Data sanitization', () => {
    it('should sanitize sensitive data in logs', async () => {
      const testLogger = Logger.getInstance({
        enableFile: true,
        enableConsole: false,
        logDirectory: testLogDir,
        level: LogLevel.DEBUG
      });

      const sensitiveData = {
        apiKey: 'secret-api-key',
        password: 'secret-password',
        token: 'auth-token',
        authorization: 'Bearer token',
        publicData: 'this is fine',
        nested: {
          api_key: 'nested-secret',
          normalData: 'also fine'
        }
      };

      testLogger.info('Test with sensitive data', sensitiveData);

      // Give it a moment to write
      await new Promise(resolve => setTimeout(resolve, 100));

      const logFiles = await fs.readdir(testLogDir);
      const logFile = logFiles.find(file => file.endsWith('.log'));
      const logContent = await fs.readFile(path.join(testLogDir, logFile!), 'utf8');
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.context.apiKey).toBe('[REDACTED]');
      expect(logEntry.context.password).toBe('[REDACTED]');
      expect(logEntry.context.token).toBe('[REDACTED]');
      expect(logEntry.context.authorization).toBe('[REDACTED]');
      expect(logEntry.context.publicData).toBe('this is fine');
      expect(logEntry.context.nested.api_key).toBe('[REDACTED]');
      expect(logEntry.context.nested.normalData).toBe('also fine');
    });
  });

  describe('Convenience functions', () => {
    it('should work with exported convenience functions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Configure logger for testing
      logger.configure({
        level: LogLevel.DEBUG,
        enableFile: false,
        enableConsole: true
      });

      logError('Error message', new Error('test error'));
      logInfo('Info message', { key: 'value' });
      logDebug('Debug message', undefined, 'TEST');

      expect(consoleSpy).toHaveBeenCalledTimes(3);

      consoleSpy.mockRestore();
    });
  });
});
