// 自动生成的语音帕金森分类模型
// 生成时间: 2025-08-09 23:57:24.809638
// 模型类型: 轻量级线性分类器
// 输入: 8维语音特征
// 输出: 帕金森概率 (0-1)

#ifndef SPEECH_MODEL_H
#define SPEECH_MODEL_H

#include <Arduino.h>

// 模型参数
const int SPEECH_FEATURE_DIM = 8;
const char* SPEECH_FEATURE_NAMES[SPEECH_FEATURE_DIM] = {
    "f0_mean",     "f0_std",     "jitter_local",     "shimmer_local",     "hnr",     "mfcc_1",     "mfcc_2",     "mfcc_3"
};

// 模型权重
const float SPEECH_WEIGHTS[SPEECH_FEATURE_DIM] = {
    0.241657f,     0.192907f,     0.433479f,     0.236201f,     -0.106987f,     0.389098f,     0.231503f,     0.319372f
};

// 模型偏置
const float SPEECH_BIAS = 0.007460f;

// 特征标准化参数
const float SPEECH_SCALER_MEAN[SPEECH_FEATURE_DIM] = {
    167.149536f,     50.995689f,     0.112678f,     0.145572f,     16.374725f,     49.916370f,     12.472878f,     7.284639f
};

const float SPEECH_SCALER_STD[SPEECH_FEATURE_DIM] = {
    31.394131f,     29.428452f,     0.118310f,     0.127497f,     3.880464f,     36.009792f,     11.939612f,     8.477983f
};

// 语音特征结构体
struct SpeechFeatures {
    float f0_mean;      // 基频均值
    float f0_std;       // 基频标准差
    float jitter;       // 抖动
    float shimmer;      // 微颤
    float hnr;          // 谐噪比
    float mfcc1;        // MFCC特征1
    float mfcc2;        // MFCC特征2
    float mfcc3;        // MFCC特征3
};

// 语音分析结果
struct SpeechAnalysisResult {
    float probability;      // 帕金森概率 (0-1)
    int predicted_class;    // 预测类别 (0: 健康, 1: 帕金森)
    float confidence;       // 置信度
    bool is_valid;          // 结果是否有效
};

// 函数声明
float sigmoid(float x);
void normalizeSpeechFeatures(float* features);
SpeechAnalysisResult analyzeSpeechFeatures(const SpeechFeatures& features);
SpeechAnalysisResult analyzeSpeechArray(const float* feature_array);

// 内联函数实现
inline float sigmoid(float x) {
    if (x > 10.0f) return 1.0f;
    if (x < -10.0f) return 0.0f;
    return 1.0f / (1.0f + exp(-x));
}

inline void normalizeSpeechFeatures(float* features) {
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {
        features[i] = (features[i] - SPEECH_SCALER_MEAN[i]) / SPEECH_SCALER_STD[i];
    }
}

inline SpeechAnalysisResult analyzeSpeechFeatures(const SpeechFeatures& features) {
    // 转换为数组
    float feature_array[SPEECH_FEATURE_DIM] = {
        features.f0_mean, features.f0_std, features.jitter, features.shimmer,
        features.hnr, features.mfcc1, features.mfcc2, features.mfcc3
    };
    
    return analyzeSpeechArray(feature_array);
}

inline SpeechAnalysisResult analyzeSpeechArray(const float* feature_array) {
    SpeechAnalysisResult result;
    
    // 复制特征并标准化
    float normalized_features[SPEECH_FEATURE_DIM];
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {
        normalized_features[i] = feature_array[i];
    }
    normalizeSpeechFeatures(normalized_features);
    
    // 计算线性组合
    float z = SPEECH_BIAS;
    for (int i = 0; i < SPEECH_FEATURE_DIM; i++) {
        z += SPEECH_WEIGHTS[i] * normalized_features[i];
    }
    
    // 应用sigmoid激活
    result.probability = sigmoid(z);
    result.predicted_class = (result.probability > 0.5f) ? 1 : 0;
    result.confidence = (result.predicted_class == 1) ? 
                       result.probability : (1.0f - result.probability);
    result.is_valid = true;
    
    return result;
}

// 辅助函数：打印分析结果
inline void printSpeechAnalysisResult(const SpeechAnalysisResult& result) {
    if (!result.is_valid) {
        Serial.println("SPEECH: 分析结果无效");
        return;
    }
    
    Serial.print("SPEECH_ANALYSIS: ");
    Serial.print("概率=");
    Serial.print(result.probability, 3);
    Serial.print(", 预测=");
    Serial.print(result.predicted_class == 1 ? "帕金森" : "健康");
    Serial.print(", 置信度=");
    Serial.print(result.confidence, 3);
    Serial.println();
}

// 特征提取辅助函数声明
float extractF0Mean(const float* audio_buffer, int buffer_size, int sample_rate);
float extractF0Std(const float* audio_buffer, int buffer_size, int sample_rate);
float extractJitter(const float* audio_buffer, int buffer_size, int sample_rate);
float extractShimmer(const float* audio_buffer, int buffer_size, int sample_rate);
float extractHNR(const float* audio_buffer, int buffer_size, int sample_rate);
void extractMFCC(const float* audio_buffer, int buffer_size, int sample_rate, float* mfcc_out);

#endif // SPEECH_MODEL_H