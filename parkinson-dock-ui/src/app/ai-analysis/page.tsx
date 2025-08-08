'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { BrainCircuit, Home, Activity, Book, Settings, Brain } from 'lucide-react';
import { getRecommendations, classifySeverity } from '@/lib/ai/recommendations';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const lineBufferRef = useRef<string>('');

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

  // 串口連線
  const ensureSerialConnected = async () => {
    if (!('serial' in navigator)) throw new Error('此瀏覽器不支援 Web Serial，請使用 Chrome/Edge');
    if (isConnected && portRef.current) return;
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 }); // 與韌體一致（若你用 115200，請改這裡）
    // 設置解碼器與讀取器
    const textDecoder = new (window as any).TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader as any;
    // 設置編碼器與寫入器
    const textEncoder = new (window as any).TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable);
    const writer = textEncoder.writable.getWriter();
    writerRef.current = writer as any;
    portRef.current = port;
    setIsConnected(true);
  };

  const closeSerial = async () => {
    try {
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch {}
        readerRef.current = null;
      }
      if (writerRef.current) {
        try { await writerRef.current.close(); } catch {}
        writerRef.current = null;
      }
      if (portRef.current) {
        try { await portRef.current.close(); } catch {}
        portRef.current = null;
      }
    } finally {
      setIsConnected(false);
    }
  };

  // 串口寫入命令
  const sendCommand = async (cmd: string) => {
    if (!writerRef.current) return;
    await writerRef.current.write(cmd.endsWith('\n') ? cmd : cmd + '\n');
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
    setIsLoading(true);
    setPrediction(null);
    setGroups([]);

    // 清空序列
    fingerSeriesRef.current = [[], [], [], [], []];
    accelSeriesRef.current = { x: [], y: [], z: [] };
    emgSeriesRef.current = [];
    tsSeriesRef.current = [];

    try {
      await ensureSerialConnected();
      // 啟動裝置採集
      await sendCommand('START');
      setIsCollecting(true);
      sessionStartRef.current = performance.now();

      // 讀取 10 秒
      const deadline = sessionStartRef.current + 10000;
      while (performance.now() < deadline) {
        if (!readerRef.current) break;
        const { value, done } = await readerRef.current.read();
        if (done) break;
        if (value) {
          lineBufferRef.current += value as string;
          const lines = lineBufferRef.current.split('\n');
          lineBufferRef.current = lines.pop() ?? '';
          for (const raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed) continue;
            if (trimmed === 'END') {
              // 裝置主動結束
              sessionStartRef.current = sessionStartRef.current ?? performance.now() - 10000;
              break;
            }
            const parsed = parseDataLine(trimmed);
            if (parsed) {
              const now = performance.now();
              tsSeriesRef.current.push(now);
              for (let i = 0; i < 5; i++) {
                fingerSeriesRef.current[i].push(parsed.fingers[i] ?? 0);
              }
              accelSeriesRef.current.x.push(parsed.accel.x ?? 0);
              accelSeriesRef.current.y.push(parsed.accel.y ?? 0);
              accelSeriesRef.current.z.push(parsed.accel.z ?? 0);
              emgSeriesRef.current.push(parsed.emg ?? 0);
              // 即時顯示
              setSensorData({
                fingerPositions: parsed.fingers.map(v => Math.round((v / 1023) * 100)),
                accelerometer: parsed.accel,
                gyroscope: parsed.gyro,
                emg: parsed.emg ?? 0,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('採集失敗', e);
    } finally {
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
      setAnalysisData(prev => ({
        analysisCount: prev.analysisCount + 1,
        confidence: prev.confidence || confidencePercent,
        recommendation: res.summary,
        recommendedResistance,
      }));
      setGroups(getRecommendations(severity));
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

    return { overallSeverity, fingerSummary, tremorSummary, emgSummary, summary };
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <BrainCircuit className="h-8 w-8 mr-2 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">AI 症狀分析</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-white">即時傳感器數據</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">手指彎曲度</h3>
                  {sensorData.fingerPositions.map((value, index) => (
                    <div key={index} className="flex items-center mb-1">
                      <span className="w-16 text-gray-300">手指 {index + 1}:</span>
                      <span className="font-medium text-white">{value}%</span>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">加速度計 (g)</h3>
                  <div className="space-y-1 text-white">
                    <div>X: {sensorData.accelerometer.x.toFixed(2)}</div>
                    <div>Y: {sensorData.accelerometer.y.toFixed(2)}</div>
                    <div>Z: {sensorData.accelerometer.z.toFixed(2)}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">陀螺儀 (deg/s)</h3>
                  <div className="space-y-1 text-white">
                    <div>X: {sensorData.gyroscope.x.toFixed(2)}</div>
                    <div>Y: {sensorData.gyroscope.y.toFixed(2)}</div>
                    <div>Z: {sensorData.gyroscope.z.toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2 text-purple-200">EMG</h3>
                  <div className="text-white">{sensorData.emg?.toFixed ? sensorData.emg.toFixed(0) : sensorData.emg}</div>
                </div>

                <div className="text-xs text-purple-200/70">
                  {isConnected ? '裝置已連接' : '裝置未連接'} {isCollecting && '· 正在採集 10 秒'}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">AI 分析引擎</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full flex gap-2">
                    <Button
                      onClick={startTenSecondAnalysis}
                      disabled={isLoading}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg transition"
                    >
                      {isLoading ? '分析中...' : '開始症狀分析（採集10秒）'}
                    </Button>
                    {isConnected ? (
                      <Button variant="secondary" onClick={closeSerial}>斷開</Button>
                    ) : (
                      <Button variant="secondary" onClick={ensureSerialConnected}>連接</Button>
                    )}
                  </div>
                  
                  {prediction !== null && (
                    <div className="w-full">
                      <h3 className="text-lg font-semibold mb-4 text-white">分析結果</h3>
                      
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-6 text-white">
                        <div className="mb-4">
                          <div className="flex justify-between">
                            <span>分析編號</span>
                            <span className="font-bold">#{analysisData.analysisCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>置信度</span>
                            <span className="font-bold">{analysisData.confidence.toFixed(1)}%</span>
                          </div>
                          {modelSeverity !== null && (
                            <div className="flex justify-between">
                              <span>模型嚴重度</span>
                              <span className="font-bold">{modelSeverity}%</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center mb-3">
                          <span>症狀嚴重程度</span>
                          <span className="text-2xl font-bold">{prediction}%</span>
                        </div>
                        
                        <div className="w-full bg-gray-300 rounded-full h-4 mb-4">
                          <div
                            className="bg-white h-4 rounded-full"
                            style={{ width: `${prediction}%` }}
                          ></div>
                        </div>
                        
                        <div className="mt-4 space-y-1">
                          <p className="font-medium">概述: {analysisData.recommendation}</p>
                          <p>建議阻力設定: {analysisData.recommendedResistance}度</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {prediction !== null && groups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-white">個性化訓練建議（權威類型，多樣化）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {groups.map((g, idx) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4">
                        <div className="text-purple-200 font-semibold mb-2">{g.category}</div>
                        <ul className="list-disc pl-5 space-y-1 text-white">
                          {g.items.map((it, j) => (
                            <li key={j}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-white">歷史分析記錄</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-300">
                  正在開發中...
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 添加懸浮動態按鈕 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </div>
  );
}