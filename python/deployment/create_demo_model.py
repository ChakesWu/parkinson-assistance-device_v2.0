"""
創建演示用的CNN-LSTM模型（無需真實數據）
用於快速測試Arduino AI功能
"""

import tensorflow as tf
import numpy as np
import os
from datetime import datetime

def create_demo_cnn_lstm_model():
    """創建演示用的CNN-LSTM模型"""
    
    print("🔧 創建演示CNN-LSTM模型...")
    
    # 輸入: (batch_size, 50, 9) - 匹配Arduino代碼
    input_layer = tf.keras.Input(shape=(50, 9))
    
    # 簡化的CNN層（針對Arduino內存限制）
    x = tf.keras.layers.Conv1D(16, 3, activation='relu', padding='same')(input_layer)
    x = tf.keras.layers.MaxPooling1D(2)(x)
    x = tf.keras.layers.Conv1D(32, 3, activation='relu', padding='same')(x)
    
    # 簡化的LSTM層
    x = tf.keras.layers.LSTM(16, return_sequences=False)(x)
    
    # 全連接層
    x = tf.keras.layers.Dense(8, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    
    # 輸出層 (5個帕金森等級)
    output = tf.keras.layers.Dense(5, activation='softmax')(x)
    
    model = tf.keras.Model(inputs=input_layer, outputs=output)
    
    # 編譯模型
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy', 
        metrics=['accuracy']
    )
    
    print(f"✅ 模型創建完成，參數數量: {model.count_params()}")
    return model

