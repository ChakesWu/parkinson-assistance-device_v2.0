/**
 * AI分析记录数据存储服务
 * 管理AI分析记录的存储、检索和管理
 */

export interface AnalysisRecord {
  id: string;
  timestamp: string;
  analysisCount: number;
  parkinsonLevel: number;
  parkinsonDescription: string;
  confidence: number;
  recommendation: string;
  recommendedResistance: number;
  sensorData?: {
    fingerPositions: number[];
    accelerometer: { x: number; y: number; z: number };
    gyroscope: { x: number; y: number; z: number };
    emg: number;
  };
  analysisDetails?: {
    tremorFrequency?: number;
    graspQuality?: number;
    emgRms?: number;
    overallSeverity?: number;
    fingerSummary?: string;
    tremorSummary?: string;
    emgSummary?: string;
  };
  source: 'arduino' | 'web-analysis' | 'manual';
  duration?: number; // 分析持续时间（秒）
}

export interface AnalysisStatistics {
  totalAnalyses: number;
  averageLevel: number;
  averageConfidence: number;
  levelDistribution: { [level: number]: number };
  recentTrend: 'improving' | 'stable' | 'declining';
  lastAnalysisDate: string | null;
}

class AnalysisRecordService {
  private readonly STORAGE_KEY = 'parkinson_analysis_records';
  private readonly MAX_RECORDS = 1000; // 最大记录数量

