# Arduino Nano BLE Sense Rev2 - 蓝牙功能说明

## 概述
此版本的帕金森辅助设备代码已增加了蓝牙低功耗（BLE）支持，可以同时通过串口和蓝牙与网页端通信。

## 新增功能

### 1. 蓝牙BLE支持
- **设备名称**: `ParkinsonDevice_v2`
- **服务UUID**: `12345678-1234-1234-1234-123456789abc`
- **特征值**:
  - 传感器数据: `12345678-1234-1234-1234-123456789abd` (Read/Notify)
  - 命令接收: `12345678-1234-1234-1234-123456789abe` (Write)
  - AI结果: `12345678-1234-1234-1234-123456789abf` (Read/Notify)

### 2. 通信模式
支持三种通信模式：
- `COMM_SERIAL_ONLY`: 仅串口通信
- `COMM_BLE_ONLY`: 仅蓝牙通信  
- `COMM_BOTH`: 串口和蓝牙同时通信（默认）

### 3. 数据格式

#### 传感器数据（BLE）
- 二进制格式，60字节
- 手指数据：5个uint16值（10字节）
- EMG数据：1个uint16值（2字节）
- IMU数据：9个float值（36字节）

#### AI结果（BLE）
- 文本格式：`AI:level,confidence,count`
- 例如：`AI:3,85.6,5`

### 4. 支持的命令
通过BLE或串口发送以下命令：
- `START`: 开始数据收集
- `TRAIN`: 开始训练
- `CALIBRATE`: 开始校准
- `STATUS`: 查询状态
- `AUTO`: 开始AI分析
- `STOP`: 停止分析
- `SERVO<angle>`: 控制舵机角度
- `COMM_SERIAL`: 切换到仅串口模式
- `COMM_BLE`: 切换到仅蓝牙模式
- `COMM_BOTH`: 切换到双通信模式

## 硬件要求

### 必需库
确保Arduino IDE中安装了以下库：
- `Arduino_BMI270_BMM150` (IMU传感器)
- `Servo` (舵机控制)
- `ArduinoBLE` (蓝牙低功耗)

### 安装ArduinoBLE库
1. 打开Arduino IDE
2. 工具 → 管理库
3. 搜索"ArduinoBLE"
4. 安装最新版本

## 使用说明

### 1. 上传代码
1. 选择开发板：Arduino Nano 33 BLE Sense Rev2
2. 选择正确的串口
3. 上传代码

### 2. 串口监视器
- 波特率：115200
- 可以看到BLE初始化信息和连接状态

### 3. 蓝牙连接
- 设备会自动开始广播
- 设备名称：`ParkinsonDevice_v2`
- 连接后LED会亮起

### 4. 状态指示
- **LED熄灭**: 未连接蓝牙
- **LED常亮**: 已连接蓝牙
- **LED闪烁**: 错误状态

## 网页端集成
网页端需要使用Web Bluetooth API来连接设备。主要步骤：

1. 扫描设备：`navigator.bluetooth.requestDevice()`
2. 连接GATT服务器
3. 获取服务和特征值
4. 订阅数据通知
5. 发送命令

## 故障排除

### 问题1：BLE初始化失败
- 确保使用Arduino Nano 33 BLE Sense Rev2
- 检查ArduinoBLE库是否正确安装

### 问题2：无法连接蓝牙
- 确保设备在广播模式
- 检查网页端是否支持Web Bluetooth API
- 重启Arduino设备

### 问题3：数据传输异常
- 检查BLE连接状态
- 确认特征值UUID正确
- 查看串口监视器的错误信息

## 技术细节

### 数据包结构
```
传感器数据包 (60字节):
[0-1]   手指1 (uint16)
[2-3]   手指2 (uint16)  
[4-5]   手指3 (uint16)
[6-7]   手指4 (uint16)
[8-9]   手指5 (uint16)
[10-11] EMG (uint16)
[12-15] 加速度X (float)
[16-19] 加速度Y (float)
[20-23] 加速度Z (float)
[24-27] 陀螺仪X (float)
[28-31] 陀螺仪Y (float)
[32-35] 陀螺仪Z (float)
[36-39] 磁力计X (float)
[40-43] 磁力计Y (float)
[44-47] 磁力计Z (float)
```

### 性能优化
- 数据发送间隔：100ms
- BLE数据包大小：60字节
- 支持同时串口和BLE输出
- 自动重连机制

## 版本信息
- 版本：2.0
- 支持：Arduino Nano 33 BLE Sense Rev2
- 更新日期：2025-08-09
