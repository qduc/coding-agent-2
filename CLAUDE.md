# Interactive CLI Mode Architecture

## System Overview

The Interactive CLI Mode provides a conversational interface for AI-powered programming assistance through a terminal interface. The architecture follows a modular design with clear separation of concerns.

## Core Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Interactive CLI Mode                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   CLI Entry     │    │   Input/Output  │    │   Session   │ │
│  │   Point         │    │   Handlers      │    │   Manager   │ │
│  │                 │    │                 │    │             │ │
│  │ • main()        │    │ • CLIInput      │    │ • Session   │ │
│  │ • Commander.js  │    │ • CLIOutput     │    │   Persistence │ │
│  │ • Args parsing  │    │ • Markdown      │    │ • History   │ │
│  │ • Config setup  │    │ • Streaming     │    │ • State     │ │
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
│  │  │ • Message Proc  │    │ • Conversation│    │   Stack │ │  │
│  │  │ • Tool Registry │    │ • LLM Bridge  │    │ • Structure │ │
│  │  │ • Error Handle  │    │ • Result      │    │ • Context │ │
│  │  └─────────────────┘    │   Formatting  │    └─────────┘ │  │
│  │           │              └───────────────┘              │  │
│  └───────────┼──────────────────────────────────────────────┘  │
│              │                                                 │
│  ┌───────────┼─────────────────────────────────────────────┐   │
│  │           │            Tool Ecosystem                   │   │
│  │           │                                             │   │
│  │  ┌────────▼────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │ LLM Service │  │ File    │  │ Search  │  │ System  │ │   │
│  │  │             │  │ Tools   │  │ Tools   │  │ Tools   │ │   │
│  │  │ • Anthropic │  │         │  │         │  │         │ │   │
│  │  │ • OpenAI    │  │ • Read  │  │ • Glob  │  │ • Bash  │ │   │
│  │  │ • Gemini    │  │ • Write │  │ • Ripgrep│  │ • LS    │ │   │
│  │  │ • Streaming │  │ • Edit  │  │ • Search │  │ • Exec  │ │   │
│  │  └─────────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. CLI Entry Point (`src/cli/index.ts`)
- **Purpose**: Main application entry using Commander.js
- **Responsibilities**:
  - Command-line argument parsing
  - Configuration validation
  - Mode selection (direct vs interactive)
  - Error handling and graceful exit
  - Setup wizard coordination

### 2. Input/Output Handlers
- **CLIInputHandler** (`src/cli/implementations/CLIInputHandler.ts`):
  - Readline interface management
  - Interactive prompt handling
  - Command parsing and validation
  - Interrupt signal handling
  
- **CLIOutputHandler** (`src/cli/implementations/CLIOutputHandler.ts`):
  - Styled terminal output using Chalk
  - Markdown rendering support
  - Streaming output coordination
  - Error message formatting

### 3. Session Management (`src/cli/implementations/CLISessionManager.ts`)
- **Features**:
  - Conversation persistence to JSON files
  - Session state management
  - History loading/saving
  - UUID-based session identification

### 4. Agent Core (`src/shared/core/agent.ts`)
- **Primary Coordinator**:
  - LLM service initialization
  - Tool registry management
  - Project discovery integration
  - Message processing delegation

### 5. Tool Orchestrator (`src/shared/core/orchestrator.ts`)
- **Advanced Features**:
  - Multi-provider LLM support (Anthropic, OpenAI, Gemini)
  - Function calling with tool schema adaptation
  - Conversation loop management
  - Streaming response handling
  - Tool execution context management

### 6. Tool Ecosystem
- **File Operations**: Read, Write, LS
- **Search Capabilities**: Glob patterns, Ripgrep
- **System Integration**: Bash execution
- **Schema Adaptation**: Provider-specific tool schema conversion

## Data Flow

### Interactive Mode Flow:
1. **Initialization**: CLI entry → Config validation → Agent setup → Tool registration
2. **User Input**: Readline prompt → Input validation → Message preparation
3. **Processing**: Agent → Orchestrator → LLM Provider → Tool execution (if needed)
4. **Output**: Response formatting → Markdown rendering → Terminal display
5. **Loop**: Return to step 2 until exit command

### Direct Command Flow:
1. **Parse**: Command argument extraction
2. **Execute**: Single message processing through same Agent/Orchestrator pipeline
3. **Output**: Formatted response display
4. **Exit**: Process termination

## Key Features

### Streaming Support
- Real-time response display during LLM processing
- Terminal cursor management for clean output
- Provider-specific streaming optimization

### Multi-Provider LLM Support
- Unified interface across Anthropic, OpenAI, and Gemini
- Schema adaptation for tool calling compatibility
- Provider-specific optimizations (e.g., non-streaming for Anthropic tools)

### Project Context Awareness
- Automatic project discovery and tech stack detection
- Context injection into system prompts
- Working directory awareness

### Tool Execution
- JSON schema-based tool definitions
- Secure execution context management
- Result formatting for LLM consumption
- Error handling and recovery

## Configuration

The system uses a centralized configuration manager that handles:
- API key management
- Provider selection
- Streaming preferences
- Tool logging settings
- Session persistence options

## Error Handling

Comprehensive error handling at multiple levels:
- CLI argument validation
- Configuration validation
- LLM service connectivity
- Tool execution failures
- Session persistence errors
- Graceful shutdown on interrupts

This architecture provides a robust, extensible foundation for AI-powered programming assistance through an interactive command-line interface.