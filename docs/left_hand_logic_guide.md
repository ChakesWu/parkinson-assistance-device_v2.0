# 左手邏輯配置指南

## 📋 概述

本系統已完全轉換為左手邏輯配置，所有硬體接線、軟體數據處理和3D模型顯示都基於左手布局設計。

## 🖐️ 手指映射關係

### 數據順序 (左手邏輯)
```
finger1 = 拇指 (Arduino引腳 A4)
finger2 = 食指 (Arduino引腳 A3)
finger3 = 中指 (Arduino引腳 A2)
finger4 = 無名指 (Arduino引腳 A1)
finger5 = 小指 (Arduino引腳 A0)
```

### 視覺化布局
```
左手手掌視角 (手心向上)：
    拇指    食指    中指    無名指   小指
   (A4)   (A3)   (A2)    (A1)   (A0)
  finger1 finger2 finger3 finger4 finger5
```

## 🔌 硬體配置

### Arduino 接線 (左手配置)
| 手指 | Arduino引腳 | 數據位置 | 說明 |
|------|-------------|----------|------|
| 拇指 | A4 | finger1 | 左手拇指電位器 |
| 食指 | A3 | finger2 | 左手食指電位器 |
| 中指 | A2 | finger3 | 左手中指電位器 |
| 無名指 | A1 | finger4 | 左手無名指電位器 |
| 小指 | A0 | finger5 | 左手小指電位器 |

### 數據格式
```
Arduino輸出格式：
DATA,thumb,index,middle,ring,pinky,emg,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mag_x,mag_y,mag_z

範例：
DATA,512,678,345,789,234,456,0.12,-0.34,0.98,1.23,-2.45,0.67,12.3,-45.6,78.9
     ↑   ↑   ↑   ↑   ↑
   拇指 食指 中指 無名指 小指
```

## 💻 軟體實現

### Arduino 代碼
```cpp
void readRawSensorDataForWeb(float* data) {
    // 左手邏輯：拇指到小指
    data[0] = readFingerValue(PIN_THUMB);    // 拇指 (左手finger1)
    data[1] = readFingerValue(PIN_INDEX);    // 食指 (左手finger2)
    data[2] = readFingerValue(PIN_MIDDLE);   // 中指 (左手finger3)
    data[3] = readFingerValue(PIN_RING);     // 無名指 (左手finger4)
    data[4] = readFingerValue(PIN_PINKY);    // 小指 (左手finger5)
    data[5] = readEMGValue();                // EMG
    // ... IMU數據
}
```

### JavaScript 數據處理
```javascript
// 感測器數據儲存 (左手邏輯)
let sensorData = {
    fingers: [0, 0, 0, 0, 0],  // [拇指, 食指, 中指, 無名指, 小指]
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 }
};

// 數據解析
const fingers = [
    parseInt(parts[1]),  // 拇指 (finger1)
    parseInt(parts[2]),  // 食指 (finger2)
    parseInt(parts[3]),  // 中指 (finger3)
    parseInt(parts[4]),  // 無名指 (finger4)
    parseInt(parts[5])   // 小指 (finger5)
];
```

### Python 數據收集
```python
def parse_data_packet(self, line):
    """解析數據包 (左手邏輯)"""
    if line.startswith("DATA"):
        # 數據格式: DATA,thumb,index,middle,ring,pinky,emg,imu_x,imu_y,imu_z
        parts = line.split(',')
        if len(parts) == 10:
            data = {
                'timestamp': time.time(),
                'fingers': [float(parts[1]), float(parts[2]), float(parts[3]), 
                           float(parts[4]), float(parts[5])],  # [拇指, 食指, 中指, 無名指, 小指]
                'emg': float(parts[6]),
                'imu': [float(parts[7]), float(parts[8]), float(parts[9])]
            }
            return data
```

## 🎮 3D模型配置

