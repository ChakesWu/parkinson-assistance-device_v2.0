/*
 * 完整的帕金森輔助裝置系統
 * 整合傳感器收集、AI推理、訓練控制的完整解決方案
 * 
 * 硬體需求:
 * - Arduino Nano 33 BLE Sense Rev2
 * - 5個電位器 (A0-A4)
 * - EMG傳感器 (A5)
 * - 舵機 (D9)
 * - 檢測引腳 (D2, D3)
 */

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include "TensorFlowLite_Inference.h"

// 引腳定義
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5
#define PIN_SERVO     9

// 設備檢測引腳
#define PIN_POT_DETECT    2
#define PIN_EMG_DETECT    3

// 按鈕和LED
#define PIN_BUTTON        4
#define PIN_LED_STATUS    LED_BUILTIN

// 系統參數
const unsigned long SAMPLE_RATE = 100;        // 採樣間隔(ms)
const unsigned long BASELINE_DURATION = 2000;  // 校準時長(ms)
const unsigned long INFERENCE_INTERVAL = 5000; // 推理間隔(ms)
const unsigned long AUTO_RESTART_DELAY = 3000; // 自動重啟延遲(ms)

// 全局對象
Servo rehabServo;
TensorFlowLiteInference aiModel;

// 系統狀態
enum SystemState {
  STATE_IDLE,
  STATE_CALIBRATING,
  STATE_COLLECTING,
  STATE_TRAINING,
  STATE_REAL_TIME_ANALYSIS,
  STATE_WAITING_RESTART  // 新增：等待自動重啟狀態
};

SystemState currentState = STATE_IDLE;
bool buttonPressed = false;
unsigned long lastButtonTime = 0;
unsigned long lastInferenceTime = 0;
unsigned long lastSampleTime = 0;
unsigned long analysisCompleteTime = 0;  // 新增：分析完成時間
int analysisCount = 0;                   // 新增：分析次數計數器

// 數據相關
float sensorBuffer[50][9];  // 緩衝50個時間點的9維數據
int bufferIndex = 0;
bool bufferReady = false;

// 校準基線
float fingerBaseline[5] = {0};
float emgBaseline = 0;
bool isCalibrated = false;

// 預測結果
int currentParkinsonsLevel = 0;
float currentConfidence = 0.0;
bool hasValidPrediction = false;

// 訓練參數
int trainingServoAngle = 90;
int trainingCycles = 0;
bool isTraining = false;

void setup() {
    Serial.begin(9600);
    while (!Serial);
    
    // 初始化引腳
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);  // 改為上拉輸入
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);  // 改為上拉輸入
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    pinMode(PIN_LED_STATUS, OUTPUT);
    
    // 初始化IMU
    if (!IMU.begin()) {
        Serial.println("ERROR: IMU初始化失敗!");
        blinkError();
        while (1);
    }
    
    // 初始化舵機
    rehabServo.attach(PIN_SERVO);
    rehabServo.write(90);
    
    // 初始化AI模型
    aiModel.begin();
    
    Serial.println("SYSTEM: 帕金森輔助裝置已啟動");
    Serial.println("SYSTEM: 按按鈕開始實時分析");
    
    // 顯示初始設備狀態
    Serial.println("=== 設備檢測 ===");
    Serial.print("電位器檢測引腳(D2): ");
    Serial.println(digitalRead(PIN_POT_DETECT) == HIGH ? "HIGH" : "LOW");
    Serial.print("EMG檢測引腳(D3): ");
    Serial.println(digitalRead(PIN_EMG_DETECT) == HIGH ? "HIGH" : "LOW");
    Serial.println("================");
}

void loop() {
    // 檢查按鈕（可選，如果有連接按鈕）
    // checkButton();
    
    // 處理串口命令
    handleSerialCommands();
    
    // 根據當前狀態執行相應功能
    switch (currentState) {
        case STATE_IDLE:
            // 空閒狀態，等待命令
            break;
            
        case STATE_CALIBRATING:
            startCalibration();
            break;
            
        case STATE_COLLECTING:
            startDataCollection();
            break;
            
        case STATE_TRAINING:
            startTraining();
            break;
            
        case STATE_REAL_TIME_ANALYSIS:
            performRealTimeAnalysis();
            break;
            
        case STATE_WAITING_RESTART:
            handleAutoRestart();
            break;
    }
    
    delay(10);
}

