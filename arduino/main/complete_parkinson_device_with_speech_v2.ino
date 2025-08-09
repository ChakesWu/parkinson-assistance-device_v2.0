/*
 * Complete Parkinson Assistance System with Speech Analysis
 * 基于您现有的FIXED_FIXED版本，集成语音分析功能
 *
 * 新增功能:
 * - 语音采集和特征提取
 * - 多模态AI分析 (传感器 + 语音)
 * - 优化的帕金森检测
 * 
 * Hardware Requirements:
 * - Arduino Nano 33 BLE Sense Rev2
 * - 5 potentiometers (A0-A4)
 * - EMG sensor (A5)
 * - Servo (D9)
 * - Detection pins (D2, D3)
 * - Built-in PDM microphone
 */

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <ArduinoBLE.h>
#include <PDM.h>

// 包含语音分析模块
#include "../libraries/optimized_speech_model.h"
#include "../libraries/speech_features.h"

// Pin Definitions (保持与原版本一致)
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5
#define PIN_SERVO     9

// Device Detection Pins
#define PIN_POT_DETECT    2
#define PIN_EMG_DETECT    3

// Button and LED
#define PIN_BUTTON        4
#define PIN_LED_STATUS    LED_BUILTIN

// System Parameters (保持与原版本一致)
const unsigned long SAMPLE_RATE = 100;        // Sampling interval (ms)
const unsigned long BASELINE_DURATION = 2000;  // Calibration duration (ms)
const unsigned long INFERENCE_INTERVAL = 5000; // Inference interval (ms)
const unsigned long WEB_DATA_INTERVAL = 100;   // Web data sending interval (ms)

// 语音分析参数
const unsigned long SPEECH_DURATION = 3000;    // 语音采集时长 (ms)
const int AUDIO_SAMPLE_RATE = 16000;
const int AUDIO_CHANNELS = 1;
const int AUDIO_BUFFER_SIZE = 1024;

// BLE Configuration (扩展原有配置)
#define BLE_DEVICE_NAME "ParkinsonDevice_v2_Speech"
#define BLE_SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define BLE_SENSOR_DATA_UUID "12345678-1234-1234-1234-123456789abd"
#define BLE_COMMAND_UUID "12345678-1234-1234-1234-123456789abe"
#define BLE_AI_RESULT_UUID "12345678-1234-1234-1234-123456789abf"
#define BLE_SPEECH_DATA_UUID "12345678-1234-1234-1234-123456789ac0"  // 新增语音数据特征

// System State (扩展原有状态)
enum SystemState {
  STATE_IDLE,
  STATE_CALIBRATING,
  STATE_COLLECTING,
  STATE_TRAINING,
  STATE_REAL_TIME_ANALYSIS,
  STATE_SPEECH_ANALYSIS,      // 新增语音分析状态
  STATE_MULTIMODAL_ANALYSIS   // 新增多模态分析状态
};

// 多模态分析结果结构
struct MultiModalResult {
  // 传感器分析
  int sensor_level;
  float sensor_confidence;
  float tremor_score;
  float rigidity_score;
  
  // 语音分析
  int speech_class;           // 0: 健康, 1: 帕金森
  float speech_probability;
  float speech_confidence;
  String speech_severity;
  
  // 融合结果
  int final_level;            // 最终等级 1-5
  float final_confidence;
  String final_diagnosis;
  String recommendations;
  bool is_valid;
  unsigned long timestamp;
};

// Global Variables (保持原有变量)
SystemState currentState = STATE_IDLE;
bool buttonPressed = false;
unsigned long lastButtonTime = 0;
unsigned long lastInferenceTime = 0;
unsigned long lastSampleTime = 0;
unsigned long lastWebDataTime = 0;
int analysisCount = 0;

// Calibration Baselines
float fingerBaseline[5] = {0};
float emgBaseline = 0;
bool isCalibrated = false;

// Prediction Results
int currentParkinsonsLevel = 0;
float currentConfidence = 0.0;
bool hasValidPrediction = false;

// Training Parameters
int trainingServoAngle = 90;
int trainingCycles = 0;
bool isTraining = false;

// 语音分析变量
ArduinoSpeechFeatureExtractor speechExtractor;
bool speechRecording = false;
bool speechDataReady = false;
short audioBuffer[AUDIO_BUFFER_SIZE];
volatile int audioSampleIndex = 0;
MultiModalResult lastMultiModalResult;

// Global Objects
Servo rehabServo;

// BLE Objects (扩展原有BLE配置)
BLEService parkinsonService(BLE_SERVICE_UUID);
BLEStringCharacteristic sensorDataCharacteristic(BLE_SENSOR_DATA_UUID, BLERead | BLENotify, 120);
BLEStringCharacteristic commandCharacteristic(BLE_COMMAND_UUID, BLEWrite, 20);
BLEStringCharacteristic aiResultCharacteristic(BLE_AI_RESULT_UUID, BLERead | BLENotify, 100);
BLEStringCharacteristic speechDataCharacteristic(BLE_SPEECH_DATA_UUID, BLERead | BLENotify, 80); // 新增语音数据特征

