# Detailed Implementation Plan for Web Frontend Integration

## Overview

The current `coding-agent` is a sophisticated CLI tool with:
- **Core Architecture**: Agent → Orchestrator → Tools → LLM Services
- **Tool System**: File operations (read, write, ls, glob), code search (ripgrep), bash execution
- **LLM Support**: OpenAI, Anthropic Claude, Google Gemini with function calling
- **Project Discovery**: Automatic project structure analysis
- **Streaming**: Real-time response streaming capabilities

## Step 1: Code Refactoring and Separation of Concerns

### 1.1 Create Shared Module Structure
**Objective**: Extract CLI-specific logic from core functionality to enable sharing between CLI and web interfaces.

**Actions**:
- **Move Core Logic**: Move core, tools, services, utils to `src/shared/`
- **Create Interface Layer**: Create abstract interfaces for CLI and web implementations
- **Update Imports**: Update all import paths to reference the new shared structure
- **Preserve CLI**: Keep cli intact but update to use shared modules

**File Changes**:
```
src/
├── cli/                    # CLI-specific code
│   └── index.ts           # Updated to use shared modules
├── shared/                 # New shared directory
│   ├── core/              # Moved from src/core/
│   ├── tools/             # Moved from src/tools/
│   ├── services/          # Moved from src/services/
│   └── utils/             # Moved from src/utils/
└── web/                   # New web-specific code (Step 2)
```

**Testing Strategy**: Run existing CLI tests to ensure refactoring doesn't break functionality.

### 1.2 Abstract Interface Creation
**Objective**: Create interfaces that allow both CLI and web to use the same core logic with different I/O handling.

**New Interfaces**:
- `IInputHandler`: Handle user input (CLI readline vs web WebSocket)
- `IOutputHandler`: Handle responses (CLI console vs web JSON)
- `ISessionManager`: Manage conversation state (CLI memory vs web persistent storage)

## Step 2: Web Server Implementation

### 2.1 Express Server Setup
**Objective**: Create a robust web server with WebSocket support for real-time chat.

**Tech Stack**:
- **Framework**: Express.js with TypeScript
- **WebSocket**: Socket.IO for real-time communication
- **Middleware**: CORS, body-parser, express-rate-limit
- **Static Files**: Serve React frontend

**Server Structure**:
```
src/web/
├── server.ts               # Main Express server
├── routes/
│   ├── api.ts             # REST API endpoints
│   ├── auth.ts            # Future authentication
│   ├── config.ts          # Configuration management
│   └── health.ts          # Health check endpoints
├── middleware/
│   ├── cors.ts            # CORS configuration
│   ├── rateLimit.ts       # Rate limiting
│   └── validation.ts      # Request validation
├── sockets/
│   ├── chatHandler.ts     # WebSocket chat logic
│   └── events.ts          # Socket event definitions
└── types/
    └── web.ts             # Web-specific types
```

**Key Features**:
- **Health Endpoints**: `/api/health`, `/api/status`
- **Configuration API**: GET/POST `/api/config` for web-based configuration
- **Tool Information**: GET `/api/tools` to list available tools
- **Chat History**: GET/POST `/api/history` for conversation persistence

### 2.2 WebSocket Integration
**Objective**: Enable real-time bidirectional communication for chat interface.

**Socket Events**:
- `chat:message` - User sends message
- `chat:response` - AI response (streaming)
- `chat:tool_execution` - Tool execution status
- `chat:error` - Error handling
- `chat:clear_history` - Clear conversation
- `session:connected` - Session establishment
- `session:disconnected` - Session cleanup

**Implementation Details**:
- **Room Management**: Each client gets unique room for private conversations
- **Streaming**: Real-time streaming of AI responses using existing `onChunk` callback
- **Tool Feedback**: Live updates when tools are executing
- **Error Recovery**: Graceful error handling and reconnection

## Step 3: API Layer Design

