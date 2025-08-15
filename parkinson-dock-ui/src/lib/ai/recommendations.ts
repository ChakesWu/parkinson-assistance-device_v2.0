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
      category: '有氧运动（每周3-5天）',
      items: [
        '快走 30–45 分钟（RPE 11–13，能说话但略喘）',
        '室内脚踏车 20–30 分钟（间歇：2 分钟轻松 / 1 分钟稍吃力，重复 8–10 回）',
        '游泳或水中有氧 30 分钟，重点放松僵硬并提升耐力'
      ]
    },
    {
      category: '阻力训练（每周2–3天）',
      items: [
        '大肌群训练（深蹲、臀桥、划船、推胸）：每动作 2–3 组 × 8–12 下',
        '弹力带肩外展/外旋强化，改善姿势与躯干稳定',
        '踝部负重抬腿与阶梯踏步，强化下肢反应与起身能力'
      ]
    },
    {
      category: '柔软度与关节活动（每日）',
      items: [
        '颈、肩、髋、踝关节温和伸展各 20–30 秒 × 2–3 回',
        '胸椎旋转与胸肌放松，改善驼背与肩部前倾',
        '阿拉斯加大字（BIG）动作：夸张伸展上肢与步幅'
      ]
    },
    {
      category: '平衡与步态（每周3天）',
      items: [
        '地标步伐训练（跨越标线、方块踏步），加入节拍器或节奏声（100–120 BPM）',
        '转身与起立练习：坐-站 10 次 × 2 组，强调对称与稳定',
        '侧向步伐与后退走，提高方向变换的稳定度'
      ]
    },
    {
      category: '精细动作与上肢协调（每周3天）',
      items: [
        '手指敲击、旋钮操作、夹珠训练，单手与双手交替 10–15 分钟',
        '手腕前臂伸展与橡皮筋开合，缓解僵硬并提升灵活度',
        '节拍器辅助的手指–拇指对指训练（变速 80→100 BPM）'
      ]
    }
  ];

  const advanced: RecommendationGroup[] = [
    {
      category: '节律与音乐治疗（Rhythmic Auditory Stimulation）',
      items: [
        '配合音乐节拍进行步行训练，逐步提升 5–10% 步频',
        '使用节拍器维持稳定步幅与步频，改善冻结步态'
      ]
    },
    {
      category: '太极 / 气功（每周2–3天）',
      items: [
        '24 式太极（前 8–12 式），重点重心转移与上肢开展',
        '八段锦或易筋经，配合呼吸节律，放松僵硬'
      ]
    },
    {
      category: '拳击/舞蹈（功能性整合）',
      items: [
        '非接触式拳击课程（Rock Steady Boxing 类型）每次 45–60 分钟',
        '探戈或华尔兹舞步训练，强化方向切换、步幅与姿势控制'
      ]
    },
    {
      category: '语音与呼吸训练（LSVT/呼吸肌）',
      items: [
        '大声朗读与延音（LSVT 概念），每日 10–15 分钟',
        '呼吸肌训练器 30 次/日（依装置阻力分级）'
      ]
    },
    {
      category: '双重作业（Dual-task）',
      items: [
        '边走边数 7 的倍数、命名水果/城市，提升注意转移',
        '倒退行走配合节拍器（确保安全场地）'
      ]
    }
  ];

  if (stage === 'mild') return core;
  if (stage === 'moderate') return [...core, ...advanced.slice(0, 3)];
  return [...core, ...advanced];
}