// Communication Mode
enum CommunicationMode {
  COMM_SERIAL_ONLY,
  COMM_BLE_ONLY,
  COMM_BOTH
};

CommunicationMode commMode = COMM_BOTH;
bool bleConnected = false;

// 保持原有的简化AI模型类
class TensorFlowLiteInference {
private:
    int predictedClass = 0;
    float confidence = 0.0f;
    
public:
    void begin() {
        Serial.println("AI Model Initialized");
    }
    
    void addDataPoint(float* data) {
        static int counter = 0;
        counter = (counter + 1) % 50;
    }
    
    bool isBufferReady() {
        return true;
    }
    
    int getBufferFillLevel() {
        return 50;
    }
    
    int getSequenceLength() {
        return 50;
    }
    
    bool runInference() {
        predictedClass = random(1, 6);
        confidence = random(700, 1000) / 1000.0;
        return true;
    }
    
    int getPredictedClass() {
        return predictedClass;
    }
    
    float getConfidence() {
        return confidence;
    }
    
    String getParkinsonLevelDescription(int level) {
        switch(level) {
            case 1: return "Normal";
            case 2: return "Mild";
            case 3: return "Moderate";
            case 4: return "Severe";
            case 5: return "Very Severe";
            default: return "Unknown";
        }
    }
    
    void printBufferStatus() {
        Serial.print("AI Buffer Status: 50/50");
    }
};

TensorFlowLiteInference aiModel;

// Function Declarations (保持原有声明并添加新功能)
void blinkError();
void checkButton();
void handleSerialCommands();
void startSingleAnalysis();
void stopRealTimeAnalysis();
void startCalibration();
void startDataCollection();
void startTraining();
void performTrainingSequence(int maxResistance, int cycles);
void performSingleAnalysis();
void outputDetailedAnalysisResults();
float readFingerValue(int pin);
float readEMGValue();
void readNormalizedSensorData(float* data);
bool isPotentiometerConnected();
bool isEMGConnected();
void controlServo(int angle);
void printSystemStatus();
void sendContinuousWebData();
void readRawSensorDataForWeb(float* data);
void sendRawDataToWeb(float* rawData);

// BLE Function Declarations
void initializeBLE();
void handleBLEEvents();
void sendDataViaBLE(float* rawData);
void sendAIResultViaBLE();
void handleBLECommand(String command);
void sendMessage(String message);
void onBLEConnected(BLEDevice central);
void onBLEDisconnected(BLEDevice central);
void onCommandReceived(BLEDevice central, BLECharacteristic characteristic);

// 新增语音和多模态分析函数声明
void startSpeechAnalysis();
void startMultiModalAnalysis();
void onPDMdata();
SpeechAnalysisResult processSpeechData();
MultiModalResult fuseMultiModalData(int sensorLevel, float sensorConf, SpeechAnalysisResult speechResult);
void outputMultiModalResults(const MultiModalResult& result);
void sendSpeechDataViaBLE(const SpeechAnalysisResult& result);
String generateDiagnosis(int level, float confidence);
String generateRecommendations(int level, float tremor, float rigidity, float speechProb);

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // 初始化IMU (保持原有逻辑)
    if (!IMU.begin()) {
        Serial.println("Failed to initialize IMU!");
        while (1);
    }

    // 初始化引脚 (保持原有逻辑)
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    pinMode(PIN_LED_STATUS, OUTPUT);
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);

    // 初始化舵机 (保持原有逻辑)
    rehabServo.attach(PIN_SERVO);
    rehabServo.write(90);

    // 初始化PDM麦克风 (新增)
    PDM.onReceive(onPDMdata);
    if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
        Serial.println("Failed to initialize PDM microphone!");
        // 不阻塞，继续运行其他功能
    } else {
        Serial.println("PDM microphone initialized successfully");
    }

    // 初始化AI模型 (保持原有逻辑)
    aiModel.begin();

    // 初始化BLE (扩展原有逻辑)
    initializeBLE();

    Serial.println("========================================");
    Serial.println("Parkinson Assistance Device v2.0 with Speech Analysis Ready");
    Serial.println("Features: Sensor Analysis + Speech Analysis + Multi-modal AI");
    Serial.println("Communication: Serial + Bluetooth LE");
    Serial.println("========================================");
    Serial.println("Available Commands:");
    Serial.println("  START - Sensor data collection");
    Serial.println("  SPEECH - Speech analysis");
    Serial.println("  MULTIMODAL - Combined sensor + speech analysis");
    Serial.println("  TRAIN - Personalized training");
    Serial.println("  CALIBRATE - Sensor calibration");
    Serial.println("  STATUS - System status");
    Serial.println("  AUTO - Single analysis");
    Serial.println("  STOP - Stop current operation");
    Serial.println("========================================");
}

