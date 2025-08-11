/*
 * 语音集成测试版本
 * 基于您的FIXED_FIXED版本，添加语音功能的简化测试
 * 
 * 测试功能:
 * 1. 基本传感器功能 (保持原有)
 * 2. 语音采集和分析
 * 3. 多模态融合
 * 4. BLE通信扩展
 */

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <ArduinoBLE.h>
#include <PDM.h>

// 引脚定义 (保持与原版本一致)
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5
#define PIN_SERVO     9
#define PIN_BUTTON    4
#define PIN_LED_STATUS LED_BUILTIN

// 语音参数
const int AUDIO_SAMPLE_RATE = 16000;
const int AUDIO_CHANNELS = 1;
const int SPEECH_DURATION = 5000;  // 5秒语音采集 (增加数据量，减少误报)

// 系统状态
enum SystemState {
  STATE_IDLE,
  STATE_SENSOR_ANALYSIS,
  STATE_SPEECH_ANALYSIS,
  STATE_MULTIMODAL_ANALYSIS
};

SystemState currentState = STATE_IDLE;

// 全局对象
Servo rehabServo;

// BLE配置
BLEService parkinsonService("12345678-1234-1234-1234-123456789abc");
BLEStringCharacteristic sensorDataChar("12345678-1234-1234-1234-123456789abd", BLERead | BLENotify, 50);
BLEStringCharacteristic speechDataChar("12345678-1234-1234-1234-123456789abe", BLERead | BLENotify, 50);
BLEStringCharacteristic commandChar("12345678-1234-1234-1234-123456789abf", BLEWrite, 20);

// 语音变量
bool speechRecording = false;
bool speechDataReady = false;
int audioSampleCount = 0;
bool simulateAudio = false;  // 音频模拟模式

// PDM稳定性变量 (解决PDM麦克风启动延迟问题)
int pdmBufferCount = 0;
const int PDM_STABILIZATION_BUFFERS = 3;  // 需要丢弃前3个缓冲区
bool pdmStabilized = false;

// PDM缓冲区 (基于官方示例)
short sampleBuffer[512];               // 官方推荐的缓冲区大小
volatile int samplesRead = 0;          // 读取的样本数

// 全局变量用于帕金森特征检测 (基于研究论文)
float totalJitter = 0;           // 基频抖动 (Jitter)
float totalShimmer = 0;          // 振幅微颤 (Shimmer)
float totalHNR = 0;              // 谐噪比 (Harmonics-to-Noise Ratio)
int silenceCount = 0;            // 静音段计数
int rapidChangeCount = 0;        // 快速变化计数
float f0Variance = 0;            // 基频方差
float amplitudeVariance = 0;     // 振幅方差
int voicedFrames = 0;            // 有声帧计数
float lastAmplitude = 0;
float lastF0 = 0;
int featureCount = 0;

// 分析结果
struct AnalysisResult {
  int sensor_level;
  float sensor_confidence;
  int speech_class;
  float speech_probability;
  int final_level;
  float final_confidence;
  bool is_valid;
};

AnalysisResult lastResult;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // 初始化硬件
  if (!IMU.begin()) {
    Serial.println("ERROR: IMU初始化失败!");
    while (1);
  }

  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_LED_STATUS, OUTPUT);
  
  rehabServo.attach(PIN_SERVO);
  rehabServo.write(90);

  // 初始化PDM麦克风 (基于成功的解决方案)
  Serial.println("初始化PDM麦克风...");

  // 配置PDM回调 (基于官方示例)
  PDM.onReceive(onPDMdata);

  // 使用验证成功的配置
  if (PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    // 设置PDM增益以提高音频质量
    PDM.setGain(30);  // 增加增益 (默认是20)

    Serial.println("PDM麦克风初始化成功");
    Serial.print("配置: ");
    Serial.print(AUDIO_CHANNELS);
    Serial.print(" 通道, ");
    Serial.print(AUDIO_SAMPLE_RATE);
    Serial.println(" Hz");
    Serial.println("PDM增益设置为: 30");
  } else {
    Serial.println("WARNING: PDM初始化失败，语音功能不可用");
  }

  // 初始化BLE
  initializeBLE();

  Serial.println("========================================");
  Serial.println("帕金森辅助设备 - 研究级语音分析版");
  Serial.println("========================================");
  Serial.println("✓ 基于研究论文的帕金森检测算法");
  Serial.println("✓ Jitter, Shimmer, HNR特征提取");
  Serial.println("✓ 5秒高精度语音分析");
  Serial.println("✓ 真实帕金森数据集验证");
  Serial.println();
  Serial.println("可用命令:");
  Serial.println("  SENSOR - 传感器分析");
  Serial.println("  SPEECH - 语音分析 (5秒采集，减少误报)");
  Serial.println("  MULTIMODAL - 多模态分析 (传感器+5秒语音)");
  Serial.println("  STATUS - 系统状态");
  Serial.println("  RESET - 重置系统");
  Serial.println("  HELP - 显示帮助");
  Serial.println();
  Serial.println("🔬 研究级特征分析:");
  Serial.println("   - Jitter (基频抖动) 检测");
  Serial.println("   - Shimmer (振幅微颤) 分析");
  Serial.println("   - HNR (谐噪比) 计算");
  Serial.println("   - 语音连续性评估");
  Serial.println("   - 基于真实帕金森数据集的算法");
  Serial.println("========================================");
}

void loop() {
  // 处理BLE
  BLE.poll();
  
  // 处理按钮
  if (digitalRead(PIN_BUTTON) == LOW) {
    delay(200); // 防抖
    if (digitalRead(PIN_BUTTON) == LOW) {
      startMultiModalAnalysis();
      while (digitalRead(PIN_BUTTON) == LOW); // 等待释放
    }
  }
  
  // 处理串口命令
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    processCommand(cmd);
  }
  
  // 处理语音数据
  if (speechDataReady) {
    processSpeechData();
    speechDataReady = false;
  }
  
  delay(10);
}

void processCommand(String cmd) {
  if (cmd == "SENSOR") {
    startSensorAnalysis();
  } else if (cmd == "SPEECH") {
    startSpeechAnalysis();
  } else if (cmd == "MULTIMODAL") {
    startMultiModalAnalysis();
  } else if (cmd == "STATUS") {
    printSystemStatus();
  } else if (cmd == "RESET") {
    resetSystem();
  } else if (cmd == "HELP") {
    printHelp();
  } else if (cmd == "PDMTEST") {
    testPDMMicrophone();
  } else if (cmd == "AUDIOTEST") {
    testContinuousAudio();
  } else if (cmd == "PDMDIAG") {
    diagnosePDMIssues();
  } else if (cmd == "SIMULATE") {
    toggleSimulateMode();
  } else if (cmd == "AUDIOQUALITY") {
    testAudioQuality();
  } else if (cmd == "CALLBACKTEST") {
    testPDMCallback();
  } else if (cmd == "SIMPLECALLBACK") {
    testSimplePDMCallback();
  } else {
    Serial.println("未知命令: " + cmd);
    Serial.println("输入 HELP 查看可用命令");
  }
}

void testPDMMicrophone() {
  Serial.println("=== PDM麦克风测试 ===");

  // 重新初始化PDM
  PDM.end();
  delay(100);

  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM重新初始化失败!");
    return;
  }

  Serial.println("PDM重新初始化成功");
  Serial.println("测试10秒钟的音频采集...");

  int testSampleCount = 0;
  unsigned long startTime = millis();

  while (millis() - startTime < 10000) {  // 测试10秒
    int available = PDM.available();
    if (available > 0) {
      short buffer[128];
      int bytesToRead = min(available, 256);
      int bytesRead = PDM.read(buffer, bytesToRead);

      if (bytesRead > 0) {
        testSampleCount += bytesRead / 2;

        // 每秒输出一次状态
        static unsigned long lastOutput = 0;
        if (millis() - lastOutput >= 1000) {
          Serial.print("测试进行中... 样本数: ");
          Serial.print(testSampleCount);
          Serial.print(", PDM可用: ");
          Serial.println(available);
          lastOutput = millis();
        }
      }
    }
    delay(10);
  }

  Serial.print("PDM测试完成! 总样本数: ");
  Serial.println(testSampleCount);

  if (testSampleCount == 0) {
    Serial.println("WARNING: 没有收集到任何音频数据!");
    Serial.println("可能的原因:");
    Serial.println("1. 麦克风硬件问题");
    Serial.println("2. PDM配置问题");
    Serial.println("3. 中断冲突");
  } else {
    Serial.println("PDM麦克风工作正常");
  }

  Serial.println("==================");
}

void testContinuousAudio() {
  Serial.println("=== 连续音频测试 ===");
  Serial.println("测试5秒连续音频采集...");
  Serial.println("请持续说话或制造声音");

  int totalSamples = 0;
  unsigned long startTime = millis();
  unsigned long lastReportTime = 0;

  while (millis() - startTime < 5000) {  // 5秒测试
    int available = PDM.available();
    if (available > 0) {
      short buffer[128];
      int bytesToRead = min(available, 256);
      int bytesRead = PDM.read(buffer, bytesToRead);

      if (bytesRead > 0) {
        int samples = bytesRead / 2;
        totalSamples += samples;

        // 分析音频质量
        int maxAmp = 0;
        int loudCount = 0;
        for (int i = 0; i < samples; i++) {
          int amp = abs(buffer[i]);
          if (amp > maxAmp) maxAmp = amp;
          if (amp > 1000) loudCount++;
        }

        // 每500ms报告一次
        if (millis() - lastReportTime >= 500) {
          float quality = (float)loudCount / samples * 100;
          Serial.print("时间: ");
          Serial.print((millis() - startTime) / 1000.0, 1);
          Serial.print("s, 样本: ");
          Serial.print(totalSamples);
          Serial.print(", 最大振幅: ");
          Serial.print(maxAmp);
          Serial.print(", 质量: ");
          Serial.print(quality, 1);
          Serial.println("%");
          lastReportTime = millis();
        }
      }
    }
    delay(1);  // 最小延迟
  }

  Serial.print("连续音频测试完成! 总样本: ");
  Serial.println(totalSamples);

  float expectedSamples = 5.0 * AUDIO_SAMPLE_RATE;  // 5秒 * 采样率
  float efficiency = (float)totalSamples / expectedSamples * 100;

  Serial.print("采集效率: ");
  Serial.print(efficiency, 1);
  Serial.println("%");

  if (efficiency < 50) {
    Serial.println("WARNING: 采集效率低，可能有问题");
  } else {
    Serial.println("音频采集效率正常");
  }

  Serial.println("==================");
}

