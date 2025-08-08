// 問題修復方案 - 解決AI分析和3D模型問題
class ProblemFixer {
    constructor() {
        this.isFixed = false;
        this.originalParseSerialData = null;
        this.dataThrottle = null;
        this.aiFixApplied = false;
        this.modelFixApplied = false;
    }

    // 修復AI分析無響應問題
    fixAIAnalysis() {
        console.log('🔧 開始修復AI分析問題...');
        
        // 增強AI結果解析器
        this.enhanceAIParser();
        
        // 添加AI狀態監控
        this.setupAIMonitor();
        
        this.aiFixApplied = true;
        console.log('✅ AI分析修復完成');
    }

    // 修復3D模型卡頓問題
    fix3DModel() {
        console.log('🔧 開始修復3D模型問題...');
        
        // 數據頻率限制
        this.setupDataThrottling();
        
        // 內存優化
        this.optimize3DRendering();
        
        // 錯誤恢復機制
        this.setupErrorRecovery();
        
        this.modelFixApplied = true;
        console.log('✅ 3D模型修復完成');
    }

    // 增強AI結果解析
    enhanceAIParser() {
        if (typeof parseSerialData === 'function') {
            const originalParser = parseSerialData;
            
            window.parseSerialData = (dataString) => {
                try {
                    const lines = dataString.split('\n');
                    
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;
                        
                        // 調試輸出
                        if (trimmedLine.includes('分析編號') || trimmedLine.includes('帕金森等級')) {
                            console.log('🤖 AI分析數據:', trimmedLine);
                        }
                        
                        // 解析單次分析結果
                        if (trimmedLine.startsWith('🧠') && trimmedLine.includes('深度AI分析報告')) {
                            console.log('📊 檢測到AI分析報告');
                            window.aiAnalysisInProgress = true;
                        }
                        
                        // 解析基本AI數據
                        if (trimmedLine.startsWith('📊 分析編號:')) {
                            const match = trimmedLine.match(/#(\d+)/);
                            if (match) {
                                window.aiAnalysisData = window.aiAnalysisData || {};
                                window.aiAnalysisData.analysisCount = parseInt(match[1]);
                            }
                        }
                        
                        if (trimmedLine.startsWith('🎯 帕金森等級:')) {
                            const match = trimmedLine.match(/(\d+)\s*\(([^)]+)\)/);
                            if (match) {
                                window.aiAnalysisData = window.aiAnalysisData || {};
                                window.aiAnalysisData.parkinsonLevel = parseInt(match[1]);
                                window.aiAnalysisData.parkinsonDescription = match[2];
                            }
                        }
                        
                        if (trimmedLine.startsWith('📈 置信度:')) {
                            const match = trimmedLine.match(/([\d.]+)%/);
                            if (match) {
                                window.aiAnalysisData = window.aiAnalysisData || {};
                                window.aiAnalysisData.confidence = parseFloat(match[1]);
                            }
                        }
                        
                        // 解析詳細建議
                        if (trimmedLine.includes('💪 個性化康復計劃:')) {
                            window.aiAnalysisData.currentSection = 'rehabilitation';
                            window.aiAnalysisData.detailedAnalysis = window.aiAnalysisData.detailedAnalysis || {};
                            window.aiAnalysisData.detailedAnalysis.rehabilitationPlan = [];
                        }
                        
                        if (trimmedLine.startsWith('  ') && window.aiAnalysisData.currentSection) {
                            const content = trimmedLine.trim();
                            if (content && window.aiAnalysisData.detailedAnalysis) {
                                switch(window.aiAnalysisData.currentSection) {
                                    case 'rehabilitation':
                                        if (!window.aiAnalysisData.detailedAnalysis.rehabilitationPlan) {
                                            window.aiAnalysisData.detailedAnalysis.rehabilitationPlan = [];
                                        }
                                        window.aiAnalysisData.detailedAnalysis.rehabilitationPlan.push(content);
                                        break;
                                    case 'symptom':
                                        if (!window.aiAnalysisData.detailedAnalysis.symptomAnalysis) {
                                            window.aiAnalysisData.detailedAnalysis.symptomAnalysis = [];
                                        }
                                        window.aiAnalysisData.detailedAnalysis.symptomAnalysis.push(content);
                                        break;
                                }
                            }
                        }
                        
                        // 分析完成標記
                        if (trimmed