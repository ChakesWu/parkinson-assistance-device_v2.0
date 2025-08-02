"""
模型量化和Arduino部署
將訓練好的CNN-LSTM模型轉換為TensorFlow Lite格式
"""

import tensorflow as tf
import numpy as np
import json
import os
from pathlib import Path

class ModelQuantizer:
    def __init__(self):
        """初始化模型量化器"""
        self.original_model = None
        self.tflite_model = None
        self.quantized_model = None
        
    def load_keras_model(self, model_path):
        """加載Keras模型"""
        try:
            self.original_model = tf.keras.models.load_model(model_path)
            print(f"成功加載模型: {model_path}")
            print(f"模型大小: {os.path.getsize(model_path) / 1024 / 1024:.2f} MB")
            return True
        except Exception as e:
            print(f"加載模型失敗: {e}")
            return False
    
    def create_representative_dataset(self, data_path="data", num_samples=100):
        """
        創建代表性數據集用於量化校準
        
        Args:
            data_path: 數據目錄
            num_samples: 樣本數量
        """
        def representative_data_gen():
            # 從訓練數據中選擇代表性樣本
            all_data = []
            
            for filename in os.listdir(data_path):
                if filename.endswith('.json'):
                    filepath = os.path.join(data_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            session_data = json.load(f)
                        
                        data_points = session_data['data']
                        if len(data_points) >= 50:  # 確保有足夠的序列長度
                            # 提取特徵
                            features = []
                            for point in data_points:
                                feature_vector = (
                                    point['fingers'] + 
                                    [point['emg']] + 
                                    point['imu']
                                )
                                features.append(feature_vector)
                            
                            # 創建序列
                            features = np.array(features)
                            for i in range(len(features) - 50 + 1):
                                sequence = features[i:i + 50]
                                all_data.append(sequence)
                    
                    except Exception as e:
                        continue
            
            # 隨機選擇樣本
            if len(all_data) > num_samples:
                indices = np.random.choice(len(all_data), num_samples, replace=False)
                selected_data = [all_data[i] for i in indices]
            else:
                selected_data = all_data
            
            # 歸一化（簡單的標準化）
            for data in selected_data:
                data_normalized = (data - np.mean(data, axis=0)) / (np.std(data, axis=0) + 1e-8)
                yield [data_normalized.astype(np.float32)]
        
        return representative_data_gen
    
    def convert_to_tflite(self, output_path="models/parkinson_model.tflite"):
        """轉換為TensorFlow Lite格式（無量化）"""
        if self.original_model is None:
            print("沒有加載的模型")
            return False
        
        try:
            converter = tf.lite.TFLiteConverter.from_keras_model(self.original_model)
            self.tflite_model = converter.convert()
            
            # 保存模型
            with open(output_path, 'wb') as f:
                f.write(self.tflite_model)
            
            tflite_size = len(self.tflite_model) / 1024 / 1024
            print(f"TensorFlow Lite模型已保存: {output_path}")
            print(f"TFLite模型大小: {tflite_size:.2f} MB")
            
            return True
            
        except Exception as e:
            print(f"轉換TFLite失敗: {e}")
            return False
    
    def convert_to_quantized_tflite(self, output_path="models/parkinson_model_quantized.tflite", 
                                   data_path="data"):
        """轉換為量化的TensorFlow Lite格式"""
        if self.original_model is None:
            print("沒有加載的模型")
            return False
        
        try:
            converter = tf.lite.TFLiteConverter.from_keras_model(self.original_model)
            
            # 啟用優化
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            # 設定代表性數據集用於校準
            converter.representative_dataset = self.create_representative_dataset(data_path)
            
            # 設定量化為int8
            converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
            converter.inference_input_type = tf.int8
            converter.inference_output_type = tf.int8
            
            self.quantized_model = converter.convert()
            
            # 保存量化模型
            with open(output_path, 'wb') as f:
                f.write(self.quantized_model)
            
            quantized_size = len(self.quantized_model) / 1024
            print(f"量化TensorFlow Lite模型已保存: {output_path}")
            print(f"量化模型大小: {quantized_size:.2f} KB")
            
            return True
            
        except Exception as e:
            print(f"量化轉換失敗: {e}")
            return False
    
    def test_tflite_model(self, model_path, test_data=None):
        """測試TensorFlow Lite模型"""
        try:
            # 加載模型
            interpreter = tf.lite.Interpreter(model_path=model_path)
            interpreter.allocate_tensors()
            
            # 獲取輸入輸出詳情
            input_details = interpreter.get_input_details()
            output_details = interpreter.get_output_details()
            
            print(f"輸入張量: {input_details}")
            print(f"輸出張量: {output_details}")
            
            if test_data is not None:
                # 設定輸入
                interpreter.set_tensor(input_details[0]['index'], test_data)
                
                # 執行推理
                interpreter.invoke()
                
                # 獲取輸出
                output_data = interpreter.get_tensor(output_details[0]['index'])
                print(f"推理結果: {output_data}")
                
                return output_data
            
        except Exception as e:
            print(f"測試TFLite模型失敗: {e}")
            return None
    
    def generate_arduino_header(self, model_path, header_path="arduino/libraries/model_data.h"):
        """生成Arduino C++頭文件"""
        try:
            # 讀取量化模型
            with open(model_path, 'rb') as f:
                model_data = f.read()
            
            # 創建C++數組
            model_size = len(model_data)
            
            header_content = f"""// 自動生成的模型數據文件
// 模型大小: {model_size} bytes

#ifndef MODEL_DATA_H
#define MODEL_DATA_H

const unsigned int model_data_len = {model_size};
const unsigned char model_data[] = {{
"""
            
            # 添加字節數據
            for i, byte in enumerate(model_data):
                if i % 16 == 0:
                    header_content += "\n  "
                header_content += f"0x{byte:02x}"
                if i < len(model_data) - 1:
                    header_content += ", "
            
            header_content += """
};

#endif // MODEL_DATA_H
"""
            
            # 創建目錄
            os.makedirs(os.path.dirname(header_path), exist_ok=True)
            
            # 寫入頭文件
            with open(header_path, 'w') as f:
                f.write(header_content)
            
            print(f"Arduino頭文件已生成: {header_path}")
            print(f"模型大小: {model_size} bytes")
            
            return True
            
        except Exception as e:
            print(f"生成Arduino頭文件失敗: {e}")
            return False
    
    def compare_models(self, original_model_path, tflite_model_path, test_data=None):
        """比較原始模型和TFLite模型的性能"""
        if test_data is None:
            # 創建測試數據
            test_data = np.random.randn(1, 50, 9).astype(np.float32)
        
        # 原始模型預測
        original_model = tf.keras.models.load_model(original_model_path)
        original_pred = original_model.predict(test_data, verbose=0)
        
        # TFLite模型預測
        interpreter = tf.lite.Interpreter(model_path=tflite_model_path)
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        interpreter.set_tensor(input_details[0]['index'], test_data)
        interpreter.invoke()
        tflite_pred = interpreter.get_tensor(output_details[0]['index'])
        
        # 計算差異
        mse = np.mean((original_pred - tflite_pred) ** 2)
        max_diff = np.max(np.abs(original_pred - tflite_pred))
        
        print(f"模型比較結果:")
        print(f"均方誤差: {mse:.6f}")
        print(f"最大差異: {max_diff:.6f}")
        print(f"原始預測: {original_pred[0]}")
        print(f"TFLite預測: {tflite_pred[0]}")
        
        return mse, max_diff

def main():
    """主程序 - 模型量化示例"""
    quantizer = ModelQuantizer()
    
    # 加載訓練好的模型
    if not quantizer.load_keras_model("models/parkinson_cnn_lstm.h5"):
        print("請先訓練模型")
        return
    
    # 轉換為TensorFlow Lite
    print("\n=== 轉換為TensorFlow Lite ===")
    quantizer.convert_to_tflite()
    
    # 轉換為量化TensorFlow Lite
    print("\n=== 轉換為量化TensorFlow Lite ===")
    quantizer.convert_to_quantized_tflite()
    
    # 測試模型
    print("\n=== 測試TFLite模型 ===")
    test_data = np.random.randn(1, 50, 9).astype(np.float32)
    quantizer.test_tflite_model("models/parkinson_model_quantized.tflite", test_data)
    
    # 生成Arduino頭文件
    print("\n=== 生成Arduino頭文件 ===")
    quantizer.generate_arduino_header("models/parkinson_model_quantized.tflite")
    
    # 比較模型
    print("\n=== 模型性能比較 ===")
    quantizer.compare_models("models/parkinson_cnn_lstm.h5", 
                           "models/parkinson_model_quantized.tflite", 
                           test_data)
    
    print("\n模型量化完成！")

if __name__ == "__main__":
    main()