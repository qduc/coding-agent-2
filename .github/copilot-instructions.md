# When implementing anything:
- Learn the code first: Understand how the codebase works, existing patterns, tech stack, and team style before writing code
- Get clear on the task: Restate the problem, nail down what's needed, catch anything unclear. Ask clarifying questions about requirements before coding if anything is unclear
- Break it down: Split into smallest pieces, find what other code this affects, think about edge cases
- Adopt a senior developer mindset: Think through multiple perspectives including architecture, security, data flow, performance, and maintainability. Analyze the broader system context and existing patterns, identify all components that could be affected, and anticipate edge cases and potential failures
- Compare ways to do it: Show 2-3 options with pros/cons, pick one that fits the existing code, state your assumptions
- Test first (if tests exist): Write failing tests that show what success looks like, then build to make them pass
- Build carefully: Follow existing patterns, start simple, make code easy to understand. Implement with appropriate error handling, testing, and documentation
- Check it works: Does it solve the real problem? How does it fit with existing code? What could break? Consider both immediate functionality and long-term implications including backwards compatibility, scalability, and technical debt


# When writing tests:
- Focus only on implemented functionality and real user scenarios
- Test core capabilities, parameter validation, security features, and actual use cases
- Avoid testing unimplemented features, complex internal implementation details, or theoretical edge cases
- Write fewer, focused tests that verify what the code actually does
- ALWAYS run tests using shell command


# Project Overview

AI programming assistant CLI tool for natural language code interactions.

## Usage

```bash
# Interactive chat
coding-agent

# Direct commands
coding-agent "help me understand this file"
```