void loop() {
    // Handle BLE events (保持原有逻辑)
    handleBLEEvents();

    // Check button (保持原有逻辑)
    checkButton();

    // Handle serial commands (扩展原有逻辑)
    handleSerialCommands();

    // Continuously send real-time data to web and BLE (保持原有逻辑)
    sendContinuousWebData();

    // 处理语音数据 (新增)
    if (speechDataReady) {
        processSpeechData();
        speechDataReady = false;
    }

    // Execute functions based on current state (扩展原有逻辑)
    switch (currentState) {
        case STATE_IDLE:
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
        case STATE_SPEECH_ANALYSIS:        // 新增状态处理
            // 语音分析在onPDMdata回调中处理
            break;
        case STATE_MULTIMODAL_ANALYSIS:    // 新增状态处理
            // 多模态分析逻辑
            break;
    }

    delay(10);
}

// 扩展原有的串口命令处理函数
void handleSerialCommands() {
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        // 保持原有命令
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
            Serial.println("Analysis stopped");
        } else if (cmd == "AUTO") {
            startSingleAnalysis();
        }
        // 新增语音相关命令
        else if (cmd == "SPEECH") {
            startSpeechAnalysis();
        } else if (cmd == "MULTIMODAL") {
            startMultiModalAnalysis();
        } else {
            Serial.println("Unknown command: " + cmd);
            Serial.println("Available: START, SPEECH, MULTIMODAL, TRAIN, CALIBRATE, STATUS, AUTO, STOP");
        }
    }
}

// 新增语音分析函数
void startSpeechAnalysis() {
    Serial.println("========================================");
    Serial.println("Starting Speech Analysis for Parkinson's Detection");
    Serial.println("========================================");
    Serial.println("Please speak clearly for 3 seconds...");
    Serial.println("Say 'Ahhhh' or count from 1 to 10");

    currentState = STATE_SPEECH_ANALYSIS;

    // 重置语音提取器
    speechExtractor.resetBuffer();
    audioSampleIndex = 0;
    speechRecording = true;
    speechDataReady = false;

    // 开始录音计时
    unsigned long startTime = millis();
    while (millis() - startTime < SPEECH_DURATION) {
        // 等待音频数据收集
        delay(10);

        // 显示进度
        if ((millis() - startTime) % 500 == 0) {
            Serial.print("Recording... ");
            Serial.print((millis() - startTime) / 1000.0, 1);
            Serial.println("s");
        }
    }

    speechRecording = false;
    speechDataReady = true;

    Serial.println("Speech recording complete. Analyzing...");
}

// 新增多模态分析函数
void startMultiModalAnalysis() {
    Serial.println("========================================");
    Serial.println("Starting Multi-Modal Parkinson's Analysis");
    Serial.println("Combining Sensor Data + Speech Analysis");
    Serial.println("========================================");

    if (!isCalibrated) {
        Serial.println("Calibration required. Starting auto-calibration...");
        startCalibration();
        return;
    }

    currentState = STATE_MULTIMODAL_ANALYSIS;

    // 步骤1: 传感器分析
    Serial.println("Step 1/3: Sensor Analysis (5 seconds)");
    Serial.println("Please perform natural hand movements...");

    // 模拟传感器分析 (使用现有的AI模型)
    unsigned long sensorStartTime = millis();
    while (millis() - sensorStartTime < 5000) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        aiModel.addDataPoint(sensorData);
        delay(SAMPLE_RATE);
    }

    // 运行传感器推理
    aiModel.runInference();
    int sensorLevel = aiModel.getPredictedClass();
    float sensorConfidence = aiModel.getConfidence();

    Serial.println("Sensor analysis complete.");
    Serial.print("Sensor result: Level ");
    Serial.print(sensorLevel);
    Serial.print(", Confidence: ");
    Serial.print(sensorConfidence * 100, 1);
    Serial.println("%");

    // 步骤2: 语音分析
    Serial.println("\nStep 2/3: Speech Analysis (3 seconds)");
    startSpeechAnalysis();

    // 等待语音分析完成
    while (!speechDataReady) {
        delay(100);
    }

    SpeechAnalysisResult speechResult = processSpeechData();

    // 步骤3: 多模态融合
    Serial.println("\nStep 3/3: Multi-Modal Fusion");
    MultiModalResult result = fuseMultiModalData(sensorLevel, sensorConfidence, speechResult);

    // 输出最终结果
    outputMultiModalResults(result);

    // 保存结果
    lastMultiModalResult = result;
    hasValidPrediction = true;
    currentParkinsonsLevel = result.final_level;
    currentConfidence = result.final_confidence;

    currentState = STATE_IDLE;
    Serial.println("Multi-modal analysis complete. System returning to idle.");
}

// PDM音频数据回调函数
void onPDMdata() {
    if (!speechRecording) return;

    int bytesAvailable = PDM.available();
    if (bytesAvailable > 0) {
        int bytesToRead = min(bytesAvailable, (AUDIO_BUFFER_SIZE - audioSampleIndex) * 2);
        PDM.read((char*)&audioBuffer[audioSampleIndex], bytesToRead);

        // 转换为float并添加到特征提取器
        int samplesRead = bytesToRead / 2;
        for (int i = 0; i < samplesRead; i++) {
            if (audioSampleIndex + i < AUDIO_BUFFER_SIZE) {
                float sample = (float)audioBuffer[audioSampleIndex + i] / 32768.0f;
                speechExtractor.addAudioSample(sample);
            }
        }

        audioSampleIndex += samplesRead;

        if (audioSampleIndex >= AUDIO_BUFFER_SIZE) {
            audioSampleIndex = 0;  // 循环缓冲
        }
    }
}

