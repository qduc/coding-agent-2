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
   */
  async createSystemMessage(tools: BaseTool[], userMessage?: string): Promise<ConversationMessage> {
    // Auto-detect task context from user message if not already set
    if (userMessage && !this.taskContext?.type) {
      const projectSummary = this.projectContext?.summary || '';
      const analysisResult = await this.taskAnalyzer.analyzeTask(
        userMessage, 
        this.llmService,
        projectSummary
      );
      
      this.setTaskContext({
        type: analysisResult.type,
        complexity: analysisResult.complexity
      });
    }
    const currentDirectory = process.cwd();
    const projectName = path.basename(currentDirectory);
    const currentDateTime = new Date().toLocaleString();
    const platform = process.platform;
    const nodeVersion = process.version;

    const baseSystemMessage = `You are an intelligent coding assistant with advanced problem-solving capabilities. You help developers understand, analyze, and work with their code systematically.

CURRENT CONTEXT:
- Date/Time: ${currentDateTime}
- Operating System: ${platform}
- Node.js Version: ${nodeVersion}
- Working Directory: ${currentDirectory}
- Project Name: ${projectName}
- When users refer to "this file", "this project", or use relative paths, they're referring to files within this directory

${this.getTaskSpecificGuidance()}

Key capabilities:
- Read and analyze files in the project systematically
- Explain code functionality and architectural patterns
- Debug issues using systematic approaches
- Implement features following best practices
- Provide clear, actionable recommendations

You have access to the following tools:`;

    const toolDescriptions = tools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    // Include project context if available
    const projectContextSection = this.projectContext ?
      `\n\n${this.formatProjectContextForPrompt()}\n` : '\n';

    const fullSystemMessage = `${baseSystemMessage}\n${toolDescriptions}${projectContextSection}\nWhen working with files:
- Use the current working directory (${currentDirectory}) as the base for relative paths
- When users say "this file" or "this project", they mean files in the current directory
- Use the ls tool to explore the project structure when needed
- Always provide helpful context about what you find

${this.getWorkflowGuidance()}

Use these tools when you need to access files or gather information about the project. Always be helpful, accurate, and focused on the specific coding task at hand.`;

    return {
      role: 'system',
      content: fullSystemMessage
    };
  }

  /**
   * Get task-specific guidance based on current context
   */
  private getTaskSpecificGuidance(): string {
    if (!this.taskContext?.type) {
      return '';
    }

    const guidanceMap = {
      debug: `DEBUGGING MODE: You are currently helping debug an issue.
- Think systematically: gather symptoms, form hypotheses, test them
- Use tools to examine logs, traces, and code execution paths
- Focus on root cause analysis, not just symptom fixes`,

      implement: `IMPLEMENTATION MODE: You are implementing new functionality.
- Follow existing code patterns and conventions
- Consider error handling, edge cases, and performance
- Write clean, maintainable code with proper documentation`,

      refactor: `REFACTORING MODE: You are improving existing code structure.
- Preserve existing functionality while improving design
- Follow SOLID principles and eliminate code smells
- Ensure backward compatibility and update related tests`,

      test: `TESTING MODE: You are working on test implementation.
- Focus on comprehensive coverage including edge cases
- Write clear, descriptive test names and documentation
- Consider different testing strategies (unit, integration, e2e)`,

      analyze: `ANALYSIS MODE: You are analyzing code structure and behavior.
- Examine patterns, dependencies, and architectural decisions
- Identify potential issues, improvements, and optimizations
- Provide clear explanations of how code works`,

      general: ''
    };

    return guidanceMap[this.taskContext.type] || '';
  }

  /**
   * Get workflow guidance based on task complexity
   */
  private getWorkflowGuidance(): string {
    if (!this.taskContext?.complexity) {
      return `APPROACH: Think step by step and be systematic in your analysis and implementations.`;
    }

    const workflowMap = {
      simple: `APPROACH: Handle this straightforward task efficiently while maintaining quality.`,
      
      moderate: `APPROACH: Break this task into logical steps:
1. Understand the requirements and existing context
2. Plan your approach and identify dependencies
3. Implement incrementally with validation
4. Test and verify your solution`,

      complex: `APPROACH: Use systematic problem-solving for this complex task:
1. Analyze the problem thoroughly and gather all relevant context
2. Break down into smaller, manageable subtasks
3. Identify dependencies and potential risks
4. Plan implementation strategy with validation points
5. Implement incrementally, testing at each step
6. Verify complete solution and document any architectural decisions`
    };

    return workflowMap[this.taskContext.complexity] || '';
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

    // Add current focus if available
    if (this.taskContext?.currentFocus) {
      lines.push(`Current Focus: ${this.taskContext.currentFocus}`);
      lines.push('');
    }

    // Add recent actions context if available
    if (this.taskContext?.recentActions && this.taskContext.recentActions.length > 0) {
      lines.push('Recent Actions:');
      this.taskContext.recentActions.slice(-3).forEach(action => {
        lines.push(`- ${action}`);
      });
      lines.push('');
    }

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



  /**
   * Create a minimal system message without project context
   */
  createMinimalSystemMessage(): ConversationMessage {
    const currentDirectory = process.cwd();
    
    return {
      role: 'system',
      content: `You are a helpful coding assistant working in: ${currentDirectory}`
    };
  }

  /**
   * Update system message with new tools
   */
  updateSystemMessageWithTools(existingMessage: ConversationMessage, tools: BaseTool[]): ConversationMessage {
    // For now, just create a new system message
    // In the future, this could be optimized to only update the tools section
    return this.createSystemMessage(tools);
  }
}