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
  const [voiceMessage, setVoiceMessage] = useState<string>('準備開始Arduino語音分析');
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
      setVoiceMessage('✅ 語音分析完成');
      setTimeout(() => setIsVoiceAnalyzing(false), 1500);
    },
  });

  const sidebarLinks = [
    { label: 'AI 症狀分析', href: '/ai-analysis', icon: <Brain className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
    { label: '語音檢測', href: '/voice-analysis', icon: <Activity className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
    { label: '多模態分析', href: '/multimodal-analysis', icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" /> },
  ];

  const startVoiceAnalysis = async () => {
    try {
      setIsVoiceAnalyzing(true);
      setVoiceProgress(0);
      setVoiceMessage('正在連接Arduino設備...');
      if (!isConnected) {
        // 優先提示用戶選擇連接方式
        setVoiceMessage('請選擇連接方式：串口或藍牙');
        return;
      }
      setVoiceMessage('正在啟動Arduino語音分析...');
      await sendCommand('SPEECH');
      setVoiceMessage('Arduino正在進行5秒語音採集...');

      const startTime = performance.now();
      const speechDuration = 5000;
      const progressInterval = 100;
      const progressTimer = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(100, (elapsed / speechDuration) * 100);
        setVoiceProgress(progress);
        if (elapsed < 1000) setVoiceMessage('Arduino PDM麥克風初始化中...');
        else if (elapsed < 2000) setVoiceMessage('正在採集語音信號...');
        else if (elapsed < 4000) setVoiceMessage('正在分析語音特徵...');
        else if (elapsed < speechDuration) setVoiceMessage('正在計算帕金森症狀指標...');
        else setVoiceMessage('等待Arduino分析結果...');
      }, progressInterval);

      // 超時保護：交由 BLE/Serial 回調觸發完成，10s 無結果視為超時
      setTimeout(() => {
        if (isVoiceAnalyzing) {
          setIsVoiceAnalyzing(false);
          setVoiceMessage('語音分析超時，請重試');
        }
      }, 10000);
    } catch (err) {
      setIsVoiceAnalyzing(false);
      setVoiceMessage('❌ 無法啟動語音分析：' + (err as Error).message);
    }
  };

  const cancelVoiceAnalysis = async () => {
    try { if (writerRef.current) await sendCommand('STOP'); } catch {}
    setIsVoiceAnalyzing(false);
    setVoiceProgress(0);
    setVoiceMessage('已取消語音分析');
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
                  <span className="font-medium text-black dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">帕金森輔助設備</span>
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">語音識別帕金森</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">通過Arduino內建PDM麥克風進行5秒語音採集，分析帕金森症狀特徵（Jitter、Shimmer、HNR等）。</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">⚠️ 請確保Arduino已連接且環境安靜</div>
                <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${voiceProgress}%` }} />
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{voiceMessage}</div>
                <div className="flex gap-2">
                  {!isVoiceAnalyzing ? (
                    <Button onClick={startVoiceAnalysis} disabled={!isConnected} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {!isConnected ? '請先連接Arduino' : '開始Arduino語音分析'}
                    </Button>
                  ) : (
                    <Button onClick={cancelVoiceAnalysis} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">取消分析</Button>
                  )}
                  {!isConnected && (
                    <>
                      <Button onClick={connectSerial} className="border-blue-500 text-white bg-blue-600 hover:bg-blue-700">串口連接</Button>
                      <Button onClick={connectBluetooth} className="border-blue-500 text-white bg-blue-600 hover:bg-blue-700">藍牙連接</Button>
                    </>
                  )}
                  {isConnected && (
                    <Button onClick={disconnect} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">斷開連接</Button>
                  )}
                </div>

                {speechResult && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Arduino語音分析結果</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">分類結果：</span>
                        <span className={`font-medium ${speechResult.class === 1 ? 'text-red-600' : 'text-green-600'}`}>
                          {speechResult.class === 1 ? '檢測到帕金森症狀' : '正常語音'}
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
                        <span className="text-gray-600 dark:text-gray-400">語音活動度：</span>
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

