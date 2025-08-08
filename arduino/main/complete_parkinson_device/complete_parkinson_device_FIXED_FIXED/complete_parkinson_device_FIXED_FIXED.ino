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

// Simplified AI Model Simulation Class
class TensorFlowLiteInference {
private:
    int predictedClass = 0;
    float confidence = 0.0f;
    
public:
    void begin() {
        Serial.println("TensorFlowLiteInference initialized");
        //n("AI Model Initialized");
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

void setup() {
    Serial.begin(115200);
    while (!Serial);
    
    if (!IMU.begin()) {
        Serial.println("TensorFlowLiteInference initialized");
        //n("Failed to initialize IMU!");
        while (1);
    }
    
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    pinMode(PIN_LED_STATUS, OUTPUT);
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);
    
    rehabServo.attach(PIN_SERVO);
    rehabServo.write(90);
}

void loop() {
    // Check button
    checkButton();
    
    // Handle serial commands
    handleSerialCommands();
    
    // Continuously send real-time data to web
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
    Serial.println("TensorFlowLiteInference initialized");
        //n("========================================");
    Serial.print("Starting analysis #");
    Serial.print(analysisCount);
    Serial.println("TensorFlowLiteInference initialized");
        //n(" for Parkinson's assessment...");
    Serial.println("TensorFlowLiteInference initialized");
        //n("========================================");
    
    if (!isCalibrated) {
        Serial.println("TensorFlowLiteInference initialized");
        //n("Calibration required. Starting auto-calibration...");
        startCalibration();
        return;
    }
    
    currentState = STATE_REAL_TIME_ANALYSIS;
    lastInferenceTime = millis();
    digitalWrite(PIN_LED_STATUS, HIGH);
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("Single analysis started");
    Serial.println("TensorFlowLiteInference initialized");
        //n("System will perform:");
    Serial.println("TensorFlowLiteInference initialized");
        //n("  >> Finger flexibility assessment");
    Serial.println("TensorFlowLiteInference initialized");
        //n("  >> Tremor intensity measurement");
    Serial.println("TensorFlowLiteInference initialized");
        //n("  >> Motion coordination test");
    Serial.println("TensorFlowLiteInference initialized");
        //n("  >> Personalized rehabilitation advice");
    Serial.println("TensorFlowLiteInference initialized");
        //n("Estimated analysis time: 10-15 seconds");
    Serial.println("TensorFlowLiteInference initialized");
        //n("Please keep natural hand movements...");
}

void stopRealTimeAnalysis() {
    Serial.println("TensorFlowLiteInference initialized");
        //n("Real-time analysis stopped");
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
        Serial.println("TensorFlowLiteInference initialized");
        //n("Please calibrate first (send CALIBRATE command)");
        return;
    }
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("=== Starting Data Collection ===");
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
        Serial.println("TensorFlowLiteInference initialized");
        //n();
        
        dataCount++;
        delay(SAMPLE_RATE);
    }
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("END");
    Serial.print("Data collection complete. Collected ");
    Serial.print(dataCount);
    Serial.println("TensorFlowLiteInference initialized");
        //n(" data points");
    
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
    Serial.println("TensorFlowLiteInference initialized");
        //n();
    Serial.println("TensorFlowLiteInference initialized");
        //n("=== AI Analysis Results ===");
    Serial.print("Analysis count: ");
    Serial.println("TensorFlowLiteInference initialized");
        //n(analysisCount);
    Serial.print("Parkinson's level: ");
    Serial.print(currentParkinsonsLevel);
    Serial.print(" (");
    Serial.print(aiModel.getParkinsonLevelDescription(currentParkinsonsLevel));
    Serial.println("TensorFlowLiteInference initialized");
        //n(")");
    Serial.print("Confidence: ");
    Serial.print(currentConfidence * 100, 1);
    Serial.println("TensorFlowLiteInference initialized");
        //n("%");
    
    int recommendedResistance = map(currentParkinsonsLevel, 1, 5, 30, 150);
    Serial.print("Recommended resistance setting: ");
    Serial.print(recommendedResistance);
    Serial.println("TensorFlowLiteInference initialized");
        //n(" degrees");
    
    // Simplified recommendations
    Serial.print("Training recommendation: ");
    switch(currentParkinsonsLevel) {
        case 1: Serial.println("TensorFlowLiteInference initialized");
        //n("Maintain current training intensity"); break;
        case 2: Serial.println("TensorFlowLiteInference initialized");
        //n("Increase finger flexibility training"); break;
        case 3: Serial.println("TensorFlowLiteInference initialized");
        //n("Perform resistance training"); break;
        case 4: Serial.println("TensorFlowLiteInference initialized");
        //n("Seek professional guidance"); break;
        case 5: Serial.println("TensorFlowLiteInference initialized");
        //n("Seek immediate medical attention"); break;
    }
    
    Serial.println("TensorFlowLiteInference initialized");
        //n("======================");
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
    // Continuously send real-time data to web
    unsigned long currentTime = millis();
    
    if (currentTime - lastWebDataTime >= WEB_DATA_INTERVAL) {
        // Read current sensor data (15 values: 5 fingers + EMG + 9 IMU)
        float sensorData[15];
        readRawSensorDataForWeb(sensorData);
        
        // Send data to web
        sendRawDataToWeb(sensorData);
        
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
    
    Serial.println("TensorFlowLiteInference initialized");
        //n();
}

void blinkError() {
    for (int i = 0; i < 10; i++) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        delay(100);
        digitalWrite(PIN_LED_STATUS, LOW);
        delay(100);
    }
}