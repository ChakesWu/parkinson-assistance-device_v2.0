'use client';

import React, { useState } from 'react';
import { AnimatedDock } from '@/components/ui/animated-dock';
import { Home, Activity, Book, Settings, Brain } from 'lucide-react';


export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [vibration, setVibration] = useState(false);
  const [dataSharing, setDataSharing] = useState(true);

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
      <main className="container mx-auto py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8">系统设置</h1>

        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg overflow-hidden">
          {/* 外观设置 */}
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
            <h2 className="text-xl font-semibold mb-4">外观</h2>
            <div className="flex items-center justify-between py-3">
              <span>深色模式</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${darkMode ? 'left-7' : 'left-1'}`}
                ></span>
              </button>
            </div>
          </div>

          {/* 通知设置 */}
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
            <h2 className="text-xl font-semibold mb-4">通知</h2>
            <div className="flex items-center justify-between py-3">
              <span>启用通知</span>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications ? 'left-7' : 'left-1'}`}
                ></span>
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <span>震动提示</span>
              <button
                onClick={() => setVibration(!vibration)}
                className={`relative w-12 h-6 rounded-full transition-colors ${vibration ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${vibration ? 'left-7' : 'left-1'}`}
                ></span>
              </button>
            </div>
          </div>

          {/* 数据设置 */}
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
            <h2 className="text-xl font-semibold mb-4">数据与隐私</h2>
            <div className="flex items-center justify-between py-3">
              <span>共享匿名数据</span>
              <button
                onClick={() => setDataSharing(!dataSharing)}
                className={`relative w-12 h-6 rounded-full transition-colors ${dataSharing ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${dataSharing ? 'left-7' : 'left-1'}`}
                ></span>
              </button>
            </div>
          </div>

          {/* 账号设置 */}
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">账号</h2>
            <div className="flex items-center justify-between py-3">
              <span>登出</span>
              <button className="text-blue-500 hover:text-blue-700">
                点击登出
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-red-500">删除账号</span>
              <button className="text-red-500 hover:text-red-700">
                永久删除
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 添加悬浮动态按钮 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </div>
  );
}