## When implementing anything:
- Understand how the codebase works, existing patterns, tech stack, and team style before writing code
- Restate the problem, nail down what's needed, catch anything unclear. Ask clarifying questions about requirements before coding if anything is unclear
- Split into smallest pieces, find what other code this affects, think about edge cases
- Think through multiple perspectives including architecture, security, data flow, performance, and maintainability. Analyze the broader system context and existing patterns, identify all components that could be affected, and anticipate edge cases and potential failures
- Show 2-3 options with pros/cons, pick one that fits the existing code, state your assumptions
- Test first (if tests exist): Write failing tests that show what success looks like, then build to make them pass
- Follow existing patterns, start simple, make code easy to understand. Implement with appropriate error handling, testing, and documentation
- Check it works: Does it solve the real problem? How does it fit with existing code? What could break? Consider both immediate functionality and long-term implications including backwards compatibility, scalability, and technical debt


## When writing tests:
- Focus only on implemented functionality and real user scenarios
- Test core capabilities, parameter validation, security features, and actual use cases
- Avoid testing unimplemented features, internal implementation details or theoretical edge cases
- Write fewer, focused tests that verify what the code actually does
- ALWAYS run tests using shell command


## Project Overview

The Coding Agent is an advanced AI programming assistant designed for natural language code interactions, primarily via a CLI interface with optional web backend support. The architecture is modular, supporting multiple LLM providers and a comprehensive tool ecosystem for code, file, and system operations.

### Key Features
- **CLI Mode (Primary):**
  - Interactive terminal UI (Ink, Commander.js)
  - Multi-line input, real-time features, context management
  - Command routing and tool execution context
- **Web Backend (Optional):**
  - Express.js API server with REST and WebSocket support
  - Real-time streaming, project management, and chat endpoints
- **Agent Core:**
  - LLM service initialization and provider abstraction (Anthropic, Gemini, OpenAI)
  - Tool registry, project discovery, and context management
  - Conversation and tool orchestration with streaming and error recovery
- **Tool Ecosystem:**
  - File tools: read, write, ls
  - Search tools: glob, ripgrep
  - System tools: bash, web search
  - Code analysis: AST grep, todo management
  - Tool infrastructure: validation, retry, type definitions
- **Sub-Agent System:**
  - Specialized agents for code, test, debug, docs, search, validation, and general tasks
  - Cost optimization, parallel processing, and event-based messaging
- **Approval System:**
  - Context-aware approval for destructive operations
  - Interactive Ink-based UI and session management
- **Utilities:**
  - Project discovery, system prompt builder, output formatting, code analysis, and advanced utilities
- **Prompt Caching:**
  - Advanced prompt caching for Anthropic, cost reduction, and analytics

### Usage

```bash
# Interactive chat
coding-agent

# Direct commands
coding-agent "help me understand this file"
```

For detailed architecture, see `CLAUDE.md`.
