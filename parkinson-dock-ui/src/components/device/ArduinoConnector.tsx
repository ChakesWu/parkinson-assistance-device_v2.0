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

  // 初始化相关状态
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [fingerBaselines, setFingerBaselines] = useState<number[]>([0, 0, 0, 0, 0]);

  // 電位器方向設置
  const [potentiometerReversed, setPotentiometerReversed] = useState(false);

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

  // 舵机设置状态（拇指到小指）
  const [servoInitialAngles, setServoInitialAngles] = useState<number[]>([90, 90, 90, 90, 90]);
  const [servoMinAngles, setServoMinAngles] = useState<number[]>([10, 10, 10, 10, 10]);
  const [servoMaxAngles, setServoMaxAngles] = useState<number[]>([170, 170, 170, 170, 170]);
  const [showTrainingConfirm, setShowTrainingConfirm] = useState(false);

  const updateArrayValue = (arr: number[], idx: number, val: number) => {
    const next = [...arr];
    next[idx] = Math.max(0, Math.min(180, Math.round(val)));
    return next;
  };

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
      // 與 Arduino 韌體 (Serial.begin(115200)) 一致
      await selectedPort.open({ baudRate: 115200 });
      
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

      // 重置初始化状态
      setIsInitializing(false);
      setInitializationComplete(false);
      setFingerBaselines([0, 0, 0, 0, 0]);
      setIsConnected(true);

      // 連接成功後等待設備穩定
      await new Promise(r => setTimeout(r, 1000));
      console.log('🔄 串口設備已連接，開始重新初始化...');
      console.log('📋 請確保手指完全伸直，準備進行基線校準');

      // 查詢狀態
      await newWriter.write('STATUS\n');

      // 等待一下再開始初始化，確保設備響應
      await new Promise(r => setTimeout(r, 500));

      // Arduino會自動處理校準，前端只需要調整方向
      console.log('🚀 串口連接：Arduino將自動處理校準');
      
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

        // 添加調試信息
        console.log('📥 收到串口數據:', trimmedLine);

        // 處理初始化完成信號
        if (trimmedLine === 'INIT_COMPLETE') {
          console.log('✅ Arduino設備初始化完成！');
          // Arduino初始化完成後，開始網頁端初始化
          startWebInitialization();
          return;
        }

        // 解析 DATA 格式: DATA,thumb,index,middle,ring,pinky,emg,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mag_x,mag_y,mag_z
        // 左手邏輯：finger1=拇指, finger2=食指, finger3=中指, finger4=無名指, finger5=小指
        if (trimmedLine.startsWith('DATA,')) {
          const parts = trimmedLine.split(',');
          console.log('📊 解析DATA，parts長度:', parts.length, 'parts:', parts);

          if (parts.length >= 16) { // DATA + 15 values (含 accel/gyro/mag)
            // 解析原始手指數據 (索引 1-5) - 左手順序：拇指到小指
            const rawFingers = [
              parseInt(parts[1]),  // 拇指原始值
              parseInt(parts[2]),  // 食指原始值
              parseInt(parts[3]),  // 中指原始值
              parseInt(parts[4]),  // 無名指原始值
              parseInt(parts[5])   // 小指原始值
            ];

            // 處理電位器方向調整
            const processedFingers = adjustFingerDirection(rawFingers);

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
              fingers: processedFingers,
              accel,
              gyro,
              mag,
              emg: parseInt(parts[6]) // EMG 數據在索引 6
            };

            setSensorData(newSensorData as SensorData);
            onDataReceived?.(newSensorData);

            if (isInitializing) {
              console.log('初始化中，原始數據:', rawFingers, '處理後:', processedFingers);
            }
          } else if (parts.length >= 10) { // DATA + 9 values (fingers(5), emg(1), accel(3))
            // 解析手指數據 (索引 1-5) - 左手順序：拇指到小指
            const rawFingers = [
              parseInt(parts[1]),  // 拇指 (finger1)
              parseInt(parts[2]),  // 食指 (finger2)
              parseInt(parts[3]),  // 中指 (finger3)
              parseInt(parts[4]),  // 無名指 (finger4)
              parseInt(parts[5])   // 小指 (finger5)
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
            // 分析完成后弹出20秒训练确认
            setShowTrainingConfirm(true);
          } catch (error) {
            console.error('保存Arduino AI分析记录失败:', error);
          }
        }

        // 解析舵机配置回显：SERVO_CFG,OK,zero(5),min(5),max(5),dir(5)
        if (trimmedLine.startsWith('SERVO_CFG,OK,')) {
          const parts = trimmedLine.split(',');
          // parts: [SERVO_CFG, OK, z0,z1,z2,z3,z4, min0..min4, max0..max4, dir0..dir4]
          if (parts.length >= 2 + 5 + 5 + 5 + 5) {
            const base = 2;
            const mins = parts.slice(base + 5, base + 10).map(v => parseInt(v));
            const maxs = parts.slice(base + 10, base + 15).map(v => parseInt(v));
            setServoMinAngles(mins.map(v => isNaN(v) ? 10 : v));
            setServoMaxAngles(maxs.map(v => isNaN(v) ? 170 : v));
          }
        }
      }
    } catch (err) {
      console.error('數據解析錯誤:', err);
      setError(`數據解析錯誤: ${(err as Error).message}`);
    }
  };

  // 舵机命令封装
  const servoSet = (fingerId: number, angle: number) => sendCommand(`SERVO_SET,${fingerId},${Math.max(0, Math.min(180, Math.round(angle)))}`);
  const servoInitAll = (angles: number[]) => sendCommand(`SERVO_INIT,${angles.map(a => Math.max(0, Math.min(180, Math.round(a)))).join(',')}`);
  const servoLimit = (fingerId: number, minA: number, maxA: number) => sendCommand(`SERVO_LIMIT,${fingerId},${Math.max(0, Math.min(180, Math.round(minA)))},${Math.max(0, Math.min(180, Math.round(maxA)))}`);
  const servoSave = () => sendCommand('SERVO_SAVE');
  const servoLoad = () => sendCommand('SERVO_LOAD');
  const startServoTraining = (durationMs = 20000, mode = 0, level = 2) => sendCommand(`TRAIN_SERVO,${durationMs},${mode},${level}`);

  // 網頁端初始化函數
  const startWebInitialization = () => {
    console.log('🔄 開始網頁端手指基線初始化...');
    console.log('📋 請保持手指完全伸直，3秒後開始收集基線數據');

    setIsInitializing(true);
    setInitializationComplete(false);

    // 3秒倒計時
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      console.log(`⏰ 倒計時: ${countdown} 秒...`);
      countdown--;
      if (countdown < 0) {
        clearInterval(countdownInterval);
        collectBaseline();
      }
    }, 1000);
  };

  // 收集基線數據
  const collectBaseline = () => {
    console.log('📊 開始收集手指伸直基線數據...');

    const baselineData: number[][] = [[], [], [], [], []]; // 5個手指的數據收集
    const sampleCount = 30; // 收集30個樣本（約3秒）
    let currentSample = 0;

    const collectInterval = setInterval(() => {
      if (sensorData && currentSample < sampleCount) {
        // 收集當前的原始數據作為基線
        sensorData.fingers.forEach((value, index) => {
          baselineData[index].push(value);
        });

        currentSample++;
        console.log(`📈 收集進度: ${currentSample}/${sampleCount}`);

      } else if (currentSample >= sampleCount) {
        clearInterval(collectInterval);

        // 計算平均基線值
        const newBaselines = baselineData.map(fingerData => {
          const sum = fingerData.reduce((a, b) => a + b, 0);
          return sum / fingerData.length;
        });

        setFingerBaselines(newBaselines);
        setIsInitializing(false);
        setInitializationComplete(true);

        console.log('✅ 網頁端初始化完成！');
        console.log('📊 手指伸直基線值:', newBaselines);
        console.log('🎯 3D模型已重置為伸直狀態');
        console.log('👆 現在可以開始手指彎曲檢測');

        // 通知3D模型重置為伸直狀態
        onDataReceived?.({
          fingers: [0, 0, 0, 0, 0], // 重置為伸直狀態
          accel: { x: 0, y: 0, z: 0 },
          gyro: { x: 0, y: 0, z: 0 },
          mag: { x: 0, y: 0, z: 0 },
          emg: 0
        });
      }
    }, 100); // 每100ms收集一次
  };

  // 調整手指方向 - 直接反轉數據
  const adjustFingerDirection = (fingerData: number[]): number[] => {
    const result = fingerData.map((value, index) => {
      let adjustedValue = value;

      // 如果設置為反向電位器，將彎曲度反轉
      if (potentiometerReversed) {
        // 假設正常情況下，彎曲度範圍是0-200
        // 反轉公式：新值 = 最大值 - 原值
        const maxValue = 200;
        adjustedValue = Math.max(0, maxValue - value);

        // 調試信息
        if (index === 0) { // 只為第一個手指打印調試信息
          console.log(`🔄 反向模式: 原值=${value} → 調整值=${adjustedValue}`);
        }
      }

      // 小拇指敏感度增強 (index 4 是小拇指)
      if (index === 4) {
        return adjustedValue * 1.5; // 增加50%敏感度
      }

      return adjustedValue;
    });

    // 調試信息
    if (potentiometerReversed) {
      console.log('🔄 反向電位器已啟用，原數據:', fingerData, '調整後:', result);
    }

    return result;
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

      {/* 電位器方向設置 */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
        <h3 className="text-sm font-medium mb-2">電位器設置</h3>
        <div className="flex items-center space-x-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={potentiometerReversed}
              onChange={(e) => setPotentiometerReversed(e.target.checked)}
              className="sr-only"
            />
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              potentiometerReversed ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                potentiometerReversed ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
            <span className="ml-3 text-sm">
              反向電位器 {potentiometerReversed ? '(減少=彎曲)' : '(增加=彎曲)'}
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          如果手指彎曲方向相反，請開啟此選項
        </p>
      </div>

      {/* 舵機設置 */}
      {isConnected && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
          <h3 className="text-sm font-medium mb-3">舵機設置（拇指→小指）</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {['拇指','食指','中指','無名指','小指'].map((label, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-600">
                <div className="text-xs font-medium mb-2">{label}</div>
                <div className="space-y-2">
                  <label className="block text-xs">初始角: {servoInitialAngles[idx]}°</label>
                  <input type="range" min={0} max={180} value={servoInitialAngles[idx]}
                         onChange={(e) => setServoInitialAngles(updateArrayValue(servoInitialAngles, idx, parseInt(e.target.value)))}
                  />
                  <div className="flex gap-2">
                    <input className="w-1/2 text-xs bg-neutral-100 dark:bg-neutral-700 rounded px-2 py-1"
                           type="number" min={0} max={180} value={servoMinAngles[idx]}
                           onChange={(e) => setServoMinAngles(updateArrayValue(servoMinAngles, idx, parseInt(e.target.value)))} />
                    <input className="w-1/2 text-xs bg-neutral-100 dark:bg-neutral-700 rounded px-2 py-1"
                           type="number" min={0} max={180} value={servoMaxAngles[idx]}
                           onChange={(e) => setServoMaxAngles(updateArrayValue(servoMaxAngles, idx, parseInt(e.target.value)))} />
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 text-xs bg-blue-500 text-white rounded px-2 py-1"
                            onClick={() => servoSet(idx, servoInitialAngles[idx])}>測試</button>
                    <button className="flex-1 text-xs bg-gray-200 dark:bg-neutral-600 rounded px-2 py-1"
                            onClick={() => servoLimit(idx, servoMinAngles[idx], servoMaxAngles[idx])}>限位</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="text-xs bg-purple-500 text-white rounded px-3 py-1" onClick={() => servoInitAll(servoInitialAngles)}>下發全部初始角</button>
            <button className="text-xs bg-emerald-500 text-white rounded px-3 py-1" onClick={servoSave}>保存到設備</button>
            <button className="text-xs bg-gray-300 dark:bg-neutral-600 rounded px-3 py-1" onClick={servoLoad}>讀取設備配置</button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">默認安全角: 最小 10°，最大 170°。如果不確定請保持默認。</p>
        </div>
      )}

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

      {/* 訓練確認彈窗 */}
      {showTrainingConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 w-full max-w-md shadow-lg">
            <h4 className="text-lg font-semibold mb-3">開始 20 秒阻力訓練？</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">AI 建議等級：{aiAnalysisData.parkinsonLevel}，建議阻力：{aiAnalysisData.recommendedResistance}°</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200 dark:bg-neutral-700" onClick={() => setShowTrainingConfirm(false)}>取消</button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white"
                      onClick={() => { startServoTraining(20000, 0, Math.max(1, Math.min(5, aiAnalysisData.parkinsonLevel || 2))); setShowTrainingConfirm(false); }}>
                開始訓練
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}