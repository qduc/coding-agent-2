# Coding Agent Architecture

## System Overview

The Coding Agent is a dual-interface AI programming assistant that provides both CLI and web-based conversational interfaces. The architecture follows a modular design with clear separation of concerns, supporting multiple LLM providers and comprehensive tool integration.

## Core Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Coding Agent System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   CLI Mode      │    │   Web Mode      │    │   Shared    │ │
│  │                 │    │                 │    │   Core      │ │
│  │ • CLI Entry     │    │ • Express API   │    │             │ │
│  │ • Commander.js  │    │ • WebSocket     │    │ • Agent     │ │
│  │ • Input/Output  │    │ • REST Routes   │    │ • Config    │ │
│  │ • Interactive   │    │ • React UI      │    │ • Session   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│           │                       │                      │     │
│           │                       │                      │     │
│           └───────────────────────┼──────────────────────┘     │
│                                   │                            │
│  ┌─────────────────────────────────┼────────────────────────┐  │
│  │              Agent Core         │                        │  │
│  │                                 │                        │  │
│  │  ┌─────────────────┐    ┌──────┴────────┐    ┌─────────┐ │  │
│  │  │     Agent       │    │ Tool          │    │ Project │ │  │
│  │  │   Controller    │    │ Orchestrator  │    │Discovery│ │  │
│  │  │                 │    │               │    │         │ │  │
│  │  │ • Initialize    │    │ • Tool Exec   │    │ • Tech  │ │  │
│  │  │ • LLM Service   │    │ • Conversation│    │   Stack │ │  │
│  │  │ • Tool Registry │    │ • Multi-LLM   │    │ • Structure │ │
│  │  │ • Context Mgmt  │    │ • Streaming   │    │ • Context │ │
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
│  │  │ • OpenAI    │  │ • Read  │  │ • Glob  │  │ • Bash  │ │   │
│  │  │ • Gemini    │  │ • Write │  │ • Ripgrep│  │ • LS    │ │   │
│  │  │ • Provider  │  │ • Edit  │  │ • Search │  │ • Exec  │ │   │
│  │  │   Factory   │  │ (Diff)  │  │ Patterns │  │         │ │   │
│  │  └─────────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Interface Layer

#### CLI Mode (`src/cli/`)
- **Entry Point** (`src/cli/index.ts`): Commander.js-based command-line interface
- **Input Handler** (`src/cli/implementations/CLIInputHandler.ts`): Readline-based interactive input
- **Output Handler** (`src/cli/implementations/CLIOutputHandler.ts`): Chalk-styled terminal output
- **Session Manager** (`src/cli/implementations/CLISessionManager.ts`): JSON-based conversation persistence

#### Web Mode (`src/web/`)
- **Server** (`src/web/server.ts`): Express.js server with Socket.IO integration
- **Routes** (`src/web/routes/`): RESTful API endpoints for chat, config, tools, and project management
- **WebSocket** (`src/web/sockets/`): Real-time communication for streaming responses
- **Middleware** (`src/web/middleware/`): Authentication, CORS, rate limiting, and error handling
- **Frontend** (`frontend/`): React-based web interface with TypeScript

### 2. Shared Core (`src/shared/`)

#### Agent Controller (`src/shared/core/agent.ts`)
- **Primary Coordinator**: Manages LLM service initialization and tool orchestration
- **Tool Registry**: Dynamic tool registration and discovery
- **Project Discovery**: Automatic tech stack detection and context injection
- **Context Management**: Session and project-aware state handling

#### Tool Orchestrator (`src/shared/core/orchestrator.ts`)
- **Multi-Provider Support**: Unified interface for Anthropic, OpenAI, and Gemini
- **Function Calling**: Provider-specific schema adaptation via SchemaAdapter
- **Conversation Management**: Tool call loops with streaming support
- **Provider Optimization**: Non-streaming for Anthropic tools, streaming for others

#### Configuration Management (`src/shared/core/config.ts`)
- **API Key Management**: Secure credential storage and validation
- **Provider Selection**: Dynamic LLM provider configuration
- **Tool Settings**: Logging, timeout, and execution preferences

### 3. LLM Services (`src/shared/services/`)

#### LLM Service (`src/shared/services/llm.ts`)
- **Provider Factory**: Dynamic instantiation of LLM providers
- **Unified Interface**: Consistent API across different providers
- **Streaming Support**: Real-time response handling
- **Tool Integration**: Function calling schema management

