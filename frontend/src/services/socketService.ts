export class SocketService {
  private socket: WebSocket | null = null;
  private static instance: SocketService;
  private eventListeners: Map<string, Set<EventListener>> = new Map();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(url: string): WebSocket {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    this.socket = new WebSocket(url);

    this.socket.onmessage = (event) => {
      this.emit('message', event);
    };

    this.socket.onerror = (error) => {
      this.emit('error', error);
    };

    this.socket.onclose = () => {
      this.emit('close', null);
    };

    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public send(message: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }

  public on(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener);
  }

  public off(event: string, listener?: EventListener): void {
    if (!listener) {
      this.eventListeners.delete(event);
      return;
    }
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}

export const socketService = SocketService.getInstance();