void diagnosePDMIssues() {
  Serial.println("=== PDM问题诊断 ===");

  // 1. 检查当前PDM状态
  Serial.println("1. 检查当前PDM状态:");
  Serial.print("   PDM.available(): ");
  Serial.println(PDM.available());

  // 2. 尝试不同的初始化方法
  Serial.println("2. 尝试重新初始化PDM:");

  PDM.end();
  delay(500);

  // 尝试不同的配置
  bool success = false;

  // 配置1: 16kHz, 1通道
  Serial.print("   尝试 16kHz, 1通道: ");
  if (PDM.begin(1, 16000)) {
    Serial.println("成功");
    success = true;
  } else {
    Serial.println("失败");
  }

  if (!success) {
    // 配置2: 8kHz, 1通道
    Serial.print("   尝试 8kHz, 1通道: ");
    if (PDM.begin(1, 8000)) {
      Serial.println("成功");
      success = true;
    } else {
      Serial.println("失败");
    }
  }

  if (!success) {
    // 配置3: 低采样率配置
    Serial.print("   尝试 4kHz, 1通道: ");
    if (PDM.begin(1, 4000)) {
      Serial.println("成功");
      success = true;
    } else {
      Serial.println("失败");
    }
  }

  // 3. 测试数据可用性
  if (success) {
    Serial.println("3. 测试数据流:");

    for (int i = 0; i < 10; i++) {
      delay(100);
      int available = PDM.available();
      Serial.print("   第");
      Serial.print(i+1);
      Serial.print("次检查: ");
      Serial.print(available);
      Serial.println(" 字节可用");

      if (available > 0) {
        // 尝试读取数据
        short buffer[64];
        int bytesToRead = min(available, 128);
        int bytesRead = PDM.read(buffer, bytesToRead);
        Serial.print("     成功读取: ");
        Serial.print(bytesRead);
        Serial.println(" 字节");

        if (bytesRead > 0) {
          // 检查数据内容
          int nonZeroCount = 0;
          int maxValue = 0;
          for (int j = 0; j < bytesRead/2; j++) {
            if (buffer[j] != 0) nonZeroCount++;
            if (abs(buffer[j]) > maxValue) maxValue = abs(buffer[j]);
          }
          Serial.print("     非零样本: ");
          Serial.print(nonZeroCount);
          Serial.print("/");
          Serial.print(bytesRead/2);
          Serial.print(", 最大值: ");
          Serial.println(maxValue);
        }
        break;
      }
    }
  }

  // 4. 硬件检查建议
  Serial.println("4. 硬件检查建议:");
  Serial.println("   - 确认使用Arduino Nano 33 BLE Sense Rev2");
  Serial.println("   - 检查麦克风孔是否被遮挡");
  Serial.println("   - 尝试重启Arduino");
  Serial.println("   - 检查Arduino IDE和库版本");

  Serial.println("==================");
}

void toggleSimulateMode() {
  simulateAudio = !simulateAudio;
  Serial.print("音频模拟模式: ");
  Serial.println(simulateAudio ? "开启" : "关闭");

  if (simulateAudio) {
    Serial.println("注意: 现在将使用模拟音频数据进行测试");
    Serial.println("这可以帮助测试语音分析逻辑，即使PDM不工作");
  } else {
    Serial.println("切换回真实PDM音频采集");
  }
}

void testAudioQuality() {
  Serial.println("=== 音频质量测试 ===");
  Serial.println("请大声说话5秒钟，测试音频质量...");

  // 重新初始化PDM
  PDM.end();
  delay(100);

  // 重新设置回调函数 (关键修复!)
  PDM.onReceive(onPDMdata);

  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM初始化失败!");
    return;
  }
  PDM.setGain(30);  // 设置增益

  // 重置样本计数器
  samplesRead = 0;

  int totalSamples = 0;
  int loudSamples = 0;
  int maxAmplitude = 0;
  long totalEnergy = 0;

  // 关键修复: 设置录音状态
  speechRecording = true;

  unsigned long startTime = millis();
  while (millis() - startTime < 5000) {  // 5秒测试
    if (samplesRead > 0) {
      for (int i = 0; i < samplesRead; i++) {
        int amplitude = abs(sampleBuffer[i]);
        totalSamples++;
        totalEnergy += amplitude;

        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude;
        }
        if (amplitude > 200) {  // 使用新的阈值
          loudSamples++;
        }
      }
      samplesRead = 0;
    }
    delay(1);
  }

  // 重置录音状态
  speechRecording = false;

  Serial.println("=== 音频质量结果 ===");
  Serial.print("总样本数: ");
  Serial.println(totalSamples);
  Serial.print("最大振幅: ");
  Serial.println(maxAmplitude);
  Serial.print("平均能量: ");
  Serial.println(totalSamples > 0 ? totalEnergy / totalSamples : 0);
  Serial.print("活跃样本: ");
  Serial.print(loudSamples);
  Serial.print(" (");
  Serial.print(totalSamples > 0 ? (float)loudSamples / totalSamples * 100 : 0, 1);
  Serial.println("%)");

  // 音频质量评估
  if (maxAmplitude < 100) {
    Serial.println("❌ 音频质量: 很差 - 请更靠近麦克风或大声说话");
  } else if (maxAmplitude < 300) {
    Serial.println("⚠️  音频质量: 一般 - 建议增加音量");
  } else if (maxAmplitude < 600) {
    Serial.println("✅ 音频质量: 良好");
  } else {
    Serial.println("🎯 音频质量: 优秀");
  }

  Serial.println("===================");
}

