'use client';

import { useState, useEffect } from 'react';
import ArduinoConnector from './ArduinoConnector';
import BluetoothConnector from './BluetoothConnector';

interface SensorData {
  fingers: number[];
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  mag: { x: number; y: number; z: number };
  emg?: number;
}

export interface UnifiedConnectorProps {
  onDataReceived?: (data: Partial<SensorData>) => void;
}

type ConnectionMode = 'serial' | 'bluetooth';

export default function UnifiedConnector({ onDataReceived }: UnifiedConnectorProps) {
  // 默认改为蓝牙，适配 Android Chrome 移动端
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('bluetooth');
  const [isAnyConnected, setIsAnyConnected] = useState(false);
  const [browserSupport, setBrowserSupport] = useState({
    serial: false,
    bluetooth: false
  });

  // 检查浏览器支持情况
  useEffect(() => {
    const checkSupport = () => {
      const serialSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serial' in navigator;
      const bluetoothSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'bluetooth' in navigator;

      setBrowserSupport({
        serial: serialSupported,
        bluetooth: bluetoothSupported
      });

      // 如果当前模式不支持，自动切换到支持的模式
      if (connectionMode === 'serial' && !serialSupported && bluetoothSupported) {
        setConnectionMode('bluetooth');
      } else if (connectionMode === 'bluetooth' && !bluetoothSupported && serialSupported) {
        setConnectionMode('serial');
      }
    };

    checkSupport();
  }, [connectionMode]);

  // 处理数据接收
  const handleDataReceived = (data: Partial<SensorData>) => {
    onDataReceived?.(data);
  };

  // 切换连接模式
  const switchConnectionMode = (mode: ConnectionMode) => {
    if (isAnyConnected) {
      alert('请先断开当前连接再切换模式');
      return;
    }

    if (mode === 'serial' && !browserSupport.serial) {
      alert('您的浏览器不支持串口连接，请使用Chrome或Edge浏览器');
      return;
    }

    if (mode === 'bluetooth' && !browserSupport.bluetooth) {
      alert('您的浏览器不支持蓝牙连接，请使用Chrome或Edge浏览器');
      return;
    }

    setConnectionMode(mode);
  };

  // 监听连接状态变化
  const handleConnectionStatusChange = (connected: boolean) => {
    setIsAnyConnected(connected);
  };

  return (
    <div className="space-y-6">
      {/* 连接模式选择器 */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">连接方式选择</h3>
        
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => switchConnectionMode('serial')}
            disabled={!browserSupport.serial || isAnyConnected}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              connectionMode === 'serial'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            } ${
              !browserSupport.serial || isAnyConnected
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            串口连接
            {!browserSupport.serial && (
              <span className="ml-2 text-xs">(不支持)</span>
            )}
          </button>
          
          <button
            onClick={() => switchConnectionMode('bluetooth')}
            disabled={!browserSupport.bluetooth || isAnyConnected}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              connectionMode === 'bluetooth'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            } ${
              !browserSupport.bluetooth || isAnyConnected
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            蓝牙连接
            {!browserSupport.bluetooth && (
              <span className="ml-2 text-xs">(不支持)</span>
            )}
          </button>
        </div>

        {/* 浏览器支持状态提示 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${browserSupport.serial ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>串口连接: {browserSupport.serial ? '支持' : '不支持'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${browserSupport.bluetooth ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>蓝牙连接: {browserSupport.bluetooth ? '支持' : '不支持'}</span>
            </div>
          </div>
          
          {(!browserSupport.serial || !browserSupport.bluetooth) && (
            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200">
                建议使用 Chrome 89+ 或 Edge 89+ 浏览器以获得完整功能支持
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 连接器组件 */}
      {connectionMode === 'serial' ? (
        <div>
          <ArduinoConnector 
            onDataReceived={handleDataReceived}
          />
        </div>
      ) : (
        <div>
          <BluetoothConnector 
            onDataReceived={handleDataReceived}
          />
        </div>
      )}

      {/* 连接状态监听 */}
      <div className="hidden">
        {connectionMode === 'serial' && (
          <ArduinoConnector 
            onDataReceived={(data) => {
              handleDataReceived(data);
              // 这里可以添加连接状态监听逻辑
            }}
          />
        )}
        {connectionMode === 'bluetooth' && (
          <BluetoothConnector 
            onDataReceived={(data) => {
              handleDataReceived(data);
              // 这里可以添加连接状态监听逻辑
            }}
          />
        )}
      </div>
    </div>
  );
}
