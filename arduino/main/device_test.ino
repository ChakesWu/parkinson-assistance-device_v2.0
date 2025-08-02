/*
 * 設備連接測試程序
 * 用於診斷電位器和EMG設備的連接狀態
 */

// 引腳定義
#define PIN_PINKY     A0
#define PIN_RING      A1
#define PIN_MIDDLE    A2
#define PIN_INDEX     A3
#define PIN_THUMB     A4
#define PIN_EMG       A5

// 設備檢測引腳
#define PIN_POT_DETECT    2
#define PIN_EMG_DETECT    3

void setup() {
    Serial.begin(9600);
    while (!Serial);
    
    // 初始化檢測引腳
    pinMode(PIN_POT_DETECT, INPUT_PULLUP);
    pinMode(PIN_EMG_DETECT, INPUT_PULLUP);
    
    Serial.println("=== 設備連接測試程序 ===");
    Serial.println("此程序將持續監測設備連接狀態和傳感器數據");
    Serial.println("按 's' 查看狀態，按 'r' 重新檢測");
    Serial.println("=====================================");
}

void loop() {
    if (Serial.available()) {
        char cmd = Serial.read();
        
        if (cmd == 's' || cmd == 'S') {
            showStatus();
        } else if (cmd == 'r' || cmd == 'R') {
            Serial.println("重新檢測設備...");
            showStatus();
        }
    }
    
    // 每2秒自動顯示一次狀態
    static unsigned long lastDisplay = 0;
    if (millis() - lastDisplay >= 2000) {
        showStatus();
        lastDisplay = millis();
    }
    
    delay(100);
}

void showStatus() {
    Serial.println("\n=== 設備狀態檢測 ===");
    
    // 檢測引腳狀態
    int potDetectState = digitalRead(PIN_POT_DETECT);
    int emgDetectState = digitalRead(PIN_EMG_DETECT);
    
    Serial.print("電位器檢測引腳(D2): ");
    Serial.print(potDetectState == HIGH ? "HIGH" : "LOW");
    Serial.print(" -> ");
    Serial.println(potDetectState == LOW ? "設備已連接" : "設備未連接");
    
    Serial.print("EMG檢測引腳(D3): ");
    Serial.print(emgDetectState == HIGH ? "HIGH" : "LOW");
    Serial.print(" -> ");
    Serial.println(emgDetectState == LOW ? "設備已連接" : "設備未連接");
    
    // 讀取模擬數據
    Serial.println("\n--- 傳感器數據 ---");
    Serial.print("電位器數據: ");
    Serial.print("A0="); Serial.print(analogRead(PIN_PINKY));
    Serial.print(" A1="); Serial.print(analogRead(PIN_RING));
    Serial.print(" A2="); Serial.print(analogRead(PIN_MIDDLE));
    Serial.print(" A3="); Serial.print(analogRead(PIN_INDEX));
    Serial.print(" A4="); Serial.print(analogRead(PIN_THUMB));
    Serial.println();
    
    Serial.print("EMG數據(A5): ");
    Serial.println(analogRead(PIN_EMG));
    
    // 判斷數據來源
    Serial.println("\n--- 數據來源判斷 ---");
    if (potDetectState == LOW) {
        Serial.println("電位器: 使用真實數據");
    } else {
        Serial.println("電位器: 使用模擬數據 (因為檢測引腳為HIGH)");
    }
    
    if (emgDetectState == LOW) {
        Serial.println("EMG: 使用真實數據");
    } else {
        Serial.println("EMG: 使用模擬數據 (因為檢測引腳為HIGH)");
    }
    
    Serial.println("==================\n");
}

// 模擬數據生成函數（與主程序一致）
int getSimulatedPotValue(int pin) {
    static unsigned long lastTime = 0;
    unsigned long currentTime = millis();
    float angle = (currentTime * 0.001) * 2 * PI * 0.1;
    return 512 + 200 * sin(angle + pin * 0.5);
}

int getSimulatedEMGValue() {
    static unsigned long lastTime = 0;
    unsigned long currentTime = millis();
    float noise = random(-50, 50);
    float signal = 100 * sin(currentTime * 0.001 * 2 * PI * 0.05) + noise;
    return constrain(512 + signal, 0, 1023);
} 