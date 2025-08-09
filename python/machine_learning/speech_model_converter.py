"""
语音模型转换器
将训练好的语音帕金森分类器转换为Arduino可用的C++代码
"""

import numpy as np
import json
import os
from datetime import datetime
from speech_parkinson_classifier import SpeechParkinsonClassifier

def convert_speech_model_to_arduino(model_path="models/speech_parkinson_classifier.json", 
                                  output_path="arduino/libraries/speech_model.h"):
    """
    将语音分类模型转换为Arduino C++头文件
    """
    print("[INFO] 转换语音分类模型为Arduino格式...")
    
    # 加载模型
    try:
        with open(model_path, 'r') as f:
            model_data = json.load(f)
    except FileNotFoundError:
        print(f"[WARNING] 模型文件不存在，创建演示模型...")
        # 创建演示模型
        classifier = SpeechParkinsonClassifier()
        from speech_feature_extractor import create_synthetic_speech_data
        X_train, y_train = create_synthetic_speech_data(500)
        classifier.train(X_train, y_train, epochs=100)
        classifier.save_model(model_path)
        
        with open(model_path, 'r') as f:
            model_data = json.load(f)
    
    # 提取模型参数
    weights = np.array(model_data['weights'], dtype=np.float32)
    bias = float(model_data['bias'])
    scaler_mean = np.array(model_data['scaler_mean'], dtype=np.float32)
    scaler_std = np.array(model_data['scaler_std'], dtype=np.float32)
    feature_names = model_data['feature_names']
    
    # 生成Arduino头文件
    header_content = f"""// 自动生成的语音帕金森分类模型
// 生成时间: {datetime.now()}
// 模型类型: 轻量级线性分类器
// 输入: 8维语音特征
// 输出: 帕金森概率 (0-1)

#ifndef SPEECH_MODEL_H
#define SPEECH_MODEL_H

#include <Arduino.h>

// 模型参数
const int SPEECH_FEATURE_DIM = {len(weights)};
const char* SPEECH_FEATURE_NAMES[SPEECH_FEATURE_DIM] = {{
{', '.join([f'    "{name}"' for name in feature_names])}
}};

// 模型权重
const float SPEECH_WEIGHTS[SPEECH_FEATURE_DIM] = {{
{', '.join([f'    {w:.6f}f' for w in weights])}
}};

// 模型偏置
const float SPEECH_BIAS = {bias:.6f}f;

// 特征标准化参数
const float SPEECH_SCALER_MEAN[SPEECH_FEATURE_DIM] = {{
{', '.join([f'    {m:.6f}f' for m in scaler_mean])}
}};

const float SPEECH_SCALER_STD[SPEECH_FEATURE_DIM] = {{
{', '.join([f'    {s:.6f}f' for s in scaler_std])}
}};

// 语音特征结构体
struct SpeechFeatures {{
    float f0_mean;      // 基频均值
    float f0_std;       // 基频标准差
    float jitter;       // 抖动
    float shimmer;      // 微颤
    float hnr;          // 谐噪比
    float mfcc1;        // MFCC特征1
    float mfcc2;        // MFCC特征2
    float mfcc3;        // MFCC特征3
}};

// 语音分析结果
struct SpeechAnalysisResult {{
    float probability;      // 帕金森概率 (0-1)
    int predicted_class;    // 预测类别 (0: 健康, 1: 帕金森)
    float confidence;       // 置信度
    bool is_valid;          // 结果是否有效
}};

// 函数声明
float sigmoid(float x);
void normalizeSpeechFeatures(float* features);
SpeechAnalysisResult analyzeSpeechFeatures(const SpeechFeatures& features);
SpeechAnalysisResult analyzeSpeechArray(const float* feature_array);

// 内联函数实现
inline float sigmoid(float x) {{
    if (x > 10.0f) return 1.0f;
    if (x < -10.0f) return 0.0f;
    return 1.0f / (1.0f + exp(-x));
}}

inline void normalizeSpeechFeatures(float* features) {{
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {{
        features[i] = (features[i] - SPEECH_SCALER_MEAN[i]) / SPEECH_SCALER_STD[i];
    }}
}}

inline SpeechAnalysisResult analyzeSpeechFeatures(const SpeechFeatures& features) {{
    // 转换为数组
    float feature_array[SPEECH_FEATURE_DIM] = {{
        features.f0_mean, features.f0_std, features.jitter, features.shimmer,
        features.hnr, features.mfcc1, features.mfcc2, features.mfcc3
    }};
    
    return analyzeSpeechArray(feature_array);
}}

inline SpeechAnalysisResult analyzeSpeechArray(const float* feature_array) {{
    SpeechAnalysisResult result;
    
    // 复制特征并标准化
    float normalized_features[SPEECH_FEATURE_DIM];
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {{
        normalized_features[i] = feature_array[i];
    }}
    normalizeSpeechFeatures(normalized_features);
    
    // 计算线性组合
    float z = SPEECH_BIAS;
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {{
        z += SPEECH_WEIGHTS[i] * normalized_features[i];
    }}
    
    // 应用sigmoid激活
    result.probability = sigmoid(z);
    result.predicted_class = (result.probability > 0.5f) ? 1 : 0;
    result.confidence = (result.predicted_class == 1) ? 
                       result.probability : (1.0f - result.probability);
    result.is_valid = true;
    
    return result;
}}

// 辅助函数：打印分析结果
inline void printSpeechAnalysisResult(const SpeechAnalysisResult& result) {{
    if (!result.is_valid) {{
        Serial.println("SPEECH: 分析结果无效");
        return;
    }}
    
    Serial.print("SPEECH_ANALYSIS: ");
    Serial.print("概率=");
    Serial.print(result.probability, 3);
    Serial.print(", 预测=");
    Serial.print(result.predicted_class == 1 ? "帕金森" : "健康");
    Serial.print(", 置信度=");
    Serial.print(result.confidence, 3);
    Serial.println();
}}

// 特征提取辅助函数声明
float extractF0Mean(const float* audio_buffer, int buffer_size, int sample_rate);
float extractF0Std(const float* audio_buffer, int buffer_size, int sample_rate);
float extractJitter(const float* audio_buffer, int buffer_size, int sample_rate);
float extractShimmer(const float* audio_buffer, int buffer_size, int sample_rate);
float extractHNR(const float* audio_buffer, int buffer_size, int sample_rate);
void extractMFCC(const float* audio_buffer, int buffer_size, int sample_rate, float* mfcc_out);

#endif // SPEECH_MODEL_H"""
    
    # 确保目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(header_content)
    
    print(f"[SUCCESS] Arduino语音模型已生成: {output_path}")
    print(f"[INFO] 模型参数:")
    print(f"  - 特征维度: {len(weights)}")
    print(f"  - 权重范围: [{np.min(weights):.3f}, {np.max(weights):.3f}]")
    print(f"  - 偏置值: {bias:.3f}")
    
    return True

