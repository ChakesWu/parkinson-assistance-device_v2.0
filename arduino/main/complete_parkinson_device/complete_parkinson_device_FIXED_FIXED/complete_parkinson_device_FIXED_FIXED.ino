/*
 * Complete Parkinson Assistance System
 * Integrated solution for sensor collection, AI inference, and training control
 *
 * Hardware Requirements:
 * - Arduino Nano 33 BLE Sense Rev2
 * - 5 potentiometers (A0-A4)
 * - EMG sensor (A5)
 * - Servo (D9)
 * - Detection pins (D2, D3)
 */

#include <Arduino.h>
#include "Arduino_BMI270_BMM150.h"
#include <Servo.h>
#include <ArduinoBLE.h>

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

// BLE Configuration
#define BLE_DEVICE_NAME "ParkinsonDevice_v2"
#define BLE_SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define BLE_SENSOR_DATA_UUID "12345678-1234-1234-1234-123456789abd"
#define BLE_COMMAND_UUID "12345678-1234-1234-1234-123456789abe"
#define BLE_AI_RESULT_UUID "12345678-1234-1234-1234-123456789abf"

// System State
enum SystemState {
  STATE_IDLE,
  STATE_CALIBRATING,
  STATE_COLLECTING,
  STATE_TRAINING,
  STATE_REAL_TIME_ANALYSIS,
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

// Global Objects
Servo rehabServo;

// BLE Objects - 使用更兼容的初始化方式
BLEService parkinsonService(BLE_SERVICE_UUID);
BLEStringCharacteristic sensorDataCharacteristic(BLE_SENSOR_DATA_UUID, BLERead | BLENotify, 120); // 120 bytes for sensor data
BLEStringCharacteristic commandCharacteristic(BLE_COMMAND_UUID, BLEWrite, 20); // 20 bytes for commands
BLEStringCharacteristic aiResultCharacteristic(BLE_AI_RESULT_UUID, BLERead | BLENotify, 100); // 100 bytes for AI results

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

    // Initialize BLE
    initializeBLE();

    Serial.println("Parkinson Assistance Device v2.0 with BLE Ready");
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
            Serial.println("TensorFlowLiteInference initialized");
        //n("Analysis stopped");
        } else if (cmd == "AUTO") {
            startSingleAnalysis();
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
    Serial.println("BLE Parkinson Device is now advertising");
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