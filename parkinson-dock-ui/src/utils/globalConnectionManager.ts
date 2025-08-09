// 全局连接管理器 - 支持跨页面连接状态共享
import { BluetoothManager, SensorData, AIResult } from './bluetoothManager';

export interface ConnectionState {
  isConnected: boolean;
  connectionType: 'serial' | 'bluetooth' | null;
  deviceName: string | null;
  lastUpdate: number;
}

export interface GlobalConnectionManagerOptions {
  onDataReceived?: (data: SensorData) => void;
  onAIResultReceived?: (result: AIResult) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
}

export class GlobalConnectionManager {
  private static instance: GlobalConnectionManager | null = null;
  private bluetoothManager: BluetoothManager;
  private serialPort: SerialPort | null = null;
  private serialReader: ReadableStreamDefaultReader | null = null;
  private serialWriter: WritableStreamDefaultWriter | null = null;
  private broadcastChannel: BroadcastChannel;
  private connectionState: ConnectionState;
  private callbacks: GlobalConnectionManagerOptions = {};
  private readBufferRef: string = '';

  private constructor() {
    try {
      this.bluetoothManager = new BluetoothManager();
      this.broadcastChannel = new BroadcastChannel('parkinson-device-connection');
      this.connectionState = {
        isConnected: false,
        connectionType: null,
        deviceName: null,
        lastUpdate: Date.now()
      };

      this.setupBluetoothCallbacks();
      this.setupBroadcastChannel();
      this.loadConnectionState();
    } catch (error) {
      console.error('Failed to initialize GlobalConnectionManager:', error);
      // 设置默认状态，避免阻塞
      this.connectionState = {
        isConnected: false,
        connectionType: null,
        deviceName: null,
        lastUpdate: Date.now()
      };
    }
  }

  public static getInstance(): GlobalConnectionManager {
    if (!GlobalConnectionManager.instance) {
      GlobalConnectionManager.instance = new GlobalConnectionManager();
    }
    return GlobalConnectionManager.instance;
  }

  public setCallbacks(options: GlobalConnectionManagerOptions) {
    this.callbacks = { ...this.callbacks, ...options };
  }

  private setupBluetoothCallbacks() {
    this.bluetoothManager.onDataReceived = (data: SensorData) => {
      this.callbacks.onDataReceived?.(data);
      this.broadcastMessage('dataReceived', data);
    };

    this.bluetoothManager.onAIResultReceived = (result: AIResult) => {
      this.callbacks.onAIResultReceived?.(result);
      this.broadcastMessage('aiResultReceived', result);
    };

    this.bluetoothManager.onConnectionStatusChanged = (connected: boolean, type: string) => {
      if (connected) {
        this.updateConnectionState({
          isConnected: true,
          connectionType: 'bluetooth',
          deviceName: this.bluetoothManager.getConnectionStatus().deviceName,
          lastUpdate: Date.now()
        });
      } else {
        this.updateConnectionState({
          isConnected: false,
          connectionType: null,
          deviceName: null,
          lastUpdate: Date.now()
        });
      }
    };
  }

  private setupBroadcastChannel() {
    try {
      this.broadcastChannel.addEventListener('message', (event) => {
        try {
          const { type, payload } = event.data;

          switch (type) {
            case 'connectionStateChanged':
              this.connectionState = payload;
              this.callbacks.onConnectionStateChanged?.(payload);
              break;
            case 'dataReceived':
              this.callbacks.onDataReceived?.(payload);
              break;
            case 'aiResultReceived':
              this.callbacks.onAIResultReceived?.(payload);
              break;
            case 'requestConnectionState':
              this.broadcastMessage('connectionStateResponse', this.connectionState);
              break;
          }
        } catch (error) {
          console.error('Error handling broadcast message:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup broadcast channel:', error);
    }
  }

  private broadcastMessage(type: string, payload: any) {
    this.broadcastChannel.postMessage({ type, payload });
  }

  private updateConnectionState(newState: ConnectionState) {
    this.connectionState = newState;
    this.saveConnectionState();
    this.callbacks.onConnectionStateChanged?.(newState);
    this.broadcastMessage('connectionStateChanged', newState);
  }

  private saveConnectionState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('parkinson-connection-state', JSON.stringify(this.connectionState));
    }
  }

  private loadConnectionState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('parkinson-connection-state');
        if (saved) {
          const state = JSON.parse(saved);
          // 检查状态是否过期（5分钟）
          if (Date.now() - state.lastUpdate < 5 * 60 * 1000) {
            this.connectionState = state;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load connection state:', error);
    }
  }

  // 蓝牙连接方法
  public async connectBluetooth(): Promise<void> {
    if (this.connectionState.isConnected && this.connectionState.connectionType === 'bluetooth') {
      console.log('Bluetooth already connected');
      return;
    }

    await this.disconnect(); // 断开现有连接

    // 设置蓝牙回调函数
    this.setupBluetoothCallbacks();

    await this.bluetoothManager.connect();
  }

  // 串口连接方法
  public async connectSerial(): Promise<void> {
    if (this.connectionState.isConnected && this.connectionState.connectionType === 'serial') {
      console.log('Serial already connected');
      return;
    }

    await this.disconnect(); // 断开现有连接

    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported');
    }

    try {
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ baudRate: 115200 });

