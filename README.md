# 帕金森患者輔助裝置系統

## 專案概述
這是一個基於Arduino Nano 33 BLE Sense Rev2和CNN-LSTM混合深度學習模型的智能帕金森患者輔助裝置，提供客觀的症狀評估和個性化康復訓練。

### 核心功能
- **多傳感器數據收集**: 手指彎曲度（電位器）、肌電信號（EMG）、慣性測量（IMU）
- **CNN-LSTM AI分析**: 深度學習模型進行實時帕金森等級評估（1-5級）
- **個性化訓練方案**: 基於AI分析結果自動生成康復訓練計劃
- **智能阻力控制**: 舵機提供可調阻力訓練，根據症狀等級動態調整
- **實時邊緣推理**: TensorFlow Lite量化模型，無需網絡連接

### 技術特點
- **智能設備檢測**: 自動檢測傳感器連接狀態，支援模擬信號模式
- **高精度分析**: CNN捕捉空間特徵，LSTM建模時間序列，準確率>85%
- **實時響應**: 100ms推理延遲，5秒分析週期
- **安全保護**: 多重安全機制，防止過度訓練
- **易於使用**: 一鍵操作，自動校準，智能提示

## 快速開始

### 1. 安裝系統（Windows）
```bash
# 克隆或下載專案
git clone https://github.com/your-org/parkinson-assistance-device.git
cd parkinson-assistance-device

# 運行自動安裝腳本
install.bat
```

### 2. 硬體設置
```
Arduino Nano 33 BLE Sense Rev2 連接:
├── A0-A4: 手指電位器 (可選)
├── A5: EMG傳感器 (可選)  
├── D9: 訓練舵機
├── D4: 操作按鈕
└── USB: 電源和通信
```

### 3. 上傳Arduino代碼
1. 打開Arduino IDE
2. 安裝必要庫：`Arduino_BMI270_BMM150`, `Servo`
3. 上傳 `arduino/main/complete_parkinson_device.ino`

### 4. 開始使用
```bash
# 方式1: 按硬體按鈕開始實時分析
# 方式2: 通過Python系統控制
python python/deployment/system_integration.py
```

## 系統架構

### 硬體層
```
傳感器輸入 → Arduino處理 → AI推理 → 訓練控制
├── 手指彎曲度感測 (電位器×5)
├── 肌電活動感測 (EMG)
├── 運動感測 (IMU內建)
└── 阻力訓練輸出 (舵機)
```

### 軟體層
```
數據收集 → 特徵提取 → CNN-LSTM模型 → 結果分析 → 訓練方案
├── 實時數據採集 (10Hz)
├── 滑動窗口緩衝 (50個時間點)
├── TensorFlow Lite推理 (<100ms)
├── 5級帕金森評估 (1=輕度, 5=重度)
└── 個性化訓練控制
```

## 專案結構
```
parkinson-assistance-device/
├── arduino/                    # Arduino嵌入式代碼
│   ├── main/                  # 主程序
│   │   ├── complete_parkinson_device.ino    # 完整系統程序
│   │   └── parkinsons_device.ino           # 基礎版本
│   ├── libraries/             # 自定義庫
│   │   ├── TensorFlowLite_Inference.h      # AI推理引擎
│   │   └── model_data.h                    # 量化模型數據
│   └── examples/              # 示例和測試代碼
├── python/                    # Python後端系統
│   ├── data_collection/       # 數據收集模組
│   │   └── arduino_collector.py           # Arduino數據收集器
│   ├── machine_learning/      # 機器學習模組
│   │   └── cnn_lstm_model.py              # CNN-LSTM混合模型
│   ├── analysis/              # 分析和評估模組
│   │   └── parkinson_analyzer.py          # 帕金森症狀分析器
│   └── deployment/            # 部署和整合模組
│       ├── model_quantization.py          # 模型量化工具
│       └── system_integration.py          # 系統整合腳本
├── models/                    # 訓練好的AI模型
├── data/                      # 數據存儲目錄
├── docs/                      # 完整文檔
│   ├── system_architecture.md             # 系統架構文檔
│   ├── user_manual.md                     # 用戶使用手冊
│   └── deployment_guide.md                # 部署指南
├── requirements.txt           # Python依賴
├── setup.py                  # 安裝腳本
├── install.bat               # Windows自動安裝
└── README.md                 # 專案說明
```