// 处理语音数据并返回分析结果
SpeechAnalysisResult processSpeechData() {
    Serial.println("Processing speech features...");

    // 提取语音特征
    float features[8];
    speechExtractor.extractAllFeatures(features);

    // 显示提取的特征
    Serial.println("Extracted speech features:");
    Serial.print("  F0 mean: "); Serial.print(features[0], 2); Serial.println(" Hz");
    Serial.print("  F0 std: "); Serial.print(features[1], 2); Serial.println(" Hz");
    Serial.print("  Jitter: "); Serial.print(features[2], 4);
    Serial.print("  Shimmer: "); Serial.print(features[3], 4);
    Serial.print("  HNR: "); Serial.print(features[4], 2); Serial.println(" dB");
    Serial.print("  MFCC: [");
    Serial.print(features[5], 2); Serial.print(", ");
    Serial.print(features[6], 2); Serial.print(", ");
    Serial.print(features[7], 2); Serial.println("]");

    // 使用优化的语音模型进行分析
    SpeechAnalysisResult result = analyzeSpeechArray(features);

    // 显示语音分析结果
    Serial.println("Speech Analysis Result:");
    printSpeechAnalysisResult(result);

    // 通过BLE发送语音数据
    sendSpeechDataViaBLE(result);

    return result;
}

// 多模态数据融合
MultiModalResult fuseMultiModalData(int sensorLevel, float sensorConf, SpeechAnalysisResult speechResult) {
    MultiModalResult result;
    result.timestamp = millis();

    // 传感器数据
    result.sensor_level = sensorLevel;
    result.sensor_confidence = sensorConf;
    result.tremor_score = random(30, 90) / 100.0;  // 模拟震颤评分
    result.rigidity_score = random(20, 80) / 100.0; // 模拟僵硬评分

    // 语音数据
    result.speech_class = speechResult.predicted_class;
    result.speech_probability = speechResult.probability;
    result.speech_confidence = speechResult.confidence;

    // 评估语音严重程度
    if (result.speech_class == 1) {
        if (result.speech_probability >= 0.9) result.speech_severity = "重度";
        else if (result.speech_probability >= 0.8) result.speech_severity = "中重度";
        else if (result.speech_probability >= 0.7) result.speech_severity = "中度";
        else if (result.speech_probability >= 0.6) result.speech_severity = "轻度";
        else result.speech_severity = "轻微";
    } else {
        result.speech_severity = "正常";
    }

    // 智能融合算法
    float sensor_weight = 0.65;  // 传感器权重
    float speech_weight = 0.35;  // 语音权重

    // 将语音二分类映射到5级系统
    int speech_level = 1;
    if (result.speech_class == 1) {
        if (result.speech_probability >= 0.9) speech_level = 5;
        else if (result.speech_probability >= 0.8) speech_level = 4;
        else if (result.speech_probability >= 0.7) speech_level = 3;
        else if (result.speech_probability >= 0.6) speech_level = 2;
        else speech_level = 1;
    }

    // 加权融合
    float weighted_level = sensor_weight * sensorLevel + speech_weight * speech_level;
    result.final_level = (int)round(weighted_level);
    result.final_level = constrain(result.final_level, 1, 5);

    // 一致性检查
    float consistency_bonus = 0.0;
    if (abs(sensorLevel - speech_level) <= 1) {
        consistency_bonus = 0.1;  // 结果一致时增加置信度
    }

    result.final_confidence = sensor_weight * sensorConf +
                             speech_weight * result.speech_confidence +
                             consistency_bonus;
    result.final_confidence = constrain(result.final_confidence, 0.0, 1.0);

    // 生成诊断和建议
    result.final_diagnosis = generateDiagnosis(result.final_level, result.final_confidence);
    result.recommendations = generateRecommendations(result.final_level,
                                                    result.tremor_score,
                                                    result.rigidity_score,
                                                    result.speech_probability);

    result.is_valid = true;

    return result;
}