      // 设置读取器
      const textDecoder = new TextDecoderStream();
      this.serialPort.readable.pipeTo(textDecoder.writable);
      this.serialReader = textDecoder.readable.getReader();

      // 设置写入器
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.serialPort.writable);
      this.serialWriter = textEncoder.writable.getWriter();

      // 开始读取数据
      this.startSerialDataReading();

      this.updateConnectionState({
        isConnected: true,
        connectionType: 'serial',
        deviceName: 'Arduino (Serial)',
        lastUpdate: Date.now()
      });

    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  private async startSerialDataReading() {
    if (!this.serialReader) return;

    try {
      while (this.connectionState.isConnected && this.connectionState.connectionType === 'serial') {
        const { value, done } = await this.serialReader.read();
        if (done) break;

        if (value) {
          this.readBufferRef += value;
          const lines = this.readBufferRef.split('\n');
          this.readBufferRef = lines.pop() || '';

          for (const line of lines) {
            this.parseSerialData(line.trim());
          }
        }
      }
    } catch (error) {
      console.error('Serial reading error:', error);
      await this.disconnect();
    }
  }

  private parseSerialData(line: string) {
    if (!line) return;

    // 解析DATA格式的传感器数据
    if (line.startsWith('DATA,')) {
      const parts = line.substring(5).split(',');
      const values = parts.map(v => parseFloat(v));

      if (values.length >= 15) {
        const data: SensorData = {
          fingers: values.slice(0, 5),
          accel: { x: values[6], y: values[7], z: values[8] },
          gyro: { x: values[9], y: values[10], z: values[11] },
          mag: { x: values[12], y: values[13], z: values[14] },
          emg: values[5]
        };

        this.callbacks.onDataReceived?.(data);
        this.broadcastMessage('dataReceived', data);
      }
    }

    // 解析AI结果
    if (line.startsWith('AI:')) {
      const parts = line.substring(3).split(',');
      if (parts.length >= 3) {
        const result: AIResult = {
          parkinsonLevel: parseInt(parts[0]),
          confidence: parseFloat(parts[1]),
          analysisCount: parseInt(parts[2])
        };

        this.callbacks.onAIResultReceived?.(result);
        this.broadcastMessage('aiResultReceived', result);
      }
    }
  }

  // 发送命令
  public async sendCommand(command: string): Promise<void> {
    if (!this.connectionState.isConnected) {
      throw new Error('No device connected');
    }

    if (this.connectionState.connectionType === 'bluetooth') {
      await this.bluetoothManager.sendCommand(command);
    } else if (this.connectionState.connectionType === 'serial' && this.serialWriter) {
      const encoder = new TextEncoder();
      await this.serialWriter.write(encoder.encode(command + '\n'));
    } else {
      throw new Error('Invalid connection type');
    }
  }

  // 断开连接
  public async disconnect(): Promise<void> {
    try {
      // 断开蓝牙
      if (this.bluetoothManager.getConnectionStatus().isConnected) {
        await this.bluetoothManager.disconnect();
      }

      // 断开串口
      if (this.serialReader) {
        await this.serialReader.cancel();
        this.serialReader = null;
      }
      if (this.serialWriter) {
        await this.serialWriter.close();
        this.serialWriter = null;
      }
      if (this.serialPort) {
        await this.serialPort.close();
        this.serialPort = null;
      }

    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      this.updateConnectionState({
        isConnected: false,
        connectionType: null,
        deviceName: null,
        lastUpdate: Date.now()
      });
    }
  }

  // 获取连接状态
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // 检查浏览器支持
  public getBrowserSupport() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        serial: false,
        bluetooth: false
      };
    }
    return {
      serial: 'serial' in navigator,
      bluetooth: 'bluetooth' in navigator
    };
  }

  // 请求其他页面的连接状态
  public requestConnectionState() {
    this.broadcastMessage('requestConnectionState', null);
  }

  // 清理资源
  public destroy() {
    this.disconnect();
    this.broadcastChannel.close();
    GlobalConnectionManager.instance = null;
  }
}
