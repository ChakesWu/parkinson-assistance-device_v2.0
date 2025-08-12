'use client';

import { useState, useEffect } from 'react';
import { useConnectionState } from '@/hooks/useGlobalConnection';

export interface ConnectionIndicatorProps {
  showDetails?: boolean;
  className?: string;
  lazy?: boolean; // 是否延迟加载
}

export default function ConnectionIndicator({
  showDetails = false,
  className = '',
  lazy = true
}: ConnectionIndicatorProps) {
  const [isLoaded, setIsLoaded] = useState(!lazy);
  const { isConnected, connectionType, deviceName, refreshState } = useConnectionState();

  // 延迟加载，避免阻塞页面渲染
  useEffect(() => {
    if (lazy) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
      }, 500); // 延迟500ms加载

      return () => clearTimeout(timer);
    }
  }, [lazy]);

  if (!isLoaded) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        <span className="text-sm text-gray-400">加载中...</span>
      </div>
    );
  }

  if (!showDetails) {
    // 简单的状态指示器
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div 
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? '设备已连接' : '设备未连接'}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isConnected ? '已连接' : '未连接'}
        </span>
      </div>
    );
  }

  // 详细的状态显示
  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg p-3 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <div className="text-sm font-medium">
              {isConnected ? '设备已连接' : '设备未连接'}
            </div>
            {isConnected && connectionType && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {connectionType === 'serial' ? '串口连接' : '蓝牙连接'}
                {deviceName && ` - ${deviceName}`}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={refreshState}
          className="text-xs text-blue-500 hover:text-blue-600 underline"
          title="刷新连接状态"
        >
          刷新
        </button>
      </div>
      
      {isConnected && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
          ✓ 连接状态已在所有页面间同步
        </div>
      )}
    </div>
  );
}
