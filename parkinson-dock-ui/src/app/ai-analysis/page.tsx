'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { BrainCircuit, Home, Activity, Book, Settings, Brain } from 'lucide-react';
import { getRecommendations, classifySeverity } from '@/lib/ai/recommendations';
import { analysisRecordService } from '@/services/analysisRecordService';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import { useGlobalConnection } from '@/hooks/useGlobalConnection';
import { SPEECH_ANALYSIS_CONFIG } from "@/lib/speech-analysis-config";


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
  const [modelSeverity, setModelSeverity] = useState<number | null>(null); // 0..100 由设备/CNN/LSTM 提供
  const [groups, setGroups] = useState<ReturnType<typeof getRecommendations>>([]);

  // 连线/采集状态
  const [isCollecting, setIsCollecting] = useState(false);
  const isCollectingRef = useRef(false);
  const { isConnected, connectBluetooth, connectSerial, disconnect, sendCommand } = useGlobalConnection({
    onDataReceived: (data) => {
      // 即时显示
      const percentFingers = data.fingers.map(v => Math.round((Math.max(0, Math.min(1023, v)) / 1023) * 100));
      setSensorData({
        fingerPositions: percentFingers,
        accelerometer: data.accel,
        gyroscope: data.gyro,
        emg: data.emg ?? 0,
      });

      // 只在采集中累积序列
      if (isCollectingRef.current) {
        const now = performance.now();
        tsSeriesRef.current.push(now);
        for (let i = 0; i < 5; i++) {
          fingerSeriesRef.current[i].push(Math.max(0, Math.min(1023, data.fingers[i] ?? 0)));
        }
        accelSeriesRef.current.x.push(data.accel.x ?? 0);
        accelSeriesRef.current.y.push(data.accel.y ?? 0);
        accelSeriesRef.current.z.push(data.accel.z ?? 0);
        emgSeriesRef.current.push(data.emg ?? 0);
      }
    },
  });

  // 10秒数据缓存
  const sessionStartRef = useRef<number | null>(null);
  const fingerSeriesRef = useRef<number[][]>([[], [], [], [], []]);
  const accelSeriesRef = useRef<{ x: number[]; y: number[]; z: number[] }>({ x: [], y: [], z: [] });
  const emgSeriesRef = useRef<number[]>([]);
  const tsSeriesRef = useRef<number[]>([]);

  // 动态按钮配置
  const dockItems = [
    { link: "/", Icon: <Home size={22} /> },
    { link: "/device", Icon: <Activity size={22} /> },
    { link: "/records", Icon: <Book size={22} /> },
    { link: "/ai-analysis", Icon: <Brain size={22} /> },
    { link: "/settings", Icon: <Settings size={22} /> },
  ];

  // 语音识别状态
  const [isVoiceAnalyzing, setIsVoiceAnalyzing] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceMessage, setVoiceMessage] = useState<string>("准备开始Arduino语音分析");
  const [speechResult, setSpeechResult] = useState<{
    class: number;
    probability: number;
    jitter: number;
    shimmer: number;
    hnr: number;
    silenceRatio: number;
    voiceActivity: number;
  } | null>(null);

  const startVoiceAnalysis = async () => {
    try {
      setIsVoiceAnalyzing(true);
      setVoiceProgress(0);
      setVoiceMessage("正在连接Arduino设备...");

      if (!isConnected) {
        setVoiceMessage('请先连接设备');
        setIsVoiceAnalyzing(false);
        return;
      }

      setVoiceMessage("正在启动Arduino语音分析...");

      // 发送SPEECH命令给Arduino
      await sendCommand('SPEECH');

      setVoiceMessage("Arduino正在进行5秒语音采集...");

      // 监听Arduino的语音分析进度和结果
      const startTime = performance.now();
      const speechDuration = 5000; // Arduino设定为5秒
      const progressInterval = 100;

      const progressTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(100, (elapsed / speechDuration) * 100);
        setVoiceProgress(progress);

        if (elapsed < 1000) {
          setVoiceMessage("Arduino PDM麦克风初始化中...");
        } else if (elapsed < 2000) {
          setVoiceMessage("正在采集语音信号...");
        } else if (elapsed < 4000) {
          setVoiceMessage("正在分析语音特征...");
        } else if (elapsed < speechDuration) {
          setVoiceMessage("正在计算帕金森症状指标...");
        } else {
          setVoiceMessage("等待Arduino分析结果...");
        }
      }, progressInterval);

      // 超时保护
      setTimeout(() => {
        setIsVoiceAnalyzing(false);
        setVoiceMessage('语音分析超时，请重试');
      }, 10000);

    } catch (err) {
      console.error('语音分析启动失败:', err);
      setIsVoiceAnalyzing(false);
      setVoiceMessage("❌ 无法启动语音分析：" + (err as Error).message);
    }
  };

  const cancelVoiceAnalysis = async () => {
    try {
      // 发送停止命令给Arduino（如果支持的话）
      await sendCommand('STOP');
    } catch (error) {
      console.log('发送停止命令失败:', error);
    }

    setIsVoiceAnalyzing(false);
    setVoiceProgress(0);
    setVoiceMessage("已取消语音分析");
  };


  // 监听父页提供的数据（可选）
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

  // 同步采集标志
  useEffect(() => { isCollectingRef.current = isCollecting; }, [isCollecting]);

  // 测试记录保存功能
  const testRecordSaving = () => {
    try {
      const testRecord = analysisRecordService.saveRecord({
        analysisCount: 999,
        parkinsonLevel: 2,
        parkinsonDescription: '测试记录',
        confidence: 85.5,
        recommendation: '这是一个测试记录',
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
      console.log('测试记录已保存:', testRecord);
      alert('测试记录已保存，请检查 Records 页面');
    } catch (error) {
      console.error('测试记录保存失败:', error);
      alert('测试记录保存失败');
    }
  };

  // 使用全局连接的 sendCommand（已由 useGlobalConnection 提供）

  // 解析 DATA 行（支持 16 栏或 10 栏）
  const parseDataLine = (trimmed: string) => {
    if (!trimmed.startsWith('DATA')) return null;
    const payload = trimmed.startsWith('DATA,') ? trimmed.substring(5) : trimmed.substring(4).replace(/^,/, '');
    const parts = payload.split(',');
    const nums = parts.map(v => parseFloat(v));
    if (nums.length >= 15) {
      const fingers = nums.slice(0, 5).map(v => Math.max(0, Math.min(1023, v)));
      const emg = nums[5] ?? 0;
      const accel = { x: nums[6], y: nums[7], z: nums[8] };
      // 可选：gyro/mag 若存在
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

  // 开始 10 秒采集与分析
  const startTenSecondAnalysis = async () => {
    setIsLoading(true);
    setPrediction(null);
    setGroups([]);

    // 清空序列
    fingerSeriesRef.current = [[], [], [], [], []];
    accelSeriesRef.current = { x: [], y: [], z: [] };
    emgSeriesRef.current = [];
    tsSeriesRef.current = [];

    try {
      // 若尚未连接，提示选择连接方式
      if (!isConnected) {
        alert('请先连接设备（串口或蓝牙）');
        return;
      }
      // 启动装置采集（两种连接方式一致）
      await sendCommand('START');
      setIsCollecting(true);
      sessionStartRef.current = performance.now();
      // 自动在 10 秒后结束采集
      setTimeout(async () => {
        try { await sendCommand('STOP'); } catch {}
        setIsCollecting(false);
      }, 10000);
    } catch (e) {
      console.error('采集失败', e);
    } finally {
      // 结果计算在下方进行
    }

    // 计算结果
    try {
      const res = computeFinalAssessment();
      const severity = res.overallSeverity;
      const { stage, confidencePercent } = classifySeverity(severity);

      // 建议阻力
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

        console.log('准备保存分析记录:', {
          severity,
          parkinsonLevel,
          stage,
          confidencePercent,
          analysisCount: newAnalysisData.analysisCount
        });

        const lastTs = tsSeriesRef.current.length > 0 ? tsSeriesRef.current[tsSeriesRef.current.length - 1] : (sessionStartRef.current ?? 0);
        const firstTs = sessionStartRef.current ?? (tsSeriesRef.current.length > 0 ? tsSeriesRef.current[0] : 0);
        const durationSec = Math.max(0.001, (lastTs - firstTs) / 1000);

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
          duration: Math.round(durationSec),
        });
        console.log('分析记录已成功保存:', record);
      } catch (error) {
        console.error('保存分析记录失败:', error);
      }
    } catch (e) {
      console.error('分析计算失败', e);
      setPrediction(null);
    }

    setIsLoading(false);
  };

  // 侧边栏链接配置
  const sidebarLinks = [
    {
      label: "AI 症状分析",
      href: "/ai-analysis",
      icon: <Brain className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: "语音检测",
      href: "/voice-analysis",
      icon: <Activity className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    },
    {
      label: "多模态分析",
      href: "/multimodal-analysis",
      icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
    }
  ];

  // Logo组件
  const Logo = () => (
    <div className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
      <div className="h-6 w-6 bg-blue-600 dark:bg-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center">
        <Brain className="h-4 w-4 text-white" />
      </div>
      <span className="font-medium text-black dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">
        帕金森辅助设备
      </span>
    </div>
  );

  const LogoIcon = () => (
    <div className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
      <div className="h-6 w-6 bg-blue-600 dark:bg-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center">
        <Brain className="h-4 w-4 text-white" />
      </div>
    </div>
  );

  const SidebarHeader: React.FC = () => {
    const { open } = useSidebar();
    return open ? <Logo /> : <LogoIcon />;
  };

  // 计算：手指抓握、震颤频率、EMG 等级与总严重度
  const computeFinalAssessment = () => {

    const durationSec = Math.max(0.001, (tsSeriesRef.current.at(-1)! - (sessionStartRef.current ?? tsSeriesRef.current[0]!)) / 1000);

    // 手指抓握评估：看每指的幅度与循环次数（用阈值过零次数近似）
    const graspCyclesPerFinger: number[] = [];
    const graspQualityPerFinger: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = fingerSeriesRef.current[i] ?? [];
      if (s.length === 0) { graspCyclesPerFinger.push(0); graspQualityPerFinger.push(0); continue; }
      const maxV = Math.max(...s);
      const minV = Math.min(...s);
      const amp = maxV - minV; // 0..1023
      const thr = minV + amp * 0.6; // 高位阈值
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

    // 震颤频率：使用加速度向量模长去均值后的过零估计
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

    // 等级判定（简化规则，实务可由 CNN/LSTM 提供）
    // tremor: 4-6Hz 常见；若 >=3Hz 且幅度明显，权重提升
    let tremorScore = 0;
    if (tremorHz >= 3 && tremorHz <= 7) tremorScore = 70; else if (tremorHz > 7) tremorScore = 40; else tremorScore = 20;
    // grasp：取中值手指的质量与循环次数
    const midIdx = 2;
    const graspScore = 100 - Math.max(0, 60 - graspQualityPerFinger[midIdx]) - Math.max(0, 3 - graspCyclesPerFinger[midIdx]) * 10;
    // emg：相对幅度（此处仅示意，实务应用校准基线）
    const emgScore = Math.min(100, (emgRms / 512) * 100);

    const overallSeverity = Math.max(0, Math.min(100, 0.5 * tremorScore + 0.3 * (100 - graspScore) + 0.2 * emgScore));

    // 文案
    const fingerSummary = `抓握循环(中指)≈${graspCyclesPerFinger[midIdx]} 次，幅度 ${graspQualityPerFinger[midIdx].toFixed(1)}%`;
    const tremorSummary = `推测震颤频率 ≈ ${tremorHz.toFixed(2)} Hz`;
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
          <div className="flex gap-4 items-stretch max-[760px]:flex-col">
            <Sidebar>
              <SidebarBody>
                <div className="flex flex-col h-full">
                  <SidebarHeader />
                  <div className="mt-4 space-y-1">
                    {sidebarLinks.map((link, index) => (
                      <SidebarLink key={index} link={link} />
                    ))}
                  </div>
                </div>
              </SidebarBody>
            </Sidebar>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center">
                  <BrainCircuit className="h-8 w-8 mr-3 text-blue-600" />
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI 症状分析</h1>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  智能帕金森症状评估系统
                </div>
              </div>
        {/* 结束上方三栏格状容器 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 设备连接状态卡片 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">设备连接</h2>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">
                  {isConnected ? '已连接 Arduino' : '未连接 Arduino'}
                </span>
                <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? '在线' : '离线'}
                </span>
              </div>

              <div className="flex gap-2">
                {!isConnected ? (
                  <>
                    <Button onClick={connectSerial} className="flex-1 bg-blue-600 hover:bg-blue-700">串口连接</Button>
                    <Button onClick={connectBluetooth} className="flex-1 bg-blue-600 hover:bg-blue-700">蓝牙连接</Button>
                  </>
                ) : (
                  <Button onClick={disconnect} variant="outline" className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">断开连接</Button>
                )}
              </div>
            </div>
          </div>

          {/* 传感器数据卡片 */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">实时传感器数据</h2>
            <div className="space-y-4">

                <div>
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">手指弯曲度</h3>
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


                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">加速度计 (g)</h3>
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
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">陀螺仪 (deg/s)</h3>
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
                  <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">EMG 信号</h3>
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
                      <span className="text-sm text-blue-700 dark:text-blue-300">正在采集数据 (10秒)</span>
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
                 !isConnected ? '请先连接设备' :
                 '开始症状分析（采集10秒）'}
              </Button>

              <Button
                onClick={testRecordSaving}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
              >
                测试记录保存功能
              </Button>

              {isLoading && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-700 dark:text-blue-300">正在进行AI分析...</span>
                  </div>
                </div>
              )}
          </div>
        </div>

        </div>

        {/* 语音识别帕金森 功能已迁移到 /voice-analysis 分页 */}

        {/* 分析结果区域 */}
        {prediction !== null && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">AI 分析结果</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">基本信息</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">分析编号</span>
                      <span className="font-semibold text-gray-900 dark:text-white">#{analysisData.analysisCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">置信度</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{analysisData.confidence.toFixed(1)}%</span>
                    </div>
                    {modelSeverity !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">模型严重度</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{modelSeverity}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 症状严重程度 */}
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">症状严重程度</h3>
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
                <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">AI 分析建议</h3>
                <p className="text-green-700 dark:text-green-300">{analysisData.recommendation}</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2">训练参数建议</h3>
                <p className="text-orange-700 dark:text-orange-300">
                  建议阻力设定: <span className="font-semibold">{analysisData.recommendedResistance}度</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 个性化训练建议 */}
        {prediction !== null && groups.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">个性化训练建议</h2>

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">快速访问</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/records"
              className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Book className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-800 dark:text-blue-200">查看记录</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">历史分析记录</div>
              </div>
            </a>

            <a
              href="/device"
              className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-800 dark:text-green-200">设备监控</div>
                <div className="text-sm text-green-600 dark:text-green-400">实时数据监控</div>
              </div>
            </a>

            <a
              href="/settings"
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">系统设置</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">参数配置</div>
              </div>
            </a>
            </div>
          </div>
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