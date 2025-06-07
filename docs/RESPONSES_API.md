# OpenAI Responses API Integration

This document describes the integration of OpenAI's Responses API for reasoning models in the coding-agent project.

## Overview

The Responses API provides significant advantages over the Chat Completions API when working with reasoning models (o1, o3, o4-mini series):

- **Better Performance**: Optimized for reasoning models
- **Improved Caching**: Up to 80% cache utilization vs 40% with Chat Completions API
- **Reasoning Token Management**: Proper handling of reasoning tokens in multi-turn conversations
- **Encrypted Reasoning Items**: Support for stateless usage with encrypted reasoning content
- **Reasoning Summaries**: Transparency into the reasoning process

## Automatic Detection

The system automatically detects reasoning models and uses the Responses API:

```typescript
// These models automatically use Responses API:
const reasoningModels = [
  'o1', 'o1-preview', 'o1-mini',
  'o3', 'o3-mini', 'o3-2025-01-15',
  'o4', 'o4-mini', 'o4-mini-2025-04-16'
];
```

## Configuration

### Automatic Mode (Recommended)
```json
{
  "model": "o3-mini",
  "provider": "openai"
}
```

The system automatically uses Responses API for reasoning models.

### Force Responses API
```json
{
  "model": "gpt-4o",
  "provider": "openai",
  "useResponsesApi": true
}
```

Forces Responses API usage even for non-reasoning models.

### Disable Responses API
```json
{
  "model": "o3-mini",
  "provider": "openai",
  "useResponsesApi": false
}
```

Forces Chat Completions API even for reasoning models.

## Usage Examples

### Basic Usage
```typescript
import { llmService, configManager } from './path/to/services';

// Configure reasoning model
await configManager.saveConfig({ model: 'o3-mini' });

// Send message - automatically uses Responses API
const response = await llmService.sendMessage([
  { role: 'user', content: 'Analyze this complex problem step by step...' }
]);

console.log(response); // Contains the reasoning output
```

### Streaming
```typescript
const response = await llmService.streamMessage(
  [{ role: 'user', content: 'Complex reasoning task...' }],
  (chunk) => {
    console.log('Streaming:', chunk);
  }
);
```

### Multi-turn Conversations
```typescript
// First message
const response1 = await llmService.sendMessage([
  { role: 'user', content: 'Start analyzing this dataset...' }
]);

// Follow-up automatically uses previous response context
const response2 = await llmService.sendMessage([
  { role: 'user', content: 'Now apply that analysis to predict...' }
]);
```

### Direct Responses API Usage
```typescript
// For advanced use cases
const response = await llmService.sendResponsesMessage(
  'Complex reasoning prompt...',
  {
    model: 'o3-mini',
    reasoning: {
      effort: 'high',
      generate_summary: 'auto'
    },
    include: ['reasoning.encrypted_content'],
    store: true,
    temperature: 0.7,
    max_output_tokens: 4000
  }
);

// Access reasoning metadata
console.log('Response ID:', response.id);
console.log('Reasoning tokens:', response.usage?.reasoning_tokens);
console.log('Output:', response.output_text);
```

## API Methods

### Core Methods
- `sendMessage(messages)` - Automatically uses best API
- `streamMessage(messages, onChunk)` - Streaming with auto-detection
- `sendMessageWithTools(messages, tools)` - Tool calling support

### Responses API Specific
- `sendResponsesMessage(input, options)` - Direct Responses API usage
- `streamResponsesMessage(input, options, onChunk)` - Streaming Responses API
- `isUsingReasoningModel()` - Check if current model is reasoning-based
- `isResponsesApiEnabled()` - Check if Responses API is active

### Conversation Management
- `resetConversationState()` - Reset multi-turn conversation
- `getCurrentConversationId()` - Get current conversation ID

## Configuration Options

### Reasoning Configuration
```typescript
{
  effort: 'low' | 'medium' | 'high',  // Reasoning effort level
  generate_summary: 'auto' | 'on_demand',  // When to generate summaries
  summary: 'auto' | 'on_demand'  // Summary configuration
}
```

