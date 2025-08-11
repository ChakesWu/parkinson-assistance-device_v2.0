
# 帕金森患者輔助裝置系統

## 專案概述
本專案是一套基於 Arduino Nano 33 BLE Sense Rev2 與 CNN-LSTM 深度學習模型的智能輔助裝置，為帕金森患者提供症狀評估與個性化康復訓練。

---

## 特色功能

<<<<<<< HEAD
### 🔬 多模態數據收集
- **手指彎曲度檢測**：5個電位器精確測量手指關節角度
- **肌電信號分析**：EMG傳感器監測肌肉活動狀態
- **慣性測量單元**：9軸IMU檢測手部震顫和運動模式
- **實時數據融合**：多傳感器數據同步採集與處理

### 🧠 智能AI分析系統
- **CNN-LSTM混合模型**：深度學習網路進行症狀評估
- **帕金森分級評估**：1-5級精確分級（準確率>85%）
- **症狀特徵提取**：震顫、僵硬、運動遲緩等關鍵指標
- **邊緣運算推理**：100ms內完成本地AI分析

### 🎯 個性化康復訓練
- **智能訓練計劃**：根據AI分析結果自動生成
- **動態阻力調節**：舵機系統提供1-5級阻力訓練
- **進度追蹤監控**：長期康復效果評估與記錄
- **安全保護機制**：緊急停止與過載保護

### 🌐 多平台用戶介面
- **3D視覺化展示**：即時手部動作3D模型顯示
- **網頁端控制台**：直觀的數據監控與設備控制
- **桌面應用程式**：完整功能的本地應用
- **行動裝置支援**：響應式設計適配各種螢幕

### 🔗 多種連接方式
- **USB串口連接**：穩定的有線數據傳輸
- **藍牙低功耗(BLE)**：無線連接與數據同步
- **跨平台相容**：支援Windows、macOS、Linux
- **即插即用設計**：自動設備識別與配置
=======
- **多傳感器數據收集**  
  - 手指彎曲度（電位器）  
  - 語音
  - 慣性測量（IMU）  
- **AI 分析**  
  - CNN-LSTM 模型實時評估帕金森等級（1-5 級）  
- **個性化訓練**  
  - 根據分析自動生成康復計劃  
- **智能阻力控制**  
  - 舵機根據症狀等級動態調整阻力  
- **實時邊緣推理**  
  - 使用 TensorFlow Lite，無需網路連接  
>>>>>>> d5aa603c3169bf926d01d32ebb514d4ae81c67aa

---

## 技術特點

- 智能設備偵測（自動檢查傳感器連接）
- 高精度 CNN-LSTM 分析（準確率 > 85%）
- 100ms 推理延遲，5 秒分析一次
- 多重安全與過度訓練保護
- 一鍵操作、自動校準、智能提示

---

## 快速開始

### 📦 系統安裝

#### Windows 一鍵安裝
```bash
git clone https://github.com/ChakesWu/parkinson-assistance-device_v2.0.git
cd parkinson-assistance-device_v2.0
install.bat
```

#### 手動安裝
```bash
# 1. 克隆專案
git clone https://github.com/ChakesWu/parkinson-assistance-device_v2.0.git
cd parkinson-assistance-device_v2.0

# 2. 安裝 Python 依賴
pip install -r requirements.txt

# 3. 安裝 Node.js 依賴
npm install

# 4. 安裝系統包
pip install -e .
```

### 🔌 硬體連接

#### Arduino Nano 33 BLE Sense Rev2 接線圖 (左手配置)
```
手指電位器連接 (左手邏輯)：
├── A4 → 拇指彎曲感測器 (finger1)
├── A3 → 食指彎曲感測器 (finger2)
├── A2 → 中指彎曲感測器 (finger3)
├── A1 → 無名指彎曲感測器 (finger4)
└── A0 → 小指彎曲感測器 (finger5)

其他傳感器：
├── A5 → EMG 肌電傳感器（可選）
├── D9 → 訓練舵機控制
├── D4 → 操作按鈕
└── USB → 電源與數據傳輸
```

