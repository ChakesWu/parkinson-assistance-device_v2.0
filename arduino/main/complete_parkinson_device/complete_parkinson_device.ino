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
// AUTO_RESTART_DELAY 已移除 - 單次分析模式不需要自動重啟

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
      // STATE_WAITING_RESTART 已移除 - 單次分析模式不需要自動重啟
};

SystemState currentState = STATE_IDLE;
bool buttonPressed = false;
unsigned long lastButtonTime = 0;
unsigned long lastInferenceTime = 0;
unsigned long lastSampleTime = 0;
unsigned long lastWebDataTime = 0;       // 新增：上次發送網頁數據時間
// analysisCompleteTime 已移除 - 單次分析模式不需要自動重啟
int analysisCount = 0;                   // 新增：分析次數計數器

// 網頁數據發送間隔 (毫秒)
const unsigned long WEB_DATA_INTERVAL = 50;  // 20Hz，適合3D動畫顯示

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
    
    // *** 新增：持續發送實時數據給網頁 ***
    sendContinuousWebData();
    
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
            performSingleAnalysis();
            break;
            
        // STATE_WAITING_RESTART 已移除 - 單次分析模式不需要自動重啟
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
            startSingleAnalysis();
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
            startSingleAnalysis();
        }
    }
}

void startSingleAnalysis() {
    analysisCount++;
    Serial.println("========================================");
    Serial.print("🧠 開始第 ");
    Serial.print(analysisCount);
    Serial.println(" 次深度帕金森症分析...");
    Serial.println("========================================");
    
    if (!isCalibrated) {
        Serial.println("⚠️  需要先校準，開始自動校準...");
        startCalibration();
        return;
    }
    
    currentState = STATE_REAL_TIME_ANALYSIS;
    lastInferenceTime = millis();
    digitalWrite(PIN_LED_STATUS, HIGH);
    
    Serial.println("🔬 單次深度分析已啟動");
    Serial.println("📊 系統將進行以下分析：");
    Serial.println("  ▶ 手指靈活性評估");
    Serial.println("  ▶ 震顫強度測量");
    Serial.println("  ▶ 運動協調性檢測");
    Serial.println("  ▶ 個性化康復建議");
    Serial.println("⏱️  預計分析時間：10-15秒");
    Serial.println("請保持自然的手部動作...");
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

void performSingleAnalysis() {
    unsigned long currentTime = millis();
    
    // 持續收集數據用於單次分析
    if (currentTime - lastSampleTime >= SAMPLE_RATE) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        
        // 添加到AI模型緩衝區
        aiModel.addDataPoint(sensorData);
        
        // 註釋：網頁數據發送已由 sendContinuousWebData() 統一處理
        
        lastSampleTime = currentTime;
        
        // 顯示數據收集進度
        if (!aiModel.isBufferReady()) {
            static unsigned long lastProgressTime = 0;
            if (currentTime - lastProgressTime >= 1500) {  // 每1.5秒顯示一次進度
                Serial.print("📊 數據收集中... ");
                Serial.print("進度: ");
                Serial.print((float)aiModel.getBufferFillLevel() / aiModel.getSequenceLength() * 100, 1);
                Serial.println("%");
                lastProgressTime = currentTime;
            }
        }
    }
    
    // 單次分析執行推理
    if (currentTime - lastInferenceTime >= INFERENCE_INTERVAL && aiModel.isBufferReady()) {
        if (aiModel.runInference()) {
            currentParkinsonsLevel = aiModel.getPredictedClass();
            currentConfidence = aiModel.getConfidence();
            hasValidPrediction = true;
            
            // 輸出詳細分析結果
            outputDetailedAnalysisResults();
            
            // 分析完成，停止分析模式
            Serial.println("✅ 單次分析完成，系統返回待機狀態");
            Serial.println("💡 如需再次分析，請按按鈕或發送 AUTO 命令");
            currentState = STATE_IDLE;
            digitalWrite(PIN_LED_STATUS, LOW);
        }
        
        lastInferenceTime = currentTime;
    }
}

