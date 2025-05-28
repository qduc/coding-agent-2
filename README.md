# Coding Agent - AI Programming Assistant

**Goal**: A CLI tool that acts as a coding agent - an AI assistant for programming tasks through natural language conversations in the terminal.

## Quick Start Goals (MVP)
- ✅ Basic `coding-agent "help me understand this file"` command
- ✅ Simple chat mode with context awareness
- ✅ File reading and basic code analysis capabilities

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
│   │   ├── chat.ts           # Interactive chat interface
│   │   └── index.ts          # Main CLI entry point
│   ├── core/
│   │   ├── agent.ts          # Core AI agent logic
│   │   ├── context.ts        # Project context management
│   │   └── config.ts         # Configuration management
│   ├── tools/
│   │   ├── read.ts           # File reading (MVP core tool)
│   │   ├── ls.ts             # Directory listing
│   │   └── glob.ts           # Pattern matching
│   └── services/
│       └── llm/              # OpenAI integration
├── package.json
└── tsconfig.json
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

### Read-Only Tools
- **Read** - File content reading
- **LS** - Directory listing
- **Glob** - Pattern matching for file discovery

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
