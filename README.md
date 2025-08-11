
# 帕金森患者輔助裝置系統

## 專案概述
本專案是一套基於 Arduino Nano 33 BLE Sense Rev2 與 CNN-LSTM 深度學習模型的智能輔助裝置，為帕金森患者提供症狀評估與個性化康復訓練。

---

## 特色功能

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

---

## 技術特點

- 智能設備偵測（自動檢查傳感器連接）
- 高精度 CNN-LSTM 分析（準確率 > 85%）
- 100ms 推理延遲，5 秒分析一次
- 多重安全與過度訓練保護
- 一鍵操作、自動校準、智能提示

---

## 快速開始

### 1. 安裝系統（Windows）
```bash
git clone https://github.com/ChakesWu/parkinson-assistance-device_v2.0.git
cd parkinson-assistance-device
install.bat
```

### 2. 硬體連接
- A0-A4：手指電位器（可選）
- A5：EMG 傳感器（可選）
- D9：訓練舵機
- D4：操作按鈕
- USB：電源與通訊

### 3. 上傳 Arduino 程式
1. 開啟 Arduino IDE
2. 安裝 `Arduino_BMI270_BMM150`、`Servo` 等庫
3. 上傳 `arduino/main/complete_parkinson_device.ino`

### 4. 啟動系統
- 按硬體按鈕開始分析  
- 或執行 Python 控制程式：
```bash
python python/deployment/system_integration.py
```

---

## 專案結構

```text
parkinson-assistance-device/
├── arduino/                 # Arduino 嵌入式程式
│   ├── main/                # 主程式
│   │   ├── complete_parkinson_device.ino
│   │   └── parkinsons_device.ino
│   ├── libraries/           # 自訂庫
│   │   ├── TensorFlowLite_Inference.h
│   │   └── model_data.h
│   └── examples/            # 範例/測試
├── python/                  # Python 後端
│   ├── data_collection/
│   │   └── arduino_collector.py
│   ├── machine_learning/
│   │   └── cnn_lstm_model.py
│   ├── analysis/
│   │   └── parkinson_analyzer.py
│   └── deployment/
│       ├── model_quantization.py
│       └── system_integration.py
├── models/                  # 訓練模型
├── data/                    # 數據存儲
├── docs/                    # 文檔
│   ├── system_architecture.md
│   ├── user_manual.md
│   └── deployment_guide.md
├── requirements.txt         # Python 依賴
├── setup.py                 # 安裝腳本
├── install.bat              # Windows 安裝
└── README.md                # 說明文件
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




