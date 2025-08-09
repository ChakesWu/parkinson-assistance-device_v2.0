"""
轻量级语音帕金森分类器
基于GitHub项目的CNN方法，简化为适合Arduino部署的线性分类器
"""

import numpy as np
import json
import os
from datetime import datetime
from speech_feature_extractor import LightweightSpeechFeatureExtractor, create_synthetic_speech_data

class SpeechParkinsonClassifier:
    """
    轻量级语音帕金森分类器
    使用8维语音特征进行二分类 (健康/帕金森)
    """
    
    def __init__(self):
        self.weights = None
        self.bias = None
        self.scaler_mean = None
        self.scaler_std = None
        self.is_trained = False
        self.feature_extractor = LightweightSpeechFeatureExtractor()
        
    def train(self, X, y, epochs=200, learning_rate=0.01):
        """
        训练二分类模型
        
        Args:
            X: 特征矩阵 (n_samples, 8)
            y: 标签向量 (n_samples,) - 0: 健康, 1: 帕金森
        """
        print("[INFO] 训练语音帕金森分类器...")
        
        X = np.array(X, dtype=np.float32)
        y = np.array(y, dtype=np.float32)
        
        # 特征标准化
        self.scaler_mean = np.mean(X, axis=0)
        self.scaler_std = np.std(X, axis=0) + 1e-8
        X_normalized = (X - self.scaler_mean) / self.scaler_std
        
        # 初始化参数
        n_features = X.shape[1]
        self.weights = np.random.normal(0, 0.1, n_features)
        self.bias = 0.0
        
        # 训练循环
        for epoch in range(epochs):
            # 前向传播
            z = np.dot(X_normalized, self.weights) + self.bias
            predictions = 1 / (1 + np.exp(-z))  # Sigmoid
            
            # 计算损失
            loss = -np.mean(y * np.log(predictions + 1e-8) + 
                          (1 - y) * np.log(1 - predictions + 1e-8))
            
            # 反向传播
            dz = predictions - y
            dw = np.dot(X_normalized.T, dz) / len(y)
            db = np.mean(dz)
            
            # 更新参数
            self.weights -= learning_rate * dw
            self.bias -= learning_rate * db
            
            # 计算准确率
            if epoch % 50 == 0:
                pred_labels = (predictions > 0.5).astype(int)
                accuracy = np.mean(pred_labels == y)
                print(f"Epoch {epoch}: Loss={loss:.4f}, Accuracy={accuracy:.4f}")
        
        self.is_trained = True
        
        # 最终评估
        final_predictions = (predictions > 0.5).astype(int)
        final_accuracy = np.mean(final_predictions == y)
        print(f"[SUCCESS] 训练完成! 最终准确率: {final_accuracy:.4f}")
        
        return final_accuracy
    
    def predict(self, features):
        """
        预测单个样本
        
        Args:
            features: 8维特征向量
            
        Returns:
            dict: 包含预测结果和置信度
        """
        if not self.is_trained:
            return None
        
        features = np.array(features, dtype=np.float32)
        
        # 标准化
        features_normalized = (features - self.scaler_mean) / self.scaler_std
        
        # 预测
        z = np.dot(features_normalized, self.weights) + self.bias
        probability = 1 / (1 + np.exp(-z))
        
        predicted_class = int(probability > 0.5)
        confidence = probability if predicted_class == 1 else (1 - probability)
        
        return {
            'predicted_class': predicted_class,  # 0: 健康, 1: 帕金森
            'probability': probability,
            'confidence': confidence,
            'diagnosis': '帕金森症状' if predicted_class == 1 else '健康'
        }
    
    def predict_from_audio(self, audio_data):
        """
        从音频数据直接预测
        
        Args:
            audio_data: 音频数据 (numpy array)
        """
        # 提取特征
        features = self.feature_extractor.extract_features(audio_data)
        
        # 预测
        return self.predict(features)
    
    def predict_from_file(self, audio_file_path):
        """
        从音频文件预测
        """
        # 提取特征
        features = self.feature_extractor.extract_features_from_file(audio_file_path)
        
        # 预测
        return self.predict(features)
    
    def save_model(self, filepath="models/speech_parkinson_classifier.json"):
        """保存模型"""
        if not self.is_trained:
            print("模型尚未训练")
            return False
        
        model_data = {
            'weights': self.weights.tolist(),
            'bias': float(self.bias),
            'scaler_mean': self.scaler_mean.tolist(),
            'scaler_std': self.scaler_std.tolist(),
            'feature_names': self.feature_extractor.get_feature_names(),
            'metadata': {
                'model_type': 'speech_parkinson_classifier',
                'input_features': 8,
                'output_classes': 2,
                'created_at': datetime.now().isoformat()
            }
        }
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w') as f:
            json.dump(model_data, f, indent=2)
        
        print(f"[SUCCESS] 语音分类模型已保存: {filepath}")
        return True
    
    def load_model(self, filepath="models/speech_parkinson_classifier.json"):
        """加载模型"""
        try:
            with open(filepath, 'r') as f:
                model_data = json.load(f)
            
            self.weights = np.array(model_data['weights'])
            self.bias = float(model_data['bias'])
            self.scaler_mean = np.array(model_data['scaler_mean'])
            self.scaler_std = np.array(model_data['scaler_std'])
            self.is_trained = True
            
            print(f"[SUCCESS] 语音分类模型已加载: {filepath}")
            return True
            
        except Exception as e:
            print(f"[ERROR] 模型加载失败: {e}")
            return False
    
    def evaluate(self, X_test, y_test):
        """评估模型性能"""
        if not self.is_trained:
            print("模型尚未训练")
            return None
        
        predictions = []
        for features in X_test:
            result = self.predict(features)
            predictions.append(result['predicted_class'])
        
        predictions = np.array(predictions)
        accuracy = np.mean(predictions == y_test)
        
        # 计算混淆矩阵
        tp = np.sum((predictions == 1) & (y_test == 1))
        tn = np.sum((predictions == 0) & (y_test == 0))
        fp = np.sum((predictions == 1) & (y_test == 0))
        fn = np.sum((predictions == 0) & (y_test == 1))
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score,
            'confusion_matrix': {'tp': tp, 'tn': tn, 'fp': fp, 'fn': fn}
        }

