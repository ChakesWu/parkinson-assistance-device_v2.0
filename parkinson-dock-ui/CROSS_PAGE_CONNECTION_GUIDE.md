# 跨页面连接状态共享指南

## 概述
本指南介绍了Parkinson Dock UI中实现的跨页面连接状态共享功能，允许用户在不同页面间切换时保持设备连接状态，无需重新连接。

## 功能特性

### 🔗 全局连接管理
- **单例模式**: 使用全局连接管理器确保整个应用只有一个连接实例
- **状态持久化**: 连接状态保存在localStorage中，页面刷新后仍可恢复
- **跨页面通信**: 使用BroadcastChannel实现页面间实时状态同步

### 📡 实时数据共享
- **数据广播**: 传感器数据和AI结果在所有页面间实时共享
- **事件同步**: 连接状态变化立即通知所有打开的页面
- **自动恢复**: 页面重新加载时自动请求最新连接状态

### 🎯 智能连接管理
- **防重复连接**: 检测现有连接，避免重复连接操作
- **连接类型切换**: 支持串口和蓝牙连接的智能切换
- **错误处理**: 完善的错误处理和用户反馈机制

## 技术架构

### 核心组件

#### 1. GlobalConnectionManager (全局连接管理器)
```typescript
// 单例模式的全局连接管理器
export class GlobalConnectionManager {
  private static instance: GlobalConnectionManager | null = null;
  
  // 蓝牙和串口连接管理
  private bluetoothManager: BluetoothManager;
  private serialPort: SerialPort | null = null;
  
  // 跨页面通信
  private broadcastChannel: BroadcastChannel;
  
  // 连接状态管理
  private connectionState: ConnectionState;
}
```

#### 2. useGlobalConnection Hook
```typescript
// React Hook for easy integration
export function useGlobalConnection(options: UseGlobalConnectionOptions) {
  // 连接状态管理
  // 数据接收处理
  // 命令发送功能
  // 错误处理
}
```

#### 3. GlobalConnector Component
```typescript
// 统一的连接器组件
export default function GlobalConnector({
  onDataReceived,
  showSensorData,
  showConnectionControls,
  compact
}: GlobalConnectorProps)
```

### 数据流架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Page A        │    │ GlobalConnection │    │   Page B        │
│                 │    │    Manager       │    │                 │
│ ┌─────────────┐ │    │                  │    │ ┌─────────────┐ │
│ │useGlobalConn│◄├────┤ BroadcastChannel ├────┤►│useGlobalConn│ │
│ └─────────────┘ │    │                  │    │ └─────────────┘ │
│                 │    │ ┌──────────────┐ │    │                 │
│ ┌─────────────┐ │    │ │ Bluetooth    │ │    │ ┌─────────────┐ │
│ │GlobalConnect│ │    │ │ Manager      │ │    │ │GlobalConnect│ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ConnectionInd│ │    │ │ Serial Port  │ │    │ │ConnectionInd│ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 使用方法

### 1. 基本连接管理

```typescript
import { useGlobalConnection } from '@/hooks/useGlobalConnection';

function MyComponent() {
  const {
    isConnected,
    connectionType,
    connectBluetooth,
    connectSerial,
    disconnect,
    sendCommand
  } = useGlobalConnection({
    onDataReceived: (data) => {
      console.log('Received data:', data);
    },
    onAIResultReceived: (result) => {
      console.log('AI result:', result);
    }
  });

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={connectBluetooth}>Connect Bluetooth</button>
      <button onClick={connectSerial}>Connect Serial</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### 2. 使用GlobalConnector组件

```typescript
import GlobalConnector from '@/components/device/GlobalConnector';

function DevicePage() {
  return (
    <div>
      <GlobalConnector 
        onDataReceived={(data) => {
          // 处理数据
        }}
        showSensorData={true}
        showConnectionControls={true}
        compact={false}
      />
    </div>
  );
}
```

### 3. 简单的连接状态显示

```typescript
import ConnectionIndicator from '@/components/device/ConnectionIndicator';

function Header() {
  return (
    <div className="header">
      <ConnectionIndicator showDetails={true} />
    </div>
  );
}
```

### 4. 仅获取连接状态

```typescript
import { useConnectionState } from '@/hooks/useGlobalConnection';