#### Provider Implementations
- **Anthropic Provider** (`src/shared/providers/AnthropicProvider.ts`): Claude integration with native tool calling
- **OpenAI Provider** (`src/shared/providers/OpenAIProvider.ts`): GPT models with function calling
- **Gemini Provider** (`src/shared/providers/GeminiProvider.ts`): Google's Gemini with function declarations

#### Schema Adapter (`src/shared/services/schemaAdapter.ts`)
- **Cross-Provider Compatibility**: Tool schema transformation
- **Format Normalization**: Unified tool definition format
- **Provider-Specific Conversion**: OpenAI functions, Anthropic tools, Gemini declarations

### 4. Tool Ecosystem (`src/shared/tools/`)

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

### 5. Utilities (`src/shared/utils/`)

#### Project Discovery (`projectDiscovery.ts`)
- **Tech Stack Detection**: Framework and language identification
- **Project Structure Analysis**: Entry point and dependency detection
- **Context Generation**: Intelligent system prompt enhancement

#### Output Formatting
- **Box Renderer** (`boxRenderer.ts`): Terminal UI components and formatting
- **Terminal Output** (`terminalOutput.ts`): Streaming and styled text handling
- **Markdown Support** (`markdown.ts`): Rich text rendering for responses

#### Code Analysis
- **Tree-sitter Parser** (`treeSitterParser.ts`): AST-based code understanding
- **Code Analyzer** (`codeAnalyzer.ts`): Structure and pattern analysis

## Data Flow

### CLI Mode Flow
1. **Initialization**: CLI entry → Config validation → Agent setup → Tool registration
2. **User Input**: Readline prompt → Input validation → Message preparation
3. **Processing**: Agent → Orchestrator → LLM Provider → Tool execution loop
4. **Output**: Response formatting → Markdown rendering → Terminal display
5. **Loop**: Return to step 2 until exit command

### Web Mode Flow
1. **Server Startup**: Express server → WebSocket setup → Route registration
2. **Client Connection**: React frontend → WebSocket handshake → Session establishment
3. **Message Processing**: HTTP/WebSocket → API routes → Agent processing
4. **Real-time Updates**: Tool execution → WebSocket streaming → UI updates
5. **State Management**: Session persistence → Context maintenance

### Tool Execution Flow
1. **Tool Call Detection**: LLM response analysis → Function call identification
2. **Schema Validation**: Parameter validation → Tool selection
3. **Execution**: Tool.execute() → Context-aware processing → Result generation
4. **Result Formatting**: Success/error handling → LLM-compatible output
5. **Conversation Continuation**: Result injection → Next LLM iteration

## Key Features

### Multi-Provider LLM Support
- **Provider Factory**: Dynamic instantiation based on configuration
- **Schema Adaptation**: Automatic tool schema conversion per provider
- **Streaming Optimization**: Provider-specific streaming strategies
- **Fallback Handling**: Graceful degradation on provider errors

### Enhanced Tool Capabilities
- **Diff-Based Writing**: Intelligent file editing with change tracking
- **Context-Aware Search**: Project-specific search patterns and filters
- **Secure Execution**: Sandboxed command execution with timeout controls
- **Auto-Discovery**: Dynamic tool availability detection

### Project Intelligence
- **Tech Stack Recognition**: Automatic framework and language detection
- **Context Injection**: Intelligent system prompt enhancement
- **Working Directory Awareness**: Relative path resolution and navigation

### Real-Time Communication
- **WebSocket Streaming**: Live response updates in web interface
- **Progress Indicators**: Tool execution status and completion feedback
- **Error Recovery**: Graceful handling of connection and execution failures

## Configuration

### Environment Variables
- **API Keys**: Provider-specific authentication credentials
- **Server Settings**: Port, CORS origins, rate limiting
- **Tool Configuration**: Timeouts, file size limits, security settings

### Runtime Configuration
- **Provider Selection**: Dynamic LLM provider switching
- **Tool Preferences**: Logging levels, execution preferences
- **Session Management**: Persistence settings, history retention

## Security & Error Handling

### Security Measures
- **Input Validation**: Schema-based parameter validation
- **Command Sanitization**: Safe bash execution with input filtering
- **File Access Control**: Working directory constraints
- **Rate Limiting**: API endpoint protection

### Error Recovery
- **Provider Fallbacks**: Automatic switching on service failures
- **Tool Retry Logic**: Intelligent retry with exponential backoff
- **Graceful Degradation**: Partial functionality on component failures
- **Comprehensive Logging**: Detailed error tracking and debugging

This architecture provides a robust, scalable foundation for AI-powered programming assistance across multiple interfaces and deployment scenarios.