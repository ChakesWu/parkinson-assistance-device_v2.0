// 轻量级连接管理器 - 专门解决性能问题
export interface LightweightConnectionState {
  isConnected: boolean;
  connectionType: 'serial' | 'bluetooth' | null;
  deviceName: string | null;
}

export class LightweightConnectionManager {
  private static instance: LightweightConnectionManager | null = null;
  private state: LightweightConnectionState = {
    isConnected: false,
    connectionType: null,
    deviceName: null
  };
  private listeners: Set<(state: LightweightConnectionState) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor() {
    try {
      // 只在支持的浏览器中创建BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('parkinson-lightweight-connection');
        this.setupBroadcastChannel();
      }
      this.loadState();
    } catch (error) {
      console.warn('Failed to initialize lightweight connection manager:', error);
    }
  }

  public static getInstance(): LightweightConnectionManager {
    if (!LightweightConnectionManager.instance) {
      LightweightConnectionManager.instance = new LightweightConnectionManager();
    }
    return LightweightConnectionManager.instance;
  }

  private setupBroadcastChannel() {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.addEventListener('message', (event) => {
      try {
        const { type, payload } = event.data;
        if (type === 'stateUpdate') {
          this.updateState(payload, false); // 不广播，避免循环
        }
      } catch (error) {
        console.warn('Error handling broadcast message:', error);
      }
    });
  }

  private loadState() {
    try {
      const saved = localStorage.getItem('parkinson-lightweight-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load connection state:', error);
    }
  }

  private saveState() {
    try {
      localStorage.setItem('parkinson-lightweight-state', JSON.stringify(this.state));
    } catch (error) {
      console.warn('Failed to save connection state:', error);
    }
  }

  private updateState(newState: Partial<LightweightConnectionState>, broadcast = true) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // 只在状态真正改变时才通知
    if (JSON.stringify(oldState) !== JSON.stringify(this.state)) {
      this.saveState();
      
      // 通知所有监听器
      this.listeners.forEach(listener => {
        try {
          listener(this.state);
        } catch (error) {
          console.warn('Error in state listener:', error);
        }
      });

      // 广播给其他页面
      if (broadcast && this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'stateUpdate',
            payload: this.state
          });
        } catch (error) {
          console.warn('Failed to broadcast state:', error);
        }
      }
    }
  }

  // 公共API
  public getState(): LightweightConnectionState {
    return { ...this.state };
  }

  public subscribe(listener: (state: LightweightConnectionState) => void): () => void {
    this.listeners.add(listener);
    
    // 立即调用一次，提供当前状态
    try {
      listener(this.state);
    } catch (error) {
      console.warn('Error in initial state callback:', error);
    }

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setConnected(connectionType: 'serial' | 'bluetooth', deviceName?: string) {
    this.updateState({
      isConnected: true,
      connectionType,
      deviceName: deviceName || null
    });
  }

  public setDisconnected() {
    this.updateState({
      isConnected: false,
      connectionType: null,
      deviceName: null
    });
  }

  public destroy() {
    this.listeners.clear();
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    LightweightConnectionManager.instance = null;
  }
}

// React Hook for lightweight connection state
import { useState, useEffect } from 'react';

export function useLightweightConnection() {
  const [state, setState] = useState<LightweightConnectionState>({
    isConnected: false,
    connectionType: null,
    deviceName: null
  });

  useEffect(() => {
    const manager = LightweightConnectionManager.getInstance();
    
    // 订阅状态变化
    const unsubscribe = manager.subscribe(setState);
    
    return unsubscribe;
  }, []);

  return state;
}

// 导出Hook供React组件使用
export { useLightweightConnection };