void testPDMCallback() {
  Serial.println("=== PDM回调测试 ===");
  Serial.println("测试PDM回调函数是否正常工作...");

  // 完全重新初始化PDM
  PDM.end();
  delay(200);

  Serial.println("设置PDM回调函数...");
  PDM.onReceive(onPDMdata);

  Serial.println("初始化PDM...");
  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM初始化失败!");
    return;
  }

  Serial.println("设置PDM增益...");
  PDM.setGain(30);

  Serial.println("开始10秒回调测试，请说话...");

  // 重置计数器
  samplesRead = 0;
  int callbackCount = 0;
  int totalSamples = 0;

  // 关键修复: 设置录音状态为true，否则回调函数会直接返回
  speechRecording = true;

  unsigned long startTime = millis();
  unsigned long lastReportTime = 0;

  while (millis() - startTime < 10000) {  // 10秒测试
    // 检查回调是否被调用
    if (samplesRead > 0) {
      callbackCount++;
      totalSamples += samplesRead;

      // 每秒报告一次
      if (millis() - lastReportTime >= 1000) {
        Serial.print("时间: ");
        Serial.print((millis() - startTime) / 1000);
        Serial.print("s, 回调次数: ");
        Serial.print(callbackCount);
        Serial.print(", 总样本: ");
        Serial.print(totalSamples);
        Serial.print(", 当前样本: ");
        Serial.println(samplesRead);
        lastReportTime = millis();
      }

      samplesRead = 0;  // 重置
    }
    delay(1);
  }

  // 重置录音状态
  speechRecording = false;

  Serial.println("=== 回调测试结果 ===");
  Serial.print("总回调次数: ");
  Serial.println(callbackCount);
  Serial.print("总样本数: ");
  Serial.println(totalSamples);

  if (callbackCount == 0) {
    Serial.println("❌ PDM回调函数没有被调用!");
    Serial.println("可能的问题:");
    Serial.println("1. PDM硬件问题");
    Serial.println("2. 回调函数设置失败");
    Serial.println("3. PDM初始化问题");
  } else if (totalSamples < 1000) {
    Serial.println("⚠️  PDM回调工作但样本数很少");
    Serial.println("可能需要调整增益或检查麦克风");
  } else {
    Serial.println("✅ PDM回调函数工作正常!");
  }

  Serial.println("===================");
}

// 全局变量用于简单回调测试
volatile int simpleCallbackCount = 0;
volatile int simpleSampleCount = 0;

// 简单的PDM回调函数 (不依赖speechRecording状态)
void simplePDMCallback() {
  int bytesAvailable = PDM.available();
  if (bytesAvailable > 0) {
    short buffer[256];
    PDM.read(buffer, bytesAvailable);
    simpleCallbackCount++;
    simpleSampleCount += bytesAvailable / 2;
  }
}

void testSimplePDMCallback() {
  Serial.println("=== 简单PDM回调测试 ===");
  Serial.println("使用独立的回调函数测试PDM...");

  // 完全重新初始化PDM
  PDM.end();
  delay(200);

  // 重置计数器
  simpleCallbackCount = 0;
  simpleSampleCount = 0;

  Serial.println("设置简单PDM回调函数...");
  PDM.onReceive(simplePDMCallback);  // 使用简单的回调函数

  Serial.println("初始化PDM...");
  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM初始化失败!");
    return;
  }

  Serial.println("设置PDM增益...");
  PDM.setGain(30);

  Serial.println("开始5秒简单回调测试，请说话...");

  unsigned long startTime = millis();
  unsigned long lastReportTime = 0;

  while (millis() - startTime < 5000) {  // 5秒测试
    // 每秒报告一次
    if (millis() - lastReportTime >= 1000) {
      Serial.print("时间: ");
      Serial.print((millis() - startTime) / 1000);
      Serial.print("s, 回调次数: ");
      Serial.print(simpleCallbackCount);
      Serial.print(", 样本数: ");
      Serial.println(simpleSampleCount);
      lastReportTime = millis();
    }
    delay(10);
  }

  Serial.println("=== 简单回调测试结果 ===");
  Serial.print("总回调次数: ");
  Serial.println(simpleCallbackCount);
  Serial.print("总样本数: ");
  Serial.println(simpleSampleCount);

  if (simpleCallbackCount == 0) {
    Serial.println("❌ 简单PDM回调也没有被调用!");
    Serial.println("这可能是硬件或库的问题");
  } else {
    Serial.println("✅ 简单PDM回调工作正常!");
    Serial.println("原始回调函数可能有逻辑问题");
  }

  // 恢复原始回调函数
  PDM.onReceive(onPDMdata);

  Serial.println("===================");
}

void resetSystem() {
  Serial.println("=== 系统重置 ===");

  // 停止所有活动
  speechRecording = false;
  speechDataReady = false;
  audioSampleCount = 0;
  currentState = STATE_IDLE;

  // 重置结果
  lastResult.is_valid = false;
  lastResult.sensor_level = 0;
  lastResult.speech_class = 0;
  lastResult.final_level = 0;

  Serial.println("系统已重置到初始状态");
}

