/**
 * SystemPromptBuilder - Generates context-aware system messages
 */

import * as path from 'path';
import { BaseTool } from '../tools';
import { ProjectDiscoveryResult } from './projectDiscovery';
import { ConversationMessage } from '../handlers/ConversationManager';

export class SystemPromptBuilder {
  private projectContext?: ProjectDiscoveryResult;

  /**
   * Set project context from discovery results
   */
  setProjectContext(projectContext: ProjectDiscoveryResult): void {
    this.projectContext = projectContext;
  }

  /**
   * Create system message that includes tool descriptions and context
   */
  createSystemMessage(tools: BaseTool[]): ConversationMessage {
    const currentDirectory = process.cwd();
    const projectName = path.basename(currentDirectory);
    const currentDateTime = new Date().toLocaleString();
    const platform = process.platform;
    const nodeVersion = process.version;

    const baseSystemMessage = `You are a helpful coding assistant. You help developers understand, analyze, and work with their code.

CURRENT CONTEXT:
- Date/Time: ${currentDateTime}
- Operating System: ${platform}
- Node.js Version: ${nodeVersion}
- Working Directory: ${currentDirectory}
- Project Name: ${projectName}
- When users refer to "this file", "this project", or use relative paths, they're referring to files within this directory

Key capabilities:
- Read and analyze files in the project
- Explain code functionality and structure
- Help debug issues and suggest improvements
- Provide clear, concise explanations
- Ask clarifying questions when needed

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

Use these tools when you need to access files or gather information about the project. Always be helpful, accurate, and focused on the specific coding task at hand.`;

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
      '',
      'Project Structure:',
      this.projectContext.projectStructure,
      '',
      'Tech Stack:',
      this.projectContext.techStack,
      ''
    ];

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