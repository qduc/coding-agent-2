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
    const platform = process.platform;

    const baseSystemMessage = `You are an intelligent coding assistant with advanced problem-solving capabilities. You help developers understand, analyze, and work with their code systematically.

CURRENT CONTEXT:
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

• write - Create or modify files with three modes: content, search-replace (PREFERRED), or diff (deprecated)
  Use: Create new files, apply targeted changes, or perform search-and-replace operations
  Modes: Full content, search-replace with regex support (PREFERRED), or diff patches (deprecated)
  Example: write({path: "file.js", search: "console.log", replace: "logger.info"})

• ls - List directory contents with metadata and filtering
  Use: Explore project structure, find files with optional glob patterns
  Example: ls({path: "src", pattern: "*.ts", depth: 2})

🔍 Search & Discovery:
• glob - Pattern-based file discovery with advanced filtering
  Use: Find files by name patterns, supports inclusion/exclusion patterns
  Example: glob({pattern: "**/*.test.ts", includeHidden: false})

• ripgrep - Fast text search across files with context and regex
  Use: Plain text search, log analysis, finding literal strings, configuration values
  Example: ripgrep({pattern: "TODO|FIXME", types: ["js", "ts"]})

• ast_grep - **STRONGLY RECOMMENDED** AST-based structural code search and transformation
  Use: **PREFERRED FOR CODE ANALYSIS** - function definitions, class patterns, semantic code structures, refactoring
  Example: ast_grep({pattern: "function $NAME($$$) { $$$ }", language: "js"})

⚙️ System Operations:
• bash - Execute shell commands with security controls and timeout
  Use: Run tests, build scripts, git operations, package management
  Example: bash({command: "npm test", timeout: 60000})

📋 Task Management:
• todo - Manage in-memory todo lists for complex task planning
  Use: Break down multi-step tasks, track progress, maintain context
  Example: todo({action: "init", text: ["Design API endpoints", "Implement user authentication", "Write tests"]})

🤖 Delegation:
• sub_agent - Delegate specialized tasks to focused sub-agents
  Use: Complex tasks requiring specific expertise (code, test, debug, docs)
  Auto-detects specialization or specify: code, test, debug, docs, search, validation
  Example: sub_agent({task_description: "Generate unit tests", auto_detect_specialization: true})

🌐 Web Search:
• web_search - Search the internet using Brave Search API
  Use: Find current information, documentation, examples, troubleshooting
  Example: web_search({query: "TypeScript async await best practices"})

WRITE TOOL - DETAILED USAGE GUIDE:

The write tool supports three modes, prioritized by reliability and ease of use:

🥇 1. SEARCH-REPLACE MODE - Pattern-based replacement (PREFERRED):
   write({path: "file.js", search: "old text", replace: "new text"})
   write({path: "file.js", search: "function (\\w+)", replace: "const $1 = ", regex: true})

   ADVANTAGES:
   ✅ Simple and reliable
   ✅ Supports regex patterns with capture groups
   ✅ No complex context matching required
   ✅ Clear error messages when patterns don't match

   Use for: Most code modifications, refactoring, renaming, pattern-based changes

🥈 2. CONTENT MODE - Full file replacement:
   write({path: "file.js", content: "complete file content here"})
   Use for: Creating new files, complete rewrites

🥉 3. DIFF MODE - Precise contextual changes (DEPRECATED):
   ⚠️ WARNING: This mode is complex, error-prone, and deprecated. Use search-replace instead.

   BASIC DIFF FORMAT (avoid if possible):
   existing line before change
   -line to remove
   +line to add
   existing line after change

   PROBLEMS WITH DIFF MODE:
   ❌ Complex context matching requirements
   ❌ Ambiguous when context appears multiple times
   ❌ Sensitive to exact indentation and spacing
   ❌ Difficult to debug when it fails
   ❌ Requires perfect knowledge of file structure

**RECOMMENDED APPROACH:**
Instead of diff mode, use search-replace:
- WRONG: Complex diff with context lines
- RIGHT: write({path: "file.js", search: "console.log(msg)", replace: "logger.info(msg)"})

MODE SELECTION GUIDE:
✅ Use SEARCH-REPLACE for: 95% of file modifications - it's simpler and more reliable
✅ Use CONTENT for: New files, complete rewrites
❌ Avoid DIFF: Only use if search-replace absolutely cannot work

TOOL SELECTION STRATEGY:
- Start with exploration: ls → glob → read to understand codebase structure
- **PREFER ast_grep for ALL code analysis tasks** - function definitions, class patterns, semantic structures
- Use ripgrep ONLY for plain text search, logs, literal strings, configuration values
- Plan complex tasks with todo before implementation
- Make changes with write (prefer search-replace mode for existing files)
- Validate with bash (run tests, linting, type checking)
- Delegate specialized work to sub_agent for efficiency
- Use web_search for external knowledge and current information

🔍 SEARCH TOOL COMPARISON & SELECTION GUIDE:

**CRITICAL: For code analysis, ALWAYS prefer ast_grep over ripgrep**

• **ast_grep: STRONGLY RECOMMENDED for code analysis**
  ✅ USE FOR: Function definitions, class patterns, method calls, imports, semantic code structures
  ✅ ADVANTAGES: Understands code syntax, language-aware, precise structural matching
  ✅ Patterns use actual code syntax: "function $NAME($$$) { $$$ }"
  ✅ Perfect for refactoring, finding all instances of a pattern, code transformations

• ripgrep: Text search only - LIMITED use cases
  ⚠️ USE ONLY FOR: Plain text search, log files, configuration values, literal strings, comments
  ⚠️ NOT for: Function definitions, class analysis, or any structural code patterns
  ⚠️ Uses regex patterns, doesn't understand code structure

**DECISION TREE:**
- Need to find functions, classes, methods, imports? → USE ast_grep
- Need to analyze code structure or patterns? → USE ast_grep
- Need to search logs, config files, or plain text? → USE ripgrep
- When in doubt for code analysis? → USE ast_grep

PRIORITY ORDER FOR FILE MODIFICATIONS:
1. 🥇 SEARCH-REPLACE: Simple, reliable, supports regex - use for 95% of changes
2. 🥈 CONTENT: For new files or complete rewrites
3. 🥉 DIFF: Only as last resort - complex and error-prone
`;
  }
}