'use client';

import { useState, useEffect, useRef } from 'react';
import { BluetoothManager, SensorData, AIResult } from '@/utils/bluetoothManager';
import { analysisRecordService } from '@/services/analysisRecordService';

export interface BluetoothConnectorProps {
  onDataReceived?: (data: Partial<SensorData>) => void;
}

export default function BluetoothConnector({ onDataReceived }: BluetoothConnectorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({
    fingers: [0, 0, 0, 0, 0],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 }
  });
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  
  const bluetoothManagerRef = useRef<BluetoothManager | null>(null);

  // AI分析结果状态
  const [aiAnalysisData, setAiAnalysisData] = useState({
    analysisCount: 0,
    parkinsonLevel: 0,
    parkinsonDescription: '',
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0,
    isAnalyzing: false
  });

  // 初始化蓝牙管理器
  useEffect(() => {
    bluetoothManagerRef.current = new BluetoothManager();
    
    // 设置回调函数
    bluetoothManagerRef.current.onDataReceived = handleDataReceived;
    bluetoothManagerRef.current.onAIResultReceived = handleAIResult;
    bluetoothManagerRef.current.onConnectionStatusChanged = handleConnectionStatusChanged;

    return () => {
      if (bluetoothManagerRef.current?.getConnectionStatus().isConnected) {
        bluetoothManagerRef.current.disconnect();
      }
    };
  }, []);

  // 检查浏览器是否支持Web Bluetooth API
  const isBluetoothSupported = () => {
    return bluetoothManagerRef.current?.isBluetoothSupported() || false;
  };

  // 处理数据接收
  const handleDataReceived = (data: SensorData) => {
    setSensorData(data);
    onDataReceived?.(data);
    console.log('蓝牙数据接收:', data);
  };

  // 处理AI结果
  const handleAIResult = (result: AIResult) => {
    setAiAnalysisData(prev => ({
      ...prev,
      analysisCount: result.analysisCount,
      parkinsonLevel: result.parkinsonLevel,
      parkinsonDescription: result.parkinsonDescription || getParkinsonLevelDescription(result.parkinsonLevel),
      confidence: result.confidence,
      recommendation: result.recommendation || getRecommendation(result.parkinsonLevel),
      recommendedResistance: result.recommendedResistance || getRecommendedResistance(result.parkinsonLevel),
      isAnalyzing: false
    }));

    // 注意：AI分析记录的保存现在由BluetoothManager处理，避免重复保存
    console.log('蓝牙AI分析结果已接收:', result);
  };

  // 处理连接状态变化
  const handleConnectionStatusChanged = (connected: boolean, type: string) => {
    setIsConnected(connected);
    setIsConnecting(false);
    
    if (connected) {
      const status = bluetoothManagerRef.current?.getConnectionStatus();
      setDeviceName(status?.deviceName || null);
      setError(null);
    } else {
      setDeviceName(null);
      setSensorData({
        fingers: [0, 0, 0, 0, 0],
        accel: { x: 0, y: 0, z: 0 },
        gyro: { x: 0, y: 0, z: 0 },
        mag: { x: 0, y: 0, z: 0 }
      });
    }
  };

  // 连接蓝牙设备
  const connectToBluetooth = async () => {
    if (!isBluetoothSupported()) {
      setError('您的瀏覽器不支持Web Bluetooth API，請使用Chrome或Edge瀏覽器');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await bluetoothManagerRef.current?.connect();
    } catch (err) {
      console.error('蓝牙连接错误:', err);
      setError(`蓝牙连接失败: ${(err as Error).message}`);
      setIsConnecting(false);
    }
  };

  // 断开蓝牙连接
  const disconnectBluetooth = async () => {
    try {
      await bluetoothManagerRef.current?.disconnect();
    } catch (err) {
      console.error('断开蓝牙连接错误:', err);
    }
  };

  // 发送命令
  const sendCommand = async (command: string) => {
    try {
      await bluetoothManagerRef.current?.sendCommand(command);
    } catch (err) {
      setError(`发送命令失败: ${(err as Error).message}`);
    }
  };

  // 获取帕金森等级描述
  const getParkinsonLevelDescription = (level: number): string => {
    switch (level) {
      case 1: return 'Normal';
      case 2: return 'Mild';
      case 3: return 'Moderate';
      case 4: return 'Severe';
      case 5: return 'Very Severe';
      default: return 'Unknown';
    }
  };

  // 获取训练建议
  const getRecommendation = (level: number): string => {
    switch (level) {
      case 1: return 'Maintain current training intensity';
      case 2: return 'Increase finger flexibility training';
      case 3: return 'Perform resistance training';
      case 4: return 'Seek professional guidance';
      case 5: return 'Seek immediate medical attention';
      default: return 'Unknown';
    }
  };

  // 获取推荐阻力
  const getRecommendedResistance = (level: number): number => {
    return Math.round(30 + (level - 1) * 30); // 30-150度范围
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className={`p-4 rounded-full mb-4 ${isConnected ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${isConnected ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">蓝牙连接</h2>
        <p className="text-gray-600 dark:text-gray-300">ParkinsonDevice v2.0</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
          <span>连接状态</span>
          <span className={`font-semibold ${isConnected ? 'text-blue-500' : isConnecting ? 'text-yellow-500' : 'text-gray-500'}`}>
            {isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
          </span>
        </div>
        
        {deviceName && (
          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
            <span>设备名称</span>
            <span className="font-semibold">{deviceName}</span>
          </div>
        )}
      </div>
      
      <div className="mt-8 grid grid-cols-2 gap-4">
        {!isConnected ? (
          <button
            onClick={connectToBluetooth}
            disabled={isConnecting || !isBluetoothSupported()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
          >
            {isConnecting ? '连接中...' : '连接蓝牙设备'}
          </button>
        ) : (
          <button
            onClick={disconnectBluetooth}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition"
          >
            断开连接
          </button>
        )}

        <button
          className={`bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isConnected}
          onClick={() => sendCommand('START')}
        >
          开始数据采集
        </button>
      </div>

      {/* 控制命令按钮 */}
      {isConnected && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">设备控制</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => sendCommand('STOP')}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg transition text-sm"
            >
              停止采集
            </button>
            <button
              onClick={() => sendCommand('CALIBRATE')}
              className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 rounded-lg transition text-sm"
            >
              校准传感器
            </button>
            <button
              onClick={() => sendCommand('ANALYZE')}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg transition text-sm"
            >
              AI分析
            </button>
            <button
              onClick={() => sendCommand('STATUS')}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg transition text-sm"
            >
              查询状态
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">即时传感器数据</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">手指弯曲度</h4>
              {sensorData.fingers.map((value, index) => {
                const percentage = Math.min(100, Math.max(0, (value / 1023) * 100));
                const displayValue = Math.round(percentage);

                return (
                  <div key={index} className="flex items-center justify-between mb-2">
                    <span className="text-sm">手指{index + 1}:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${displayValue}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-10">{displayValue}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">加速度计 (g)</h4>
              <div className="space-y-2">
                <div>X: {sensorData.accel.x.toFixed(2)}</div>
                <div>Y: {sensorData.accel.y.toFixed(2)}</div>
                <div>Z: {sensorData.accel.z.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">陀螺仪 (deg/s)</h4>
              <div className="space-y-2">
                <div>X: {sensorData.gyro.x.toFixed(2)}</div>
                <div>Y: {sensorData.gyro.y.toFixed(2)}</div>
                <div>Z: {sensorData.gyro.z.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* AI分析状态显示 */}
          {(aiAnalysisData.analysisCount > 0 || aiAnalysisData.isAnalyzing) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">AI分析结果</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">分析状态</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>分析次数:</span>
                      <span className="font-medium">{aiAnalysisData.analysisCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>状态:</span>
                      <span className={`font-medium ${aiAnalysisData.isAnalyzing ? 'text-blue-600' : 'text-green-600'}`}>
                        {aiAnalysisData.isAnalyzing ? '分析中...' : '已完成'}
                      </span>
                    </div>
                  </div>
                </div>

                {aiAnalysisData.parkinsonLevel > 0 && (
                  <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">分析结果</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>等级:</span>
                        <span className="font-medium">{aiAnalysisData.parkinsonLevel} ({getParkinsonLevelDescription(aiAnalysisData.parkinsonLevel)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>置信度:</span>
                        <span className="font-medium">{aiAnalysisData.confidence.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>建议阻力:</span>
                        <span className="font-medium">{getRecommendedResistance(aiAnalysisData.parkinsonLevel)}度</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {aiAnalysisData.parkinsonLevel > 0 && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">训练建议</h4>
                  <p className="text-blue-700 dark:text-blue-300">{getRecommendation(aiAnalysisData.parkinsonLevel)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