void checkButton() {
    bool buttonState = digitalRead(PIN_BUTTON) == LOW;
    unsigned long currentTime = millis();
    
    if (buttonState && !buttonPressed && (currentTime - lastButtonTime > 200)) {
        buttonPressed = true;
        lastButtonTime = currentTime;
        
        // 按鈕切換實時分析模式
        if (currentState == STATE_IDLE) {
            startRealTimeAnalysis();
        } else if (currentState == STATE_REAL_TIME_ANALYSIS) {
            stopRealTimeAnalysis();
        }
    } else if (!buttonState) {
        buttonPressed = false;
    }
}

void handleSerialCommands() {
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        
        if (cmd == "START") {
            startDataCollection();
        } else if (cmd == "TRAIN") {
            startTraining();
        } else if (cmd == "CALIBRATE") {
            startCalibration();
        } else if (cmd == "STATUS") {
            printSystemStatus();
        } else if (cmd.startsWith("SERVO")) {
            int angle = cmd.substring(6).toInt();
            controlServo(angle);
        } else if (cmd == "STOP") {
            stopRealTimeAnalysis();
            Serial.println("停止自動循環分析");
        } else if (cmd == "AUTO") {
            startRealTimeAnalysis();
            Serial.println("重新開始自動循環分析");
        }
    }
}

void startRealTimeAnalysis() {
    analysisCount++;
    Serial.println("========================================");
    Serial.print("開始第 ");
    Serial.print(analysisCount);
    Serial.println(" 次帕金森症狀分析...");
    Serial.println("========================================");
    
    if (!isCalibrated) {
        Serial.println("開始自動校準...");
        startCalibration();
        return;
    }
    
    currentState = STATE_REAL_TIME_ANALYSIS;
    lastInferenceTime = millis();
    digitalWrite(PIN_LED_STATUS, HIGH);
    
    Serial.println("實時分析已啟動");
    Serial.println("- 系統將持續監測您的動作");
    Serial.println("- 每5秒進行一次AI分析");
    Serial.println("- 再次按按鈕停止分析");
}

void stopRealTimeAnalysis() {
    Serial.println("實時分析已停止");
    currentState = STATE_IDLE;
    digitalWrite(PIN_LED_STATUS, LOW);
}

void startCalibration() {
    Serial.println("=== 開始基準校準 ===");
    Serial.println("請保持手部放鬆，不要移動...");
    
    currentState = STATE_CALIBRATING;
    
    // 重置校準數據
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] = 0;
    }
    emgBaseline = 0;
    
    unsigned long startTime = millis();
    int sampleCount = 0;
    
    while (millis() - startTime < BASELINE_DURATION) {
        // 讀取傳感器數據
        fingerBaseline[0] += readFingerValue(PIN_PINKY);
        fingerBaseline[1] += readFingerValue(PIN_RING);
        fingerBaseline[2] += readFingerValue(PIN_MIDDLE);
        fingerBaseline[3] += readFingerValue(PIN_INDEX);
        fingerBaseline[4] += readFingerValue(PIN_THUMB);
        emgBaseline += readEMGValue();
        
        sampleCount++;
        delay(SAMPLE_RATE);
        
        // 進度指示
        if (sampleCount % 5 == 0) {
            Serial.print(".");
        }
    }
    
    // 計算平均值
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] /= sampleCount;
    }
    emgBaseline /= sampleCount;
    
    isCalibrated = true;
    
    Serial.println("\n校準完成!");
    Serial.print("基準值 - 手指: ");
    for (int i = 0; i < 5; i++) {
        Serial.print(fingerBaseline[i]);
        Serial.print(" ");
    }
    Serial.print(", EMG: ");
    Serial.println(emgBaseline);
    
    // 校準完成後自動開始實時分析
    Serial.println("校準完成，現在開始實時分析...");
    delay(1000);
    
    currentState = STATE_REAL_TIME_ANALYSIS;
    lastInferenceTime = millis();
    digitalWrite(PIN_LED_STATUS, HIGH);
    
    Serial.println("========================================");
    Serial.print("開始第 ");
    Serial.print(analysisCount);
    Serial.println(" 次帕金森症狀分析...");
    Serial.println("========================================");
    Serial.println("實時分析已啟動");
    Serial.println("- 系統將持續監測您的動作");
    Serial.println("- 每5秒進行一次AI分析");
}

