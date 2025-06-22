import chalk from 'chalk';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  source?: string;
  correlationId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableToolConsole?: boolean; // Separate setting for tool messages
  logDirectory?: string;
  maxLogFiles?: number;
  maxLogSizeBytes?: number;
}

/**
 * Centralized logging system for debugging and monitoring
 *
 * Features:
 * - Multiple log levels (ERROR, WARN, INFO, DEBUG, TRACE)
 * - Console and file output with rotation
 * - Structured logging with context and error details
 * - Colorized console output
 * - Integration with existing ToolLogger
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logFilePath?: string;
  private correlationId?: string;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || LogLevel.DEBUG,
      enableConsole: true,
      enableFile: true,
      enableToolConsole: true, // Default to showing tool messages
      logDirectory: path.join(os.homedir(), '.coding-agent', 'logs'),
      maxLogFiles: 10,
      maxLogSizeBytes: 10 * 1024 * 1024, // 10MB
      ...config,
    };
    if (this.config.enableFile && this.config.logDirectory) {
      this.initializeFileLogging();
    }
  }

  /**
   * Get singleton logger instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    } else if (config) {
      Logger.instance.configure(config);
    }
    return Logger.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    Logger.instance = null as any;
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.enableFile && this.config.logDirectory) {
      this.initializeFileLogging();
    }
  }

  /**
   * Initialize file logging system
   */
  private initializeFileLogging(): void {
    if (!this.config.logDirectory) return;

    try {
      fs.ensureDirSync(this.config.logDirectory);

      const timestamp = new Date().toISOString().split('T')[0];
      this.logFilePath = path.join(this.config.logDirectory, `coding-agent-${timestamp}.log`);

      // Rotate logs if needed
      this.rotateLogs();
    } catch (error) {
      console.error(chalk.red('Failed to initialize file logging:'), error);
      this.config.enableFile = false;
    }
  }

  /**
   * Rotate log files to prevent disk space issues
   */
  private rotateLogs(): void {
    if (!this.config.logDirectory || !this.logFilePath) return;

    try {
      // Check current log file size
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size > (this.config.maxLogSizeBytes || 10 * 1024 * 1024)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedPath = path.join(
            this.config.logDirectory,
            `coding-agent-${timestamp}.log`
          );
          fs.moveSync(this.logFilePath, rotatedPath);
        }
      }

      // Clean up old log files
      const logFiles = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith('coding-agent-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory!, file),
          stats: fs.statSync(path.join(this.config.logDirectory!, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      const maxFiles = this.config.maxLogFiles || 10;
      if (logFiles.length > maxFiles) {
        logFiles.slice(maxFiles).forEach(file => {
          fs.removeSync(file.path);
        });
      }
    } catch (error) {
      console.error(chalk.red('Failed to rotate logs:'), error);
    }
  }

  /**
   * Write log entry to console and/or file
   */
  private writeLog(entry: LogEntry, forceConsole = false): void {
    // Check if this log level should be output
    if (logLevelOrder(entry.level) > logLevelOrder(this.config.level)) {
      return;
    }

    // Console output - respect forceConsole for tool messages
    const shouldWriteToConsole = forceConsole || this.config.enableConsole;
    if (shouldWriteToConsole) {
      this.writeToConsole(entry);
    }

    // File output
    if (this.config.enableFile && this.logFilePath) {
      this.writeToFile(entry);
    }
  }

  /**
   * Write colorized log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = chalk.gray(entry.timestamp);
    const level = this.formatLogLevel(entry.level);
    const source = entry.source ? chalk.cyan(`[${entry.source}]`) : '';
    const correlationId = entry.correlationId ? chalk.magenta(`[${entry.correlationId}]`) : '';

    let message = `${timestamp} ${level} ${correlationId} ${source} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += '\n' + chalk.gray('  Context: ') + JSON.stringify(entry.context, null, 2);
    }

    if (entry.error) {
      message += '\n' + chalk.red('  Error: ') + entry.error.message;
      if (entry.error.stack && this.config.level >= LogLevel.DEBUG) {
        message += '\n' + chalk.gray('  Stack: ') + entry.error.stack;
      }
    }

    console.log(message);
  }

  /**
   * Write structured log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.logFilePath) return;

    try {
      // Ensure directory exists
      if (this.config.logDirectory) {
        fs.ensureDirSync(this.config.logDirectory);
      }

      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine);
    } catch (error) {
      console.error(chalk.red('Failed to write to log file:'), error);
    }
  }

  /**
   * Format log level with colors
   */
  private formatLogLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return chalk.red.bold('ERROR');
      case LogLevel.WARN:
        return chalk.yellow.bold('WARN ');
      case LogLevel.INFO:
        return chalk.blue.bold('INFO ');
      case LogLevel.DEBUG:
        return chalk.green.bold('DEBUG');
      case LogLevel.TRACE:
        return chalk.magenta.bold('TRACE');
      default:
        return chalk.white.bold('UNKNOWN');
    }
  }

  /**
   * Create log entry with common fields
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    source?: string,
    correlationId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? this.sanitizeApiData(context) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      source,
      correlationId: correlationId || this.correlationId,
    };
  }

  /**
   * Log an error with full context
   */
  error(message: string, error?: Error, context?: Record<string, any>, source?: string, correlationId?: string): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error, source, correlationId);
    this.writeLog(entry);
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: Record<string, any>, source?: string, correlationId?: string): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, undefined, source, correlationId);
    this.writeLog(entry);
  }

  /**
   * Log general information
   */
  info(message: string, context?: Record<string, any>, source?: string, correlationId?: string): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, undefined, source, correlationId);
    this.writeLog(entry);
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: Record<string, any>, source?: string, correlationId?: string): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, undefined, source, correlationId);
    this.writeLog(entry);
  }

  /**
   * Log detailed trace information
   */
  trace(message: string, context?: Record<string, any>, source?: string, correlationId?: string): void {
    const entry = this.createLogEntry(LogLevel.TRACE, message, context, undefined, source, correlationId);
    this.writeLog(entry);
  }

  /**
   * Log API call details for debugging
   */
  logApiCall(
    provider: string,
    endpoint: string,
    method: string,
    requestData?: any,
    response?: any,
    error?: Error
  ): void {
    const context = {
      provider,
      endpoint,
      method,
      requestData: requestData ? this.sanitizeApiData(requestData) : undefined,
      response: response ? this.sanitizeApiData(response) : undefined,
    };

    if (error) {
      this.error(`API call failed: ${provider} ${method} ${endpoint}`, error, context, 'API');
    } else {
      this.debug(`API call: ${provider} ${method} ${endpoint}`, context, 'API');
    }
  }

  /**
   * Log tool execution for debugging
   */
  logToolExecution(
    toolName: string,
    args: any,
    result?: any,
    error?: Error,
    executionTimeMs?: number
  ): void {
    const context = {
      toolName,
      args: this.sanitizeApiData(args),
      result: result ? this.sanitizeApiData(result) : undefined,
      executionTimeMs,
    };

    // For tool logs, use enableToolConsole setting to determine console output
    const forceConsole = this.config.enableToolConsole;

    if (error) {
      const entry = this.createLogEntry(LogLevel.ERROR, `Tool execution failed: ${toolName}`, context, error, 'TOOL');
      this.writeLog(entry, forceConsole);
    } else {
      const entry = this.createLogEntry(LogLevel.DEBUG, `Tool executed: ${toolName}`, context, undefined, 'TOOL');
      this.writeLog(entry, forceConsole);
    }
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeApiData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = ['apiKey', 'api_key', 'password', 'secret', 'authorization'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeApiData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return logLevelOrder(level) <= logLevelOrder(this.config.level);
  }

  /**
   * Get tool console setting
   */
  isToolConsoleEnabled(): boolean {
    return this.config.enableToolConsole ?? true;
  }

  /**
   * Set correlation ID for this logger instance
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  /**
   * Generate a new correlation ID
   */
  static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export default logger instance
export const logger = Logger.getInstance();

// Export convenient logging functions
export const logError = (message: string, error?: Error, context?: Record<string, any>, source?: string, correlationId?: string) =>
  logger.error(message, error, context, source, correlationId);

export const logWarn = (message: string, context?: Record<string, any>, source?: string, correlationId?: string) =>
  logger.warn(message, context, source, correlationId);

export const logInfo = (message: string, context?: Record<string, any>, source?: string, correlationId?: string) =>
  logger.info(message, context, source, correlationId);

export const logDebug = (message: string, context?: Record<string, any>, source?: string, correlationId?: string) =>
  logger.debug(message, context, source, correlationId);

export const logTrace = (message: string, context?: Record<string, any>, source?: string, correlationId?: string) =>
  logger.trace(message, context, source, correlationId);

function logLevelOrder(level: LogLevel): number {
  switch (level) {
    case LogLevel.ERROR: return 0;
    case LogLevel.WARN: return 1;
    case LogLevel.INFO: return 2;
    case LogLevel.DEBUG: return 3;
    case LogLevel.TRACE: return 4;
    default: return 2;
  }
}