function StatusComponent() {
  const { isConnected, connectionType, deviceName } = useConnectionState();
  
  return (
    <div>
      {isConnected ? (
        <span>Connected via {connectionType}: {deviceName}</span>
      ) : (
        <span>Not connected</span>
      )}
    </div>
  );
}
```

## 页面集成示例

### 1. AI分析页面
```typescript
// ai-analysis/page.tsx
export default function AIAnalysisPage() {
  const {
    isConnected,
    sendCommand,
    error
  } = useGlobalConnection({
    onDataReceived: handleDataReceived,
    onAIResultReceived: handleAIResult
  });

  const startAnalysis = async () => {
    if (!isConnected) {
      alert('请先连接设备');
      return;
    }
    await sendCommand('START');
  };

  return (
    <div>
      <GlobalConnector 
        showSensorData={false}
        showConnectionControls={true}
      />
      <button onClick={startAnalysis}>开始分析</button>
    </div>
  );
}
```

### 2. 设备监控页面
```typescript
// device/page.tsx
export default function DevicePage() {
  return (
    <div>
      <GlobalConnector 
        onDataReceived={(data) => {
          // 更新3D模型
          updateHandModel(data);
        }}
        showSensorData={true}
        showConnectionControls={true}
      />
    </div>
  );
}
```

### 3. 主页面
```typescript
// page.tsx
export default function HomePage() {
  return (
    <div>
      {/* 右上角连接状态指示器 */}
      <div className="fixed top-4 right-4 z-50">
        <ConnectionIndicator showDetails={true} />
      </div>
      
      {/* 页面内容 */}
      <HeroSection />
    </div>
  );
}
```

## 状态同步机制

### 1. BroadcastChannel消息类型
```typescript
// 连接状态变化
{ type: 'connectionStateChanged', payload: ConnectionState }

// 数据接收
{ type: 'dataReceived', payload: SensorData }

// AI结果接收
{ type: 'aiResultReceived', payload: AIResult }

// 请求连接状态
{ type: 'requestConnectionState', payload: null }

// 连接状态响应
{ type: 'connectionStateResponse', payload: ConnectionState }
```

### 2. localStorage状态持久化
```typescript
// 保存连接状态
localStorage.setItem('parkinson-connection-state', JSON.stringify(state));

// 加载连接状态（5分钟有效期）
const saved = localStorage.getItem('parkinson-connection-state');
if (saved && !isExpired(saved)) {
  this.connectionState = JSON.parse(saved);
}
```

## 最佳实践

### 1. 组件设计
- 使用`useGlobalConnection` Hook进行连接管理
- 使用`GlobalConnector`组件提供完整的连接界面
- 使用`ConnectionIndicator`组件显示简单的状态信息

### 2. 错误处理
- 监听连接错误并提供用户友好的错误信息
- 实现自动重连机制
- 提供手动刷新连接状态的选项

### 3. 性能优化
- 使用单例模式避免重复创建连接管理器
- 合理使用BroadcastChannel避免过度通信
- 实现连接状态缓存减少不必要的状态检查

### 4. 用户体验
- 提供清晰的连接状态指示
- 在页面间切换时保持连接状态
- 提供快速连接和断开连接的操作

## 故障排除

### 问题1：页面间状态不同步
**解决方案**:
1. 检查BroadcastChannel是否正常工作
2. 确认localStorage权限
3. 手动调用`refreshConnectionState()`

### 问题2：连接状态丢失
**解决方案**:
1. 检查localStorage是否被清除
2. 确认连接状态未过期（5分钟）
3. 重新建立连接

### 问题3：重复连接
**解决方案**:
1. 检查连接状态检测逻辑
2. 确保使用全局连接管理器
3. 避免在多个组件中同时调用连接方法

## 技术限制

### 1. 浏览器支持
- BroadcastChannel: Chrome 54+, Firefox 38+
- localStorage: 所有现代浏览器
- Web Bluetooth/Serial: Chrome 89+, Edge 89+

### 2. 安全限制
- HTTPS要求（Web Bluetooth API）
- 同源策略限制
- 用户手势要求（首次连接）

### 3. 性能考虑
- 连接状态检查频率
- 数据传输频率限制
- 内存使用优化

## 总结

跨页面连接状态共享功能大大提升了用户体验，允许用户在不同功能页面间自由切换而无需重新连接设备。通过合理的架构设计和状态管理，实现了稳定可靠的跨页面通信机制。
