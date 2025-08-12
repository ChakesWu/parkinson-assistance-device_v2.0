'use client';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">作品简介</h1>
          <p className="text-gray-700 dark:text-gray-300 leading-7">
            本作品基于 LSTM 与 CNN 的混合模型，对帕金森手部运动、IMU、EMG 与语音等多模态数据进行分析，
            以生成可用于康复训练与设备调参的综合建议。系统包含设备端数据采集、网页端实时可视化与分析、
            历史记录保存与导出等功能，旨在为康复训练与科研评估提供轻量易用的一体化平台。
          </p>
        </div>
      </main>
    </div>
  );
}

