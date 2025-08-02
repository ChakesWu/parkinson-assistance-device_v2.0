# 3D 手部模型整合說明

## 功能概述
已成功將 3D 手部模型整合到您的 Arduino 手指彎曲感測器網站中，實現了：

✅ **3D 手部模型顯示** - 使用 Three.js 渲染的逼真 3D 手部模型
✅ **實時手指彎曲動畫** - 根據電位器數據實時彎曲手指關節
✅ **IMU 驅動的手部旋轉** - 根據加速度計數據旋轉整個手部
✅ **互動式視角控制** - 滑鼠拖拽旋轉視角，滾輪縮放
✅ **與現有系統完全整合** - 保持原有的串口通信和數據顯示功能

## 新增功能

### 3D 手部模型
- **位置**：取代了原本的 SVG 手指圖像，位於「手指彎曲視覺化」區域
- **材質**：使用肌膚色調的 3D 材質，具有陰影效果
- **結構**：包含手掌和五根手指，每根手指有三個關節段

### 實時動畫
- **手指彎曲**：電位器數值 0-1023 對應手指彎曲角度 0-90度
- **手部旋轉**：IMU 加速度計數據驅動手部整體旋轉
- **平滑動畫**：使用插值算法確保動畫流暢

### 互動控制
- **滑鼠拖拽**：旋轉 3D 模型視角
- **滾輪縮放**：調整模型大小
- **測試動畫**：點擊「測試動畫」按鈕查看手指彎曲演示
- **重置手部**：點擊「重置手部」按鈕將手部恢復到初始狀態

## 技術實現

### 使用的技術
- **Three.js r128** - 3D 渲染引擎
- **WebGL** - 硬體加速的 3D 圖形
- **Web Serial API** - 與 Arduino 通信（保持不變）

### 文件結構
```
3d_hand_project/
├── index.html          # 主頁面（已更新）
├── script.js           # JavaScript 邏輯（已擴展）
├── styles.css          # 樣式表（已更新）
├── hand3d.js           # 3D 手部模型類（新增）
├── arduino_serial_example.ino  # Arduino 程式範例
└── README_3D.md        # 3D 模型使用說明（本文件）
```

### 核心類別
- **Hand3D** - 主要的 3D 手部模型類
  - `updateFingerBending(fingerIndex, value)` - 更新手指彎曲
  - `updateHandRotation(imuData)` - 更新手部旋轉
  - `updateFromSensorData(sensorData)` - 從感測器數據更新模型

## 數據映射

### 手指彎曲映射
```javascript
// 電位器數值 (0-1023) → 彎曲角度 (0-90度)
const bendAngle = (value / 1023) * Math.PI / 2;
```

### IMU 旋轉映射
```javascript
// 加速度計數據 → 手部旋轉角度
const rotationX = Math.atan2(y, Math.sqrt(x * x + z * z));
const rotationZ = Math.atan2(x, Math.sqrt(y * y + z * z));
```

## 使用方法

### 基本使用
1. 開啟網頁後，3D 模型會自動載入
2. 連接 Arduino 後，手指和手部會根據感測器數據實時動畫
3. 使用滑鼠與 3D 模型互動

### 測試功能
1. **測試動畫**：點擊「測試動畫」按鈕，所有手指會自動彎曲和伸直 10 秒
2. **重置手部**：點擊「重置手部」按鈕，手部回到初始狀態

### API 接口
```javascript
// 初始化 3D 手部模型
window.initHand3D();

// 手動更新手指彎曲（fingerIndex: 0-4, value: 0-1023）
window.hand3D.updateFingerBending(fingerIndex, value);

// 手動更新手部旋轉
window.hand3D.updateHandRotation(imuData);

// 從完整感測器數據更新
window.hand3D.updateFromSensorData(sensorData);
```

## 性能優化

### 已實現的優化
- **硬體加速**：使用 WebGL 進行 GPU 渲染
- **平滑插值**：使用 `THREE.MathUtils.lerp` 實現平滑動畫
- **高效更新**：只在數據變化時更新模型
- **陰影優化**：使用 PCF 軟陰影提升視覺效果

### 瀏覽器要求
- ✅ Chrome 89+（推薦）
- ✅ Edge 89+
- ✅ Firefox 85+（支援 WebGL）
- ❌ Safari（不支援 Web Serial API）

## 故障排除

### 常見問題

**問題：3D 模型不顯示**
- 確認瀏覽器支援 WebGL
- 檢查瀏覽器控制台是否有 JavaScript 錯誤
- 確認 Three.js 庫正確載入

**問題：手指不會彎曲**
- 確認 Arduino 正確連接並發送數據
- 檢查數據格式是否為正確的 JSON 格式
- 確認電位器連接正確

**問題：手部不會旋轉**
- 確認 IMU 感測器正常工作
- 檢查加速度計數據是否正確傳輸
- 確認 Arduino 程式包含 IMU 數據輸出

### 調試方法
1. 開啟瀏覽器開發者工具（F12）
2. 查看控制台（Console）標籤頁
3. 檢查是否有錯誤訊息
4. 使用 `window.getAllSensorData()` 檢查數據接收

## 擴展功能

### 可能的改進
- **更多手勢識別**：添加預設手勢動畫
- **材質自定義**：允許用戶更改手部顏色和材質
- **多視角模式**：添加預設攝影機角度
- **數據記錄**：記錄和回放手部動作
- **VR/AR 支援**：整合 WebXR 技術

### 自定義開發
如需自定義功能，可以修改 `hand3d.js` 文件中的 `Hand3D` 類別。主要的自定義點包括：
- 手部模型的幾何形狀和材質
- 動畫的速度和平滑度
- 光照和陰影效果
- 互動控制方式

## 技術支援
如有任何問題或需要進一步的自定義，請參考：
- Three.js 官方文檔：https://threejs.org/docs/
- Web Serial API 文檔：https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
- Arduino 官方文檔：https://docs.arduino.cc/

