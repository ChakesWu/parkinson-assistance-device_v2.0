# Parkinson Dock UI - 蓝牙连接功能

## 概述
Parkinson Dock UI现已支持通过蓝牙低功耗（BLE）连接Arduino Nano BLE Sense Rev2设备，提供串口和蓝牙两种连接方式的统一界面。

## 新增功能

### 1. 统一连接器 (UnifiedConnector)
- **双模式支持**: 串口连接和蓝牙连接
- **智能切换**: 根据浏览器支持情况自动启用/禁用连接模式
- **状态管理**: 统一的连接状态管理和数据处理

### 2. 蓝牙连接器 (BluetoothConnector)
- **BLE设备扫描**: 自动扫描ParkinsonDevice_v2设备
- **实时数据接收**: 支持传感器数据和AI分析结果
- **命令发送**: 支持校准、分析、训练等命令
- **状态显示**: 连接状态、设备信息、数据可视化

### 3. 类型安全
- **TypeScript支持**: 完整的Web Bluetooth API类型定义
- **接口统一**: 串口和蓝牙使用相同的数据接口
- **错误处理**: 完善的错误处理和用户反馈

## 文件结构

### 新增文件
```
src/
├── components/device/
│   ├── BluetoothConnector.tsx     # 蓝牙连接组件
│   └── UnifiedConnector.tsx       # 统一连接器组件
├── utils/
│   └── bluetoothManager.ts        # 蓝牙管理器类
├── types/
│   └── web-bluetooth.d.ts         # Web Bluetooth API类型定义
└── README_BLUETOOTH.md            # 本说明文档
```

### 修改文件
- `src/app/device/page.tsx` - 使用UnifiedConnector替代ArduinoConnector

## 使用说明

### 1. 浏览器要求
- **Chrome 89+** (推荐)
- **Edge 89+** (推荐)
- **Firefox**: 不支持Web Bluetooth API
- **Safari**: 不支持Web Bluetooth API

### 2. 连接步骤

#### 访问设备页面
1. 启动开发服务器: `npm run dev`
2. 访问: `http://localhost:3000/device`
3. 查看连接方式选择器

#### 串口连接
1. 在连接方式选择器中选择"串口连接"
2. 点击"连接裝置"按钮
3. 在弹出窗口中选择Arduino设备
4. 等待连接成功

#### 蓝牙连接
1. 确保Arduino已上传支持BLE的代码
2. 在连接方式选择器中选择"蓝牙连接"
3. 点击"连接蓝牙设备"按钮
4. 在蓝牙设备列表中选择"ParkinsonDevice_v2"
5. 等待连接成功

### 3. 功能特性

#### 自动检测
- 页面加载时自动检测浏览器支持情况
- 不支持的连接方式会被禁用并显示提示
- 智能默认模式选择

#### 数据可视化
- 实时传感器数据显示
- 3D手部模型同步
- AI分析结果展示
- 历史记录保存

#### 状态管理
- 连接状态实时更新
- 设备信息显示
- 错误信息提示
- 数据传输状态

## 技术实现

### 蓝牙管理器 (BluetoothManager)
```typescript
export class BluetoothManager {
  // 连接管理
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  
  // 数据处理
  onDataReceived: (data: SensorData) => void
  onAIResultReceived: (result: AIResult) => void
  
  // 命令发送
  async sendCommand(command: string): Promise<void>
}
```

### 数据接口
```typescript
interface SensorData {
  fingers: number[];                    // 手指弯曲数据
  accel: { x: number; y: number; z: number };   // 加速度计
  gyro: { x: number; y: number; z: number };    // 陀螺仪
  mag: { x: number; y: number; z: number };     // 磁力计
  emg?: number;                         // EMG数据
}

interface AIResult {
  parkinsonLevel: number;               // 帕金森等级
  confidence: number;                   // 置信度
  analysisCount: number;                // 分析次数
}
```

### BLE服务配置
- **服务UUID**: `12345678-1234-1234-1234-123456789abc`
- **传感器数据**: `12345678-1234-1234-1234-123456789abd` (Read/Notify)
- **命令发送**: `12345678-1234-1234-1234-123456789abe` (Write)
- **AI结果**: `12345678-1234-1234-1234-123456789abf` (Read/Notify)

## 开发指南

### 添加新的连接方式
1. 在`UnifiedConnector`中添加新的连接模式
2. 创建对应的连接器组件
3. 实现统一的数据接口
4. 更新浏览器支持检测

### 扩展数据处理
1. 在`BluetoothManager`中添加新的数据解析逻辑
2. 更新`SensorData`接口定义
3. 在连接器组件中添加相应的UI显示

### 自定义命令
1. 在Arduino代码中添加命令处理
2. 在`BluetoothManager`的`sendCommand`方法中添加命令
3. 在UI组件中添加命令触发按钮

## 故障排除

### 问题1：蓝牙连接失败
**解决方案**:
1. 确认使用Chrome或Edge浏览器
2. 检查Arduino BLE初始化状态
3. 确保设备距离适中
4. 重启Arduino设备

### 问题2：找不到设备
**解决方案**:
1. 确认设备名称为"ParkinsonDevice_v2"
2. 检查BLE广播状态
3. 清除浏览器蓝牙缓存

### 问题3：数据传输异常
**解决方案**:
1. 检查BLE连接稳定性
2. 查看浏览器控制台错误
3. 验证数据格式匹配

### 问题4：模式切换失败
**解决方案**:
1. 确保当前无活动连接
2. 检查浏览器支持状态
3. 刷新页面重试

## 性能优化

### 连接管理
- 自动重连机制
- 连接状态缓存
- 错误恢复处理

### 数据处理
- 二进制数据解析
- 批量数据处理
- 内存使用优化

### 用户体验
- 加载状态指示
- 错误信息提示
- 响应式设计

## 部署说明

### 开发环境
```bash
npm install
npm run dev
```

### 生产环境
```bash
npm run build
npm start
```

### HTTPS要求
Web Bluetooth API要求HTTPS环境，确保生产环境使用HTTPS。

## 版本信息
- 版本：2.0
- 更新日期：2025-08-09
- 框架：Next.js 14 + TypeScript
- 兼容性：Arduino Nano 33 BLE Sense Rev2
- 浏览器：Chrome 89+, Edge 89+

## 相关链接
- [Web Bluetooth API文档](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Arduino BLE库文档](https://www.arduino.cc/en/Reference/ArduinoBLE)
- [Next.js文档](https://nextjs.org/docs)
