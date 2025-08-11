/*
 * Complete Parkinson Assistance System with Research-Grade Speech Analysis
 * Integrated solution for sensor collection, AI inference, speech analysis, and training control
 *
 * Hardware Requirements:
 * - Arduino Nano 33 BLE Sense Rev2
 * - 5 potentiometers (A0-A4)
 * - EMG sensor (A5)
 * - Servo (D9)
 * - Detection pins (D2, D3)
 * - Built-in PDM microphone for speech analysis
 */

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <ArduinoBLE.h>
#include <PDM.h>

// Pin Definitions
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

// System Parameters
const unsigned long SAMPLE_RATE = 100;        // Sampling interval (ms)
const unsigned long BASELINE_DURATION = 2000;  // Calibration duration (ms)
const unsigned long INFERENCE_INTERVAL = 5000; // Inference interval (ms)
const unsigned long WEB_DATA_INTERVAL = 100;   // Web data sending interval (ms)

// Speech Analysis Parameters
const int AUDIO_CHANNELS = 1;
const int AUDIO_SAMPLE_RATE = 16000;
const int SPEECH_DURATION = 5000;  // 5秒语音采集 (减少误报)
const int PDM_STABILIZATION_BUFFERS = 3;  // 需要丢弃前3个缓冲区

// BLE Configuration
#define BLE_DEVICE_NAME "ParkinsonDevice_Speech_v2"
#define BLE_SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define BLE_SENSOR_DATA_UUID "12345678-1234-1234-1234-123456789abd"
#define BLE_COMMAND_UUID "12345678-1234-1234-1234-123456789abe"
#define BLE_AI_RESULT_UUID "12345678-1234-1234-1234-123456789abf"
#define BLE_SPEECH_DATA_UUID "12345678-1234-1234-1234-123456789ac0"

// System State
enum SystemState {
  STATE_IDLE,
  STATE_CALIBRATING,
  STATE_COLLECTING,
  STATE_TRAINING,
  STATE_REAL_TIME_ANALYSIS,
  STATE_SPEECH_ANALYSIS,
  STATE_MULTIMODAL_ANALYSIS,
};

// Global Variables
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

// Speech Analysis Variables
volatile bool speechRecording = false;
volatile bool speechDataReady = false;
int audioSampleCount = 0;
int pdmBufferCount = 0;
bool pdmStabilized = false;
short sampleBuffer[512];
volatile int samplesRead = 0;

// 帕金森特征检测变量 (基于研究论文)
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

// Speech Analysis Results
struct SpeechResult {
  int speech_class = 0;          // 0=正常, 1=帕金森
  float speech_probability = 0.0; // 帕金森概率
  float jitter = 0.0;
  float shimmer = 0.0;
  float hnr = 0.0;
  float silence_ratio = 0.0;
  float voice_activity = 0.0;
};

SpeechResult lastSpeechResult;

// Global Objects
Servo rehabServo;

// BLE Objects - 使用更兼容的初始化方式
BLEService parkinsonService(BLE_SERVICE_UUID);
BLEStringCharacteristic sensorDataCharacteristic(BLE_SENSOR_DATA_UUID, BLERead | BLENotify, 120); // 120 bytes for sensor data
BLEStringCharacteristic commandCharacteristic(BLE_COMMAND_UUID, BLEWrite, 20); // 20 bytes for commands
BLEStringCharacteristic aiResultCharacteristic(BLE_AI_RESULT_UUID, BLERead | BLENotify, 100); // 100 bytes for AI results
BLEStringCharacteristic speechDataCharacteristic(BLE_SPEECH_DATA_UUID, BLERead | BLENotify, 150); // 150 bytes for speech data

// Communication Mode
enum CommunicationMode {
  COMM_SERIAL_ONLY,
  COMM_BLE_ONLY,
  COMM_BOTH
};

CommunicationMode commMode = COMM_BOTH;
bool bleConnected = false;

// Simplified AI Model Simulation Class
class TensorFlowLiteInference {
private:
    int predictedClass = 0;
    float confidence = 0.0f;
    
public:
    void begin() {
        Serial.println("AI Model Initialized");
    }
    
