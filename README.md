# Coding Agent - AI Programming Assistant

## Overview

Coding Agent is a powerful CLI and web-based tool that serves as an AI assistant for programming tasks through natural language conversations. It leverages large language models (LLMs) from providers like OpenAI, Anthropic, and Google to help developers understand, analyze, and modify code more efficiently.

## Features

### Core Capabilities
- 💬 **Interactive Chat**: Natural language conversations about your code
- 📁 **File Operations**: Read, write, and navigate your codebase
- 🔍 **Code Analysis**: Understand complex code structures and patterns
- 🔄 **Code Generation**: Create new files and modify existing ones safely
- 🔎 **Advanced Search**: Fast text search with context using ripgrep integration

### Technical Highlights
- ✅ **Multi-Provider Support**: Works with OpenAI, Anthropic, and Google Gemini models
- ✅ **Streaming Responses**: Real-time AI interaction with token tracking
- ✅ **Enhanced Tool Orchestration**: Improved function calling and error handling
- ✅ **Web Interface**: Both CLI and web-based interaction options
- ✅ **Comprehensive Testing**: Unit tests for all major components

## Installation

```bash
# Install globally
npm install -g coding-agent

# Or run with npx
npx coding-agent
```

## Usage

### CLI Mode

```bash
# Start interactive chat mode
coding-agent

# Direct commands
coding-agent "help me understand this file"
coding-agent "explain how this function works"
```

### Web Interface

```bash
# Start the web server
npm run start:web

# Start both backend and frontend
npm run start:fullstack
```

## Available Tools

| Tool | Description |
|------|-------------|
| **read** | Read file contents with encoding support and line range selection |
| **write** | Create or modify files with safety features and backups |
| **ls** | Directory listing with detailed metadata and filtering |
| **glob** | Pattern matching for file discovery |
| **ripgrep** | Fast text search with context and filtering |
| **bash** | Execute bash commands (with safety constraints) |
| **todo** | Manage TODO comments in your codebase |
| **subAgent** | Create specialized sub-agents for specific tasks |

## Architecture

```
coding-agent/
├── src/
│   ├── cli/               # Command-line interface components
│   ├── services/          # Service integrations
│   ├── shared/
│   │   ├── core/          # Core agent and orchestration logic
│   │   ├── tools/         # Tool implementations
│   │   ├── providers/     # LLM provider integrations
│   │   └── utils/         # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── web/               # Web application components
├── dist/                  # Compiled output
└── frontend/              # Web frontend (React)
```

## Advanced Features

### Gemini Enhanced Tool Calling

The coding agent includes enhanced tool calling support for Google's Gemini models, leveraging Gemini's native chat-based API pattern for optimal performance.

```bash
# Enable enhanced calling
export CODING_AGENT_ENHANCED_CALLING=true
coding-agent "analyze this codebase"
```

### Sub-Agent Functionality

Create specialized sub-agents for specific tasks:

```bash
# Example using a sub-agent for code review
coding-agent "review my recent changes using a code review sub-agent"
```

## Safety Features: Approval Prompts for Destructive Actions

To prevent accidental destructive operations, Coding Agent can require explicit user approval before file writes or bash commands. When enabled, a modal prompt will appear in the CLI for each destructive action, with options to approve, deny, or always allow for the session.

**How to enable:**

```bash
export CODING_AGENT_REQUIRE_APPROVAL=1
coding-agent
```

You will be prompted for approval before any file write or bash command.

**Example:**

```bash
coding-agent "write to src/utils/important.ts"
# => [Approval modal appears: Approve, Deny, Always allow for session]
```

You can also try the built-in demo:

```bash
cd src/cli/commands && node -r ts-node/register ./approvalDemo.tsx
```

## Example Workflows

```
User: "The tests are failing in my React app"
Agent: "I'll help you debug the test failures. Let me search for test files and errors..."
[Uses ripgrep to find test files and error patterns]
Agent: "I found 3 failing tests in components/__tests__/. The main issue appears to be..."

User: "Find all TODO comments in the codebase"
Agent: [Uses ripgrep with pattern "TODO|FIXME"]
"Found 12 TODO comments across 8 files. Here's a summary by priority..."

User: "Create a new utility function for date formatting"
Agent: [Uses write tool to create new file]
"✅ Created src/utils/dateFormatter.ts with comprehensive date formatting functions"
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Development mode with watch
npm run dev

# Start the web server in development mode
npm run dev:web

# Start both backend and frontend in development mode
npm run dev:fullstack
```

## Requirements

- Node.js >= 18.0.0

## License

This project is licensed under the GNU General Public License v3.0 (GPL v3).
See the [LICENSE](./LICENSE) file for details.