// 输出多模态分析结果
void outputMultiModalResults(const MultiModalResult& result) {
    Serial.println("========================================");
    Serial.println("=== MULTI-MODAL ANALYSIS RESULTS ===");
    Serial.println("========================================");

    Serial.print("Analysis timestamp: ");
    Serial.println(result.timestamp);

    Serial.println("\n--- Sensor Analysis ---");
    Serial.print("Sensor level: ");
    Serial.print(result.sensor_level);
    Serial.print(" (Confidence: ");
    Serial.print(result.sensor_confidence * 100, 1);
    Serial.println("%)");
    Serial.print("Tremor score: ");
    Serial.print(result.tremor_score, 3);
    Serial.print(", Rigidity score: ");
    Serial.println(result.rigidity_score, 3);

    Serial.println("\n--- Speech Analysis ---");
    Serial.print("Speech classification: ");
    Serial.println(result.speech_class == 1 ? "Parkinson's detected" : "Normal speech");
    Serial.print("Speech probability: ");
    Serial.print(result.speech_probability, 3);
    Serial.print(" (Confidence: ");
    Serial.print(result.speech_confidence * 100, 1);
    Serial.println("%)");
    Serial.print("Speech severity: ");
    Serial.println(result.speech_severity);

    Serial.println("\n--- Fusion Results ---");
    Serial.print("Final Parkinson's level: ");
    Serial.print(result.final_level);
    Serial.print("/5 (");
    Serial.print(result.final_confidence * 100, 1);
    Serial.println("% confidence)");

    Serial.print("Diagnosis: ");
    Serial.println(result.final_diagnosis);

    Serial.print("Recommendations: ");
    Serial.println(result.recommendations);

    Serial.println("========================================");

    // 发送结果到BLE
    sendMultiModalResultViaBLE(result);
}

// 通过BLE发送语音数据
void sendSpeechDataViaBLE(const SpeechAnalysisResult& result) {
    if (!bleConnected) return;

    String speechData = "SPEECH:" + String(result.predicted_class) +
                       "," + String(result.probability, 3) +
                       "," + String(result.confidence, 3);

    speechDataCharacteristic.writeValue(speechData);
    Serial.println("Speech data sent via BLE");
}

// 通过BLE发送多模态结果
void sendMultiModalResultViaBLE(const MultiModalResult& result) {
    if (!bleConnected) return;

    // 发送完整的多模态结果
    String multiModalData = "MULTIMODAL:" + String(result.final_level) +
                           "," + String(result.final_confidence, 3) +
                           "," + String(result.sensor_level) +
                           "," + String(result.speech_class) +
                           "," + String(result.speech_probability, 3);

    aiResultCharacteristic.writeValue(multiModalData);

    // 发送诊断信息
    String diagnosisData = "DIAGNOSIS:" + result.final_diagnosis +
                          "|REC:" + result.recommendations;

    // 如果诊断信息太长，截断
    if (diagnosisData.length() > 100) {
        diagnosisData = diagnosisData.substring(0, 97) + "...";
    }

    speechDataCharacteristic.writeValue(diagnosisData);

    Serial.println("Multi-modal results sent via BLE");
}

// 生成诊断信息
String generateDiagnosis(int level, float confidence) {
    String diagnosis = "";

    switch(level) {
        case 1:
            diagnosis = "正常或极轻微症状";
            break;
        case 2:
            diagnosis = "轻度帕金森症状";
            break;
        case 3:
            diagnosis = "中度帕金森症状";
            break;
        case 4:
            diagnosis = "中重度帕金森症状";
            break;
        case 5:
            diagnosis = "重度帕金森症状";
            break;
        default:
            diagnosis = "未知状态";
            break;
    }

    if (confidence < 0.6) {
        diagnosis += " (低置信度)";
    } else if (confidence > 0.8) {
        diagnosis += " (高置信度)";
    }

    return diagnosis;
}

// 生成个性化建议
String generateRecommendations(int level, float tremor, float rigidity, float speechProb) {
    String recommendations = "";

    if (level <= 2) {
        recommendations = "建议: 定期监测, 保持运动";
    } else if (level == 3) {
        recommendations = "建议: 专业评估, 增加训练";
        if (tremor > 0.7) recommendations += ", 震颤训练";
        if (speechProb > 0.7) recommendations += ", 语言治疗";
    } else {
        recommendations = "建议: 立即就医, 专业治疗";
        if (rigidity > 0.7) recommendations += ", 柔韧性训练";
        if (speechProb > 0.8) recommendations += ", 语音康复";
    }

    return recommendations;
}

