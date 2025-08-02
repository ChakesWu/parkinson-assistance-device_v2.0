"""
CNN-LSTM混合模型用於帕金森症狀分析
結合卷積神經網絡和長短期記憶網絡來分析多傳感器數據
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import json
import os
from datetime import datetime

class ParkinsonCNNLSTMModel:
    def __init__(self, sequence_length=50, feature_dim=9):
        """
        初始化CNN-LSTM模型
        
        Args:
            sequence_length: 時間序列長度
            feature_dim: 特徵維度 (5個手指 + 1個EMG + 3個IMU = 9)
        """
        self.sequence_length = sequence_length
        self.feature_dim = feature_dim
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.history = None
        
    def create_model(self, num_classes=5):
        """
        創建CNN-LSTM混合模型架構
        
        Args:
            num_classes: 分類數量 (帕金森等級1-5)
        """
        # 輸入層
        input_layer = keras.Input(shape=(self.sequence_length, self.feature_dim))
        
        # CNN部分 - 提取局部特徵
        # 1D卷積層用於處理時間序列
        conv1 = layers.Conv1D(filters=64, kernel_size=3, activation='relu', padding='same')(input_layer)
        conv1 = layers.BatchNormalization()(conv1)
        conv1 = layers.Dropout(0.2)(conv1)
        
        conv2 = layers.Conv1D(filters=128, kernel_size=3, activation='relu', padding='same')(conv1)
        conv2 = layers.BatchNormalization()(conv2)
        conv2 = layers.MaxPooling1D(pool_size=2)(conv2)
        conv2 = layers.Dropout(0.2)(conv2)
        
        conv3 = layers.Conv1D(filters=256, kernel_size=3, activation='relu', padding='same')(conv2)
        conv3 = layers.BatchNormalization()(conv3)
        conv3 = layers.Dropout(0.2)(conv3)
        
        # LSTM部分 - 捕捉時間依賴性
        lstm1 = layers.LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.2)(conv3)
        lstm2 = layers.LSTM(64, return_sequences=False, dropout=0.2, recurrent_dropout=0.2)(lstm1)
        
        # 注意力機制 (可選)
        attention = layers.Dense(64, activation='tanh')(lstm2)
        attention = layers.Dense(1, activation='sigmoid')(attention)
        lstm_attended = layers.multiply([lstm2, attention])
        
        # 全連接層
        dense1 = layers.Dense(128, activation='relu')(lstm_attended)
        dense1 = layers.BatchNormalization()(dense1)
        dense1 = layers.Dropout(0.3)(dense1)
        
        dense2 = layers.Dense(64, activation='relu')(dense1)
        dense2 = layers.Dropout(0.2)(dense2)
        
        # 輸出層
        output = layers.Dense(num_classes, activation='softmax')(dense2)
        
        # 創建模型
        self.model = keras.Model(inputs=input_layer, outputs=output)
        
        # 編譯模型
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return self.model
    
    def prepare_sequences(self, df):
        """
        準備時間序列數據
        
        Args:
            df: 包含傳感器數據的DataFrame
        """
        # 特徵列
        feature_cols = ['finger_pinky', 'finger_ring', 'finger_middle', 
                       'finger_index', 'finger_thumb', 'emg', 
                       'imu_x', 'imu_y', 'imu_z']
        
        sequences = []
        labels = []
        
        # 按患者分組處理
        for patient_id in df['patient_id'].unique():
            patient_data = df[df['patient_id'] == patient_id].sort_values('timestamp')
            
            if len(patient_data) < self.sequence_length:
                continue
            
            features = patient_data[feature_cols].values
            patient_label = patient_data['parkinson_level'].iloc[0] - 1  # 轉換為0-4
            
            # 創建滑動窗口序列
            for i in range(len(features) - self.sequence_length + 1):
                sequences.append(features[i:i + self.sequence_length])
                labels.append(patient_label)
        
        return np.array(sequences), np.array(labels)
    
    def load_and_preprocess_data(self, data_dir="data"):
        """
        加載和預處理數據
        
        Args:
            data_dir: 數據目錄
        """
        all_data = []
        
        # 讀取所有JSON文件
        for filename in os.listdir(data_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(data_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        session_data = json.load(f)
                    
                    # 轉換為DataFrame
                    data_points = session_data['data']
                    for point in data_points:
                        row = {
                            'timestamp': point['timestamp'],
                            'finger_pinky': point['fingers'][0],
                            'finger_ring': point['fingers'][1],
                            'finger_middle': point['fingers'][2],
                            'finger_index': point['fingers'][3],
                            'finger_thumb': point['fingers'][4],
                            'emg': point['emg'],
                            'imu_x': point['imu'][0],
                            'imu_y': point['imu'][1],
                            'imu_z': point['imu'][2],
                            'patient_id': session_data.get('patient_id'),
                            'parkinson_level': session_data.get('parkinson_level')
                        }
                        all_data.append(row)
                
                except Exception as e:
                    print(f"讀取文件 {filename} 失敗: {e}")
        
        if not all_data:
            raise ValueError("沒有找到有效的數據文件")
        
        df = pd.DataFrame(all_data)
        print(f"加載數據: {len(df)} 個數據點，{df['patient_id'].nunique()} 個患者")
        
        return df
    
    def train_model(self, df, test_size=0.2, epochs=100, batch_size=32):
        """
        訓練模型
        
        Args:
            df: 數據DataFrame
            test_size: 測試集比例
            epochs: 訓練輪數
            batch_size: 批次大小
        """
        # 準備序列數據
        X, y = self.prepare_sequences(df)
        print(f"序列數據準備完成: {X.shape}, 標籤: {y.shape}")
        
        # 標準化特徵
        X_reshaped = X.reshape(-1, X.shape[-1])
        X_scaled = self.scaler.fit_transform(X_reshaped)
        X = X_scaled.reshape(X.shape)
        
        # 分割數據
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        print(f"訓練集: {X_train.shape}, 測試集: {X_test.shape}")
        
        # 創建模型
        self.create_model(num_classes=5)
        self.model.summary()
        
        # 回調函數
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss', patience=15, restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss', factor=0.5, patience=10, min_lr=0.00001
            ),
            keras.callbacks.ModelCheckpoint(
                'models/best_parkinson_model.h5', 
                monitor='val_accuracy', 
                save_best_only=True
            )
        ]
        
        # 訓練模型
        self.history = self.model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        
        # 評估模型
        test_loss, test_accuracy = self.model.evaluate(X_test, y_test, verbose=0)
        print(f"\n測試準確率: {test_accuracy:.4f}")
        
        # 詳細評估
        y_pred = np.argmax(self.model.predict(X_test), axis=1)
        
        print("\n分類報告:")
        print(classification_report(y_test, y_pred, 
                                  target_names=[f"等級{i+1}" for i in range(5)]))
        
        return self.history
    
    def plot_training_history(self):
        """繪製訓練歷史"""
        if self.history is None:
            print("沒有訓練歷史可繪製")
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        
        # 準確率
        ax1.plot(self.history.history['accuracy'], label='訓練準確率')
        ax1.plot(self.history.history['val_accuracy'], label='驗證準確率')
        ax1.set_title('模型準確率')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('準確率')
        ax1.legend()
        
        # 損失
        ax2.plot(self.history.history['loss'], label='訓練損失')
        ax2.plot(self.history.history['val_loss'], label='驗證損失')
        ax2.set_title('模型損失')
        ax2.set_xlabel('Epoch')
        ax2.set_ylabel('損失')
        ax2.legend()
        
        plt.tight_layout()
        plt.savefig('models/training_history.png')
        plt.show()
    
    def save_model(self, model_path="models/parkinson_cnn_lstm.h5"):
        """保存模型"""
        if self.model is None:
            print("沒有模型可保存")
            return
        
        self.model.save(model_path)
        
        # 保存預處理器
        import joblib
        joblib.dump(self.scaler, "models/scaler.joblib")
        
        print(f"模型已保存: {model_path}")
    
    def load_model(self, model_path="models/parkinson_cnn_lstm.h5"):
        """加載模型"""
        self.model = keras.models.load_model(model_path)
        
        # 加載預處理器
        import joblib
        self.scaler = joblib.load("models/scaler.joblib")
        
        print(f"模型已加載: {model_path}")
    
    def predict_parkinson_level(self, sensor_data):
        """
        預測帕金森等級
        
        Args:
            sensor_data: 傳感器數據 (sequence_length, feature_dim)
        """
        if self.model is None:
            print("模型未加載")
            return None
        
        # 預處理
        data_scaled = self.scaler.transform(sensor_data.reshape(-1, self.feature_dim))
        data_scaled = data_scaled.reshape(1, self.sequence_length, self.feature_dim)
        
        # 預測
        prediction = self.model.predict(data_scaled, verbose=0)
        predicted_level = np.argmax(prediction) + 1
        confidence = np.max(prediction)
        
        return {
            'predicted_level': predicted_level,
            'confidence': confidence,
            'all_probabilities': prediction[0].tolist()
        }

def main():
    """主程序 - 模型訓練示例"""
    # 創建模型
    model = ParkinsonCNNLSTMModel(sequence_length=50, feature_dim=9)
    
    try:
        # 加載數據
        df = model.load_and_preprocess_data("data")
        
        # 訓練模型
        history = model.train_model(df, epochs=50, batch_size=16)
        
        # 繪製訓練歷史
        model.plot_training_history()
        
        # 保存模型
        model.save_model()
        
        print("模型訓練完成!")
        
    except Exception as e:
        print(f"訓練過程出錯: {e}")

if __name__ == "__main__":
    main()