### 手指位置 (左手布局)
```javascript
const fingerConfigs = [
    { name: 'thumb', position: [1.8, 0.4, 1.2] },   // finger1: 拇指 (左手位置)
    { name: 'index', position: [0.9, 0.4, 2.2] },   // finger2: 食指
    { name: 'middle', position: [0, 0.4, 2.3] },    // finger3: 中指
    { name: 'ring', position: [-0.9, 0.4, 2.2] },   // finger4: 無名指
    { name: 'pinky', position: [-1.7, 0.4, 1.8] }   // finger5: 小指
];
```

### 骨骼映射 (左手)
```javascript
const fingerBonePatterns = [
    // finger1: 拇指 (左手)
    ['thumb.01.L', 'thumb.02.L', 'thumb.03.L'],
    // finger2: 食指 (左手)
    ['finger_index.01.L', 'finger_index.02.L', 'finger_index.03.L'],
    // finger3: 中指 (左手)
    ['finger_middle.01.L', 'finger_middle.02.L', 'finger_middle.03.L'],
    // finger4: 無名指 (左手)
    ['finger_ring.01.L', 'finger_ring.02.L', 'finger_ring.03.L'],
    // finger5: 小指 (左手)
    ['finger_pinky.01.L', 'finger_pinky.02.L', 'finger_pinky.03.L']
];
```

## 🔄 數據流程

### 完整數據流程 (左手邏輯)
```
1. 硬體感測 (左手配置)
   拇指(A4) → finger1
   食指(A3) → finger2
   中指(A2) → finger3
   無名指(A1) → finger4
   小指(A0) → finger5

2. Arduino處理
   readRawSensorDataForWeb() → 按左手順序讀取

3. 數據傳輸
   DATA,thumb,index,middle,ring,pinky,emg,imu...

4. 網頁解析
   fingers[0] = 拇指
   fingers[1] = 食指
   fingers[2] = 中指
   fingers[3] = 無名指
   fingers[4] = 小指

5. 3D模型更新
   updateFingerBending(0, thumbValue)    // 拇指
   updateFingerBending(1, indexValue)    // 食指
   updateFingerBending(2, middleValue)   // 中指
   updateFingerBending(3, ringValue)     // 無名指
   updateFingerBending(4, pinkyValue)    // 小指
```

## ✅ 驗證方法

### 1. 硬體驗證
- 彎曲拇指 → finger1數值變化
- 彎曲食指 → finger2數值變化
- 彎曲中指 → finger3數值變化
- 彎曲無名指 → finger4數值變化
- 彎曲小指 → finger5數值變化

### 2. 軟體驗證
```javascript
// 在瀏覽器控制台檢查
console.log('手指數據:', sensorData.fingers);
// 應該顯示：[拇指值, 食指值, 中指值, 無名指值, 小指值]
```

### 3. 3D模型驗證
- 彎曲實際拇指 → 3D模型拇指彎曲
- 彎曲實際食指 → 3D模型食指彎曲
- 依此類推...

## 📝 注意事項

1. **一致性**：所有組件都使用相同的左手邏輯
2. **數據順序**：始終是拇指→食指→中指→無名指→小指
3. **引腳映射**：A4→拇指, A3→食指, A2→中指, A1→無名指, A0→小指
4. **3D顯示**：確保3D模型視覺上顯示為左手
5. **測試**：使用真實手指動作驗證映射正確性

## 🔧 故障排除

### 問題：手指動作與3D模型不匹配
**解決方案**：
1. 檢查Arduino接線是否正確
2. 確認數據解析順序
3. 驗證3D模型手指配置

### 問題：數據順序混亂
**解決方案**：
1. 檢查readRawSensorDataForWeb()函數
2. 確認數據傳輸格式
3. 驗證網頁端解析邏輯

### 問題：3D模型顯示為右手
**解決方案**：
1. 檢查手指位置配置
2. 確認是否需要鏡像設置
3. 驗證骨骼映射正確性