def create_arduino_speech_feature_extractor(output_path="arduino/libraries/speech_features.h"):
    """
    创建Arduino语音特征提取器
    """
    print("[INFO] 创建Arduino语音特征提取器...")
    
    header_content = """// Arduino语音特征提取器
// 轻量级实现，适用于Arduino Nano 33 BLE Sense Rev2

#ifndef SPEECH_FEATURES_H
#define SPEECH_FEATURES_H

#include <Arduino.h>
#include <math.h>

// 配置参数
const int AUDIO_SAMPLE_RATE = 16000;
const int AUDIO_BUFFER_SIZE = 1024;
const int FRAME_SIZE = 256;
const int HOP_SIZE = 128;

// 简化的语音特征提取器
class ArduinoSpeechFeatureExtractor {
private:
    float audio_buffer[AUDIO_BUFFER_SIZE];
    int buffer_index;
    
    // 辅助函数
    float calculateMean(const float* data, int size);
    float calculateStd(const float* data, int size, float mean);
    void applyWindow(float* data, int size);
    float autocorrelation(const float* data, int size, int lag);
    
public:
    ArduinoSpeechFeatureExtractor();
    
    // 添加音频样本
    void addAudioSample(float sample);
    
    // 检查缓冲区是否已满
    bool isBufferReady();
    
    // 提取特征
    float extractF0Mean();
    float extractF0Std();
    float extractJitter();
    float extractShimmer();
    float extractHNR();
    void extractMFCC(float* mfcc_out);
    
    // 提取完整特征向量
    void extractAllFeatures(float* features_out);
    
    // 重置缓冲区
    void resetBuffer();
};

// 实现
inline ArduinoSpeechFeatureExtractor::ArduinoSpeechFeatureExtractor() {
    buffer_index = 0;
    resetBuffer();
}

inline void ArduinoSpeechFeatureExtractor::addAudioSample(float sample) {
    if (buffer_index < AUDIO_BUFFER_SIZE) {
        audio_buffer[buffer_index++] = sample;
    }
}

inline bool ArduinoSpeechFeatureExtractor::isBufferReady() {
    return buffer_index >= AUDIO_BUFFER_SIZE;
}

inline void ArduinoSpeechFeatureExtractor::resetBuffer() {
    buffer_index = 0;
    for (int i = 0; i < AUDIO_BUFFER_SIZE; i++) {
        audio_buffer[i] = 0.0f;
    }
}

inline float ArduinoSpeechFeatureExtractor::calculateMean(const float* data, int size) {
    float sum = 0.0f;
    for (int i = 0; i < size; i++) {
        sum += data[i];
    }
    return sum / size;
}

inline float ArduinoSpeechFeatureExtractor::calculateStd(const float* data, int size, float mean) {
    float sum_sq = 0.0f;
    for (int i = 0; i < size; i++) {
        float diff = data[i] - mean;
        sum_sq += diff * diff;
    }
    return sqrt(sum_sq / size);
}

inline float ArduinoSpeechFeatureExtractor::extractF0Mean() {
    // 简化的基频提取 (使用自相关)
    float max_corr = 0.0f;
    int best_period = 0;
    
    int min_period = AUDIO_SAMPLE_RATE / 500;  // 500Hz
    int max_period = AUDIO_SAMPLE_RATE / 75;   // 75Hz
    
    for (int period = min_period; period < max_period && period < AUDIO_BUFFER_SIZE/2; period++) {
        float corr = autocorrelation(audio_buffer, AUDIO_BUFFER_SIZE, period);
        if (corr > max_corr) {
            max_corr = corr;
            best_period = period;
        }
    }
    
    if (best_period > 0) {
        return (float)AUDIO_SAMPLE_RATE / best_period;
    }
    return 150.0f;  // 默认值
}

inline float ArduinoSpeechFeatureExtractor::extractF0Std() {
    // 简化实现：基于能量变化估算
    float energy_values[16];
    int frame_size = AUDIO_BUFFER_SIZE / 16;
    
    for (int i = 0; i < 16; i++) {
        float energy = 0.0f;
        for (int j = 0; j < frame_size; j++) {
            int idx = i * frame_size + j;
            if (idx < AUDIO_BUFFER_SIZE) {
                energy += audio_buffer[idx] * audio_buffer[idx];
            }
        }
        energy_values[i] = sqrt(energy / frame_size);
    }
    
    float mean = calculateMean(energy_values, 16);
    return calculateStd(energy_values, 16, mean) * 100.0f;  // 缩放到合理范围
}

inline float ArduinoSpeechFeatureExtractor::extractJitter() {
    // 简化的抖动计算
    float f0 = extractF0Mean();
    if (f0 < 50.0f || f0 > 500.0f) return 0.01f;
    
    int period = (int)(AUDIO_SAMPLE_RATE / f0);
    float jitter_sum = 0.0f;
    int count = 0;
    
    for (int i = period; i < AUDIO_BUFFER_SIZE - period; i += period) {
        float curr_energy = 0.0f;
        float next_energy = 0.0f;
        
        for (int j = 0; j < period && i + j < AUDIO_BUFFER_SIZE; j++) {
            curr_energy += audio_buffer[i + j] * audio_buffer[i + j];
            if (i + period + j < AUDIO_BUFFER_SIZE) {
                next_energy += audio_buffer[i + period + j] * audio_buffer[i + period + j];
            }
        }
        
        if (curr_energy > 0.0f && next_energy > 0.0f) {
            jitter_sum += abs(curr_energy - next_energy) / curr_energy;
            count++;
        }
    }
    
    return count > 0 ? jitter_sum / count : 0.01f;
}

inline float ArduinoSpeechFeatureExtractor::extractShimmer() {
    // 简化的微颤计算
    float shimmer_sum = 0.0f;
    int count = 0;
    
    for (int i = 1; i < AUDIO_BUFFER_SIZE; i++) {
        float curr_amp = abs(audio_buffer[i]);
        float prev_amp = abs(audio_buffer[i-1]);
        
        if (prev_amp > 0.001f) {  // 避免除零
            shimmer_sum += abs(curr_amp - prev_amp) / prev_amp;
            count++;
        }
    }
    
    return count > 0 ? shimmer_sum / count : 0.05f;
}

inline float ArduinoSpeechFeatureExtractor::extractHNR() {
    // 简化的谐噪比计算
    float signal_power = 0.0f;
    float noise_power = 0.0f;
    
    // 计算信号功率
    for (int i = 0; i < AUDIO_BUFFER_SIZE; i++) {
        signal_power += audio_buffer[i] * audio_buffer[i];
    }
    signal_power /= AUDIO_BUFFER_SIZE;
    
    // 估算噪声功率 (高频成分)
    for (int i = 1; i < AUDIO_BUFFER_SIZE; i++) {
        float diff = audio_buffer[i] - audio_buffer[i-1];
        noise_power += diff * diff;
    }
    noise_power /= (AUDIO_BUFFER_SIZE - 1);
    
    if (noise_power > 0.0f) {
        return 10.0f * log10(signal_power / noise_power);
    }
    return 15.0f;  // 默认值
}

inline void ArduinoSpeechFeatureExtractor::extractMFCC(float* mfcc_out) {
    // 极简MFCC实现 (仅提取前3维)
    // 使用简化的频域分析
    
    float freq_bins[8] = {0};
    int bin_size = AUDIO_BUFFER_SIZE / 8;
    
    // 计算频段能量
    for (int bin = 0; bin < 8; bin++) {
        float energy = 0.0f;
        for (int i = 0; i < bin_size; i++) {
            int idx = bin * bin_size + i;
            if (idx < AUDIO_BUFFER_SIZE) {
                energy += audio_buffer[idx] * audio_buffer[idx];
            }
        }
        freq_bins[bin] = log(energy + 1e-6f);  // 对数能量
    }
    
    // 简化的DCT变换 (仅计算前3个系数)
    for (int k = 0; k < 3; k++) {
        float sum = 0.0f;
        for (int n = 0; n < 8; n++) {
            sum += freq_bins[n] * cos(M_PI * k * (n + 0.5f) / 8.0f);
        }
        mfcc_out[k] = sum;
    }
}

inline void ArduinoSpeechFeatureExtractor::extractAllFeatures(float* features_out) {
    features_out[0] = extractF0Mean();
    features_out[1] = extractF0Std();
    features_out[2] = extractJitter();
    features_out[3] = extractShimmer();
    features_out[4] = extractHNR();
    
    float mfcc[3];
    extractMFCC(mfcc);
    features_out[5] = mfcc[0];
    features_out[6] = mfcc[1];
    features_out[7] = mfcc[2];
}

inline float ArduinoSpeechFeatureExtractor::autocorrelation(const float* data, int size, int lag) {
    float sum = 0.0f;
    int count = 0;
    
    for (int i = 0; i < size - lag; i++) {
        sum += data[i] * data[i + lag];
        count++;
    }
    
    return count > 0 ? sum / count : 0.0f;
}

#endif // SPEECH_FEATURES_H"""
    
    # 确保目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(header_content)
    
    print(f"[SUCCESS] Arduino语音特征提取器已生成: {output_path}")
    return True

def main():
    """主程序"""
    print("=== 语音模型Arduino转换器 ===")
    
    # 转换分类模型
    print("\n1. 转换语音分类模型...")
    convert_speech_model_to_arduino()
    
    # 创建特征提取器
    print("\n2. 创建语音特征提取器...")
    create_arduino_speech_feature_extractor()
    
    print(f"\n✅ Arduino语音模块转换完成!")
    print(f"📁 生成文件:")
    print(f"  - arduino/libraries/speech_model.h")
    print(f"  - arduino/libraries/speech_features.h")
    print(f"\n🔧 下一步: 更新Arduino主程序以集成语音功能")

if __name__ == "__main__":
    main()
