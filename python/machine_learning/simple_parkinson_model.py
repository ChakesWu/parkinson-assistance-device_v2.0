"""
簡化的帕金森症AI模型訓練系統
專為Arduino Nano 33 BLE Sense Rev2優化
"""

import numpy as np
import json
import os
from datetime import datetime

class SimpleParkinsonModel:
    """簡化的帕金森症分析模型（不依賴TensorFlow）"""
    
    def __init__(self):
        self.weights = None
        self.bias = None
        self.scaler_mean = None
        self.scaler_std = None
        self.is_trained = False
        
    def create_synthetic_data(self, num_samples=1000):
        """創建合成的帕金森症訓練數據"""
        print("[INFO] 生成合成帕金森症數據...")
        
        X = []
        y = []
        
        for level in range(5):  # 5個等級 (0-4)
            for _ in range(num_samples // 5):
                # 生成50個時間點，9維特徵的序列
                sequence = []
                
                for t in range(50):
                    # 基礎特徵值隨帕金森等級變化
                    base_tremor = level * 0.2 + 0.1
                    base_stiffness = level * 0.15 + 0.05
                    base_coordination = (4 - level) * 0.2 + 0.1
                    
                    # 手指數據 (5維)
                    fingers = []
                    for f in range(5):
                        finger_value = (
                            base_stiffness + 
                            np.random.normal(0, 0.1) +
                            base_tremor * np.sin(t * 0.5 + f)  # 震顫模擬
                        )
                        fingers.append(max(0, min(1, finger_value)))
                    
                    # EMG數據 (1維)
                    emg = base_stiffness + np.random.normal(0, 0.05)
                    emg = max(0, min(1, emg))
                    
                    # IMU數據 (3維) - 協調性和震顫
                    imu = []
                    for axis in range(3):
                        imu_value = (
                            base_coordination +
                            base_tremor * np.cos(t * 0.3 + axis) +
                            np.random.normal(0, 0.08)
                        )
                        imu.append(max(-1, min(1, imu_value)))
                    
                    # 合併為9維特徵向量
                    feature_vector = fingers + [emg] + imu
                    sequence.append(feature_vector)
                
                X.append(sequence)
                y.append(level)
        
        X = np.array(X, dtype=np.float32)
        y = np.array(y, dtype=np.int32)
        
        print(f"[SUCCESS] 生成數據完成: {X.shape}")
        return X, y
    
    def extract_features(self, sequences):
        """從序列中提取統計特徵"""
        features = []
        
        for seq in sequences:
            seq = np.array(seq)
            
            # 統計特徵
            feat = []
            feat.extend(np.mean(seq, axis=0))      # 均值 (9維)
            feat.extend(np.std(seq, axis=0))       # 標準差 (9維)
            feat.extend(np.max(seq, axis=0))       # 最大值 (9維)
            feat.extend(np.min(seq, axis=0))       # 最小值 (9維)
            
            # 時間域特徵
            for i in range(9):
                channel_data = seq[:, i]
                # 零交叉率
                zero_crossings = np.sum(np.diff(np.sign(channel_data)) != 0)
                feat.append(zero_crossings / len(channel_data))
                
                # 變化率
                if len(channel_data) > 1:
                    change_rate = np.mean(np.abs(np.diff(channel_data)))
                    feat.append(change_rate)
                else:
                    feat.append(0)
            
            features.append(feat)
        
        return np.array(features, dtype=np.float32)
    
    def train(self, X, y):
        """訓練簡化模型"""
        print("[INFO] 訓練簡化帕金森症模型...")
        
        # 提取特徵
        features = self.extract_features(X)
        print(f"特徵維度: {features.shape}")
        
        # 標準化
        self.scaler_mean = np.mean(features, axis=0)
        self.scaler_std = np.std(features, axis=0) + 1e-8
        
        features_normalized = (features - self.scaler_mean) / self.scaler_std
        
        # 簡單的線性分類器（多分類）
        num_features = features.shape[1]
        num_classes = 5
        
        # 初始化權重
        self.weights = np.random.normal(0, 0.1, (num_features, num_classes))
        self.bias = np.zeros(num_classes)
        
        # 簡單梯度下降訓練
        learning_rate = 0.01
        epochs = 100
        
        for epoch in range(epochs):
            # 前向傳播
            logits = np.dot(features_normalized, self.weights) + self.bias
            
            # Softmax
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probabilities = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
            
            # 計算損失
            loss = -np.mean(np.log(probabilities[np.arange(len(y)), y] + 1e-8))
            
            # 反向傳播
            y_one_hot = np.eye(num_classes)[y]
            d_logits = (probabilities - y_one_hot) / len(y)
            
            d_weights = np.dot(features_normalized.T, d_logits)
            d_bias = np.mean(d_logits, axis=0)
            
            # 更新參數
            self.weights -= learning_rate * d_weights
            self.bias -= learning_rate * d_bias
            
            if epoch % 20 == 0:
                # 計算準確率
                predictions = np.argmax(probabilities, axis=1)
                accuracy = np.mean(predictions == y)
                print(f"Epoch {epoch}: Loss={loss:.4f}, Accuracy={accuracy:.4f}")
        
        self.is_trained = True
        print("[SUCCESS] 模型訓練完成!")
        
        # 最終評估
        final_predictions = np.argmax(probabilities, axis=1)
        final_accuracy = np.mean(final_predictions == y)
        print(f"最終訓練準確率: {final_accuracy:.4f}")
        
        return final_accuracy
    
    def predict(self, sequence):
        """預測單個序列"""
        if not self.is_trained:
            return None
        
        # 提取特徵
        features = self.extract_features([sequence])[0]
        
        # 標準化
        features_normalized = (features - self.scaler_mean) / self.scaler_std
        
        # 預測
        logits = np.dot(features_normalized, self.weights) + self.bias
        
        # Softmax
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / np.sum(exp_logits)
        
        predicted_class = np.argmax(probabilities)
        confidence = probabilities[predicted_class]
        
        return {
            'predicted_level': predicted_class + 1,  # 轉換為1-5等級
            'confidence': confidence,
            'probabilities': probabilities.tolist()
        }
    
    def save_model(self, filepath="models/simple_parkinson_model.json"):
        """保存模型"""
        if not self.is_trained:
            print("模型尚未訓練")
            return False
        
        model_data = {
            'weights': self.weights.tolist(),
            'bias': self.bias.tolist(),
            'scaler_mean': self.scaler_mean.tolist(),
            'scaler_std': self.scaler_std.tolist(),
            'metadata': {
                'model_type': 'simple_linear_classifier',
                'input_shape': [50, 9],
                'output_classes': 5,
                'created_at': datetime.now().isoformat()
            }
        }
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w') as f:
            json.dump(model_data, f, indent=2)
        
        print(f"[SUCCESS] 模型已保存: {filepath}")
        return True
    
    def load_model(self, filepath="models/simple_parkinson_model.json"):
        """加載模型"""
        try:
            with open(filepath, 'r') as f:
                model_data = json.load(f)
            
            self.weights = np.array(model_data['weights'])
            self.bias = np.array(model_data['bias'])
            self.scaler_mean = np.array(model_data['scaler_mean'])
            self.scaler_std = np.array(model_data['scaler_std'])
            self.is_trained = True
            
            print(f"[SUCCESS] 模型已加載: {filepath}")
            return True
            
        except Exception as e:
            print(f"[ERROR] 模型加載失敗: {e}")
            return False

def main():
    """主程序 - 訓練和測試簡化模型"""
    print(">>> 簡化帕金森症AI模型訓練系統")
    print("=" * 50)
    
    # 創建模型
    model = SimpleParkinsonModel()
    
    # 生成訓練數據
    X_train, y_train = model.create_synthetic_data(1000)
    
    # 訓練模型
    accuracy = model.train(X_train, y_train)
    
    # 保存模型
    model.save_model()
    
    # 測試模型
    print("\n[TEST] 測試模型預測...")
    test_sequence = X_train[0]  # 使用第一個樣本測試
    result = model.predict(test_sequence)
    
    print(f"測試結果:")
    print(f"  預測等級: {result['predicted_level']}")
    print(f"  置信度: {result['confidence']:.3f}")
    print(f"  實際等級: {y_train[0] + 1}")
    
    print("\n[SUCCESS] 簡化模型訓練完成!")
    print("下一步: 運行 convert_to_arduino.py 轉換為Arduino格式")

if __name__ == "__main__":
    main()