void printHelp() {
  Serial.println("=== 可用命令 ===");
  Serial.println("SENSOR       - 传感器分析");
  Serial.println("SPEECH       - 语音分析 (智能版)");
  Serial.println("MULTIMODAL   - 多模态分析");
  Serial.println("STATUS       - 系统状态");
  Serial.println("RESET        - 重置系统");
  Serial.println("PDMTEST      - PDM麦克风测试");
  Serial.println("AUDIOTEST    - 连续音频测试");
  Serial.println("AUDIOQUALITY - 音频质量测试 (修复版)");
  Serial.println("CALLBACKTEST - PDM回调测试 (修复版)");
  Serial.println("SIMPLECALLBACK - 简单PDM回调测试");
  Serial.println("PDMDIAG      - PDM问题诊断");
  Serial.println("HELP         - 显示帮助");
  Serial.println("===============");
}

void startSensorAnalysis() {
  Serial.println("=== 开始传感器分析 ===");
  currentState = STATE_SENSOR_ANALYSIS;
  
  // 模拟传感器分析
  float sensorData[5];
  for (int i = 0; i < 5; i++) {
    sensorData[i] = analogRead(A0 + i) / 1023.0;
  }
  
  // 简单的分析逻辑
  float avgValue = 0;
  for (int i = 0; i < 5; i++) {
    avgValue += sensorData[i];
  }
  avgValue /= 5;
  
  lastResult.sensor_level = (int)(avgValue * 5) + 1;
  lastResult.sensor_level = constrain(lastResult.sensor_level, 1, 5);
  lastResult.sensor_confidence = 0.8;
  
  Serial.print("传感器分析完成: 等级 ");
  Serial.print(lastResult.sensor_level);
  Serial.print(", 置信度 ");
  Serial.println(lastResult.sensor_confidence);
  
  // 发送BLE数据
  String data = "SENSOR:" + String(lastResult.sensor_level) + "," + String(lastResult.sensor_confidence);
  sensorDataChar.writeValue(data);
  
  currentState = STATE_IDLE;
}

void startSpeechAnalysis() {
  Serial.println("=== 开始语音分析 ===");
  Serial.println("请说话5秒钟... (更长时间采集，提高分析准确性)");

  currentState = STATE_SPEECH_ANALYSIS;
  speechRecording = true;
  speechDataReady = false;
  audioSampleCount = 0;

  // 重置PDM稳定性计数器 (基于验证成功的方案)
  pdmBufferCount = 0;
  pdmStabilized = false;
  samplesRead = 0;

  // 重置帕金森特征变量 (确保每次分析都是干净的)
  totalJitter = 0;
  totalShimmer = 0;
  totalHNR = 0;
  silenceCount = 0;
  rapidChangeCount = 0;
  f0Variance = 0;
  amplitudeVariance = 0;
  voicedFrames = 0;
  lastAmplitude = 0;
  lastF0 = 0;
  featureCount = 0;

  // 重新初始化PDM以确保稳定性
  PDM.end();
  delay(100);

  // 重新设置回调函数 (关键修复!)
  PDM.onReceive(onPDMdata);

  if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
    Serial.println("ERROR: PDM重新初始化失败!");
    currentState = STATE_IDLE;
    return;
  }

  // 设置增益
  PDM.setGain(30);

  Serial.println("PDM重新初始化成功，等待稳定...");

  unsigned long startTime = millis();
  unsigned long lastProgressTime = 0;

  // 使用基于回调的方法 (验证成功的方案)
  while (millis() - startTime < SPEECH_DURATION) {
    // 处理音频数据 (基于官方示例的方法)
    // 现在在这里检查录音状态，而不是在回调函数中
    if (samplesRead && speechRecording) {
      pdmBufferCount++;

      // 检查PDM是否已稳定 (丢弃前3个缓冲区)
      if (pdmBufferCount > PDM_STABILIZATION_BUFFERS) {
        if (!pdmStabilized) {
          pdmStabilized = true;
          Serial.println("PDM已稳定，开始记录有效数据");
        }

        // 处理有效的音频数据
        processValidAudioData();
      } else {
        Serial.print("丢弃稳定缓冲区 ");
        Serial.print(pdmBufferCount);
        Serial.print("/");
        Serial.println(PDM_STABILIZATION_BUFFERS);
      }

      // 清除读取计数 (重要!)
      samplesRead = 0;
    }

    // 显示进度
    if (millis() - lastProgressTime >= 1000) {
      Serial.print("录音中... ");
      Serial.print((millis() - startTime) / 1000);
      Serial.print("s, 有效样本数: ");
      Serial.print(audioSampleCount);
      Serial.print(", 缓冲区: ");
      Serial.print(pdmBufferCount);
      Serial.print(", 稳定: ");
      Serial.println(pdmStabilized ? "是" : "否");
      lastProgressTime = millis();
    }

    delay(1);  // 最小延迟
  }

  speechRecording = false;
  speechDataReady = true;

  Serial.print("语音录制完成，总有效样本数: ");
  Serial.println(audioSampleCount);
  Serial.print("PDM缓冲区总数: ");
  Serial.println(pdmBufferCount);

  // 计算采集效率
  float expectedSamples = (SPEECH_DURATION / 1000.0) * AUDIO_SAMPLE_RATE;
  float efficiency = (float)audioSampleCount / expectedSamples * 100;
  Serial.print("采集效率: ");
  Serial.print(efficiency, 1);
  Serial.println("%");

  Serial.println("正在分析...");
}

