## Important Instructions (MUST FOLLOW!)
- When use the read tool, always read the whole file if it is less than 1000 lines
- Never end your response with "if you want", "would you like"...
- Never end the response asking if the user wants to do something, just do it

Failing to follow these instructions will result in a very bad user experience and low rating, you may get terminated if repeated violations occur.

## When implementing anything:
- Understand how the codebase works, existing patterns, tech stack, and team style before writing code
- Restate the problem, nail down what's needed, catch anything unclear. Ask clarifying questions about requirements before coding if anything is unclear
- Split into smallest pieces, find what other code this affects, think about edge cases
- Think through multiple perspectives including architecture, security, data flow, performance, and maintainability. Analyze the broader system context and existing patterns, identify all components that could be affected, and anticipate edge cases and potential failures
- Show 2-3 options with pros/cons, pick one that fits the existing code
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

### Architecture
- **Modular Design**: Clear separation between CLI (`src/cli/`), Web (`src/web/`), and Shared (`src/shared/`) components
- **Provider Strategy Pattern**: LLM providers (Anthropic, Gemini, OpenAI) use unified interface with schema adaptation
- **Handler System**: Specialized handlers for conversation, tool execution, and provider strategies
- **Event-Driven Approval**: Centralized EventBus for tool-UI communication and approval requests
- **Tool Context Management**: Read history tracking and operation validation for safer file modifications

### Key Features
- **CLI Mode (Primary):**
  - Interactive terminal UI (Ink, Commander.js) with approval system integration
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
  - File tools: read (with hashing), write (dual-mode with regex), ls
  - Search tools: glob, ripgrep
  - System tools: bash (with approval), web search
  - Code analysis: AST grep, todo management (with auto-parsing)
  - Tool infrastructure: validation, retry, type definitions
- **Sub-Agent System:**
  - Specialized agents for code, test, debug, docs, search, validation, and general tasks
  - Cost optimization (80% reduction), parallel processing, and event-based messaging
  - Tool filtering and factory pattern for optimal configurations
- **Approval System:**
  - Event-driven approval with ApprovalEventBridge for decoupled communication
  - Context-aware approval for destructive operations with session management
  - Interactive Ink-based UI with "always allow for session" preferences
- **Utilities:**
  - Project discovery, system prompt builder, output formatting, code analysis, and advanced utilities
- **Prompt Caching:**
  - Advanced prompt caching for Anthropic, cost reduction, and analytics

### Key Implementation Patterns
- **Tool System**: All tools extend `BaseTool` (`src/shared/tools/base.ts`) with standardized schema
- **Schema Adapter**: Cross-provider tool schema transformation (`src/shared/services/schemaAdapter.ts`)
- **File Operations**: Read before write validation, regex search-replace, binary detection with magic bytes
- **Configuration**: Centralized config (`src/shared/core/config.ts`) with API key management
- **Error Handling**: Provider fallbacks, retry logic, input validation, graceful degradation

### Key File Locations
- **Agent Core**: `src/shared/core/agent.ts` - Primary coordinator
- **Tool Orchestrator**: `src/shared/core/orchestrator.ts` - Multi-provider tool execution
- **Provider Factory**: `src/shared/services/llm.ts` - LLM provider instantiation
- **Tool Registry**: `src/shared/tools/index.ts` - Tool exports and registration
- **CLI Entry**: `src/cli/index.ts` - Command-line interface entry point
- **Approval System**: `src/cli/approval/ApprovalEventBridge.tsx` - Event-driven approval

### Usage

```bash
# Interactive chat
coding-agent

# Direct commands
coding-agent "help me understand this file"
```

### Integration Guidelines for AI Agents
- **Follow Existing Patterns**: Use established handler system and tool patterns
- **Schema Compliance**: All tools must follow BaseTool schema definitions  
- **Approval Integration**: Destructive operations must use event bus approval system
- **Context Awareness**: Tools should validate read history before file modifications
- **Error Recovery**: Implement comprehensive error handling with fallback strategies
- **Testing**: Write focused tests for actual functionality, avoid theoretical edge cases

For detailed architecture documentation, see `CLAUDE.md`.
