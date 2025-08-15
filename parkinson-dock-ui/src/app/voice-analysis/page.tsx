'use client';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import GlobalConnector from '@/components/device/GlobalConnector';
import { useGlobalConnection } from '@/hooks/useGlobalConnection';
import { Activity, Brain, Home, Settings, Book } from 'lucide-react';

export default function VoiceAnalysisPage() {
  const [isVoiceAnalyzing, setIsVoiceAnalyzing] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceMessage, setVoiceMessage] = useState<string>('准备开始Arduino语音分析');
  const [speechResult, setSpeechResult] = useState<{
    class: number; probability: number; jitter: number; shimmer: number; hnr: number; silenceRatio: number; voiceActivity: number;
  } | null>(null);

  const { isConnected, connectBluetooth, connectSerial, disconnect, sendCommand } = useGlobalConnection({
    onSpeechResultReceived: (res) => {
      setSpeechResult({
        class: res.speechClass,
        probability: res.probability,
        jitter: res.jitter,
        shimmer: res.shimmer,
        hnr: res.hnr,
        silenceRatio: res.silenceRatio,
        voiceActivity: res.voiceActivity,
      });
      setVoiceProgress(100);
      setVoiceMessage('✅ 语音分析完成');
      setTimeout(() => setIsVoiceAnalyzing(false), 1500);
    },
  });

  const sidebarLinks = [
    { label: 'AI 症状分析', href: '/ai-analysis', icon: <Brain className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
    { label: '语音检测', href: '/voice-analysis', icon: <Activity className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
    { label: '多模态分析', href: '/multimodal-analysis', icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
  ];

  const startVoiceAnalysis = async () => {
    try {
      setIsVoiceAnalyzing(true);
      setVoiceProgress(0);
      setVoiceMessage('正在连接Arduino设备...');
      if (!isConnected) {
        // 优先提示用户选择连接方式
        setVoiceMessage('请选择连接方式：串口或蓝牙');
        return;
      }
      setVoiceMessage('正在启动Arduino语音分析...');
      await sendCommand('SPEECH');
      setVoiceMessage('Arduino正在进行5秒语音采集...');

      const startTime = performance.now();
      const speechDuration = 5000;
      const progressInterval = 100;
      const progressTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(100, (elapsed / speechDuration) * 100);
        setVoiceProgress(progress);
        if (elapsed < 1000) setVoiceMessage('Arduino PDM麦克风初始化中...');
        else if (elapsed < 2000) setVoiceMessage('正在采集语音信号...');
        else if (elapsed < 4000) setVoiceMessage('正在分析语音特征...');
        else if (elapsed < speechDuration) setVoiceMessage('正在计算帕金森症状指标...');
        else setVoiceMessage('等待Arduino分析结果...');
      }, progressInterval);

      // 超时保护：交由 BLE/Serial 回调触发完成，10s 无结果视为超时
      setTimeout(() => {
        if (isVoiceAnalyzing) {
          setIsVoiceAnalyzing(false);
          setVoiceMessage('语音分析超时，请重试');
        }
      }, 10000);
    } catch (err) {
      setIsVoiceAnalyzing(false);
      setVoiceMessage('❌ 无法启动语音分析：' + (err as Error).message);
    }
  };

  const cancelVoiceAnalysis = async () => {
    try { if (writerRef.current) await sendCommand('STOP'); } catch {}
    setIsVoiceAnalyzing(false);
    setVoiceProgress(0);
    setVoiceMessage('已取消语音分析');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <main className="container mx-auto py-12 px-4">
        <div className="flex gap-4 items-stretch min-h-[70vh]">
          <Sidebar>
            <SidebarBody>
              <div className="flex flex-col h-full">
                <div className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
                  <div className="h-6 w-6 bg-blue-600 dark:bg-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center"></div>
                  <span className="font-medium text-black dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">帕金森辅助设备</span>
                </div>
                <div className="mt-4 space-y-1">
                  {sidebarLinks.map((link, index) => (
                    <SidebarLink key={index} link={link} />
                  ))}
                </div>
              </div>
            </SidebarBody>
          </Sidebar>

          <div className="flex-1">
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">语音识别帕金森</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">通过Arduino内建PDM麦克风进行5秒语音采集，分析帕金森症状特征（Jitter、Shimmer、HNR等）。</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">⚠️ 请确保Arduino已连接且环境安静</div>
                <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${voiceProgress}%` }} />
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{voiceMessage}</div>
                <div className="flex gap-2">
                  {!isVoiceAnalyzing ? (
                    <Button onClick={startVoiceAnalysis} disabled={!isConnected} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {!isConnected ? '请先连接Arduino' : '开始Arduino语音分析'}
                    </Button>
                  ) : (
                    <Button onClick={cancelVoiceAnalysis} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">取消分析</Button>
                  )}
                  {!isConnected && (
                    <>
                      <Button onClick={connectSerial} className="border-blue-500 text-white bg-blue-600 hover:bg-blue-700">串口连接</Button>
                      <Button onClick={connectBluetooth} className="border-blue-500 text-white bg-blue-600 hover:bg-blue-700">蓝牙连接</Button>
                    </>
                  )}
                  {isConnected && (
                    <Button onClick={disconnect} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">断开连接</Button>
                  )}
                </div>

                {speechResult && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Arduino语音分析结果</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">分类结果：</span>
                        <span className={`font-medium ${speechResult.class === 1 ? 'text-red-600' : 'text-green-600'}`}>
                          {speechResult.class === 1 ? '检测到帕金森症状' : '正常语音'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">概率：</span>
                        <span className="font-medium text-gray-900 dark:text-white">{(speechResult.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Jitter：</span>
                        <span className="font-medium text-gray-900 dark:text-white">{speechResult.jitter.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Shimmer：</span>
                        <span className="font-medium text-gray-900 dark:text-white">{speechResult.shimmer.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">HNR：</span>
                        <span className="font-medium text-gray-900 dark:text-white">{speechResult.hnr.toFixed(1)} dB</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">语音活动度：</span>
                        <span className="font-medium text-gray-900 dark:text-white">{(speechResult.voiceActivity * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

