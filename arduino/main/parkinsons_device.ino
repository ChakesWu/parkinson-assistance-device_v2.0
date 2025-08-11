#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>

// 引腳定義
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5
#define PIN_SERVO     9

// EMG模擬信號引腳 (當沒有EMG設備時)
#define PIN_EMG_SIM   A6

// 設備檢測引腳
#define PIN_POT_DETECT    2
#define PIN_EMG_DETECT    3

// 通信協議參數
const unsigned long SAMPLE_RATE = 100;  // 採樣間隔(ms)
const unsigned long BASELINE_DURATION = 3000;  // 基準校準時長(ms) - 改為3秒

// 全局變數
Servo rehabServo;
float imuData[3] = {0};  // x, y, z加速度
bool deviceConnected = false;
bool trainingMode = false;
int parkinsonLevel = 0;

// 初始化和基線相關變數
bool isInitialized = false;
float fingerBaseline[5] = {0};  // 手指伸直時的基線值
float emgBaseline = 0;

// 設備檢測
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

// 模擬信號生成（當設備未連接時）
int getSimulatedPotValue(int pin) {
    // 生成基於正弦波的模擬手指彎曲數據
    static unsigned long lastTime = 0;
    unsigned long currentTime = millis();
    float angle = (currentTime * 0.001) * 2 * PI * 0.1; // 0.1Hz頻率
    return 512 + 200 * sin(angle + pin * 0.5); // 不同手指不同相位
}

int getSimulatedEMGValue() {
    // 生成模擬EMG信號（肌肉活動）
    static unsigned long lastTime = 0;
    unsigned long currentTime = millis();
    float noise = random(-50, 50);
    float signal = 100 * sin(currentTime * 0.001 * 2 * PI * 0.05) + noise;
    return constrain(512 + signal, 0, 1023);
}

void setup() {
    Serial.begin(9600);
    while (!Serial);
    
    // 初始化IMU
    if (!IMU.begin()) {
        Serial.println("ERROR: IMU初始化失敗!");
        while (1);
    }
    
    // 初始化舵機
    rehabServo.attach(PIN_SERVO);
    rehabServo.write(90); // 中位位置
    
    // 初始化檢測引腳
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);  // 改為上拉輸入
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);  // 改為上拉輸入
    
    Serial.println("SYSTEM: 帕金森輔助裝置已啟動");
    Serial.println("SYSTEM: 支持命令: START, TRAIN, LEVEL, SERVO, INIT");
    Serial.println("SYSTEM: 請先執行 INIT 命令進行初始化校準");
}

void loop() {
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        
        if (cmd == "INIT") {
            initializeDevice();
        } else if (cmd == "START") {
            if (!isInitialized) {
                Serial.println("ERROR: 請先執行 INIT 命令進行初始化");
                return;
            }
            startDataCollection();
        } else if (cmd == "TRAIN") {
            startTrainingMode();
        } else if (cmd.startsWith("LEVEL")) {
            // 接收帕金森等級設定: LEVEL,3
            int level = cmd.substring(6).toInt();
            setParkinsonLevel(level);
        } else if (cmd.startsWith("SERVO")) {
            // 舵機控制: SERVO,90
            int angle = cmd.substring(6).toInt();
            controlServo(angle);
        } else if (cmd == "STATUS") {
            reportSystemStatus();
        }
    }
    
    delay(10);
}

