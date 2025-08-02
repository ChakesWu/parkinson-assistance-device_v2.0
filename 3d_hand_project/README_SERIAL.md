# Arduino 串口通訊網頁專案

## 簡介
這個專案使用瀏覽器的 Web Serial API 直接連接 Arduino，實現即時數據顯示。

## 功能特色
- ✅ 純前端方案，無需 Node.js 後端
- ✅ 使用 Web Serial API 直接連接 Arduino
- ✅ 即時顯示手指彎曲數據
- ✅ 即時顯示 IMU 感測器數據
- ✅ 視覺化手指彎曲效果

## 使用步驟

### 1. 上傳 Arduino 程式
1. 打開 Arduino IDE
2. 載入 `arduino_serial_example.ino` 檔案
3. 選擇正確的 Arduino 板子和串口
4. 上傳程式到 Arduino

### 2. 開啟網頁
1. 用 **Chrome 或 Edge** 瀏覽器開啟 `index.html`
2. 點擊「連接 Arduino」按鈕
3. 在彈出的串口選擇視窗中選擇你的 Arduino 串口
4. 點擊「連接」

### 3. 查看即時數據
- 手指彎曲數據會即時顯示在進度條上
- SVG 手指圖會根據數據彎曲
- IMU 數據會即時更新

## 硬體連接

### 電位器連接 (手指彎曲感測)
- A0: 拇指彎曲感測器
- A1: 食指彎曲感測器  
- A2: 中指彎曲感測器
- A3: 無名指彎曲感測器
- A4: 小指彎曲感測器

### IMU 感測器
- 使用 Arduino Nano 33 BLE Sense 內建的 BMI270 + BMM150
- 自動讀取加速度計、陀螺儀、磁力計數據

## 數據格式

Arduino 輸出 JSON 格式的數據：

```json
{
  "fingers": [512, 256, 768, 384, 640],
  "accelerometer": {"x": 1.234, "y": -0.456, "z": 9.789},
  "gyroscope": {"x": 0.123, "y": -0.345, "z": 0.567},
  "magnetometer": {"x": 12.345, "y": -4.567, "z": 67.890}
}
```

### 電位器數值範圍
- 0-1023 (10位元 ADC)
- 0 = 完全伸直
- 1023 = 完全彎曲

## 瀏覽器支援
- ✅ Chrome 89+
- ✅ Edge 89+
- ❌ Firefox (不支援 Web Serial API)
- ❌ Safari (不支援 Web Serial API)

## 故障排除

### 問題：瀏覽器不支援 Web Serial API
**解決方案：** 使用 Chrome 或 Edge 瀏覽器

### 問題：無法連接串口
**解決方案：**
1. 確認 Arduino 已正確連接 USB
2. 確認 Arduino 程式已上傳成功
3. 確認串口沒有被其他程式佔用

### 問題：沒有數據顯示
**解決方案：**
1. 檢查 Arduino 程式是否正確輸出 JSON 格式
2. 檢查瀏覽器控制台是否有錯誤訊息
3. 確認波特率設定為 115200

## 檔案結構
```
web_project/
├── index.html          # 主頁面
├── script.js           # JavaScript 邏輯
├── styles.css          # 樣式表
├── arduino_serial_example.ino  # Arduino 程式範例
└── README_SERIAL.md    # 使用說明
```

## 技術架構
- **前端：** HTML + CSS + JavaScript
- **通訊：** Web Serial API
- **數據格式：** JSON
- **即時更新：** 串口數據流讀取 