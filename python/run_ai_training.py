"""
完整AI訓練和部署自動化腳本
"""

import sys
import os
import subprocess

def run_training():
    """運行AI模型訓練"""
    print("[START] 開始AI模型訓練...")
    
    try:
        # 切換到機器學習目錄
        os.chdir("machine_learning")
        
        # 運行模型訓練
        result = subprocess.run([sys.executable, "simple_parkinson_model.py"], 
                              capture_output=True, text=True)
        
        print("訓練輸出:")
        print(result.stdout)
        
        if result.stderr:
            print("錯誤信息:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("[SUCCESS] AI模型訓練成功!")
            return True
        else:
            print("[ERROR] AI模型訓練失敗!")
            return False
            
    except Exception as e:
        print(f"[ERROR] 訓練過程出錯: {e}")
        return False
    finally:
        # 回到原目錄
        os.chdir("..")

def run_conversion():
    """運行模型轉換"""
    print("\n[START] 開始模型轉換...")
    
    try:
        # 切換到機器學習目錄
        os.chdir("machine_learning")
        
        # 運行模型轉換
        result = subprocess.run([sys.executable, "convert_to_arduino.py"], 
                              capture_output=True, text=True)
        
        print("轉換輸出:")
        print(result.stdout)
        
        if result.stderr:
            print("錯誤信息:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("[SUCCESS] 模型轉換成功!")
            return True
        else:
            print("[ERROR] 模型轉換失敗!")
            return False
            
    except Exception as e:
        print(f"[ERROR] 轉換過程出錯: {e}")
        return False
    finally:
        # 回到原目錄
        os.chdir("..")

def main():
    """主程序"""
    print(">>> 帕金森症AI系統完整部署")
    print("=" * 50)
    
    # 步驟1: 訓練AI模型
    if run_training():
        # 步驟2: 轉換為Arduino格式
        if run_conversion():
            print("\n[SUCCESS] AI系統部署完成!")
            print("\n[NEXT] 下一步操作:")
            print("1. 重新編譯Arduino代碼")
            print("2. 上傳到Arduino Nano 33 BLE Sense Rev2")
            print("3. 打開串口監視器 (9600波特率)")
            print("4. 發送 'START' 命令測試AI功能")
            print("5. 觀察AI分析結果和訓練建議")
            
            print("\n[SUCCESS] 現在您有了完整的AI功能!")
            return True
        else:
            print("\n[ERROR] 模型轉換失敗，請檢查錯誤信息")
            return False
    else:
        print("\n[ERROR] 模型訓練失敗，請檢查錯誤信息")
        return False

if __name__ == "__main__":
    main()