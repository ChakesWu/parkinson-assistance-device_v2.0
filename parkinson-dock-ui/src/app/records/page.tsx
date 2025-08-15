'use client';

import React, { useState, useEffect } from 'react';
import { AnimatedDock } from '@/components/ui/animated-dock';
import { Home, Activity, Book, Settings, Brain, Download, Trash2, Filter, Calendar, Upload, RefreshCw } from 'lucide-react';
import { analysisRecordService, AnalysisRecord, AnalysisStatistics } from '@/services/analysisRecordService';


export default function RecordsPage() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [statistics, setStatistics] = useState<AnalysisStatistics | null>(null);
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

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

  // 加载记录和统计信息
  useEffect(() => {
    console.log('Records 页面载入，开始载入记录...');
    console.log('localStorage 可用性:', typeof Storage !== 'undefined');
    console.log('当前 localStorage 内容:', localStorage.getItem('parkinson_analysis_records'));
    loadRecords();
    loadStatistics();
  }, [filterLevel]);

  const loadRecords = () => {
    let allRecords = analysisRecordService.getAllRecords();
    console.log('加载记录:', allRecords.length, '条记录');
    if (filterLevel !== null) {
      allRecords = analysisRecordService.getRecordsByLevel(filterLevel);
      console.log('筛选后记录:', allRecords.length, '条记录');
    }
    setRecords(allRecords);
  };

  const loadStatistics = () => {
    const stats = analysisRecordService.getStatistics();
    setStatistics(stats);
  };

  const handleDeleteRecord = (id: string) => {
    if (analysisRecordService.deleteRecord(id)) {
      loadRecords();
      loadStatistics();
      setShowDeleteConfirm(null);
    }
  };

  const handleExportRecords = () => {
    const exportData = analysisRecordService.exportRecords();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parkinson_analysis_records_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportRecords = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        const result = analysisRecordService.importRecords(jsonData);

        if (result.success) {
          alert(`成功导入 ${result.imported} 条记录${result.errors.length > 0 ? `，${result.errors.length} 条记录有错误` : ''}`);
          loadRecords();
          loadStatistics();
        } else {
          alert(`导入失败：${result.errors.join(', ')}`);
        }
      } catch (error) {
        alert('文件格式错误');
      }
    };
    reader.readAsText(file);
    setShowImportDialog(false);
  };

  const handleClearAllRecords = () => {
    analysisRecordService.clearAllRecords();
    loadRecords();
    loadStatistics();
    setShowClearConfirm(false);
  };

  const createSampleRecords = () => {
    // 创建一些示例记录用于测试
    const sampleRecords = [
      {
        analysisCount: 1,
        parkinsonLevel: 2,
        parkinsonDescription: '轻度',
        confidence: 85.3,
        recommendation: '建议进行中等强度的手指灵活性训练',
        recommendedResistance: 45,
        sensorData: {
          fingerPositions: [45, 52, 38, 41, 49],
          accelerometer: { x: 0.12, y: -0.34, z: 0.98 },
          gyroscope: { x: 1.2, y: -0.8, z: 0.3 },
          emg: 234,
        },
        analysisDetails: {
          tremorFrequency: 4.2,
          graspQuality: 68.5,
          emgRms: 156.7,
          overallSeverity: 42.3,
        },
        source: 'arduino' as const,
        duration: 10,
      },
      {
        analysisCount: 2,
        parkinsonLevel: 1,
        parkinsonDescription: '轻微',
        confidence: 92.1,
        recommendation: '继续保持当前训练强度，注意手指协调性',
        recommendedResistance: 30,
        sensorData: {
          fingerPositions: [38, 42, 35, 39, 44],
          accelerometer: { x: 0.08, y: -0.28, z: 1.02 },
          gyroscope: { x: 0.8, y: -0.5, z: 0.2 },
          emg: 198,
        },
        analysisDetails: {
          tremorFrequency: 3.1,
          graspQuality: 72.8,
          emgRms: 142.3,
          overallSeverity: 28.7,
        },
        source: 'web-analysis' as const,
        duration: 10,
      },
      {
        analysisCount: 3,
        parkinsonLevel: 3,
        parkinsonDescription: '中度',
        confidence: 78.9,
        recommendation: '需要增加训练强度，重点改善震颤控制',
        recommendedResistance: 60,
        sensorData: {
          fingerPositions: [52, 58, 45, 48, 55],
          accelerometer: { x: 0.18, y: -0.42, z: 0.94 },
          gyroscope: { x: 2.1, y: -1.3, z: 0.7 },
          emg: 287,
        },
        analysisDetails: {
          tremorFrequency: 5.8,
          graspQuality: 58.2,
          emgRms: 198.4,
          overallSeverity: 65.1,
        },
        source: 'arduino' as const,
        duration: 10,
      },
    ];

    sampleRecords.forEach(record => {
      analysisRecordService.saveRecord(record);
    });

    loadRecords();
    loadStatistics();
  };

  // 直接测试localStorage
  const testLocalStorage = () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        alert('localStorage 不可用');
        return;
      }

      console.log('测试 localStorage...');

      // 直接写入测试数据
      const testData = [{
        id: 'test-123',
        timestamp: new Date().toISOString(),
        analysisCount: 1,
        parkinsonLevel: 2,
        parkinsonDescription: '测试',
        confidence: 85,
        recommendation: '测试建议',
        recommendedResistance: 45,
        source: 'web-analysis'
      }];

      localStorage.setItem('parkinson_analysis_records', JSON.stringify(testData));
      console.log('测试数据已写入 localStorage');

      // 读取验证
      const stored = localStorage.getItem('parkinson_analysis_records');
      console.log('读取的数据:', stored);

      loadRecords();
      loadStatistics();

      alert('localStorage 测试完成，请检查控制台');
    } catch (error) {
      console.error('localStorage 测试失败:', error);
      alert('localStorage 测试失败');
    }
  };

  const getSeverityColor = (level: number) => {
    if (level <= 1) return 'bg-green-100 text-green-800';
    if (level <= 2) return 'bg-yellow-100 text-yellow-800';
    if (level <= 3) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getSeverityText = (level: number) => {
    const levels = ['正常', '轻微', '轻度', '中度', '重度', '严重'];
    return levels[level] || '未知';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <main className="container mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">AI分析记录</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload size={16} />
              导入记录
            </button>
            <button
              onClick={handleExportRecords}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              导出记录
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              disabled={records.length === 0}
            >
              <Trash2 size={16} />
              清空记录
            </button>
            <button
              onClick={() => { loadRecords(); loadStatistics(); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <button
              onClick={testLocalStorage}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              测试存储
            </button>
          </div>
        </div>

        {/* 统计信息卡片 */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">总分析次数</h3>
              <p className="text-2xl font-bold text-blue-600">{statistics.totalAnalyses}</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">平均等级</h3>
              <p className="text-2xl font-bold text-orange-600">{statistics.averageLevel}</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">平均置信度</h3>
              <p className="text-2xl font-bold text-green-600">{statistics.averageConfidence}%</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">趋势</h3>
              <p className={`text-2xl font-bold ${
                statistics.recentTrend === 'improving' ? 'text-green-600' :
                statistics.recentTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {statistics.recentTrend === 'improving' ? '改善' :
                 statistics.recentTrend === 'declining' ? '恶化' : '稳定'}
              </p>
            </div>
          </div>
        )}

        {/* 筛选器 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow mb-6">
          <div className="flex items-center gap-4">
            <Filter size={16} />
            <span className="font-medium">筛选条件：</span>
            <select
              value={filterLevel || ''}
              onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1 border rounded-md dark:bg-neutral-700 dark:border-neutral-600"
            >
              <option value="">所有等级</option>
              <option value="0">正常 (0级)</option>
              <option value="1">轻微 (1级)</option>
              <option value="2">轻度 (2级)</option>
              <option value="3">中度 (3级)</option>
              <option value="4">重度 (4级)</option>
              <option value="5">严重 (5级)</option>
            </select>
          </div>
        </div>

        {/* 记录列表 */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg">
          {records.length === 0 ? (
            <div className="p-8 text-center">
              <Brain size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">暂无分析记录</h3>
              <p className="text-gray-400 mb-4">开始进行AI分析后，记录将显示在这里</p>
              <button
                onClick={createSampleRecords}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建示例记录
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-neutral-700">
              {records.map((record) => (
                <div key={record.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        分析 #{record.analysisCount}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(record.parkinsonLevel)}`}>
                        {getSeverityText(record.parkinsonLevel)} ({record.parkinsonLevel}级)
                      </span>
                      <span className="text-sm text-gray-500">
                        来源: {record.source === 'arduino' ? 'Arduino设备' : record.source === 'web-analysis' ? '网页分析' : '手动输入'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {formatDate(record.timestamp)}
                      </span>
                      <button
                        onClick={() => setShowDeleteConfirm(record.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-neutral-700 p-3 rounded">
                      <p className="text-sm text-gray-500 dark:text-gray-400">置信度</p>
                      <p className="font-medium">{record.confidence}%</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-neutral-700 p-3 rounded">
                      <p className="text-sm text-gray-500 dark:text-gray-400">建议阻力</p>
                      <p className="font-medium">{record.recommendedResistance}度</p>
                    </div>
                    {record.duration && (
                      <div className="bg-gray-50 dark:bg-neutral-700 p-3 rounded">
                        <p className="text-sm text-gray-500 dark:text-gray-400">分析时长</p>
                        <p className="font-medium">{record.duration}秒</p>
                      </div>
                    )}
                  </div>

                  {record.recommendation && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">训练建议</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{record.recommendation}</p>
                    </div>
                  )}

                  {record.analysisDetails && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {record.analysisDetails.tremorFrequency && (
                        <div>
                          <span className="text-gray-500">震颤频率: </span>
                          <span className="font-medium">{record.analysisDetails.tremorFrequency.toFixed(2)} Hz</span>
                        </div>
                      )}
                      {record.analysisDetails.graspQuality && (
                        <div>
                          <span className="text-gray-500">抓握质量: </span>
                          <span className="font-medium">{record.analysisDetails.graspQuality.toFixed(1)}%</span>
                        </div>
                      )}
                      {record.analysisDetails.emgRms && (
                        <div>
                          <span className="text-gray-500">EMG RMS: </span>
                          <span className="font-medium">{record.analysisDetails.emgRms.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 删除确认对话框 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold mb-4">确认删除</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                确定要删除这条分析记录吗？此操作无法撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeleteRecord(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 清空记录确认对话框 */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold mb-4">确认清空所有记录</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                确定要清空所有分析记录吗？此操作无法撤销，将删除 {records.length} 条记录。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleClearAllRecords}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 导入记录对话框 */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold mb-4">导入分析记录</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                选择要导入的JSON格式记录文件。
              </p>
              <div className="mb-6">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportRecords}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-neutral-700 dark:border-neutral-600"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 添加悬浮动态按钮 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </div>
  );
}