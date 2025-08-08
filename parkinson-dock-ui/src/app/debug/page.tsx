'use client';

import { useState, useEffect } from 'react';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { Home, Activity, Book, Settings, Brain } from 'lucide-react';

interface SensorData {
  fingers?: number[];
  accel?: { x: number; y: number; z: number };
  gyro?: { x: number; y: number; z: number };
  mag?: { x: number; y: number; z: number };
}

export default function DebugPage() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'未連接' | '已連接' | '連接中'>('未連接');
  const [controlMode, setControlMode] = useState<'mouse' | 'imu'>('mouse');

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

  // 模拟从localStorage或其他地方获取数据
  useEffect(() => {
    const interval = setInterval(() => {
      // 这里可以从全局状态或localStorage获取实时数据
      const storedData = localStorage.getItem('sensorData');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setSensorData(data);
          setConnectionStatus('已連接');
        } catch (error) {
          console.error('Error parsing sensor data:', error);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const rotation = sensorData?.accel ? {
    x: Math.atan2(sensorData.accel.y, sensorData.accel.z),
    y: Math.atan2(-sensorData.accel.x, Math.sqrt(sensorData.accel.y * sensorData.accel.y + sensorData.accel.z * sensorData.accel.z)),
    z: 0
  } : { x: 0, y: 0, z: 0 };

  return (
    <div className="relative min-h-screen">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">調試信息</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 連接狀態 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">連接狀態</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>狀態:</span>
              <span className={`font-medium ${
                connectionStatus === '已連接' ? 'text-green-500' : 
                connectionStatus === '連接中' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {connectionStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span>控制模式:</span>
              <span className="font-medium">{controlMode}</span>
            </div>
          </div>
        </div>

        {/* 旋轉角度 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">旋轉角度</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>X軸:</span>
              <span className="font-mono">{rotation.x.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Y軸:</span>
              <span className="font-mono">{rotation.y.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Z軸:</span>
              <span className="font-mono">{rotation.z.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* 手指數據 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">手指數據</h2>
          <div className="space-y-3">
            {sensorData?.fingers ? (
              sensorData.fingers.map((value, index) => (
                <div key={index} className="flex justify-between">
                  <span>手指 {index + 1}:</span>
                  <span className="font-mono">{value.toFixed(3)}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500">無數據</div>
            )}
          </div>
        </div>

        {/* 加速度計數據 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">加速度計</h2>
          <div className="space-y-3">
            {sensorData?.accel ? (
              <>
                <div className="flex justify-between">
                  <span>X軸:</span>
                  <span className="font-mono">{sensorData.accel.x.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Y軸:</span>
                  <span className="font-mono">{sensorData.accel.y.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Z軸:</span>
                  <span className="font-mono">{sensorData.accel.z.toFixed(3)}</span>
                </div>
              </>
            ) : (
              <div className="text-gray-500">無數據</div>
            )}
          </div>
        </div>

        {/* 陀螺儀數據 */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-lg md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">陀螺儀數據</h2>
          <div className="grid grid-cols-3 gap-4">
            {sensorData?.gyro ? (
              <>
                <div className="text-center">
                  <div className="text-sm text-gray-500">X軸</div>
                  <div className="font-mono text-lg">{sensorData.gyro.x.toFixed(3)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Y軸</div>
                  <div className="font-mono text-lg">{sensorData.gyro.y.toFixed(3)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Z軸</div>
                  <div className="font-mono text-lg">{sensorData.gyro.z.toFixed(3)}</div>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center text-gray-500">無數據</div>
            )}
          </div>
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
