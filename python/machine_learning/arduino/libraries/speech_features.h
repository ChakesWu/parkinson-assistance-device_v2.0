// Arduino语音特征提取器
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

#endif // SPEECH_FEATURES_H