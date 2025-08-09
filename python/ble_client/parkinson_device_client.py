"""
帕金森设备BLE客户端
用于与Arduino设备进行蓝牙通信和数据分析
"""

import asyncio
import json
import time
from datetime import datetime
from bleak import BleakClient, BleakScanner
import matplotlib.pyplot as plt
import numpy as np

class ParkinsonDeviceClient:
    """帕金森设备BLE客户端"""
    
    def __init__(self):
        self.device_name = "ParkinsonDevice_v2"
        self.client = None
        self.connected = False
        
        # BLE服务和特征UUID
        self.service_uuid = "12345678-1234-1234-1234-123456789abc"
        self.sensor_char_uuid = "12345678-1234-1234-1234-123456789abd"
        self.speech_char_uuid = "12345678-1234-1234-1234-123456789abe"
        self.analysis_char_uuid = "12345678-1234-1234-1234-123456789abf"
        self.command_char_uuid = "12345678-1234-1234-1234-123456789ac0"
        
        # 数据存储
        self.sensor_data = []
        self.speech_data = []
        self.analysis_results = []
        
    async def scan_devices(self):
        """扫描BLE设备"""
        print("扫描BLE设备...")
        devices = await BleakScanner.discover()
        
        for device in devices:
            print(f"发现设备: {device.name} - {device.address}")
            if device.name == self.device_name:
                print(f"找到目标设备: {device.address}")
                return device.address
        
        print("未找到目标设备")
        return None
    
    async def connect(self, address=None):
        """连接到设备"""
        if not address:
            address = await self.scan_devices()
            if not address:
                return False
        
        try:
            self.client = BleakClient(address)
            await self.client.connect()
            self.connected = True
            
            print(f"已连接到设备: {address}")
            
            # 设置通知回调
            await self.client.start_notify(self.sensor_char_uuid, self.sensor_notification_handler)
            await self.client.start_notify(self.speech_char_uuid, self.speech_notification_handler)
            await self.client.start_notify(self.analysis_char_uuid, self.analysis_notification_handler)
            
            print("已设置数据通知")
            return True
            
        except Exception as e:
            print(f"连接失败: {e}")
            return False
    
    async def disconnect(self):
        """断开连接"""
        if self.client and self.connected:
            await self.client.disconnect()
            self.connected = False
            print("已断开连接")
    
    async def send_command(self, command):
        """发送命令到设备"""
        if not self.connected:
            print("设备未连接")
            return False
        
        try:
            await self.client.write_gatt_char(self.command_char_uuid, command.encode())
            print(f"已发送命令: {command}")
            return True
        except Exception as e:
            print(f"发送命令失败: {e}")
            return False
    
    def sensor_notification_handler(self, sender, data):
        """传感器数据通知处理"""
        try:
            data_str = data.decode('utf-8')
            print(f"传感器数据: {data_str}")
            
            if ',' in data_str:
                parts = data_str.split(',')
                if len(parts) >= 4:
                    sensor_info = {
                        'timestamp': datetime.now().isoformat(),
                        'level': int(parts[0]),
                        'confidence': float(parts[1]),
                        'tremor_score': float(parts[2]),
                        'rigidity_score': float(parts[3])
                    }
                    self.sensor_data.append(sensor_info)
        except Exception as e:
            print(f"传感器数据解析错误: {e}")
    
    def speech_notification_handler(self, sender, data):
        """语音数据通知处理"""
        try:
            data_str = data.decode('utf-8')
            print(f"语音数据: {data_str}")
            
            if ',' in data_str:
                parts = data_str.split(',')
                if len(parts) >= 4:
                    speech_info = {
                        'timestamp': datetime.now().isoformat(),
                        'class': int(parts[0]),
                        'probability': float(parts[1]),
                        'confidence': float(parts[2]),
                        'severity': parts[3]
                    }
                    self.speech_data.append(speech_info)
        except Exception as e:
            print(f"语音数据解析错误: {e}")
    
    def analysis_notification_handler(self, sender, data):
        """分析结果通知处理"""
        try:
            data_str = data.decode('utf-8')
            print(f"分析结果: {data_str}")
            
            if ',' in data_str:
                parts = data_str.split(',', 3)  # 最多分割3次
                if len(parts) >= 4:
                    analysis_info = {
                        'timestamp': datetime.now().isoformat(),
                        'final_level': int(parts[0]),
                        'final_confidence': float(parts[1]),
                        'diagnosis': parts[2],
                        'recommendations': parts[3]
                    }
                    self.analysis_results.append(analysis_info)
                    
                    # 显示重要结果
                    print(f"=== 分析结果 ===")
                    print(f"等级: {analysis_info['final_level']}")
                    print(f"置信度: {analysis_info['final_confidence']:.3f}")
                    print(f"诊断: {analysis_info['diagnosis']}")
                    print(f"建议: {analysis_info['recommendations']}")
                    print(f"===============")
        except Exception as e:
            print(f"分析结果解析错误: {e}")
    
    def save_data(self, filename_prefix="parkinson_data"):
        """保存收集的数据"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存传感器数据
        if self.sensor_data:
            sensor_file = f"{filename_prefix}_sensor_{timestamp}.json"
            with open(sensor_file, 'w') as f:
                json.dump(self.sensor_data, f, indent=2)
            print(f"传感器数据已保存: {sensor_file}")
        
        # 保存语音数据
        if self.speech_data:
            speech_file = f"{filename_prefix}_speech_{timestamp}.json"
            with open(speech_file, 'w') as f:
                json.dump(self.speech_data, f, indent=2)
            print(f"语音数据已保存: {speech_file}")
        
        # 保存分析结果
        if self.analysis_results:
            analysis_file = f"{filename_prefix}_analysis_{timestamp}.json"
            with open(analysis_file, 'w') as f:
                json.dump(self.analysis_results, f, indent=2)
            print(f"分析结果已保存: {analysis_file}")
    
    def plot_results(self):
        """绘制结果图表"""
        if not self.analysis_results:
            print("没有分析结果可绘制")
            return
        
        # 提取数据
        timestamps = [datetime.fromisoformat(r['timestamp']) for r in self.analysis_results]
        levels = [r['final_level'] for r in self.analysis_results]
        confidences = [r['final_confidence'] for r in self.analysis_results]
        
        # 创建图表
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
        
        # 帕金森等级趋势
        ax1.plot(timestamps, levels, 'b-o', linewidth=2, markersize=6)
        ax1.set_ylabel('帕金森等级')
        ax1.set_title('帕金森症状等级趋势')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim(0.5, 5.5)
        
        # 置信度趋势
        ax2.plot(timestamps, confidences, 'r-s', linewidth=2, markersize=6)
        ax2.set_ylabel('置信度')
        ax2.set_xlabel('时间')
        ax2.set_title('分析置信度趋势')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(0, 1)
        
        plt.tight_layout()
        plt.xticks(rotation=45)
        
        # 保存图表
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        plt.savefig(f"parkinson_analysis_{timestamp}.png", dpi=300, bbox_inches='tight')
        plt.show()

async def main():
    """主程序"""
    print("=== 帕金森设备BLE客户端 ===")
    
    client = ParkinsonDeviceClient()
    
    try:
        # 连接设备
        if not await client.connect():
            print("连接失败，退出程序")
            return
        
        print("\n可用命令:")
        print("1. START - 开始传感器数据收集")
        print("2. SPEECH - 开始语音分析")
        print("3. MULTIMODAL - 开始多模态分析")
        print("4. STATUS - 查询系统状态")
        print("5. STOP - 停止所有操作")
        print("6. quit - 退出程序")
        print("7. save - 保存数据")
        print("8. plot - 绘制结果图表")
        
        while True:
            command = input("\n请输入命令: ").strip()
            
            if command.lower() == 'quit':
                break
            elif command.lower() == 'save':
                client.save_data()
            elif command.lower() == 'plot':
                client.plot_results()
            elif command.upper() in ['START', 'SPEECH', 'MULTIMODAL', 'STATUS', 'STOP']:
                await client.send_command(command.upper())
                if command.upper() in ['SPEECH', 'MULTIMODAL']:
                    print("等待分析完成...")
                    await asyncio.sleep(5)  # 等待分析完成
            else:
                print("未知命令")
    
    except KeyboardInterrupt:
        print("\n程序被中断")
    
    finally:
        await client.disconnect()
        print("程序结束")

if __name__ == "__main__":
    # 安装依赖: pip install bleak matplotlib
    asyncio.run(main())
