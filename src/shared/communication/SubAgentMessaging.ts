/**
 * Sub-agent communication system for parent-child messaging
 */

import { EventEmitter } from 'events';
import { SubAgentMessage, ISubAgentCommunication } from '../types/subAgent';
import { logger } from '../utils/logger';

/**
 * Event-based communication channel for sub-agents
 */
export class SubAgentCommunication extends EventEmitter implements ISubAgentCommunication {
  private isChannelActive: boolean = true;
  private messageHistory: SubAgentMessage[] = [];
  private maxHistorySize: number = 1000;
  private agentId: string;
  private parentId?: string;
  private childIds: Set<string> = new Set();

  constructor(agentId: string, parentId?: string) {
    super();
    this.agentId = agentId;
    this.parentId = parentId;
    
    // Set max listeners to handle multiple sub-agents
    this.setMaxListeners(50);
  }

  /**
   * Send message to parent agent
   */
  async sendToParent(message: SubAgentMessage): Promise<void> {
    if (!this.isChannelActive) {
      throw new Error('Communication channel is closed');
    }

    if (!this.parentId) {
      throw new Error('No parent agent configured for this sub-agent');
    }

    const enrichedMessage: SubAgentMessage = {
      ...message,
      from: this.agentId,
      to: this.parentId,
      timestamp: Date.now()
    };

    this.addToHistory(enrichedMessage);
    this.emit('message-to-parent', enrichedMessage);
    
    logger.debug(`Sub-agent ${this.agentId} sent message to parent:`, {
      type: message.type,
      messageId: message.id
    });
  }

