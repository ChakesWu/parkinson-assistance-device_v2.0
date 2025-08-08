// 增強版調試工具 - 用於診斷AI分析和3D模型問題
class DebugManager {
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
            lastAIUpdate: null
        };
        this.debugPanel = null;
        this.serialMonitor = null;
        this.aiMonitor = null;
        this.init();
    }

    init() {
        this.createDebugPanel();
        this.createSerialMonitor();
        this.createAIMonitor();
        this.setupPerformanceMonitoring();
        this.setupErrorHandling();
        console.log('🐛 調試管理器已初始化');
    }

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 350px;
            max-height: 500px;
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
                <strong>🔍 調試面板</strong>
                <button onclick="debugManager.togglePanel()" style="background: none; border: none; color: #00ff00; cursor: pointer; font-size: 14px;">[X]</button>
            </div>
            <div id="debug-content">
                <div>等待數據...</div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.debugPanel = panel;
    }

    createSerialMonitor() {
        const monitor = document.createElement('div');
        monitor.id = 'serial-monitor';
        monitor.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            width: 300px;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: #ffffff;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            padding: 8px;
            border-radius: 5px;
            z-index: 9999;
            overflow-y: auto;
            border: 1px solid #4444ff;
            display: none;
        `;
        
        monitor.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; border-bottom: 1px solid #4444ff; padding-bottom: 3px;">
                <strong>📡 串口監視器</strong>
                <button onclick="debugManager.toggleSerialMonitor()" style="background: none; border: none; color: #4444ff; cursor: pointer;">[X]</button>
            </div>
            <div id="serial-content">等待串口數據...</div>
        `;
        
        document.body.appendChild(monitor);
        this.serialMonitor = monitor;
    }

    createAIMonitor() {
        const monitor = document.createElement('div');
        monitor.id = 'ai-monitor';
        monitor.style.cssText = `
            position: fixed;
            top: 220px;
            left: 10px;
            width: 300px;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: #ffffff;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            padding: 8px;
            border-radius: 5px;
            z-index: 9999;
            overflow-y: auto;
            border: 1px solid #ff4444;
            display: none;
        `;
        
        monitor.innerHTML = `
            <div style="display: flex; justify-content: