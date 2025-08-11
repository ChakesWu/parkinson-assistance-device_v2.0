// 語音分析配置和優化參數
export const SPEECH_ANALYSIS_CONFIG = {
  // 採集參數
  DURATION_MS: 7000, // 7秒採集時間
  SAMPLE_RATE: 16000, // 16kHz採樣率
  BUFFER_SIZE: 1024, // 緩衝區大小
  
  // 進度條更新參數
  PROGRESS_UPDATE_INTERVAL: 50, // 50ms更新一次
  TIMEOUT_BUFFER_MS: 2000, // 2秒超時緩衝
  
  // 特徵提取參數
  FEATURES: {
    F0_MIN: 80, // 最小基頻 (Hz)
    F0_MAX: 400, // 最大基頻 (Hz)
    JITTER_THRESHOLD: 0.015, // Jitter閾值
    SHIMMER_THRESHOLD: 0.05, // Shimmer閾值
    HNR_THRESHOLD: 15, // HNR閾值 (dB)
    SILENCE_THRESHOLD: 0.3, // 靜音比閾值
  },
  
  // 帕金森檢測閾值
  PARKINSON_THRESHOLDS: {
    JITTER_HIGH: 0.015, // 高Jitter值
    SHIMMER_HIGH: 0.05, // 高Shimmer值
    HNR_LOW: 15, // 低HNR值
    SILENCE_HIGH: 0.3, // 高靜音比
    VOICE_ACTIVITY_LOW: 0.6, // 低語音活躍度
  },
  
  // 分析階段
  ANALYSIS_STAGES: [
    { threshold: 20, message: '正在採集語音信號...', description: '收集原始音頻數據' },
    { threshold: 50, message: '正在分析語音特徵...', description: '提取基頻、Jitter、Shimmer等特徵' },
    { threshold: 80, message: '正在檢測帕金森症狀...', description: '分析語音穩定性和連續性' },
    { threshold: 100, message: '正在生成分析報告...', description: '計算最終結果和建議' },
  ],
  
  // 語音採集指導
  VOICE_INSTRUCTIONS: [
    '請保持安靜的環境',
    '清晰發音："啊啊啊" 或數數 "1, 2, 3..."',
    '保持穩定的音量和語速',
    '7秒採集時間可提高檢測準確性',
  ],
  
  // 結果解釋
  RESULT_INTERPRETATION: {
    JITTER: {
      description: '基頻穩定性',
      normal: '< 0.015',
      abnormal: '≥ 0.015',
      parkinson_indicator: '帕金森患者通常 > 0.015',
    },
    SHIMMER: {
      description: '振幅穩定性',
      normal: '< 0.05',
      abnormal: '≥ 0.05',
      parkinson_indicator: '帕金森患者通常 > 0.05',
    },
    HNR: {
      description: '聲音清晰度',
      normal: '> 15 dB',
      abnormal: '≤ 15 dB',
      parkinson_indicator: '帕金森患者通常 < 15dB',
    },
    SILENCE_RATIO: {
      description: '語音連續性',
      normal: '< 30%',
      abnormal: '≥ 30%',
      parkinson_indicator: '帕金森患者通常 > 30%',
    },
  },
};

// 獲取當前分析階段信息
export function getCurrentAnalysisStage(progress: number) {
  for (const stage of SPEECH_ANALYSIS_CONFIG.ANALYSIS_STAGES) {
    if (progress <= stage.threshold) {
      return stage;
    }
  }
  return SPEECH_ANALYSIS_CONFIG.ANALYSIS_STAGES[SPEECH_ANALYSIS_CONFIG.ANALYSIS_STAGES.length - 1];
}

// 計算剩餘時間
export function calculateRemainingTime(progress: number): number {
  const remainingProgress = Math.max(0, 100 - progress);
  return Math.ceil((remainingProgress * SPEECH_ANALYSIS_CONFIG.DURATION_MS) / 100 / 1000);
}

// 語音特徵評估
export function evaluateSpeechFeature(featureName: keyof typeof SPEECH_ANALYSIS_CONFIG.RESULT_INTERPRETATION, value: number): {
  status: 'normal' | 'warning' | 'abnormal';
  color: string;
  description: string;
} {
  const thresholds = SPEECH_ANALYSIS_CONFIG.PARKINSON_THRESHOLDS;
  
  switch (featureName) {
    case 'JITTER':
      if (value < thresholds.JITTER_HIGH * 0.7) {
        return { status: 'normal', color: 'text-green-600', description: '正常範圍' };
      } else if (value < thresholds.JITTER_HIGH) {
        return { status: 'warning', color: 'text-yellow-600', description: '輕微異常' };
      } else {
        return { status: 'abnormal', color: 'text-red-600', description: '可能異常' };
      }
    
    case 'SHIMMER':
      if (value < thresholds.SHIMMER_HIGH * 0.6) {
        return { status: 'normal', color: 'text-green-600', description: '正常範圍' };
      } else if (value < thresholds.SHIMMER_HIGH) {
        return { status: 'warning', color: 'text-yellow-600', description: '輕微異常' };
      } else {
        return { status: 'abnormal', color: 'text-red-600', description: '可能異常' };
      }
    
    case 'HNR':
      if (value > thresholds.HNR_LOW * 1.3) {
        return { status: 'normal', color: 'text-green-600', description: '正常範圍' };
      } else if (value > thresholds.HNR_LOW) {
        return { status: 'warning', color: 'text-yellow-600', description: '輕微異常' };
      } else {
        return { status: 'abnormal', color: 'text-red-600', description: '可能異常' };
      }
    
    case 'SILENCE_RATIO':
      if (value < thresholds.SILENCE_HIGH * 0.7) {
        return { status: 'normal', color: 'text-green-600', description: '正常範圍' };
      } else if (value < thresholds.SILENCE_HIGH) {
        return { status: 'warning', color: 'text-yellow-600', description: '輕微異常' };
      } else {
        return { status: 'abnormal', color: 'text-red-600', description: '可能異常' };
      }
    
    default:
      return { status: 'normal', color: 'text-gray-600', description: '未知' };
  }
}
