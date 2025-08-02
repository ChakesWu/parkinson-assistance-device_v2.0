/*
 * TensorFlow Lite推理引擎 for Arduino Nano 33 BLE Sense Rev2
 * 用於帕金森症狀分析的嵌入式推理
 */

#ifndef TENSORFLOW_LITE_INFERENCE_H
#define TENSORFLOW_LITE_INFERENCE_H

#include <Arduino.h>
#include <TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/micro/micro_log.h"
#include "model_data.h"

class TensorFlowLiteInference {
private:
    // TensorFlow Lite相關對象
    const tflite::Model* model;
    tflite::MicroInterpreter* interpreter;
    tflite::AllOpsResolver* resolver;
    
    // 輸入輸出張量
    TfLiteTensor* input;
    TfLiteTensor* output;
    
    // 內存分配
    static constexpr int kTensorArenaSize = 60 * 1024;  // 60KB
    uint8_t tensor_arena[kTensorArenaSize];
    
    // 模型參數
    static constexpr int kSequenceLength = 50;
    static constexpr int kFeatureDim = 9;
    static constexpr int kNumClasses = 5;
    
    // 數據緩衝區
    float input_buffer[kSequenceLength * kFeatureDim];
    int buffer_index;
    bool buffer_full;
    
    // 預測結果
    float predictions[kNumClasses];
    int predicted_class;
    float confidence;
    
public:
    TensorFlowLiteInference();
    ~TensorFlowLiteInference();
    
    // 初始化函數
    bool begin();
    
    // 數據輸入
    void addDataPoint(float* sensor_data);  // 添加一個數據點 (9維)
    bool isBufferReady();  // 檢查緩衝區是否準備好推理
    
    // 推理
    bool runInference();
    
    // 結果獲取
    int getPredictedClass();
    float getConfidence();
    float* getAllPredictions();
    String getParkinsonLevelDescription();
    
    // 實用函數
    void clearBuffer();
    void printModelInfo();
    void printBufferStatus();
    String getRecommendation();
    
    // 新增：獲取緩衝區狀態
    int getBufferFillLevel();
    int getSequenceLength();
};

// 構造函數
TensorFlowLiteInference::TensorFlowLiteInference() {
    model = nullptr;
    interpreter = nullptr;
    resolver = nullptr;
    input = nullptr;
    output = nullptr;
    buffer_index = 0;
    buffer_full = false;
    predicted_class = -1;
    confidence = 0.0;
}

// 析構函數
TensorFlowLiteInference::~TensorFlowLiteInference() {
    // 注意: AllOpsResolver和MicroInterpreter在TensorFlow Lite Micro中
    // 使用靜態分配，不需要手動delete
    // 讓系統自動清理這些對象
    resolver = nullptr;
    interpreter = nullptr;
}

// 初始化
bool TensorFlowLiteInference::begin() {
    // 檢查模型狀態
    if (model_data_len < 1000) {
        Serial.println("⚠️  使用演示模型進行測試");
        Serial.println("AI功能將返回模擬結果");
        Serial.println("要獲得真實AI功能，請訓練完整模型");
        
        // 使用演示模式 - 跳過真實AI初始化
        Serial.println("✅ 演示模式初始化成功");
        return true;  // 允許演示模式繼續運行
    } else {
        Serial.println("✅ 使用完整AI模型");
    }
    
    // 加載模型
    model = tflite::GetModel(model_data);
    if (model->version() != TFLITE_SCHEMA_VERSION) {
        Serial.print("Model schema version ");
        Serial.print(model->version());
        Serial.print(" != supported version ");
        Serial.println(TFLITE_SCHEMA_VERSION);
        return false;
    }
    
    // 創建操作解析器（使用靜態分配）
    static tflite::AllOpsResolver static_resolver;
    resolver = &static_resolver;
    
    // 創建解釋器（使用靜態分配）
    static tflite::MicroInterpreter static_interpreter(
        model, *resolver, tensor_arena, kTensorArenaSize);
    interpreter = &static_interpreter;
    
    // 分配張量
    TfLiteStatus allocate_status = interpreter->AllocateTensors();
    if (allocate_status != kTfLiteOk) {
        Serial.println("AllocateTensors() failed");
        return false;
    }
    
    // 獲取輸入輸出張量
    input = interpreter->input(0);
    output = interpreter->output(0);
    
    // 驗證張量尺寸
    if ((input->dims->size != 3) ||
        (input->dims->data[1] != kSequenceLength) ||
        (input->dims->data[2] != kFeatureDim)) {
        Serial.println("Bad input tensor parameters in model");
        return false;
    }
    
    if ((output->dims->size != 2) ||
        (output->dims->data[1] != kNumClasses)) {
        Serial.println("Bad output tensor parameters in model");
        return false;
    }
    
    // 清空緩衝區
    clearBuffer();
    
    Serial.println("TensorFlow Lite推理引擎初始化成功");
    return true;
}

// 添加數據點
void TensorFlowLiteInference::addDataPoint(float* sensor_data) {
    // 將9維數據添加到緩衝區
    for (int i = 0; i < kFeatureDim; i++) {
        input_buffer[buffer_index * kFeatureDim + i] = sensor_data[i];
    }
    
    buffer_index++;
    
    // 如果緩衝區滿了，開始滑動窗口
    if (buffer_index >= kSequenceLength) {
        buffer_full = true;
        
        // 滑動窗口：移除最舊的數據點
        for (int i = 0; i < (kSequenceLength - 1) * kFeatureDim; i++) {
            input_buffer[i] = input_buffer[i + kFeatureDim];
        }
        
        buffer_index = kSequenceLength - 1;
    }
}

