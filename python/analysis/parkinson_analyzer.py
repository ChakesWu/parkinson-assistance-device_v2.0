"""
帕金森症狀分析和訓練方案生成系統
基於CNN-LSTM模型的預測結果提供個性化分析和建議
"""

import numpy as np
import json
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass
from typing import List, Dict, Tuple

@dataclass
class ParkinsonAssessment:
    """帕金森評估結果"""
    patient_id: str
    assessment_time: str
    predicted_level: int
    confidence: float
    symptom_analysis: Dict
    training_plan: Dict
    recommendations: List[str]

class ParkinsonAnalyzer:
    def __init__(self):
        """初始化帕金森分析器"""
        self.assessment_history = []
        
        # 症狀嚴重程度定義
        self.severity_levels = {
            1: {"name": "輕度", "description": "輕微震顫，日常活動基本正常"},
            2: {"name": "輕中度", "description": "震顫增加，開始影響精細動作"},
            3: {"name": "中度", "description": "明顯運動遲緩，平衡問題出現"},
            4: {"name": "中重度", "description": "嚴重運動障礙，需要輔助"},
            5: {"name": "重度", "description": "行動嚴重受限，需要全面照護"}
        }
        
        # 訓練方案模板
        self.training_templates = {
            1: {
                "duration": "15-20分鐘",
                "intensity": "低強度",
                "servo_resistance": 30,
                "exercises": [
                    "手指靈活性練習",
                    "輕度握力訓練",
                    "協調性動作練習"
                ],
                "frequency": "每日2次",
                "goals": ["維持現有功能", "預防症狀惡化"]
            },
            2: {
                "duration": "20-25分鐘", 
                "intensity": "低中強度",
                "servo_resistance": 60,
                "exercises": [
                    "精細動作控制",
                    "手指獨立性訓練",
                    "反應時間改善練習"
                ],
                "frequency": "每日2-3次",
                "goals": ["改善協調性", "增強手指控制"]
            },
            3: {
                "duration": "25-30分鐘",
                "intensity": "中強度", 
                "servo_resistance": 90,
                "exercises": [
                    "阻力訓練",
                    "平衡協調練習",
                    "功能性動作訓練"
                ],
                "frequency": "每日3次",
                "goals": ["增強肌力", "改善運動控制"]
            },
            4: {
                "duration": "20-30分鐘",
                "intensity": "中高強度",
                "servo_resistance": 120,
                "exercises": [
                    "輔助性力量訓練",
                    "被動關節活動",
                    "平衡穩定性練習"
                ],
                "frequency": "每日2-3次",
                "goals": ["維持肌力", "防止關節僵硬"]
            },
            5: {
                "duration": "15-25分鐘",
                "intensity": "適應性訓練",
                "servo_resistance": 150,
                "exercises": [
                    "被動輔助訓練",
                    "關節可動度維持",
                    "基礎功能保持"
                ],
                "frequency": "每日多次短時間",
                "goals": ["維持基本功能", "提高生活質量"]
            }
        }
    
    def analyze_sensor_patterns(self, sensor_data: Dict) -> Dict:
        """
        分析傳感器數據模式
        
        Args:
            sensor_data: 包含手指、EMG、IMU數據的字典
        """
        analysis = {}
        
        # 手指動作分析
        finger_data = sensor_data.get('fingers', [])
        if finger_data:
            finger_analysis = {
                'flexibility': np.std(finger_data, axis=0).mean(),  # 靈活性
                'coordination': np.corrcoef(np.array(finger_data).T).mean(),  # 協調性
                'symmetry': self._calculate_symmetry(finger_data),  # 對稱性
                'tremor_index': self._calculate_tremor_index(finger_data)  # 震顫指數
            }
            analysis['finger_analysis'] = finger_analysis
        
        # EMG肌電分析
        emg_data = sensor_data.get('emg', [])
        if emg_data:
            emg_analysis = {
                'muscle_activation': np.mean(np.abs(emg_data)),  # 肌肉激活
                'fatigue_index': self._calculate_fatigue_index(emg_data),  # 疲勞指數
                'control_stability': 1.0 / (np.std(emg_data) + 1e-6)  # 控制穩定性
            }
            analysis['emg_analysis'] = emg_analysis
        
        # IMU運動分析
        imu_data = sensor_data.get('imu', [])
        if imu_data:
            imu_analysis = {
                'movement_smoothness': self._calculate_smoothness(imu_data),  # 運動平滑度
                'balance_index': self._calculate_balance_index(imu_data),  # 平衡指數
                'tremor_frequency': self._estimate_tremor_frequency(imu_data)  # 震顫頻率
            }
            analysis['imu_analysis'] = imu_analysis
        
        return analysis
    
    def _calculate_symmetry(self, finger_data: List) -> float:
        """計算手指動作對稱性"""
        finger_array = np.array(finger_data)
        if finger_array.shape[1] >= 5:
            # 比較拇指與小指，食指與無名指的對稱性
            thumb_pinky = np.corrcoef(finger_array[:, 0], finger_array[:, 4])[0, 1]
            index_ring = np.corrcoef(finger_array[:, 1], finger_array[:, 3])[0, 1]
            return (abs(thumb_pinky) + abs(index_ring)) / 2
        return 0.5
    
    def _calculate_tremor_index(self, data: List) -> float:
        """計算震顫指數"""
        data_array = np.array(data)
        if len(data_array.shape) == 1:
            data_array = data_array.reshape(-1, 1)
        
        # 計算高頻成分的能量
        tremor_index = 0
        for col in range(data_array.shape[1]):
            signal = data_array[:, col]
            if len(signal) > 10:
                # 簡單的高頻能量估計
                diff_signal = np.diff(signal)
                tremor_index += np.var(diff_signal)
        
        return tremor_index / data_array.shape[1] if data_array.shape[1] > 0 else 0
    
    def _calculate_fatigue_index(self, emg_data: List) -> float:
        """計算肌肉疲勞指數"""
        if len(emg_data) < 10:
            return 0.5
        
        # 分析EMG信號的變化趨勢
        emg_array = np.array(emg_data)
        window_size = len(emg_array) // 4
        
        early_power = np.mean(emg_array[:window_size] ** 2)
        late_power = np.mean(emg_array[-window_size:] ** 2)
        
        # 疲勞指數：後期功率與前期功率的比值
        fatigue_index = late_power / (early_power + 1e-6)
        return min(fatigue_index, 2.0)  # 限制最大值
    
    def _calculate_smoothness(self, imu_data: List) -> float:
        """計算運動平滑度"""
        imu_array = np.array(imu_data)
        if len(imu_array.shape) == 1:
            imu_array = imu_array.reshape(-1, 1)
        
        smoothness = 0
        for col in range(imu_array.shape[1]):
            signal = imu_array[:, col]
            if len(signal) > 2:
                # 計算加速度的變化率（Jerk）
                jerk = np.diff(signal, 2)
                smoothness += 1.0 / (np.std(jerk) + 1e-6)
        
        return smoothness / imu_array.shape[1] if imu_array.shape[1] > 0 else 0
    
    def _calculate_balance_index(self, imu_data: List) -> float:
        """計算平衡指數"""
        imu_array = np.array(imu_data)
        if len(imu_array.shape) == 1:
            return 1.0 / (np.std(imu_array) + 1e-6)
        
        # 計算三軸加速度的整體穩定性
        total_acceleration = np.sqrt(np.sum(imu_array ** 2, axis=1))
        balance_index = 1.0 / (np.std(total_acceleration) + 1e-6)
        
        return min(balance_index, 10.0)  # 限制最大值
    
    def _estimate_tremor_frequency(self, imu_data: List) -> float:
        """估計震顫頻率"""
        imu_array = np.array(imu_data)
        if len(imu_array) < 20:
            return 0
        
        # 簡單的頻率估計（基於峰值檢測）
        if len(imu_array.shape) > 1:
            signal = np.sqrt(np.sum(imu_array ** 2, axis=1))
        else:
            signal = imu_array
        
        # 檢測峰值
        peaks = []
        for i in range(1, len(signal) - 1):
            if signal[i] > signal[i-1] and signal[i] > signal[i+1]:
                peaks.append(i)
        
        if len(peaks) > 2:
            # 估計平均頻率
            intervals = np.diff(peaks)
            avg_interval = np.mean(intervals)
            frequency = 100.0 / avg_interval  # 假設100Hz採樣率
            return frequency
        
        return 0
    
    def generate_assessment(self, patient_id: str, predicted_level: int, 
                          confidence: float, sensor_data: Dict) -> ParkinsonAssessment:
        """
        生成完整的帕金森評估報告
        
        Args:
            patient_id: 患者ID
            predicted_level: 預測的帕金森等級
            confidence: 預測置信度
            sensor_data: 傳感器數據
        """
        # 分析傳感器模式
        symptom_analysis = self.analyze_sensor_patterns(sensor_data)
        
        # 生成訓練計劃
        training_plan = self.generate_training_plan(predicted_level, symptom_analysis)
        
        # 生成建議
        recommendations = self.generate_recommendations(predicted_level, symptom_analysis)
        
        # 創建評估對象
        assessment = ParkinsonAssessment(
            patient_id=patient_id,
            assessment_time=datetime.now().isoformat(),
            predicted_level=predicted_level,
            confidence=confidence,
            symptom_analysis=symptom_analysis,
            training_plan=training_plan,
            recommendations=recommendations
        )
        
        # 添加到歷史記錄
        self.assessment_history.append(assessment)
        
        return assessment
    
    def generate_training_plan(self, level: int, symptom_analysis: Dict) -> Dict:
        """生成個性化訓練計劃"""
        base_plan = self.training_templates.get(level, self.training_templates[3])
        
        # 根據症狀分析調整計劃
        adjusted_plan = base_plan.copy()
        
        # 根據震顫程度調整
        if 'finger_analysis' in symptom_analysis:
            tremor_index = symptom_analysis['finger_analysis'].get('tremor_index', 0)
            if tremor_index > 0.5:
                adjusted_plan['servo_resistance'] = max(30, adjusted_plan['servo_resistance'] - 20)
                adjusted_plan['exercises'].insert(0, "震顫控制練習")
        
        # 根據肌力情況調整
        if 'emg_analysis' in symptom_analysis:
            muscle_activation = symptom_analysis['emg_analysis'].get('muscle_activation', 0)
            if muscle_activation < 0.3:
                adjusted_plan['exercises'].append("肌力強化訓練")
                adjusted_plan['duration'] = "30-35分鐘"
        
        # 根據平衡問題調整
        if 'imu_analysis' in symptom_analysis:
            balance_index = symptom_analysis['imu_analysis'].get('balance_index', 1)
            if balance_index < 2:
                adjusted_plan['exercises'].append("平衡穩定性訓練")
        
        return adjusted_plan
    
    def generate_recommendations(self, level: int, symptom_analysis: Dict) -> List[str]:
        """生成個性化建議"""
        recommendations = []
        
        # 基於等級的基本建議
        level_info = self.severity_levels.get(level, self.severity_levels[3])
        recommendations.append(f"當前狀態：{level_info['name']} - {level_info['description']}")
        
        # 基於症狀分析的具體建議
        if 'finger_analysis' in symptom_analysis:
            finger_analysis = symptom_analysis['finger_analysis']
            
            if finger_analysis.get('flexibility', 0) < 0.5:
                recommendations.append("建議增加手指靈活性練習，每天至少3次")
            
            if finger_analysis.get('coordination', 0) < 0.6:
                recommendations.append("重點進行手指協調性訓練")
            
            if finger_analysis.get('tremor_index', 0) > 0.3:
                recommendations.append("建議進行震顫控制練習，使用較低的阻力設定")
        
        if 'emg_analysis' in symptom_analysis:
            emg_analysis = symptom_analysis['emg_analysis']
            
            if emg_analysis.get('fatigue_index', 1) > 1.5:
                recommendations.append("注意避免過度疲勞，適當休息")
            
            if emg_analysis.get('muscle_activation', 0) < 0.3:
                recommendations.append("增加肌力訓練，但要循序漸進")
        
        if 'imu_analysis' in symptom_analysis:
            imu_analysis = symptom_analysis['imu_analysis']
            
            if imu_analysis.get('balance_index', 1) < 2:
                recommendations.append("重點進行平衡訓練，建議在安全環境下練習")
            
            tremor_freq = imu_analysis.get('tremor_frequency', 0)
            if tremor_freq > 4:
                recommendations.append("震顫頻率較高，建議配合藥物治療")
        
        # 生活方式建議
        if level <= 2:
            recommendations.append("保持規律運動，預防症狀惡化")
        elif level >= 4:
            recommendations.append("考慮尋求專業物理治療師指導")
        
        return recommendations
    
    def save_assessment(self, assessment: ParkinsonAssessment, 
                       filename: str = None) -> str:
        """保存評估報告"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"data/assessment_{assessment.patient_id}_{timestamp}.json"
        
        assessment_dict = {
            'patient_id': assessment.patient_id,
            'assessment_time': assessment.assessment_time,
            'predicted_level': assessment.predicted_level,
            'confidence': assessment.confidence,
            'symptom_analysis': assessment.symptom_analysis,
            'training_plan': assessment.training_plan,
            'recommendations': assessment.recommendations
        }
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(assessment_dict, f, indent=2, ensure_ascii=False)
            print(f"評估報告已保存: {filename}")
            return filename
        except Exception as e:
            print(f"保存評估報告失敗: {e}")
            return None
    
    def print_assessment_report(self, assessment: ParkinsonAssessment):
        """打印評估報告"""
        print("=" * 50)
        print("帕金森症狀評估報告")
        print("=" * 50)
        print(f"患者ID: {assessment.patient_id}")
        print(f"評估時間: {assessment.assessment_time}")
        print(f"預測等級: {assessment.predicted_level} ({self.severity_levels[assessment.predicted_level]['name']})")
        print(f"置信度: {assessment.confidence:.3f}")
        
        print("\n症狀分析:")
        if 'finger_analysis' in assessment.symptom_analysis:
            finger = assessment.symptom_analysis['finger_analysis']
            print(f"  手指靈活性: {finger.get('flexibility', 0):.3f}")
            print(f"  協調性: {finger.get('coordination', 0):.3f}")
            print(f"  震顫指數: {finger.get('tremor_index', 0):.3f}")
        
        print(f"\n訓練計劃:")
        plan = assessment.training_plan
        print(f"  訓練時長: {plan['duration']}")
        print(f"  強度: {plan['intensity']}")
        print(f"  舵機阻力: {plan['servo_resistance']}度")
        print(f"  頻率: {plan['frequency']}")
        print(f"  訓練項目: {', '.join(plan['exercises'])}")
        
        print(f"\n建議:")
        for i, rec in enumerate(assessment.recommendations, 1):
            print(f"  {i}. {rec}")
        
        print("=" * 50)

def main():
    """主程序 - 分析系統示例"""
    analyzer = ParkinsonAnalyzer()
    
    # 模擬傳感器數據
    sample_sensor_data = {
        'fingers': np.random.randn(100, 5).tolist(),
        'emg': np.random.randn(100).tolist(),
        'imu': np.random.randn(100, 3).tolist()
    }
    
    # 生成評估
    assessment = analyzer.generate_assessment(
        patient_id="TEST001",
        predicted_level=3,
        confidence=0.85,
        sensor_data=sample_sensor_data
    )
    
    # 打印報告
    analyzer.print_assessment_report(assessment)
    
    # 保存報告
    analyzer.save_assessment(assessment)

if __name__ == "__main__":
    main()