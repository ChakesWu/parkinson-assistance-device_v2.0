// Bluetooth Low Energy (BLE) 连接管理
class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.sensorDataCharacteristic = null;
        this.commandCharacteristic = null;
        this.aiResultCharacteristic = null;
        this.isConnected = false;
        
        // BLE UUIDs (与Arduino代码匹配)
        this.SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
        this.SENSOR_DATA_UUID = '12345678-1234-1234-1234-123456789abd';
        this.COMMAND_UUID = '12345678-1234-1234-1234-123456789abe';
        this.AI_RESULT_UUID = '12345678-1234-1234-1234-123456789abf';
        
        this.onDataReceived = null;
        this.onConnectionStatusChanged = null;
    }
    
    // 检查浏览器是否支持Web Bluetooth API
    isBluetoothSupported() {
        return navigator.bluetooth !== undefined;
    }
    
    // 连接到BLE设备
    async connect() {
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
            this.server = await this.device.gatt.connect();
            
            // 获取服务
            console.log('正在获取服务...');
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
            
            // 获取特征值
            console.log('正在获取特征值...');
            this.sensorDataCharacteristic = await this.service.getCharacteristic(this.SENSOR_DATA_UUID);
            this.commandCharacteristic = await this.service.getCharacteristic(this.COMMAND_UUID);
            this.aiResultCharacteristic = await this.service.getCharacteristic(this.AI_RESULT_UUID);
            
            // 订阅传感器数据通知
            await this.sensorDataCharacteristic.startNotifications();
            this.sensorDataCharacteristic.addEventListener('characteristicvaluechanged', this.handleSensorData.bind(this));
            
            // 订阅AI结果通知
            await this.aiResultCharacteristic.startNotifications();
            this.aiResultCharacteristic.addEventListener('characteristicvaluechanged', this.handleAIResult.bind(this));
            
            this.isConnected = true;
            console.log('蓝牙连接成功!');
            
            if (this.onConnectionStatusChanged) {
                this.onConnectionStatusChanged(true, 'bluetooth');
            }
            
            return true;
            
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
    async disconnect() {
        try {
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
        } catch (error) {
            console.error('断开蓝牙连接时出错:', error);
        }
        
        this.onDisconnected();
    }
    
    // 处理断开连接事件
    onDisconnected() {
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
    handleSensorData(event) {
        const value = event.target.value;
        const data = this.parseSensorData(value);
        
        if (this.onDataReceived) {
            this.onDataReceived(data);
        }
    }
    
    // 解析传感器数据 (60字节二进制格式)
    parseSensorData(dataView) {
        try {
            const data = {
                fingers: [],
                accelerometer: { x: 0, y: 0, z: 0 },
                gyroscope: { x: 0, y: 0, z: 0 },
                magnetometer: { x: 0, y: 0, z: 0 }
            };
            
            let index = 0;
            
            // 解析手指数据 (5个uint16值)
            for (let i = 0; i < 5; i++) {
                const fingerValue = dataView.getUint16(index, true); // little-endian
                data.fingers.push(fingerValue);
                index += 2;
            }
            
            // 跳过EMG数据 (2字节)
            index += 2;
            
            // 解析加速度计数据 (3个float值)
            data.accelerometer.x = dataView.getFloat32(index, true);
            index += 4;
            data.accelerometer.y = dataView.getFloat32(index, true);
            index += 4;
            data.accelerometer.z = dataView.getFloat32(index, true);
            index += 4;
            
            // 解析陀螺仪数据 (3个float值)
            data.gyroscope.x = dataView.getFloat32(index, true);
            index += 4;
            data.gyroscope.y = dataView.getFloat32(index, true);
            index += 4;
            data.gyroscope.z = dataView.getFloat32(index, true);
            index += 4;
            
            // 解析磁力计数据 (3个float值)
            data.magnetometer.x = dataView.getFloat32(index, true);
            index += 4;
            data.magnetometer.y = dataView.getFloat32(index, true);
            index += 4;
            data.magnetometer.z = dataView.getFloat32(index, true);
            
            return data;
            
        } catch (error) {
            console.error('解析传感器数据失败:', error);
            return null;
        }
    }
    
    // 处理AI结果
    handleAIResult(event) {
        const decoder = new TextDecoder();
        const aiResult = decoder.decode(event.target.value);
        
        console.log('收到AI结果:', aiResult);
        
        // 解析AI结果格式: "AI:level,confidence,count"
        if (aiResult.startsWith('AI:')) {
            const parts = aiResult.substring(3).split(',');
            if (parts.length >= 3) {
                const aiData = {
                    parkinsonLevel: parseInt(parts[0]),
                    confidence: parseFloat(parts[1]),
                    analysisCount: parseInt(parts[2])
                };
                
                // 触发AI结果更新
                if (window.updateAIDisplayFromBLE) {
                    window.updateAIDisplayFromBLE(aiData);
                }
            }
        }
    }
    
    // 发送命令
    async sendCommand(command) {
        if (!this.isConnected || !this.commandCharacteristic) {
            throw new Error('蓝牙未连接');
        }
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(command);
            await this.commandCharacteristic.writeValue(data);
            console.log('命令已发送:', command);
        } catch (error) {
            console.error('发送命令失败:', error);
            throw error;
        }
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            deviceName: this.device ? this.device.name : null,
            type: 'bluetooth'
        };
    }
}

// 导出蓝牙管理器实例
window.bluetoothManager = new BluetoothManager();