// 輸出詳細的AI分析結果和康復建議
void outputDetailedAnalysisResults() {
    Serial.println();
    Serial.println("🔍===============================🔍");
    Serial.println("🧠       深度AI分析報告       🧠");
    Serial.println("🔍===============================🔍");
    
    // 基本分析信息
    Serial.print("📊 分析編號: #");
    Serial.println(analysisCount);
    Serial.print("🎯 帕金森等級: ");
    Serial.print(currentParkinsonsLevel);
    Serial.print(" (");
    Serial.print(aiModel.getParkinsonLevelDescription());
    Serial.println(")");
    Serial.print("📈 置信度: ");
    Serial.print(currentConfidence * 100, 1);
    Serial.println("%");
    
    // 詳細症狀分析
    Serial.println("\n🔬 症狀詳細分析:");
    outputSymptomAnalysis();
    
    // 個性化康復建議
    Serial.println("\n💪 個性化康復計劃:");
    outputRehabilitationPlan();
    
    // 設備調整建議
    Serial.println("\n⚙️  設備調整建議:");
    int recommendedResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
    Serial.print("🔧 建議阻力設定: ");
    Serial.print(recommendedResistance);
    Serial.println("度");
    
    // 生活方式建議
    Serial.println("\n🌟 生活方式建議:");
    outputLifestyleSuggestions();
    
    // 下次檢測建議
    Serial.println("\n📅 下次檢測建議:");
    outputNextCheckupSuggestions();
    
    Serial.println("🔍===============================🔍");
    Serial.println();
}

// 症狀詳細分析
void outputSymptomAnalysis() {
    switch(currentParkinsonsLevel) {
        case 1:
            Serial.println("  ✅ 手指靈活性: 優秀");
            Serial.println("  ✅ 震顫程度: 幾乎無");
            Serial.println("  ✅ 運動協調: 正常");
            Serial.println("  💡 評估: 目前手部功能表現良好");
            break;
            
        case 2:
            Serial.println("  ⚠️  手指靈活性: 輕微減退");
            Serial.println("  ⚠️  震顫程度: 偶發性輕微震顫");
            Serial.println("  ✅ 運動協調: 基本正常");
            Serial.println("  💡 評估: 建議開始預防性訓練");
            break;
            
        case 3:
            Serial.println("  ⚠️  手指靈活性: 明顯減退");
            Serial.println("  ⚠️  震顫程度: 輕度持續震顫");
            Serial.println("  ⚠️  運動協調: 輕度受影響");
            Serial.println("  💡 評估: 需要積極的康復訓練");
            break;
            
        case 4:
            Serial.println("  🚨 手指靈活性: 嚴重減退");
            Serial.println("  🚨 震顫程度: 中度震顫");
            Serial.println("  🚨 運動協調: 明顯受損");
            Serial.println("  💡 評估: 需要專業醫療指導");
            break;
            
        case 5:
            Serial.println("  🚨 手指靈活性: 極度受限");
            Serial.println("  🚨 震顫程度: 重度震顫");
            Serial.println("  🚨 運動協調: 嚴重受損");
            Serial.println("  💡 評估: 需要立即醫療介入");
            break;
    }
}