  /**
   * 保存新的分析记录
   */
  saveRecord(record: Omit<AnalysisRecord, 'id' | 'timestamp'>): AnalysisRecord {
    console.log('AnalysisRecordService: 開始保存記錄', record);

    const newRecord: AnalysisRecord = {
      ...record,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    const records = this.getAllRecords();
    console.log('AnalysisRecordService: 當前記錄數量', records.length);

    records.unshift(newRecord); // 添加到开头（最新的在前）

    // 限制记录数量
    if (records.length > this.MAX_RECORDS) {
      records.splice(this.MAX_RECORDS);
    }

    this.saveToStorage(records);
    console.log('AnalysisRecordService: 記錄保存成功，新記錄數量', records.length);
    return newRecord;
  }

  /**
   * 获取所有记录
   */
  getAllRecords(): AnalysisRecord[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return [];
      }
      const stored = localStorage.getItem(this.STORAGE_KEY);
      console.log('AnalysisRecordService: localStorage 數據', stored ? '存在' : '不存在');

      if (!stored) return [];

      const records = JSON.parse(stored) as AnalysisRecord[];
      const validRecords = Array.isArray(records) ? records : [];
      console.log('AnalysisRecordService: 載入記錄數量', validRecords.length);
      return validRecords;
    } catch (error) {
      console.error('Error loading analysis records:', error);
      return [];
    }
  }

  /**
   * 根据ID获取记录
   */
  getRecordById(id: string): AnalysisRecord | null {
    const records = this.getAllRecords();
    return records.find(record => record.id === id) || null;
  }

  /**
   * 获取最近的N条记录
   */
  getRecentRecords(count: number = 10): AnalysisRecord[] {
    const records = this.getAllRecords();
    return records.slice(0, count);
  }

  /**
   * 根据日期范围获取记录
   */
  getRecordsByDateRange(startDate: Date, endDate: Date): AnalysisRecord[] {
    const records = this.getAllRecords();
    return records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  /**
   * 根据帕金森等级筛选记录
   */
  getRecordsByLevel(level: number): AnalysisRecord[] {
    const records = this.getAllRecords();
    return records.filter(record => record.parkinsonLevel === level);
  }

  /**
   * 删除记录
   */
  deleteRecord(id: string): boolean {
    const records = this.getAllRecords();
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) return false;
    
    records.splice(index, 1);
    this.saveToStorage(records);
    return true;
  }

  /**
   * 清空所有记录
   */
  clearAllRecords(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * 获取分析统计信息
   */
  getStatistics(): AnalysisStatistics {
    const records = this.getAllRecords();
    
    if (records.length === 0) {
      return {
        totalAnalyses: 0,
        averageLevel: 0,
        averageConfidence: 0,
        levelDistribution: {},
        recentTrend: 'stable',
        lastAnalysisDate: null,
      };
    }

    // 计算基本统计
    const totalAnalyses = records.length;
    const averageLevel = records.reduce((sum, r) => sum + r.parkinsonLevel, 0) / totalAnalyses;
    const averageConfidence = records.reduce((sum, r) => sum + r.confidence, 0) / totalAnalyses;

    // 等级分布
    const levelDistribution: { [level: number]: number } = {};
    records.forEach(record => {
      levelDistribution[record.parkinsonLevel] = (levelDistribution[record.parkinsonLevel] || 0) + 1;
    });

    // 趋势分析（比较最近5次和之前5次的平均等级）
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (records.length >= 10) {
      const recent5 = records.slice(0, 5);
      const previous5 = records.slice(5, 10);
      const recentAvg = recent5.reduce((sum, r) => sum + r.parkinsonLevel, 0) / 5;
      const previousAvg = previous5.reduce((sum, r) => sum + r.parkinsonLevel, 0) / 5;
      
      if (recentAvg < previousAvg - 0.2) recentTrend = 'improving';
      else if (recentAvg > previousAvg + 0.2) recentTrend = 'declining';
    }

    return {
      totalAnalyses,
      averageLevel: Math.round(averageLevel * 10) / 10,
      averageConfidence: Math.round(averageConfidence * 10) / 10,
      levelDistribution,
      recentTrend,
      lastAnalysisDate: records[0]?.timestamp || null,
    };
  }

  /**
   * 导出记录为JSON
   */
  exportRecords(): string {
    const records = this.getAllRecords();
    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: records.length,
      records: records,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 从JSON导入记录
   */
  importRecords(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    try {
      const data = JSON.parse(jsonData);
      const errors: string[] = [];
      let imported = 0;

      if (!data.records || !Array.isArray(data.records)) {
        return { success: false, imported: 0, errors: ['Invalid data format'] };
      }

      const existingRecords = this.getAllRecords();
      const existingIds = new Set(existingRecords.map(r => r.id));

      data.records.forEach((record: any, index: number) => {
        try {
          // 验证记录格式
          if (!this.validateRecord(record)) {
            errors.push(`Record ${index + 1}: Invalid format`);
            return;
          }

          // 避免重复导入
          if (existingIds.has(record.id)) {
            errors.push(`Record ${index + 1}: Duplicate ID ${record.id}`);
            return;
          }

          existingRecords.push(record);
          imported++;
        } catch (error) {
          errors.push(`Record ${index + 1}: ${error}`);
        }
      });

      // 按时间排序并限制数量
      existingRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (existingRecords.length > this.MAX_RECORDS) {
        existingRecords.splice(this.MAX_RECORDS);
      }

      this.saveToStorage(existingRecords);
      return { success: true, imported, errors };
    } catch (error) {
      return { success: false, imported: 0, errors: [`Parse error: ${error}`] };
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 保存到localStorage
   */
  private saveToStorage(records: AnalysisRecord[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      }
    } catch (error) {
      console.error('Error saving analysis records:', error);
      throw new Error('Failed to save records to storage');
    }
  }

  /**
   * 验证记录格式
   */
  private validateRecord(record: any): boolean {
    return (
      typeof record.id === 'string' &&
      typeof record.timestamp === 'string' &&
      typeof record.parkinsonLevel === 'number' &&
      typeof record.confidence === 'number' &&
      typeof record.source === 'string' &&
      record.parkinsonLevel >= 0 && record.parkinsonLevel <= 5 &&
      record.confidence >= 0 && record.confidence <= 100
    );
  }
}

// 创建单例实例
export const analysisRecordService = new AnalysisRecordService();
