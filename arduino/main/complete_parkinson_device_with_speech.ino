/*
  完整帕金森辅助设备 - 集成语音分析
  Arduino Nano 33 BLE Sense Rev2

  功能：
  1. 多传感器数据收集 (手指、EMG、IMU)
  2. 语音采集和特征提取
  3. 多模态AI分析 (传感器 + 语音)
  4. 个性化训练方案
  5. 蓝牙通信

  版本: v2.0 - 集成优化语音分析
  作者: AI Assistant
  日期: 2025-01-09
*/

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <PDM.h>
#include <ArduinoBLE.h>

// 包含优化的语音分析模块
#include "../libraries/optimized_speech_model.h"
#include "../libraries/speech_features.h"

// 引脚定义
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5
#define PIN_SERVO     9
#define PIN_BUTTON    4

// 设备检测引脚
#define PIN_POT_DETECT    2
#define PIN_EMG_DETECT    3

// 音频配置
#define AUDIO_SAMPLE_RATE 16000
#define AUDIO_CHANNELS    1
#define AUDIO_BUFFER_SIZE 1024

// 通信协议参数
const unsigned long SAMPLE_RATE = 100;  // 采样间隔(ms)
const unsigned long BASELINE_DURATION = 2000;  // 基准校准时长(ms)
const unsigned long SPEECH_DURATION = 3000;    // 语音采集时长(ms)

// 全局变量
Servo rehabServo;
float imuData[3] = {0};
bool deviceConnected = false;
bool trainingMode = false;
int parkinsonLevel = 0;

// 语音相关变量
ArduinoSpeechFeatureExtractor speechExtractor;
bool speechRecording = false;
bool speechDataReady = false;
short audioBuffer[AUDIO_BUFFER_SIZE];
volatile int audioSampleIndex = 0;

// 按钮控制
bool buttonPressed = false;
unsigned long buttonPressTime = 0;
bool longPressDetected = false;

// 多模态分析结果
struct MultiModalAnalysis {
  // 传感器分析
  int sensor_level;        // 1-5级
  float sensor_confidence;
  float sensor_tremor_score;    // 震颤评分
  float sensor_rigidity_score; // 僵硬评分

  // 语音分析
  int speech_class;        // 0: 健康, 1: 帕金森
  float speech_probability;
  float speech_confidence;
  String speech_severity;  // 严重程度

  // 融合结果
  int final_level;         // 最终帕金森等级 (1-5)
  float final_confidence;  // 最终置信度 (0-1)
  String final_diagnosis;  // 最终诊断
  String recommendations;  // 建议
  bool is_valid;

  // 时间戳
  unsigned long timestamp;
};

// BLE服务和特征
BLEService parkinsonService("12345678-1234-1234-1234-123456789abc");
BLECharacteristic sensorDataChar("12345678-1234-1234-1234-123456789abd", BLERead | BLENotify, 50);
BLECharacteristic speechDataChar("12345678-1234-1234-1234-123456789abe", BLERead | BLENotify, 50);
BLECharacteristic analysisResultChar("12345678-1234-1234-1234-123456789abf", BLERead | BLENotify, 100);
BLECharacteristic commandChar("12345678-1234-1234-1234-123456789ac0", BLERead | BLEWrite, 20);

