'use client';

import React, { useState, useRef } from 'react';
import { BluetoothManager, SensorData, AIResult } from '@/utils/bluetoothManager';

export default function BluetoothDebugPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sensorData, setSensorData] = useState<SensorData>({
    fingers: [0, 0, 0, 0, 0],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 },
    emg: 0
  });
  const [aiResult, setAiResult] = useState<AIResult | null>(null);

  const bluetoothManagerRef = useRef<BluetoothManager | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[BLE Debug] ${message}`);
  };

  const initializeBluetoothManager = () => {
    if (!bluetoothManagerRef.current) {
      bluetoothManagerRef.current = new BluetoothManager();
      
      bluetoothManagerRef.current.onDataReceived = (data: SensorData) => {
        setSensorData(data);
        addLog(`数据接收: 手指[${data.fingers.join(',')}] 加速度[${data.accel.x.toFixed(2)},${data.accel.y.toFixed(2)},${data.accel.z.toFixed(2)}]`);
      };

      bluetoothManagerRef.current.onAIResultReceived = (result: AIResult) => {
        setAiResult(result);
        addLog(`AI结果: 等级${result.parkinsonLevel} 置信度${result.confidence}% 分析次数${result.analysisCount}`);
      };

      bluetoothManagerRef.current.onConnectionStatusChanged = (connected: boolean, type: string) => {
        setIsConnected(connected);
        setIsConnecting(false);
        addLog(`连接状态变化: ${connected ? '已连接' : '已断开'} (${type})`);
      };

      addLog('蓝牙管理器初始化完成');
    }
  };

  const connectBluetooth = async () => {
    initializeBluetoothManager();
    setIsConnecting(true);
    setError(null);
    addLog('开始连接蓝牙设备...');

    try {
      await bluetoothManagerRef.current?.connect();
      addLog('蓝牙连接成功!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`蓝牙连接失败: ${errorMessage}`);
      addLog(`蓝牙连接失败: ${errorMessage}`);
      setIsConnecting(false);
    }
  };

  const disconnectBluetooth = async () => {
    try {
      await bluetoothManagerRef.current?.disconnect();
      addLog('蓝牙断开连接');
    } catch (err) {
      addLog(`断开连接失败: ${err}`);
    }
  };

  const sendTestCommand = async (command: string) => {
    try {
      addLog(`发送命令: ${command}`);
      await bluetoothManagerRef.current?.sendCommand(command);
      addLog(`命令发送成功: ${command}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`命令发送失败: ${errorMessage}`);
      setError(`命令发送失败: ${errorMessage}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const checkBrowserSupport = () => {
    const supported = bluetoothManagerRef.current?.isBluetoothSupported() || false;
    addLog(`浏览器蓝牙支持: ${supported ? '支持' : '不支持'}`);
    return supported;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">蓝牙连接调试工具</h1>
        
        {/* 连接控制 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">连接控制</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <button
              onClick={checkBrowserSupport}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition"
            >
              检查浏览器支持
            </button>
            
            {!isConnected ? (
              <button
                onClick={connectBluetooth}
                disabled={isConnecting}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
              >
                {isConnecting ? '连接中...' : '连接蓝牙'}
              </button>
            ) : (
              <button
                onClick={disconnectBluetooth}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition"
              >
                断开连接
              </button>
            )}
            
            <button
              onClick={clearLogs}
              className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition"
            >
              清除日志
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
            <span>连接状态:</span>
            <span className={`font-semibold ${isConnected ? 'text-green-500' : isConnecting ? 'text-yellow-500' : 'text-red-500'}`}>
              {isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* 命令测试 */}
        {isConnected && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">命令测试</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => sendTestCommand('START')}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                START
              </button>
              <button
                onClick={() => sendTestCommand('STOP')}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                STOP
              </button>
              <button
                onClick={() => sendTestCommand('CALIBRATE')}
                className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                CALIBRATE
              </button>
              <button
                onClick={() => sendTestCommand('ANALYZE')}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                ANALYZE
              </button>
              <button
                onClick={() => sendTestCommand('STATUS')}
                className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                STATUS
              </button>
              <button
                onClick={() => sendTestCommand('AUTO')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-3 rounded-lg transition text-sm"
              >
                AUTO
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 传感器数据 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">传感器数据</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium mb-2">手指弯曲度</h3>
                {sensorData.fingers.map((value, index) => (
                  <div key={index} className="flex items-center justify-between mb-1">
                    <span className="text-sm">手指{index + 1}:</span>
                    <span className="font-mono">{value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-medium mb-2">加速度计</h3>
                <div className="text-sm space-y-1">
                  <div>X: {sensorData.accel.x.toFixed(3)}</div>
                  <div>Y: {sensorData.accel.y.toFixed(3)}</div>
                  <div>Z: {sensorData.accel.z.toFixed(3)}</div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">陀螺仪</h3>
                <div className="text-sm space-y-1">
                  <div>X: {sensorData.gyro.x.toFixed(3)}</div>
                  <div>Y: {sensorData.gyro.y.toFixed(3)}</div>
                  <div>Z: {sensorData.gyro.z.toFixed(3)}</div>
                </div>
              </div>
              {sensorData.emg !== undefined && (
                <div>
                  <h3 className="font-medium mb-2">EMG</h3>
                  <div className="text-sm">{sensorData.emg.toFixed(0)}</div>
                </div>
              )}
            </div>
          </div>

          {/* 调试日志 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">调试日志</h2>
            <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">暂无日志...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI结果 */}
        {aiResult && (
          <div className="mt-6 bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">AI分析结果</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{aiResult.parkinsonLevel}</div>
                <div className="text-sm text-gray-600">帕金森等级</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{aiResult.confidence.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">置信度</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{aiResult.analysisCount}</div>
                <div className="text-sm text-gray-600">分析次数</div>
              </div>
              {aiResult.recommendedResistance && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">{aiResult.recommendedResistance}°</div>
                  <div className="text-sm text-gray-600">推荐阻力</div>
                </div>
              )}
            </div>
            {aiResult.recommendation && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-medium text-blue-800 dark:text-blue-200">训练建议:</div>
                <div className="text-blue-700 dark:text-blue-300">{aiResult.recommendation}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
