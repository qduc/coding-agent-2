## Coding Agent Todo List

### Phase 1: Quick Start Foundation (MVP)
- [x] Set up Node.js/TypeScript project structure
- [x] Install core dependencies (commander, inquirer, chalk, openai)
- [x] Create basic CLI entry point with `coding-agent` command
- [ ] Add configuration management for API keys
- [ ] Set up OpenAI API integration with streaming

### Phase 2: Essential Tools (Quick Start Goals)
- [ ] Implement core read-only tools:
  - [ ] `Read` - file content reading
  - [ ] `LS` - directory listing
  - [ ] `Glob` - pattern matching
- [ ] Add basic project context gathering (file tree)
- [ ] Create simple conversation memory management
- [ ] Implement basic `coding-agent "help me understand this file"` command

### Phase 3: Interactive Chat
- [ ] Implement interactive chat interface using inquirer
- [ ] Add simple session management for conversation history
- [ ] Build simple chat mode with context awareness
- [ ] Add basic error handling and graceful degradation

### Phase 4: Advanced Tools
- [ ] Add remaining read-only tool:
  - [ ] `Grep` - content searching
- [ ] Implement modification tools:
  - [ ] `Write` - file creation/overwrite
  - [ ] `Edit` - targeted file editing
  - [ ] `Bash` - shell command execution
- [ ] Add permission system for destructive operations

### Phase 5: Intelligence & Polish
- [ ] Implement intent recognition for coding tasks
- [ ] Build tool selection and orchestration logic
- [ ] Add advanced project context gathering (git state)
- [ ] Create comprehensive test suite
- [ ] Add output formatting and terminal styling
- [ ] Write documentation and usage examples

### Quick Start Goals (Target for Phase 2 completion)
- [x] Basic `coding-agent "help me understand this file"` command
- [x] Simple chat mode with context awareness
- [x] File reading and basic code analysis capabilities

This reorganization prioritizes getting a working prototype with the three quick start goals before adding advanced features. Each phase builds logically on the previous one.