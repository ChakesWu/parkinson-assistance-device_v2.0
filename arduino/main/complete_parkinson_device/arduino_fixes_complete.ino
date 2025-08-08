/*
 * Arduino修復版本 - 完整的可編譯修復方案
 * 修復內容：
 * 1. 優化數據發送頻率，避免3D模型卡頓
 * 2. 改進AI分析結果格式，確保網頁正確解析
 * 3. 修復語法錯誤
 */

// 這是對原始complete_parkinson_device.ino的修補版本
// 請將以下修改應用到您的原始文件中

// 需要修改的關鍵部分：

// 1. 修改數據發送間隔（第65行）
// 原始：const unsigned long WEB_DATA_INTERVAL = 50;
// 修改：const unsigned long WEB_DATA_INTERVAL = 100;

// 2. 修改performSingleAnalysis函數中的輸出格式（第410-456行）
// 將原有的詳細輸出替換為簡化版本

// 以下是完整的修復函數，請替換原有的對應部分

// 在原始文件的適當位置添加這個修復函數
void performSingleAnalysisFixed() {
    unsigned long currentTime = millis();
    
    // 數據收集
    if (currentTime - lastSampleTime >= SAMPLE_RATE) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        aiModel.addDataPoint(sensorData);
        lastSampleTime = currentTime;
    }
    
    // AI推理
    if (currentTime - lastInferenceTime >= INFERENCE_INTERVAL && aiModel.isBufferReady()) {
        if (aiModel.runInference()) {
            currentParkinsonsLevel = aiModel.getPredictedClass();
            currentConfidence = aiModel.getConfidence();
            hasValidPrediction = true;
            
            // 簡化版輸出，確保網頁能正確解析
            Serial.println();
            Serial.println("=== AI分析結果 ===");
            Serial.print("分析次數: ");
            Serial.println(analysisCount);
            Serial.print("帕金森等級: ");
            Serial.print(currentParkinsonsLevel);
            Serial.print(" (");
            Serial.print(aiModel.getParkinsonLevelDescription());
            Serial.println(")");
            Serial.print("置信度: ");
            Serial.print(currentConfidence * 100, 1);
            Serial.println("%");
            
            int recommendedResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
            Serial.print("建議阻力設定: ");
            Serial.print(recommendedResistance);
            Serial.println("度");
            
            // 簡化建議
            Serial.println("訓練建議: ");
            switch(currentParkinsonsLevel) {
                case 1: Serial.println("保持現有訓練強度"); break;
                case 2: Serial.println("增加手指靈活性訓練"); break;
                case 3: Serial.println("進行阻力訓練"); break;
                case 4: Serial.println("需要專業指導"); break;
                case 5: Serial.println("立即就醫"); break;
            }
            
            Serial.println("==================");
            
            // 分析完成，返回待機狀態
            currentState = STATE_IDLE;
            digitalWrite(PIN_LED_STATUS, LOW);
            Serial.println("✅ 分析完成，系統返回待機狀態");
        }
        
        lastInferenceTime = currentTime;
    }
}

// 3. 修改sendContinuousWebData函數（第770-784行）
// 將原有的sendContinuousWebData替換為優化版本
void sendOptimizedWebData() {
    static unsigned long lastWebDataTime = 0;
    unsigned long currentTime = millis();
    
    if (currentTime - lastWebDataTime >= 100) {  // 從50ms改為100ms
        float sensorData[15];
        readRawSensorDataForWeb(sensorData);
        
        // 發送簡化數據格式
        Serial.print("DATA");
        for (int i = 0; i < 5; i++) {
            Serial.print(",");
            Serial.print((int)constrain(sensorData[i], 0, 1023));
        }
        Serial.print(",");
        Serial.print((int)constrain(sensorData[5], 0, 1023));
        
        // 只發送加速度計數據
        Serial.print(",");
        Serial