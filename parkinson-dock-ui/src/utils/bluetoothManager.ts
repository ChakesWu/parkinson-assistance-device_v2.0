// Bluetooth Low Energy (BLE) 连接管理器
import { analysisRecordService } from '@/services/analysisRecordService';

export interface SensorData {
  fingers: number[];
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  mag: { x: number; y: number; z: number };
  emg?: number;
}

export interface AIResult {
  parkinsonLevel: number;
  confidence: number;
  analysisCount: number;
  parkinsonDescription?: string;
  recommendation?: string;
  recommendedResistance?: number;
}

export class BluetoothManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private sensorDataCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private commandCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private aiResultCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnected: boolean = false;

  // 存储最新的传感器数据，用于AI分析记录
  private latestSensorData: SensorData = {
    fingers: [0, 0, 0, 0, 0],
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 },
    emg: 0
  };

  // BLE UUIDs (与Arduino代码匹配)
  private readonly SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
  private readonly SENSOR_DATA_UUID = '12345678-1234-1234-1234-123456789abd';
  private readonly COMMAND_UUID = '12345678-1234-1234-1234-123456789abe';
  private readonly AI_RESULT_UUID = '12345678-1234-1234-1234-123456789abf';

  public onDataReceived: ((data: SensorData) => void) | null = null;
  public onAIResultReceived: ((result: AIResult) => void) | null = null;
  public onConnectionStatusChanged: ((connected: boolean, type: string) => void) | null = null;

  // 检查浏览器是否支持Web Bluetooth API
  isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // 连接到BLE设备
  async connect(): Promise<void> {
    try {
      console.log('正在扫描蓝牙设备...');

      // 请求设备
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'ParkinsonDevice_v2' },
          { namePrefix: 'ParkinsonDevice' }
        ],
        optionalServices: [this.SERVICE_UUID]
      });

      console.log('找到设备:', this.device.name);

      // 监听设备断开事件
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      // 连接到GATT服务器
      console.log('正在连接到GATT服务器...');
      this.server = await this.device.gatt!.connect();

      // 获取服务
      console.log('正在获取服务...');
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);

      // 获取特征值
      console.log('正在获取特征值...');
      console.log('服务UUID:', this.SERVICE_UUID);
      console.log('传感器数据UUID:', this.SENSOR_DATA_UUID);

      try {
        console.log('获取传感器数据特征值...');
        this.sensorDataCharacteristic = await this.service.getCharacteristic(this.SENSOR_DATA_UUID);
        console.log('传感器数据特征值获取成功');

        console.log('获取命令特征值...');
        this.commandCharacteristic = await this.service.getCharacteristic(this.COMMAND_UUID);
        console.log('命令特征值获取成功');

        console.log('获取AI结果特征值...');
        this.aiResultCharacteristic = await this.service.getCharacteristic(this.AI_RESULT_UUID);
        console.log('AI结果特征值获取成功');
      } catch (charError) {
        console.error('获取特征值失败:', charError);

        // 列出服务中所有可用的特征值
        try {
          const characteristics = await this.service.getCharacteristics();
          console.log('服务中可用的特征值:');
          characteristics.forEach((char, index) => {
            console.log(`特征值 ${index + 1}: ${char.uuid}`);
          });
        } catch (listError) {
          console.error('无法列出特征值:', listError);
        }

        throw charError;
      }

      // 订阅传感器数据通知
      await this.sensorDataCharacteristic.startNotifications();
      this.sensorDataCharacteristic.addEventListener('characteristicvaluechanged', this.handleSensorData.bind(this));

      // 订阅AI结果通知
      await this.aiResultCharacteristic.startNotifications();
      this.aiResultCharacteristic.addEventListener('characteristicvaluechanged', this.handleAIResult.bind(this));

      this.isConnected = true;
      console.log('✅ 蓝牙连接成功!');
      console.log('设备信息:', {
        name: this.device.name,
        id: this.device.id,
        connected: this.device.gatt?.connected
      });
      console.log('服务和特征值状态:', {
        service: !!this.service,
        sensorData: !!this.sensorDataCharacteristic,
        command: !!this.commandCharacteristic,
        aiResult: !!this.aiResultCharacteristic
      });

      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(true, 'bluetooth');
      }
    } catch (error) {
      console.error('蓝牙连接失败:', error);
      this.isConnected = false;

      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(false, 'bluetooth');
      }

      throw error;
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    try {
      if (this.device && this.device.gatt?.connected) {
        await this.device.gatt.disconnect();
      }
    } catch (error) {
      console.error('断开蓝牙连接时出错:', error);
    }

    this.onDisconnected();
  }

  // 处理断开连接事件
  private onDisconnected(): void {
    console.log('蓝牙设备已断开连接');
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.service = null;
    this.sensorDataCharacteristic = null;
    this.commandCharacteristic = null;
    this.aiResultCharacteristic = null;

    if (this.onConnectionStatusChanged) {
      this.onConnectionStatusChanged(false, 'bluetooth');
    }
  }

  // 处理传感器数据
  private handleSensorData(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) {
      console.warn('收到空的传感器数据');
      return;
    }

    // 尝试解析为字符串格式
    const decoder = new TextDecoder();
    const dataString = decoder.decode(value);

    console.log('📡 收到BLE传感器数据:', dataString);

    const data = this.parseStringData(dataString);
    if (data) {
      // 更新最新的传感器数据
      this.latestSensorData = { ...data };
      console.log('✅ 传感器数据解析成功:', data);

      if (this.onDataReceived) {
        this.onDataReceived(data);
      }
    } else {
      console.warn('❌ 传感器数据解析失败:', dataString);
    }
  }

  // 解析字符串格式的传感器数据
  private parseStringData(dataString: string): SensorData | null {
    try {
      // 检查是否是传感器数据格式: "DATA,finger1,finger2,finger3,finger4,finger5,emg,ax,ay,az,gx,gy,gz,mx,my,mz"
      if (!dataString.startsWith('DATA,')) {
        return null;
      }

      const parts = dataString.substring(5).split(','); // 移除 "DATA," 前缀
      if (parts.length < 15) {
        console.warn('数据格式不完整:', dataString);
        return null;
      }

      const values = parts.map(part => parseFloat(part));

      const data: SensorData = {
        fingers: values.slice(0, 5), // 前5个值是手指数据
        accel: {
          x: values[6] || 0,
          y: values[7] || 0,
          z: values[8] || 0
        },
        gyro: {
          x: values[9] || 0,
          y: values[10] || 0,
          z: values[11] || 0
        },
        mag: {
          x: values[12] || 0,
          y: values[13] || 0,
          z: values[14] || 0
        },
        emg: values[5] || 0
      };

      return data;
    } catch (error) {
      console.error('解析字符串传感器数据失败:', error);
      return null;
    }
  }

  // 保留原有的二进制数据解析函数作为备用
  private parseSensorData(dataView: DataView): SensorData | null {
    try {
      const data: SensorData = {
        fingers: [],
        accel: { x: 0, y: 0, z: 0 },
        gyro: { x: 0, y: 0, z: 0 },
        mag: { x: 0, y: 0, z: 0 }
      };

      let index = 0;

      // 解析手指数据 (5个uint16值)
      for (let i = 0; i < 5; i++) {
        const fingerValue = dataView.getUint16(index, true); // little-endian
        data.fingers.push(fingerValue);
        index += 2;
      }

      // 解析EMG数据 (2字节)
      data.emg = dataView.getUint16(index, true);
      index += 2;

      // 解析加速度计数据 (3个float值)
      data.accel.x = dataView.getFloat32(index, true);
      index += 4;
      data.accel.y = dataView.getFloat32(index, true);
      index += 4;
      data.accel.z = dataView.getFloat32(index, true);
      index += 4;

      // 解析陀螺仪数据 (3个float值)
      data.gyro.x = dataView.getFloat32(index, true);
      index += 4;
      data.gyro.y = dataView.getFloat32(index, true);
      index += 4;
      data.gyro.z = dataView.getFloat32(index, true);
      index += 4;

      // 解析磁力计数据 (3个float值)
      data.mag.x = dataView.getFloat32(index, true);
      index += 4;
      data.mag.y = dataView.getFloat32(index, true);
      index += 4;
      data.mag.z = dataView.getFloat32(index, true);

      return data;
    } catch (error) {
      console.error('解析传感器数据失败:', error);
      return null;
    }
  }

  // 处理AI结果
  private handleAIResult(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) {
      console.warn('收到空的AI结果数据');
      return;
    }

    const decoder = new TextDecoder();
    const aiResult = decoder.decode(value);

    console.log('🧠 收到BLE AI结果:', aiResult);

    // 解析AI结果格式: "LEVEL:2;CONF:85;REC:轻度震颤，建议进行康复训练;RES:45"
    if (aiResult.includes('LEVEL:') && aiResult.includes('CONF:')) {
      this.parseCompleteAIResult(aiResult);
    }
    // 兼容简化格式: "AI:level,confidence,count"
    else if (aiResult.startsWith('AI:')) {
      const parts = aiResult.substring(3).split(',');
      if (parts.length >= 3) {
        const result: AIResult = {
          parkinsonLevel: parseInt(parts[0]),
          confidence: parseFloat(parts[1]),
          analysisCount: parseInt(parts[2])
        };

        if (this.onAIResultReceived) {
          this.onAIResultReceived(result);
        }
      }
    }
  }

  // 解析完整的AI结果格式
  private parseCompleteAIResult(aiResult: string): void {
    try {
      const result: any = {
        parkinsonLevel: 0,
        confidence: 0,
        analysisCount: 1,
        parkinsonDescription: '',
        recommendation: '',
        recommendedResistance: 0
      };

      // 解析各个字段
      const levelMatch = aiResult.match(/LEVEL:(\d+)/);
      if (levelMatch) {
        result.parkinsonLevel = parseInt(levelMatch[1]);
      }

      const confMatch = aiResult.match(/CONF:([\d.]+)/);
      if (confMatch) {
        result.confidence = parseFloat(confMatch[1]);
      }

      const recMatch = aiResult.match(/REC:([^;]+)/);
      if (recMatch) {
        result.recommendation = recMatch[1].trim();
      }

      const resMatch = aiResult.match(/RES:(\d+)/);
      if (resMatch) {
        result.recommendedResistance = parseInt(resMatch[1]);
      }

      // 根据等级设置描述
      const levelDescriptions = ['正常', '轻微', '轻度', '中度', '重度'];
      result.parkinsonDescription = levelDescriptions[result.parkinsonLevel] || '未知';

      console.log('解析完整AI结果:', result);

      // 保存分析记录
      this.saveAIAnalysisRecord(result);

      if (this.onAIResultReceived) {
        this.onAIResultReceived(result);
      }
    } catch (error) {
      console.error('解析完整AI结果失败:', error);
    }
  }

  // 保存AI分析记录
  private saveAIAnalysisRecord(aiResult: any): void {
    try {
      const record = analysisRecordService.saveRecord({
        analysisCount: aiResult.analysisCount || 1,
        parkinsonLevel: aiResult.parkinsonLevel,
        parkinsonDescription: aiResult.parkinsonDescription,
        confidence: aiResult.confidence,
        recommendation: aiResult.recommendation,
        recommendedResistance: aiResult.recommendedResistance,
        sensorData: {
          fingerPositions: this.latestSensorData.fingers.map(v => Math.round((v / 1023) * 100)),
          accelerometer: this.latestSensorData.accel,
          gyroscope: this.latestSensorData.gyro,
          emg: this.latestSensorData.emg || 0,
        },
        source: 'bluetooth',
      });
      console.log('蓝牙AI分析记录已保存:', record);
    } catch (error) {
      console.error('保存蓝牙AI分析记录失败:', error);
    }
  }

  // 发送命令
  async sendCommand(command: string): Promise<void> {
    console.log('尝试发送BLE命令:', command);
    console.log('连接状态:', this.isConnected);
    console.log('命令特征值状态:', this.commandCharacteristic ? '可用' : '不可用');

    if (!this.isConnected || !this.commandCharacteristic) {
      const error = `蓝牙未连接或命令特征值不可用 - 连接状态: ${this.isConnected}, 特征值: ${this.commandCharacteristic ? '可用' : '不可用'}`;
      console.error(error);
      throw new Error(error);
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(command);
      console.log('编码后的命令数据:', data);

      await this.commandCharacteristic.writeValue(data);
      console.log('✅ BLE命令发送成功:', command);
    } catch (error) {
      console.error('❌ 发送BLE命令失败:', error);
      console.error('错误详情:', {
        command,
        isConnected: this.isConnected,
        hasCharacteristic: !!this.commandCharacteristic,
        error: error
      });
      throw error;
    }
  }

  // 获取连接状态
  getConnectionStatus(): { isConnected: boolean; deviceName: string | null; type: string } {
    return {
      isConnected: this.isConnected,
      deviceName: this.device ? this.device.name || null : null,
      type: 'bluetooth'
    };
  }
}