void initializeDevice() {
    Serial.println("INIT: 開始設備初始化");
    Serial.println("INIT: 請確保手指完全伸直，保持3秒不動");

    // 檢測設備連接狀態
    bool potConnected = isPotentiometerConnected();
    bool emgConnected = isEMGConnected();

    Serial.print("DEVICE: 電位器=");
    Serial.print(potConnected ? "已連接" : "模擬模式");
    Serial.print(", EMG=");
    Serial.println(emgConnected ? "已連接" : "模擬模式");

    // 重置基線值
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] = 0;
    }
    emgBaseline = 0;

    // 3秒倒計時
    for (int countdown = 3; countdown > 0; countdown--) {
        Serial.print("INIT: 倒計時 ");
        Serial.print(countdown);
        Serial.println(" 秒...");
        delay(1000);
    }

    Serial.println("INIT: 開始收集手指伸直基線數據...");

    unsigned long startTime = millis();
    int sampleCount = 0;

    // 收集3秒的基線數據
    while (millis() - startTime < BASELINE_DURATION) {
        // 收集手指數據 (伸直狀態)
        fingerBaseline[0] += potConnected ? analogRead(PIN_PINKY) : getSimulatedPotValue(PIN_PINKY);
        fingerBaseline[1] += potConnected ? analogRead(PIN_RING) : getSimulatedPotValue(PIN_RING);
        fingerBaseline[2] += potConnected ? analogRead(PIN_MIDDLE) : getSimulatedPotValue(PIN_MIDDLE);
        fingerBaseline[3] += potConnected ? analogRead(PIN_INDEX) : getSimulatedPotValue(PIN_INDEX);
        fingerBaseline[4] += potConnected ? analogRead(PIN_THUMB) : getSimulatedPotValue(PIN_THUMB);

        // 收集EMG基線數據
        emgBaseline += emgConnected ? analogRead(PIN_EMG) : getSimulatedEMGValue();

        sampleCount++;
        delay(SAMPLE_RATE);
    }

    // 計算平均基線值
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] /= sampleCount;
    }
    emgBaseline /= sampleCount;

    isInitialized = true;

    Serial.println("INIT: 初始化完成！");
    Serial.println("BASELINE: 手指伸直基線值:");
    Serial.print("  拇指="); Serial.println(fingerBaseline[4]);
    Serial.print("  食指="); Serial.println(fingerBaseline[3]);
    Serial.print("  中指="); Serial.println(fingerBaseline[2]);
    Serial.print("  無名指="); Serial.println(fingerBaseline[1]);
    Serial.print("  小指="); Serial.println(fingerBaseline[0]);
    Serial.print("  EMG="); Serial.println(emgBaseline);
    Serial.println("INIT: 現在可以使用 START 命令開始數據收集");
}

void startDataCollection() {
    Serial.println("SYSTEM: 開始數據收集");
    
    // 檢測設備連接狀態
    bool potConnected = isPotentiometerConnected();
    bool emgConnected = isEMGConnected();
    
    Serial.print("DEVICE: 電位器=");
    Serial.print(potConnected ? "已連接" : "模擬模式");
    Serial.print(", EMG=");
    Serial.println(emgConnected ? "已連接" : "模擬模式");
    
    // 基準校準階段
    float fingerBaseline[5] = {0};
    float emgBaseline = 0;
    unsigned long startTime = millis();
    int sampleCount = 0;
    
    Serial.println("CALIBRATION: 開始基準校準...");
    
    while (millis() - startTime < BASELINE_DURATION) {
        // 手指數據
        fingerBaseline[0] += potConnected ? analogRead(PIN_PINKY) : getSimulatedPotValue(PIN_PINKY);
        fingerBaseline[1] += potConnected ? analogRead(PIN_RING) : getSimulatedPotValue(PIN_RING);
        fingerBaseline[2] += potConnected ? analogRead(PIN_MIDDLE) : getSimulatedPotValue(PIN_MIDDLE);
        fingerBaseline[3] += potConnected ? analogRead(PIN_INDEX) : getSimulatedPotValue(PIN_INDEX);
        fingerBaseline[4] += potConnected ? analogRead(PIN_THUMB) : getSimulatedPotValue(PIN_THUMB);
        
        // EMG數據
        emgBaseline += emgConnected ? analogRead(PIN_EMG) : getSimulatedEMGValue();
        
        sampleCount++;
        delay(SAMPLE_RATE);
    }
    
    // 計算平均基準值
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] /= sampleCount;
    }
    emgBaseline /= sampleCount;
    
    Serial.println("CALIBRATION: 基準校準完成");
    
    // 數據採集階段
    Serial.println("COLLECTION: 開始數據採集...");
    startTime = millis();
    
    while (millis() - startTime < 10000) {  // 採集10秒
        // 讀取手指彎曲數據
        int fingerValues[5];
        for (int i = 0; i < 5; i++) {
            int pinValues[] = {PIN_PINKY, PIN_RING, PIN_MIDDLE, PIN_INDEX, PIN_THUMB};
            fingerValues[i] = (potConnected ? analogRead(pinValues[i]) : getSimulatedPotValue(pinValues[i])) - fingerBaseline[i];
        }
        
        // 讀取EMG數據
        int emgValue = (emgConnected ? analogRead(PIN_EMG) : getSimulatedEMGValue()) - emgBaseline;
        
        // 讀取IMU數據
        IMU.readAcceleration(imuData[0], imuData[1], imuData[2]);
        
        // 發送完整數據包
        // 協議: DATA,finger1,finger2,finger3,finger4,finger5,emg,imu_x,imu_y,imu_z
        Serial.print("DATA");
        for (int i = 0; i < 5; i++) {
            Serial.print(",");
            Serial.print(fingerValues[i]);
        }
        Serial.print(",");
        Serial.print(emgValue);
        Serial.print(",");
        Serial.print(imuData[0], 3);
        Serial.print(",");
        Serial.print(imuData[1], 3);
        Serial.print(",");
        Serial.print(imuData[2], 3);
        Serial.println();
        
        delay(SAMPLE_RATE);
    }
    
    Serial.println("END");
    Serial.println("COLLECTION: 數據採集完成");
}

