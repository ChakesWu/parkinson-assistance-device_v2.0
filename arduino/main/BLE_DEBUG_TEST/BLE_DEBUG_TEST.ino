/*
  BLE调试测试代码
  用于验证BLE服务和特征值是否正确设置
*/

#include <ArduinoBLE.h>

// BLE Configuration
#define BLE_DEVICE_NAME "ParkinsonDevice_v2"
#define BLE_SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define BLE_SENSOR_DATA_UUID "12345678-1234-1234-1234-123456789abd"
#define BLE_COMMAND_UUID "12345678-1234-1234-1234-123456789abe"
#define BLE_AI_RESULT_UUID "12345678-1234-1234-1234-123456789abf"

// BLE Objects - 使用String特征值以避免兼容性问题
BLEService parkinsonService(BLE_SERVICE_UUID);
BLEStringCharacteristic sensorDataCharacteristic(BLE_SENSOR_DATA_UUID, BLERead | BLENotify, 60);
BLEStringCharacteristic commandCharacteristic(BLE_COMMAND_UUID, BLEWrite, 20);
BLEStringCharacteristic aiResultCharacteristic(BLE_AI_RESULT_UUID, BLERead | BLENotify, 100);

bool bleConnected = false;

void setup() {
  Serial.begin(115200);
  while (!Serial);
  
  Serial.println("=== BLE调试测试开始 ===");
  
  // 初始化BLE
  if (!BLE.begin()) {
    Serial.println("启动BLE失败!");
    while (1);
  }
  
  // 设置BLE设备名称
  BLE.setLocalName(BLE_DEVICE_NAME);
  BLE.setAdvertisedService(parkinsonService);
  
  // 添加特征值到服务
  parkinsonService.addCharacteristic(sensorDataCharacteristic);
  parkinsonService.addCharacteristic(commandCharacteristic);
  parkinsonService.addCharacteristic(aiResultCharacteristic);
  
  // 添加服务
  BLE.addService(parkinsonService);
  
  // 设置事件处理器
  BLE.setEventHandler(BLEConnected, onBLEConnected);
  BLE.setEventHandler(BLEDisconnected, onBLEDisconnected);
  commandCharacteristic.setEventHandler(BLEWritten, onCommandReceived);
  
  // 开始广播
  BLE.advertise();
  
  Serial.println("BLE设备已启动，等待连接...");
  Serial.print("设备名称: ");
  Serial.println(BLE_DEVICE_NAME);
  Serial.print("服务UUID: ");
  Serial.println(BLE_SERVICE_UUID);
}

void loop() {
  // 处理BLE事件
  BLE.poll();
  
  // 如果已连接，发送测试数据
  if (bleConnected) {
    sendTestData();
    delay(1000); // 每秒发送一次测试数据
  }
  
  // 检查串口命令
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "status") {
      printStatus();
    } else if (command == "test") {
      sendTestData();
    } else if (command == "ai") {
      sendTestAIResult();
    }
  }
}

void onBLEConnected(BLEDevice central) {
  Serial.print("已连接到中央设备: ");
  Serial.println(central.address());
  bleConnected = true;
}

void onBLEDisconnected(BLEDevice central) {
  Serial.print("与中央设备断开连接: ");
  Serial.println(central.address());
  bleConnected = false;
}

void onCommandReceived(BLEDevice central, BLECharacteristic characteristic) {
  String command = commandCharacteristic.value();
  Serial.print("收到命令: ");
  Serial.println(command);
  
  // 处理命令
  if (command == "START") {
    Serial.println("开始数据采集");
  } else if (command == "STOP") {
    Serial.println("停止数据采集");
  } else if (command == "STATUS") {
    sendTestAIResult();
  }
}

void sendTestData() {
  // 创建测试传感器数据
  String testData = "F:";
  for (int i = 0; i < 5; i++) {
    testData += String(random(0, 1024));
    if (i < 4) testData += ",";
  }
  testData += ";A:";
  testData += String(random(-1000, 1000)) + "," + String(random(-1000, 1000)) + "," + String(random(-1000, 1000));
  testData += ";G:";
  testData += String(random(-1000, 1000)) + "," + String(random(-1000, 1000)) + "," + String(random(-1000, 1000));
  
  sensorDataCharacteristic.writeValue(testData);
  Serial.println("发送测试数据: " + testData);
}

void sendTestAIResult() {
  String aiResult = "LEVEL:2;CONF:85;REC:轻度震颤，建议进行康复训练;RES:45";
  aiResultCharacteristic.writeValue(aiResult);
  Serial.println("发送AI结果: " + aiResult);
}

void printStatus() {
  Serial.println("=== BLE状态 ===");
  Serial.print("连接状态: ");
  Serial.println(bleConnected ? "已连接" : "未连接");
  Serial.print("设备名称: ");
  Serial.println(BLE_DEVICE_NAME);
  Serial.print("服务UUID: ");
  Serial.println(BLE_SERVICE_UUID);
  Serial.println("可用命令: status, test, ai");
}
