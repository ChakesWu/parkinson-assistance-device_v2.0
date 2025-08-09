'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { BrainCircuit, Home, Activity, Book, Settings, Brain } from 'lucide-react';
import { getRecommendations, classifySeverity } from '@/lib/ai/recommendations';
import { analysisRecordService } from '@/services/analysisRecordService';
import { useGlobalConnection } from '@/hooks/useGlobalConnection';
import GlobalConnector from '@/components/device/GlobalConnector';
import { SensorData, AIResult } from '@/utils/bluetoothManager';

type SerialPortLike = any;

export default function AIAnalysisPage() {
  const [prediction, setPrediction] = useState<number | null>(null);
  const [analysisData, setAnalysisData] = useState({
    analysisCount: 0,
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sensorData, setSensorData] = useState({
    fingerPositions: [0, 0, 0, 0, 0],
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    emg: 0,
  });
  const [modelSeverity, setModelSeverity] = useState<number | null>(null); // 0..100 由設備/CNN/LSTM 提供
  const [groups, setGroups] = useState<ReturnType<typeof getRecommendations>>([]);

  // 連線/採集狀態
  const [isCollecting, setIsCollecting] = useState(false);
  const lineBufferRef = useRef<string>('');

  // 使用全局连接管理器
  const {
    isConnected,
    connectionType,
    deviceName,
    sendCommand,
    error: connectionError
  } = useGlobalConnection({
    onDataReceived: handleGlobalDataReceived,
    onAIResultReceived: handleGlobalAIResult
  });

  // 10秒資料緩存
  const sessionStartRef = useRef<number | null>(null);
  const fingerSeriesRef = useRef<number[][]>([[], [], [], [], []]);
  const accelSeriesRef = useRef<{ x: number[]; y: number[]; z: number[] }>({ x: [], y: [], z: [] });
  const emgSeriesRef = useRef<number[]>([]);
  const tsSeriesRef = useRef<number[]>([]);

  // 動態按鈕配置
  const dockItems = [
    { link: "/", Icon: <Home size={22} /> },
    { link: "/device", Icon: <Activity size={22} /> },
    { link: "/records", Icon: <Book size={22} /> },
    { link: "/ai-analysis", Icon: <Brain size={22} /> },
    { link: "/settings", Icon: <Settings size={22} /> },
  ];

  // 处理全局连接的数据接收
  function handleGlobalDataReceived(data: SensorData) {
    // 更新传感器数据显示
    setSensorData({
      fingerPositions: data.fingers.map(v => Math.round((v / 1023) * 100)),
      accelerometer: data.accel,
      gyroscope: data.gyro,
      emg: data.emg || 0,
    });

    // 如果正在采集，添加到时间序列
    if (isCollecting) {
      const now = performance.now();
      tsSeriesRef.current.push(now);

      for (let i = 0; i < 5; i++) {
        fingerSeriesRef.current[i].push(data.fingers[i] ?? 0);
      }

      accelSeriesRef.current.x.push(data.accel.x ?? 0);
      accelSeriesRef.current.y.push(data.accel.y ?? 0);
      accelSeriesRef.current.z.push(data.accel.z ?? 0);
      emgSeriesRef.current.push(data.emg ?? 0);
    }
  }

  // 处理全局连接的AI结果
  function handleGlobalAIResult(result: AIResult) {
    const severity = (result.parkinsonLevel / 5) * 100; // 转换为0-100范围
    const { stage, confidencePercent } = classifySeverity(severity);

    setPrediction(severity);
    const newAnalysisData = {
      analysisCount: result.analysisCount,
      confidence: result.confidence,
      recommendation: `AI分析结果: ${stage}`,
      recommendedResistance: Math.round(30 + (result.parkinsonLevel - 1) * 30),
    };
    setAnalysisData(newAnalysisData);
    setGroups(getRecommendations(severity));
    setIsCollecting(false);
  }

  // 監聽父頁提供的資料（可選）
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sensorData') {
        const p = event.data.payload;
        setSensorData(prev => ({
          fingerPositions: p.fingerPositions ?? prev.fingerPositions,
          accelerometer: p.accelerometer ?? prev.accelerometer,
          gyroscope: p.gyroscope ?? prev.gyroscope,
          emg: p.emg ?? prev.emg,
        }));
      }
      if (event.data.type === 'modelPrediction') {
        const sv = Math.max(0, Math.min(100, Number(event.data.payload?.severityPercent)));
        if (!Number.isNaN(sv)) setModelSeverity(sv);
        if (event.data.payload?.confidence) {
          setAnalysisData(prev => ({ ...prev, confidence: event.data.payload.confidence }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'requestSensorData' }, '*');
    window.parent.postMessage({ type: 'requestModelPrediction' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 简化的连接状态显示（使用全局连接管理器）
  const getConnectionStatusText = () => {
    if (!isConnected) return '未连接';
    return `已连接 (${connectionType === 'serial' ? '串口' : '蓝牙'})`;
  };

  // 测试记录保存功能
  const testRecordSaving = () => {
    try {
      const testRecord = analysisRecordService.saveRecord({
        analysisCount: 999,
        parkinsonLevel: 2,
        parkinsonDescription: '測試記錄',
        confidence: 85.5,
        recommendation: '這是一個測試記錄',
        recommendedResistance: 45,
        sensorData: {
          fingerPositions: [45, 52, 38, 41, 49],
          accelerometer: { x: 0.12, y: -0.34, z: 0.98 },
          gyroscope: { x: 1.2, y: -0.8, z: 0.3 },
          emg: 234,
        },
        source: 'web-analysis',
        duration: 10,
      });
      console.log('測試記錄已保存:', testRecord);
      alert('測試記錄已保存，請檢查 Records 頁面');
    } catch (error) {
      console.error('測試記錄保存失敗:', error);
      alert('測試記錄保存失敗');
    }
  };

  // 发送命令（使用全局连接管理器）
  const handleSendCommand = async (cmd: string) => {
    try {
      await sendCommand(cmd);
    } catch (error) {
      console.error('发送命令失败:', error);
    }
  };

  // 解析 DATA 行（支援 16 欄或 10 欄）
  const parseDataLine = (trimmed: string) => {
    if (!trimmed.startsWith('DATA,')) return null;
    const parts = trimmed.substring(5).split(',');
    const nums = parts.map(v => parseFloat(v));
    if (nums.length >= 15) {
      const fingers = nums.slice(0, 5).map(v => Math.max(0, Math.min(1023, v)));
      const emg = nums[5] ?? 0;
      const accel = { x: nums[6], y: nums[7], z: nums[8] };
      // 可選：gyro/mag 若存在
      const gyro = {
        x: nums[9] ?? 0,
        y: nums[10] ?? 0,
        z: nums[11] ?? 0,
      };
      return { fingers, emg, accel, gyro };
    } else if (nums.length >= 9) {
      const fingers = nums.slice(0, 5).map(v => Math.max(0, Math.min(1023, v)));
      const emg = nums[5] ?? 0;
      const accel = { x: nums[6], y: nums[7], z: nums[8] };
      const gyro = { x: 0, y: 0, z: 0 };
      return { fingers, emg, accel, gyro };
    }
    return null;
  };

  // 開始 10 秒採集與分析
  const startTenSecondAnalysis = async () => {
    if (!isConnected) {
      alert('请先连接设备');
      return;
    }

    setIsLoading(true);
    setPrediction(null);
    setGroups([]);

    // 清空序列
    fingerSeriesRef.current = [[], [], [], [], []];
    accelSeriesRef.current = { x: [], y: [], z: [] };
    emgSeriesRef.current = [];
    tsSeriesRef.current = [];

    try {
      // 启动设备采集
      await handleSendCommand('START');
      setIsCollecting(true);
      sessionStartRef.current = performance.now();

      // 等待 10 秒采集数据
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 停止采集
      setIsCollecting(false);
      await handleSendCommand('STOP');
    } catch (e) {
      console.error('採集失敗', e);
      setIsCollecting(false);
    }

    // 計算結果
    try {
      const res = computeFinalAssessment();
      const severity = res.overallSeverity;
      const { stage, confidencePercent } = classifySeverity(severity);

      // 建議阻力
      let recommendedResistance = 20;
      if (severity >= 70) recommendedResistance = 60;
      else if (severity >= 40) recommendedResistance = 40;

      setPrediction(severity);
      const newAnalysisData = {
        analysisCount: analysisData.analysisCount + 1,
        confidence: analysisData.confidence || confidencePercent,
        recommendation: res.summary,
        recommendedResistance,
      };
      setAnalysisData(newAnalysisData);
      setGroups(getRecommendations(severity));

      // 保存分析记录
      try {
        // 计算帕金森等级 (0-100 severity -> 0-5 level)
        const parkinsonLevel = Math.min(5, Math.max(0, Math.round(severity / 20)));

        console.log('準備保存分析記錄:', {
          severity,
          parkinsonLevel,
          stage,
          confidencePercent,
          analysisCount: newAnalysisData.analysisCount
        });

        const record = analysisRecordService.saveRecord({
          analysisCount: newAnalysisData.analysisCount,
          parkinsonLevel,
          parkinsonDescription: stage,
          confidence: confidencePercent,
          recommendation: res.summary,
          recommendedResistance,
          sensorData: {
            fingerPositions: sensorData.fingerPositions,
            accelerometer: sensorData.accelerometer,
            gyroscope: sensorData.gyroscope,
            emg: sensorData.emg,
          },
          analysisDetails: {
            tremorFrequency: res.tremorHz,
            graspQuality: res.graspQualityPerFinger?.[2], // 中指的抓握质量
            emgRms: res.emgRms,
            overallSeverity: severity,
            fingerSummary: res.fingerSummary,
            tremorSummary: res.tremorSummary,
            emgSummary: res.emgSummary,
          },
          source: 'web-analysis',
          // 使用 computeFinalAssessment 計算期間的時長估計（採集設計為 10 秒）
          duration: 10,
        });
        console.log('分析記錄已成功保存:', record);
      } catch (error) {
        console.error('保存分析記錄失敗:', error);
      }
    } catch (e) {
      console.error('分析計算失敗', e);
      setPrediction(null);
    }

    setIsLoading(false);
  };

  // 計算：手指抓握、震顫頻率、EMG 等級與總嚴重度
  const computeFinalAssessment = () => {
    const durationSec = Math.max(0.001, (tsSeriesRef.current.at(-1)! - (sessionStartRef.current ?? tsSeriesRef.current[0]!)) / 1000);

    // 手指抓握評估：看每指的幅度與循環次數（用閾值過零次數近似）
    const graspCyclesPerFinger: number[] = [];
    const graspQualityPerFinger: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = fingerSeriesRef.current[i] ?? [];
      if (s.length === 0) { graspCyclesPerFinger.push(0); graspQualityPerFinger.push(0); continue; }
      const maxV = Math.max(...s);
      const minV = Math.min(...s);
      const amp = maxV - minV; // 0..1023
      const thr = minV + amp * 0.6; // 高位閾值
      let cycles = 0;
      let prevAbove = s[0] > thr;
      for (let k = 1; k < s.length; k++) {
        const above = s[k] > thr;
        if (above && !prevAbove) cycles++;
        prevAbove = above;
      }
      graspCyclesPerFinger.push(cycles);
      graspQualityPerFinger.push(Math.max(0, Math.min(100, (amp / 1023) * 100)));
    }

    // 震顫頻率：使用加速度向量模長去均值後的過零估計
    const ax = accelSeriesRef.current.x, ay = accelSeriesRef.current.y, az = accelSeriesRef.current.z;
    const n = Math.min(ax.length, ay.length, az.length);
    const mag: number[] = [];
    for (let i = 0; i < n; i++) mag.push(Math.sqrt(ax[i] * ax[i] + ay[i] * ay[i] + az[i] * az[i]));
    const mean = mag.reduce((a, b) => a + b, 0) / Math.max(1, mag.length);
    const hp = mag.map(v => v - mean);
    let zc = 0;
    for (let i = 1; i < hp.length; i++) {
      if ((hp[i - 1] <= 0 && hp[i] > 0) || (hp[i - 1] >= 0 && hp[i] < 0)) zc++;
    }
    const tremorHz = Math.max(0, (zc / 2) / Math.max(0.001, durationSec));

    // EMG：RMS
    const emg = emgSeriesRef.current;
    const emgRms = Math.sqrt(emg.reduce((a, b) => a + b * b, 0) / Math.max(1, emg.length));

    // 等級判定（簡化規則，實務可由 CNN/LSTM 提供）
    // tremor: 4-6Hz 常見；若 >=3Hz 且幅度明顯，權重提升
    let tremorScore = 0;
    if (tremorHz >= 3 && tremorHz <= 7) tremorScore = 70; else if (tremorHz > 7) tremorScore = 40; else tremorScore = 20;
    // grasp：取中值手指的質量與循環次數
    const midIdx = 2;
    const graspScore = 100 - Math.max(0, 60 - graspQualityPerFinger[midIdx]) - Math.max(0, 3 - graspCyclesPerFinger[midIdx]) * 10;
    // emg：相對幅度（此處僅示意，實務應用校準基線）
    const emgScore = Math.min(100, (emgRms / 512) * 100);

    const overallSeverity = Math.max(0, Math.min(100, 0.5 * tremorScore + 0.3 * (100 - graspScore) + 0.2 * emgScore));

    // 文案
    const fingerSummary = `抓握循環(中指)≈${graspCyclesPerFinger[midIdx]} 次，幅度 ${graspQualityPerFinger[midIdx].toFixed(1)}%`;
    const tremorSummary = `推測震顫頻率 ≈ ${tremorHz.toFixed(2)} Hz`;
    const emgSummary = `EMG RMS ≈ ${emgRms.toFixed(1)}`;

    const summary = `${fingerSummary}；${tremorSummary}；${emgSummary}`;

    return {
      overallSeverity,
      fingerSummary,
      tremorSummary,
      emgSummary,
      summary,
      tremorHz,
      graspQualityPerFinger,
      emgRms
    };
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <main className="container mx-auto py-12 px-4">
          <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <BrainCircuit className="h-8 w-8 mr-3 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI 症狀分析</h1>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            智能帕金森症狀評估系統
          </div>
        </div>

        {/* 连接错误提示 */}
        {connectionError && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{connectionError}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 全局设备连接器 */}
          <div className="xl:col-span-1">
            <GlobalConnector
              showSensorData={false}
              showConnectionControls={true}
              compact={false}
            />
          </div>

          {/* 传感器数据卡片 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">即時傳感器數據</h2>
            <div className="space-y-4">

                <div>
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">手指彎曲度</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {sensorData.fingerPositions.map((value, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                        <span className="text-sm text-gray-600 dark:text-gray-400">手指 {index + 1}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">加速度計 (g)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">X</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.accelerometer.x.toFixed(2)}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Y</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.accelerometer.y.toFixed(2)}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Z</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.accelerometer.z.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">陀螺儀 (deg/s)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">X</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.gyroscope.x.toFixed(2)}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Y</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.gyroscope.y.toFixed(2)}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Z</div>
                      <div className="font-medium text-gray-900 dark:text-white">{sensorData.gyroscope.z.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">EMG 信號</h3>
                  <div className="p-3 bg-gray-50 dark:bg-neutral-700 rounded text-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {sensorData.emg?.toFixed ? sensorData.emg.toFixed(0) : sensorData.emg}
                    </span>
                  </div>
                </div>

                {isCollecting && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-blue-700 dark:text-blue-300">正在採集數據 (10秒)</span>
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* 分析控制卡片 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">AI 分析控制</h2>

            <div className="space-y-4">
              <Button
                onClick={startTenSecondAnalysis}
                disabled={isLoading || !isConnected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg transition-colors"
              >
                {isLoading ? '分析中...' :
                 !isConnected ? '請先連接設備' :
                 '開始症狀分析（採集10秒）'}
              </Button>

              <Button
                onClick={testRecordSaving}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
              >
                測試記錄保存功能
              </Button>

              {isLoading && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-700 dark:text-blue-300">正在進行AI分析...</span>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* 關閉上方網格容器 */}
        </div>

        {/* 分析结果区域 */}
        {prediction !== null && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">AI 分析結果</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">基本信息</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">分析編號</span>
                      <span className="font-semibold text-gray-900 dark:text-white">#{analysisData.analysisCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">置信度</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{analysisData.confidence.toFixed(1)}%</span>
                    </div>
                    {modelSeverity !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">模型嚴重度</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{modelSeverity}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 症状严重程度 */}
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">症狀嚴重程度</h3>
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{prediction}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 详细分析结果 */}
            <div className="mt-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">AI 分析建議</h3>
                <p className="text-green-700 dark:text-green-300">{analysisData.recommendation}</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2">訓練參數建議</h3>
                <p className="text-orange-700 dark:text-orange-300">
                  建議阻力設定: <span className="font-semibold">{analysisData.recommendedResistance}度</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 个性化训练建议 */}
        {prediction !== null && groups.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">個性化訓練建議</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map((g, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{g.category}</h3>
                  <ul className="space-y-2">
                    {g.items.map((it, j) => (
                      <li key={j} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 快速访问链接 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">快速訪問</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/records"
              className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Book className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-800 dark:text-blue-200">查看記錄</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">歷史分析記錄</div>
              </div>
            </a>

            <a
              href="/device"
              className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-800 dark:text-green-200">設備監控</div>
                <div className="text-sm text-green-600 dark:text-green-400">實時數據監控</div>
              </div>
            </a>

            <a
              href="/settings"
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">系統設置</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">參數配置</div>
              </div>
            </a>
          </div>
        </div>
        </main>
      </div>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </>
  );
}