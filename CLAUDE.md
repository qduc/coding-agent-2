# Coding Agent Architecture

## Important Reminder for Claude
**⚠️ CRITICAL: Always keep this CLAUDE.md file updated with the latest project progress, implementation status, and architectural changes. This file serves as the primary reference for project state and must reflect current reality.**

## System Overview

The Coding Agent is an AI programming assistant that provides an advanced CLI interface with optional web backend support. The architecture follows a modular design with clear separation of concerns, supporting multiple LLM providers and comprehensive tool integration.

## Core Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Coding Agent System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   CLI Mode      │    │   Web Backend   │    │   Shared    │ │
│  │   (Primary)     │    │   (Optional)    │    │   Core      │ │
│  │                 │    │                 │    │             │ │
│  │ • Ink Terminal  │    │ • Express API   │    │ • Agent     │ │
│  │ • Commander.js  │    │ • WebSocket     │    │ • Config    │ │
│  │ • Interactive   │    │ • REST Routes   │    │ • Session   │ │
│  │ • Context Mgmt  │    │ • Middleware    │    │ • Handlers  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│           │                       │                      │     │
│           │                       │                      │     │
│           └───────────────────────┼──────────────────────┘     │
│                                   │                            │
│  ┌─────────────────────────────────┼────────────────────────┐  │
│  │              Agent Core         │                        │  │
│  │                                 │                        │  │
│  │  ┌─────────────────┐    ┌──────┴────────┐    ┌─────────┐ │  │
│  │  │     Agent       │    │ Handler       │    │ Project │ │  │
│  │  │   Controller    │    │ System        │    │Discovery│ │  │
│  │  │                 │    │               │    │         │ │  │
│  │  │ • Initialize    │    │ • Conversation│    │ • Tech  │ │  │
│  │  │ • LLM Service   │    │ • Tool Exec   │    │   Stack │ │  │
│  │  │ • Tool Registry │    │ • Provider    │    │ • Structure │ │
│  │  │ • Context Mgmt  │    │ • Loop Mgmt   │    │ • Context │ │
│  │  └─────────────────┘    └───────────────┘    └─────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Tool Ecosystem                           │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │ LLM Service │  │ File    │  │ Search  │  │ System  │ │   │
│  │  │             │  │ Tools   │  │ Tools   │  │ Tools   │ │   │
│  │  │ • Anthropic │  │         │  │         │  │         │ │   │
│  │  │ • Gemini    │  │ • Read  │  │ • Glob  │  │ • Bash  │ │   │
│  │  │ • OpenAI*   │  │ • Write │  │ • Ripgrep│  │ • LS    │ │   │
│  │  │ • Provider  │  │ (Diff)  │  │ • Search │  │         │ │   │
│  │  │   Factory   │  │         │  │ Patterns │  │         │ │   │
│  │  └─────────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

*OpenAI provider partially implemented

## Component Details

### 1. Interface Layer

#### CLI Mode (`src/cli/`) - Primary Interface
- **Entry Point** (`src/cli/index.ts`): Commander.js-based command-line interface
- **Ink Input Handler** (`src/cli/implementations/InkInputHandler.tsx`): React-based terminal UI with:
  - Multi-line input support
  - File completion with fuzzy search
  - Command completion
  - Clipboard paste support
  - Real-time interactive features
- **Tool Execution Context** (`src/cli/implementations/CLIToolExecutionContext.ts`): CLI-specific tool context management
- **Commands** (`src/cli/commands.ts`): Command definitions and routing

#### Web Backend (`src/web/`) - Optional API Server
- **Server** (`src/web/server.ts`): Express.js server with Socket.IO integration
- **Routes** (`src/web/routes/`): RESTful API endpoints for chat, config, tools, and project management
- **WebSocket** (`src/web/sockets/`): Real-time communication for streaming responses
- **Middleware** (`src/web/middleware/`): Authentication, CORS, rate limiting, and error handling
- **Web Implementations** (`src/web/implementations/`): Web-specific context and handlers

**Note**: Frontend web interface is not implemented - only backend API is available.

### 2. Shared Core (`src/shared/`)

#### Agent Controller (`src/shared/core/agent.ts`)
- **Primary Coordinator**: Manages LLM service initialization and tool orchestration
- **Tool Registry**: Dynamic tool registration and discovery
- **Project Discovery**: Automatic tech stack detection and context injection
- **Context Management**: Session and project-aware state handling

#### Tool Orchestrator (`src/shared/core/orchestrator.ts`)
- **Multi-Provider Support**: Unified interface for Anthropic and Gemini
- **Function Calling**: Provider-specific schema adaptation via SchemaAdapter
- **Conversation Management**: Tool call loops with streaming support
- **Handler Coordination**: Delegates to specialized handler classes