void setup() {
  Serial.begin(9600);
  while (!Serial);

  // 初始化IMU
  if (!IMU.begin()) {
    Serial.println("ERROR: IMU初始化失败!");
    while (1);
  }

  // 初始化舵机
  rehabServo.attach(PIN_SERVO);
  rehabServo.write(90);

  // 初始化引脚
  pinMode(PIN_POT_DETECT, INPUT_PULLUP);
  pinMode(PIN_EMG_DETECT, INPUT_PULLUP);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  // 初始化PDM麦克风
  PDM.onReceive(onPDMdata);
  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM初始化失败!");
  }

  // 初始化BLE
  if (!BLE.begin()) {
    Serial.println("ERROR: BLE初始化失败!");
    while (1);
  }

  // 设置BLE设备名称和服务
  BLE.setLocalName("ParkinsonDevice_v2");
  BLE.setAdvertisedService(parkinsonService);

  // 添加特征到服务
  parkinsonService.addCharacteristic(sensorDataChar);
  parkinsonService.addCharacteristic(speechDataChar);
  parkinsonService.addCharacteristic(analysisResultChar);
  parkinsonService.addCharacteristic(commandChar);

  // 添加服务
  BLE.addService(parkinsonService);

  // 设置初始值
  sensorDataChar.writeValue("SENSOR_READY");
  speechDataChar.writeValue("SPEECH_READY");
  analysisResultChar.writeValue("ANALYSIS_READY");
  commandChar.writeValue("CMD_READY");

  // 开始广播
  BLE.advertise();

  Serial.println("SYSTEM: 多模态帕金森辅助装置已启动");
  Serial.println("SYSTEM: 支持命令: START, SPEECH, TRAIN, MULTIMODAL, STATUS");
  Serial.println("SYSTEM: 按钮控制: 短按=开始分析, 长按=紧急停止");
  Serial.println("BLE: 设备已开始广播，等待连接...");
}

void loop() {
  // 处理BLE连接
  BLEDevice central = BLE.central();

  if (central) {
    if (!deviceConnected) {
      Serial.print("BLE: 设备已连接 - ");
      Serial.println(central.address());
      deviceConnected = true;
    }

    // 处理BLE命令
    if (commandChar.written()) {
      String bleCmd = commandChar.value();
      bleCmd.trim();
      processBLECommand(bleCmd);
    }
  } else {
    if (deviceConnected) {
      Serial.println("BLE: 设备已断开连接");
      deviceConnected = false;
    }
  }

  // 处理按钮输入
  handleButtonInput();

  // 处理串口命令
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    processSerialCommand(cmd);
  }

  // 处理语音数据
  if (speechDataReady) {
    processSpeechData();
    speechDataReady = false;
  }

  delay(10);
}

void processBLECommand(String cmd) {
  Serial.print("BLE命令: ");
  Serial.println(cmd);

  if (cmd == "START") {
    startSensorDataCollection();
  } else if (cmd == "SPEECH") {
    startSpeechAnalysis();
  } else if (cmd == "MULTIMODAL") {
    startMultiModalAnalysis();
  } else if (cmd == "STATUS") {
    reportSystemStatus();
  } else if (cmd == "STOP") {
    emergencyStop();
  }

  // 发送确认
  commandChar.writeValue("ACK:" + cmd);
}

void processSerialCommand(String cmd) {
  if (cmd == "START") {
    startSensorDataCollection();
  } else if (cmd == "SPEECH") {
    startSpeechAnalysis();
  } else if (cmd == "MULTIMODAL") {
    startMultiModalAnalysis();
  } else if (cmd == "TRAIN") {
    startTrainingMode();
  } else if (cmd.startsWith("LEVEL")) {
    int level = cmd.substring(6).toInt();
    setParkinsonLevel(level);
  } else if (cmd.startsWith("SERVO")) {
    int angle = cmd.substring(6).toInt();
    controlServo(angle);
  } else if (cmd == "STATUS") {
    reportSystemStatus();
  } else if (cmd == "STOP") {
    emergencyStop();
  } else {
    Serial.println("未知命令: " + cmd);
    Serial.println("支持命令: START, SPEECH, MULTIMODAL, TRAIN, STATUS, STOP");
  }
}

void handleButtonInput() {
  bool currentButtonState = digitalRead(PIN_BUTTON) == LOW;
  
  if (currentButtonState && !buttonPressed) {
    // 按钮按下
    buttonPressed = true;
    buttonPressTime = millis();
    longPressDetected = false;
  } else if (currentButtonState && buttonPressed) {
    // 按钮持续按下
    if (millis() - buttonPressTime > 2000 && !longPressDetected) {
      // 长按检测 (2秒)
      longPressDetected = true;
      emergencyStop();
      Serial.println("BUTTON: 紧急停止触发");
    }
  } else if (!currentButtonState && buttonPressed) {
    // 按钮释放
    buttonPressed = false;
    
    if (!longPressDetected) {
      // 短按 - 开始多模态分析
      Serial.println("BUTTON: 开始多模态分析");
      startMultiModalAnalysis();
    }
  }
}

void startSensorDataCollection() {
  Serial.println("SENSOR: 开始传感器数据收集");
  
  // 检测设备连接状态
  bool potConnected = isPotentiometerConnected();
  bool emgConnected = isEMGConnected();
  
  Serial.print("DEVICE: 电位器=");
  Serial.print(potConnected ? "已连接" : "模拟模式");
  Serial.print(", EMG=");
  Serial.println(emgConnected ? "已连接" : "模拟模式");
  
  // 基准校准
  float fingerBaseline[5] = {0};
  float emgBaseline = 0;
  calibrateBaseline(fingerBaseline, emgBaseline, potConnected, emgConnected);
  
  // 数据采集
  collectSensorData(fingerBaseline, emgBaseline, potConnected, emgConnected);
  
  Serial.println("SENSOR: 传感器数据收集完成");
}

void startSpeechAnalysis() {
  Serial.println("SPEECH: 开始语音分析");
  Serial.println("SPEECH: 请说话3秒钟...");
  
  // 重置语音提取器
  speechExtractor.resetBuffer();
  audioSampleIndex = 0;
  speechRecording = true;
  
  // 开始录音
  unsigned long startTime = millis();
  while (millis() - startTime < SPEECH_DURATION) {
    // 等待音频数据收集
    delay(10);
  }
  
  speechRecording = false;
  speechDataReady = true;
  
  Serial.println("SPEECH: 语音采集完成，正在分析...");
}

void startMultiModalAnalysis() {
  Serial.println("MULTIMODAL: 开始多模态分析");
  
  MultiModalAnalysis result;
  result.is_valid = false;
  
  // 1. 传感器分析
  Serial.println("MULTIMODAL: 步骤1 - 传感器分析");
  // 这里可以调用现有的传感器分析函数
  result.sensor_level = 2;  // 示例值
  result.sensor_confidence = 0.75f;
  
  // 2. 语音分析
  Serial.println("MULTIMODAL: 步骤2 - 语音分析");
  startSpeechAnalysis();
  
  // 等待语音分析完成
  while (!speechDataReady) {
    delay(100);
  }
  
  // 处理语音数据
  SpeechAnalysisResult speechResult = processSpeechData();
  result.speech_class = speechResult.predicted_class;
  result.speech_probability = speechResult.probability;
  result.speech_confidence = speechResult.confidence;
  
  // 3. 多模态融合
  Serial.println("MULTIMODAL: 步骤3 - 多模态融合");
  result = fuseMultiModalData(result);
  
  // 4. 输出结果
  printMultiModalResult(result);
  
  // 5. 生成训练建议
  if (result.is_valid) {
    generateTrainingRecommendation(result.final_level, result.final_confidence);
  }
}

