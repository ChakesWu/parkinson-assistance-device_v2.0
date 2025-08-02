# 設備連接故障排除指南

## 問題描述

您遇到的問題是：Arduino顯示 "EMG強度: 431 (真實數據)"，但實際上您連接了電位器和EMG收集器。

## 問題原因

### 1. 設備檢測邏輯問題

原來的代碼中，設備檢測邏輯有誤：

```cpp
bool isEMGConnected() {
    return digitalRead(PIN_EMG_DETECT) == HIGH;  // 錯誤的邏輯
}
```

**問題**：
- 檢測引腳設置為 `INPUT`（浮空輸入）
- 當沒有設備連接時，引腳狀態不確定
- 可能誤判為設備已連接

### 2. 引腳初始化問題

```cpp
pinMode(PIN_EMG_DETECT, INPUT);  // 浮空輸入，狀態不穩定
```

## 解決方案

### 1. 修改引腳初始化

```cpp
// 改為上拉輸入，確保引腳狀態穩定
pinMode(PIN_POT_DETECT, INPUT_PULLUP);
pinMode(PIN_EMG_DETECT, INPUT_PULLUP);
```

### 2. 修改檢測邏輯

```cpp
bool isEMGConnected() {
    // 更準確的EMG設備檢測
    // 如果檢測引腳為LOW（接地），表示設備已連接
    // 如果檢測引腳為HIGH（上拉），表示設備未連接
    return digitalRead(PIN_EMG_DETECT) == LOW;
}
```

### 3. 硬體連接方式

**正確的連接方式**：

```
EMG設備連接：
- EMG信號線 -> A5
- EMG檢測線 -> D3 (通過開關或直接接地)

電位器連接：
- 電位器信號線 -> A0-A4
- 電位器檢測線 -> D2 (通過開關或直接接地)
```

## 測試方法

### 1. 使用測試程序

上傳 `arduino/main/device_test.ino` 到Arduino，然後：

1. 打開串口監視器
2. 觀察設備檢測狀態
3. 按 's' 查看詳細狀態
4. 按 'r' 重新檢測

### 2. 手動測試

```cpp
// 在setup()中添加以下代碼來測試
Serial.println("=== 設備檢測 ===");
Serial.print("電位器檢測引腳(D2): ");
Serial.println(digitalRead(PIN_POT_DETECT) == HIGH ? "HIGH" : "LOW");
Serial.print("EMG檢測引腳(D3): ");
Serial.println(digitalRead(PIN_EMG_DETECT) == HIGH ? "HIGH" : "LOW");
Serial.println("================");
```

## 預期結果

### 設備未連接時：
```
電位器檢測引腳(D2): HIGH -> 設備未連接
EMG檢測引腳(D3): HIGH -> 設備未連接
EMG強度: 431 (模擬數據)
```

### 設備已連接時：
```
電位器檢測引腳(D2): LOW -> 設備已連接
EMG檢測引腳(D3): LOW -> 設備已連接
EMG強度: 431 (真實數據)
```

## 常見問題

### Q1: 為什麼顯示"真實數據"但實際是模擬數據？

**A**: 這是因為檢測引腳狀態不正確。當引腳為HIGH時，系統誤判為設備已連接。

### Q2: 如何確保設備正確連接？

**A**: 
1. 確保EMG設備的檢測線連接到D3並接地
2. 確保電位器的檢測線連接到D2並接地
3. 使用測試程序驗證連接狀態

### Q3: 如果沒有檢測線怎麼辦？

**A**: 可以修改代碼，直接使用模擬數據：

```cpp
bool isEMGConnected() {
    return false;  // 強制使用模擬數據
}
```

## 修改後的效果

修改後的代碼會：
1. 正確檢測設備連接狀態
2. 準確顯示數據來源（真實/模擬）
3. 提供穩定的引腳狀態

這樣您就能正確區分真實的EMG數據和模擬數據了。 