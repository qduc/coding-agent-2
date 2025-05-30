# Coding Agent - AI Programming Assistant

**Goal**: A CLI tool that acts as a coding agent - an AI assistant for programming tasks through natural language conversations in the terminal.

## Quick Start Goals (MVP) ✅ COMPLETED
- ✅ Basic `coding-agent "help me understand this file"` command
- ✅ Simple chat mode with context awareness
- ✅ File reading and comprehensive code analysis capabilities

## Core Usage

```bash
# Interactive chat mode
coding-agent

# Direct commands
coding-agent "help me understand this file"
coding-agent "explain how this function works"
```

## MVP Architecture

```
coding-agent/
├── src/
│   ├── cli/
│   │   └── index.ts          # Main CLI entry point
│   ├── core/
│   │   ├── agent.ts          # Core AI agent logic
│   │   ├── config.ts         # Configuration management
│   │   └── orchestrator.ts   # Tool orchestration logic
│   ├── tools/
│   │   ├── base.ts           # Base tool interface
│   │   ├── glob.ts           # Pattern matching
│   │   ├── index.ts          # Tool exports
│   │   ├── ls.ts             # Directory listing
│   │   ├── read.ts           # File reading (MVP core tool)
│   │   ├── retry.ts          # Retry logic for tools
│   │   ├── types.ts          # Tool type definitions
│   │   ├── validation.ts     # Input validation
│   │   ├── write.ts          # File writing operations
│   │   └── *.test.ts         # Tool unit tests
│   ├── services/
│   │   └── llm.ts            # OpenAI integration
│   └── utils/
│       └── toolLogger.ts     # Tool execution logging
├── tests/                    # Test directory
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

## Core Features (MVP)

### Read-Only Tools (All Implemented ✅)
- **Read** - File content reading with encoding support and line range selection
- **LS** - Directory listing with detailed metadata and filtering
- **Glob** - Advanced pattern matching for file discovery

### Basic Conversation
- Simple chat interface with inquirer
- Context gathering from project files
- Natural language file analysis
- **Graceful degradation**: Fallback strategies for unclear requests or tool failures

**Example Interaction Flows**:
```
User: "The tests are failing in my React app"
Agent: "I'll help you debug the test failures. Let me check your test files and recent changes..."
Agent: "I found 3 failing tests in components/__tests__/. The main issue appears to be..."
User: "Can you fix the first one?"
Agent: "I'll update the test file to fix the assertion error. Here's what I'll change..."
```