### 3.1 REST API Endpoints
**Objective**: Provide HTTP endpoints for non-real-time operations.

**Endpoint Structure**:
```
GET    /api/health              # Server health
GET    /api/tools               # Available tools list
GET    /api/config              # Current configuration
POST   /api/config              # Update configuration
GET    /api/history/:sessionId  # Chat history
POST   /api/history/:sessionId  # Save chat history
DELETE /api/history/:sessionId  # Clear history
GET    /api/project/discovery   # Project analysis
POST   /api/tools/execute       # Direct tool execution
```

### 3.2 Request/Response Types
**Objective**: Define TypeScript interfaces for API communication.

**Core Types**:
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  output: any;
  executionTime: number;
  error?: string;
}

interface WebSessionState {
  sessionId: string;
  projectContext?: ProjectDiscoveryResult;
  conversationHistory: ChatMessage[];
  toolsAvailable: string[];
}
```

## Step 4: Frontend Development

### 4.1 React Application Setup
**Objective**: Create a modern React frontend with TypeScript and real-time capabilities.

**Tech Stack**:
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **Components**: React components with hooks
- **State Management**: React Context + useReducer for global state
- **WebSocket**: Socket.IO client for real-time communication
- **UI Library**: Headless UI for accessible components

**Project Structure**:
```
src/frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── ToolExecutionDisplay.tsx
│   │   ├── FileExplorer/
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileViewer.tsx
│   │   │   └── FileEditor.tsx
│   │   ├── Configuration/
│   │   │   ├── ConfigPanel.tsx
│   │   │   └── ProviderSelector.tsx
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── StatusBar.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useChat.ts
│   │   └── useFileSystem.ts
│   ├── context/
│   │   ├── AppContext.tsx
│   │   └── ChatContext.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types/
│   │   └── frontend.ts
│   └── utils/
│       ├── formatters.ts
│       └── validation.ts
└── package.json
```

### 4.2 Core Components

**ChatInterface Component**:
- Real-time message display with streaming
- Tool execution visualization
- Message history with timestamps
- Input with suggestion support
- Copy/export conversation functionality

**FileExplorer Component**:
- Project file tree visualization
- File content preview
- Basic file editing capabilities
- Integration with file tools (read, write, ls)

**Configuration Panel**:
- LLM provider selection (OpenAI, Anthropic, Gemini)
- API key management (stored in browser localStorage)
- Tool enabling/disabling
- Streaming preferences

## Step 5: Real-time Communication

### 5.1 WebSocket Implementation
**Objective**: Seamless real-time communication between frontend and backend.

**Client-Side WebSocket Handler**:
```typescript
class WebSocketService {
  connect(sessionId: string): void;
  sendMessage(message: string): void;
  onMessage(callback: (data: any) => void): void;
  onToolExecution(callback: (data: any) => void): void;
  onError(callback: (error: any) => void): void;
  disconnect(): void;
}
```

**Server-Side Integration**:
- Connect WebSocket events to existing `Agent.processMessage()`
- Stream responses using existing `onChunk` callback mechanism
- Broadcast tool execution progress to connected clients
- Handle connection lifecycle (connect, disconnect, reconnect)

### 5.2 Streaming Integration
**Objective**: Leverage existing streaming capabilities for real-time response delivery.

**Implementation**:
- Use existing `onChunk` callback from `ToolOrchestrator.processMessage()`
- Transform chunks to WebSocket events
- Handle tool execution notifications
- Provide visual feedback for long-running operations

## Step 6: Session Management

### 6.1 Session Storage
**Objective**: Persist conversation history and session state.

**Storage Strategy**:
- **In-Memory**: Development and demo purposes (current)
- **File-Based**: JSON files for local persistence
- **Future**: Database integration for production

**Session Features**:
- Unique session IDs for each browser session
- Conversation history persistence
- Project context caching
- Tool execution logs

### 6.2 Configuration Management
**Objective**: Web-based configuration management integrated with existing config system.

**Implementation**:
- Extend existing `configManager` for web API access
- Frontend configuration panel
- API key management (client-side storage)
- Provider selection and validation
- Tool preferences

## Step 7: Tool Integration

### 7.1 Web-Safe Tool Execution
**Objective**: Safely expose existing tools to web interface.

**Security Considerations**:
- **File Access**: Limit to project directory
- **Bash Execution**: Optional disable for security
- **Path Validation**: Prevent directory traversal
- **Rate Limiting**: Prevent tool abuse

**Tool Adaptations**:
- **ReadTool**: Web-friendly file content display
- **WriteTool**: Confirmation dialogs for file modifications
- **BashTool**: Optional with explicit user consent
- **RipgrepTool**: Enhanced search results formatting

### 7.2 Tool Result Visualization
**Objective**: Rich display of tool execution results in web interface.

**Enhancements**:
- **File Content**: Syntax highlighting
- **Search Results**: Interactive navigation
- **Directory Listings**: Expandable tree view
- **Bash Output**: Terminal-style display with colors

## Step 8: Build and Deployment

### 8.1 Build System Integration
**Objective**: Unified build process for CLI and web components.

**Updated Scripts**:
```json
{
  "scripts": {
    "build": "npm run build:shared && npm run build:cli && npm run build:web",
    "build:shared": "tsc --project tsconfig.shared.json",
    "build:cli": "tsc --project tsconfig.cli.json",
    "build:web": "tsc --project tsconfig.web.json && npm run build:frontend",
    "build:frontend": "cd src/frontend && npm run build",
    "dev:cli": "npm run build:shared && tsc --project tsconfig.cli.json --watch",
    "dev:web": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run build:shared && tsc --project tsconfig.web.json --watch",
    "dev:frontend": "cd src/frontend && npm start",
    "start:cli": "node dist/cli/index.js",
    "start:web": "node dist/web/server.js"
  }
}
```

### 8.2 Development Workflow
**Objective**: Smooth development experience for both CLI and web.

**Development Setup**:
- **CLI Development**: Existing workflow unchanged
- **Web Development**: Hot reload for both frontend and backend
- **Shared Code**: Automatic rebuild when shared modules change
- **Testing**: Separate test suites for CLI and web components

## Step 9: Testing Strategy

### 9.1 Backend Testing
**Objective**: Comprehensive testing for web server and API.

**Test Categories**:
- **Unit Tests**: API endpoints, WebSocket handlers
- **Integration Tests**: Agent integration, tool execution
- **E2E Tests**: Full chat workflow testing

### 9.2 Frontend Testing
**Objective**: Reliable frontend component testing.

**Test Categories**:
- **Component Tests**: React component unit tests
- **Integration Tests**: WebSocket communication
- **User Flow Tests**: Complete chat scenarios

## Step 10: Documentation and Examples

### 10.1 API Documentation
**Objective**: Complete API documentation for developers.

**Documentation**:
- **REST API**: OpenAPI/Swagger specification
- **WebSocket Events**: Event schema documentation
- **Configuration**: Web configuration options
- **Examples**: Sample requests and responses

### 10.2 User Documentation
**Objective**: User-friendly documentation for web interface.

**Content**:
- **Getting Started**: Web interface overview
- **Feature Guide**: Chat interface, file explorer, configuration
- **Troubleshooting**: Common issues and solutions
- **Migration**: CLI to web transition guide

## Implementation Priorities

### Phase 1 (Core Infrastructure)
1. Code refactoring and shared module creation
2. Basic Express server with WebSocket support
3. Simple React frontend with chat interface
4. Integration with existing Agent/Orchestrator

### Phase 2 (Feature Enhancement)
1. File explorer implementation
2. Configuration management
3. Tool result visualization
4. Session persistence

### Phase 3 (Polish and Production)
1. Security hardening
2. Comprehensive testing
3. Performance optimization
4. Documentation completion