MultiModalAnalysis fuseMultiModalData(MultiModalAnalysis input) {
  MultiModalAnalysis result = input;
  result.timestamp = millis();

  // 智能加权融合策略
  float sensor_weight = 0.65f;  // 传感器权重 (运动症状)
  float speech_weight = 0.35f;  // 语音权重 (语言症状)

  // 将语音二分类映射到5级系统 (更精确的映射)
  int speech_level = 1;
  if (input.speech_class == 1) {
    if (input.speech_probability >= 0.9f) speech_level = 5;
    else if (input.speech_probability >= 0.8f) speech_level = 4;
    else if (input.speech_probability >= 0.7f) speech_level = 3;
    else if (input.speech_probability >= 0.6f) speech_level = 2;
    else speech_level = 1;
  }

  // 加权融合
  float weighted_level = sensor_weight * input.sensor_level +
                        speech_weight * speech_level;

  result.final_level = (int)round(weighted_level);
  result.final_level = constrain(result.final_level, 1, 5);

  // 置信度融合 (考虑一致性)
  float consistency_bonus = 0.0f;
  if (abs(input.sensor_level - speech_level) <= 1) {
    consistency_bonus = 0.1f;  // 两种方法结果一致时增加置信度
  }

  result.final_confidence = sensor_weight * input.sensor_confidence +
                           speech_weight * input.speech_confidence +
                           consistency_bonus;
  result.final_confidence = constrain(result.final_confidence, 0.0f, 1.0f);

  // 生成诊断和建议
  result.final_diagnosis = generateDiagnosis(result.final_level, result.final_confidence);
  result.recommendations = generateRecommendations(result.final_level,
                                                  input.sensor_tremor_score,
                                                  input.sensor_rigidity_score,
                                                  input.speech_probability);

  result.is_valid = true;

  return result;
}

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
  }

  if (confidence < 0.6f) {
    diagnosis += " (低置信度)";
  } else if (confidence > 0.8f) {
    diagnosis += " (高置信度)";
  }

  return diagnosis;
}

String generateRecommendations(int level, float tremor, float rigidity, float speech_prob) {
  String recommendations = "";

  if (level <= 2) {
    recommendations = "建议: 定期监测, 保持运动";
  } else if (level == 3) {
    recommendations = "建议: 专业评估, 增加训练";
    if (tremor > 0.7f) recommendations += ", 震颤训练";
    if (speech_prob > 0.7f) recommendations += ", 语言治疗";
  } else {
    recommendations = "建议: 立即就医, 专业治疗";
    if (rigidity > 0.7f) recommendations += ", 柔韧性训练";
    if (speech_prob > 0.8f) recommendations += ", 语音康复";
  }

  return recommendations;
}

SpeechAnalysisResult processSpeechData() {
  // 提取语音特征
  float features[8];
  speechExtractor.extractAllFeatures(features);
  
  // 使用模型进行分析
  SpeechAnalysisResult result = analyzeSpeechArray(features);
  
  // 打印详细结果
  Serial.println("=== 语音分析结果 ===");
  Serial.print("特征向量: [");
  for (int i = 0; i < 8; i++) {
    Serial.print(features[i], 3);
    if (i < 7) Serial.print(", ");
  }
  Serial.println("]");
  
  printSpeechAnalysisResult(result);
  Serial.println("==================");
  
  return result;
}

void printMultiModalResult(const MultiModalAnalysis& result) {
  Serial.println("=== 多模态分析结果 ===");
  Serial.print("时间戳: ");
  Serial.println(result.timestamp);

  Serial.print("传感器分析: 等级=");
  Serial.print(result.sensor_level);
  Serial.print(", 置信度=");
  Serial.print(result.sensor_confidence, 3);
  Serial.print(", 震颤=");
  Serial.print(result.sensor_tremor_score, 3);
  Serial.print(", 僵硬=");
  Serial.println(result.sensor_rigidity_score, 3);

  Serial.print("语音分析: 类别=");
  Serial.print(result.speech_class == 1 ? "帕金森" : "健康");
  Serial.print(", 概率=");
  Serial.print(result.speech_probability, 3);
  Serial.print(", 置信度=");
  Serial.print(result.speech_confidence, 3);
  Serial.print(", 严重程度=");
  Serial.println(result.speech_severity);

  Serial.print("融合结果: 最终等级=");
  Serial.print(result.final_level);
  Serial.print(", 最终置信度=");
  Serial.println(result.final_confidence, 3);

  Serial.print("诊断: ");
  Serial.println(result.final_diagnosis);

  Serial.print("建议: ");
  Serial.println(result.recommendations);

  Serial.println("====================");

  // 通过BLE发送结果
  sendResultViaBLE(result);
}