  /**
   * Receive message from parent agent
   */
  async receiveFromParent(): Promise<SubAgentMessage | null> {
    if (!this.isChannelActive) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('message-from-parent', messageHandler);
        resolve(null);
      }, 5000); // 5 second timeout

      const messageHandler = (message: SubAgentMessage) => {
        clearTimeout(timeout);
        this.removeListener('message-from-parent', messageHandler);
        resolve(message);
      };

      this.once('message-from-parent', messageHandler);
    });
  }

  /**
   * Send message to specific sub-agent
   */
  async sendToSubAgent(agentId: string, message: SubAgentMessage): Promise<void> {
    if (!this.isChannelActive) {
      throw new Error('Communication channel is closed');
    }

    const enrichedMessage: SubAgentMessage = {
      ...message,
      from: this.agentId,
      to: agentId,
      timestamp: Date.now()
    };

    this.addToHistory(enrichedMessage);
    this.emit(`message-to-${agentId}`, enrichedMessage);
    
    logger.debug(`Agent ${this.agentId} sent message to sub-agent ${agentId}:`, {
      type: message.type,
      messageId: message.id
    });
  }

  /**
   * Subscribe to messages from sub-agents
   */
  subscribeToSubAgent(agentId: string, callback: (message: SubAgentMessage) => void): void {
    this.childIds.add(agentId);
    this.on(`message-from-${agentId}`, callback);
    
    logger.debug(`Agent ${this.agentId} subscribed to messages from ${agentId}`);
  }

  /**
   * Unsubscribe from sub-agent messages
   */
  unsubscribeFromSubAgent(agentId: string): void {
    this.childIds.delete(agentId);
    this.removeAllListeners(`message-from-${agentId}`);
    
    logger.debug(`Agent ${this.agentId} unsubscribed from messages from ${agentId}`);
  }

  /**
   * Handle incoming message from parent
   */
  handleMessageFromParent(message: SubAgentMessage): void {
    if (!this.isChannelActive) {
      return;
    }

    this.addToHistory(message);
    this.emit('message-from-parent', message);
    
    logger.debug(`Sub-agent ${this.agentId} received message from parent:`, {
      type: message.type,
      messageId: message.id
    });
  }

  /**
   * Handle incoming message from sub-agent
   */
  handleMessageFromSubAgent(agentId: string, message: SubAgentMessage): void {
    if (!this.isChannelActive) {
      return;
    }

    this.addToHistory(message);
    this.emit(`message-from-${agentId}`, message);
    
    logger.debug(`Agent ${this.agentId} received message from sub-agent ${agentId}:`, {
      type: message.type,
      messageId: message.id
    });
  }

  /**
   * Check if communication channel is active
   */
  isActive(): boolean {
    return this.isChannelActive;
  }

  /**
   * Close communication channel
   */
  async close(): Promise<void> {
    this.isChannelActive = false;
    
    // Unsubscribe from all child agents
    for (const childId of this.childIds) {
      this.unsubscribeFromSubAgent(childId);
    }
    
    // Remove all listeners
    this.removeAllListeners();
    
    logger.debug(`Communication channel closed for agent ${this.agentId}`);
  }

  /**
   * Get message history
   */
  getMessageHistory(): SubAgentMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Get communication statistics
   */
  getStats(): {
    totalMessages: number;
    messagesByType: Record<string, number>;
    childAgents: number;
    isActive: boolean;
  } {
    const messagesByType: Record<string, number> = {};
    
    for (const message of this.messageHistory) {
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1;
    }

    return {
      totalMessages: this.messageHistory.length,
      messagesByType,
      childAgents: this.childIds.size,
      isActive: this.isChannelActive
    };
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
    logger.debug(`Message history cleared for agent ${this.agentId}`);
  }

  /**
   * Add message to history with size management
   */
  private addToHistory(message: SubAgentMessage): void {
    this.messageHistory.push(message);
    
    // Maintain history size limit
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Communication coordinator for managing multiple agent communications
 */
export class SubAgentCommunicationCoordinator {
  private channels: Map<string, SubAgentCommunication> = new Map();
  private messageCount: number = 0;
  private errorCount: number = 0;

  /**
   * Create communication channel for agent
   */
  createChannel(agentId: string, parentId?: string): SubAgentCommunication {
    const channel = new SubAgentCommunication(agentId, parentId);
    this.channels.set(agentId, channel);
    
    // Set up message routing between channels
    this.setupMessageRouting(channel, agentId);
    
    logger.debug(`Created communication channel for agent ${agentId}`);
    return channel;
  }

  /**
   * Get communication channel for agent
   */
  getChannel(agentId: string): SubAgentCommunication | undefined {
    return this.channels.get(agentId);
  }

  /**
   * Remove communication channel
   */
  async removeChannel(agentId: string): Promise<void> {
    const channel = this.channels.get(agentId);
    if (channel) {
      await channel.close();
      this.channels.delete(agentId);
      logger.debug(`Removed communication channel for agent ${agentId}`);
    }
  }

  /**
   * Route message between agents
   */
  async routeMessage(fromId: string, toId: string, message: SubAgentMessage): Promise<void> {
    const fromChannel = this.channels.get(fromId);
    const toChannel = this.channels.get(toId);

    if (!fromChannel || !toChannel) {
      this.errorCount++;
      throw new Error(`Cannot route message: missing channel for ${!fromChannel ? fromId : toId}`);
    }

    try {
      // Route message to target channel
      if (message.from === fromId) {
        toChannel.handleMessageFromSubAgent(fromId, message);
      } else {
        toChannel.handleMessageFromParent(message);
      }
      
      this.messageCount++;
    } catch (error) {
      this.errorCount++;
      logger.error('Failed to route message:', error as Error);
      throw error;
    }
  }

  /**
   * Broadcast message to all agents
   */
  async broadcastMessage(message: Omit<SubAgentMessage, 'to'>): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [agentId, channel] of this.channels) {
      if (agentId !== message.from) {
        const fullMessage: SubAgentMessage = {
          ...message,
          to: agentId
        };
        
        promises.push(
          Promise.resolve(channel.handleMessageFromParent(fullMessage))
        );
      }
    }

    await Promise.allSettled(promises);
    this.messageCount += promises.length;
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    totalChannels: number;
    activeChannels: number;
    totalMessages: number;
    errorCount: number;
  } {
    const activeChannels = Array.from(this.channels.values())
      .filter(channel => channel.isActive()).length;

    return {
      totalChannels: this.channels.size,
      activeChannels,
      totalMessages: this.messageCount,
      errorCount: this.errorCount
    };
  }

  /**
   * Shutdown all channels
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const channel of this.channels.values()) {
      promises.push(channel.close());
    }
    
    await Promise.allSettled(promises);
    this.channels.clear();
    
    logger.debug('Communication coordinator shutdown complete');
  }

  /**
   * Set up message routing between channels
   */
  private setupMessageRouting(channel: SubAgentCommunication, agentId: string): void {
    // Route messages to parent
    channel.on('message-to-parent', (message: SubAgentMessage) => {
      const parentChannel = this.channels.get(message.to);
      if (parentChannel) {
        parentChannel.handleMessageFromSubAgent(agentId, message);
      }
    });

    // Route messages to sub-agents
    channel.on('message-to-*', (message: SubAgentMessage) => {
      const targetChannel = this.channels.get(message.to);
      if (targetChannel) {
        targetChannel.handleMessageFromParent(message);
      }
    });
  }
}