// 個性化康復計劃
void outputRehabilitationPlan() {
    switch(currentParkinsonsLevel) {
        case 1:
            Serial.println("  🏃 有氧運動: 每週3-4次，每次30分鐘");
            Serial.println("  🤲 手指操: 每日15分鐘精細動作練習");
            Serial.println("  🎵 音樂治療: 配合節拍進行手部運動");
            Serial.println("  🧘 冥想放鬆: 每日10分鐘減壓練習");
            break;
            
        case 2:
            Serial.println("  🤲 抓握訓練: 每日3次，每次10分鐘");
            Serial.println("  ✍️  書寫練習: 每日練習寫字15分鐘");
            Serial.println("  🏓 乒乓球: 每週2-3次改善協調性");
            Serial.println("  💊 營養補充: 建議增加維生素D攝取");
            break;
            
        case 3:
            Serial.println("  🏋️ 阻力訓練: 使用本設備每日2次");
            Serial.println("  🎯 精細動作: 拼圖、編織等活動");
            Serial.println("  🚶 步態訓練: 每日30分鐘規律行走");
            Serial.println("  💆 按摩療法: 每週2次手部按摩");
            break;
            
        case 4:
            Serial.println("  🏥 物理治療: 建議每週2-3次專業治療");
            Serial.println("  🤝 輔助設備: 考慮使用輔助工具");
            Serial.println("  👨‍⚕️ 醫療監控: 定期檢查調整藥物");
            Serial.println("  👪 家庭支持: 需要家人協助日常活動");
            break;
            
        case 5:
            Serial.println("  🚨 緊急醫療: 立即聯繫神經科醫師");
            Serial.println("  🏥 住院評估: 可能需要住院觀察");
            Serial.println("  💊 藥物調整: 緊急調整藥物方案");
            Serial.println("  👨‍⚕️ 專家會診: 多學科團隊評估");
            break;
    }
}

// 生活方式建議
void outputLifestyleSuggestions() {
    Serial.println("  🥗 飲食建議: 地中海飲食，多吃抗氧化食物");
    Serial.println("  💤 睡眠管理: 保持7-8小時優質睡眠");
    Serial.println("  😊 情緒管理: 保持積極樂觀心態");
    Serial.println("  🧠 認知訓練: 數獨、閱讀等腦力活動");
    
    if (currentParkinsonsLevel >= 3) {
        Serial.println("  ⚠️  安全措施: 注意防跌倒，使用防滑用品");
        Serial.println("  📱 應急準備: 隨身攜帶緊急聯絡方式");
    }
}

