"""
帕金森輔助裝置Python系統包

這個包包含了完整的帕金森輔助裝置後端系統，包括：
- 數據收集和預處理
- CNN-LSTM機器學習模型
- 症狀分析和評估
- 模型量化和部署
- 系統整合和控制

版本: 1.0.0
作者: 帕金森輔助裝置開發團隊
"""

__version__ = "1.0.0"
__author__ = "帕金森輔助裝置開發團隊"
__email__ = "contact@parkinson-device.com"
__description__ = "基於Arduino和AI的帕金森患者輔助裝置系統"

# 導入主要模組
try:
    from .data_collection.arduino_collector import ArduinoDataCollector
    from .machine_learning.cnn_lstm_model import ParkinsonCNNLSTMModel
    from .analysis.parkinson_analyzer import ParkinsonAnalyzer
    from .deployment.model_quantization import ModelQuantizer
    from .deployment.system_integration import ParkinsonSystemIntegration
    
    __all__ = [
        'ArduinoDataCollector',
        'ParkinsonCNNLSTMModel', 
        'ParkinsonAnalyzer',
        'ModelQuantizer',
        'ParkinsonSystemIntegration'
    ]
    
except ImportError as e:
    print(f"警告: 部分模組導入失敗: {e}")
    print("請確認已安裝所有必要的依賴包")
    __all__ = []

# 系統信息
SYSTEM_INFO = {
    "name": "帕金森輔助裝置系統",
    "version": __version__,
    "description": __description__,
    "hardware": "Arduino Nano 33 BLE Sense Rev2",
    "ai_model": "CNN-LSTM混合深度學習模型",
    "deployment": "TensorFlow Lite量化模型",
    "features": [
        "多傳感器數據融合",
        "實時AI症狀分析", 
        "個性化訓練方案",
        "智能阻力控制",
        "邊緣計算推理"
    ]
}

def get_system_info():
    """獲取系統信息"""
    return SYSTEM_INFO

def print_system_info():
    """打印系統信息"""
    info = get_system_info()
    print("=" * 50)
    print(f"系統名稱: {info['name']}")
    print(f"版本: {info['version']}")
    print(f"描述: {info['description']}")
    print(f"硬體平台: {info['hardware']}")
    print(f"AI模型: {info['ai_model']}")
    print(f"部署方案: {info['deployment']}")
    print("主要功能:")
    for feature in info['features']:
        print(f"  - {feature}")
    print("=" * 50)