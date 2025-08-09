"""
轻量级语音特征提取器
基于vitomarcorubino/Parkinsons-detection项目，优化用于Arduino Nano 33 BLE Sense Rev2

主要特征：
1. 基频统计 (F0 mean, std)
2. 抖动特征 (Jitter)
3. 微颤特征 (Shimmer) 
4. 谐噪比 (HNR)
5. 简化MFCC (前4维)
总计：8维轻量级特征向量
"""

import numpy as np
import librosa
import scipy.signal
from scipy.stats import skew, kurtosis
import warnings
warnings.filterwarnings('ignore')

class LightweightSpeechFeatureExtractor:
    """
    轻量级语音特征提取器
    专为Arduino部署优化，提取核心帕金森语音特征
    """
    
    def __init__(self, sample_rate=16000, frame_length=1024, hop_length=512):
        self.sample_rate = sample_rate
        self.frame_length = frame_length
        self.hop_length = hop_length
        self.feature_names = [
            'f0_mean', 'f0_std', 'jitter_local', 'shimmer_local',
            'hnr', 'mfcc_1', 'mfcc_2', 'mfcc_3'
        ]
        
    def extract_f0_features(self, audio):
        """提取基频相关特征"""
        try:
            # 使用librosa提取基频
            f0 = librosa.yin(audio, 
                           fmin=75,    # 最小基频 (Hz)
                           fmax=500,   # 最大基频 (Hz)
                           sr=self.sample_rate,
                           frame_length=self.frame_length,
                           hop_length=self.hop_length)
            
            # 移除无效值
            f0_valid = f0[f0 > 0]
            
            if len(f0_valid) == 0:
                return 0.0, 0.0
                
            f0_mean = np.mean(f0_valid)
            f0_std = np.std(f0_valid)
            
            return f0_mean, f0_std
            
        except Exception as e:
            print(f"F0提取错误: {e}")
            return 0.0, 0.0
    
    def extract_jitter(self, audio):
        """提取抖动特征 (简化版本)"""
        try:
            # 提取基频序列
            f0 = librosa.yin(audio, 
                           fmin=75, fmax=500, 
                           sr=self.sample_rate,
                           frame_length=self.frame_length,
                           hop_length=self.hop_length)
            
            # 移除无效值
            f0_valid = f0[f0 > 0]
            
            if len(f0_valid) < 3:
                return 0.0
                
            # 计算周期间变化率 (简化的抖动)
            periods = 1.0 / f0_valid
            period_diffs = np.abs(np.diff(periods))
            jitter_local = np.mean(period_diffs) / np.mean(periods)
            
            return jitter_local
            
        except Exception as e:
            print(f"Jitter提取错误: {e}")
            return 0.0
    
    def extract_shimmer(self, audio):
        """提取微颤特征 (简化版本)"""
        try:
            # 计算短时能量
            frame_length = int(0.025 * self.sample_rate)  # 25ms窗口
            hop_length = int(0.010 * self.sample_rate)    # 10ms跳跃
            
            # 分帧
            frames = librosa.util.frame(audio, 
                                      frame_length=frame_length,
                                      hop_length=hop_length,
                                      axis=0)
            
            # 计算每帧能量
            energy = np.sum(frames**2, axis=1)
            energy = energy[energy > 0]  # 移除静音帧
            
            if len(energy) < 3:
                return 0.0
                
            # 计算能量变化率 (简化的微颤)
            energy_diffs = np.abs(np.diff(energy))
            shimmer_local = np.mean(energy_diffs) / np.mean(energy)
            
            return shimmer_local
            
        except Exception as e:
            print(f"Shimmer提取错误: {e}")
            return 0.0
    
    def extract_hnr(self, audio):
        """提取谐噪比"""
        try:
            # 计算自相关
            autocorr = np.correlate(audio, audio, mode='full')
            autocorr = autocorr[len(autocorr)//2:]
            
            # 找到基频对应的延迟
            min_period = int(self.sample_rate / 500)  # 500Hz对应的最小周期
            max_period = int(self.sample_rate / 75)   # 75Hz对应的最大周期
            
            if max_period >= len(autocorr):
                return 0.0
                
            # 在有效范围内找峰值
            peak_idx = np.argmax(autocorr[min_period:max_period]) + min_period
            
            # 计算谐噪比 (简化版本)
            signal_power = autocorr[peak_idx]
            noise_power = np.mean(autocorr) - signal_power
            
            if noise_power <= 0:
                return 20.0  # 最大HNR值
                
            hnr = 10 * np.log10(signal_power / noise_power)
            return max(0.0, min(20.0, hnr))  # 限制在合理范围
            
        except Exception as e:
            print(f"HNR提取错误: {e}")
            return 0.0
    
    def extract_mfcc_lite(self, audio):
        """提取简化MFCC特征 (前3维)"""
        try:
            # 计算MFCC
            mfcc = librosa.feature.mfcc(y=audio, 
                                      sr=self.sample_rate,
                                      n_mfcc=4,  # 只取前4维
                                      n_fft=self.frame_length,
                                      hop_length=self.hop_length)
            
            # 取均值 (跳过第0维，通常是能量)
            mfcc_mean = np.mean(mfcc[1:4], axis=1)  # 取第1-3维
            
            return mfcc_mean
            
        except Exception as e:
            print(f"MFCC提取错误: {e}")
            return np.zeros(3)
    
    def extract_features(self, audio_data):
        """
        提取完整的8维特征向量
        
        Args:
            audio_data: 音频数据 (numpy array)
            
        Returns:
            features: 8维特征向量 [f0_mean, f0_std, jitter, shimmer, hnr, mfcc1, mfcc2, mfcc3]
        """
        try:
            # 预处理：归一化
            if len(audio_data) == 0:
                return np.zeros(8)
                
            audio_data = audio_data.astype(np.float32)
            if np.max(np.abs(audio_data)) > 0:
                audio_data = audio_data / np.max(np.abs(audio_data))
            
            # 提取各类特征
            f0_mean, f0_std = self.extract_f0_features(audio_data)
            jitter = self.extract_jitter(audio_data)
            shimmer = self.extract_shimmer(audio_data)
            hnr = self.extract_hnr(audio_data)
            mfcc_features = self.extract_mfcc_lite(audio_data)
            
            # 组合特征向量
            features = np.array([
                f0_mean, f0_std, jitter, shimmer, hnr,
                mfcc_features[0], mfcc_features[1], mfcc_features[2]
            ], dtype=np.float32)
            
            # 处理NaN和无穷值
            features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
            
            return features
            
        except Exception as e:
            print(f"特征提取失败: {e}")
            return np.zeros(8)
    
    def extract_features_from_file(self, audio_file_path):
        """从音频文件提取特征"""
        try:
            # 加载音频文件
            audio_data, sr = librosa.load(audio_file_path, sr=self.sample_rate)
            
            # 提取特征
            features = self.extract_features(audio_data)
            
            return features
            
        except Exception as e:
            print(f"文件处理失败: {e}")
            return np.zeros(8)
    
    def get_feature_names(self):
        """获取特征名称"""
        return self.feature_names.copy()
    
    def normalize_features(self, features, feature_stats=None):
        """
        特征标准化
        
        Args:
            features: 特征向量或特征矩阵
            feature_stats: 预计算的统计信息 {'mean': [...], 'std': [...]}
        """
        if feature_stats is None:
            # 使用默认统计信息 (基于训练数据估算)
            feature_stats = {
                'mean': np.array([150.0, 30.0, 0.01, 0.05, 10.0, 0.0, 0.0, 0.0]),
                'std': np.array([50.0, 15.0, 0.005, 0.02, 5.0, 1.0, 1.0, 1.0])
            }
        
        features = np.array(features)
        mean = np.array(feature_stats['mean'])
        std = np.array(feature_stats['std'])
        
        # 避免除零
        std = np.where(std == 0, 1.0, std)
        
        normalized = (features - mean) / std
        return normalized

def create_synthetic_speech_data(num_samples=1000, feature_extractor=None):
    """
    创建合成语音特征数据用于测试
    模拟帕金森患者和健康人的语音特征差异
    """
    if feature_extractor is None:
        feature_extractor = LightweightSpeechFeatureExtractor()

    X = []
    y = []

    print(f"生成 {num_samples} 个合成语音特征样本...")

    for i in range(num_samples):
        # 随机选择类别 (0: 健康, 1: 帕金森)
        label = np.random.randint(0, 2)

        if label == 0:  # 健康人特征
            f0_mean = np.random.normal(180, 25)      # 基频均值
            f0_std = np.random.normal(20, 5)         # 基频标准差
            jitter = np.random.normal(0.005, 0.002)  # 抖动
            shimmer = np.random.normal(0.03, 0.01)   # 微颤
            hnr = np.random.normal(15, 3)            # 谐噪比
            mfcc1 = np.random.normal(0, 0.8)         # MFCC特征
            mfcc2 = np.random.normal(0, 0.6)
            mfcc3 = np.random.normal(0, 0.4)
        else:  # 帕金森患者特征
            f0_mean = np.random.normal(160, 35)      # 基频降低，变异增大
            f0_std = np.random.normal(35, 10)        # 基频不稳定
            jitter = np.random.normal(0.015, 0.008)  # 抖动增加
            shimmer = np.random.normal(0.08, 0.03)   # 微颤增加
            hnr = np.random.normal(8, 4)             # 谐噪比降低
            mfcc1 = np.random.normal(0.2, 1.0)       # MFCC特征变化
            mfcc2 = np.random.normal(-0.1, 0.8)
            mfcc3 = np.random.normal(0.1, 0.6)

        # 确保特征在合理范围内
        features = np.array([
            max(50, min(400, f0_mean)),
            max(5, min(100, f0_std)),
            max(0, min(0.1, jitter)),
            max(0, min(0.3, shimmer)),
            max(0, min(25, hnr)),
            max(-3, min(3, mfcc1)),
            max(-3, min(3, mfcc2)),
            max(-3, min(3, mfcc3))
        ])

        X.append(features)
        y.append(label)

    return np.array(X), np.array(y)

def main():
    """测试语音特征提取器"""
    print("=== 轻量级语音特征提取器测试 ===")

    # 创建提取器
    extractor = LightweightSpeechFeatureExtractor()

    # 生成测试数据
    print("\n1. 生成合成测试数据...")
    X, y = create_synthetic_speech_data(100, extractor)

    print(f"生成数据形状: {X.shape}")
    print(f"特征名称: {extractor.get_feature_names()}")

    # 显示特征统计
    print(f"\n2. 特征统计:")
    for i, name in enumerate(extractor.get_feature_names()):
        healthy_mean = np.mean(X[y==0, i])
        parkinson_mean = np.mean(X[y==1, i])
        print(f"{name:15s}: 健康={healthy_mean:6.3f}, 帕金森={parkinson_mean:6.3f}")

    # 测试特征标准化
    print(f"\n3. 测试特征标准化...")
    X_normalized = extractor.normalize_features(X)
    print(f"标准化后均值: {np.mean(X_normalized, axis=0)}")
    print(f"标准化后标准差: {np.std(X_normalized, axis=0)}")

    print(f"\n✅ 轻量级语音特征提取器测试完成!")
    print(f"📊 特征维度: {len(extractor.get_feature_names())}维")
    print(f"🎯 适合Arduino部署的轻量级实现")

if __name__ == "__main__":
    main()