def generate_synthetic_data(num_samples=1000):
    """生成合成的帕金森症數據"""
    
    print("📊 生成合成訓練數據...")
    
    X_train = []
    y_train = []
    
    for level in range(5):  # 5個帕金森等級 (0-4)
        for _ in range(num_samples // 5):
            # 模擬不同等級的症狀特徵
            if level == 0:  # 輕度
                base_values = np.random.normal(0.2, 0.1, (50, 9))
            elif level == 1:  # 輕中度
                base_values = np.random.normal(0.4, 0.15, (50, 9))
            elif level == 2:  # 中度
                base_values = np.random.normal(0.6, 0.2, (50, 9))
            elif level == 3:  # 中重度
                base_values = np.random.normal(0.8, 0.25, (50, 9))
            else:  # 重度
                base_values = np.random.normal(1.0, 0.3, (50, 9))
            
            # 添加震顫模擬（高頻噪音）
            tremor_intensity = level * 0.1
            tremor = np.random.normal(0, tremor_intensity, (50, 9))
            
            # 添加運動不協調（低頻波動）
            coordination_loss = level * 0.05
            coordination = np.sin(np.linspace(0, 4*np.pi, 50)).reshape(-1, 1) * coordination_loss
            coordination = np.repeat(coordination, 9, axis=1)
            
            # 合成最終數據
            synthetic_data = base_values + tremor + coordination
            
            # 限制數值範圍
            synthetic_data = np.clip(synthetic_data, 0, 1)
            
            X_train.append(synthetic_data)
            y_train.append(level)
    
    X_train = np.array(X_train, dtype=np.float32)
    y_train = np.array(y_train, dtype=np.int32)
    
    print(f"✅ 生成數據完成: {X_train.shape}, 標籤: {y_train.shape}")
    return X_train, y_train

def train_demo_model():
    """訓練演示模型"""
    
    print("🚀 開始訓練演示模型...")
    
    # 生成合成數據
    X_train, y_train = generate_synthetic_data(1000)
    
    # 創建模型
    model = create_demo_cnn_lstm_model()
    
    # 顯示模型架構
    model.summary()
    
    # 訓練模型
    print("🔄 開始訓練...")
    history = model.fit(
        X_train, y_train, 
        epochs=20, 
        batch_size=32, 
        validation_split=0.2,
        verbose=1
    )
    
    # 創建models目錄
    os.makedirs('models', exist_ok=True)
    
    # 保存模型
    model_path = 'models/parkinson_cnn_lstm.h5'
    model.save(model_path)
    
    print(f"✅ 演示模型訓練完成並保存至: {model_path}")
    
    # 測試模型
    test_data = np.random.random((1, 50, 9)).astype(np.float32)
    prediction = model.predict(test_data, verbose=0)
    predicted_level = np.argmax(prediction) + 1
    confidence = np.max(prediction)
    
    print(f"📊 模型測試:")
    print(f"   預測等級: {predicted_level}")
    print(f"   置信度: {confidence:.3f}")
    print(f"   所有概率: {prediction[0]}")
    
    return model, history

def convert_to_arduino():
    """轉換模型為Arduino格式"""
    
    print("🔄 轉換模型為Arduino TensorFlow Lite格式...")
    
    try:
        # 加載模型
        model = tf.keras.models.load_model('models/parkinson_cnn_lstm.h5')
        
        # 創建轉換器
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        
        # 基本優化
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        
        # 轉換
        tflite_model = converter.convert()
        
        # 保存TFLite模型
        tflite_path = 'models/parkinson_model.tflite'
        with open(tflite_path, 'wb') as f:
            f.write(tflite_model)
        
        model_size_kb = len(tflite_model) / 1024
        print(f"✅ TFLite模型已保存: {tflite_path}")
        print(f"📏 模型大小: {model_size_kb:.2f} KB")
        
        # 檢查是否適合Arduino
        if model_size_kb < 60:
            print("✅ 模型大小適合Arduino Nano 33 BLE Sense!")
        else:
            print("⚠️  模型可能對Arduino太大，但仍可嘗試")
        
        # 生成Arduino頭文件
        generate_arduino_header(tflite_model)
        
        return True
        
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        return False

def generate_arduino_header(tflite_model):
    """生成Arduino C++頭文件"""
    
    print("📝 生成Arduino頭文件...")
    
    model_size = len(tflite_model)
    
    header_content = f"""// 自動生成的演示帕金森症AI模型
// 生成時間: {datetime.now()}
// 模型大小: {model_size} bytes
// 輸入形狀: [50, 9] (50個時間點，9維特徵)
// 輸出形狀: [5] (帕金森等級1-5)

#ifndef MODEL_DATA_H
#define MODEL_DATA_H

const unsigned int model_data_len = {model_size};
const unsigned char model_data[] = {{
"""
    
    # 添加字節數據
    for i, byte in enumerate(tflite_model):
        if i % 16 == 0:
            header_content += "\n  "
        header_content += f"0x{byte:02x}"
        if i < len(tflite_model) - 1:
            header_content += ", "
    
    header_content += """
};

// 模型元數據
const int kModelSequenceLength = 50;
const int kModelFeatureDim = 9;
const int kModelNumClasses = 5;

#endif // MODEL_DATA_H
"""
    
    # 寫入Arduino目錄
    header_path = '../arduino/main/complete_parkinson_device/model_data.h'
    
    try:
        with open(header_path, 'w', encoding='utf-8') as f:
            f.write(header_content)
        
        print(f"✅ Arduino頭文件已生成: {header_path}")
        print(f"🎯 現在可以編譯Arduino代碼並測試AI功能!")
        
    except Exception as e:
        print(f"❌ 生成Arduino頭文件失敗: {e}")

def main():
    """主程序 - 創建完整的演示AI系統"""
    
    print("🎯 帕金森症AI演示模型創建工具")
    print("=" * 50)
    
    try:
        # 步驟1: 訓練演示模型
        print("\n📚 步驟1: 訓練演示模型")
        model, history = train_demo_model()
        
        # 步驟2: 轉換為Arduino格式
        print("\n🔄 步驟2: 轉換為Arduino TensorFlow Lite")
        success = convert_to_arduino()
        
        if success:
            print("\n🎉 演示AI系統創建完成!")
            print("\n✅ 下一步操作:")
            print("1. 在Arduino IDE中編譯 complete_parkinson_device.ino")
            print("2. 上傳到Arduino Nano 33 BLE Sense Rev2")
            print("3. 打開串口監視器測試AI功能")
            print("4. 發送 'START' 命令開始數據收集和分析")
            
            return True
        else:
            print("\n❌ 轉換失敗，請檢查錯誤訊息")
            return False
            
    except Exception as e:
        print(f"\n❌ 創建演示模型失敗: {e}")
        return False

if __name__ == "__main__":
    main()