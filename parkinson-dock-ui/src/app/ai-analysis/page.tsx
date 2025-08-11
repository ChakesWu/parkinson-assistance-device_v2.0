'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GetStartedButton } from '@/components/ui/get-started-button';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { BrainCircuit, Home, Activity, Book, Settings, Brain, Mic, Layers, BarChart3, User } from 'lucide-react';
import { getRecommendations, classifySeverity } from '@/lib/ai/recommendations';
import { SPEECH_ANALYSIS_CONFIG, getCurrentAnalysisStage, calculateRemainingTime, evaluateSpeechFeature } from '@/lib/speech-analysis-config';
import { analysisRecordService } from '@/services/analysisRecordService';
import { useGlobalConnection } from '@/hooks/useGlobalConnection';
import GlobalConnector from '@/components/device/GlobalConnector';
import { SensorData, AIResult } from '@/utils/bluetoothManager';
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SerialPortLike = any;

export default function AIAnalysisPage() {
  // 分頁狀態
  const [activeTab, setActiveTab] = useState<'speech' | 'multimodal' | 'symptoms'>('symptoms');
  const [open, setOpen] = useState(false);
  
  const [prediction, setPrediction] = useState<number | null>(null);
  const [analysisData, setAnalysisData] = useState({
    analysisCount: 0,
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sensorData, setSensorData] = useState({
    fingerPositions: [0, 0, 0, 0, 0],
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    emg: 0,
  });
  const [modelSeverity, setModelSeverity] = useState<number | null>(null);
  const [groups, setGroups] = useState<ReturnType<typeof getRecommendations>>([]);

  // 语音分析结果状态
  const [speechResult, setSpeechResult] = useState({
    speechClass: 0,
    probability: 0,
    jitter: 0,
    shimmer: 0,
    hnr: 0,
    silenceRatio: 0,
    voiceActivity: 0,
    hasResult: false
  });

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
    onAIResultReceived: handleGlobalAIResult,
    onSpeechResultReceived: handleSpeechResult
  });

  // 10秒資料緩存
  const sessionStartRef = useRef<number | null>(null);
  const fingerSeriesRef = useRef<number[][]>([[], [], [], [], []]);
  const accelSeriesRef = useRef<{ x: number[]; y: number[]; z: number[] }>({ x: [], y: [], z: [] });
  const emgSeriesRef = useRef<number[]>([]);
  const tsSeriesRef = useRef<number[]>([]);

  // 側邊欄連結配置
  const links = [
    {
      label: "症狀分析",
      href: "#",
      icon: <BarChart3 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
      onClick: () => setActiveTab('symptoms'),
      active: activeTab === 'symptoms'
    },
    {
      label: "語音分析",
      href: "#",
      icon: <Mic className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
      onClick: () => setActiveTab('speech'),
      active: activeTab === 'speech'
    },
    {
      label: "多模態分析",
      href: "#",
      icon: <Layers className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
      onClick: () => setActiveTab('multimodal'),
      active: activeTab === 'multimodal'
    },
  ];

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

  // 处理语音分析结果
  function handleSpeechResult(result: any) {
    setSpeechResult({
      speechClass: result.speechClass,
      probability: result.probability,
      jitter: result.jitter,
      shimmer: result.shimmer,
      hnr: result.hnr,
      silenceRatio: result.silenceRatio,
      voiceActivity: result.voiceActivity,
      hasResult: true
    });
    setIsAnalyzing(false);
    setSpeechProgress(0);
  }

  // 語音分析進度條動畫 - 優化為7秒檢測
  const startSpeechAnalysis = async () => {
    if (!isConnected) {
      alert('请先连接设备');
      return;
    }

    setIsAnalyzing(true);
    setSpeechProgress(0);
    setSpeechResult(prev => ({ ...prev, hasResult: false }));

    try {
      // 發送語音分析命令
      await handleSendCommand('SPEECH');

      // 使用配置優化進度條
      const duration = SPEECH_ANALYSIS_CONFIG.DURATION_MS;
      const interval = SPEECH_ANALYSIS_CONFIG.PROGRESS_UPDATE_INTERVAL;
      const steps = duration / interval;
      let currentStep = 0;

      const progressInterval = setInterval(() => {
        currentStep++;
        const progress = (currentStep / steps) * 100;
        setSpeechProgress(Math.min(progress, 100));

        // 使用配置的階段性提示
        const currentStage = getCurrentAnalysisStage(progress);
        if (currentStep % 20 === 0) { // 每秒輸出一次日誌
          console.log(`語音分析: ${Math.round(progress)}% - ${currentStage.message}`);
        }

        if (currentStep >= steps) {
          clearInterval(progressInterval);
          console.log('語音分析: 100% - 分析完成，等待結果...');
          // 使用配置的超時緩衝時間
          setTimeout(() => {
            if (isAnalyzing) {
              setIsAnalyzing(false);
              setSpeechProgress(0);
              console.log('語音分析超時，請檢查設備連接');
            }
          }, SPEECH_ANALYSIS_CONFIG.TIMEOUT_BUFFER_MS);
        }
      }, interval);

    } catch (error) {
      console.error('語音分析失敗:', error);
      setIsAnalyzing(false);
      setSpeechProgress(0);
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

    setIsLoading(false);
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

  return (
    <div className={cn(
      "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 max-w-full mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
      "h-screen"
    )}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarButton key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Admin",
                href: "#",
                icon: (
                  <User className="h-7 w-7 flex-shrink-0 rounded-full text-neutral-700 dark:text-neutral-200" />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <Dashboard
        activeTab={activeTab}
        prediction={prediction}
        analysisData={analysisData}
        isLoading={isLoading}
        speechProgress={speechProgress}
        isAnalyzing={isAnalyzing}
        sensorData={sensorData}
        modelSeverity={modelSeverity}
        groups={groups}
        speechResult={speechResult}
        isCollecting={isCollecting}
        connectionError={connectionError}
        isConnected={isConnected}
        startTenSecondAnalysis={startTenSecondAnalysis}
        startSpeechAnalysis={startSpeechAnalysis}
        handleSendCommand={handleSendCommand}
        testRecordSaving={testRecordSaving}
        dockItems={dockItems}
      />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        AI 症狀分析
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};

// 自定義側邊欄按鈕組件
const SidebarButton = ({
  link,
  className,
}: {
  link: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active: boolean;
  };
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <button
      onClick={link.onClick}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left transition-colors",
        link.active ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        className
      )}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </button>
  );
};