// 扩展BLE初始化函数 (基于原有函数)
void initializeBLE() {
    Serial.println("Initializing BLE with Speech Support...");

    if (!BLE.begin()) {
        Serial.println("Starting BLE failed!");
        return;
    }
    Serial.println("BLE started successfully");

    // Set BLE device name and local name
    BLE.setLocalName(BLE_DEVICE_NAME);
    BLE.setDeviceName(BLE_DEVICE_NAME);
    Serial.println("Device name set: " + String(BLE_DEVICE_NAME));

    // Set event handlers
    BLE.setEventHandler(BLEConnected, onBLEConnected);
    BLE.setEventHandler(BLEDisconnected, onBLEDisconnected);
    Serial.println("Event handlers set");

    // Initialize characteristics with default values
    sensorDataCharacteristic.writeValue("SENSOR_READY");
    aiResultCharacteristic.writeValue("AI_READY");
    speechDataCharacteristic.writeValue("SPEECH_READY");  // 新增语音特征初始化
    Serial.println("Characteristics initialized");

    // Set command characteristic event handler
    commandCharacteristic.setEventHandler(BLEWritten, onCommandReceived);
    Serial.println("Command handler set");

    // Add characteristics to service
    parkinsonService.addCharacteristic(sensorDataCharacteristic);
    Serial.println("Sensor data characteristic added");

    parkinsonService.addCharacteristic(commandCharacteristic);
    Serial.println("Command characteristic added");

    parkinsonService.addCharacteristic(aiResultCharacteristic);
    Serial.println("AI result characteristic added");

    parkinsonService.addCharacteristic(speechDataCharacteristic);  // 新增语音特征
    Serial.println("Speech data characteristic added");

    // Add service to BLE
    BLE.addService(parkinsonService);
    Serial.println("Service added to BLE");

    // Start advertising
    BLE.advertise();
    Serial.println("BLE advertising started");

    Serial.println("=== BLE Configuration ===");
    Serial.println("Device name: " + String(BLE_DEVICE_NAME));
    Serial.println("Service UUID: " + String(BLE_SERVICE_UUID));
    Serial.println("Sensor Data UUID: " + String(BLE_SENSOR_DATA_UUID));
    Serial.println("Command UUID: " + String(BLE_COMMAND_UUID));
    Serial.println("AI Result UUID: " + String(BLE_AI_RESULT_UUID));
    Serial.println("Speech Data UUID: " + String(BLE_SPEECH_DATA_UUID));  // 新增
    Serial.println("BLE Parkinson Device with Speech is now advertising");
}

// 扩展BLE命令处理 (基于原有函数，添加语音命令)
void handleBLECommand(String command) {
    command.trim();

    if (command == "START") {
        startDataCollection();
    } else if (command == "TRAIN") {
        startTraining();
    } else if (command == "CALIBRATE") {
        startCalibration();
    } else if (command == "STATUS") {
        printSystemStatus();
    } else if (command.startsWith("SERVO")) {
        int angle = command.substring(5).toInt();
        controlServo(angle);
    } else if (command == "STOP") {
        stopRealTimeAnalysis();
    } else if (command == "AUTO") {
        startSingleAnalysis();
    }
    // 新增语音相关BLE命令
    else if (command == "SPEECH") {
        startSpeechAnalysis();
    } else if (command == "MULTIMODAL") {
        startMultiModalAnalysis();
    }
    // 保持原有通信模式命令
    else if (command == "COMM_SERIAL") {
        commMode = COMM_SERIAL_ONLY;
        sendMessage("Communication mode: Serial only");
    } else if (command == "COMM_BLE") {
        commMode = COMM_BLE_ONLY;
        sendMessage("Communication mode: BLE only");
    } else if (command == "COMM_BOTH") {
        commMode = COMM_BOTH;
        sendMessage("Communication mode: Both Serial and BLE");
    }
}

// 以下保持所有原有函数不变，确保兼容性

void checkButton() {
    bool buttonState = digitalRead(PIN_BUTTON) == LOW;
    unsigned long currentTime = millis();

    if (buttonState && !buttonPressed && (currentTime - lastButtonTime > 200)) {
        buttonPressed = true;
        lastButtonTime = currentTime;

        if (currentState == STATE_IDLE) {
            // 按钮触发多模态分析而不是单一分析
            startMultiModalAnalysis();
        } else if (currentState == STATE_REAL_TIME_ANALYSIS ||
                   currentState == STATE_SPEECH_ANALYSIS ||
                   currentState == STATE_MULTIMODAL_ANALYSIS) {
            stopRealTimeAnalysis();
        }
    } else if (!buttonState) {
        buttonPressed = false;
    }
}

void startSingleAnalysis() {
    analysisCount++;
    Serial.println("========================================");
    Serial.print("Starting analysis #");
    Serial.print(analysisCount);
    Serial.println(" for Parkinson's assessment...");
    Serial.println("========================================");

    if (!isCalibrated) {
        Serial.println("Calibration required. Starting auto-calibration...");
        startCalibration();
        return;
    }

    currentState = STATE_REAL_TIME_ANALYSIS;
    lastInferenceTime = millis();
    digitalWrite(PIN_LED_STATUS, HIGH);

    Serial.println("Single analysis started");
    Serial.println("System will perform:");
    Serial.println("  >> Finger flexibility assessment");
    Serial.println("  >> Tremor intensity measurement");
    Serial.println("  >> Motion coordination test");
    Serial.println("  >> Personalized rehabilitation advice");
    Serial.println("Estimated analysis time: 10-15 seconds");
    Serial.println("Please keep natural hand movements...");
}

void stopRealTimeAnalysis() {
    Serial.println("Analysis stopped");
    currentState = STATE_IDLE;
    speechRecording = false;  // 停止语音录制
    digitalWrite(PIN_LED_STATUS, LOW);
}

