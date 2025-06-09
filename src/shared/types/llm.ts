export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  // Prompt caching support
  cache_control?: {
    type: 'ephemeral';
    ttl?: '5m' | '1h';
  };
}

// Add cache-related fields to usage tracking
export interface CacheUsage {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

export interface StreamingResponse {
  content: string;
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Add cache usage tracking
    cacheUsage?: CacheUsage;
  };
}

export interface FunctionCallResponse {
  content: string | null;
  tool_calls?: any[];
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Add cache usage tracking
    cacheUsage?: CacheUsage;
  };
}

/** Interface for LLM providers. */
export interface LLMProvider {
  initialize(): Promise<boolean>;
  isReady(): boolean;
  getProviderName(): string;
  getModelName(): string;
  streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse>;
  sendMessage(messages: Message[]): Promise<string>;
  sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  streamMessageWithTools(
    messages: Message[],
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  sendToolResults?(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[]
  ): Promise<FunctionCallResponse>;
  streamToolResults?(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  processWithNativeToolLoop?(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<string>;

  // Responses API methods for reasoning models
  sendResponsesMessage?(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    }
  ): Promise<ResponsesApiResponse>;

  streamResponsesMessage?(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    },
    onChunk?: (chunk: string) => void
  ): Promise<ResponsesApiResponse>;
}

// Add types for OpenAI Responses API
export interface ResponsesInput {
  role: string;
  content: string;
}

export interface ReasoningConfig {
  effort: 'low' | 'medium' | 'high';
}

export interface ResponsesApiResponse {
  response_id?: string;
  output_text?: string;
  status: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}