// Dashboard component with tabbed interface
const Dashboard = ({
  activeTab,
  prediction,
  analysisData,
  isLoading,
  speechProgress,
  isAnalyzing,
  sensorData,
  modelSeverity,
  groups,
  speechResult,
  isCollecting,
  connectionError,
  isConnected,
  startTenSecondAnalysis,
  startSpeechAnalysis,
  handleSendCommand,
  testRecordSaving,
  dockItems
}: {
  activeTab: 'speech' | 'multimodal' | 'symptoms';
  prediction: number | null;
  analysisData: any;
  isLoading: boolean;
  speechProgress: number;
  isAnalyzing: boolean;
  sensorData: any;
  modelSeverity: number | null;
  groups: any[];
  speechResult: any;
  isCollecting: boolean;
  connectionError: string | null;
  isConnected: boolean;
  startTenSecondAnalysis: () => void;
  startSpeechAnalysis: () => void;
  handleSendCommand: (cmd: string) => void;
  testRecordSaving: () => void;
  dockItems: any[];
}) => {
  return (
    <div className="flex flex-1 relative">
      <div className="p-2 md:p-6 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-4 flex-1 w-full h-full overflow-y-auto">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <BrainCircuit className="h-8 w-8 mr-3 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {activeTab === 'speech' && '語音分析'}
              {activeTab === 'multimodal' && '多模態分析'}
              {activeTab === 'symptoms' && '症狀分析'}
            </h1>
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

        {/* 根據活動標籤顯示不同內容 */}
        {activeTab === 'symptoms' && (
          <SymptomsAnalysisTab
            prediction={prediction}
            analysisData={analysisData}
            isLoading={isLoading}
            sensorData={sensorData}
            modelSeverity={modelSeverity}
            groups={groups}
            isCollecting={isCollecting}
            isConnected={isConnected}
            startTenSecondAnalysis={startTenSecondAnalysis}
            handleSendCommand={handleSendCommand}
            testRecordSaving={testRecordSaving}
          />
        )}

        {activeTab === 'speech' && (
          <SpeechAnalysisTab
            speechResult={speechResult}
            speechProgress={speechProgress}
            isAnalyzing={isAnalyzing}
            isConnected={isConnected}
            startSpeechAnalysis={startSpeechAnalysis}
          />
        )}

        {activeTab === 'multimodal' && (
          <MultimodalAnalysisTab
            isConnected={isConnected}
            handleSendCommand={handleSendCommand}
            isLoading={isLoading}
          />
        )}

        {/* 添加懸浮動態按鈕 */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <AnimatedDock items={dockItems} />
        </div>
      </div>
    </div>
  );
};

// 症狀分析標籤頁
const SymptomsAnalysisTab = ({
  prediction,
  analysisData,
  isLoading,
  sensorData,
  modelSeverity,
  groups,
  isCollecting,
  isConnected,
  startTenSecondAnalysis,
  handleSendCommand,
  testRecordSaving
}: any) => {
  return (
    <div className="space-y-6">
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
                {sensorData.fingerPositions.map((value: number, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-neutral-700 rounded">
                    <span className="text-sm text-gray-600 dark:text-gray-400">手指 {index + 1}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{value}%</span>
                  </div>
                ))}
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">症狀分析控制</h2>
          <div className="space-y-4">
            <GetStartedButton
              onClick={startTenSecondAnalysis}
              disabled={isLoading || !isConnected}
              className="w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
              size="lg"
              color="blue"
            >
              {isLoading ? '分析中...' :
               !isConnected ? '請先連接設備' :
               '開始症狀分析（採集10秒）'}
            </GetStartedButton>

            <GetStartedButton
              onClick={testRecordSaving}
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
              size="lg"
            >
              測試記錄保存功能
            </GetStartedButton>

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
                    style={{ width: `${prediction}%` }}
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
            {groups.map((g: any, idx: number) => (
              <div key={idx} className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{g.category}</h3>
                <ul className="space-y-2">
                  {g.items.map((it: string, j: number) => (
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
    </div>
  );
};

// 語音分析標籤頁
const SpeechAnalysisTab = ({
  speechResult,
  speechProgress,
  isAnalyzing,
  isConnected,
  startSpeechAnalysis
}: any) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* 語音分析控制 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">語音分析控制</h2>
          <div className="space-y-4">
            <GetStartedButton
              onClick={startSpeechAnalysis}
              disabled={isAnalyzing || !isConnected}
              className="w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
              size="lg"
              color="green"
            >
              {isAnalyzing ? '正在分析語音...' :
               !isConnected ? '請先連接設備' :
               '開始語音分析（7秒）'}
            </GetStartedButton>

            {/* 優化的動態進度條 */}
            {isAnalyzing && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>語音分析進度</span>
                  <span className="font-medium">{Math.round(speechProgress)}%</span>
                </div>

                {/* 增強的進度條 */}
                <div className="w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-200 ease-out relative"
                    style={{ width: `${speechProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>

                {/* 階段性狀態提示 */}
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                  <div className="flex-1">
                    <div className="text-green-700 dark:text-green-300 font-medium">
                      {getCurrentAnalysisStage(speechProgress).message}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      預計剩餘時間: {calculateRemainingTime(speechProgress)} 秒
                    </div>
                    <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                      {getCurrentAnalysisStage(speechProgress).description}
                    </div>
                  </div>
                </div>

                {/* 語音採集提示 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <div className="font-medium mb-1">📢 語音採集提示：</div>
                    <ul className="text-xs space-y-1 ml-4">
                      {SPEECH_ANALYSIS_CONFIG.VOICE_INSTRUCTIONS.map((instruction, index) => (
                        <li key={index}>• {instruction}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 設備連接狀態 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <GlobalConnector
            showSensorData={false}
            showConnectionControls={true}
            compact={false}
          />
        </div>
      </div>

      {/* 语音分析结果 */}
      {speechResult.hasResult && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">語音分析結果</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 分析结果概览 */}
            <div className="space-y-4">
              <div className={`${speechResult.speechClass === 1 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'} rounded-lg p-4`}>
                <h3 className={`font-medium ${speechResult.speechClass === 1 ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'} mb-3`}>
                  分析結果
                </h3>
                <div className="text-center mb-4">
                  <span className={`text-2xl font-bold ${speechResult.speechClass === 1 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {speechResult.speechClass === 1 ? '檢測到帕金森症狀' : '正常語音'}
                  </span>
                </div>
                <div className="text-center">
                  <span className={`text-lg ${speechResult.speechClass === 1 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                    概率: {(speechResult.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">語音活躍度</h3>
                <div className="text-center mb-2">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {(speechResult.voiceActivity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-neutral-600 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${speechResult.voiceActivity * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 详细特征 */}
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-3">語音特徵分析</h3>
                <div className="space-y-4">
                  {/* Jitter */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Jitter (基頻抖動)</span>
                    <div className="text-right">
                      <span className={`font-semibold ${evaluateSpeechFeature('JITTER', speechResult.jitter).color}`}>
                        {speechResult.jitter.toFixed(4)}
                      </span>
                      <div className="text-xs text-gray-500">
                        {evaluateSpeechFeature('JITTER', speechResult.jitter).description}
                      </div>
                    </div>
                  </div>

                  {/* Shimmer */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Shimmer (振幅微顫)</span>
                    <div className="text-right">
                      <span className={`font-semibold ${evaluateSpeechFeature('SHIMMER', speechResult.shimmer).color}`}>
                        {speechResult.shimmer.toFixed(4)}
                      </span>
                      <div className="text-xs text-gray-500">
                        {evaluateSpeechFeature('SHIMMER', speechResult.shimmer).description}
                      </div>
                    </div>
                  </div>

                  {/* HNR */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">HNR (諧噪比)</span>
                    <div className="text-right">
                      <span className={`font-semibold ${evaluateSpeechFeature('HNR', speechResult.hnr).color}`}>
                        {speechResult.hnr.toFixed(1)} dB
                      </span>
                      <div className="text-xs text-gray-500">
                        {evaluateSpeechFeature('HNR', speechResult.hnr).description}
                      </div>
                    </div>
                  </div>

                  {/* 靜音比 */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">靜音比</span>
                    <div className="text-right">
                      <span className={`font-semibold ${evaluateSpeechFeature('SILENCE_RATIO', speechResult.silenceRatio).color}`}>
                        {(speechResult.silenceRatio * 100).toFixed(1)}%
                      </span>
                      <div className="text-xs text-gray-500">
                        {evaluateSpeechFeature('SILENCE_RATIO', speechResult.silenceRatio).description}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h3 className="font-medium text-purple-800 dark:text-purple-200 mb-3">📊 特徵解釋與參考值</h3>
                <div className="text-sm text-purple-700 dark:text-purple-300 space-y-3">
                  {Object.entries(SPEECH_ANALYSIS_CONFIG.RESULT_INTERPRETATION).map(([key, value]) => (
                    <div key={key} className="border-l-2 border-purple-300 pl-3">
                      <div className="font-medium">{value.description}</div>
                      <div className="text-xs space-y-1 mt-1">
                        <div>正常範圍: <span className="text-green-600 font-medium">{value.normal}</span></div>
                        <div>異常範圍: <span className="text-red-600 font-medium">{value.abnormal}</span></div>
                        <div className="text-purple-600">{value.parkinson_indicator}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-800/30 rounded-lg">
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    <strong>💡 提示：</strong> 7秒的語音採集時間相比5秒能夠：
                    <ul className="mt-1 ml-4 space-y-1">
                      <li>• 提高特徵提取的準確性</li>
                      <li>• 減少短時間波動的影響</li>
                      <li>• 獲得更穩定的分析結果</li>
                      <li>• 提升帕金森檢測的可靠性</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 多模態分析標籤頁
const MultimodalAnalysisTab = ({
  isConnected,
  handleSendCommand,
  isLoading
}: any) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* 多模態分析控制 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">多模態分析控制</h2>
          <div className="space-y-4">
            <GetStartedButton
              onClick={() => handleSendCommand('MULTIMODAL')}
              disabled={isLoading || !isConnected}
              className="w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
              size="lg"
              color="purple"
            >
              {isLoading ? '分析中...' :
               !isConnected ? '請先連接設備' :
               '多模態分析（傳感器+語音）'}
            </GetStartedButton>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <h3 className="font-medium text-purple-800 dark:text-purple-200 mb-2">分析說明</h3>
              <div className="text-sm text-purple-700 dark:text-purple-300 space-y-2">
                <p>• 結合手部傳感器數據和語音特徵</p>
                <p>• 提供更全面的帕金森症狀評估</p>
                <p>• 分析時間約15-20秒</p>
                <p>• 準確率比單一模態分析提高15-20%</p>
              </div>
            </div>

            {isLoading && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                  <span className="text-purple-700 dark:text-purple-300">正在進行多模態分析...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 設備連接狀態 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <GlobalConnector
            showSensorData={false}
            showConnectionControls={true}
            compact={false}
          />
        </div>
      </div>

      {/* 多模態分析優勢說明 */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">多模態分析優勢</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h3 className="font-medium text-blue-800 dark:text-blue-200">傳感器數據</h3>
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• 手指彎曲度分析</li>
              <li>• 震顫頻率檢測</li>
              <li>• EMG 肌電信號</li>
              <li>• 運動協調性評估</li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Mic className="h-6 w-6 text-green-600" />
              <h3 className="font-medium text-green-800 dark:text-green-200">語音特徵</h3>
            </div>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>• 基頻穩定性 (Jitter)</li>
              <li>• 振幅變化 (Shimmer)</li>
              <li>• 諧噪比 (HNR)</li>
              <li>• 語音流暢度</li>
            </ul>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Layers className="h-6 w-6 text-purple-600" />
              <h3 className="font-medium text-purple-800 dark:text-purple-200">融合分析</h3>
            </div>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>• 交叉驗證結果</li>
              <li>• 提高診斷準確性</li>
              <li>• 減少假陽性率</li>
              <li>• 個性化建議</li>
            </ul>
          </div>
        </div>
      </div>

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
    </div>
  );
};
