// 問題修復補丁
(function() {
    console.log('🔧 應用問題修復補丁...');
    
    // 修復1: AI分析顯示問題
    let aiData = {};
    
    // 增強的AI解析器
    const originalParse = window.parseSerialData;
    if (originalParse) {
        window.parseSerialData = function(data) {
            try {
                originalParse(data);
                
                // 解析AI數據
                const lines = data.split('\n');
                lines.forEach(line => {
                    const l = line.trim();
                    
                    if (l.startsWith('📊 分析編號:')) {
                        const m = l.match(/#(\d+)/);
                        if (m) aiData.analysisCount = parseInt(m[1]);
                    }
                    if (l.startsWith('🎯 帕金森等級:')) {
                        const m = l.match(/(\d+)\s*\(([^)]+)\)/);
                        if (m) {
                            aiData.parkinsonLevel = parseInt(m[1]);
                            aiData.parkinsonDescription = m[2];
                        }
                    }
                    if (l.startsWith('📈 置信度:')) {
                        const m = l.match(/([\d.]+)%/);
                        if (m) aiData.confidence = parseFloat(m[1]);
                    }
                });
                
                // 更新顯示
                if (aiData.parkinsonLevel !== undefined) {
                    updateAIDisplayFix(aiData);
                }
                
            } catch(e) {
                console.error('AI解析錯誤:', e);
            }
        };
    }
    
    // 直接更新AI顯示
    function updateAIDisplayFix(data) {
        const ids = ['analysisCount', 'parkinsonLevel', 'parkinsonDescription', 'confidence'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                switch(id) {
                    case 'analysisCount': el.textContent = data.analysisCount || 0; break;
                    case 'parkinsonLevel': el.textContent = data.parkinsonLevel || '-'; break;
                    case 'parkinsonDescription': el.textContent = data.parkinsonDescription || '等待分析'; break;
                    case 'confidence': el.textContent = (data.confidence || 0).toFixed(1) + '%'; break;
                }
            }
        });
        
        const indicator = document.getElementById('levelIndicator');
        if (indicator && data.parkinsonLevel !== undefined) {
            indicator.className = 'level-indicator';
            if (data.parkinsonLevel <= 1) indicator.classList.add('level-normal');
            else if (data.parkinsonLevel <= 3) indicator.classList.add('level-mild');
            else indicator.classList.add('level-severe');
        }
    }
    
    // 修復2: 3D模型性能優化
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 100;
    
    if (window.simpleHand3D) {
        const originalUpdate = window.simpleHand3D.updateFromSensorData;
        if (originalUpdate) {
            window.simpleHand3D.updateFromSensorData = function(sensorData) {
                const now = Date.now();
                if (now - lastUpdateTime < UPDATE_INTERVAL) return;
                lastUpdateTime = now;
                
                try {
                    originalUpdate.call(this, sensorData);
                } catch(e) {
                    console.error('3D更新錯誤:', e);
                }
            };
        }
    }
    
    console.log('✅ 所有修復已應用');
})();