### 💾 Arduino 程式上傳

#### 必要函式庫安裝
```bash
# 在 Arduino IDE 中安裝以下函式庫：
- Arduino_BMI270_BMM150 (IMU傳感器)
- Servo (舵機控制)
- Arduino_TensorFlowLite (AI推理)
```

#### 程式上傳步驟
1. 開啟 Arduino IDE
2. 選擇開發板：`Arduino Nano 33 BLE`
3. 選擇正確的串口
4. 開啟 `arduino/main/complete_parkinson_device/complete_parkinson_device.ino`
5. 點擊上傳按鈕

### 🚀 系統啟動

#### 方式一：網頁介面（推薦）
```bash
# 開啟 3D 視覺化介面
cd 3d_hand_project
# 用瀏覽器開啟 index.html
```

#### 方式二：Next.js 應用
```bash
cd parkinson-dock-ui
npm run dev
# 瀏覽器開啟 http://localhost:3000
```

#### 方式三：Python 控制台
```bash
python python/deployment/system_integration.py
```

#### 方式四：硬體按鈕控制
- **短按**：開始/停止分析
- **長按**：緊急停止與重置

---

## 專案結構

```text
parkinson-assistance-device_v2.0/
├── arduino/                 # Arduino 嵌入式程式
│   ├── main/                # 主程式
│   │   └── complete_parkinson_device/
│   │       └── complete_parkinson_device.ino
│   ├── libraries/           # Arduino 函式庫
│   │   └── Arduino_TensorFlowLite/
│   └── examples/            # 範例程式
├── python/                  # Python 後端系統
│   ├── data_collection/     # 數據收集模組
│   ├── machine_learning/    # 機器學習模型
│   ├── analysis/            # 數據分析工具
│   ├── ble_client/          # 藍牙連接客戶端
│   ├── arduino/             # Arduino 通訊介面
│   └── deployment/          # 部署與整合
├── 3d_hand_project/         # 3D 手部模型專案
│   ├── index.html           # 網頁介面
│   ├── script.js            # JavaScript 邏輯
│   ├── hand3d.js            # 3D 模型控制
│   ├── hand_model.glb       # 3D 手部模型
│   └── README_*.md          # 專案說明文件
├── parkinson-dock-ui/       # Next.js 網頁應用
│   ├── src/                 # 源代碼
│   ├── public/              # 靜態資源
│   ├── package.json         # 依賴配置
│   └── README.md            # 應用說明
├── parkinson-dock-app/      # 桌面應用程式
├── models/                  # 訓練完成的AI模型
├── data/                    # 數據存儲目錄
├── docs/                    # 技術文檔
│   ├── system_architecture.md
│   ├── user_manual.md
│   └── device_connection_troubleshooting.md
├── node_modules/            # Node.js 依賴
├── requirements.txt         # Python 依賴清單
├── package.json             # Node.js 專案配置
├── setup.py                 # Python 安裝腳本
├── install.bat              # Windows 一鍵安裝
├── LICENSE                  # 開源授權
└── README.md                # 專案說明文件
```

---

## 核心技術

### CNN-LSTM 混合模型
- **輸入**：50×9 時間序列（5手指 + 1EMG + 3IMU）
- **CNN**：1D 卷積提取空間特徵
- **LSTM**：建模時間序列
- **注意力機制**：強化關鍵特徵
- **輸出**：帕金森分級（1-5 級）+ 置信度

### 量化部署
- TensorFlow Lite INT8 量化，模型 < 60KB
- Arduino Nano 33 BLE Sense 運行
- <100ms 推理、5 秒分析週期

### 個性化訓練
- 1-5 級對應 30-150 度阻力
- 綜合評估震顫、協調、肌力、平衡
- 支援緊急停止保護

---

## 使用指南