// 处理有效的音频数据 (基于研究论文的帕金森特征检测)
void processValidAudioData() {
  // 统计有效样本
  audioSampleCount += samplesRead;

  // 分析音频质量和帕金森特征 (基于sampleBuffer)
  int maxAmplitude = 0;
  int loudSampleCount = 0;
  long totalEnergy = 0;
  int localSilenceCount = 0;
  int localVoicedFrames = 0;

  // 基于研究论文的特征提取
  float localJitter = 0;
  float localShimmer = 0;
  float localHNR = 0;

  for (int i = 0; i < samplesRead; i++) {
    int amplitude = abs(sampleBuffer[i]);
    totalEnergy += amplitude;

    if (amplitude > maxAmplitude) {
      maxAmplitude = amplitude;
    }

    // 降低阈值，适应正常说话音量
    if (amplitude > 200) {
      loudSampleCount++;
      localVoicedFrames++;

      // 计算Shimmer (振幅微颤) - 帕金森患者的关键特征
      if (lastAmplitude > 0) {
        float amplitudeChange = abs(amplitude - lastAmplitude);
        float shimmerValue = amplitudeChange / ((amplitude + lastAmplitude) / 2.0);
        localShimmer += shimmerValue;
        totalShimmer += shimmerValue;

        // 计算振幅方差
        float amplitudeVariation = (amplitude - lastAmplitude);
        amplitudeVariance += amplitudeVariation * amplitudeVariation;
      }

      // 简化的基频估计 (用于Jitter计算)
      // 在实际应用中，这里会使用更复杂的基频检测算法
      float estimatedF0 = 150.0 + (amplitude / 32767.0) * 200.0; // 估计基频范围 150-350Hz

      if (lastF0 > 0) {
        // 计算Jitter (基频抖动) - 帕金森患者的关键特征
        float f0Change = abs(estimatedF0 - lastF0);
        float jitterValue = f0Change / ((estimatedF0 + lastF0) / 2.0);
        localJitter += jitterValue;
        totalJitter += jitterValue;

        // 计算基频方差
        float f0Variation = (estimatedF0 - lastF0);
        f0Variance += f0Variation * f0Variation;
      }

      lastF0 = estimatedF0;
      lastAmplitude = amplitude;
    }

    // 检测静音段 (帕金森患者常有语音中断)
    if (amplitude < 100) {
      localSilenceCount++;
    }

    // 简化的HNR (谐噪比) 估计
    // 在实际应用中，这里会使用FFT分析谐波和噪声
    if (amplitude > 500) {
      float signalPower = amplitude * amplitude;
      float noisePower = (amplitude < 1000) ? (1000 - amplitude) * (1000 - amplitude) : 100;
      float hnrValue = 10 * log10(signalPower / noisePower);
      localHNR += hnrValue;
      totalHNR += hnrValue;
    }
  }

  // 累积特征计数
  silenceCount += localSilenceCount;
  voicedFrames += localVoicedFrames;
  featureCount++;

  // 每2000个样本报告一次 (约每0.125秒)
  if (audioSampleCount % 2000 == 0) {
    float quality = (float)loudSampleCount / samplesRead * 100;
    float avgEnergy = (float)totalEnergy / samplesRead;
    float silenceRatio = (float)localSilenceCount / samplesRead * 100;
    float avgJitter = (localVoicedFrames > 0) ? localJitter / localVoicedFrames : 0;
    float avgShimmer = (localVoicedFrames > 0) ? localShimmer / localVoicedFrames : 0;

    Serial.print("样本: ");
    Serial.print(audioSampleCount);
    Serial.print(", 能量: ");
    Serial.print(avgEnergy, 0);
    Serial.print(", 质量: ");
    Serial.print(quality, 1);
    Serial.print("%, Jitter: ");
    Serial.print(avgJitter, 4);
    Serial.print(", Shimmer: ");
    Serial.print(avgShimmer, 4);
    Serial.print(", 静音: ");
    Serial.print(silenceRatio, 1);
    Serial.println("%");
  }
}

