/**
 * SystemPromptBuilder - Generates context-aware system messages
 */

import * as path from 'path';
import { BaseTool } from '../tools';
import { ProjectDiscoveryResult } from './projectDiscovery';
import { ConversationMessage } from '../handlers/ConversationManager';
import { TaskAnalyzer } from './TaskAnalyzer';
import { LLMService } from '../services/llm';

export interface TaskContext {
  type?: 'debug' | 'implement' | 'refactor' | 'test' | 'analyze' | 'general';
  complexity?: 'simple' | 'moderate' | 'complex';
  recentActions?: string[];
  currentFocus?: string;
}

export class SystemPromptBuilder {
  private projectContext?: ProjectDiscoveryResult;
  private taskContext?: TaskContext;
  private taskAnalyzer = TaskAnalyzer.getInstance();
  private llmService?: LLMService;

  /**
   * Set project context from discovery results
   */
  setProjectContext(projectContext: ProjectDiscoveryResult): void {
    this.projectContext = projectContext;
  }

  /**
   * Set current task context for better prompting
   */
  setTaskContext(taskContext: TaskContext): void {
    this.taskContext = taskContext;
  }

  /**
   * Set LLM service for AI-powered task analysis
   */
  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }
  /**
   * Create system message that includes tool descriptions and context
   * @returns A system message with appropriate context
   */
  async createSystemMessage(): Promise<ConversationMessage> {
    const currentDirectory = process.cwd();
    const projectName = path.basename(currentDirectory);
    const currentDateTime = new Date().toLocaleString();
    const platform = process.platform;

    const baseSystemMessage = `You are an intelligent coding assistant with advanced problem-solving capabilities. You help developers understand, analyze, and work with their code systematically.

CURRENT CONTEXT:
- Date/Time: ${currentDateTime}
- Operating System: ${platform}
- Working Directory: ${currentDirectory}
- Project Name: ${projectName}
- When users refer to "this file", "this project", or use relative paths, they're referring to files within this directory

Key capabilities:
- Read and analyze files in the project systematically
- Explain code functionality and architectural patterns
- Debug issues using systematic approaches
- Implement features following best practices
- Provide clear, actionable recommendations`;

    // Include project context if available
    const projectContextSection = this.projectContext ?
      `\n\n${this.formatProjectContextForPrompt()}\n` : '\n';

    const fullSystemMessage = `${baseSystemMessage}\n${projectContextSection}\nWhen working with files:
- Use the current working directory (${currentDirectory}) as the base for relative paths
- When users say "this", they mean the project in the current directory
- Be proactive, assume the user intention is to make change to the codebase with the write tool, don't ask for confirmation unless the change is destructive

Always be helpful, accurate, and focused on the specific coding task at hand.`;

    return {
      role: 'system',
      content: fullSystemMessage
    };
  }
  /**
   * Format project context for inclusion in system prompt
   */
  private formatProjectContextForPrompt(): string {
    if (!this.projectContext) {
      return '';
    }

    const lines = [
      'PROJECT CONTEXT:',
      this.projectContext.summary,
      ''
    ];

    lines.push(
      'Project Structure:',
      this.projectContext.projectStructure,
      '',
      'Tech Stack:',
      this.projectContext.techStack,
      ''
    );

    if (this.projectContext.entryPoints.length > 0) {
      lines.push(`Entry Points: ${this.projectContext.entryPoints.join(', ')}`);
    }

    return lines.join('\n');
  }
}