### Include Options
```typescript
{
  include: [
    'reasoning.encrypted_content',  // Encrypted reasoning for stateless usage
    'reasoning.summary',  // Human-readable reasoning summary
    'usage.reasoning_tokens'  // Token usage details
  ]
}
```

## Error Handling

The integration includes automatic fallback to Chat Completions API if Responses API fails:

```typescript
try {
  // Attempt Responses API
  const response = await llmService.sendResponsesMessage(input, options);
  return response;
} catch (error) {
  // Automatic fallback to Chat Completions API
  logger.warn('Responses API failed, falling back to Chat Completions');
  return await llmService.sendMessage(messages);
}
```

## Performance Benefits

### Cache Utilization
- **Responses API**: Up to 80% cache hit rate
- **Chat Completions API**: ~40% cache hit rate

### Reasoning Token Efficiency
- Proper reasoning token accounting in multi-turn conversations
- Efficient state management for complex reasoning chains
- Reduced total token usage through better caching

### Multi-turn Performance
```typescript
// Efficient multi-turn with automatic state management
llmService.resetConversationState(); // Start fresh

const turn1 = await llmService.sendMessage([...]);  // Sets conversation ID
const turn2 = await llmService.sendMessage([...]);  // Uses previous context
const turn3 = await llmService.sendMessage([...]);  // Continues efficiently
```

## Best Practices

### 1. Use Reasoning Models for Complex Tasks
```typescript
// Good: Complex analytical tasks
await configManager.saveConfig({ model: 'o3-mini' });
const analysis = await llmService.sendMessage([
  { role: 'user', content: 'Perform detailed code review and suggest optimizations...' }
]);
```

### 2. Manage Conversation State
```typescript
// Reset between different conversations
llmService.resetConversationState();

// Continue related conversation
const followUp = await llmService.sendMessage([...]);
```

### 3. Configure Reasoning Effort
```typescript
// For complex tasks requiring deep reasoning
const response = await llmService.sendResponsesMessage(input, {
  reasoning: { effort: 'high' },
  store: true
});
```

### 4. Handle Reasoning Transparency
```typescript
const response = await llmService.sendResponsesMessage(input, {
  include: ['reasoning.summary'],
  reasoning: { generate_summary: 'auto' }
});

// Access reasoning insights
if (response.output) {
  response.output.forEach(item => {
    if (item.type === 'reasoning' && item.summary) {
      console.log('Reasoning:', item.summary);
    }
  });
}
```

## Testing

Run the integration tests:
```bash
npm test -- llm.responses.test.ts
```

The test suite covers:
- Reasoning model detection
- API selection logic
- Message conversion
- Conversation state management
- Configuration scenarios

## Migration Guide

### From Chat Completions API
No code changes required for basic usage. Simply update the model:

```diff
{
- "model": "gpt-4o"
+ "model": "o3-mini"
}
```

### Advanced Migration
For direct API usage, update to Responses API:

```diff
- const response = await openai.chat.completions.create({
-   model: 'o1-preview',
-   messages: [...]
- });

+ const response = await llmService.sendResponsesMessage([...], {
+   model: 'o1-preview',
+   reasoning: { effort: 'medium' }
+ });
```

## Troubleshooting

### Common Issues

1. **Responses API not being used**
   - Check model name includes reasoning model pattern
   - Verify `useResponsesApi` is not explicitly disabled
   - Ensure OpenAI provider is selected

2. **Fallback to Chat Completions**
   - Check API key permissions for Responses API
   - Verify model availability
   - Check request parameters compatibility

3. **Conversation state issues**
   - Call `resetConversationState()` between different conversations
   - Check `getCurrentConversationId()` for debugging

### Debug Logging
Enable debug logging to see API selection:
```json
{
  "logLevel": "debug"
}
```

Look for log messages:
- "Using Responses API for reasoning model"
- "Falling back to Chat Completions API"
- "Responses API request completed"

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/guides/responses)
- [Reasoning Models Guide](https://platform.openai.com/docs/guides/reasoning)
- [OpenAI Responses Starter App](https://github.com/openai/responses-starter-app)