void startDataCollection() {
    if (!isCalibrated) {
        Serial.println("請先進行校準 (發送CALIBRATE命令)");
        return;
    }
    
    Serial.println("=== 開始數據收集 ===");
    currentState = STATE_COLLECTING;
    
    unsigned long startTime = millis();
    int dataCount = 0;
    
    while (millis() - startTime < 10000) {  // 收集10秒
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        
        // 發送數據包
        Serial.print("DATA");
        for (int i = 0; i < 9; i++) {
            Serial.print(",");
            Serial.print(sensorData[i], 3);
        }
        Serial.println();
        
        dataCount++;
        delay(SAMPLE_RATE);
    }
    
    Serial.println("END");
    Serial.print("數據收集完成，共收集 ");
    Serial.print(dataCount);
    Serial.println(" 個數據點");
    
    currentState = STATE_IDLE;
}

void startTraining() {
    if (!hasValidPrediction) {
        Serial.println("請先進行帕金森分析以獲得訓練方案");
        return;
    }
    
    Serial.println("=== 開始個性化訓練 ===");
    Serial.print("根據帕金森等級 ");
    Serial.print(currentParkinsonsLevel);
    Serial.println(" 調整訓練強度");
    
    currentState = STATE_TRAINING;
    trainingCycles = 0;
    
    // 根據帕金森等級設定訓練參數
    int maxResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
    int cycleCount = 5;
    
    Serial.print("訓練參數 - 最大阻力: ");
    Serial.print(maxResistance);
    Serial.print("度, 週期數: ");
    Serial.println(cycleCount);
    
    performTrainingSequence(maxResistance, cycleCount);
}

void performTrainingSequence(int maxResistance, int cycles) {
    for (int cycle = 0; cycle < cycles; cycle++) {
        Serial.print("訓練週期 ");
        Serial.print(cycle + 1);
        Serial.print("/");
        Serial.println(cycles);
        
        // 漸進式阻力訓練
        for (int resistance = 0; resistance <= maxResistance; resistance += 15) {
            int servoAngle = 90 + resistance;
            rehabServo.write(servoAngle);
            
            Serial.print("阻力: ");
            Serial.print(resistance);
            Serial.println("度");
            
            delay(1000);
            
            // 讀取訓練時的生理反應
            float sensorData[9];
            readNormalizedSensorData(sensorData);
            
            Serial.print("TRAIN_DATA,");
            Serial.print(servoAngle);
            for (int i = 0; i < 9; i++) {
                Serial.print(",");
                Serial.print(sensorData[i], 3);
            }
            Serial.println();
        }
        
        // 返回中位並休息
        rehabServo.write(90);
        Serial.println("休息中...");
        delay(2000);
    }
    
    Serial.println("訓練完成!");
    currentState = STATE_IDLE;
}

