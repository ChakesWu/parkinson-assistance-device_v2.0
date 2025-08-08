'use client';

import React from 'react';
import { AnimatedDock } from '@/components/ui/animated-dock';
import { Home, Activity, Book, Settings, Brain } from 'lucide-react';


export default function RecordsPage() {
  // 動態按鈕配置
  const dockItems = [
    {
      link: "/",
      Icon: <Home size={22} />,
    },
    {
      link: "/device",
      Icon: <Activity size={22} />,
    },
    {
      link: "/records",
      Icon: <Book size={22} />,
    },
    {
      link: "/ai-analysis",
      Icon: <Brain size={22} />,
    },
    {
      link: "/settings",
      Icon: <Settings size={22} />,
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <main className="container mx-auto py-12">
        <h1 className="text-3xl font-bold text-center mb-8">數據記錄</h1>
        
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg max-w-4xl mx-auto">
          <p className="text-lg mb-6">這裡顯示歷史數據記錄和分析結果</p>
          
          <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">2023-11-15 記錄</h2>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">中等震顫</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">持續時間</p>
                <p className="font-medium">45分鐘</p>
              </div>
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">平均頻率</p>
                <p className="font-medium">5.2Hz</p>
              </div>
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">最大幅度</p>
                <p className="font-medium">0.78g</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">2023-11-10 記錄</h2>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">輕微震顫</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">持續時間</p>
                <p className="font-medium">22分鐘</p>
              </div>
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">平均頻率</p>
                <p className="font-medium">3.8Hz</p>
              </div>
              <div className="bg-white dark:bg-neutral-600 p-3 rounded">
                <p className="text-sm text-gray-500">最大幅度</p>
                <p className="font-medium">0.42g</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 添加懸浮動態按鈕 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </div>
  );
}