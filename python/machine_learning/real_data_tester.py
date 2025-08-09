"""
真实语音数据测试器
下载GitHub项目的真实语音数据并测试我们的特征提取器和分类器
"""

import os
import requests
import numpy as np
from speech_feature_extractor import LightweightSpeechFeatureExtractor
from speech_parkinson_classifier import SpeechParkinsonClassifier
import json

class RealDataTester:
    """真实数据测试器"""
    
    def __init__(self):
        self.base_url = "https://raw.githubusercontent.com/vitomarcorubino/Parkinsons-detection/master/dataset/train"
        self.data_dir = "data/real_speech_samples"
        self.extractor = LightweightSpeechFeatureExtractor()
        self.classifier = SpeechParkinsonClassifier()
        
        # 确保数据目录存在
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(f"{self.data_dir}/parkinson", exist_ok=True)
        os.makedirs(f"{self.data_dir}/healthy", exist_ok=True)
    
    def download_sample_files(self, num_samples_per_class=5):
        """下载样本音频文件"""
        print(f"[INFO] 下载真实语音样本...")
        
        # 帕金森患者样本文件名
        parkinson_files = [
            "B1ABNINSAC46F240120171753.wav",
            "B1AGNUTGOL52F100220171041.wav", 
            "B1DLAARCII37F100220171111.wav",
            "B1GLIAUDLO50F100220171257.wav",
            "B1GMIAOSVI44M100220170942.wav"
        ]
        
        # 健康人样本文件名 (从elderlyHealthyControl获取)
        healthy_files = [
            # 这些需要从API获取实际文件名
        ]
        
        # 下载帕金森患者样本
        downloaded_parkinson = 0
        for filename in parkinson_files[:num_samples_per_class]:
            url = f"{self.base_url}/peopleWithParkinson/{filename}"
            local_path = f"{self.data_dir}/parkinson/{filename}"
            
            if self.download_file(url, local_path):
                downloaded_parkinson += 1
                print(f"  ✓ 下载帕金森样本: {filename}")
            else:
                print(f"  ✗ 下载失败: {filename}")
        
        print(f"[SUCCESS] 下载了 {downloaded_parkinson} 个帕金森样本")
        return downloaded_parkinson > 0
    
    def download_file(self, url, local_path):
        """下载单个文件"""
        try:
            if os.path.exists(local_path):
                print(f"  文件已存在: {os.path.basename(local_path)}")
                return True
                
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                f.write(response.content)
            
            return True
            
        except Exception as e:
            print(f"  下载错误: {e}")
            return False
    
    def test_feature_extraction(self):
        """测试特征提取"""
        print(f"\n[INFO] 测试真实数据特征提取...")
        
        parkinson_dir = f"{self.data_dir}/parkinson"
        audio_files = [f for f in os.listdir(parkinson_dir) if f.endswith('.wav')]
        
        if not audio_files:
            print("[WARNING] 没有找到音频文件")
            return None
        
        features_list = []
        labels_list = []
        
        for audio_file in audio_files:
            file_path = os.path.join(parkinson_dir, audio_file)
            print(f"  处理文件: {audio_file}")
            
            try:
                # 提取特征
                features = self.extractor.extract_features_from_file(file_path)
                
                if features is not None and not np.all(features == 0):
                    features_list.append(features)
                    labels_list.append(1)  # 帕金森患者
                    
                    print(f"    特征向量: {features}")
                    print(f"    特征名称: {self.extractor.get_feature_names()}")
                else:
                    print(f"    特征提取失败或全零")
                    
            except Exception as e:
                print(f"    处理错误: {e}")
        
        if features_list:
            features_array = np.array(features_list)
            print(f"\n[SUCCESS] 成功提取 {len(features_list)} 个样本的特征")
            print(f"特征矩阵形状: {features_array.shape}")
            
            # 显示特征统计
            print(f"\n特征统计:")
            for i, name in enumerate(self.extractor.get_feature_names()):
                mean_val = np.mean(features_array[:, i])
                std_val = np.std(features_array[:, i])
                print(f"  {name:15s}: 均值={mean_val:8.3f}, 标准差={std_val:8.3f}")
            
            return features_array, np.array(labels_list)
        else:
            print("[ERROR] 没有成功提取任何特征")
            return None
    
    def compare_with_synthetic_data(self, real_features):
        """比较真实数据和合成数据的特征分布"""
        print(f"\n[INFO] 比较真实数据与合成数据...")
        
        # 生成合成数据
        from speech_feature_extractor import create_synthetic_speech_data
        synthetic_X, synthetic_y = create_synthetic_speech_data(100)
        
        # 分离帕金森和健康样本
        synthetic_parkinson = synthetic_X[synthetic_y == 1]
        
        print(f"真实帕金森样本数: {len(real_features)}")
        print(f"合成帕金森样本数: {len(synthetic_parkinson)}")
        
        print(f"\n特征对比 (真实 vs 合成):")
        for i, name in enumerate(self.extractor.get_feature_names()):
            real_mean = np.mean(real_features[:, i])
            synthetic_mean = np.mean(synthetic_parkinson[:, i])
            
            print(f"  {name:15s}: 真实={real_mean:8.3f}, 合成={synthetic_mean:8.3f}, 差异={abs(real_mean-synthetic_mean):8.3f}")
    
    def test_classification(self, real_features, real_labels):
        """测试分类性能"""
        print(f"\n[INFO] 测试分类器性能...")
        
        # 加载或训练分类器
        model_path = "models/speech_parkinson_classifier.json"
        if os.path.exists(model_path):
            self.classifier.load_model(model_path)
            print("  使用已训练的模型")
        else:
            print("  模型不存在，使用合成数据训练...")
            from speech_feature_extractor import create_synthetic_speech_data
            X_train, y_train = create_synthetic_speech_data(1000)
            self.classifier.train(X_train, y_train)
            self.classifier.save_model(model_path)
        
        # 测试真实数据
        print(f"\n真实数据分类结果:")
        correct_predictions = 0
        
        for i, features in enumerate(real_features):
            result = self.classifier.predict(features)
            predicted_class = result['predicted_class']
            confidence = result['confidence']
            actual_class = real_labels[i]
            
            is_correct = predicted_class == actual_class
            if is_correct:
                correct_predictions += 1
            
            print(f"  样本 {i+1}: 预测={predicted_class} ({'帕金森' if predicted_class==1 else '健康'}), "
                  f"实际={actual_class}, 置信度={confidence:.3f}, "
                  f"{'✓' if is_correct else '✗'}")
        
        accuracy = correct_predictions / len(real_features)
        print(f"\n真实数据准确率: {accuracy:.3f} ({correct_predictions}/{len(real_features)})")
        
        return accuracy
    
    def save_real_data_analysis(self, features, labels):
        """保存真实数据分析结果"""
        analysis_data = {
            'num_samples': len(features),
            'feature_names': self.extractor.get_feature_names(),
            'feature_statistics': {},
            'sample_features': features.tolist(),
            'labels': labels.tolist()
        }
        
        # 计算特征统计
        for i, name in enumerate(self.extractor.get_feature_names()):
            analysis_data['feature_statistics'][name] = {
                'mean': float(np.mean(features[:, i])),
                'std': float(np.std(features[:, i])),
                'min': float(np.min(features[:, i])),
                'max': float(np.max(features[:, i]))
            }
        
        # 保存到文件
        output_path = "data/real_data_analysis.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(analysis_data, f, indent=2)
        
        print(f"[SUCCESS] 真实数据分析结果已保存: {output_path}")