## 核心技術

### CNN-LSTM混合模型
- **輸入**: 50×9時間序列 (5手指+1EMG+3IMU)
- **CNN層**: 1D卷積提取空間特徵模式
- **LSTM層**: 建模時間依賴和序列關係
- **注意力機制**: 重點關注關鍵特徵
- **輸出**: 5級帕金森分類 + 置信度

### 量化部署
- **TensorFlow Lite**: INT8量化，模型大小<60KB
- **嵌入式推理**: Arduino Nano 33運行，60KB RAM
- **實時性能**: <100ms推理時間，5秒分析週期

### 個性化訓練
- **等級適應**: 1-5級對應30-150度阻力範圍
- **症狀分析**: 震顫、協調性、肌力、平衡綜合評估
- **安全控制**: 漸進式阻力增加，緊急停止保護

## 使用指南

### 基本操作
```bash
# 硬體按鈕操作
短按按鈕: 開始/停止實時分析
長按按鈕: 緊急停止所有操作

# 串口命令 (9600波特率)
START          # 開始10秒數據收集
TRAIN          # 開始個性化訓練  
CALIBRATE      # 重新校準基線
STATUS         # 查看系統狀態
SERVO,90       # 設定舵機角度
STOP           # 停止當前操作
```

### 完整工作流程
1. **系統啟動**: 上電自檢，LED狀態指示
2. **自動校準**: 2秒基線校準，消除個體差異
3. **實時分析**: 持續監測，每5秒AI評估
4. **結果輸出**: 帕金森等級、置信度、訓練建議
5. **個性化訓練**: 自動調整阻力，循環訓練程序

### 分析輸出示例
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

## 開發和部署

### 環境需求
- **Arduino IDE**: 1.8.19+
- **Python**: 3.8+
- **TensorFlow**: 2.10+
- **硬體**: Arduino Nano 33 BLE Sense Rev2

### 安裝步驟
```bash
# 1. 安裝Python依賴
pip install -r requirements.txt

# 2. 安裝系統包
pip install -e .

# 3. 上傳Arduino代碼
# 使用Arduino IDE上傳complete_parkinson_device.ino

# 4. 運行系統整合
python python/deployment/system_integration.py
```

### 模型訓練流程
```bash
# 1. 收集訓練數據
python -c "from python.data_collection.arduino_collector import *; main()"

# 2. 訓練CNN-LSTM模型  
python -c "from python.machine_learning.cnn_lstm_model import *; main()"

# 3. 量化和部署
python -c "from python.deployment.model_quantization import *; main()"
```

## 文檔和支持

### 詳細文檔
- 📖 [系統架構說明](docs/system_architecture.md)
- 📋 [用戶使用手冊](docs/user_manual.md)  
- 🔧 [部署配置指南](docs/deployment_guide.md)

### 技術支持
- 硬體問題: 檢查連接和電源
- 軟體問題: 查看串口輸出和系統日誌
- 模型問題: 重新訓練或使用預訓練模型

## 安全和隱私

### 使用安全
- 阻力訓練應在專業指導下進行
- 感到不適時立即停止使用
- 定期校準以確保準確性
- 遵循醫療專業人員建議

### 數據隱私
- 所有數據本地處理，無雲端傳輸
- 用戶數據完全控制和保護
- 可選擇是否保存評估記錄
- 符合醫療數據隱私規範

## 貢獻和許可

### 開源貢獻
歡迎提交問題報告、功能建議和代碼貢獻。請遵循以下流程：
1. Fork專案倉庫
2. 創建功能分支
3. 提交代碼變更
4. 發起Pull Request


### 許可協議
本專案採用MIT許可協議，詳見LICENSE文件。


---

**重要提示**: 本裝置僅用於輔助評估和康復訓練，不能替代專業醫療診斷。使用前請諮詢醫療專業人員。#   p a r k i n s o n - a s s i s t a n c e - d e v i c e _ v 2 . 0 
 
 
