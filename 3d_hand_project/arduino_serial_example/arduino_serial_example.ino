#include "Arduino_BMI270_BMM150.h"

// IMU 變數
float accelX, accelY, accelZ;
float gyroX, gyroY, gyroZ;
float magX, magY, magZ;

// 模擬電位器變數
int finger1, finger2, finger3, finger4, finger5;

void setup() 
{
  // 初始化串口通訊，波特率 115200
  Serial.begin(115200);
  while (!Serial) {
    delay(10);
  }
  Serial.println("Arduino 感測器已準備就緒");

  // 初始化 IMU
  if (!IMU.begin()) 
  {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  Serial.print("Accelerometer sample rate = ");
  Serial.print(IMU.accelerationSampleRate());
  Serial.println(" Hz");
  Serial.println();
}

void loop() 
{
  // 讀取 IMU 數據
  IMU.readAcceleration(accelX, accelY, accelZ);
  IMU.readGyroscope(gyroX, gyroY, gyroZ);
  IMU.readMagneticField(magX, magY, magZ);
  
  // 模擬電位器數據 (0-1023)
  // 這裡用 analogRead 讀取真實的電位器，如果沒有連接就用模擬值
  finger1 = analogRead(A0);  // 拇指
  finger2 = analogRead(A1);  // 食指  
  finger3 = analogRead(A2);  // 中指
  finger4 = analogRead(A3);  // 無名指
  finger5 = analogRead(A4);  // 小指
  
  // 如果沒有連接電位器，使用模擬值
  if (finger1 == 0 && finger2 == 0 && finger3 == 0 && finger4 == 0 && finger5 == 0) {
    // 模擬手指彎曲數據
    finger1 = random(100, 900);  // 拇指
    finger2 = random(200, 800);  // 食指
    finger3 = random(150, 850);  // 中指
    finger4 = random(180, 820);  // 無名指
    finger5 = random(120, 880);  // 小指
  }
  
  // 創建 JSON 格式的數據
  String jsonData = "{";
  jsonData += "\"fingers\":[" + String(finger1) + "," + String(finger2) + "," + String(finger3) + "," + String(finger4) + "," + String(finger5) + "],";
  jsonData += "\"accelerometer\":{\"x\":" + String(accelX, 3) + ",\"y\":" + String(accelY, 3) + ",\"z\":" + String(accelZ, 3) + "},";
  jsonData += "\"gyroscope\":{\"x\":" + String(gyroX, 3) + ",\"y\":" + String(gyroY, 3) + ",\"z\":" + String(gyroZ, 3) + "},";
  jsonData += "\"magnetometer\":{\"x\":" + String(magX, 3) + ",\"y\":" + String(magY, 3) + ",\"z\":" + String(magZ, 3) + "}";
  jsonData += "}";
  
  // 輸出 JSON 數據
  Serial.println(jsonData);
  
  // 延遲 100ms
  delay(100);
} 