def main():
    """主程序"""
    print("=== 真实语音数据测试器 ===")
    
    tester = RealDataTester()
    
    # 1. 下载样本数据
    print("\n步骤1: 下载真实语音样本")
    if not tester.download_sample_files(num_samples_per_class=3):
        print("[ERROR] 下载失败，退出测试")
        return
    
    # 2. 测试特征提取
    print("\n步骤2: 测试特征提取")
    result = tester.test_feature_extraction()
    if result is None:
        print("[ERROR] 特征提取失败，退出测试")
        return
    
    real_features, real_labels = result
    
    # 3. 比较合成数据
    print("\n步骤3: 比较合成数据")
    tester.compare_with_synthetic_data(real_features)
    
    # 4. 测试分类
    print("\n步骤4: 测试分类性能")
    accuracy = tester.test_classification(real_features, real_labels)
    
    # 5. 保存分析结果
    print("\n步骤5: 保存分析结果")
    tester.save_real_data_analysis(real_features, real_labels)
    
    print(f"\n✅ 真实数据测试完成!")
    print(f"📊 处理样本数: {len(real_features)}")
    print(f"🎯 分类准确率: {accuracy:.1%}")
    print(f"💡 下一步: 根据真实数据优化特征提取和模型")

if __name__ == "__main__":
    main()
