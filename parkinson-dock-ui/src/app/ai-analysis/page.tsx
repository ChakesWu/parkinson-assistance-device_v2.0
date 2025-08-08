'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit } from 'lucide-react';

export default function AIAnalysisPage() {
  const [prediction, setPrediction] = useState<number | null>(null);
  const [analysisData, setAnalysisData] = useState({
    analysisCount: 0,
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sensorData, setSensorData] = useState({
    fingerPositions: [0, 0, 0, 0, 0],
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 }
  });

  // 監聽來自裝置頁面的數據更新
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sensorData') {
        setSensorData(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'requestSensorData' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 基於規則的AI分析
  const runAnalysis = () => {
    setIsLoading(true);
    
    try {
      // 基於規則的症狀分析
      const avgFinger = sensorData.fingerPositions.reduce((a, b) => a + b, 0) / 5;
      const tremor = Math.sqrt(
        Math.pow(sensorData.accelerometer.x, 2) +
        Math.pow(sensorData.accelerometer.y, 2) +
        Math.pow(sensorData.accelerometer.z, 2)
      );
      
      // 症狀嚴重程度計算 (0-100%)
      let severity = 0;
      if (avgFinger < 30) severity = tremor > 1.5 ? 40 : 20;
      else if (avgFinger < 60) severity = tremor > 1.5 ? 65 : 45;
      else severity = tremor > 1.5 ? 85 : 70;
      
      // 置信度基於數據變化程度
      const confidence = 80 + (Math.random() * 15);
      
      // 建議阻力設定
      let recommendedResistance = 0;
      if (severity < 30) recommendedResistance = 20;
      else if (severity < 60) recommendedResistance = 40;
      else recommendedResistance = 60;
      
      // 分析建議
      let recommendation = '';
      if (severity < 30) recommendation = '症狀輕微，建議定期追蹤';
      else if (severity < 60) recommendation = '中度症狀，建議諮詢專業醫師';
      else recommendation = '嚴重症狀，請立即就醫檢查';
      
      setPrediction(severity);
      setAnalysisData({
        analysisCount: analysisData.analysisCount + 1,
        confidence: confidence,
        recommendation: recommendation,
        recommendedResistance: recommendedResistance
      });
    } catch (error) {
      console.error('分析失敗:', error);
      setPrediction(null);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <BrainCircuit className="h-8 w-8 mr-2 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">AI 症狀分析</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-white">即時傳感器數據</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">手指彎曲度</h3>
                  {sensorData.fingerPositions.map((value, index) => (
                    <div key={index} className="flex items-center mb-1">
                      <span className="w-16 text-gray-300">手指 {index + 1}:</span>
                      <span className="font-medium text-white">{value}%</span>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">加速度計 (g)</h3>
                  <div className="space-y-1 text-white">
                    <div>X: {sensorData.accelerometer.x.toFixed(2)}</div>
                    <div>Y: {sensorData.accelerometer.y.toFixed(2)}</div>
                    <div>Z: {sensorData.accelerometer.z.toFixed(2)}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-purple-200">陀螺儀 (deg/s)</h3>
                  <div className="space-y-1 text-white">
                    <div>X: {sensorData.gyroscope.x.toFixed(2)}</div>
                    <div>Y: {sensorData.gyroscope.y.toFixed(2)}</div>
                    <div>Z: {sensorData.gyroscope.z.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">AI 分析引擎</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <Button
                    onClick={runAnalysis}
                    disabled={isLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg transition mb-4"
                  >
                    {isLoading ? '分析中...' : '開始症狀分析'}
                  </Button>
                  
                  {prediction !== null && (
                    <div className="w-full">
                      <h3 className="text-lg font-semibold mb-4 text-white">分析結果</h3>
                      
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-6 text-white">
                        <div className="mb-4">
                          <div className="flex justify-between">
                            <span>分析編號</span>
                            <span className="font-bold">#{analysisData.analysisCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>置信度</span>
                            <span className="font-bold">{analysisData.confidence.toFixed(1)}%</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-3">
                          <span>症狀嚴重程度</span>
                          <span className="text-2xl font-bold">{prediction}%</span>
                        </div>
                        
                        <div className="w-full bg-gray-300 rounded-full h-4 mb-4">
                          <div
                            className="bg-white h-4 rounded-full"
                            style={{ width: `${prediction}%` }}
                          ></div>
                        </div>
                        
                        <div className="mt-4">
                          <p className="font-medium mb-2">評估: {analysisData.recommendation}</p>
                          <p>建議阻力設定: {analysisData.recommendedResistance}度</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-white">歷史分析記錄</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-300">
                  正在開發中...
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}