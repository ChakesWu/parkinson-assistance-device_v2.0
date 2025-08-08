// AI分析修復 - 解決AI分析無響應問題
(function() {
    'use strict';
    
    console.log('🤖 AI分析修復模組載入中...');
    
    // 修復1: 增強AI結果解析
    function enhanceAIParser() {
        const originalParseSerialData = window.parseSerialData;
        
        window.parseSerialData = function(dataString) {
            try {
                const lines = dataString.split('\n');
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    // 調試輸出
                    if (trimmedLine.includes('分析編號') || trimmedLine.includes('帕金森等級')) {
                        console.log('🤖 AI分析數據:', trimmedLine);
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
                    
                    // 解析建議
                    if (trimmedLine.startsWith('  💡 評估:')) {
                        window.aiAnalysisData = window.aiAnalysisData || {};
                        window.aiAnalysisData.recommendation = trimmedLine.substring(8).trim();
                    }
                    
                    if (trimmedLine.startsWith('  🔧 建議阻力設定:')) {
                        const match = trimmedLine.match(/(\d+)度/);
                        if (match) {
                            window.aiAnalysisData.recommendedResistance = parseInt(match[1]);
                        }
                    }
                }
                
                // 調用原始解析器
                originalParseSerialData(dataString);
                
                // 更新顯示
                if (window.aiAnalysisData && window.aiAnalysisData.parkinsonLevel !== undefined) {
                    updateAIDisplay();
                }
                
            } catch (error) {
                console.error('❌ AI解析錯誤:', error);
            }
        };
    }
    
    // 修復2: 更新AI顯示
    function updateAIDisplay() {
        if (!window.aiAnalysisData) return;
        
        const data = window.aiAnalysisData;
        
        // 更新基本顯示
        const elements = {
            'analysisCount': data.analysisCount || 0,
            'parkinsonLevel': data.parkinsonLevel || '-',
            'parkinsonDescription': data.parkinsonDescription || '等待分析',
            'confidence': (data.confidence || 0).toFixed(1) + '%',
            'recommendedResistance': (data.recommendedResistance || 0) + '度',
            'lastUpdate': new Date().toLocaleString()
        };
        
        Object.keys(elements).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = elements[key];
            }
        });
        
        // 更新等級指示器
        const levelIndicator = document.getElementById('levelIndicator');
        if (levelIndicator && data.parkinsonLevel !== undefined) {
            levelIndicator.className = 'level-indicator';
            if (data.parkinsonLevel <= 1) {
                levelIndicator.classList.add('level-normal');
            } else if (data.parkinsonLevel <= 3) {
                levelIndicator.classList.add('level-mild');
            } else {
                levelIndicator.classList.add('level-severe');
            }
        }
        
        console.log('✅ AI顯示已更新:', data);
    }
    
    // 修復3: 確保updateAIDisplay函數可用
    if (typeof window.updateAIDisplay === 'undefined') {
        window.updateAIDisplay = updateAIDisplay