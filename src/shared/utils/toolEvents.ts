import { EventEmitter } from 'events';

export interface ToolCallEvent {
  type: 'tool_call';
  toolName: string;
  args: any;
  timestamp: Date;
}

export interface ToolResultEvent {
  type: 'tool_result';
  toolName: string;
  success: boolean;
  result?: any;
  args?: any;
  timestamp: Date;
}

export type ToolEvent = ToolCallEvent | ToolResultEvent;

/**
 * Global tool event emitter for communicating tool usage to UI components
 * This allows the Ink UI to receive tool events without direct coupling
 */
class ToolEventEmitter extends EventEmitter {
  emitToolCall(toolName: string, args: any): void {
    const event: ToolCallEvent = {
      type: 'tool_call',
      toolName,
      args,
      timestamp: new Date()
    };
    this.emit('tool_event', event);
  }

  emitToolResult(toolName: string, success: boolean, result?: any, args?: any): void {
    const event: ToolResultEvent = {
      type: 'tool_result',
      toolName,
      success,
      result,
      args,
      timestamp: new Date()
    };
    this.emit('tool_event', event);
  }

  onToolEvent(listener: (event: ToolEvent) => void): void {
    this.on('tool_event', listener);
  }

  offToolEvent(listener: (event: ToolEvent) => void): void {
    this.off('tool_event', listener);
  }
}

// Global singleton instance
export const toolEventEmitter = new ToolEventEmitter();