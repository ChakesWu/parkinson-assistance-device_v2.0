// 增強版調試工具 - 專門解決AI分析和3D模型問題
class EnhancedDebugManager {
    constructor() {
        this.logs = [];
        this.isDebugMode = true;
        this.performanceMetrics = {
            frameRate: 0,
            lastFrameTime: 0,
            dataUpdateCount: 0,
            errorCount: 0,
            aiAnalysisCount: 0,
            serialDataCount: 0,
            lastSerialData: null,
            lastAIUpdate: null,
            dataFrequency: 0,
            lastDataTime: 0
        };
        this.debugPanel = null;
        this.dataThrottling = {
            lastUpdate: 0,
            minInterval: 100 // 限制更新頻率為10Hz
        };
        this.init();
    }

    init() {
        this.createDebugPanel();
        this.setupPerformanceMonitoring();
        this.setupErrorHandling();
        this.patchSerialParser();
        console.log('🔧 增強調試管理器已初始化');
    }

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'enhanced-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 600px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 10px;
            border-radius: 5px;
            z-index: 10000;
            overflow-y: auto;
            border: 1px solid #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #00ff00; padding-bottom: 5px;">
                <strong>🔧 增強調試面板</strong>
                <button onclick="enhancedDebug.togglePanel()" style="background: none; border: none; color: #00ff00; cursor: pointer;">[X]</button>
            </div>
            <div id="debug-content">
                <div>等待數據...</div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.debugPanel = panel;
    }

    patchSerialParser() {
        // 修補原有的串口解析器，增加調試信息
        if (typeof parseSerialData === 'function') {
            const originalParseSerialData = parseSerialData;
            window.parseSerialData = (dataString) => {
                console.log('📡 收到原始數據:', dataString);
                this.performanceMetrics.serialDataCount++;
                
                // 檢查數據頻率
                const now = Date.now();
                if (this.performanceMetrics.lastDataTime > 0) {
                    const interval = now - this.performanceMetrics.lastDataTime;
                    this.performanceMetrics.dataFrequency = 1000 / interval;
                }
                this.performanceMetrics.lastDataTime = now;
                
                // 調用原始解析器
                try {
                    originalParseSerialData(dataString);
                } catch (error) {
                    console.error('❌ 解析錯誤:', error);
                    this.performanceMetrics.errorCount++;
                }
                
                this.updateDebugDisplay();
            };
        }
    }

    setupPerformanceMonitoring() {
        // 監控3D模型性能
        if (window.simpleHand3D) {
            const originalUpdate = window.simpleHand3D.updateFromSensorData;
            if (originalUpdate) {
                window.simpleHand3D.updateFromSensorData = (sensorData) => {
                    const startTime = performance.now();
                    originalUpdate.call(window.simpleHand3D, sensorData);
                    const endTime = performance.now();
                    
                    if (endTime - startTime > 16) { // 超過16ms可能導致卡頓
                        console.warn('⚠️ 3D更新耗時:', (endTime - startTime).toFixed(2) + 'ms');
                    }
                };
            }
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('❌ 全局錯誤:', event.error);
            this.performanceMetrics.errorCount++;
            this