void performRealTimeAnalysis() {
    unsigned long currentTime = millis();
    
    // 持續收集數據
    if (currentTime - lastSampleTime >= SAMPLE_RATE) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        
        // 添加到AI模型緩衝區
        aiModel.addDataPoint(sensorData);
        
        lastSampleTime = currentTime;
        
        // 顯示數據收集進度
        if (!aiModel.isBufferReady()) {
            static unsigned long lastProgressTime = 0;
            if (currentTime - lastProgressTime >= 2000) {  // 每2秒顯示一次進度
                Serial.print("數據收集中... ");
                Serial.print("進度: ");
                Serial.print((float)aiModel.getBufferFillLevel() / aiModel.getSequenceLength() * 100, 1);
                Serial.println("%");
                lastProgressTime = currentTime;
            }
        }
    }
    
    // 定期執行推理
    if (currentTime - lastInferenceTime >= INFERENCE_INTERVAL && aiModel.isBufferReady()) {
        if (aiModel.runInference()) {
            currentParkinsonsLevel = aiModel.getPredictedClass();
            currentConfidence = aiModel.getConfidence();
            hasValidPrediction = true;
            
            // 輸出分析結果
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
            Serial.println("訓練建議: " + aiModel.getRecommendation());
            
            // 自動調整舵機預設值
            int recommendedResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
            Serial.print("建議阻力設定: ");
            Serial.print(recommendedResistance);
            Serial.println("度");
            
            Serial.println("==================");
            Serial.println();
            
            // 記錄分析完成時間並轉入等待重啟狀態
            analysisCompleteTime = currentTime;
            currentState = STATE_WAITING_RESTART;
            digitalWrite(PIN_LED_STATUS, LOW);
            
            Serial.print("分析完成，");
            Serial.print(AUTO_RESTART_DELAY / 1000);
            Serial.println("秒後自動開始下一次檢測...");
        }
        
        lastInferenceTime = currentTime;
    }
}

float readFingerValue(int pin) {
    if (isPotentiometerConnected()) {
        return analogRead(pin);
    } else {
        // 模擬信號
        unsigned long currentTime = millis();
        float angle = (currentTime * 0.001) * 2 * PI * 0.1;
        return 512 + 200 * sin(angle + pin * 0.5);
    }
}

float readEMGValue() {
    if (isEMGConnected()) {
        return analogRead(PIN_EMG);
    } else {
        // 模擬EMG信號
        unsigned long currentTime = millis();
        float noise = random(-50, 50);
        float signal = 100 * sin(currentTime * 0.001 * 2 * PI * 0.05) + noise;
        return constrain(512 + signal, 0, 1023);
    }
}

void readNormalizedSensorData(float* data) {
    // 讀取手指數據並標準化
    data[0] = readFingerValue(PIN_PINKY) - fingerBaseline[0];
    data[1] = readFingerValue(PIN_RING) - fingerBaseline[1];
    data[2] = readFingerValue(PIN_MIDDLE) - fingerBaseline[2];
    data[3] = readFingerValue(PIN_INDEX) - fingerBaseline[3];
    data[4] = readFingerValue(PIN_THUMB) - fingerBaseline[4];
    
    // 讀取EMG數據並標準化
    data[5] = readEMGValue() - emgBaseline;
    
    // 讀取IMU數據
    float x, y, z;
    IMU.readAcceleration(x, y, z);
    data[6] = x;
    data[7] = y;
    data[8] = z;
}

bool isPotentiometerConnected() {
    // 更準確的電位器設備檢測
    // 如果檢測引腳為LOW（接地），表示設備已連接
    // 如果檢測引腳為HIGH（上拉），表示設備未連接
    return digitalRead(PIN_POT_DETECT) == LOW;
}

bool isEMGConnected() {
    // 更準確的EMG設備檢測
    // 如果檢測引腳為LOW（接地），表示設備已連接
    // 如果檢測引腳為HIGH（上拉），表示設備未連接
    return digitalRead(PIN_EMG_DETECT) == LOW;
}

void controlServo(int angle) {
    angle = constrain(angle, 0, 180);
    rehabServo.write(angle);
    Serial.print("舵機角度設定為: ");
    Serial.println(angle);
}

void stopCurrentOperation() {
    currentState = STATE_IDLE;
    rehabServo.write(90);
    digitalWrite(PIN_LED_STATUS, LOW);
    Serial.println("操作已停止");
}

