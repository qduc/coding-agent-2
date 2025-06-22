/**
 * Bash Tool - Execute bash commands with security controls
 *
 * Provides bash command execution with:
 * - Single command execution with output capture
 * - Timeout protection
 * - Working directory control
 * - Basic security validation
 * - Exit code and error handling
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import { validatePath } from './validation';
import { toolContextManager } from '../utils/ToolContextManager';
import * as ApprovalManager from '../../cli/approval/ApprovalManager';

/**
 * Parameters for the Bash tool
 */
export interface BashParams {
  /** Command to execute */
  command: string;
  /** Working directory for command execution (optional) */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000ms) */
  timeout?: number;
  /** Environment variables to set (optional) */
  env?: Record<string, string>;
}

/**
 * Bash tool execution result
 */
export interface BashResult {
  /** The command that was executed */
  command: string;
  /** Working directory where command was executed */
  cwd: string;
  /** Command exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether command completed successfully */
  success: boolean;
}

export class BashTool extends BaseTool {
  readonly name = 'bash';
  readonly description = 'Execute bash commands with security controls and output capture';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to execute'
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution (defaults to current working directory)'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000ms, max: 300000ms)',
        default: 30000,
        minimum: 1000,
        maximum: 300000
      },
      env: {
        type: 'object',
        description: 'Environment variables to set for the command',
        properties: {}
      }
    },
    required: ['command'],
    additionalProperties: false
  };

  protected async executeImpl(params: BashParams, abortSignal?: AbortSignal): Promise<ToolResult> {
    const {
      command,
      cwd = this.context.workingDirectory,
      timeout = 30000,
      env = {}
    } = params;

    // Approval check before destructive action
    if (process.env.CODING_AGENT_REQUIRE_APPROVAL === '1') {
      const approval = await ApprovalManager.requestApproval({
        type: 'command',
        command,
        cwd
      });
      if (approval === 'denied') {
        return this.createErrorResult('Command denied by user approval', 'PERMISSION_DENIED');
      }
    }

    try {
      // Security validation
      this.validateCommand(command);

      // Validate and resolve working directory
      const resolvedCwd = path.resolve(cwd);
      validatePath(resolvedCwd, { allowAbsolute: true, mustExist: true });

      if (this.isBlockedPath(resolvedCwd)) {
        return this.createErrorResult(
          `Execution in directory is restricted: ${cwd}`,
          'PERMISSION_DENIED',
          ['Choose a different working directory that is not blocked']
        );
      }

      const startTime = Date.now();
      const result = await this.executeCommand(command, resolvedCwd, timeout, env, abortSignal);
      const executionTime = Date.now() - startTime;

      const bashResult: BashResult = {
        command,
        cwd: resolvedCwd,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime,
        success: result.exitCode === 0
      };

      // Track successful bash execution
      toolContextManager.recordToolCall('bash', true);

      return this.createSuccessResult(bashResult, {
        commandExecuted: command,
        exitCode: result.exitCode,
        executionTimeMs: executionTime
      });

    } catch (error) {
      // Track failed bash execution due to exception
      toolContextManager.recordToolCall('bash', false);

      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Failed to execute bash command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXECUTION_ERROR'
      );
    }
  }

  /**
   * Validate command for security
   */
  private validateCommand(command: string): void {
    // Basic security checks
    if (!command.trim()) {
      throw new ToolError('Command cannot be empty', 'INVALID_COMMAND');
    }

    // Check for command injection patterns first (these take precedence)
    const injectionPatterns = [
      /;.*rm\s/, // command chaining with rm
      /\|\s*rm\s/, // piping to rm
      /&&.*rm\s/, // conditional execution with rm
      /`.*`/, // command substitution
      /\$\(.*\)/, // command substitution
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(command)) {
        throw new ToolError(
          `Command contains potentially unsafe patterns: ${command}`,
          'UNSAFE_COMMAND'
        );
      }
    }

    // Block potentially dangerous commands (standalone commands)
    const dangerousPatterns = [
      /^rm\s+-rf\s+\//, // rm -rf / as standalone command (not as injection)
      /\bsudo\b/, // sudo commands
      /\bsu\b/, // switch user
      /\bchmod\s+777/, // chmod 777
      /\bpasswd\b/, // password changes
      /\bshutdown\b/, // system shutdown
      /\breboot\b/, // system reboot
      /\bkill\s+-9\s+1\b/, // kill init process
      /\bdd\s+if=/, // dd commands (potentially destructive)
      /\bformat\b/, // format commands
      /\bmkfs\b/, // filesystem creation
      /\bfdisk\b/, // disk partitioning
      />/g.test(command) && command.split('>').length > 3, // excessive redirections
    ];

    for (const pattern of dangerousPatterns) {
      if (typeof pattern === 'boolean' ? pattern : pattern.test(command)) {
        throw new ToolError(
          `Command contains potentially dangerous operations: ${command}`,
          'DANGEROUS_COMMAND'
        );
      }
    }
  }

  /**
   * Execute command and capture output
   */
  private async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    env: Record<string, string>,
    abortSignal?: AbortSignal
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (abortSignal?.aborted) {
        reject(new ToolError('Operation was aborted by user', 'OPERATION_TIMEOUT'));
        return;
      }

      const childProcess = spawn('bash', ['-c', command], {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Handle abort signal
      const abortHandler = () => {
        childProcess.kill('SIGTERM'); // First try graceful termination
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL'); // Force kill if still running
          }
        }, 1000);
        clearTimeout(timeoutId);
        reject(new ToolError('Operation was aborted by user', 'OPERATION_TIMEOUT'));
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', abortHandler);
      }

      // Set up timeout
      timeoutId = setTimeout(() => {
        childProcess.kill('SIGKILL');
        reject(new ToolError(`Command timed out after ${timeout}ms`, 'TIMEOUT'));
      }, timeout);

      // Capture stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Capture stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
        resolve({
          exitCode: code ?? -1,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
        reject(new ToolError(`Failed to spawn process: ${error.message}`, 'SPAWN_ERROR'));
      });
    });
  }

  /**
   * Check if a path is blocked (reused from ls.ts pattern)
   */
  private isBlockedPath(targetPath: string): boolean {
    const normalizedPath = path.normalize(targetPath);
    const pathParts = normalizedPath.split(path.sep);

    return this.context.blockedPaths.some(blockedPattern => {
      return pathParts.some(part => {
        return (
          part === blockedPattern ||
          normalizedPath.includes(blockedPattern)
        );
      });
    });
  }

  /**
   * Get human-readable output for display formatting
   */
  getHumanReadableOutput(params: BashParams, success: boolean, result?: any): string {
    if (!success) {
      let errorMsg = 'Command failed';
      if (result?.stderr) {
        errorMsg = `Command failed (exit ${result.exitCode || 'unknown'}): ${result.stderr}`;
      } else if (result?.error?.message) {
        errorMsg = result.error.message;
      } else if (result?.message) {
        errorMsg = result.message;
      } else if (result instanceof Error) {
        errorMsg = result.message;
      } else if (result?.exitCode !== 0) {
        errorMsg = `Command failed with exit code ${result.exitCode}`;
      }
      return `\n${errorMsg}`;
    }

    let context = '';
    if (params.command) {
      let contextParams = [];
      if (params.timeout) contextParams.push(`timeout: ${params.timeout}ms`);
      if (params.cwd) contextParams.push(`cwd: ${params.cwd}`);
      const paramStr = contextParams.length > 0 ? ` (${contextParams.join(', ')})` : '';
      context = ` "${params.command}"${paramStr}`;
    }

    if (typeof result === 'object' && result?.exitCode !== undefined) {
      const time = result.executionTime ? ` ${result.executionTime}ms` : '';
      if (result.exitCode === 0) {
        // For successful commands, show stdout if available and not too long
        let output = '';
        if (result.stdout && result.stdout.length < 500) {
          output = `\n${result.stdout}`;
        } else if (result.stdout && result.stdout.length >= 500) {
          output = `\n${result.stdout.substring(0, 500)}...`;
        }
        return `${context} • ok${time}${output}`;
      } else {
        let stderr = result.stderr || '';
        if (stderr.length > 500) {
          stderr = stderr.substring(0, 500) + '...';
        }
        return `${context} • exit ${result.exitCode}${time}\n${stderr}`;
      }
    }

    return `${context} • executed`;
  }
}
