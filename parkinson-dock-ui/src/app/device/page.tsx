'use client';
import HandModel from '@/components/device/HandModel';
import SimpleHand3D from '@/components/device/SimpleHand3D';
import GlobalConnector from '@/components/device/GlobalConnector';
import { useConnectionState } from '@/hooks/useGlobalConnection';
import { SensorData } from '@/utils/bluetoothManager';
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { AnimatedDock } from "@/components/ui/animated-dock";
import { LayoutDashboard, Bug, Settings, MousePointer, Move3d, User, Home, Activity, Book, Brain } from 'lucide-react';
import { useState } from 'react';
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { analysisRecordService } from '@/services/analysisRecordService';

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
  const [open, setOpen] = useState(false);

  const handleDataReceived = (data: Partial<SensorData>) => {
    console.log('🔄 Device page received sensor data:', data);
    setSensorData((prev: any) => {
      const newData = { ...(prev || {}), ...(data || {}) };
      console.log('📊 Updated sensor data state:', newData);
      return newData;
    });

    // 保存到localStorage供调试页面使用
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('sensorData', JSON.stringify(data));
    }

    // 調試信息：顯示接收到的數據
    if (data.fingers) {
      console.log('👆 手指數據:', data.fingers);
    }
    if (data.accel) {
      console.log('📱 加速度計數據:', data.accel);
    }
    if (data.gyro) {
      console.log('🌀 陀螺儀數據:', data.gyro);
    }
  };

  const links = [
    {
      label: "數據台",
      href: "/device",
      icon: (
        <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "調試信息",
      href: "/debug",
      icon: (
        <Bug className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "設置",
      href: "/settings",
      icon: (
        <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

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

  // 將 IMU 加速度計數據轉換為旋轉角度（弧度）
  const rotation = sensorData?.accel ? {
    x: Math.atan2(sensorData.accel.y, sensorData.accel.z), // 繞 X 軸旋轉
    y: Math.atan2(-sensorData.accel.x, Math.sqrt(sensorData.accel.y * sensorData.accel.y + sensorData.accel.z * sensorData.accel.z)), // 繞 Y 軸旋轉
    z: 0 // 繞 Z 軸旋轉（可以使用陀螺儀數據）
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

  // 测试函数：模拟传感器数据
  const testSensorData = () => {
    const testData = {
      fingers: [200, 300, 400, 500, 600],
      accel: { x: 0.1, y: 0.2, z: 0.9 },
      gyro: { x: 0.05, y: -0.1, z: 0.02 },
      mag: { x: 0, y: 0, z: 0 },
      emg: 100
    };
    console.log('🧪 Testing with simulated data:', testData);
    handleDataReceived(testData);
  };

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
        "h-screen"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Admin",
                href: "#",
                icon: (
                  <User className="h-7 w-7 flex-shrink-0 rounded-full text-neutral-700 dark:text-neutral-200" />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <Dashboard
        sensorData={sensorData}
        controlMode={controlMode}
        onDataReceived={handleDataReceived}
        onToggleControlMode={toggleControlMode}
        fingerBend={fingerBend}
        rotation={rotation}
        displayData={displayData}
        dockItems={dockItems}
        testSensorData={testSensorData}
      />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        帕金森輔助設備
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};

// Dashboard component with all original device functionality
const Dashboard = ({
  sensorData,
  controlMode,
  onDataReceived,
  onToggleControlMode,
  fingerBend,
  rotation,
  displayData,
  dockItems,
  testSensorData
}: {
  sensorData: any;
  controlMode: 'mouse' | 'imu';
  onDataReceived: (data: Partial<SensorData>) => void;
  onToggleControlMode: () => void;
  fingerBend: number[];
  rotation: { x: number; y: number; z: number };
  displayData: SensorDataForDisplay;
  dockItems: any[];
  testSensorData: () => void;
}) => {
  return (
    <div className="flex flex-1 relative">
      <div className="p-2 md:p-6 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-4 flex-1 w-full h-full overflow-y-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">數據台</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={testSensorData}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition text-sm"
            >
              🧪 測試數據
            </button>
            <div className="text-sm text-gray-500">
              連接狀態: {sensorData ? '已連接' : '未連接'} |
              旋轉角度: X:{rotation.x.toFixed(3)}, Y:{rotation.y.toFixed(3)}, Z:{rotation.z.toFixed(3)} |
              控制模式: {controlMode}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <GlobalConnector
            onDataReceived={onDataReceived}
            showSensorData={true}
            showConnectionControls={true}
            compact={false}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-4 lg:col-span-2 h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">3D手部模型控制</h2>
              <button
                onClick={onToggleControlMode}
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

          <div className="bg-gray-100 dark:bg-neutral-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">實時傳感器數據</h2>

            {/* 調試信息顯示 */}
            <div className="mb-4 p-3 bg-white dark:bg-gray-700 rounded">
              <h3 className="font-medium mb-2">調試信息</h3>
              <div className="text-sm space-y-1">
                <div>連接狀態: {sensorData ? '已連接' : '未連接'}</div>
                {sensorData?.fingers && (
                  <div>
                    <div>手指數據 (原始): [{sensorData.fingers.join(', ')}]</div>
                    <div>手指數據 (百分比): [{sensorData.fingers.map(v => Math.round((v / 1023) * 100)).join('%, ')}%]</div>
                  </div>
                )}
                {sensorData?.accel && (
                  <div>加速度計: X:{sensorData.accel.x.toFixed(3)}, Y:{sensorData.accel.y.toFixed(3)}, Z:{sensorData.accel.z.toFixed(3)}</div>
                )}
                {sensorData?.gyro && (
                  <div>陀螺儀: X:{sensorData.gyro.x.toFixed(3)}, Y:{sensorData.gyro.y.toFixed(3)}, Z:{sensorData.gyro.z.toFixed(3)}</div>
                )}
                <div>旋轉角度: X:{rotation.x.toFixed(3)}, Y:{rotation.y.toFixed(3)}, Z:{rotation.z.toFixed(3)}</div>
                <div>控制模式: {controlMode}</div>
              </div>
            </div>

            <HandModel sensorData={displayData} />
          </div>
        </div>

        {/* 添加懸浮動態按鈕 */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <AnimatedDock items={dockItems} />
        </div>
      </div>
    </div>
  );
};