void printSystemStatus() {
    Serial.println("=== 系統狀態 ===");
    Serial.print("當前狀態: ");
    switch (currentState) {
        case STATE_IDLE: Serial.println("空閒"); break;
        case STATE_CALIBRATING: Serial.println("校準中"); break;
        case STATE_COLLECTING: Serial.println("收集數據"); break;
        case STATE_TRAINING: Serial.println("訓練中"); break;
        case STATE_REAL_TIME_ANALYSIS: Serial.println("實時分析"); break;
    }
    
    Serial.print("校準狀態: ");
    Serial.println(isCalibrated ? "已校準" : "未校準");
    
    Serial.print("電位器: ");
    Serial.println(isPotentiometerConnected() ? "已連接" : "模擬模式");
    
    Serial.print("EMG設備: ");
    Serial.println(isEMGConnected() ? "已連接" : "模擬模式");
    
    if (hasValidPrediction) {
        Serial.print("帕金森等級: ");
        Serial.print(currentParkinsonsLevel);
        Serial.print(" (置信度: ");
        Serial.print(currentConfidence * 100, 1);
        Serial.println("%)");
    } else {
        Serial.println("帕金森等級: 未分析");
    }
    
    aiModel.printBufferStatus();
    Serial.println("================");
}

void handleAutoRestart() {
    unsigned long currentTime = millis();
    
    // 實時監測傳感器數據
    static unsigned long lastSensorDisplayTime = 0;
    if (currentTime - lastSensorDisplayTime >= 1000) {  // 每1秒顯示一次傳感器數據
        displayRealTimeSensorData();
        lastSensorDisplayTime = currentTime;
    }
    
    // 檢查是否到了自動重啟時間
    if (currentTime - analysisCompleteTime >= AUTO_RESTART_DELAY) {
        // 自動重新開始下一次分析
        Serial.println("\n========================================");
        Serial.println("自動重新開始檢測循環");
        startRealTimeAnalysis();
    } else {
        // 顯示倒計時
        static unsigned long lastCountdownTime = 0;
        if (currentTime - lastCountdownTime >= 1000) {  // 每秒更新一次
            unsigned long remaining = (AUTO_RESTART_DELAY - (currentTime - analysisCompleteTime)) / 1000;
            Serial.print("下次檢測倒計時: ");
            Serial.print(remaining);
            Serial.println("秒");
            lastCountdownTime = currentTime;
        }
    }
}

void displayRealTimeSensorData() {
    Serial.println("--- 實時傳感器數據 ---");
    
    // 手指彎曲數據
    Serial.print("手指彎曲: ");
    Serial.print("小指="); Serial.print(readFingerValue(PIN_PINKY), 0);
    Serial.print(" 無名指="); Serial.print(readFingerValue(PIN_RING), 0);
    Serial.print(" 中指="); Serial.print(readFingerValue(PIN_MIDDLE), 0);
    Serial.print(" 食指="); Serial.print(readFingerValue(PIN_INDEX), 0);
    Serial.print(" 拇指="); Serial.print(readFingerValue(PIN_THUMB), 0);
    Serial.println();
    
    // EMG數據
    Serial.print("EMG強度: ");
    Serial.print(readEMGValue(), 0);
    Serial.print(" (");
    Serial.print(isEMGConnected() ? "真實數據" : "模擬數據");
    Serial.println(")");
    
    // IMU數據
    float x, y, z;
    IMU.readAcceleration(x, y, z);
    Serial.print("IMU加速度 X=");
    Serial.print(x, 3);
    Serial.print("g Y=");
    Serial.print(y, 3);
    Serial.print("g Z=");
    Serial.print(z, 3);
    Serial.println("g");
    
    // 電位器和EMG連接狀態
    Serial.print("設備狀態: 電位器=");
    Serial.print(isPotentiometerConnected() ? "已連接" : "模擬模式");
    Serial.print(" EMG=");
    Serial.print(isEMGConnected() ? "已連接" : "模擬模式");
    Serial.println();
    
    Serial.println("--- 等待中... ---");
}

void blinkError() {
    for (int i = 0; i < 10; i++) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        delay(100);
        digitalWrite(PIN_LED_STATUS, LOW);
        delay(100);
    }
}