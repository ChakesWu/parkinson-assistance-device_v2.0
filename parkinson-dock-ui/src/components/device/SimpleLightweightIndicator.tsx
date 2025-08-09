'use client';

import { useLightweightConnection } from '@/utils/lightweightConnectionManager';

export interface SimpleLightweightIndicatorProps {
  className?: string;
}

export default function SimpleLightweightIndicator({ 
  className = '' 
}: SimpleLightweightIndicatorProps) {
  const { isConnected, connectionType } = useLightweightConnection();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {isConnected ? `已连接 (${connectionType})` : '未连接'}
      </span>
    </div>
  );
}