def main():
    """主程序 - 训练和测试语音分类器"""
    print(">>> 语音帕金森分类器训练系统")
    print("=" * 50)
    
    # 创建分类器
    classifier = SpeechParkinsonClassifier()
    
    # 生成训练数据
    print("\n1. 生成训练数据...")
    X_train, y_train = create_synthetic_speech_data(1000)
    X_test, y_test = create_synthetic_speech_data(200)
    
    print(f"训练数据: {X_train.shape}, 测试数据: {X_test.shape}")
    
    # 训练模型
    print("\n2. 训练模型...")
    accuracy = classifier.train(X_train, y_train)
    
    # 评估模型
    print("\n3. 评估模型...")
    eval_results = classifier.evaluate(X_test, y_test)
    print(f"测试准确率: {eval_results['accuracy']:.4f}")
    print(f"精确率: {eval_results['precision']:.4f}")
    print(f"召回率: {eval_results['recall']:.4f}")
    print(f"F1分数: {eval_results['f1_score']:.4f}")
    
    # 保存模型
    print("\n4. 保存模型...")
    classifier.save_model()
    
    # 测试预测
    print("\n5. 测试预测...")
    test_sample = X_test[0]
    result = classifier.predict(test_sample)
    print(f"测试样本预测: {result['diagnosis']}")
    print(f"置信度: {result['confidence']:.3f}")
    print(f"实际标签: {'帕金森症状' if y_test[0] == 1 else '健康'}")
    
    print(f"\n✅ 语音帕金森分类器训练完成!")
    print(f"📊 模型性能: 准确率 {eval_results['accuracy']:.1%}")
    print(f"🎯 下一步: 转换为Arduino格式")

if __name__ == "__main__":
    main()
