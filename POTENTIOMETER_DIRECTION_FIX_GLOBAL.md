# 全局電位器方向修復方案

## 問題描述

用戶反饋：旋轉電位器時，手指在3D模型上的彎曲方向是反的。

**具體表現**：
- 電位器順時針旋轉時，期望手指彎曲，但3D模型顯示伸直
- 電位器逆時針旋轉時，期望手指伸直，但3D模型顯示彎曲

## 問題分析

### 根本原因
之前的修復只在 `ArduinoConnector` 和 `BluetoothConnector` 中實現了電位器方向調整，但是主應用程序使用的是 `GlobalConnector`，它通過 `GlobalConnectionManager` 來處理數據，繞過了這些組件中的方向調整邏輯。

### 數據流分析
```
Arduino/Bluetooth → GlobalConnectionManager → GlobalConnector → 3D Model
```

原來的修復在這個流程中被跳過了：
```
Arduino/Bluetooth → ArduinoConnector/BluetoothConnector (有方向調整) → 3D Model
```

## 修復方案

### 1. 在 GlobalConnectionManager 中添加電位器設置

#### 新增接口定義
```typescript
export interface PotentiometerSettings {
  reversed: boolean;
  maxBendValue: number;
}
```

#### 添加私有屬性
```typescript
// Potentiometer settings
private potentiometerSettings: PotentiometerSettings = {
  reversed: false,
  maxBendValue: 200
};
```

#### 新增設置方法
```typescript
// 設置電位器參數
public setPotentiometerSettings(settings: Partial<PotentiometerSettings>) {
  this.potentiometerSettings = {
    ...this.potentiometerSettings,
    ...settings
  };
}

// 獲取電位器設置
public getPotentiometerSettings(): PotentiometerSettings {
  return { ...this.potentiometerSettings };
}
```

### 2. 添加方向調整邏輯

```typescript
// 調整手指方向 - 處理電位器反向
private adjustFingerDirection(fingerData: number[]): number[] {
  return fingerData.map((value, index) => {
    let adjustedValue = value;

    // 如果設置為反向電位器，將彎曲度反轉
    if (this.potentiometerSettings.reversed) {
      // 反轉公式：新值 = 最大值 - 原值
      adjustedValue = Math.max(0, this.potentiometerSettings.maxBendValue - value);
    }

    // 小拇指敏感度增強 (index 4 是小拇指)
    if (index === 4) {
      return adjustedValue * 1.5; // 增加50%敏感度
    }

    return adjustedValue;
  });
}
```

### 3. 修改數據處理流程

#### 串口數據處理
```typescript
private parseSerialData(line: string) {
  if (!line) return;

  // 解析DATA格式的传感器数据
  if (line.startsWith('DATA,')) {
    const parts = line.substring(5).split(',');
    const values = parts.map(v => parseFloat(v));

    if (values.length >= 15) {
      // 調整手指數據方向
      const adjustedFingers = this.adjustFingerDirection(values.slice(0, 5));

      const data: SensorData = {
        fingers: adjustedFingers,
        accel: { x: values[6], y: values[7], z: values[8] },
        gyro: { x: values[9], y: values[10], z: values[11] },
        mag: { x: values[12], y: values[13], z: values[14] },
        emg: values[5]
      };

      this.callbacks.onDataReceived?.(data);
      this.broadcastMessage('dataReceived', data);
    }
  }
}
```

#### 藍牙數據處理
```typescript
this.bluetoothManager.onDataReceived = (data: SensorData) => {
  // 調整手指數據方向
  const adjustedData = {
    ...data,
    fingers: this.adjustFingerDirection(data.fingers)
  };
  
  this.callbacks.onDataReceived?.(adjustedData);
  this.broadcastMessage('dataReceived', adjustedData);
};
```

### 4. 在 GlobalConnector 中添加UI控制

#### 添加狀態管理
```typescript
// 電位器方向設置
const [potentiometerReversed, setPotentiometerReversed] = useState(false);
```

#### 添加設置同步
```typescript
// 處理電位器設置變更
useEffect(() => {
  const manager = GlobalConnectionManager.getInstance();
  manager.setPotentiometerSettings({
    reversed: potentiometerReversed
  });
}, [potentiometerReversed]);
```

#### 添加UI控制
```typescript
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
```

## 修改的文件

### 核心文件
1. **`parkinson-dock-ui/src/utils/globalConnectionManager.ts`**
   - 添加 `PotentiometerSettings` 接口
   - 添加電位器設置屬性和方法
   - 修改串口和藍牙數據處理邏輯
   - 添加 `adjustFingerDirection` 方法

2. **`parkinson-dock-ui/src/components/device/GlobalConnector.tsx`**
   - 添加電位器方向狀態管理
   - 添加設置同步邏輯
   - 添加電位器方向控制UI

## 技術優勢

### 1. 全局統一
- 所有連接方式（串口、藍牙）都使用相同的方向調整邏輯
- 避免了重複代碼和不一致的行為

### 2. 集中管理
- 電位器設置在 `GlobalConnectionManager` 中集中管理
- 所有組件都可以訪問和修改設置

### 3. 實時生效
- 設置變更立即生效，無需重新連接設備
- 用戶可以實時調整並看到效果

### 4. 向後兼容
- 保持與現有代碼的兼容性
- 不影響其他功能的正常運行

## 使用方法

1. **連接設備**：使用 GlobalConnector 連接Arduino或藍牙設備
2. **測試方向**：旋轉電位器觀察3D模型中手指的彎曲方向
3. **調整設置**：如果方向相反，開啟"反向電位器"選項
4. **驗證效果**：再次測試確認方向正確

## 總結

這個修復方案徹底解決了電位器方向問題：

✅ **全局統一**: 所有連接方式都使用相同的方向調整邏輯
✅ **集中管理**: 在 GlobalConnectionManager 中統一處理
✅ **實時調整**: 設置變更立即生效
✅ **用戶友好**: 直觀的切換開關界面
✅ **向後兼容**: 不影響現有功能

現在用戶可以在主應用程序中直接調整電位器方向，確保3D模型準確反映實際的手指動作。