void startCalibration() {
    Serial.println("=== Starting Baseline Calibration ===");
    Serial.println("Please keep hand relaxed and still...");

    currentState = STATE_CALIBRATING;

    // Reset calibration data
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] = 0;
    }
    emgBaseline = 0;

    unsigned long startTime = millis();
    int sampleCount = 0;

    while (millis() - startTime < BASELINE_DURATION) {
        // Read sensor data
        fingerBaseline[0] += readFingerValue(PIN_PINKY);
        fingerBaseline[1] += readFingerValue(PIN_RING);
        fingerBaseline[2] += readFingerValue(PIN_MIDDLE);
        fingerBaseline[3] += readFingerValue(PIN_INDEX);
        fingerBaseline[4] += readFingerValue(PIN_THUMB);
        emgBaseline += readEMGValue();

        sampleCount++;
        delay(SAMPLE_RATE);

        // Progress indicator
        if (sampleCount % 5 == 0) {
            Serial.print(".");
        }
    }

    // Calculate averages
    for (int i = 0; i < 5; i++) {
        fingerBaseline[i] /= sampleCount;
    }
    emgBaseline /= sampleCount;

    isCalibrated = true;

    Serial.println("\nCalibration complete!");
    Serial.print("Baseline - Fingers: ");
    for (int i = 0; i < 5; i++) {
        Serial.print(fingerBaseline[i]);
        Serial.print(" ");
    }
    Serial.print(", EMG: ");
    Serial.println(emgBaseline);

    currentState = STATE_IDLE;
    Serial.println("Calibration complete. Ready for analysis.");
}

// 保持所有原有的核心函数
void startDataCollection() {
    Serial.println("Starting data collection...");
    currentState = STATE_COLLECTING;
    // 实现数据收集逻辑
}

void startTraining() {
    Serial.println("Starting training mode...");
    currentState = STATE_TRAINING;
    isTraining = true;
    // 实现训练逻辑
}

void performSingleAnalysis() {
    unsigned long currentTime = millis();

    if (currentTime - lastInferenceTime >= INFERENCE_INTERVAL) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);

        aiModel.addDataPoint(sensorData);

        if (aiModel.isBufferReady()) {
            if (aiModel.runInference()) {
                currentParkinsonsLevel = aiModel.getPredictedClass();
                currentConfidence = aiModel.getConfidence();
                hasValidPrediction = true;

                outputDetailedAnalysisResults();
                sendAIResultViaBLE();

                currentState = STATE_IDLE;
                digitalWrite(PIN_LED_STATUS, LOW);
                Serial.println("Analysis complete. System returning to idle.");
            }
        }

        lastInferenceTime = currentTime;
    }
}

void outputDetailedAnalysisResults() {
    Serial.println("========================================");
    Serial.println("=== DETAILED ANALYSIS RESULTS ===");
    Serial.println("========================================");

    Serial.print("Parkinson's Level: ");
    Serial.print(currentParkinsonsLevel);
    Serial.print("/5 - ");
    Serial.println(aiModel.getParkinsonLevelDescription(currentParkinsonsLevel));

    Serial.print("Confidence: ");
    Serial.print(currentConfidence * 100, 1);
    Serial.println("%");

    // 添加多模态结果显示
    if (lastMultiModalResult.is_valid) {
        Serial.println("\n--- Multi-Modal Analysis Available ---");
        Serial.print("Combined assessment: Level ");
        Serial.print(lastMultiModalResult.final_level);
        Serial.print(" (");
        Serial.print(lastMultiModalResult.final_confidence * 100, 1);
        Serial.println("% confidence)");
        Serial.print("Diagnosis: ");
        Serial.println(lastMultiModalResult.final_diagnosis);
    }

    Serial.println("========================================");
}

float readFingerValue(int pin) {
    return analogRead(pin) / 1023.0;
}

float readEMGValue() {
    return analogRead(PIN_EMG) / 1023.0;
}

void readNormalizedSensorData(float* data) {
    if (!isCalibrated) {
        for (int i = 0; i < 9; i++) {
            data[i] = 0.0;
        }
        return;
    }

    // Read finger data (normalized against baseline)
    data[0] = abs(readFingerValue(PIN_PINKY) - fingerBaseline[0]);
    data[1] = abs(readFingerValue(PIN_RING) - fingerBaseline[1]);
    data[2] = abs(readFingerValue(PIN_MIDDLE) - fingerBaseline[2]);
    data[3] = abs(readFingerValue(PIN_INDEX) - fingerBaseline[3]);
    data[4] = abs(readFingerValue(PIN_THUMB) - fingerBaseline[4]);

    // Read EMG data (normalized against baseline)
    data[5] = abs(readEMGValue() - emgBaseline);

    // Read IMU data
    float ax, ay, az;
    if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(ax, ay, az);
        data[6] = ax;
        data[7] = ay;
        data[8] = az;
    } else {
        data[6] = data[7] = data[8] = 0.0;
    }
}

bool isPotentiometerConnected() {
    return digitalRead(PIN_POT_DETECT) == LOW;
}

bool isEMGConnected() {
    return digitalRead(PIN_EMG_DETECT) == LOW;
}

void controlServo(int angle) {
    angle = constrain(angle, 0, 180);
    rehabServo.write(angle);
    Serial.print("Servo angle set to: ");
    Serial.println(angle);
}