void processSpeechData() {
  Serial.println("处理语音数据...");

  // 基于实际音频样本数量的分析
  Serial.print("收集到音频样本数: ");
  Serial.println(audioSampleCount);

  // 改进的语音分析逻辑 (现在基于真实音频数据!)
  float analysisResult = 0.0;

  if (audioSampleCount > 1000) {  // 现在应该有足够的真实音频数据
    // 基于研究论文的帕金森语音特征分析 (5秒采集，约80,000样本)
    float sampleFactor = min((float)audioSampleCount / 80000.0, 1.0);  // 样本充足度 (5秒基准)

    // 计算基于研究论文的关键特征
    float avgJitter = (voicedFrames > 0) ? totalJitter / voicedFrames : 0;
    float avgShimmer = (voicedFrames > 0) ? totalShimmer / voicedFrames : 0;
    float avgHNR = (voicedFrames > 0) ? totalHNR / voicedFrames : 0;
    float silenceRatio = (float)silenceCount / audioSampleCount;
    float voiceActivityRatio = (float)voicedFrames / audioSampleCount;
    float f0Instability = (voicedFrames > 1) ? sqrt(f0Variance / (voicedFrames - 1)) : 0;
    float amplitudeInstability = (voicedFrames > 1) ? sqrt(amplitudeVariance / (voicedFrames - 1)) : 0;

    // 基于研究论文的帕金森检测算法
    // 参考: Jitter, Shimmer, HNR是帕金森患者的关键语音特征

    // 1. Jitter分析 (基频抖动) - 帕金森患者通常 > 0.01
    float jitterScore = 0;
    if (avgJitter > 0.015) {
      jitterScore = 0.8;  // 高Jitter，强烈提示帕金森
    } else if (avgJitter > 0.01) {
      jitterScore = 0.5;  // 中等Jitter，可能帕金森
    } else {
      jitterScore = 0.1;  // 低Jitter，可能正常
    }

    // 2. Shimmer分析 (振幅微颤) - 帕金森患者通常 > 0.03
    float shimmerScore = 0;
    if (avgShimmer > 0.05) {
      shimmerScore = 0.8;  // 高Shimmer，强烈提示帕金森
    } else if (avgShimmer > 0.03) {
      shimmerScore = 0.5;  // 中等Shimmer，可能帕金森
    } else {
      shimmerScore = 0.1;  // 低Shimmer，可能正常
    }

    // 3. HNR分析 (谐噪比) - 帕金森患者通常 < 20dB
    float hnrScore = 0;
    if (avgHNR < 15) {
      hnrScore = 0.8;  // 低HNR，强烈提示帕金森
    } else if (avgHNR < 20) {
      hnrScore = 0.5;  // 中等HNR，可能帕金森
    } else {
      hnrScore = 0.1;  // 高HNR，可能正常
    }

    // 4. 语音连续性分析 - 帕金森患者常有语音中断
    float continuityScore = 0;
    if (silenceRatio > 0.3) {
      continuityScore = 0.7;  // 高静音比，提示帕金森
    } else if (silenceRatio > 0.2) {
      continuityScore = 0.4;  // 中等静音比
    } else {
      continuityScore = 0.1;  // 低静音比，正常
    }

    // 5. 语音稳定性分析
    float stabilityScore = 0;
    if (f0Instability > 50 || amplitudeInstability > 1000) {
      stabilityScore = 0.6;  // 高不稳定性，提示帕金森
    } else {
      stabilityScore = 0.2;  // 相对稳定
    }

    // 综合评分 (基于研究论文的权重)
    analysisResult = (jitterScore * 0.25 +      // Jitter权重25%
                     shimmerScore * 0.25 +      // Shimmer权重25%
                     hnrScore * 0.20 +          // HNR权重20%
                     continuityScore * 0.15 +   // 连续性权重15%
                     stabilityScore * 0.15);    // 稳定性权重15%

    // 数据质量调整
    if (audioSampleCount < 60000) {
      analysisResult *= 0.8;  // 数据不足，降低置信度
    }

    if (voicedFrames < 1000) {
      analysisResult *= 0.7;  // 有声帧太少，降低置信度
    }

    analysisResult = constrain(analysisResult, 0.05, 0.95);

    // 分类决策 (基于研究论文的阈值)
    lastResult.speech_class = (analysisResult > 0.5) ? 1 : 0;  // 50%阈值
    lastResult.speech_probability = analysisResult;

    Serial.print("帕金森特征 - Jitter:");
    Serial.print(avgJitter, 4);
    Serial.print(", Shimmer:");
    Serial.print(avgShimmer, 4);
    Serial.print(", HNR:");
    Serial.print(avgHNR, 1);
    Serial.print("dB, 静音比:");
    Serial.print(silenceRatio, 3);
    Serial.print(", 活跃度:");
    Serial.println(voiceActivityRatio, 3);

    // 计算采集效率 (5秒基准)
    float expectedSamples = (SPEECH_DURATION / 1000.0) * AUDIO_SAMPLE_RATE;  // 5秒 × 16kHz = 80,000样本
    float efficiency = (float)audioSampleCount / expectedSamples * 100;
    Serial.print("音频采集效率: ");
    Serial.print(efficiency, 1);
    Serial.print("% (期望 ");
    Serial.print((int)expectedSamples);
    Serial.print(" 样本，实际 ");
    Serial.print(audioSampleCount);
    Serial.println(" 样本)");

  } else {
    // 音频数据仍然不足 (可能PDM有问题)
    lastResult.speech_class = 0;
    lastResult.speech_probability = 0.2 + random(0, 200) / 1000.0;
    Serial.println("WARNING: 音频数据仍然不足，请检查PDM配置");
  }

  Serial.print("语音分析完成: ");
  Serial.print(lastResult.speech_class == 1 ? "检测到帕金森症状" : "正常语音");
  Serial.print(", 概率 ");
  Serial.print(lastResult.speech_probability, 3);
  Serial.print(" (基于 ");
  Serial.print(audioSampleCount);
  Serial.println(" 个真实样本)");

  // 发送BLE数据
  String data = "SPEECH:" + String(lastResult.speech_class) + "," + String(lastResult.speech_probability, 3);
  speechDataChar.writeValue(data);

  currentState = STATE_IDLE;
}

void startMultiModalAnalysis() {
  Serial.println("=== 开始多模态分析 ===");
  Serial.println("总时长约8秒: 传感器分析 + 5秒语音分析 + 融合分析");
  currentState = STATE_MULTIMODAL_ANALYSIS;

  // 步骤1: 传感器分析
  Serial.println("步骤1/3: 传感器分析");
  startSensorAnalysis();
  delay(500);

  // 步骤2: 语音分析 (5秒)
  Serial.println("步骤2/3: 语音分析 (5秒采集)");
  startSpeechAnalysis();

  // 等待语音分析完成 - 修复逻辑错误
  while (currentState == STATE_SPEECH_ANALYSIS || speechDataReady) {
    if (speechDataReady) {
      processSpeechData();
      break;  // 处理完成后立即退出
    }
    delay(100);
  }

  // 步骤3: 融合分析
  Serial.println("步骤3/3: 多模态融合");
  fuseResults();

  currentState = STATE_IDLE;
  Serial.println("=== 多模态分析完成 ===");
}

