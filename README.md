# Coding Agent - AI Programming Assistant

**Goal**: A CLI tool that acts as a coding agent - an AI assistant for programming tasks through natural language conversations in the terminal.

## Status: Advanced Features Implemented ✅

### MVP Goals (COMPLETED) ✅
- ✅ Basic `coding-agent "help me understand this file"` command
- ✅ Simple chat mode with context awareness  
- ✅ File reading and comprehensive code analysis capabilities

### Recent Improvements ✅
- ✅ **Write Tool** - Safe file creation/modification with backup support
- ✅ **Ripgrep Integration** - Fast text search with context and filtering
- ✅ **Streaming Responses** - Real-time AI interaction with token tracking
- ✅ **LLM Provider Interface** - Modular AI backend support
- ✅ **Enhanced Tool Orchestration** - Improved function calling and error handling
- ✅ **Comprehensive Testing** - Unit tests for all major components

## Core Usage

```bash
# Interactive chat mode
coding-agent

# Direct commands
coding-agent "help me understand this file"
coding-agent "explain how this function works"
```

## Architecture

```
coding-agent/
├── src/
│   ├── cli/
│   │   └── index.ts          # Main CLI entry point with streaming support
│   ├── core/
│   │   ├── agent.ts          # Core AI agent logic with tool orchestration
│   │   ├── config.ts         # Configuration management
│   │   └── orchestrator.ts   # Advanced tool orchestration logic
│   ├── tools/
│   │   ├── base.ts           # Base tool interface
│   │   ├── glob.ts           # Pattern matching for file discovery
│   │   ├── index.ts          # Tool exports and registry
│   │   ├── ls.ts             # Directory listing with metadata
│   │   ├── read.ts           # File reading with encoding support
│   │   ├── ripgrep.ts        # Fast text search with context
│   │   ├── retry.ts          # Retry logic for tools
│   │   ├── types.ts          # Tool type definitions
│   │   ├── validation.ts     # Security and input validation
│   │   ├── write.ts          # File writing with safety features
│   │   └── *.test.ts         # Comprehensive tool unit tests
│   ├── services/
│   │   ├── llm.ts            # LLM provider interface with streaming
│   │   └── llm.test.ts       # LLM service unit tests
│   └── utils/
│       ├── toolLogger.ts     # Tool execution logging
│       ├── markdown.ts       # Markdown processing utilities
│       └── projectDiscovery.ts # Project structure analysis
├── tests/                    # Integration test directory
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── jest.config.js            # Jest testing configuration
```

## Essential Dependencies

```json
{
  "commander": "^12.0.0",     // CLI framework
  "inquirer": "^9.2.0",      // Interactive chat
  "chalk": "^5.3.0",         // Terminal styling
  "openai": "^4.28.0",       // LLM integration
  "fs-extra": "^11.2.0",     // File operations
  "globby": "^14.0.0"        // Pattern matching
}
```

## Core Features 

### File Operations ✅
- **Read** - File content reading with encoding support and line range selection
- **Write** - File creation and modification with safety features, backup creation, and security validation
- **LS** - Directory listing with detailed metadata and filtering
- **Glob** - Advanced pattern matching for file discovery

### Search & Analysis ✅
- **Ripgrep** - Fast text search with context, filtering, regex patterns, and performance metrics

### LLM Integration ✅
- **Streaming Responses** - Real-time AI responses with token usage tracking
- **Tool Integration** - Comprehensive function calling with proper tool orchestration
- **LLM Provider Interface** - Modular design supporting different AI models

### Conversation System ✅
- Interactive chat interface with context awareness
- Natural language file analysis and code understanding
- Tool-assisted programming workflows
- **Graceful degradation**: Fallback strategies for unclear requests or tool failures

**Example Interaction Flows**:
```
User: "The tests are failing in my React app"
Agent: "I'll help you debug the test failures. Let me search for test files and errors..."
[Uses ripgrep to find test files and error patterns]
Agent: "I found 3 failing tests in components/__tests__/. The main issue appears to be..."
User: "Can you fix the first one?"
Agent: "I'll update the test file to fix the assertion error..."
[Uses write tool with backup to safely modify the test file]
Agent: "✅ Fixed test assertion in Button.test.tsx (backup created)"

User: "Find all TODO comments in the codebase"
Agent: [Uses ripgrep with pattern "TODO|FIXME"] 
"Found 12 TODO comments across 8 files. Here's a summary by priority..."

User: "Create a new utility function for date formatting"
Agent: [Uses write tool to create new file]
"✅ Created src/utils/dateFormatter.ts with comprehensive date formatting functions"
```
