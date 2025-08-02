# -*- coding: utf-8 -*-
"""
快速AI設置 - 不使用emoji字符，避免編碼問題
"""

import sys
import os

# 確保可以導入machine_learning模組
sys.path.append(os.path.join(os.path.dirname(__file__), 'machine_learning'))

def quick_setup():
    print("=== 帕金森症AI系統快速設置 ===")
    print("正在初始化...")
    
    try:
        # 導入並運行簡化模型
        from simple_parkinson_model import SimpleParkinsonModel
        
        print("[1/3] 創建AI模型...")
        model = SimpleParkinsonModel()
        
        print("[2/3] 生成訓練數據...")
        X_train, y_train = model.create_synthetic_data(500)  # 減少數據量加快速度
        
        print("[3/3] 訓練模型...")
        accuracy = model.train(X_train, y_train)
        
        print(f"訓練完成，準確率: {accuracy:.2f}")
        
        # 保存模型
        os.makedirs('models', exist_ok=True)
        model.save_model()
        
        # 測試預測
        test_result = model.predict(X_train[0])
        print(f"測試預測 - 等級: {test_result['predicted_level']}, 置信度: {test_result['confidence']:.3f}")
        
        print("\n=== 步驟1完成：AI模型訓練 ===")
        
        # 轉換為Arduino格式
        print("\n=== 步驟2：轉換為Arduino格式 ===")
        from convert_to_arduino import main as convert_main
        
        success = convert_main()
        
        if success:
            print("\n=== 設置完成！===")
            print("下一步操作:")
            print("1. 重新編譯Arduino代碼")
            print("2. 上傳到Arduino板")
            print("3. 測試AI功能")
            return True
        else:
            print("轉換失敗")
            return False
            
    except Exception as e:
        print(f"設置失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    quick_setup()