// 下次檢測建議
void outputNextCheckupSuggestions() {
    switch(currentParkinsonsLevel) {
        case 1:
            Serial.println("  📅 建議間隔: 3-6個月後再次檢測");
            Serial.println("  🎯 重點關注: 持續保持良好狀態");
            break;
            
        case 2:
            Serial.println("  📅 建議間隔: 2-3個月後再次檢測");
            Serial.println("  🎯 重點關注: 監控症狀進展");
            break;
            
        case 3:
            Serial.println("  📅 建議間隔: 1-2個月後再次檢測");
            Serial.println("  🎯 重點關注: 康復訓練效果評估");
            break;
            
        case 4:
        case 5:
            Serial.println("  📅 建議間隔: 每週檢測追蹤");
            Serial.println("  🎯 重點關注: 治療效果和症狀變化");
            break;
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

// handleAutoRestart 函數已移除 - 單次分析模式不需要自動重啟功能

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

void sendContinuousWebData() {
    // 持續發送實時數據給網頁，不管當前處於什麼狀態
    unsigned long currentTime = millis();
    
    if (currentTime - lastWebDataTime >= WEB_DATA_INTERVAL) {
        // 讀取當前傳感器數據 (15個數值：5手指+EMG+9IMU)
        float sensorData[15];
        readRawSensorDataForWeb(sensorData);
        
        // 發送數據給網頁
        sendRawDataToWeb(sensorData);
        
        lastWebDataTime = currentTime;
    }
}

void readRawSensorDataForWeb(float* data) {
    // 讀取原始傳感器數據供網頁使用（不進行標準化）
    data[0] = readFingerValue(PIN_PINKY);    // 小指
    data[1] = readFingerValue(PIN_RING);     // 無名指
    data[2] = readFingerValue(PIN_MIDDLE);   // 中指
    data[3] = readFingerValue(PIN_INDEX);    // 食指
    data[4] = readFingerValue(PIN_THUMB);    // 拇指
    data[5] = readEMGValue();                // EMG
    
    // 讀取完整IMU數據
    float accel_x, accel_y, accel_z;
    float gyro_x, gyro_y, gyro_z;
    float mag_x, mag_y, mag_z;
    
    // 加速度計
    IMU.readAcceleration(accel_x, accel_y, accel_z);
    data[6] = accel_x;
    data[7] = accel_y;
    data[8] = accel_z;
    
    // 陀螺儀
    if (IMU.readGyroscope(gyro_x, gyro_y, gyro_z)) {
        data[9] = gyro_x;
        data[10] = gyro_y;
        data[11] = gyro_z;
    } else {
        data[9] = 0.0;
        data[10] = 0.0;
        data[11] = 0.0;
    }
    
    // 磁力計
    if (IMU.readMagneticField(mag_x, mag_y, mag_z)) {
        data[12] = mag_x;
        data[13] = mag_y;
        data[14] = mag_z;
    } else {
        data[12] = 0.0;
        data[13] = 0.0;
        data[14] = 0.0;
    }
}

void sendRawDataToWeb(float* rawData) {
    // 發送完整數據給網頁，格式: DATA,finger1,finger2,finger3,finger4,finger5,emg,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mag_x,mag_y,mag_z
    Serial.print("DATA");
    
    // 手指數據 (原始電位器數值 0-1023)
    for (int i = 0; i < 5; i++) {
        Serial.print(",");
        Serial.print((int)constrain(rawData[i], 0, 1023));
    }
    
    // EMG數據
    Serial.print(",");
    Serial.print((int)constrain(rawData[5], 0, 1023));
    
    // 加速度計數據
    Serial.print(",");
    Serial.print(rawData[6], 3);  // Accel X
    Serial.print(",");
    Serial.print(rawData[7], 3);  // Accel Y
    Serial.print(",");
    Serial.print(rawData[8], 3);  // Accel Z
    
    // 陀螺儀數據
    Serial.print(",");
    Serial.print(rawData[9], 3);  // Gyro X
    Serial.print(",");
    Serial.print(rawData[10], 3); // Gyro Y
    Serial.print(",");
    Serial.print(rawData[11], 3); // Gyro Z
    
    // 磁力計數據
    Serial.print(",");
    Serial.print(rawData[12], 3); // Mag X
    Serial.print(",");
    Serial.print(rawData[13], 3); // Mag Y
    Serial.print(",");
    Serial.print(rawData[14], 3); // Mag Z
    
    Serial.println();
}

void sendRealtimeDataToWeb(float* normalizedData) {
    // 將標準化數據轉換為原始數值供網頁3D模型使用
    // 格式: DATA,finger1,finger2,finger3,finger4,finger5,emg,imu_x,imu_y,imu_z
    
    Serial.print("DATA");
    
    // 手指數據 (轉換回原始電位器數值 0-1023)
    for (int i = 0; i < 5; i++) {
        Serial.print(",");
        // 將標準化數據轉換回原始數值範圍
        float originalValue = normalizedData[i] + fingerBaseline[i];
        Serial.print((int)constrain(originalValue, 0, 1023));
    }
    
    // EMG數據
    Serial.print(",");
    float originalEMG = normalizedData[5] + emgBaseline;
    Serial.print((int)constrain(originalEMG, 0, 1023));
    
    // IMU數據 (直接輸出加速度計數值)
    Serial.print(",");
    Serial.print(normalizedData[6], 3);  // X軸
    Serial.print(",");
    Serial.print(normalizedData[7], 3);  // Y軸
    Serial.print(",");
    Serial.print(normalizedData[8], 3);  // Z軸
    
    Serial.println();
}

void blinkError() {
    for (int i = 0; i < 10; i++) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        delay(100);
        digitalWrite(PIN_LED_STATUS, LOW);
        delay(100);
    }
}