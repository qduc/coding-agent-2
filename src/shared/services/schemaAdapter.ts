/**
 * Schema adapter for transforming tool schemas between different LLM providers
 * Handles the differences in function calling schemas across OpenAI, Anthropic, and Gemini
 */

import { FunctionDeclaration } from '@google/generative-ai';

export interface ToolSchema {
  name: string;
  description: string;
  input_schema?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Schema adapter class for converting between provider formats
 */
export class SchemaAdapter {
  /**
   * Convert a generic tool schema to OpenAI function format
   */
  static toOpenAI(tool: ToolSchema): OpenAIFunction {
    const schema = tool.input_schema || tool.parameters;
    if (!schema) {
      throw new Error(`Tool ${tool.name} missing schema definition`);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: schema.type,
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties
      }
    };
  }

  /**
   * Convert a generic tool schema to Anthropic tool format
   */
  static toAnthropic(tool: ToolSchema): AnthropicTool {
    const schema = tool.input_schema || tool.parameters;
    if (!schema) {
      throw new Error(`Tool ${tool.name} missing schema definition`);
    }

    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: schema.type,
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties
      }
    };
  }

  /**
   * Convert a generic tool schema to Gemini function declaration format
   * Note: Strips additionalProperties as Gemini doesn't support it
   */
  static toGemini(tool: ToolSchema): FunctionDeclaration {
    const schema = tool.input_schema || tool.parameters;
    if (!schema) {
      throw new Error(`Tool ${tool.name} missing schema definition`);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT' as any, // Gemini expects specific enum values
        properties: schema.properties,
        required: schema.required
        // additionalProperties intentionally omitted for Gemini compatibility
      }
    };
  }

  /**
   * Convert array of tools to OpenAI format
   */
  static convertToOpenAI(tools: ToolSchema[]): OpenAIFunction[] {
    return tools.map(tool => this.toOpenAI(tool));
  }

  /**
   * Convert array of tools to Anthropic format
   */
  static convertToAnthropic(tools: ToolSchema[]): AnthropicTool[] {
    return tools.map(tool => this.toAnthropic(tool));
  }

  /**
   * Convert array of tools to Gemini format
   */
  static convertToGemini(tools: ToolSchema[]): FunctionDeclaration[] {
    return tools.map(tool => this.toGemini(tool));
  }

  /**
   * Normalize a tool schema to ensure it has the correct structure
   * Handles both input_schema and parameters formats
   */
  static normalize(tool: any): ToolSchema {
    // If it already has input_schema, use that
    if (tool.input_schema) {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema
      };
    }

    // If it has parameters, convert to input_schema format
    if (tool.parameters) {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      };
    }

    // Fallback for any other format
    throw new Error(`Tool ${tool.name} has unknown schema format`);
  }

  /**
   * Normalize array of tools
   */
  static normalizeAll(tools: any[]): ToolSchema[] {
    return tools.map(tool => this.normalize(tool));
  }
}