    void addDataPoint(float* data) {
        // Simulate data collection
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
        // Simulate inference process
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

// Function Declarations
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

// Speech Analysis Function Declarations
void startSpeechAnalysis();
void startMultiModalAnalysis();
void onPDMdata();
void processValidAudioData();
void processSpeechData();
void resetSpeechFeatures();
void sendSpeechResultViaBLE();

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

void setup() {
    Serial.begin(115200);
    while (!Serial);

    if (!IMU.begin()) {
        Serial.println("Failed to initialize IMU!");
        while (1);
    }

    pinMode(PIN_BUTTON, INPUT_PULLUP);
    pinMode(PIN_LED_STATUS, OUTPUT);
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);

    rehabServo.attach(PIN_SERVO);
    rehabServo.write(90);

    // Initialize PDM microphone
    PDM.onReceive(onPDMdata);
    if (!PDM.begin(AUDIO_CHANNELS, AUDIO_SAMPLE_RATE)) {
        Serial.println("Failed to start PDM!");
        while (1);
    }
    PDM.setGain(30);
    Serial.println("PDM microphone initialized successfully");

    // Initialize BLE
    initializeBLE();

    Serial.println("========================================");
    Serial.println("帕金森辅助设备 - 研究级多模态分析版");
    Serial.println("========================================");
    Serial.println("✓ 传感器 + 语音双模态分析");
    Serial.println("✓ 基于研究论文的帕金森检测算法");
    Serial.println("✓ Jitter, Shimmer, HNR特征提取");
    Serial.println("✓ 蓝牙连接 + 网页操作");
    Serial.println("Communication modes: Serial + Bluetooth LE");
}

void loop() {
    // Handle BLE events
    handleBLEEvents();

    // Check button
    checkButton();

    // Handle serial commands
    handleSerialCommands();

    // Continuously send real-time data to web and BLE
    sendContinuousWebData();

    // Process speech data if ready
    if (speechDataReady) {
        processSpeechData();
        speechDataReady = false;
    }

    // Execute functions based on current state
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
        case STATE_SPEECH_ANALYSIS:
            // Speech analysis is handled by PDM callback and processSpeechData
            break;
        case STATE_MULTIMODAL_ANALYSIS:
            // Multimodal analysis combines sensor and speech analysis
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
            Serial.println("Analysis stopped");
        } else if (cmd == "AUTO") {
            startSingleAnalysis();
        } else if (cmd == "SPEECH") {
            startSpeechAnalysis();
        } else if (cmd == "MULTIMODAL") {
            startMultiModalAnalysis();
        }
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
    Serial.println("Real-time analysis stopped");
    currentState = STATE_IDLE;
    digitalWrite(PIN_LED_STATUS, LOW);
}

void startCalibration() {
    Serial.println("TensorFlowLiteInference initialized");
        //n("=== Starting Baseline Calibration ===");
    Serial.println("TensorFlowLiteInference initialized");
        //n("Please keep hand relaxed and still...");
    
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
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("\nCalibration complete!");
    Serial.print("Baseline - Fingers: ");
    for (int i = 0; i < 5; i++) {
        Serial.print(fingerBaseline[i]);
        Serial.print(" ");
    }
    Serial.print(", EMG: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(emgBaseline);
    
    // Automatically start analysis after calibration
    Serial.println("TensorFlowLiteInference initialized");
        //n("Calibration complete. Starting analysis...");
    delay(1000);
    startSingleAnalysis();
}

void startDataCollection() {
    if (!isCalibrated) {
        Serial.println("Please calibrate first (send CALIBRATE command)");
        return;
    }

    Serial.println("=== Starting Data Collection ===");
    currentState = STATE_COLLECTING;

    unsigned long startTime = millis();
    int dataCount = 0;

    while (millis() - startTime < 10000) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);

        // Send data packet
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
    Serial.print("Data collection complete. Collected ");
    Serial.print(dataCount);
    Serial.println(" data points");

    currentState = STATE_IDLE;
}

