// 完整問題修復方案 - 解決AI分析和3D模型問題
(function() {
    'use strict';
    
    console.log('🔧 開始應用問題修復方案...');
    
    // ===== 修復1: AI分析無響應問題 =====
    
    // 增強AI結果解析器
    function enhanceAIParser() {
        console.log('🤖 增強AI解析器...');
        
        // 保存原始解析器
        const originalParseSerialData = window.parseSerialData;
        
        // 創建新的解析器
        window.parseSerialData = function(dataString) {
            try {
                const lines = dataString.split('\n');
                let aiData = window.aiAnalysisData || {};
                
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
                        if (match) aiData.analysisCount = parseInt(match[1]);
                    }
                    
                    if (trimmedLine.startsWith('🎯 帕金森等級:')) {
                        const match = trimmedLine.match(/(\d+)\s*\(([^)]+)\)/);
                        if (match) {
                            aiData.parkinsonLevel = parseInt(match[1]);
                            aiData.parkinsonDescription = match[2];
                        }
                    }
                    
                    if (trimmedLine.startsWith('📈 置信度:')) {
                        const match = trimmedLine.match(/([\d.]+)%/);
                        if (match) aiData.confidence = parseFloat(match[1]);
                    }
                    
                    if (trimmedLine.startsWith('  💡 評估:')) {
                        aiData.recommendation = trimmedLine.substring(8).trim();
                    }
                    
                    if (trimmedLine.startsWith('  🔧 建議阻力設定:')) {
                        const match = trimmedLine.match(/(\d+)度/);
                        if (match) aiData.recommendedResistance = parseInt(match[1]);
                    }
                    
                    // 解析詳細建議
                    if (trimmedLine.includes('💪 個性化康復計劃:')) {
                        aiData.currentSection = 'rehabilitation';
                        aiData.detailedAnalysis = aiData.detailedAnalysis || {};
                        aiData.detailedAnalysis.rehabilitationPlan = [];
                    }
                    
                    if (trimmedLine.startsWith('  ') && aiData.currentSection) {
                        const content = trimmedLine.trim();
                        if (content && aiData.detailedAnalysis) {
                            switch(aiData.currentSection) {
                                case 'rehabilitation':
                                    if (!aiData.detailedAnalysis.rehabilitationPlan) {
                                        aiData.detailedAnalysis.rehabilitationPlan = [];
                                    }
                                    aiData.detailedAnalysis.rehabilitationPlan.push(content);
                                    break;
                                case 'symptom':
                                    if (!aiData.detailedAnalysis.symptomAnalysis) {
                                        aiData.detailedAnalysis.symptomAnalysis = [];
                                    }
                                    aiData.detailedAnalysis.symptomAnalysis.push(content);
                                    break;
                            }
                        }
                    }
                    
                    // 分析完成標記
                    if (trimmedLine.includes('🔍===============================')) {
                        aiData.lastUpdateTime = new Date().toLocaleString();
                        console.log('✅ AI分析完成:', aiData);
                        
                        // 更新顯示
                        if (typeof updateAIDisplay === 'function') {
                            updateAIDisplay();
                        } else {
                            // 直接更新DOM
                            updateAIDisplayDirect(aiData);
                        }
                    }
                }
                
                window.aiAnalysisData = aiData;
                
                // 調用原始解析器處理其他數據
                originalParseSerialData(dataString);
                
            } catch (error) {
                console.error('❌ AI解析錯誤:', error);
            }
        };
    }
    
    // 直接更新AI顯示
    function updateAIDisplayDirect(data) {
        const elements = {
            'analysisCount': data.analysisCount || 0,
            'parkinsonLevel': data.parkinsonLevel || '-',
            'parkinsonDescription': data.parkinsonDescription || '等待分析',
            'confidence': (data.confidence || 0).toFixed(1