"""
Arduino數據收集模組
連接Arduino設備並收集傳感器數據用於帕金森分析
"""

import serial
import time
import numpy as np
import pandas as pd
import json
from datetime import datetime
import threading
import queue

class ArduinoDataCollector:
    def __init__(self, port='COM3', baudrate=9600):
        """
        初始化Arduino數據收集器
        
        Args:
            port: Arduino串口
            baudrate: 波特率
        """
        self.port = port
        self.baudrate = baudrate
        self.serial_conn = None
        self.is_collecting = False
        self.data_queue = queue.Queue()
        self.collected_data = []
        
    def connect(self):
        """連接Arduino設備"""
        try:
            self.serial_conn = serial.Serial(self.port, self.baudrate, timeout=1)
            time.sleep(2)  # 等待Arduino啟動
            print(f"成功連接到Arduino: {self.port}")
            return True
        except Exception as e:
            print(f"連接Arduino失敗: {e}")
            return False
    
    def disconnect(self):
        """斷開Arduino連接"""
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
            print("Arduino連接已斷開")
    
    def send_command(self, command):
        """發送命令到Arduino"""
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.write(f"{command}\n".encode())
            print(f"發送命令: {command}")
        else:
            print("Arduino未連接")
    
    def read_data_line(self):
        """讀取一行數據"""
        if self.serial_conn and self.serial_conn.is_open:
            try:
                line = self.serial_conn.readline().decode().strip()
                return line
            except Exception as e:
                print(f"讀取數據錯誤: {e}")
                return None
        return None
    
    def parse_data_packet(self, line):
        """解析數據包 (左手邏輯)"""
        if line.startswith("DATA"):
            try:
                # 數據格式: DATA,thumb,index,middle,ring,pinky,emg,imu_x,imu_y,imu_z
                # 左手邏輯：finger1=拇指, finger2=食指, finger3=中指, finger4=無名指, finger5=小指
                parts = line.split(',')
                if len(parts) == 10:  # DATA + 9個數值
                    data = {
                        'timestamp': time.time(),
                        'fingers': [float(parts[1]), float(parts[2]), float(parts[3]),
                                   float(parts[4]), float(parts[5])],  # [拇指, 食指, 中指, 無名指, 小指]
                        'emg': float(parts[6]),
                        'imu': [float(parts[7]), float(parts[8]), float(parts[9])]
                    }
                    return data
            except ValueError as e:
                print(f"數據解析錯誤: {e}")
        return None
    
    def collect_data_session(self, duration=10, patient_id=None, parkinson_level=None):
        """
        收集一個完整的數據會話
        
        Args:
            duration: 收集時長(秒)
            patient_id: 患者ID
            parkinson_level: 帕金森等級(1-5)
        """
        print(f"開始收集數據會話 (時長: {duration}秒)")
        
        # 發送START命令
        self.send_command("START")
        
        session_data = []
        start_time = time.time()
        
        while time.time() - start_time < duration + 5:  # 額外5秒緩衝
            line = self.read_data_line()
            if line:
                print(line)  # 顯示所有Arduino輸出
                
                if line.startswith("DATA"):
                    data_point = self.parse_data_packet(line)
                    if data_point:
                        session_data.append(data_point)
                elif line == "END":
                    print("數據收集完成")
                    break
        
        # 保存會話數據
        session_info = {
            'patient_id': patient_id,
            'parkinson_level': parkinson_level,
            'session_time': datetime.now().isoformat(),
            'duration': duration,
            'data_points': len(session_data),
            'data': session_data
        }
        
        return session_info
    
    def save_session_data(self, session_data, filename=None):
        """保存會話數據到文件"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            patient_id = session_data.get('patient_id', 'unknown')
            filename = f"data/session_{patient_id}_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
            print(f"數據已保存: {filename}")
            return filename
        except Exception as e:
            print(f"保存數據失敗: {e}")
            return None
    
    def convert_to_dataframe(self, session_data):
        """轉換會話數據為DataFrame格式"""
        data_points = session_data['data']
        
        rows = []
        for point in data_points:
            # 左手邏輯：fingers[0]=拇指, fingers[1]=食指, fingers[2]=中指, fingers[3]=無名指, fingers[4]=小指
            row = {
                'timestamp': point['timestamp'],
                'finger_thumb': point['fingers'][0],    # 拇指 (finger1)
                'finger_index': point['fingers'][1],    # 食指 (finger2)
                'finger_middle': point['fingers'][2],   # 中指 (finger3)
                'finger_ring': point['fingers'][3],     # 無名指 (finger4)
                'finger_pinky': point['fingers'][4],    # 小指 (finger5)
                'emg': point['emg'],
                'imu_x': point['imu'][0],
                'imu_y': point['imu'][1],
                'imu_z': point['imu'][2],
                'patient_id': session_data.get('patient_id'),
                'parkinson_level': session_data.get('parkinson_level')
            }
            rows.append(row)
        
        return pd.DataFrame(rows)
    
    def collect_training_dataset(self, patients_config):
        """
        收集訓練數據集
        
        Args:
            patients_config: 患者配置列表
            格式: [{'patient_id': 'P001', 'parkinson_level': 2, 'sessions': 5}, ...]
        """
        all_sessions = []
        
        for patient in patients_config:
            patient_id = patient['patient_id']
            level = patient['parkinson_level']
            sessions = patient['sessions']
            
            print(f"\n收集患者 {patient_id} 的數據 (等級: {level}, 會話數: {sessions})")
            
            for session_num in range(sessions):
                print(f"\n=== 患者 {patient_id} - 會話 {session_num + 1}/{sessions} ===")
                input("按Enter開始收集數據...")
                
                session_data = self.collect_data_session(
                    duration=10,
                    patient_id=patient_id,
                    parkinson_level=level
                )
                
                if session_data:
                    filename = self.save_session_data(session_data)
                    all_sessions.append(session_data)
                    print(f"會話 {session_num + 1} 完成")
                
                time.sleep(2)  # 會話間休息
        
        return all_sessions

def main():
    """主程序 - 數據收集示例"""
    # 創建收集器
    collector = ArduinoDataCollector(port='COM3')  # 根據實際端口修改
    
    if not collector.connect():
        return
    
    try:
        # 示例：收集單個會話
        print("=== 單會話數據收集測試 ===")
        session_data = collector.collect_data_session(
            duration=10,
            patient_id="TEST001", 
            parkinson_level=2
        )
        
        if session_data:
            filename = collector.save_session_data(session_data)
            df = collector.convert_to_dataframe(session_data)
            print(f"收集到 {len(df)} 個數據點")
            print(df.head())
        
        # 示例：批量收集訓練數據
        collect_training = input("\n是否要收集訓練數據集? (y/n): ").lower() == 'y'
        
        if collect_training:
            patients_config = [
                {'patient_id': 'P001', 'parkinson_level': 1, 'sessions': 3},
                {'patient_id': 'P002', 'parkinson_level': 2, 'sessions': 3},
                {'patient_id': 'P003', 'parkinson_level': 3, 'sessions': 3},
                {'patient_id': 'P004', 'parkinson_level': 4, 'sessions': 3},
                {'patient_id': 'P005', 'parkinson_level': 5, 'sessions': 3},
            ]
            
            all_sessions = collector.collect_training_dataset(patients_config)
            print(f"\n訓練數據收集完成，總計 {len(all_sessions)} 個會話")
    
    finally:
        collector.disconnect()

if __name__ == "__main__":
    main()