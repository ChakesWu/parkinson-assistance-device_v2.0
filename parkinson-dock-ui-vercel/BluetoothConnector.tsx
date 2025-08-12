'use client';

import { useState, useEffect, useRef } from 'react';
import { BluetoothManager, SensorData, AIResult } from '@/utils/bluetoothManager';
import { analysisRecordService, AnalysisRecord } from '@/services/analysisRecordService';
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

  // 初始化相关状态
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [fingerBaselines, setFingerBaselines] = useState<number[]>([0, 0, 0, 0, 0]);

  // 電位器方向設置
  const [potentiometerReversed, setPotentiometerReversed] = useState(false);

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

  // 訓練確認彈窗
  const [showTrainingConfirm, setShowTrainingConfirm] = useState(false);

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
      // 取消订阅分析记录事件
      unsubscribe?.();
    };
  }, []);

  // 订阅本地/web分析保存事件：当来源为 web-analysis 时也弹出训练确认
  const unsubscribeRef = useRef<() => void | null>(null);
  const unsubscribe = unsubscribeRef.current as (() => void) | null;
  useEffect(() => {
    const off = analysisRecordService.subscribe((record: AnalysisRecord) => {
      try {
        if (record.source === 'web-analysis') {
          // 同步到页面的 AI 状态（用于弹窗显示文案）
          setAiAnalysisData(prev => ({
            ...prev,
            analysisCount: record.analysisCount,
            parkinsonLevel: record.parkinsonLevel,
            parkinsonDescription: record.parkinsonDescription,
            confidence: record.confidence,
            recommendation: record.recommendation,
            recommendedResistance: record.recommendedResistance,
            isAnalyzing: false
          }));
          setShowTrainingConfirm(true);
        }
      } catch (e) {
        console.error('订阅 web-analysis 触发训练弹窗失败', e);
      }
    });
    unsubscribeRef.current = off;
    return () => { try { off?.(); } catch {} };
  }, []);

  // 检查浏览器是否支持Web Bluetooth API
  const isBluetoothSupported = () => {
    return bluetoothManagerRef.current?.isBluetoothSupported() || false;
  };

  // 处理数据接收
  const handleDataReceived = (data: SensorData) => {
    // 调整手指方向
    const processedData = adjustFingerDirection(data);

    setSensorData(processedData);
    onDataReceived?.(processedData);
    console.log('蓝牙数据接收:', processedData);
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

    // AI 完成後彈出訓練確認
    setShowTrainingConfirm(true);
  };

  // 处理连接状态变化
  const handleConnectionStatusChanged = (connected: boolean, type: string) => {
    setIsConnected(connected);
    setIsConnecting(false);

    if (connected) {
      const status = bluetoothManagerRef.current?.getConnectionStatus();
      setDeviceName(status?.deviceName || null);
      setError(null);

      // 蓝牙重连后重置初始化状态并开始新的初始化
      console.log('🔄 蓝牙设备已连接，开始重新初始化...');
      console.log('📋 请确保手指完全伸直，准备进行基线校准');

      setIsInitializing(false);
      setInitializationComplete(false);
      setFingerBaselines([0, 0, 0, 0, 0]);

      // 延迟开始初始化，确保连接稳定
      setTimeout(() => {
        startWebInitialization();
      }, 1000);

    } else {
      setDeviceName(null);
      setIsInitializing(false);
      setInitializationComplete(false);
      setFingerBaselines([0, 0, 0, 0, 0]);
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

  // 網頁端初始化函數
  const startWebInitialization = () => {
    console.log('🔄 开始蓝牙端手指基线初始化...');
    console.log('📋 请保持手指完全伸直，3秒后开始收集基线数据');

    setIsInitializing(true);
    setInitializationComplete(false);

    // 3秒倒计时
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      console.log(`⏰ 倒计时: ${countdown} 秒...`);
      countdown--;
      if (countdown < 0) {
        clearInterval(countdownInterval);
        collectBaseline();
      }
    }, 1000);
  };

  // 收集基线数据
  const collectBaseline = () => {
    console.log('📊 开始收集手指伸直基线数据...');

    const baselineData: number[][] = [[], [], [], [], []]; // 5个手指的数据收集
    const sampleCount = 30; // 收集30个样本（约3秒）
    let currentSample = 0;

    const collectInterval = setInterval(() => {
      if (sensorData && currentSample < sampleCount) {
        // 收集当前的原始数据作为基线
        sensorData.fingers.forEach((value, index) => {
          baselineData[index].push(value);
        });

        currentSample++;
        console.log(`📈 收集进度: ${currentSample}/${sampleCount}`);

      } else if (currentSample >= sampleCount) {
        clearInterval(collectInterval);

        // 计算平均基线值
        const newBaselines = baselineData.map(fingerData => {
          const sum = fingerData.reduce((a, b) => a + b, 0);
          return sum / fingerData.length;
        });

        setFingerBaselines(newBaselines);
        setIsInitializing(false);
        setInitializationComplete(true);

        console.log('✅ 蓝牙端初始化完成！');
        console.log('📊 手指伸直基线值:', newBaselines);
        console.log('🎯 3D模型已重置为伸直状态');
        console.log('👆 现在可以开始手指弯曲检测');

        // 通知3D模型重置为伸直状态
        onDataReceived?.({
          fingers: [0, 0, 0, 0, 0], // 重置为伸直状态
          accel: { x: 0, y: 0, z: 0 },
          gyro: { x: 0, y: 0, z: 0 },
          mag: { x: 0, y: 0, z: 0 }
        });
      }
    }, 100); // 每100ms收集一次
  };

  // 调整手指方向 - 直接反轉數據
  const adjustFingerDirection = (data: SensorData): SensorData => {
    const adjustedFingers = data.fingers.map((value, index) => {
      let adjustedValue = value;

      // 如果設置為反向電位器，將彎曲度反轉
      if (potentiometerReversed) {
        // 假設正常情況下，彎曲度範圍是0-200
        // 反轉公式：新值 = 最大值 - 原值
        const maxValue = 200;
        adjustedValue = Math.max(0, maxValue - value);
      }

      // 小拇指敏感度增强 (index 4 是小拇指)
      if (index === 4) {
        return adjustedValue * 1.5; // 增加50%敏感度
      }

      return adjustedValue;
    });

    return {
      ...data,
      fingers: adjustedFingers
    };
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

      {/* 電位器方向設置 */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
        <h3 className="text-sm font-medium mb-2">電位器設置</h3>
        <div className="flex items-center space-x-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={potentiometerReversed}
              onChange={(e) => setPotentiometerReversed(e.target.checked)}
              className="sr-only"
            />
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              potentiometerReversed ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                potentiometerReversed ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
            <span className="ml-3 text-sm">
              反向電位器 {potentiometerReversed ? '(減少=彎曲)' : '(增加=彎曲)'}
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          如果手指彎曲方向相反，請開啟此選項
        </p>
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
              onClick={() => sendCommand('AUTO')}
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

      {/* 訓練確認彈窗 */}
      {showTrainingConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 w-full max-w-md shadow-lg">
            <h4 className="text-lg font-semibold mb-3">開始 20 秒阻力訓練？</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              AI 建議等級：{aiAnalysisData.parkinsonLevel}，建議阻力：{getRecommendedResistance(aiAnalysisData.parkinsonLevel)}°
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200 dark:bg-neutral-700" onClick={() => setShowTrainingConfirm(false)}>取消</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white"
                onClick={() => {
                  const level = Math.max(1, Math.min(5, aiAnalysisData.parkinsonLevel || 2));
                  sendCommand(`TRAIN_SERVO,20000,0,${level}`);
                  setShowTrainingConfirm(false);
                }}
              >
                開始訓練
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
