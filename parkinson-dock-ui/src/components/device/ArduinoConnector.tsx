'use client';

/// &lt;reference path="../../types/web-serial.d.ts" />
import { useState, useEffect, useRef } from 'react';
import { analysisRecordService } from '@/services/analysisRecordService';

interface SensorData {
  fingers: number[];
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  mag: { x: number; y: number; z: number };
}

export interface ArduinoConnectorProps {
  onDataReceived?: (data: Partial<SensorData> & { emg?: number }) => void;
}

export default function ArduinoConnector({ onDataReceived }: ArduinoConnectorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({
    fingers: [0, 0, 0, 0, 0],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 }
  });
  const [port, setPort] = useState<SerialPort | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter | null>(null);
  const writableClosedRef = useRef<Promise<void> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readBufferRef = useRef<string>('');

  // AI分析结果状态
  const [aiAnalysisData, setAiAnalysisData] = useState({
    analysisCount: 0,
    parkinsonLevel: 0,
    parkinsonDescription: '',
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0,
    isAnalyzing: false
  });

  // 檢查瀏覽器是否支持Web Serial API
  const isWebSerialSupported = () => {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serial' in navigator;
  };

  const sendCommand = async (command: string) => {
    try {
      if (!writer) return;
      const payload = command.endsWith('\n') ? command : `${command}\n`;
      await writer.write(payload);
    } catch (e) {
      console.error('串口寫入失敗:', e);
      setError(`串口寫入失敗: ${(e as Error).message}`);
    }
  };

  // 連接Arduino設備
  const connectToArduino = async () => {
    if (!isWebSerialSupported()) {
      setError('您的瀏覽器不支持Web Serial API，請使用Chrome或Edge瀏覽器');
      return;
    }

    try {
      // 請求用戶選擇串口設備
      const selectedPort = await navigator.serial.requestPort();
      // 與 Arduino 韌體 (Serial.begin(9600)) 一致
      await selectedPort.open({ baudRate: 9600 });
      
      setPort(selectedPort);
      setIsConnected(true);
      setError(null);
      
      // 設置讀取器
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
      const newReader = textDecoder.readable.getReader();
      setReader(newReader);
      
      // 設置寫入器
      const textEncoder = new TextEncoderStream();
      writableClosedRef.current = textEncoder.readable.pipeTo(selectedPort.writable);
      const newWriter = textEncoder.writable.getWriter();
      setWriter(newWriter);

      // 開始讀取數據
      readData(newReader);

      // 自動開始數據採集
      await new Promise(r => setTimeout(r, 100));
      await newWriter.write('START\n');
      // 可選: 查詢狀態
      await newWriter.write('STATUS\n');
      
    } catch (err) {
      console.error('連接錯誤:', err);
      setError(`連接失敗: ${(err as Error).message}`);
      setIsConnected(false);
    }
  };

  // 斷開連接
  const disconnectArduino = async () => {
    if (reader) {
      await reader.cancel();
    }
    
    if (writer) {
      try {
        await writer.close();
      } catch {}
      setWriter(null);
    }

    if (writableClosedRef.current) {
      try {
        await writableClosedRef.current;
      } catch {}
      writableClosedRef.current = null;
    }

    if (port) {
      await port.close();
    }
    
    setIsConnected(false);
    setPort(null);
    setReader(null);
  };

  // 讀取串口數據
  const readData = async (currentReader: ReadableStreamDefaultReader) => {
    try {
      while (true) {
        const { value, done } = await currentReader.read();
        if (done) {
          currentReader.releaseLock();
          break;
        }
        
        if (value) {
          // 累積到行緩衝，確保跨 chunk 的資料能完整解析
          readBufferRef.current += value as string;
          const parts = readBufferRef.current.split('\n');
          // 最後一段可能是不完整行，暫存回緩衝
          readBufferRef.current = parts.pop() ?? '';
          for (const line of parts) {
            parseSensorData(line);
          }
        }
      }
    } catch (err) {
      console.error('讀取錯誤:', err);
      setError(`數據讀取錯誤: ${(err as Error).message}`);
      disconnectArduino();
    }
  };

  // 解析傳感器數據
  const parseSensorData = (dataString: string) => {
    try {
      const lines = dataString.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 解析 DATA 格式: DATA,finger1,finger2,finger3,finger4,finger5,emg,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mag_x,mag_y,mag_z
        if (trimmedLine.startsWith('DATA,')) {
          const parts = trimmedLine.split(',');
          if (parts.length >= 16) { // DATA + 15 values (含 accel/gyro/mag)
            // 解析手指數據 (索引 1-5)
            const fingers = [
              parseInt(parts[1]),
              parseInt(parts[2]),
              parseInt(parts[3]),
              parseInt(parts[4]),
              parseInt(parts[5])
            ];

            // 解析 IMU 數據 (索引 7-15)
            const accel = {
              x: parseFloat(parts[7]),
              y: parseFloat(parts[8]),
              z: parseFloat(parts[9])
            };

            const gyro = {
              x: parseFloat(parts[10]),
              y: parseFloat(parts[11]),
              z: parseFloat(parts[12])
            };

            const mag = {
              x: parseFloat(parts[13]),
              y: parseFloat(parts[14]),
              z: parseFloat(parts[15])
            };

            // 更新傳感器數據
            const newSensorData = {
              fingers,
              accel,
              gyro,
              mag,
              emg: parseInt(parts[6]) // EMG 數據在索引 6
            };

            setSensorData(newSensorData as SensorData);
            onDataReceived?.(newSensorData);

            console.log('解析到數據:', newSensorData);
          } else if (parts.length >= 10) { // DATA + 9 values (fingers(5), emg(1), accel(3))
            // 解析手指數據 (索引 1-5)
            const rawFingers = [
              parseInt(parts[1]),
              parseInt(parts[2]),
              parseInt(parts[3]),
              parseInt(parts[4]),
              parseInt(parts[5])
            ];
            // 限幅到 0..1023，避免負值導致 3D 模型反向或 UI 條形圖異常
            const fingers = rawFingers.map(v => Math.max(0, Math.min(1023, v)));

            const accel = {
              x: parseFloat(parts[7]),
              y: parseFloat(parts[8]),
              z: parseFloat(parts[9])
            };

            const newSensorData = {
              fingers,
              accel,
              gyro: { x: 0, y: 0, z: 0 },
              mag: { x: 0, y: 0, z: 0 },
              emg: parseInt(parts[6])
            };

            setSensorData(newSensorData as SensorData);
            onDataReceived?.(newSensorData);
            console.log('解析到數據(簡化格式):', newSensorData);
          }
        }

        // 保留舊格式的兼容性
        // 解析手指彎曲數據
        else if (trimmedLine.startsWith('Fingers:')) {
          const fingersMatch = trimmedLine.match(/Fingers:\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
          if (fingersMatch) {
            const newFingers = [
              parseInt(fingersMatch[1]),
              parseInt(fingersMatch[2]),
              parseInt(fingersMatch[3]),
              parseInt(fingersMatch[4]),
              parseInt(fingersMatch[5])
            ];
            setSensorData(prev => ({
              ...prev,
              fingers: newFingers
            }));
            onDataReceived?.({ fingers: newFingers });
          }
        }

        // 解析加速度計數據
        else if (trimmedLine.startsWith('Accel:')) {
          const accelMatch = trimmedLine.match(/Accel:\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)/);
          if (accelMatch) {
            const newAccel = {
              x: parseFloat(accelMatch[1]),
              y: parseFloat(accelMatch[2]),
              z: parseFloat(accelMatch[3])
            };
            setSensorData(prev => ({
              ...prev,
              accel: newAccel
            }));
            onDataReceived?.({ accel: newAccel });
          }
        }

        // 解析陀螺儀數據
        else if (trimmedLine.startsWith('Gyro:')) {
          const gyroMatch = trimmedLine.match(/Gyro:\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)/);
          if (gyroMatch) {
            const newGyro = {
              x: parseFloat(gyroMatch[1]),
              y: parseFloat(gyroMatch[2]),
              z: parseFloat(gyroMatch[3])
            };
            setSensorData(prev => ({
              ...prev,
              gyro: newGyro
            }));
            onDataReceived?.({ gyro: newGyro });
          }
        }

        // 解析磁力計數據
        else if (trimmedLine.startsWith('Mag:')) {
          const magMatch = trimmedLine.match(/Mag:\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)/);
          if (magMatch) {
            const newMag = {
              x: parseFloat(magMatch[1]),
              y: parseFloat(magMatch[2]),
              z: parseFloat(magMatch[3])
            };
            setSensorData(prev => ({
              ...prev,
              mag: newMag
            }));
            onDataReceived?.({ mag: newMag });
          }
        }

        // 解析AI分析结果
        else if (trimmedLine.includes('=== AI分析結果 ===')) {
          setAiAnalysisData(prev => ({ ...prev, isAnalyzing: true }));
        }
        else if (trimmedLine.startsWith('分析次數:')) {
          const countMatch = trimmedLine.match(/分析次數:\s*(\d+)/);
          if (countMatch) {
            setAiAnalysisData(prev => ({ ...prev, analysisCount: parseInt(countMatch[1]) }));
          }
        }
        else if (trimmedLine.startsWith('帕金森等級:')) {
          const levelMatch = trimmedLine.match(/帕金森等級:\s*(\d+)\s*\(([^)]+)\)/);
          if (levelMatch) {
            setAiAnalysisData(prev => ({
              ...prev,
              parkinsonLevel: parseInt(levelMatch[1]),
              parkinsonDescription: levelMatch[2]
            }));
          }
        }
        else if (trimmedLine.startsWith('置信度:')) {
          const confidenceMatch = trimmedLine.match(/置信度:\s*([\d.]+)%/);
          if (confidenceMatch) {
            setAiAnalysisData(prev => ({ ...prev, confidence: parseFloat(confidenceMatch[1]) }));
          }
        }
        else if (trimmedLine.startsWith('訓練建議:')) {
          const recommendation = trimmedLine.split(':')[1]?.trim();
          if (recommendation) {
            setAiAnalysisData(prev => ({ ...prev, recommendation }));
          }
        }
        else if (trimmedLine.startsWith('建議阻力設定:')) {
          const resistanceMatch = trimmedLine.match(/建議阻力設定:\s*(\d+)度/);
          if (resistanceMatch) {
            setAiAnalysisData(prev => ({ ...prev, recommendedResistance: parseInt(resistanceMatch[1]) }));
          }
        }
        else if (trimmedLine.includes('==================') && aiAnalysisData.isAnalyzing) {
          // AI分析完成，保存记录
          try {
            const record = analysisRecordService.saveRecord({
              analysisCount: aiAnalysisData.analysisCount,
              parkinsonLevel: aiAnalysisData.parkinsonLevel,
              parkinsonDescription: aiAnalysisData.parkinsonDescription,
              confidence: aiAnalysisData.confidence,
              recommendation: aiAnalysisData.recommendation,
              recommendedResistance: aiAnalysisData.recommendedResistance,
              sensorData: {
                fingerPositions: sensorData.fingers.map(v => Math.round((v / 1023) * 100)),
                accelerometer: sensorData.accel,
                gyroscope: sensorData.gyro,
                emg: 0, // EMG数据如果有的话
              },
              source: 'arduino',
            });
            console.log('Arduino AI分析记录已保存:', record);
            setAiAnalysisData(prev => ({ ...prev, isAnalyzing: false }));
          } catch (error) {
            console.error('保存Arduino AI分析记录失败:', error);
          }
        }
      }
    } catch (err) {
      console.error('數據解析錯誤:', err);
      setError(`數據解析錯誤: ${(err as Error).message}`);
    }
  };

  // 組件卸載時斷開連接
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectArduino();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className={`p-4 rounded-full mb-4 ${isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${isConnected ? 'text-green-600 dark:text-green-300' : 'text-blue-600 dark:text-blue-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">帕金森輔助裝置</h2>
        <p className="text-gray-600 dark:text-gray-300">版本 2.0</p>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
          <span>連接狀態</span>
          <span className={`font-semibold ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
            {isConnected ? '已連接' : '未連接'}
          </span>
        </div>
        
        {isConnected && (
          <>
            <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
              <span>裝置序列號</span>
              <span>PD-2023-001</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-neutral-700 rounded-lg">
              <span>韌體版本</span>
              <span>v2.1.4</span>
            </div>
          </>
        )}
      </div>
      
      <div className="mt-8 grid grid-cols-2 gap-4">
        {!isConnected ? (
          <button 
            onClick={connectToArduino}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition"
          >
            連接裝置
          </button>
        ) : (
          <button 
            onClick={disconnectArduino}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition"
          >
            斷開連接
          </button>
        )}
        
        <button 
          className={`bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isConnected}
          onClick={() => sendCommand('START')}
        >
          同步數據
        </button>
      </div>

      {isConnected && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">即時傳感器數據</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">手指彎曲度</h4>
              {sensorData.fingers.map((value, index) => {
                // 將原始傳感器數據 (0-1023) 轉換為百分比 (0-100%)
                const percentage = Math.min(100, Math.max(0, (value / 1023) * 100));
                const displayValue = Math.round(percentage);

                return (
                  <div key={index} className="flex items-center mb-2">
                    <span className="w-16">手指 {index + 1}:</span>
                    <div className="flex-1 ml-2">
                      <div className="w-full bg-gray-300 dark:bg-neutral-600 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-200"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="w-12 text-right text-sm">{displayValue}%</span>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">加速度計 (g)</h4>
              <div className="space-y-2">
                <div>X: {sensorData.accel.x.toFixed(2)}</div>
                <div>Y: {sensorData.accel.y.toFixed(2)}</div>
                <div>Z: {sensorData.accel.z.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
              <h4 className="font-medium mb-2">陀螺儀 (deg/s)</h4>
              <div className="space-y-2">
                <div>X: {sensorData.gyro.x.toFixed(2)}</div>
                <div>Y: {sensorData.gyro.y.toFixed(2)}</div>
                <div>Z: {sensorData.gyro.z.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* AI分析状态显示 */}
          {(aiAnalysisData.analysisCount > 0 || aiAnalysisData.isAnalyzing) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">AI分析結果</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">分析狀態</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>分析次數:</span>
                      <span className="font-medium">{aiAnalysisData.analysisCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>狀態:</span>
                      <span className={`font-medium ${aiAnalysisData.isAnalyzing ? 'text-blue-600' : 'text-green-600'}`}>
                        {aiAnalysisData.isAnalyzing ? '分析中...' : '已完成'}
                      </span>
                    </div>
                  </div>
                </div>

                {aiAnalysisData.parkinsonLevel > 0 && (
                  <div className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">分析結果</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>等級:</span>
                        <span className="font-medium">{aiAnalysisData.parkinsonLevel} ({aiAnalysisData.parkinsonDescription})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>置信度:</span>
                        <span className="font-medium">{aiAnalysisData.confidence.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>建議阻力:</span>
                        <span className="font-medium">{aiAnalysisData.recommendedResistance}度</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {aiAnalysisData.recommendation && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">訓練建議</h4>
                  <p className="text-blue-700 dark:text-blue-300">{aiAnalysisData.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}