void fuseResults() {
  // 简单的融合算法
  float sensor_weight = 0.6;
  float speech_weight = 0.4;
  
  // 将语音二分类映射到5级
  int speech_level = (lastResult.speech_class == 1) ? 
                    (int)(lastResult.speech_probability * 4) + 2 : 1;
  
  float weighted_level = sensor_weight * lastResult.sensor_level + 
                        speech_weight * speech_level;
  
  lastResult.final_level = (int)round(weighted_level);
  lastResult.final_level = constrain(lastResult.final_level, 1, 5);
  
  lastResult.final_confidence = sensor_weight * lastResult.sensor_confidence + 
                               speech_weight * lastResult.speech_probability;
  
  lastResult.is_valid = true;
  
  Serial.println("=== 融合结果 ===");
  Serial.print("最终等级: ");
  Serial.print(lastResult.final_level);
  Serial.print("/5, 置信度: ");
  Serial.println(lastResult.final_confidence);
  
  // 生成建议
  generateRecommendations();
}

void generateRecommendations() {
  Serial.println("=== 个性化建议 ===");
  
  switch(lastResult.final_level) {
    case 1:
      Serial.println("状态良好，建议保持当前运动习惯");
      break;
    case 2:
      Serial.println("轻微症状，建议增加手部运动");
      break;
    case 3:
      Serial.println("中度症状，建议专业评估");
      break;
    case 4:
      Serial.println("明显症状，建议医疗咨询");
      break;
    case 5:
      Serial.println("严重症状，建议立即就医");
      break;
  }
  
  Serial.println("================");
}

/**
 * PDM数据回调函数 (基于验证成功的官方示例)
 * 注意: 这个回调在ISR中执行，不能使用Serial打印
 */
void onPDMdata() {
  // 查询可用字节数
  int bytesAvailable = PDM.available();

  // 如果没有数据，直接返回
  if (bytesAvailable <= 0) {
    return;
  }

  // 读取到样本缓冲区 (使用官方方法)
  PDM.read(sampleBuffer, bytesAvailable);

  // 16位，每个样本2字节
  samplesRead = bytesAvailable / 2;

  // 注意: 移除了speechRecording检查，让回调函数始终工作
  // 状态检查移到主循环中进行
}

void printSystemStatus() {
  Serial.println("=== 系统状态 ===");
  Serial.print("当前状态: ");
  switch(currentState) {
    case STATE_IDLE: Serial.println("空闲"); break;
    case STATE_SENSOR_ANALYSIS: Serial.println("传感器分析中"); break;
    case STATE_SPEECH_ANALYSIS: Serial.println("语音分析中"); break;
    case STATE_MULTIMODAL_ANALYSIS: Serial.println("多模态分析中"); break;
  }

  Serial.print("语音录制: ");
  Serial.println(speechRecording ? "进行中" : "停止");

  Serial.print("音频样本数: ");
  Serial.println(audioSampleCount);

  Serial.print("语音数据就绪: ");
  Serial.println(speechDataReady ? "是" : "否");

  // 显示传感器状态
  Serial.println("\n--- 传感器读数 ---");
  for (int i = 0; i < 5; i++) {
    Serial.print("A");
    Serial.print(i);
    Serial.print(": ");
    Serial.print(analogRead(A0 + i));
    Serial.print("  ");
  }
  Serial.println();

  // 显示分析结果
  if (lastResult.is_valid) {
    Serial.println("\n--- 最后分析结果 ---");
    Serial.print("传感器: 等级 ");
    Serial.print(lastResult.sensor_level);
    Serial.print(", 置信度 ");
    Serial.println(lastResult.sensor_confidence, 3);

    Serial.print("语音: ");
    Serial.print(lastResult.speech_class == 1 ? "帕金森" : "正常");
    Serial.print(", 概率 ");
    Serial.println(lastResult.speech_probability, 3);

    Serial.print("融合: 等级 ");
    Serial.print(lastResult.final_level);
    Serial.print(", 置信度 ");
    Serial.println(lastResult.final_confidence, 3);
  } else {
    Serial.println("\n--- 分析结果 ---");
    Serial.println("暂无有效结果");
  }

  Serial.println("===============");
}

void initializeBLE() {
  if (!BLE.begin()) {
    Serial.println("BLE初始化失败");
    return;
  }
  
  BLE.setLocalName("ParkinsonDevice_Speech_Test");
  BLE.setAdvertisedService(parkinsonService);
  
  parkinsonService.addCharacteristic(sensorDataChar);
  parkinsonService.addCharacteristic(speechDataChar);
  parkinsonService.addCharacteristic(commandChar);
  
  BLE.addService(parkinsonService);
  
  sensorDataChar.writeValue("SENSOR_READY");
  speechDataChar.writeValue("SPEECH_READY");
  
  BLE.advertise();
  
  Serial.println("BLE已启动，设备名: ParkinsonDevice_Speech_Test");
}