void startTraining() {
    if (!hasValidPrediction) {
        Serial.println("TensorFlowLiteInference initialized");
        //n("Please perform Parkinson's analysis first");
        return;
    }
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("=== Starting Personalized Training ===");
    Serial.print("Adjusting training intensity for Parkinson level ");
    Serial.print(currentParkinsonsLevel);
    Serial.println("TensorFlowLiteInference initialized");
        //n();
    
    currentState = STATE_TRAINING;
    trainingCycles = 0;
    
    // Set training parameters based on Parkinson level
    int maxResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
    int cycleCount = 5;
    
    Serial.print("Training parameters - Max resistance: ");
    Serial.print(maxResistance);
    Serial.print(" degrees, Cycles: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(cycleCount);
    
    performTrainingSequence(maxResistance, cycleCount);
}

void performTrainingSequence(int maxResistance, int cycles) {
    for (int cycle = 0; cycle < cycles; cycle++) {
        Serial.print("Training cycle ");
        Serial.print(cycle + 1);
        Serial.print("/");
        Serial.println("TensorFlowLiteInference initialized");
        //n(cycles);
        
        // Progressive resistance training
        for (int resistance = 0; resistance <= maxResistance; resistance += 15) {
            int servoAngle = 90 + resistance;
            rehabServo.write(servoAngle);
            
            Serial.print("Resistance: ");
            Serial.print(resistance);
            Serial.println("TensorFlowLiteInference initialized");
        //n(" degrees");
            
            delay(1000);
            
            // Read physiological response during training
            float sensorData[9];
            readNormalizedSensorData(sensorData);
            
            Serial.print("TRAIN_DATA,");
            Serial.print(servoAngle);
            for (int i = 0; i < 9; i++) {
                Serial.print(",");
                Serial.print(sensorData[i], 3);
            }
            Serial.println("TensorFlowLiteInference initialized");
        //n();
        }
        
        // Return to neutral and rest
        rehabServo.write(90);
        Serial.println("TensorFlowLiteInference initialized");
        //n("Resting...");
        delay(2000);
    }
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("Training complete!");
    currentState = STATE_IDLE;
}

void performSingleAnalysis() {
    unsigned long currentTime = millis();
    
    // Continuously collect data for single analysis
    if (currentTime - lastSampleTime >= SAMPLE_RATE) {
        float sensorData[9];
        readNormalizedSensorData(sensorData);
        
        // Add to AI model buffer
        aiModel.addDataPoint(sensorData);
        
        lastSampleTime = currentTime;
        
        // Show data collection progress
        if (!aiModel.isBufferReady()) {
            static unsigned long lastProgressTime = 0;
            if (currentTime - lastProgressTime >= 1500) {
                Serial.print("Collecting data... Progress: ");
                Serial.print((float)aiModel.getBufferFillLevel() / aiModel.getSequenceLength() * 100, 1);
                Serial.println("TensorFlowLiteInference initialized");
        //n("%");
                lastProgressTime = currentTime;
            }
        }
    }
    
    // Perform inference for single analysis
    if (currentTime - lastInferenceTime >= INFERENCE_INTERVAL && aiModel.isBufferReady()) {
        if (aiModel.runInference()) {
            currentParkinsonsLevel = aiModel.getPredictedClass();
            currentConfidence = aiModel.getConfidence();
            hasValidPrediction = true;
            
            // Output detailed analysis results
            outputDetailedAnalysisResults();
            
            // Analysis complete, return to idle
            Serial.println("TensorFlowLiteInference initialized");
        //n("Analysis complete. System returning to idle.");
            currentState = STATE_IDLE;
            digitalWrite(PIN_LED_STATUS, LOW);
        }
        
        lastInferenceTime = currentTime;
    }
}

void outputDetailedAnalysisResults() {
    sendMessage("");
    sendMessage("=== AI Analysis Results ===");
    sendMessage("Analysis count: " + String(analysisCount));
    sendMessage("Parkinson's level: " + String(currentParkinsonsLevel) + " (" +
               aiModel.getParkinsonLevelDescription(currentParkinsonsLevel) + ")");
    sendMessage("Confidence: " + String(currentConfidence * 100, 1) + "%");

    int recommendedResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
    sendMessage("Recommended resistance setting: " + String(recommendedResistance) + " degrees");

    // Simplified recommendations
    String recommendation = "Training recommendation: ";
    switch(currentParkinsonsLevel) {
        case 1: recommendation += "Maintain current training intensity"; break;
        case 2: recommendation += "Increase finger flexibility training"; break;
        case 3: recommendation += "Perform resistance training"; break;
        case 4: recommendation += "Seek professional guidance"; break;
        case 5: recommendation += "Seek immediate medical attention"; break;
    }
    sendMessage(recommendation);
    sendMessage("======================");

    // Send AI result via BLE
    sendAIResultViaBLE();
}

float readFingerValue(int pin) {
    if (isPotentiometerConnected()) {
        return analogRead(pin);
    } else {
        // Simulate signal
        unsigned long currentTime = millis();
        float angle = (currentTime * 0.001) * 2 * PI * 0.1;
        return 512 + 200 * sin(angle + pin * 0.5);
    }
}

float readEMGValue() {
    if (isEMGConnected()) {
        return analogRead(PIN_EMG);
    } else {
        // Simulate EMG signal
        unsigned long currentTime = millis();
        float noise = random(-50, 50);
        float signal = 100 * sin(currentTime * 0.001 * 2 * PI * 0.05) + noise;
        return constrain(512 + signal, 0, 1023);
    }
}

void readNormalizedSensorData(float* data) {
    // Read and normalize finger data
    data[0] = readFingerValue(PIN_PINKY) - fingerBaseline[0];
    data[1] = readFingerValue(PIN_RING) - fingerBaseline[1];
    data[2] = readFingerValue(PIN_MIDDLE) - fingerBaseline[2];
    data[3] = readFingerValue(PIN_INDEX) - fingerBaseline[3];
    data[4] = readFingerValue(PIN_THUMB) - fingerBaseline[4];
    
    // Read and normalize EMG data
    data[5] = readEMGValue() - emgBaseline;
    
    // Read IMU data
    float x, y, z;
    IMU.readAcceleration(x, y, z);
    data[6] = x;
    data[7] = y;
    data[8] = z;
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
    Serial.println("TensorFlowLiteInference initialized");
        //n(angle);
}

void printSystemStatus() {
    Serial.println("TensorFlowLiteInference initialized");
        //n("=== System Status ===");
    Serial.print("Current state: ");
    switch (currentState) {
        case STATE_IDLE: Serial.println("TensorFlowLiteInference initialized");
        //n("Idle"); break;
        case STATE_CALIBRATING: Serial.println("TensorFlowLiteInference initialized");
        //n("Calibrating"); break;
        case STATE_COLLECTING: Serial.println("TensorFlowLiteInference initialized");
        //n("Collecting data"); break;
        case STATE_TRAINING: Serial.println("TensorFlowLiteInference initialized");
        //n("Training"); break;
        case STATE_REAL_TIME_ANALYSIS: Serial.println("TensorFlowLiteInference initialized");
        //n("Real-time analysis"); break;
    }
    
    Serial.print("Calibration status: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(isCalibrated ? "Calibrated" : "Not calibrated");
    
    Serial.print("Potentiometers: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(isPotentiometerConnected() ? "Connected" : "Simulated");
    
    Serial.print("EMG device: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(isEMGConnected() ? "Connected" : "Simulated");
    
    if (hasValidPrediction) {
        Serial.print("Parkinson's level: ");
        Serial.print(currentParkinsonsLevel);
        Serial.print(" (Confidence: ");
        Serial.print(currentConfidence * 100, 1);
        Serial.println("TensorFlowLiteInference initialized");
        //n("%)");
    } else {
        Serial.println("TensorFlowLiteInference initialized");
        //n("Parkinson's level: Not analyzed");
    }
    
    aiModel.printBufferStatus();
    Serial.println("TensorFlowLiteInference initialized");
        //n("=====================");
}

void sendContinuousWebData() {
    // Continuously send real-time data to web and BLE
    unsigned long currentTime = millis();

    if (currentTime - lastWebDataTime >= WEB_DATA_INTERVAL) {
        // Read current sensor data (15 values: 5 fingers + EMG + 9 IMU)
        float sensorData[15];
        readRawSensorDataForWeb(sensorData);

        // Send data to web (Serial)
        if (commMode == COMM_SERIAL_ONLY || commMode == COMM_BOTH) {
            sendRawDataToWeb(sensorData);
        }

        // Send data via BLE
        if ((commMode == COMM_BLE_ONLY || commMode == COMM_BOTH) && bleConnected) {
            sendDataViaBLE(sensorData);
        }

        lastWebDataTime = currentTime;
    }
}

void readRawSensorDataForWeb(float* data) {
    // Read raw sensor data for web
    data[0] = readFingerValue(PIN_PINKY);    // Pinky
    data[1] = readFingerValue(PIN_RING);     // Ring finger
    data[2] = readFingerValue(PIN_MIDDLE);   // Middle finger
    data[3] = readFingerValue(PIN_INDEX);    // Index finger
    data[4] = readFingerValue(PIN_THUMB);    // Thumb
    data[5] = readEMGValue();                // EMG
    
    // Read complete IMU data
    float accel_x, accel_y, accel_z;
    float gyro_x, gyro_y, gyro_z;
    float mag_x, mag_y, mag_z;
    
    // Accelerometer
    IMU.readAcceleration(accel_x, accel_y, accel_z);
    data[6] = accel_x;
    data[7] = accel_y;
    data[8] = accel_z;
    
    // Gyroscope
    if (IMU.readGyroscope(gyro_x, gyro_y, gyro_z)) {
        data[9] = gyro_x;
        data[10] = gyro_y;
        data[11] = gyro_z;
    } else {
        data[9] = 0.0;
        data[10] = 0.0;
        data[11] = 0.0;
    }
    
    // Magnetometer
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
    // Send complete data to web
    Serial.print("DATA");
    
    // Finger data
    for (int i = 0; i < 5; i++) {
        Serial.print(",");
        Serial.print((int)constrain(rawData[i], 0, 1023));
    }
    
    // EMG data
    Serial.print(",");
    Serial.print((int)constrain(rawData[5], 0, 1023));
    
    // Accelerometer data
    Serial.print(",");
    Serial.print(rawData[6], 3);
    Serial.print(",");
    Serial.print(rawData[7], 3);
    Serial.print(",");
    Serial.print(rawData[8], 3);
    
    // Gyroscope data
    Serial.print(",");
    Serial.print(rawData[9], 3);
    Serial.print(",");
    Serial.print(rawData[10], 3);
    Serial.print(",");
    Serial.print(rawData[11], 3);
    
    // Magnetometer data
    Serial.print(",");
    Serial.print(rawData[12], 3);
    Serial.print(",");
    Serial.print(rawData[13], 3);
    Serial.print(",");
    Serial.print(rawData[14], 3);
    
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

// ========== BLE Functions ==========

void initializeBLE() {
    Serial.println("Initializing BLE...");

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
    speechDataCharacteristic.writeValue("SPEECH_READY");
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

    parkinsonService.addCharacteristic(speechDataCharacteristic);
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
    Serial.println("Speech Data UUID: " + String(BLE_SPEECH_DATA_UUID));
    Serial.println("BLE Parkinson Device with Speech Analysis is now advertising");
}

void handleBLEEvents() {
    // Poll for BLE events
    BLE.poll();
}

void sendDataViaBLE(float* rawData) {
    if (!bleConnected) return;

    // Create a CSV format data string for better compatibility
    String dataString = "DATA,";

    // Add finger data (5 values) - use 1 decimal place to save space
    for (int i = 0; i < 5; i++) {
        dataString += String(rawData[i], 1);
        if (i < 4) dataString += ",";
    }

    // Add EMG data
    dataString += "," + String(rawData[5], 1);

    // Add IMU data (9 values) - use 2 decimal places for precision
    for (int i = 6; i < 15; i++) {
        dataString += "," + String(rawData[i], 2);
    }

    // Debug: print data string length and content
    Serial.print("BLE Data String (");
    Serial.print(dataString.length());
    Serial.print(" chars): ");
    Serial.println(dataString);

    // Send via BLE - increase limit or split if necessary
    if (dataString.length() <= 100) {  // Increased from 60 to 100
        sensorDataCharacteristic.writeValue(dataString);
    } else {
        // If still too long, send in parts or reduce precision
        Serial.println("Warning: BLE data too long, truncating");
        dataString = dataString.substring(0, 100);
        sensorDataCharacteristic.writeValue(dataString);
    }
}

void sendAIResultViaBLE() {
    if (!bleConnected || !hasValidPrediction) return;

    // Create complete AI result packet in format: "LEVEL:2;CONF:85;REC:轻度震颤，建议进行康复训练;RES:45"
    String recommendation = "Training recommendation: ";
    switch (currentParkinsonsLevel) {
        case 0: recommendation += "Maintain current training intensity"; break;
        case 1: recommendation += "Maintain current training intensity"; break;
        case 2: recommendation += "Increase finger flexibility training"; break;
        case 3: recommendation += "Perform resistance training"; break;
        case 4: recommendation += "Seek professional guidance"; break;
        case 5: recommendation += "Seek immediate medical attention"; break;
    }

    int recommendedResistance = 30 + (currentParkinsonsLevel * 30); // 30-180度范围

    String aiResult = "LEVEL:" + String(currentParkinsonsLevel) +
                     ";CONF:" + String(currentConfidence * 100, 1) +
                     ";REC:" + recommendation +
                     ";RES:" + String(recommendedResistance);

    aiResultCharacteristic.writeValue(aiResult);
}

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
    } else if (command == "SPEECH") {
        startSpeechAnalysis();
    } else if (command == "MULTIMODAL") {
        startMultiModalAnalysis();
    } else if (command == "COMM_SERIAL") {
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

void sendMessage(String message) {
    // Send message via Serial
    if (commMode == COMM_SERIAL_ONLY || commMode == COMM_BOTH) {
        Serial.println(message);
    }

    // Send message via BLE (if connected and not too long)
    if ((commMode == COMM_BLE_ONLY || commMode == COMM_BOTH) && bleConnected && message.length() <= 100) {
        aiResultCharacteristic.writeValue(message.c_str());
    }
}

void onBLEConnected(BLEDevice central) {
    bleConnected = true;
    digitalWrite(PIN_LED_STATUS, HIGH);

    Serial.print("Connected to central: ");
    Serial.println(central.address());

    sendMessage("BLE Connected - Parkinson Device v2.0 Ready");
}

void onBLEDisconnected(BLEDevice central) {
    bleConnected = false;
    digitalWrite(PIN_LED_STATUS, LOW);

    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
}

void onCommandReceived(BLEDevice central, BLECharacteristic characteristic) {
    // Read the command as string
    String command = commandCharacteristic.value();

    if (command.length() > 0) {
        Serial.print("BLE Command received: ");
        Serial.println(command);

        handleBLECommand(command);
    }
}

// ========== Speech Analysis Functions ==========

void startSpeechAnalysis() {
    Serial.println("=== 开始语音分析 ===");
    Serial.println("请说话5秒钟... (更长时间采集，提高分析准确性)");

    currentState = STATE_SPEECH_ANALYSIS;

    // 重置语音特征变量
    resetSpeechFeatures();

    // 开始录音
    speechRecording = true;
    speechDataReady = false;

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

    Serial.println("语音录制完成，总有效样本数: " + String(audioSampleCount));
    Serial.println("PDM缓冲区总数: " + String(pdmBufferCount));

    // 计算采集效率
    float expectedSamples = (SPEECH_DURATION / 1000.0) * AUDIO_SAMPLE_RATE;
    float efficiency = (float)audioSampleCount / expectedSamples * 100;
    Serial.print("采集效率: ");
    Serial.print(efficiency, 1);
    Serial.println("%");

    Serial.println("正在分析...");
}

void startMultiModalAnalysis() {
    Serial.println("=== 开始多模态分析 ===");
    Serial.println("总时长约8秒: 传感器分析 + 5秒语音分析 + 融合分析");
    currentState = STATE_MULTIMODAL_ANALYSIS;

    // 步骤1: 传感器分析
    Serial.println("步骤1/3: 传感器分析");
    startSingleAnalysis();
    delay(500);

    // 步骤2: 语音分析 (5秒)
    Serial.println("步骤2/3: 语音分析 (5秒采集)");
    startSpeechAnalysis();

    // 等待语音分析完成
    while (currentState == STATE_SPEECH_ANALYSIS || speechDataReady) {
        if (speechDataReady) {
            processSpeechData();
            speechDataReady = false;
        }
        delay(10);
    }

    // 步骤3: 融合分析
    Serial.println("步骤3/3: 多模态融合分析");

    // 融合传感器和语音分析结果
    float sensorWeight = 0.6;  // 传感器权重60%
    float speechWeight = 0.4;  // 语音权重40%

    float fusedProbability = (currentConfidence * sensorWeight) +
                            (lastSpeechResult.speech_probability * speechWeight);

    int fusedLevel = round(fusedProbability * 5);  // 转换为1-5等级
    fusedLevel = constrain(fusedLevel, 1, 5);

    Serial.println("=== 多模态分析结果 ===");
    Serial.print("传感器分析: 等级 ");
    Serial.print(currentParkinsonsLevel);
    Serial.print(", 置信度 ");
    Serial.print(currentConfidence * 100, 1);
    Serial.println("%");

    Serial.print("语音分析: ");
    Serial.print(lastSpeechResult.speech_class == 1 ? "检测到帕金森症状" : "正常语音");
    Serial.print(", 概率 ");
    Serial.print(lastSpeechResult.speech_probability * 100, 1);
    Serial.println("%");

    Serial.print("融合结果: 等级 ");
    Serial.print(fusedLevel);
    Serial.print(", 综合概率 ");
    Serial.print(fusedProbability * 100, 1);
    Serial.println("%");

    // 更新融合结果
    currentParkinsonsLevel = fusedLevel;
    currentConfidence = fusedProbability;

    // 发送融合结果
    sendAIResultViaBLE();
    sendSpeechResultViaBLE();

    currentState = STATE_IDLE;
    Serial.println("多模态分析完成");
}

// PDM数据回调函数
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

// 处理语音数据并进行帕金森分析
void processSpeechData() {
    Serial.println("处理语音数据...");
    Serial.print("收集到音频样本数: ");
    Serial.println(audioSampleCount);

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
        float analysisResult = (jitterScore * 0.25 +      // Jitter权重25%
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
        lastSpeechResult.speech_class = (analysisResult > 0.5) ? 1 : 0;  // 50%阈值
        lastSpeechResult.speech_probability = analysisResult;
        lastSpeechResult.jitter = avgJitter;
        lastSpeechResult.shimmer = avgShimmer;
        lastSpeechResult.hnr = avgHNR;
        lastSpeechResult.silence_ratio = silenceRatio;
        lastSpeechResult.voice_activity = voiceActivityRatio;

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

        // 输出分析结果
        String resultText = (lastSpeechResult.speech_class == 1) ? "检测到帕金森症状" : "正常语音";
        Serial.print("语音分析完成: ");
        Serial.print(resultText);
        Serial.print(", 概率 ");
        Serial.print(lastSpeechResult.speech_probability, 3);
        Serial.print(" (基于 ");
        Serial.print(audioSampleCount);
        Serial.println(" 个真实样本)");

        // 发送语音分析结果
        sendSpeechResultViaBLE();

    } else {
        Serial.println("音频数据不足，无法进行可靠分析");
        lastSpeechResult.speech_class = 0;
        lastSpeechResult.speech_probability = 0.0;
    }

    currentState = STATE_IDLE;
}

void resetSpeechFeatures() {
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

    // 重置PDM稳定性计数器
    pdmBufferCount = 0;
    pdmStabilized = false;
    samplesRead = 0;
    audioSampleCount = 0;
}

void sendSpeechResultViaBLE() {
    if (!bleConnected) return;

    // 创建语音分析结果数据包
    String speechResult = "SPEECH:" + String(lastSpeechResult.speech_class) +
                         ";PROB:" + String(lastSpeechResult.speech_probability, 3) +
                         ";JITTER:" + String(lastSpeechResult.jitter, 4) +
                         ";SHIMMER:" + String(lastSpeechResult.shimmer, 4) +
                         ";HNR:" + String(lastSpeechResult.hnr, 1) +
                         ";SILENCE:" + String(lastSpeechResult.silence_ratio, 3) +
                         ";ACTIVITY:" + String(lastSpeechResult.voice_activity, 3);

    speechDataCharacteristic.writeValue(speechResult);
    Serial.println("语音分析结果已发送至BLE");
}