export type AISeverityResult = {
  severityPercent: number; // 0..100
  stage: 'mild' | 'moderate' | 'severe';
  confidencePercent: number; // 0..100
};

export type RecommendationGroup = {
  category: string;
  items: string[];
};

export function classifySeverity(severityPercent: number): AISeverityResult {
  const clamped = Math.max(0, Math.min(100, severityPercent));
  let stage: AISeverityResult['stage'] = 'mild';
  if (clamped >= 70) stage = 'severe';
  else if (clamped >= 40) stage = 'moderate';
  return {
    severityPercent: clamped,
    stage,
    confidencePercent: 80,
  };
}

export function getRecommendations(severityPercent: number): RecommendationGroup[] {
  const { stage } = classifySeverity(severityPercent);

  const core: RecommendationGroup[] = [
    {
      category: '有氧運動（每週3-5天）',
      items: [
        '快走 30–45 分鐘（RPE 11–13，能說話但略喘）',
        '室內腳踏車 20–30 分鐘（間歇：2 分鐘輕鬆 / 1 分鐘稍吃力，重複 8–10 回）',
        '游泳或水中有氧 30 分鐘，重點放鬆僵硬並提升耐力'
      ]
    },
    {
      category: '阻力訓練（每週2–3天）',
      items: [
        '大肌群訓練（深蹲、臀橋、划船、推胸）：每動作 2–3 組 × 8–12 下',
        '彈力帶肩外展/外旋強化，改善姿勢與軀幹穩定',
        '踝部負重抬腿與階梯踏步，強化下肢反應與起身能力'
      ]
    },
    {
      category: '柔軟度與關節活動（每日）',
      items: [
        '頸、肩、髖、踝關節溫和伸展各 20–30 秒 × 2–3 回',
        '胸椎旋轉與胸肌放鬆，改善駝背與肩部前傾',
        '阿拉斯加大字（BIG）動作：誇張伸展上肢與步幅'
      ]
    },
    {
      category: '平衡與步態（每週3天）',
      items: [
        '地標步伐訓練（跨越標線、方塊踏步），加入節拍器或節奏聲（100–120 BPM）',
        '轉身與起立練習：坐-站 10 次 × 2 組，強調對稱與穩定',
        '側向步伐與後退走，提高方向變換的穩定度'
      ]
    },
    {
      category: '精細動作與上肢協調（每週3天）',
      items: [
        '手指敲擊、旋鈕操作、夾珠訓練，單手與雙手交替 10–15 分鐘',
        '手腕前臂伸展與橡皮筋開合，緩解僵硬並提升靈活度',
        '節拍器輔助的手指–拇指對指訓練（變速 80→100 BPM）'
      ]
    }
  ];

  const advanced: RecommendationGroup[] = [
    {
      category: '節律與音樂治療（Rhythmic Auditory Stimulation）',
      items: [
        '配合音樂節拍進行步行訓練，逐步提升 5–10% 步頻',
        '使用節拍器維持穩定步幅與步頻，改善凍結步態'
      ]
    },
    {
      category: '太極 / 氣功（每週2–3天）',
      items: [
        '24 式太極（前 8–12 式），重點重心轉移與上肢開展',
        '八段錦或易筋經，配合呼吸節律，放鬆僵硬'
      ]
    },
    {
      category: '拳擊/舞蹈（功能性整合）',
      items: [
        '非接觸式拳擊課程（Rock Steady Boxing 類型）每次 45–60 分鐘',
        '探戈或華爾滋舞步訓練，強化方向切換、步幅與姿勢控制'
      ]
    },
    {
      category: '語音與呼吸訓練（LSVT/呼吸肌）',
      items: [
        '大聲朗讀與延音（LSVT 概念），每日 10–15 分鐘',
        '呼吸肌訓練器 30 次/日（依裝置阻力分級）'
      ]
    },
    {
      category: '雙重作業（Dual-task）',
      items: [
        '邊走邊數 7 的倍數、命名水果/城市，提升注意轉移',
        '倒退行走配合節拍器（確保安全場地）'
      ]
    }
  ];

  if (stage === 'mild') return core;
  if (stage === 'moderate') return [...core, ...advanced.slice(0, 3)];
  return [...core, ...advanced];
}