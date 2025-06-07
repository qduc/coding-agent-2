/**
 * ConversationManager - Handles message history and conversation state
 */

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export class ConversationManager {
  private conversationHistory: ConversationMessage[] = [];

  /**
   * Add a message to the conversation history
   */
  addMessage(message: ConversationMessage): void {
    this.conversationHistory.push(message);
  }

  /**
   * Add user message to conversation
   */
  addUserMessage(content: string): void {
    this.addMessage({
      role: 'user',
      content
    });
  }

  /**
   * Add assistant message to conversation
   */
  addAssistantMessage(content: string | null, toolCalls?: any[]): void {
    this.addMessage({
      role: 'assistant',
      content,
      tool_calls: toolCalls
    });
  }

  /**
   * Add tool result to conversation
   */
  addToolResult(content: string, toolCallId: string): void {
    this.addMessage({
      role: 'tool',
      content,
      tool_call_id: toolCallId
    });
  }

  /**
   * Build messages array for LLM request including system message
   */
  buildMessages(systemMessage: ConversationMessage): ConversationMessage[] {
    return [systemMessage, ...this.conversationHistory];
  }

  /**
   * Get conversation history (without system message)
   */
  getHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Set conversation history (used for restoring state)
   */
  setHistory(messages: ConversationMessage[]): void {
    this.conversationHistory = [...messages];
  }

  /**
   * Get conversation summary for debugging
   */
  getConversationSummary(): string {
    return this.conversationHistory
      .map((msg, index) => {
        const role = msg.role.toUpperCase();
        const content = msg.content ? msg.content.substring(0, 100) + '...' : '[null]';
        const toolCalls = msg.tool_calls ? ` (${msg.tool_calls.length} tool calls)` : '';
        const toolCallId = msg.tool_call_id ? ` (tool_call_id: ${msg.tool_call_id})` : '';
        return `${index + 1}. ${role}: ${content}${toolCalls}${toolCallId}`;
      })
      .join('\n');
  }

  /**
   * Get the last message in the conversation
   */
  getLastMessage(): ConversationMessage | undefined {
    return this.conversationHistory[this.conversationHistory.length - 1];
  }

  /**
   * Get messages count
   */
  getMessageCount(): number {
    return this.conversationHistory.length;
  }
}