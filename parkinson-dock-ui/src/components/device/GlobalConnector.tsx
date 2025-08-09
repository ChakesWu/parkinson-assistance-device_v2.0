'use client';

import { useState, useEffect } from 'react';
import { useGlobalConnection } from '@/hooks/useGlobalConnection';
import { SensorData, AIResult } from '@/utils/bluetoothManager';
import { analysisRecordService } from '@/services/analysisRecordService';

export interface GlobalConnectorProps {
  onDataReceived?: (data: Partial<SensorData>) => void;
  showSensorData?: boolean;
  showConnectionControls?: boolean;
  compact?: boolean;
}

export default function GlobalConnector({
  onDataReceived,
  showSensorData = true,
  showConnectionControls = true,
  compact = false
}: GlobalConnectorProps) {
  const [sensorData, setSensorData] = useState<SensorData>({
    fingers: [0, 0, 0, 0, 0],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 }
  });

  const [aiAnalysisData, setAiAnalysisData] = useState({
    analysisCount: 0,
    parkinsonLevel: 0,
    parkinsonDescription: '',
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0,
    isAnalyzing: false
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const {
    connectionState,
    isConnected,
    connectionType,
    deviceName,
    browserSupport,
    connectBluetooth,
    connectSerial,
    disconnect,
    sendCommand,
    isConnecting,
    error,
    clearError
  } = useGlobalConnection({
    onDataReceived: handleDataReceived,
    onAIResultReceived: handleAIResult,
    autoRequestState: !compact // 紧凑模式下不自动请求状态
  });

  // 延迟初始化，避免阻塞页面渲染
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 处理数据接收
  function handleDataReceived(data: SensorData) {
    console.log('🔗 GlobalConnector received data:', data);
    setSensorData(data);
    console.log('📤 GlobalConnector calling onDataReceived callback');
    onDataReceived?.(data);
  }

  // 处理AI结果
  function handleAIResult(result: AIResult) {
    setAiAnalysisData(prev => ({
      ...prev,
      analysisCount: result.analysisCount,
      parkinsonLevel: result.parkinsonLevel,
      confidence: result.confidence,
      isAnalyzing: false
    }));

    // 保存分析记录
    try {
      const record = analysisRecordService.saveRecord({
        analysisCount: result.analysisCount,
        parkinsonLevel: result.parkinsonLevel,
        parkinsonDescription: getParkinsonLevelDescription(result.parkinsonLevel),
        confidence: result.confidence,
        recommendation: getRecommendation(result.parkinsonLevel),
        recommendedResistance: getRecommendedResistance(result.parkinsonLevel),
        sensorData: {
          fingerPositions: sensorData.fingers.map(v => Math.round((v / 1023) * 100)),
          accelerometer: sensorData.accel,
          gyroscope: sensorData.gyro,
          emg: sensorData.emg || 0,
        },
        source: connectionType || 'unknown',
      });
      console.log('全局连接AI分析记录已保存:', record);
    } catch (error) {
      console.error('保存全局连接AI分析记录失败:', error);
    }
  }

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

  // 发送测试命令
  const handleSendCommand = async (command: string) => {
    try {
      await sendCommand(command);
    } catch (error) {
      console.error('发送命令失败:', error);
    }
  };

  if (compact) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <div className="font-medium text-sm">
                {isConnected ? `已连接 (${connectionType})` : '未连接'}
              </div>
              {deviceName && (
                <div className="text-xs text-gray-500">{deviceName}</div>
              )}
            </div>
          </div>

          {showConnectionControls && isInitialized && (
            <div className="flex space-x-2">
              {!isConnected ? (
                <>
                  <button
                    onClick={connectSerial}
                    disabled={isConnecting || !browserSupport.serial}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    串口
                  </button>
                  <button
                    onClick={connectBluetooth}
                    disabled={isConnecting || !browserSupport.bluetooth}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    蓝牙
                  </button>
                </>
              ) : (
                <button
                  onClick={disconnect}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  断开
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs">
            {error}
            <button onClick={clearError} className="ml-2 underline">清除</button>
          </div>
        )}
      </div>
    );
  }

  // 如果还未初始化，显示简单的加载状态
  if (!isInitialized) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">初始化连接管理器...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">全局设备连接</h2>
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
          {error}
          <button onClick={clearError} className="ml-2 underline">清除错误</button>
        </div>
      )}

      {/* 连接状态 */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
          <span>连接状态</span>
          <span className={`font-semibold ${isConnected ? 'text-green-500' : isConnecting ? 'text-yellow-500' : 'text-gray-500'}`}>
            {isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
          </span>
        </div>
        
        {connectionType && (
          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
            <span>连接类型</span>
            <span className="font-semibold">{connectionType === 'serial' ? '串口' : '蓝牙'}</span>
          </div>
        )}
        
        {deviceName && (
          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
            <span>设备名称</span>
            <span className="font-semibold">{deviceName}</span>
          </div>
        )}

        {/* 跨页面状态提示 */}
        {isConnected && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                连接状态已在所有页面间同步
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 连接控制 */}
      {showConnectionControls && (
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold">连接控制</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isConnected ? (
              <>
                <button
                  onClick={connectSerial}
                  disabled={isConnecting || !browserSupport.serial}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
                >
                  {isConnecting ? '连接中...' : '串口连接'}
                  {!browserSupport.serial && <span className="ml-2 text-xs">(不支持)</span>}
                </button>
                
                <button
                  onClick={connectBluetooth}
                  disabled={isConnecting || !browserSupport.bluetooth}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
                >
                  {isConnecting ? '连接中...' : '蓝牙连接'}
                  {!browserSupport.bluetooth && <span className="ml-2 text-xs">(不支持)</span>}
                </button>
              </>
            ) : (
              <button
                onClick={disconnect}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition"
              >
                断开连接
              </button>
            )}
          </div>

          {/* 浏览器支持状态 */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${browserSupport.serial ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>串口: {browserSupport.serial ? '支持' : '不支持'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${browserSupport.bluetooth ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>蓝牙: {browserSupport.bluetooth ? '支持' : '不支持'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 传感器数据 */}
      {showSensorData && isConnected && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">实时传感器数据</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">手指弯曲度</h4>
              {sensorData.fingers.map((value, index) => {
                const percentage = Math.min(100, Math.max(0, (value / 1023) * 100));
                return (
                  <div key={index} className="flex items-center justify-between mb-2">
                    <span className="text-sm">手指{index + 1}:</span>
                    <span className="text-sm font-medium">{Math.round(percentage)}%</span>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">IMU数据</h4>
              <div className="space-y-2 text-sm">
                <div>加速度: X:{sensorData.accel.x.toFixed(2)} Y:{sensorData.accel.y.toFixed(2)} Z:{sensorData.accel.z.toFixed(2)}</div>
                <div>陀螺仪: X:{sensorData.gyro.x.toFixed(2)} Y:{sensorData.gyro.y.toFixed(2)} Z:{sensorData.gyro.z.toFixed(2)}</div>
                {sensorData.emg !== undefined && (
                  <div>EMG: {sensorData.emg.toFixed(0)}</div>
                )}
              </div>
            </div>
          </div>

          {/* AI分析结果 */}
          {aiAnalysisData.analysisCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">最新AI分析结果</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>分析次数: {aiAnalysisData.analysisCount}</div>
                <div>帕金森等级: {aiAnalysisData.parkinsonLevel}</div>
                <div>置信度: {aiAnalysisData.confidence.toFixed(1)}%</div>
                <div>推荐阻力: {getRecommendedResistance(aiAnalysisData.parkinsonLevel)}度</div>
              </div>
            </div>
          )}

          {/* 快速命令 */}
          {isConnected && (
            <div className="space-y-2">
              <h4 className="font-medium">快速命令</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSendCommand('CALIBRATE')}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  校准
                </button>
                <button
                  onClick={() => handleSendCommand('AUTO')}
                  className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  AI分析
                </button>
                <button
                  onClick={() => handleSendCommand('STATUS')}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  状态查询
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
