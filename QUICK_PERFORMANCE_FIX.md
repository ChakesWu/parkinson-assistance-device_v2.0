# 🚀 页面卡顿问题快速修复指南

## 🎯 问题现象
- 页面切换时出现卡顿
- 浏览器响应缓慢
- 页面加载时间过长

## ⚡ 立即修复方案

### 方案1：使用轻量级连接管理器（推荐）

我已经为您创建了一个轻量级的连接管理器来解决性能问题。

#### 步骤1：更新主页面
主页面已经更新为使用轻量级指示器，这应该能显著改善性能。

#### 步骤2：在其他页面使用轻量级组件
如果其他页面仍有卡顿，可以替换为轻量级组件：

```typescript
// 替换原有的 GlobalConnector
import { SimpleLightweightIndicator } from "@/utils/lightweightConnectionManager";

// 在组件中使用
<SimpleLightweightIndicator className="your-custom-class" />
```

### 方案2：临时禁用跨页面功能

如果问题仍然存在，可以临时禁用跨页面连接功能：

#### 修改 useGlobalConnection.ts
```typescript
// 在 parkinson-dock-ui/src/hooks/useGlobalConnection.ts 文件顶部添加
const DISABLE_GLOBAL_CONNECTION = true; // 临时禁用标志

export function useGlobalConnection(options: UseGlobalConnectionOptions = {}): UseGlobalConnectionReturn {
  // 如果禁用，返回默认状态
  if (DISABLE_GLOBAL_CONNECTION) {
    return {
      connectionState: {
        isConnected: false,
        connectionType: null,
        deviceName: null,
        lastUpdate: Date.now()
      },
      isConnected: false,
      connectionType: null,
      deviceName: null,
      browserSupport: {
        serial: typeof navigator !== 'undefined' && 'serial' in navigator,
        bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator
      },
      connectBluetooth: async () => { throw new Error('全局连接已禁用'); },
      connectSerial: async () => { throw new Error('全局连接已禁用'); },
      disconnect: async () => {},
      sendCommand: async () => { throw new Error('全局连接已禁用'); },
      isConnecting: false,
      error: null,
      clearError: () => {},
      refreshConnectionState: () => {}
    };
  }
  
  // 原有代码...
}
```

### 方案3：回退到原始连接方式

#### 修改 device/page.tsx
```typescript
// 替换 GlobalConnector 为原始组件
import ArduinoConnector from '@/components/device/ArduinoConnector';

// 在组件中使用
<ArduinoConnector onDataReceived={handleDataReceived} />
```

#### 修改 ai-analysis/page.tsx
```typescript
// 移除 GlobalConnector，使用简单的连接状态显示
function SimpleConnectionStatus() {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-4">设备连接</h2>
      <p className="text-gray-600 dark:text-gray-400">
        请在设备页面连接Arduino设备，然后返回此页面进行AI分析。
      </p>
    </div>
  );
}

// 在页面中使用
<SimpleConnectionStatus />
```

## 🔧 浏览器优化设置

### Chrome浏览器优化
1. 打开 `chrome://settings/`
2. 点击"高级" → "系统"
3. 启用"使用硬件加速模式"
4. 重启浏览器

### 清除浏览器缓存
1. 按 `Ctrl+Shift+Delete` (Windows) 或 `Cmd+Shift+Delete` (Mac)
2. 选择"全部时间"
3. 勾选"缓存的图片和文件"
4. 点击"清除数据"

### 禁用浏览器扩展
1. 打开 `chrome://extensions/`
2. 临时禁用所有扩展
3. 测试页面性能是否改善

## 📊 性能测试

### 快速性能测试
在浏览器控制台运行以下代码：

```javascript
// 测试页面切换性能
function testPageSwitching() {
  const startTime = performance.now();
  
  // 记录初始内存
  const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  console.log('开始页面切换测试...');
  
  // 模拟页面切换
  setTimeout(() => {
    window.location.href = '/device';
    
    setTimeout(() => {
      window.location.href = '/ai-analysis';
      
      setTimeout(() => {
        window.location.href = '/';
        
        const endTime = performance.now();
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        console.log('测试完成:', {
          totalTime: `${(endTime - startTime).toFixed(2)}ms`,
          memoryIncrease: `${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)}MB`
        });
      }, 1000);
    }, 1000);
  }, 1000);
}

testPageSwitching();
```

### 内存使用检查
```javascript
// 检查当前内存使用
function checkMemoryUsage() {
  if (performance.memory) {
    const memory = performance.memory;
    console.log('内存使用情况:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      usage: `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`
    });
  } else {
    console.log('浏览器不支持内存监控');
  }
}

checkMemoryUsage();
```

## 🚨 紧急情况处理

如果页面完全无法使用，请按以下步骤操作：

### 1. 清除所有本地存储
```javascript
// 在浏览器控制台运行
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 2. 使用隐私模式
- 打开浏览器的隐私/无痕模式
- 访问应用程序
- 测试是否正常工作

### 3. 重置到基本功能
临时修改代码，只保留基本功能：

```typescript
// 在任何使用 GlobalConnector 的地方替换为
function BasicConnectionInfo() {
  return (
    <div className="p-4 bg-gray-100 rounded">
      <p>连接功能暂时不可用，请稍后再试。</p>
      <p>如需连接设备，请直接访问设备页面。</p>
    </div>
  );
}
```

## ✅ 验证修复效果

修复后，请验证以下指标：

### 性能指标
- [ ] 页面切换时间 < 500ms
- [ ] 内存使用增长 < 20MB
- [ ] 无JavaScript错误
- [ ] 页面响应流畅

### 功能指标
- [ ] 基本导航正常
- [ ] 连接状态显示正确
- [ ] 数据显示正常
- [ ] 无明显卡顿

## 📞 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. **浏览器信息**: 版本、操作系统
2. **错误信息**: 控制台错误日志
3. **性能数据**: 内存使用、页面加载时间
4. **重现步骤**: 详细的操作步骤

## 🔄 恢复完整功能

问题解决后，可以逐步恢复完整功能：

1. 首先确保基本功能正常
2. 逐个启用高级功能
3. 每次启用后测试性能
4. 如发现问题立即回退

---

**💡 提示**: 建议先尝试方案1（轻量级连接管理器），这是专门为解决性能问题而设计的优化方案。