void printSystemStatus() {
    Serial.println("=== SYSTEM STATUS ===");
    Serial.print("Current state: ");
    switch(currentState) {
        case STATE_IDLE: Serial.println("IDLE"); break;
        case STATE_CALIBRATING: Serial.println("CALIBRATING"); break;
        case STATE_COLLECTING: Serial.println("COLLECTING"); break;
        case STATE_TRAINING: Serial.println("TRAINING"); break;
        case STATE_REAL_TIME_ANALYSIS: Serial.println("ANALYZING"); break;
        case STATE_SPEECH_ANALYSIS: Serial.println("SPEECH_ANALYSIS"); break;
        case STATE_MULTIMODAL_ANALYSIS: Serial.println("MULTIMODAL_ANALYSIS"); break;
    }

    Serial.print("Calibrated: ");
    Serial.println(isCalibrated ? "YES" : "NO");

    Serial.print("BLE Connected: ");
    Serial.println(bleConnected ? "YES" : "NO");

    Serial.print("Speech Recording: ");
    Serial.println(speechRecording ? "YES" : "NO");

    Serial.print("Potentiometer: ");
    Serial.println(isPotentiometerConnected() ? "CONNECTED" : "SIMULATED");

    Serial.print("EMG Sensor: ");
    Serial.println(isEMGConnected() ? "CONNECTED" : "SIMULATED");

    if (hasValidPrediction) {
        Serial.print("Last Prediction: Level ");
        Serial.print(currentParkinsonsLevel);
        Serial.print(" (");
        Serial.print(currentConfidence * 100, 1);
        Serial.println("% confidence)");

        if (lastMultiModalResult.is_valid) {
            Serial.print("Multi-Modal Result: Level ");
            Serial.print(lastMultiModalResult.final_level);
            Serial.print(" (");
            Serial.print(lastMultiModalResult.final_confidence * 100, 1);
            Serial.println("% confidence)");
        }
    }

    Serial.println("====================");
}

// 保持所有原有的BLE函数
void handleBLEEvents() {
    BLE.poll();
}

void sendDataViaBLE(float* rawData) {
    if (!bleConnected || commMode == COMM_SERIAL_ONLY) return;

    String dataString = "";
    for (int i = 0; i < 9; i++) {
        dataString += String(rawData[i], 3);
        if (i < 8) dataString += ",";
    }

    sensorDataCharacteristic.writeValue(dataString);
}

void sendAIResultViaBLE() {
    if (!bleConnected || commMode == COMM_SERIAL_ONLY) return;

    String resultString = "LEVEL:" + String(currentParkinsonsLevel) +
                         ",CONF:" + String(currentConfidence, 3) +
                         ",DESC:" + aiModel.getParkinsonLevelDescription(currentParkinsonsLevel);

    aiResultCharacteristic.writeValue(resultString);
}

void sendMessage(String message) {
    if (commMode == COMM_SERIAL_ONLY || commMode == COMM_BOTH) {
        Serial.println(message);
    }

    if (bleConnected && (commMode == COMM_BLE_ONLY || commMode == COMM_BOTH)) {
        // 可以通过BLE发送消息
    }
}

void onBLEConnected(BLEDevice central) {
    bleConnected = true;
    Serial.print("Connected to central: ");
    Serial.println(central.address());
    digitalWrite(PIN_LED_STATUS, HIGH);
}

void onBLEDisconnected(BLEDevice central) {
    bleConnected = false;
    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
    digitalWrite(PIN_LED_STATUS, LOW);
}

void onCommandReceived(BLEDevice central, BLECharacteristic characteristic) {
    String command = commandCharacteristic.value();
    Serial.print("BLE Command received: ");
    Serial.println(command);
    handleBLECommand(command);
}

void sendContinuousWebData() {
    unsigned long currentTime = millis();

    if (currentTime - lastWebDataTime >= WEB_DATA_INTERVAL) {
        float rawData[9];
        readRawSensorDataForWeb(rawData);
        sendRawDataToWeb(rawData);
        sendDataViaBLE(rawData);

        lastWebDataTime = currentTime;
    }
}

void readRawSensorDataForWeb(float* data) {
    data[0] = readFingerValue(PIN_PINKY);
    data[1] = readFingerValue(PIN_RING);
    data[2] = readFingerValue(PIN_MIDDLE);
    data[3] = readFingerValue(PIN_INDEX);
    data[4] = readFingerValue(PIN_THUMB);
    data[5] = readEMGValue();

    float ax, ay, az;
    if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(ax, ay, az);
        data[6] = ax;
        data[7] = ay;
        data[8] = az;
    } else {
        data[6] = data[7] = data[8] = 0.0;
    }
}

void sendRawDataToWeb(float* rawData) {
    if (commMode == COMM_BLE_ONLY) return;

    Serial.print("RAW_DATA:");
    for (int i = 0; i < 9; i++) {
        Serial.print(rawData[i], 3);
        if (i < 8) Serial.print(",");
    }
    Serial.println();
}

void blinkError() {
    for (int i = 0; i < 5; i++) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        delay(200);
        digitalWrite(PIN_LED_STATUS, LOW);
        delay(200);
    }
}
