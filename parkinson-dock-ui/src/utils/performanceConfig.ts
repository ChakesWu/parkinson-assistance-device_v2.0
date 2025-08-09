// 性能优化配置
export const PERFORMANCE_CONFIG = {
  // 延迟加载时间配置
  DELAYS: {
    CONNECTION_INDICATOR: 500,    // 连接指示器延迟加载时间
    GLOBAL_CONNECTOR: 100,        // 全局连接器初始化延迟
    STATE_REQUEST: 200,           // 状态请求延迟
    BROADCAST_THROTTLE: 50,       // 广播消息节流时间
  },
  
  // 缓存配置
  CACHE: {
    CONNECTION_STATE_TTL: 5 * 60 * 1000, // 连接状态缓存时间 (5分钟)
    DATA_BUFFER_SIZE: 10,                 // 数据缓冲区大小
  },
  
  // 调试配置
  DEBUG: {
    ENABLE_PERFORMANCE_LOGS: process.env.NODE_ENV === 'development',
    ENABLE_CONNECTION_LOGS: process.env.NODE_ENV === 'development',
    LOG_DATA_FREQUENCY: 0.01, // 1%的概率记录数据日志
  },
  
  // 错误处理配置
  ERROR_HANDLING: {
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    TIMEOUT_DURATION: 10000,
  }
};

// 性能监控工具
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  // 记录性能指标
  recordMetric(name: string, value: number) {
    if (!PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) return;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 保持最近100个记录
    if (values.length > 100) {
      values.shift();
    }
  }
  
  // 记录时间指标
  timeStart(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      
      if (PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) {
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      }
    };
  }
  
  // 获取性能统计
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max, count: values.length };
  }
  
  // 打印所有统计信息
  printAllStats() {
    if (!PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) return;
    
    console.group('📊 Performance Statistics');
    for (const [name, values] of this.metrics.entries()) {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`, {
          average: `${stats.avg.toFixed(2)}ms`,
          min: `${stats.min.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          samples: stats.count
        });
      }
    }
    console.groupEnd();
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 异步重试函数
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxAttempts: number = PERFORMANCE_CONFIG.ERROR_HANDLING.MAX_RETRY_ATTEMPTS,
  delay: number = PERFORMANCE_CONFIG.ERROR_HANDLING.RETRY_DELAY
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // 指数退避
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}

// 内存使用监控
export function monitorMemoryUsage() {
  if (!PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) return;
  
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.log('💾 Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
    });
  }
}

// 页面性能监控
export function monitorPagePerformance() {
  if (!PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) return;
  
  // 监控页面加载性能
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      console.log('📄 Page Performance:', {
        domContentLoaded: `${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`,
        loadComplete: `${navigation.loadEventEnd - navigation.loadEventStart}ms`,
        totalTime: `${navigation.loadEventEnd - navigation.navigationStart}ms`
      });
    }, 0);
  });
}

// 连接性能监控装饰器
export function monitorConnection<T extends (...args: any[]) => Promise<any>>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<T>
) {
  const method = descriptor.value!;
  
  descriptor.value = (async function(this: any, ...args: any[]) {
    const monitor = PerformanceMonitor.getInstance();
    const endTimer = monitor.timeStart(`connection.${propertyName}`);
    
    try {
      const result = await method.apply(this, args);
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  }) as T;
  
  return descriptor;
}

// 导出全局性能监控实例
export const performanceMonitor = PerformanceMonitor.getInstance();

// 在开发环境下启动性能监控
if (PERFORMANCE_CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGS) {
  monitorPagePerformance();
  
  // 每30秒打印一次性能统计
  setInterval(() => {
    performanceMonitor.printAllStats();
    monitorMemoryUsage();
  }, 30000);
}