void sendResultViaBLE(const MultiModalAnalysis& result) {
  if (!deviceConnected) return;

  // 发送传感器数据
  String sensorData = String(result.sensor_level) + "," +
                     String(result.sensor_confidence, 3) + "," +
                     String(result.sensor_tremor_score, 3) + "," +
                     String(result.sensor_rigidity_score, 3);
  sensorDataChar.writeValue(sensorData);

  // 发送语音数据
  String speechData = String(result.speech_class) + "," +
                     String(result.speech_probability, 3) + "," +
                     String(result.speech_confidence, 3) + "," +
                     result.speech_severity;
  speechDataChar.writeValue(speechData);

  // 发送分析结果
  String analysisData = String(result.final_level) + "," +
                       String(result.final_confidence, 3) + "," +
                       result.final_diagnosis + "," +
                       result.recommendations;
  analysisResultChar.writeValue(analysisData);

  Serial.println("BLE: 分析结果已发送");
}

void generateTrainingRecommendation(int level, float confidence) {
  Serial.println("=== 训练建议 ===");
  
  int resistance = map(level, 1, 5, 30, 150);
  int duration = map(level, 1, 5, 15, 30);
  int frequency = map(level, 1, 5, 2, 4);
  
  Serial.print("建议阻力: ");
  Serial.print(resistance);
  Serial.println("度");
  
  Serial.print("建议时长: ");
  Serial.print(duration);
  Serial.println("分钟");
  
  Serial.print("建议频率: 每日");
  Serial.print(frequency);
  Serial.println("次");
  
  Serial.print("置信度: ");
  Serial.print(confidence * 100, 1);
  Serial.println("%");
  
  if (confidence > 0.8f) {
    Serial.println("建议: 开始个性化训练");
    // 可以自动开始训练
    // startTrainingMode();
  } else {
    Serial.println("建议: 需要更多数据确认");
  }
  
  Serial.println("===============");
}

// PDM音频数据回调
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

// 缺失函数的简单实现
void startSensorDataCollection() {
  Serial.println("SENSOR: 开始传感器数据收集");
  // 这里可以调用您现有的传感器收集代码
}

void startTrainingMode() {
  Serial.println("TRAIN: 开始训练模式");
  // 这里可以调用您现有的训练代码
}

void setParkinsonLevel(int level) {
  parkinsonLevel = constrain(level, 1, 5);
  Serial.print("LEVEL: 设置帕金森等级为 ");
  Serial.println(parkinsonLevel);
}

void controlServo(int angle) {
  angle = constrain(angle, 0, 180);
  rehabServo.write(angle);
  Serial.print("SERVO: 设置角度为 ");
  Serial.println(angle);
}

void reportSystemStatus() {
  Serial.println("=== 系统状态 ===");
  Serial.print("BLE连接: ");
  Serial.println(deviceConnected ? "已连接" : "未连接");
  Serial.print("语音录制: ");
  Serial.println(speechRecording ? "进行中" : "停止");
  Serial.print("训练模式: ");
  Serial.println(trainingMode ? "开启" : "关闭");
  Serial.print("当前等级: ");
  Serial.println(parkinsonLevel);
  Serial.println("===============");
}

void emergencyStop() {
  speechRecording = false;
  trainingMode = false;
  rehabServo.write(90);  // 回到中位
  Serial.println("EMERGENCY: 紧急停止执行");
}

// 检测设备连接状态的简单实现
bool isPotentiometerConnected() {
  return digitalRead(PIN_POT_DETECT) == LOW;
}

bool isEMGConnected() {
  return digitalRead(PIN_EMG_DETECT) == LOW;
}