#### Configuration Management (`src/shared/core/config.ts`)
- **API Key Management**: Secure credential storage and validation
- **Provider Selection**: Dynamic LLM provider configuration
- **Tool Settings**: Logging, timeout, and execution preferences

### 3. Handler System (`src/shared/handlers/`)

#### Conversation Manager (`ConversationManager.ts`)
- **Message Flow**: Orchestrates conversation between user, LLM, and tools
- **Context Preservation**: Maintains conversation history and state
- **Error Recovery**: Handles conversation flow interruptions

#### Tool Execution Handler (`ToolExecutionHandler.ts`)
- **Tool Orchestration**: Manages tool call execution and result handling
- **Context Management**: Tool-specific context and parameter handling
- **Result Processing**: Formats tool results for LLM consumption

#### Provider Strategy Factory (`ProviderStrategyFactory.ts`)
- **Provider Abstraction**: Handles provider-specific implementation details
- **Strategy Pattern**: Encapsulates provider-specific logic
- **Dynamic Switching**: Supports runtime provider changes

#### Tool Loop Handler (`ToolLoopHandler.ts`)
- **Iterative Processing**: Manages multi-turn tool execution cycles
- **Loop Control**: Prevents infinite loops and manages exit conditions
- **State Tracking**: Maintains tool execution state across iterations

### 4. LLM Services (`src/shared/services/`)

#### LLM Service (`src/shared/services/llm.ts`)
- **Provider Factory**: Dynamic instantiation of LLM providers
- **Unified Interface**: Consistent API across different providers
- **Streaming Support**: Real-time response handling
- **Tool Integration**: Function calling schema management

#### Provider Implementations
- **Anthropic Provider** (`src/shared/services/anthropicProvider.ts`): Claude integration with native tool calling
- **Gemini Provider** (`src/shared/services/geminiProvider.ts`): Google's Gemini with function declarations
- **OpenAI Provider** (`src/shared/providers/OpenAIProvider.ts`): **COMPLETED** - Full GPT integration with Responses API support for reasoning models, schema adapter integration, and orchestrator compatibility

#### Schema Adapter (`src/shared/services/schemaAdapter.ts`)
- **Cross-Provider Compatibility**: Tool schema transformation
- **Format Normalization**: Unified tool definition format
- **Provider-Specific Conversion**: Anthropic tools, Gemini declarations

### 5. Tool Ecosystem (`src/shared/tools/`)

#### File Operations
- **Read Tool** (`read.ts`): File content reading with line range support
- **Write Tool** (`write.ts`): File creation and editing with diff-based interface
- **LS Tool** (`ls.ts`): Directory listing and file exploration

#### Search Tools
- **Glob Tool** (`glob.ts`): Pattern-based file discovery
- **Ripgrep Tool** (`ripgrep.ts`): Fast content search with regex support

#### System Tools
- **Bash Tool** (`bash.ts`): Command execution with security controls

#### Tool Infrastructure
- **Base Tool** (`base.ts`): Abstract base class with schema definitions
- **Tool Validation** (`validation.ts`): Input/output validation utilities
- **Retry Logic** (`retry.ts`): Failure recovery mechanisms
- **Tool Types** (`types.ts`): Comprehensive type definitions

### 6. Utilities (`src/shared/utils/`)

#### Project Discovery (`projectDiscovery.ts`)
- **Tech Stack Detection**: Framework and language identification
- **Project Structure Analysis**: Entry point and dependency detection
- **Context Generation**: Intelligent system prompt enhancement

#### System Prompt Builder (`SystemPromptBuilder.ts`)
- **Dynamic Prompt Generation**: Context-aware system prompts
- **Project Context Integration**: Automatic project information inclusion
- **Customizable Templates**: Flexible prompt construction

#### Output Formatting
- **Box Renderer** (`boxRenderer.ts`): Terminal UI components and formatting
- **Terminal Output** (`terminalOutput.ts`): Streaming and styled text handling
- **Markdown Support** (`markdown.ts`): Rich text rendering for responses

#### Code Analysis
- **Tree-sitter Parser** (`treeSitterParser.ts`): AST-based code understanding
- **Code Analyzer** (`codeAnalyzer.ts`): Structure and pattern analysis

## Data Flow

### CLI Mode Flow (Primary)
1. **Initialization**: CLI entry → Config validation → Agent setup → Tool registration
2. **User Input**: Ink terminal UI → Input validation → Message preparation
3. **Processing**: Agent → Handler system → LLM Provider → Tool execution loop
4. **Output**: Response formatting → Markdown rendering → Terminal display
5. **Loop**: Return to step 2 until exit command