void startTrainingMode() {
    Serial.println("TRAIN: 進入訓練模式");
    trainingMode = true;
    
    // 根據帕金森等級調整訓練強度
    int resistance = map(parkinsonLevel, 1, 5, 30, 150); // 1級最輕，5級最重
    
    Serial.print("TRAIN: 訓練強度=");
    Serial.print(resistance);
    Serial.println(" (基於帕金森等級)");
    
    // 開始訓練序列
    for (int cycle = 0; cycle < 5; cycle++) {
        Serial.print("TRAIN: 訓練週期 ");
        Serial.print(cycle + 1);
        Serial.println("/5");
        
        // 漸進阻力訓練
        for (int angle = 90; angle <= 90 + resistance; angle += 10) {
            rehabServo.write(angle);
            delay(500);
            
            // 讀取訓練期間的感測器數據
            IMU.readAcceleration(imuData[0], imuData[1], imuData[2]);
            Serial.print("TRAIN_DATA,");
            Serial.print(angle);
            Serial.print(",");
            Serial.print(imuData[0], 3);
            Serial.print(",");
            Serial.print(imuData[1], 3);
            Serial.print(",");
            Serial.println(imuData[2], 3);
        }
        
        // 返回中位
        rehabServo.write(90);
        delay(1000);
    }
    
    trainingMode = false;
    Serial.println("TRAIN: 訓練完成");
}

void setParkinsonLevel(int level) {
    if (level >= 1 && level <= 5) {
        parkinsonLevel = level;
        Serial.print("LEVEL: 帕金森等級設定為 ");
        Serial.println(level);
        
        // 根據等級提供建議
        switch(level) {
            case 1:
                Serial.println("建議: 輕度症狀，進行溫和的靈活性訓練");
                break;
            case 2:
                Serial.println("建議: 輕中度症狀，增加協調性練習");
                break;
            case 3:
                Serial.println("建議: 中度症狀，重點改善精細動作控制");
                break;
            case 4:
                Serial.println("建議: 中重度症狀，加強肌肉力量和平衡訓練");
                break;
            case 5:
                Serial.println("建議: 重度症狀，進行輔助性康復訓練");
                break;
        }
    } else {
        Serial.println("ERROR: 無效的帕金森等級 (範圍: 1-5)");
    }
}

void controlServo(int angle) {
    angle = constrain(angle, 0, 180);
    rehabServo.write(angle);
    Serial.print("SERVO: 舵機角度設定為 ");
    Serial.println(angle);
}

void reportSystemStatus() {
    Serial.println("=== 系統狀態報告 ===");
    Serial.print("電位器: ");
    Serial.println(isPotentiometerConnected() ? "已連接" : "模擬模式");
    Serial.print("EMG設備: ");
    Serial.println(isEMGConnected() ? "已連接" : "模擬模式");
    Serial.print("帕金森等級: ");
    Serial.println(parkinsonLevel);
    Serial.print("訓練模式: ");
    Serial.println(trainingMode ? "啟動" : "關閉");
    Serial.print("IMU狀態: ");
    IMU.readAcceleration(imuData[0], imuData[1], imuData[2]);
    Serial.print("正常 (");
    Serial.print(imuData[0], 2);
    Serial.print(", ");
    Serial.print(imuData[1], 2);
    Serial.print(", ");
    Serial.print(imuData[2], 2);
    Serial.println(")");
    Serial.println("==================");
}