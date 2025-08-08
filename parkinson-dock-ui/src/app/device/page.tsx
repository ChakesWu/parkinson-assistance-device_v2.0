'use client';
import HandModel from '@/components/device/HandModel';
import SimpleHand3D from '@/components/device/SimpleHand3D';
import ArduinoConnector, { type ArduinoConnectorProps } from '@/components/device/ArduinoConnector';
import { AnimatedDock } from "@/components/ui/animated-dock";
import { Home, Activity, Book, Settings, Brain, MousePointer, Move3d } from 'lucide-react';
import { useState } from 'react';

// 定义传感器数据类型以匹配HandModel的期望
interface SensorDataForDisplay {
  fingerBend?: number[];
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  magnetometer?: { x: number; y: number; z: number };
}

export default function DevicePage() {
  const [sensorData, setSensorData] = useState<any>(null);
  const [controlMode, setControlMode] = useState<'mouse' | 'imu'>('mouse');
  
  const handleDataReceived: ArduinoConnectorProps['onDataReceived'] = (data) => {
    setSensorData(data);
    console.log('Received sensor data:', data);
  };

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

  // 准备传递给SimpleHand3D的数据
  const fingerBend = sensorData?.fingers || [0, 0, 0, 0, 0];
  const rotation = sensorData?.accel ? {
    x: sensorData.accel.x,
    y: sensorData.accel.y,
    z: sensorData.accel.z
  } : { x: 0, y: 0, z: 0 };

  // 准备传递给HandModel的数据（使用正确的属性名）
  const displayData: SensorDataForDisplay = {
    fingerBend: sensorData?.fingers,
    accelerometer: sensorData?.accel,
    gyroscope: sensorData?.gyro,
    magnetometer: sensorData?.mag
  };

  const toggleControlMode = () => {
    setControlMode(prevMode => prevMode === 'mouse' ? 'imu' : 'mouse');
  };

  return (
    <div className="relative min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">裝置控制</h1>
        
        <div className="mb-6">
          <ArduinoConnector onDataReceived={handleDataReceived} />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-4 lg:col-span-2 h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">3D手部模型控制</h2>
              <button
                onClick={toggleControlMode}
                className={`flex items-center px-4 py-2 rounded-full transition ${
                  controlMode === 'mouse'
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-500 text-white'
                }`}
              >
                {controlMode === 'mouse' ? (
                  <>
                    <MousePointer size={18} className="mr-2" />
                    鼠標控制
                  </>
                ) : (
                  <>
                    <Move3d size={18} className="mr-2" />
                    IMU控制
                  </>
                )}
              </button>
            </div>
            
            <div className="w-full h-[calc(100%-60px)]">
              <SimpleHand3D
                sensorData={{
                  fingers: fingerBend,
                  rotation: controlMode === 'imu' ? rotation : { x:0, y:0, z:0 }
                }}
              />
            </div>
          </div>
          
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">實時傳感器數據</h2>
            <HandModel sensorData={displayData} />
          </div>
        </div>
      </div>

      {/* 添加懸浮按鈕 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <AnimatedDock items={dockItems} />
      </div>
    </div>
  );
}