"""
完整系統整合腳本
整合數據收集、模型訓練、量化部署的完整流程
"""

import os
import sys
import json
import numpy as np
from datetime import datetime
import argparse

# 添加模組路徑
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from data_collection.arduino_collector import ArduinoDataCollector
from machine_learning.cnn_lstm_model import ParkinsonCNNLSTMModel
from deployment.model_quantization import ModelQuantizer
from analysis.parkinson_analyzer import ParkinsonAnalyzer

class ParkinsonSystemIntegration:
    def __init__(self, arduino_port='COM3'):
        """初始化完整系統"""
        self.arduino_port = arduino_port
        self.collector = None
        self.model = None
        self.quantizer = None
        self.analyzer = None
        
        # 確保目錄存在
        os.makedirs('data', exist_ok=True)
        os.makedirs('models', exist_ok=True)
        
    def initialize_components(self):
        """初始化所有組件"""
        print("=== 初始化系統組件 ===")
        
        # 初始化數據收集器
        self.collector = ArduinoDataCollector(port=self.arduino_port)
        
        # 初始化模型
        self.model = ParkinsonCNNLSTMModel()
        
        # 初始化量化器
        self.quantizer = ModelQuantizer()
        
        # 初始化分析器
        self.analyzer = ParkinsonAnalyzer()
        
        print("所有組件初始化完成")
    
    def full_pipeline_setup(self):
        """完整流程設置"""
        print("\n=== 帕金森輔助裝置完整設置流程 ===")
        print("此流程將帶您完成從數據收集到模型部署的全部步驟")
        
        choice = input("\n選擇操作:\n1. 收集訓練數據\n2. 訓練模型\n3. 量化並部署模型\n4. 完整流程\n5. 實時分析測試\n請輸入選項 (1-5): ")
        
        if choice == '1':
            self.collect_training_data()
        elif choice == '2':
            self.train_model()
        elif choice == '3':
            self.quantize_and_deploy()
        elif choice == '4':
            self.full_pipeline()
        elif choice == '5':
            self.real_time_analysis()
        else:
            print("無效選項")
    
    def collect_training_data(self):
        """收集訓練數據"""
        print("\n=== 收集訓練數據 ===")
        
        if not self.collector:
            self.collector = ArduinoDataCollector(port=self.arduino_port)
        
        if not self.collector.connect():
            print("無法連接Arduino，請檢查連接")
            return False
        
        try:
            # 配置患者數據收集
            patients_config = []
            
            print("請配置要收集的患者數據:")
            for level in range(1, 6):
                patient_count = int(input(f"帕金森等級 {level} 的患者數量: "))
                sessions_per_patient = int(input(f"每位患者的會話數量: "))
                
                for i in range(patient_count):
                    patient_id = f"P{level:02d}_{i+1:02d}"
                    patients_config.append({
                        'patient_id': patient_id,
                        'parkinson_level': level,
                        'sessions': sessions_per_patient
                    })
            
            print(f"\n將收集 {len(patients_config)} 位患者的數據")
            confirm = input("確認開始收集? (y/n): ").lower() == 'y'
            
            if confirm:
                sessions = self.collector.collect_training_dataset(patients_config)
                print(f"數據收集完成，總計 {len(sessions)} 個會話")
                return True
            
        finally:
            self.collector.disconnect()
        
        return False
    
    def train_model(self):
        """訓練模型"""
        print("\n=== 訓練CNN-LSTM模型 ===")
        
        if not self.model:
            self.model = ParkinsonCNNLSTMModel()
        
        try:
            # 加載數據
            df = self.model.load_and_preprocess_data("data")
            print(f"加載數據: {len(df)} 個數據點")
            
            # 配置訓練參數
            epochs = int(input("訓練輪數 (建議50-100): "))
            batch_size = int(input("批次大小 (建議16-32): "))
            
            # 訓練模型
            history = self.model.train_model(df, epochs=epochs, batch_size=batch_size)
            
            # 保存模型
            self.model.save_model()
            self.model.plot_training_history()
            
            print("模型訓練完成並已保存")
            return True
            
        except Exception as e:
            print(f"模型訓練失敗: {e}")
            return False
    
    def quantize_and_deploy(self):
        """量化並部署模型"""
        print("\n=== 量化並部署模型 ===")
        
        if not self.quantizer:
            self.quantizer = ModelQuantizer()
        
        model_path = "models/parkinson_cnn_lstm.h5"
        if not os.path.exists(model_path):
            print("模型文件不存在，請先訓練模型")
            return False
        
        try:
            # 加載模型
            if not self.quantizer.load_keras_model(model_path):
                return False
            
            # 轉換為TensorFlow Lite
            print("轉換為TensorFlow Lite...")
            self.quantizer.convert_to_tflite()
            
            # 量化模型
            print("量化模型...")
            self.quantizer.convert_to_quantized_tflite()
            
            # 生成Arduino頭文件
            print("生成Arduino頭文件...")
            self.quantizer.generate_arduino_header("models/parkinson_model_quantized.tflite")
            
            # 模型性能比較
            print("比較模型性能...")
            self.quantizer.compare_models(model_path, "models/parkinson_model_quantized.tflite")
            
            print("模型量化和部署準備完成!")
            print("請將生成的頭文件複製到Arduino項目中")
            
            return True
            
        except Exception as e:
            print(f"量化部署失敗: {e}")
            return False
    
    def full_pipeline(self):
        """完整流程"""
        print("\n=== 執行完整流程 ===")
        
        print("步驟1: 收集訓練數據")
        if not self.collect_training_data():
            print("數據收集失敗，流程終止")
            return
        
        print("\n步驟2: 訓練模型")
        if not self.train_model():
            print("模型訓練失敗，流程終止")
            return
        
        print("\n步驟3: 量化並部署")
        if not self.quantize_and_deploy():
            print("模型部署失敗，流程終止")
            return
        
        print("\n=== 完整流程執行成功! ===")
        print("您現在可以:")
        print("1. 將Arduino代碼上傳到設備")
        print("2. 進行實時帕金森分析")
        print("3. 使用個性化訓練功能")
    
    def real_time_analysis(self):
        """實時分析測試"""
        print("\n=== 實時分析測試 ===")
        
        if not self.collector:
            self.collector = ArduinoDataCollector(port=self.arduino_port)
        
        if not self.analyzer:
            self.analyzer = ParkinsonAnalyzer()
        
        if not self.collector.connect():
            print("無法連接Arduino")
            return
        
        try:
            print("開始收集實時數據進行分析...")
            
            # 模擬實時分析
            session_data = self.collector.collect_data_session(
                duration=10,
                patient_id="REALTIME_TEST",
                parkinson_level=None
            )
            
            if session_data:
                # 準備傳感器數據
                sensor_data = {
                    'fingers': [],
                    'emg': [],
                    'imu': []
                }
                
                for point in session_data['data']:
                    sensor_data['fingers'].append(point['fingers'])
                    sensor_data['emg'].append(point['emg'])
                    sensor_data['imu'].append(point['imu'])
                
                # 模擬AI預測（實際應使用訓練好的模型）
                predicted_level = np.random.randint(1, 6)
                confidence = np.random.uniform(0.7, 0.95)
                
                print(f"模擬AI預測結果: 等級 {predicted_level}, 置信度 {confidence:.3f}")
                
                # 生成分析報告
                assessment = self.analyzer.generate_assessment(
                    patient_id="REALTIME_TEST",
                    predicted_level=predicted_level,
                    confidence=confidence,
                    sensor_data=sensor_data
                )
                
                # 打印報告
                self.analyzer.print_assessment_report(assessment)
                
                # 保存報告
                self.analyzer.save_assessment(assessment)
                
        finally:
            self.collector.disconnect()
    
    def generate_deployment_guide(self):
        """生成部署指南"""
        guide = """
# 帕金森輔助裝置部署指南

## 硬體準備
1. Arduino Nano 33 BLE Sense Rev2
2. 5個電位器 (10kΩ，連接到A0-A4)
3. EMG傳感器 (連接到A5)
4. 舵機 (連接到D9)
5. 按鈕 (連接到D4)
6. 檢測電路 (D2, D3)

## 軟體部署步驟
1. 安裝Arduino IDE和必要庫:
   - Arduino_BMI270_BMM150
   - TensorFlowLite_ESP32 (修改版)
   - Servo

2. 複製生成的model_data.h到Arduino項目

3. 上傳complete_parkinson_device.ino到Arduino

4. 通過串口監視器或Python腳本與設備交互

## 使用方法
1. 按按鈕開始實時分析
2. 系統自動校準基線
3. AI模型分析帕金森等級
4. 獲得個性化訓練建議
5. 執行舵機輔助訓練

## 串口命令
- START: 開始數據收集
- TRAIN: 開始訓練模式
- CALIBRATE: 重新校準
- STATUS: 查看系統狀態
- SERVO,angle: 設定舵機角度
- STOP: 停止當前操作
"""
        
        with open("docs/deployment_guide.md", 'w', encoding='utf-8') as f:
            f.write(guide)
        
        print("部署指南已生成: docs/deployment_guide.md")

def main():
    """主程序"""
    parser = argparse.ArgumentParser(description='帕金森輔助裝置系統整合')
    parser.add_argument('--port', default='COM3', help='Arduino端口')
    parser.add_argument('--mode', choices=['collect', 'train', 'deploy', 'full', 'test'], 
                       default='full', help='運行模式')
    
    args = parser.parse_args()
    
    # 創建系統整合對象
    system = ParkinsonSystemIntegration(arduino_port=args.port)
    system.initialize_components()
    
    if args.mode == 'collect':
        system.collect_training_data()
    elif args.mode == 'train':
        system.train_model()
    elif args.mode == 'deploy':
        system.quantize_and_deploy()
    elif args.mode == 'test':
        system.real_time_analysis()
    else:
        system.full_pipeline_setup()
    
    # 生成部署指南
    system.generate_deployment_guide()

if __name__ == "__main__":
    main()