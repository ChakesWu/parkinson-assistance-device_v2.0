'use client';

import React from 'react';

interface SensorData {
  fingerBend?: number[];
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  magnetometer?: { x: number; y: number; z: number };
}

export default function HandModel({ sensorData }: { sensorData: SensorData | null }) {
  // 如果没有传感器数据，显示提示信息
  if (!sensorData) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-gray-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-700">未接收到傳感器數據</p>
      </div>
    );
  }

  const fingerBend = sensorData.fingerBend || [0, 0, 0, 0, 0];
  const accelerometer = sensorData.accelerometer || { x: 0, y: 0, z: 0 };
  const gyroscope = sensorData.gyroscope || { x: 0, y: 0, z: 0 };
  const magnetometer = sensorData.magnetometer || { x: 0, y: 0, z: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">手指彎曲度</h3>
        <div className="space-y-3">
          {fingerBend.map((value, index) => (
            <div key={index} className="flex items-center">
              <span className="w-24">手指 {index + 1}:</span>
              <div className="flex-1 ml-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${value}%` }}
                  ></div>
                </div>
              </div>
              <span className="w-10 text-right">{value}%</span>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="font-medium mb-2">加速度計 (g)</h3>
        <div className="space-y-2">
          <div>X: {accelerometer.x.toFixed(2)}</div>
          <div>Y: {accelerometer.y.toFixed(2)}</div>
          <div>Z: {accelerometer.z.toFixed(2)}</div>
        </div>
      </div>
      
      <div>
        <h3 className="font-medium mb-2">陀螺儀 (deg/s)</h3>
        <div className="space-y-2">
          <div>X: {gyroscope.x.toFixed(2)}</div>
          <div>Y: {gyroscope.y.toFixed(2)}</div>
          <div>Z: {gyroscope.z.toFixed(2)}</div>
        </div>
      </div>
      
      <div>
        <h3 className="font-medium mb-2">磁力計 (μT)</h3>
        <div className="space-y-2">
          <div>X: {magnetometer.x.toFixed(2)}</div>
          <div>Y: {magnetometer.y.toFixed(2)}</div>
          <div>Z: {magnetometer.z.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}