### Web Backend Flow (Optional)
1. **Server Startup**: Express server → WebSocket setup → Route registration
2. **API Connection**: Client request → Route handling → Agent processing
3. **Message Processing**: HTTP/WebSocket → API routes → Agent processing
4. **Real-time Updates**: Tool execution → WebSocket streaming → Client updates
5. **State Management**: Session persistence → Context maintenance

### Tool Execution Flow
1. **Tool Call Detection**: LLM response analysis → Function call identification
2. **Handler Delegation**: Tool execution → Handler system → Context preparation
3. **Execution**: Tool.execute() → Context-aware processing → Result generation
4. **Result Processing**: Success/error handling → LLM-compatible output
5. **Conversation Continuation**: Result injection → Next LLM iteration

## Key Features

### Advanced CLI Interface
- **Ink-Based Terminal UI**: Modern React-based terminal interface
- **Interactive Features**: File completion, command history, multi-line input
- **Context-Aware**: Project discovery and intelligent prompt enhancement
- **Real-time Feedback**: Streaming responses and progress indicators

### Multi-Provider LLM Support
- **Provider Factory**: Dynamic instantiation based on configuration
- **Schema Adaptation**: Automatic tool schema conversion per provider
- **Handler Strategy**: Provider-specific optimization and handling
- **Fallback Support**: Graceful degradation on provider errors

### Enhanced Tool Capabilities
- **Diff-Based Writing**: Intelligent file editing with change tracking
- **Context-Aware Search**: Project-specific search patterns and filters
- **Secure Execution**: Sandboxed command execution with timeout controls
- **Auto-Discovery**: Dynamic tool availability detection

### Project Intelligence
- **Tech Stack Recognition**: Automatic framework and language detection
- **Context Injection**: Intelligent system prompt enhancement
- **Working Directory Awareness**: Relative path resolution and navigation
- **Code Analysis**: AST-based understanding with Tree-sitter

### Modular Handler System
- **Separation of Concerns**: Specialized handlers for different responsibilities
- **Strategy Pattern**: Provider-specific behavior encapsulation
- **Extensible Architecture**: Easy addition of new providers and capabilities

## Configuration

### Environment Variables
- **API Keys**: Provider-specific authentication credentials
- **Server Settings**: Port, CORS origins, rate limiting (for web backend)
- **Tool Configuration**: Timeouts, file size limits, security settings

### Runtime Configuration
- **Provider Selection**: Dynamic LLM provider switching
- **Tool Preferences**: Logging levels, execution preferences
- **Session Management**: Persistence settings, history retention

## Current Implementation Status

### ✅ Fully Implemented
- **CLI Interface**: Advanced Ink-based terminal UI
- **Agent Core**: Complete agent and orchestration system
- **Tool Ecosystem**: All documented tools working
- **Anthropic & Gemini Providers**: Full LLM integration
- **OpenAI Provider**: **COMPLETED** - Full integration with schema adapter, tool execution, Responses API support for reasoning models, and orchestrator integration
- **Web Backend**: Express API server with WebSocket support
- **Handler System**: Modular conversation and tool management

### 🔄 Partially Implemented
- **Web Frontend**: Backend ready, no frontend interface

### 📋 Future Considerations
- **Frontend Development**: React web interface for browser access
- **Additional Providers**: Integration with other LLM services
- **Enhanced Tool Set**: Additional development tools and capabilities

## Security & Error Handling

### Security Measures
- **Input Validation**: Schema-based parameter validation
- **Command Sanitization**: Safe bash execution with input filtering
- **File Access Control**: Working directory constraints
- **Rate Limiting**: API endpoint protection (web backend)

### Error Recovery
- **Provider Fallbacks**: Automatic switching on service failures
- **Tool Retry Logic**: Intelligent retry with exponential backoff
- **Graceful Degradation**: Partial functionality on component failures
- **Comprehensive Logging**: Detailed error tracking and debugging

This architecture provides a robust, extensible foundation for AI-powered programming assistance with a focus on an exceptional CLI experience and optional web backend integration.

---

## Recent Updates (Latest First)

### 2025-01-07: OpenAI Provider Completion
- **COMPLETED**: OpenAI provider implementation (`src/shared/providers/OpenAIProvider.ts`)
- **Added**: Schema adapter integration for proper tool schema conversion
- **Added**: Full support for OpenAI Responses API for reasoning models
- **Fixed**: Connection testing in initialization process
- **Fixed**: Tool execution integration with ToolOrchestrator pattern
- **Status**: OpenAI provider now fully functional and production-ready
- **Integration**: Works seamlessly with existing orchestrator and handler system