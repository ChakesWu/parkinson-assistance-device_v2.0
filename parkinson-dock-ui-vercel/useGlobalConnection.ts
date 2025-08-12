// React Hook for Global Connection Management
import { useState, useEffect, useCallback } from 'react';
import { GlobalConnectionManager, ConnectionState } from '@/utils/globalConnectionManager';
import { SensorData, AIResult, SpeechResult } from '@/utils/bluetoothManager';

export interface UseGlobalConnectionOptions {
  onDataReceived?: (data: SensorData) => void;
  onAIResultReceived?: (result: AIResult) => void;
  onSpeechResultReceived?: (result: SpeechResult) => void;
  autoRequestState?: boolean; // 是否自动请求其他页面的连接状态
}

export interface UseGlobalConnectionReturn {
  // 连接状态
  connectionState: ConnectionState;
  isConnected: boolean;
  connectionType: 'serial' | 'bluetooth' | null;
  deviceName: string | null;
  
  // 浏览器支持
  browserSupport: {
    serial: boolean;
    bluetooth: boolean;
  };
  
  // 连接方法
  connectBluetooth: () => Promise<void>;
  connectSerial: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  
  // 状态
  isConnecting: boolean;
  error: string | null;
  
  // 工具方法
  clearError: () => void;
  refreshConnectionState: () => void;
}

export function useGlobalConnection(options: UseGlobalConnectionOptions = {}): UseGlobalConnectionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    connectionType: null,
    deviceName: null,
    lastUpdate: Date.now()
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserSupport] = useState(() => {
    const manager = GlobalConnectionManager.getInstance();
    return manager.getBrowserSupport();
  });

  // 初始化连接管理器
  useEffect(() => {
    let mounted = true;

    try {
      const manager = GlobalConnectionManager.getInstance();

      // 获取当前状态
      const currentState = manager.getConnectionState();
      if (mounted) {
        setConnectionState(currentState);
      }

      // 自动请求其他页面的连接状态（延迟执行避免阻塞）
      if (options.autoRequestState !== false) {
        setTimeout(() => {
          if (mounted) {
            try {
              manager.requestConnectionState();
            } catch (error) {
              console.error('Failed to request connection state:', error);
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to initialize global connection:', error);
      if (mounted) {
        setError('初始化连接管理器失败');
      }
    }

    return () => {
      mounted = false;
      // 注意：不要在这里销毁manager，因为它是全局单例
    };
  }, []); // 移除依赖数组，只在组件挂载时执行一次

  // 更新回调函数（当回调函数变化时）
  useEffect(() => {
    try {
      const manager = GlobalConnectionManager.getInstance();
      manager.setCallbacks({
        onDataReceived: options.onDataReceived,
        onAIResultReceived: options.onAIResultReceived,
        onSpeechResultReceived: options.onSpeechResultReceived,
        onConnectionStateChanged: (state: ConnectionState) => {
          setConnectionState(state);
          setIsConnecting(false);
          setError(null);
        }
      });
    } catch (error) {
      console.error('Failed to update callbacks:', error);
    }
  }, [options.onDataReceived, options.onAIResultReceived, options.onSpeechResultReceived]);

  // 蓝牙连接
  const connectBluetooth = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const manager = GlobalConnectionManager.getInstance();
      await manager.connectBluetooth();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`蓝牙连接失败: ${errorMessage}`);
      setIsConnecting(false);
    }
  }, [isConnecting]);

  // 串口连接
  const connectSerial = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const manager = GlobalConnectionManager.getInstance();
      await manager.connectSerial();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`串口连接失败: ${errorMessage}`);
      setIsConnecting(false);
    }
  }, [isConnecting]);

  // 断开连接
  const disconnect = useCallback(async () => {
    setError(null);
    
    try {
      const manager = GlobalConnectionManager.getInstance();
      await manager.disconnect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`断开连接失败: ${errorMessage}`);
    }
  }, []);

  // 发送命令
  const sendCommand = useCallback(async (command: string) => {
    setError(null);
    
    try {
      const manager = GlobalConnectionManager.getInstance();
      await manager.sendCommand(command);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`发送命令失败: ${errorMessage}`);
      throw err;
    }
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 刷新连接状态
  const refreshConnectionState = useCallback(() => {
    const manager = GlobalConnectionManager.getInstance();
    const currentState = manager.getConnectionState();
    setConnectionState(currentState);
    manager.requestConnectionState();
  }, []);

  return {
    // 连接状态
    connectionState,
    isConnected: connectionState.isConnected,
    connectionType: connectionState.connectionType,
    deviceName: connectionState.deviceName,
    
    // 浏览器支持
    browserSupport,
    
    // 连接方法
    connectBluetooth,
    connectSerial,
    disconnect,
    sendCommand,
    
    // 状态
    isConnecting,
    error,
    
    // 工具方法
    clearError,
    refreshConnectionState
  };
}

// 简化版Hook，只获取连接状态（轻量级）
export function useConnectionState(): {
  isConnected: boolean;
  connectionType: 'serial' | 'bluetooth' | null;
  deviceName: string | null;
  refreshState: () => void;
} {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    connectionType: null,
    deviceName: null,
    lastUpdate: Date.now()
  });

  useEffect(() => {
    let mounted = true;

    try {
      const manager = GlobalConnectionManager.getInstance();

      // 轻量级回调，只处理状态变化
      manager.setCallbacks({
        onConnectionStateChanged: (state: ConnectionState) => {
          if (mounted) {
            setConnectionState(state);
          }
        }
      });

      // 获取当前状态
      const currentState = manager.getConnectionState();
      if (mounted) {
        setConnectionState(currentState);
      }

      // 延迟请求状态，避免阻塞
      const timeoutId = setTimeout(() => {
        if (mounted) {
          try {
            manager.requestConnectionState();
          } catch (error) {
            console.error('Failed to request connection state:', error);
          }
        }
      }, 200);

      return () => {
        mounted = false;
        clearTimeout(timeoutId);
      };
    } catch (error) {
      console.error('Failed to initialize connection state hook:', error);
      return () => {};
    }
  }, []);

  const refreshState = useCallback(() => {
    try {
      const manager = GlobalConnectionManager.getInstance();
      const currentState = manager.getConnectionState();
      setConnectionState(currentState);
      manager.requestConnectionState();
    } catch (error) {
      console.error('Failed to refresh connection state:', error);
    }
  }, []);

  return {
    isConnected: connectionState.isConnected,
    connectionType: connectionState.connectionType,
    deviceName: connectionState.deviceName,
    refreshState
  };
}
