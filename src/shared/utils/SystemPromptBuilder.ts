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

    const toolUsageSection = this.formatToolUsageForPrompt();

    const fullSystemMessage = `${baseSystemMessage}\n${projectContextSection}\n${toolUsageSection}\nWhen working with files:
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

  /**
   * Format tool usage guide for inclusion in system prompt
   */
  private formatToolUsageForPrompt(): string {
    return `
AVAILABLE TOOLS & USAGE:

📁 File Operations:
• read - Read file contents with encoding support and line ranges
  Use: Read source code, config files, documentation; supports partial reading
  Example: read({path: "src/main.ts", startLine: 10, endLine: 50})

• write - Create or modify files with content or diff patches
  Use: Create new files or apply targeted changes to existing files
  Modes: Full content replacement or unified diff patches
  Example: write({path: "file.js", diff: "- old line\\n+ new line"})

• ls - List directory contents with metadata and filtering
  Use: Explore project structure, find files with optional glob patterns
  Example: ls({path: "src", pattern: "*.ts", depth: 2})

🔍 Search & Discovery:
• glob - Pattern-based file discovery with advanced filtering
  Use: Find files by name patterns, supports inclusion/exclusion patterns
  Example: glob({pattern: "**/*.test.ts", includeHidden: false})

• ripgrep - Fast text search across files with context and regex
  Use: Search code patterns, function definitions, string literals
  Example: ripgrep({pattern: "export.*function", types: ["js", "ts"]})

⚙️ System Operations:
• bash - Execute shell commands with security controls and timeout
  Use: Run tests, build scripts, git operations, package management
  Example: bash({command: "npm test", timeout: 60000})

📋 Task Management:
• todo - Manage in-memory todo lists for complex task planning
  Use: Break down multi-step tasks, track progress, maintain context
  Example: todo({action: "add", text: "Implement user authentication"})

🤖 Delegation:
• sub_agent - Delegate specialized tasks to focused sub-agents
  Use: Complex tasks requiring specific expertise (code, test, debug, docs)
  Auto-detects specialization or specify: code, test, debug, docs, search, validation
  Example: sub_agent({task_description: "Generate unit tests", auto_detect_specialization: true})

🌐 Web Search:
• web_search - Search the internet using Brave Search API
  Use: Find current information, documentation, examples, troubleshooting
  Example: web_search({query: "TypeScript async await best practices"})

WRITE TOOL DIFF MODE - DETAILED GUIDE:

The write tool's diff mode is powerful but requires precise formatting. Here are key examples:

BASIC DIFF FORMAT:
existing line before change
-line to remove
+line to add
existing line after change

MULTIPLE CHANGES (use ... separator):
function greet(name) {
-  console.log("Hello, " + name);
+  console.log("Hi there, " + name + "!");
  return "greeting complete";
...
function farewell() {
-  return "goodbye";
+  return "farewell, friend!";
}

CONTEXT REQUIREMENTS:
- Include unchanged lines around changes for location matching
- Context must be unique in the file to avoid ambiguity
- Use exact indentation and spacing from the original file
- Include enough context to uniquely identify the location

COMMON PITFALLS TO AVOID:
- ❌ No context lines: diff with only + and - lines
- ❌ Ambiguous context: lines that appear multiple times in file
- ❌ Wrong indentation: spaces/tabs must match exactly
- ❌ Missing separators: use ... between distant changes

TOOL SELECTION STRATEGY:
- Start with exploration: ls → glob → read to understand codebase structure
- Use ripgrep for finding specific code patterns or implementations
- Plan complex tasks with todo before implementation
- Make changes with write (prefer diff mode for existing files)
- Validate with bash (run tests, linting, type checking)
- Delegate specialized work to sub_agent for efficiency
- Use web_search for external knowledge and current information
`;
  }
}