// 檢查緩衝區是否準備好
bool TensorFlowLiteInference::isBufferReady() {
    return buffer_full;
}

// 執行推理
bool TensorFlowLiteInference::runInference() {
    if (!buffer_full) {
        return false;
    }
    
    // 檢查是否為演示模式
    if (model_data_len < 1000) {
        // 演示模式 - 生成模擬結果
        Serial.println("🔄 演示模式推理中...");
        
        // 基於輸入數據生成合理的模擬結果
        float average_activity = 0.0;
        for (int i = 0; i < kSequenceLength * kFeatureDim; i++) {
            average_activity += input_buffer[i];
        }
        average_activity /= (kSequenceLength * kFeatureDim);
        
        // 模擬帕金森等級判斷
        if (average_activity < 0.2) {
            predicted_class = 0;  // 輕度
            confidence = 0.75;
        } else if (average_activity < 0.4) {
            predicted_class = 1;  // 輕中度
            confidence = 0.80;
        } else if (average_activity < 0.6) {
            predicted_class = 2;  // 中度
            confidence = 0.85;
        } else if (average_activity < 0.8) {
            predicted_class = 3;  // 中重度
            confidence = 0.82;
        } else {
            predicted_class = 4;  // 重度
            confidence = 0.78;
        }
        
        // 生成模擬概率分佈
        for (int i = 0; i < kNumClasses; i++) {
            predictions[i] = (i == predicted_class) ? confidence : ((1.0 - confidence) / 4.0);
        }
        
        Serial.println("✅ 演示推理完成");
        return true;
    }
    
    // 真實AI模型推理（當有完整模型時）
    // 將數據複製到輸入張量
    for (int i = 0; i < kSequenceLength * kFeatureDim; i++) {
        if (input->type == kTfLiteFloat32) {
            input->data.f[i] = input_buffer[i];
        } else if (input->type == kTfLiteInt8) {
            // 量化輸入（假設輸入已經標準化）
            input->data.int8[i] = (int8_t)(input_buffer[i] * 127.0f);
        }
    }
    
    // 執行推理
    TfLiteStatus invoke_status = interpreter->Invoke();
    if (invoke_status != kTfLiteOk) {
        Serial.println("Invoke failed");
        return false;
    }
    
    // 提取結果
    confidence = 0.0;
    predicted_class = 0;
    
    for (int i = 0; i < kNumClasses; i++) {
        if (output->type == kTfLiteFloat32) {
            predictions[i] = output->data.f[i];
        } else if (output->type == kTfLiteInt8) {
            predictions[i] = output->data.int8[i] / 127.0f;
        }
        
        if (predictions[i] > confidence) {
            confidence = predictions[i];
            predicted_class = i;
        }
    }
    
    return true;
}

// 獲取預測類別
int TensorFlowLiteInference::getPredictedClass() {
    return predicted_class + 1;  // 轉換為1-5等級
}

// 獲取置信度
float TensorFlowLiteInference::getConfidence() {
    return confidence;
}

// 獲取所有預測概率
float* TensorFlowLiteInference::getAllPredictions() {
    return predictions;
}

// 獲取帕金森等級描述
String TensorFlowLiteInference::getParkinsonLevelDescription() {
    int level = getPredictedClass();
    
    switch(level) {
        case 1: return "輕度症狀";
        case 2: return "輕中度症狀";
        case 3: return "中度症狀";
        case 4: return "中重度症狀";
        case 5: return "重度症狀";
        default: return "未知";
    }
}

// 獲取訓練建議
String TensorFlowLiteInference::getRecommendation() {
    int level = getPredictedClass();
    
    switch(level) {
        case 1: 
            return "建議進行溫和的靈活性訓練，舵機阻力設定30度";
        case 2: 
            return "增加協調性練習，舵機阻力設定60度";
        case 3: 
            return "重點改善精細動作控制，舵機阻力設定90度";
        case 4: 
            return "加強肌肉力量和平衡訓練，舵機阻力設定120度";
        case 5: 
            return "進行輔助性康復訓練，舵機阻力設定150度";
        default: 
            return "請重新進行評估";
    }
}

// 清空緩衝區
void TensorFlowLiteInference::clearBuffer() {
    buffer_index = 0;
    buffer_full = false;
    predicted_class = -1;
    confidence = 0.0;
    
    for (int i = 0; i < kSequenceLength * kFeatureDim; i++) {
        input_buffer[i] = 0.0;
    }
}

// 打印模型信息
void TensorFlowLiteInference::printModelInfo() {
    Serial.println("=== TensorFlow Lite模型信息 ===");
    Serial.print("模型大小: ");
    Serial.print(model_data_len);
    Serial.println(" bytes");
    Serial.print("輸入形狀: [");
    Serial.print(kSequenceLength);
    Serial.print(", ");
    Serial.print(kFeatureDim);
    Serial.println("]");
    Serial.print("輸出形狀: [");
    Serial.print(kNumClasses);
    Serial.println("]");
    Serial.print("張量Arena大小: ");
    Serial.print(kTensorArenaSize);
    Serial.println(" bytes");
}

// 打印緩衝區狀態
void TensorFlowLiteInference::printBufferStatus() {
    Serial.print("緩衝區狀態: ");
    Serial.print(buffer_index);
    Serial.print("/");
    Serial.print(kSequenceLength);
    Serial.print(", 準備推理: ");
    Serial.println(buffer_full ? "是" : "否");
}

// 獲取當前緩衝區填充數量
int TensorFlowLiteInference::getBufferFillLevel() {
    return buffer_index;
}

// 獲取序列長度
int TensorFlowLiteInference::getSequenceLength() {
    return kSequenceLength;
}

#endif // TENSORFLOW_LITE_INFERENCE_H