### 按鈕與串口命令

- **硬體按鈕**  
  - 短按：開始/停止分析  
  - 長按：緊急停止

- **串口命令（9600 波特率）**  
  - `START`：開始數據收集  
  - `TRAIN`：開始訓練  
  - `CALIBRATE`：重新校準  
  - `STATUS`：查詢狀態  
  - `SERVO,90`：設舵機角度  
  - `STOP`：停止操作

### 工作流程

1. 系統啟動與自檢
2. 自動基線校準（2秒）
3. 實時分析（每5秒1次AI評估）
4. 結果輸出（分級、信心度、訓練建議）
5. 個性化訓練（自動調整阻力、循環訓練）

#### 分析結果範例
```
=== AI分析結果 ===
帕金森等級: 3 (中度症狀)
置信度: 87.5%
症狀分析:
  手指靈活性: 0.342
  協調性: 0.678
  震顫指數: 0.234
訓練建議: 重點改善精細動作控制，舵機阻力設定90度
建議訓練頻率: 每日3次，每次25-30分鐘
==================
```

---

## 安裝與部署

### 環境需求
- Arduino IDE 1.8.19+
- Python 3.8+
- TensorFlow 2.10+
- Arduino Nano 33 BLE Sense Rev2

### 安裝步驟

```bash
# 1. 安裝 Python 依賴
pip install -r requirements.txt

# 2. 安裝系統包
pip install -e .

# 3. 上傳 Arduino 程式
# 用 Arduino IDE 上傳 complete_parkinson_device.ino

# 4. 運行系統整合
python python/deployment/system_integration.py
```

### 模型訓練流程

```bash
# 1. 收集訓練數據
python -c "from python.data_collection.arduino_collector import *; main()"

# 2. 訓練 CNN-LSTM 模型
python -c "from python.machine_learning.cnn_lstm_model import *; main()"

# 3. 量化與部署
python -c "from python.deployment.model_quantization import *; main()"
```

---

## 文件與支援

- 📖 [系統架構說明](docs/system_architecture.md)
- 📋 [用戶使用手冊](docs/user_manual.md)
- 🔧 [部署配置指南](docs/deployment_guide.md)

**技術支援**  
- 硬體問題：檢查連接/電源  
- 軟體問題：檢查串口輸出與日誌  
- 模型問題：重新訓練或用預訓練模型

---

## 安全與隱私

- 阻力訓練請在專業指導下進行
- 感到不適請立即停止
- 經常校準，確保準確性
- 數據僅本地處理，無雲端上傳
- 用戶數據完全自主管理
- 符合醫療數據隱私規範

---

## 貢獻方式與授權

1. Fork 本倉庫
2. 建立功能分支
3. 提交代碼
4. 發起 Pull Request

專案採用 MIT 授權，詳見 LICENSE。

---

> **重要提醒：本裝置僅作輔助評估與訓練，不能取代專業醫療診斷。使用前請諮詢醫療專業人員。**

---

## 聯絡資訊

如有任何問題或建議，歡迎透過以下方式聯絡：

- 📧 Email: [專案維護者信箱]
- 🐛 Issues: [GitHub Issues](https://github.com/ChakesWu/parkinson-assistance-device_v2.0/issues)
- 💬 討論: [GitHub Discussions](https://github.com/ChakesWu/parkinson-assistance-device_v2.0/discussions)

---

## 更新日誌

### v2.0 (最新版本)
- ✅ 完整的CNN-LSTM AI分析模型
- ✅ 3D手部模型即時動畫
- ✅ 藍牙低功耗(BLE)連接支援
- ✅ 個性化康復訓練系統
- ✅ 邊緣運算推理能力
- ✅ 多傳感器數據融合

### v1.0
- 基礎手指彎曲檢測
- 簡單數據收集功能

---

## 致謝

感謝所有為本專案貢獻的開發者和研究人員，以及提供寶貴建議的醫療專業人員。

