# When implementing anything:
- Learn the code first: Understand how the codebase works, existing patterns, tech stack, and team style before writing code
- Get clear on the task: Restate the problem, nail down what's needed, catch anything unclear
- Break it down: Split into smallest pieces, find what other code this affects, think about edge cases
- Compare ways to do it: Show 2-3 options with pros/cons, pick one that fits the existing code, state your assumptions
- Test first (if tests exist): Write failing tests that show what success looks like, then build to make them pass
- Build carefully: Follow existing patterns, start simple, make code easy to understand
- Check it works: Does it solve the real problem? How does it fit with existing code? What could break?

# Project Overview

AI programming assistant CLI tool for natural language code interactions.

## Usage

```bash
# Interactive chat
coding-agent

# Direct commands
coding-agent "help me understand this file"
```

## MVP Features
- File reading and analysis
- Directory listing and pattern matching
- Interactive chat with project context
- OpenAI integration

## Architecture
```
src/
├── cli/          # CLI interface & chat
├── core/         # Agent logic & context
├── tools/        # File operations (read, ls, glob)
└── services/llm/ # OpenAI integration
```

## Dependencies
- commander, inquirer, chalk, openai, fs-extra, globby