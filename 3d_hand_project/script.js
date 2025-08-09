// 全域變數
let isConnected = false;
let serialPort = null;
let dataPollingInterval = null;

// 感測器數據儲存
let sensorData = {
    fingers: [0, 0, 0, 0, 0],
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 }
};

// AI分析結果儲存
let aiAnalysisData = {
    analysisCount: 0,
    parkinsonLevel: 0,
    parkinsonDescription: '',
    confidence: 0,
    recommendation: '',
    recommendedResistance: 0,
    lastUpdateTime: null
};

// DOM 元素
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusIndicator = document.getElementById('statusIndicator');
const connectionStatus = document.getElementById('connectionStatus');

// 手指數值顯示元素
const fingerValueElements = [
    document.getElementById('finger1Value'),
    document.getElementById('finger2Value'),
    document.getElementById('finger3Value'),
    document.getElementById('finger4Value'),
    document.getElementById('finger5Value')
];

const fingerProgressElements = [
    document.getElementById('finger1Progress'),
    document.getElementById('finger2Progress'),
    document.getElementById('finger3Progress'),
    document.getElementById('finger4Progress'),
    document.getElementById('finger5Progress')
];

// IMU數值顯示元素
const imuElements = {
    accelX: document.getElementById('accelX'),
    accelY: document.getElementById('accelY'),
    accelZ: document.getElementById('accelZ'),
    gyroX: document.getElementById('gyroX'),
    gyroY: document.getElementById('gyroY'),
    gyroZ: document.getElementById('gyroZ'),
    magX: document.getElementById('magX'),
    magY: document.getElementById('magY'),
    magZ: document.getElementById('magZ')
};

// 事件監聽器
connectBtn.addEventListener('click', connectToDevice);
disconnectBtn.addEventListener('click', disconnectFromDevice);

// Arduino控制按鈕
const calibrateBtn = document.getElementById('calibrateBtn');
const startAIBtn = document.getElementById('startAIBtn');
const stopAIBtn = document.getElementById('stopAIBtn');
const statusBtn = document.getElementById('statusBtn');
const resetYawBtn = document.getElementById('resetYawBtn');

calibrateBtn.addEventListener('click', () => sendCommandToArduino('CALIBRATE'));
startAIBtn.addEventListener('click', () => sendCommandToArduino('AUTO'));
stopAIBtn.addEventListener('click', () => sendCommandToArduino('STOP'));
statusBtn.addEventListener('click', () => sendCommandToArduino('STATUS'));
if (resetYawBtn) {
    resetYawBtn.addEventListener('click', () => {
        try { window.resetYaw && window.resetYaw(); } catch (e) { console.warn('resetYaw failed', e); }
    });
}

// 連接到串口設備
async function connectToDevice() {
    try {
        console.log('正在連接到串口設備...');
        updateConnectionStatus('連接中...', false);
        connectBtn.disabled = true;

        // 使用 Web Serial API 連接
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        isConnected = true;
        updateConnectionStatus("已連接", true);
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        
        // 啟用Arduino控制按鈕
        enableArduinoControls(true);
        
        // 開始讀取數據
        startDataReading();
        
        console.log("成功連接到串口設備");
    } catch (error) {
        console.error("連接失敗:", error);
        updateConnectionStatus("連接失敗", false);
        connectBtn.disabled = false;
        alert(`連接失敗: ${error.message}`);
    }
}

// 開始讀取數據
async function startDataReading() {
    const reader = serialPort.readable.getReader();
    const decoder = new TextDecoder();
    
    console.log('開始讀取Arduino數據...');
    
    try {
        while (isConnected) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const dataString = decoder.decode(value);
            // 顯示原始數據用於調試
            if (dataString.trim()) {
                console.log('收到原始數據:', dataString.trim());
            }
            parseSerialData(dataString);
        }
    } catch (error) {
        console.error('讀取數據失敗:', error);
        onDeviceDisconnected();
    } finally {
        reader.releaseLock();
    }
}

// 發送指令到Arduino
async function sendCommandToArduino(command) {
    if (!serialPort || !isConnected) {
        alert('請先連接Arduino設備');
        return;
    }
    
    const writer = serialPort.writable.getWriter();
    const encoder = new TextEncoder();
    
    try {
        await writer.write(encoder.encode(command + '\n'));
        console.log('已發送指令:', command);
    } catch (error) {
        console.error('發送指令失敗:', error);
    } finally {
        writer.releaseLock();
    }
}

// 斷開設備連接
async function disconnectFromDevice() {
    try {
        if (serialPort) {
            await serialPort.close();
        }
        
        isConnected = false;
        serialPort = null;
        updateConnectionStatus('未連接', false);
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        
        // 禁用Arduino控制按鈕
        enableArduinoControls(false);
        
        // 重置顯示
        resetDisplays();
        
        console.log('串口連接已斷開');
    } catch (error) {
        console.error('斷開連接失敗:', error);
        alert(`斷開連接失敗: ${error.message}`);
    }
}

// 設備斷開連接事件處理
function onDeviceDisconnected() {
    console.log('設備已斷開連接');
    isConnected = false;
    serialPort = null;
    updateConnectionStatus('未連接', false);
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    
    // 禁用Arduino控制按鈕
    enableArduinoControls(false);
    
    // 重置數據顯示
    resetDisplays();
}

// 啟用/禁用Arduino控制按鈕
function enableArduinoControls(enabled) {
    calibrateBtn.disabled = !enabled;
    startAIBtn.disabled = !enabled;
    stopAIBtn.disabled = !enabled;
    statusBtn.disabled = !enabled;
}

// 更新連接狀態顯示
function updateConnectionStatus(status, connected) {
    connectionStatus.textContent = status;
    if (connected) {
        statusIndicator.classList.add('connected');
    } else {
        statusIndicator.classList.remove('connected');
    }
}

// 解析串口數據
function parseSerialData(dataString) {
    try {
        const lines = dataString.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // 解析AI分析結果 - 支持新的详细格式
            if (trimmedLine.includes('=== AI分析結果 ===') || trimmedLine.includes('深度AI分析報告')) {
                console.log('🤖 檢測到AI分析結果開始 (详细模式)');
                aiAnalysisData.detailedAnalysis = {
                    symptomAnalysis: [],
                    rehabilitationPlan: [],
                    lifestyleSuggestions: [],
                    nextCheckup: []
                };
                continue;
            }
            
            // 解析帕金森分析數據
            if (trimmedLine.startsWith('分析次數:')) {
                aiAnalysisData.analysisCount = parseInt(trimmedLine.split(':')[1].trim());
            } else if (trimmedLine.startsWith('帕金森等級:')) {
                const levelText = trimmedLine.split(':')[1].trim();
                const levelMatch = levelText.match(/(\d+)\s*\(([^)]+)\)/);
                if (levelMatch) {
                    aiAnalysisData.parkinsonLevel = parseInt(levelMatch[1]);
                    aiAnalysisData.parkinsonDescription = levelMatch[2];
                }
            } else if (trimmedLine.startsWith('置信度:')) {
                const confidenceText = trimmedLine.split(':')[1].trim();
                aiAnalysisData.confidence = parseFloat(confidenceText.replace('%', ''));
            } else if (trimmedLine.startsWith('訓練建議:')) {
                aiAnalysisData.recommendation = trimmedLine.split(':')[1].trim();
            } else if (trimmedLine.startsWith('建議阻力設定:')) {
                const resistanceText = trimmedLine.split(':')[1].trim();
                aiAnalysisData.recommendedResistance = parseInt(resistanceText.replace('度', ''));
            } else if (trimmedLine.includes('==================') || trimmedLine.includes('🔍===============================🔍')) {
                aiAnalysisData.lastUpdateTime = new Date().toLocaleString();
                updateAIDisplay();
                console.log('AI分析結果解析完成:', aiAnalysisData);
            }
            
            // 解析詳細分析部分
            else if (trimmedLine.includes('🔬 症狀詳細分析:')) {
                console.log('📊 開始解析症狀分析');
                aiAnalysisData.currentSection = 'symptom';
            } else if (trimmedLine.includes('💪 個性化康復計劃:')) {
                console.log('💪 開始解析康復計劃');
                aiAnalysisData.currentSection = 'rehabilitation';
            } else if (trimmedLine.includes('🌟 生活方式建議:')) {
                console.log('🌟 開始解析生活方式建議');
                aiAnalysisData.currentSection = 'lifestyle';
            } else if (trimmedLine.includes('📅 下次檢測建議:')) {
                console.log('📅 開始解析下次檢測建議');
                aiAnalysisData.currentSection = 'nextCheckup';
            }
            
            // 解析各部分的詳細內容
            else if (trimmedLine.startsWith('  ') && aiAnalysisData.currentSection && aiAnalysisData.detailedAnalysis) {
                const content = trimmedLine.trim();
                if (content && !content.includes('建議間隔') && !content.includes('重點關注')) {
                    switch (aiAnalysisData.currentSection) {
                        case 'symptom':
                            aiAnalysisData.detailedAnalysis.symptomAnalysis.push(content);
                            break;
                        case 'rehabilitation':
                            aiAnalysisData.detailedAnalysis.rehabilitationPlan.push(content);
                            break;
                        case 'lifestyle':
                            aiAnalysisData.detailedAnalysis.lifestyleSuggestions.push(content);
                            break;
                        case 'nextCheckup':
                            aiAnalysisData.detailedAnalysis.nextCheckup.push(content);
                            break;
                    }
                }
            }
            
            // 解析傳感器數據格式: DATA,finger1,finger2,finger3,finger4,finger5,emg,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mag_x,mag_y,mag_z
            else if (trimmedLine.startsWith('DATA,')) {
                const values = trimmedLine.substring(5).split(',').map(v => parseFloat(v));
                if (values.length >= 15) {
                    // 更新手指數據 (前5個值)
                    sensorData.fingers = values.slice(0, 5);
                    
                    // 更新完整IMU數據
                    sensorData.accelerometer.x = values[6];
                    sensorData.accelerometer.y = values[7];
                    sensorData.accelerometer.z = values[8];
                    
                    sensorData.gyroscope.x = values[9];
                    sensorData.gyroscope.y = values[10];
                    sensorData.gyroscope.z = values[11];
                    
                    sensorData.magnetometer.x = values[12];
                    sensorData.magnetometer.y = values[13];
                    sensorData.magnetometer.z = values[14];
                    
                    updateAllDisplays();
                    
                    // 定期顯示數據狀態（避免控制台刷屏）
                    if (Math.random() < 0.01) { // 1%的概率顯示
                        console.log('✅ 完整IMU數據正常更新:', {
                            fingers: sensorData.fingers.map(v => Math.round(v)),
                            accel: sensorData.accelerometer,
                            gyro: sensorData.gyroscope,
                            mag: sensorData.magnetometer
                        });
                    }
                } else if (values.length >= 9) {
                    // 向後兼容：處理只有9個值的舊格式
                    sensorData.fingers = values.slice(0, 5);
                    sensorData.accelerometer.x = values[6];
                    sensorData.accelerometer.y = values[7];
                    sensorData.accelerometer.z = values[8];
                    updateAllDisplays();
                }
            }
            
            // 解析JSON格式的數據 (向後兼容)
            else if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                const jsonData = JSON.parse(trimmedLine);
                
                if (jsonData.fingers) {
                    sensorData.fingers = jsonData.fingers;
                }
                if (jsonData.accelerometer) {
                    sensorData.accelerometer = jsonData.accelerometer;
                }
                if (jsonData.gyroscope) {
                    sensorData.gyroscope = jsonData.gyroscope;
                }
                if (jsonData.magnetometer) {
                    sensorData.magnetometer = jsonData.magnetometer;
                }
                
                updateAllDisplays();
            }
            
            // 解析簡單CSV格式的數據 (備用格式)
            else if (trimmedLine.includes(',') && !trimmedLine.startsWith('DATA')) {
                const values = trimmedLine.split(',').map(v => parseFloat(v));
                if (values.length >= 5) {
                    sensorData.fingers = values.slice(0, 5);
                    updateAllDisplays();
                }
            }
        }
    } catch (error) {
        console.error('解析串口數據失敗:', error);
    }
}

// 更新所有顯示
function updateAllDisplays() {
    // 更新手指顯示
    for (let i = 0; i < 5; i++) {
        updateFingerDisplay(i, sensorData.fingers[i]);
    }
    
    // 更新IMU顯示
    updateIMUDisplay('accelerometer', sensorData.accelerometer.x, sensorData.accelerometer.y, sensorData.accelerometer.z);
    updateIMUDisplay('gyroscope', sensorData.gyroscope.x, sensorData.gyroscope.y, sensorData.gyroscope.z);
    updateIMUDisplay('magnetometer', sensorData.magnetometer.x, sensorData.magnetometer.y, sensorData.magnetometer.z);
}

// 更新手指彎曲顯示
function updateFingerDisplay(fingerIndex, value) {
    // 計算百分比
    const percentage = Math.min(100, Math.max(0, (value / 1023) * 100));

    // 更新數值顯示 (顯示百分比而不是原始值)
    fingerValueElements[fingerIndex].textContent = Math.round(percentage) + '%';

    // 更新進度條
    fingerProgressElements[fingerIndex].style.width = percentage + '%';

    // 更新SVG手指彎曲
    updateFingerVisualization(fingerIndex, value);
}

// 更新SVG手指彎曲視覺化
function updateFingerVisualization(fingerIndex, value) {
    const finger = document.getElementById(`finger${fingerIndex + 1}`);
    if (finger) {
        // 將電位器值(0-1023)轉換為彎曲角度(0-90度)
        const bendAngle = (value / 1023) * 90;
        
        // 根據手指位置調整旋轉軸和角度
        let transformOrigin, rotation;
        
        switch (fingerIndex) {
            case 0: // 拇指
                transformOrigin = '130 340';
                rotation = `rotate(${-bendAngle} 130 340)`;
                break;
            case 1: // 食指
                transformOrigin = '170 260';
                rotation = `rotate(${bendAngle} 170 260)`;
                break;
            case 2: // 中指
                transformOrigin = '200 260';
                rotation = `rotate(${bendAngle} 200 260)`;
                break;
            case 3: // 無名指
                transformOrigin = '230 260';
                rotation = `rotate(${bendAngle} 230 260)`;
                break;
            case 4: // 小指
                transformOrigin = '260 270';
                rotation = `rotate(${bendAngle} 260 270)`;
                break;
        }
        
        finger.style.transformOrigin = transformOrigin;
        finger.style.transform = rotation;
    }
}

// 更新IMU數據顯示
function updateIMUDisplay(sensorType, x, y, z) {
    const prefix = sensorType === 'accelerometer' ? 'accel' : 
                   sensorType === 'gyroscope' ? 'gyro' : 'mag';
    
    imuElements[prefix + 'X'].textContent = x.toFixed(2);
    imuElements[prefix + 'Y'].textContent = y.toFixed(2);
    imuElements[prefix + 'Z'].textContent = z.toFixed(2);
}

// 更新AI分析結果顯示
function updateAIDisplay() {
    const analysisCountElement = document.getElementById('analysisCount');
    const parkinsonLevelElement = document.getElementById('parkinsonLevel');
    const parkinsonDescElement = document.getElementById('parkinsonDescription');
    const confidenceElement = document.getElementById('confidence');
    const recommendationElement = document.getElementById('recommendation');
    const resistanceElement = document.getElementById('recommendedResistance');
    const lastUpdateElement = document.getElementById('lastUpdate');
    
    if (analysisCountElement) analysisCountElement.textContent = aiAnalysisData.analysisCount;
    if (parkinsonLevelElement) parkinsonLevelElement.textContent = aiAnalysisData.parkinsonLevel;
    if (parkinsonDescElement) parkinsonDescElement.textContent = aiAnalysisData.parkinsonDescription;
    if (confidenceElement) confidenceElement.textContent = aiAnalysisData.confidence.toFixed(1) + '%';
    if (recommendationElement) recommendationElement.textContent = aiAnalysisData.recommendation;
    if (resistanceElement) resistanceElement.textContent = aiAnalysisData.recommendedResistance + '度';
    if (lastUpdateElement) lastUpdateElement.textContent = aiAnalysisData.lastUpdateTime || '尚未分析';
    
    // 根據帕金森等級更新樣式
    const levelIndicator = document.getElementById('levelIndicator');
    if (levelIndicator) {
        levelIndicator.className = 'level-indicator';
        if (aiAnalysisData.parkinsonLevel <= 1) {
            levelIndicator.classList.add('level-normal');
        } else if (aiAnalysisData.parkinsonLevel <= 3) {
            levelIndicator.classList.add('level-mild');
        } else {
            levelIndicator.classList.add('level-severe');
        }
    }
    
    // 更新詳細分析結果
    updateDetailedAnalysisDisplay();
}

// 更新詳細分析結果顯示
function updateDetailedAnalysisDisplay() {
    if (!aiAnalysisData.detailedAnalysis) return;
    
    const detailedSection = document.getElementById('detailedAnalysisSection');
    if (!detailedSection) return;
    
    // 顯示詳細分析區域
    detailedSection.style.display = 'block';
    
    // 更新症狀分析
    updateAnalysisSubsection('symptomAnalysisSection', 'symptomAnalysisList', 
        aiAnalysisData.detailedAnalysis.symptomAnalysis, '症狀分析');
    
    // 更新康復計劃
    updateAnalysisSubsection('rehabilitationPlanSection', 'rehabilitationPlanList', 
        aiAnalysisData.detailedAnalysis.rehabilitationPlan, '康復計劃');
    
    // 更新生活建議
    updateAnalysisSubsection('lifestyleSuggestionsSection', 'lifestyleSuggestionsList', 
        aiAnalysisData.detailedAnalysis.lifestyleSuggestions, '生活建議');
    
    // 更新下次檢測建議
    updateAnalysisSubsection('nextCheckupSection', 'nextCheckupList', 
        aiAnalysisData.detailedAnalysis.nextCheckup, '下次檢測');
    
    console.log('✅ 详细分析结果已更新到UI');
}

// 更新分析子区域
function updateAnalysisSubsection(sectionId, listId, data, sectionName) {
    const section = document.getElementById(sectionId);
    const list = document.getElementById(listId);
    
    if (!section || !list || !data || data.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }
    
    // 顯示子區域
    section.style.display = 'block';
    
    // 清空現有內容
    list.innerHTML = '';
    
    // 添加新內容
    data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        
        // 根據內容設置樣式
        if (item.includes('🚨') || item.includes('嚴重') || item.includes('緊急')) {
            li.setAttribute('data-type', 'warning');
        } else if (item.includes('⚠️') || item.includes('輕微') || item.includes('注意')) {
            li.setAttribute('data-type', 'caution');
        } else if (item.includes('✅') || item.includes('優秀') || item.includes('正常')) {
            li.setAttribute('data-type', 'success');
        }
        
        list.appendChild(li);
    });
    
    console.log(`📊 ${sectionName}已更新，共${data.length}項`);
}

// 重置所有顯示
function resetDisplays() {
    // 重置手指數據
    for (let i = 0; i < 5; i++) {
        fingerValueElements[i].textContent = '0';
        fingerProgressElements[i].style.width = '0%';
        
        const finger = document.getElementById(`finger${i + 1}`);
        if (finger) {
            finger.style.transform = 'rotate(0deg)';
        }
    }
    
    // 重置IMU數據
    Object.values(imuElements).forEach(element => {
        element.textContent = '0.00';
    });
    
    // 重置AI分析數據
    aiAnalysisData = {
        analysisCount: 0,
        parkinsonLevel: 0,
        parkinsonDescription: '',
        confidence: 0,
        recommendation: '',
        recommendedResistance: 0,
        lastUpdateTime: null
    };
    updateAIDisplay();
    
    // 重置感測器數據
    sensorData = {
        fingers: [0, 0, 0, 0, 0],
        accelerometer: { x: 0, y: 0, z: 0 },
        gyroscope: { x: 0, y: 0, z: 0 },
        magnetometer: { x: 0, y: 0, z: 0 }
    };
}

// API接口函數 - 供外部使用
window.getFingerData = function() {
    return {
        fingers: [...sensorData.fingers],
        timestamp: Date.now()
    };
};

window.getIMUData = function() {
    return {
        accelerometer: { ...sensorData.accelerometer },
        gyroscope: { ...sensorData.gyroscope },
        magnetometer: { ...sensorData.magnetometer },
        timestamp: Date.now()
    };
};

window.getAllSensorData = function() {
    return {
        ...sensorData,
        isConnected: isConnected,
        timestamp: Date.now()
    };
};

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Arduino 手指彎曲感測器網頁已載入');
    
    // 初始化顯示
    resetDisplays();
    
    // 檢查瀏覽器是否支援 Web Serial API
    if (!navigator.serial) {
        alert('您的瀏覽器不支援 Web Serial API，請使用 Chrome 或 Edge 瀏覽器');
        connectBtn.disabled = true;
    }
    
    // 延遲初始化3D模型，確保所有資源載入完成
    setTimeout(() => {
        initialize3DHandModel();
        setupTestAnimationButton();
        setupResetHandButton();
        setupRobotDemoButton(); // 新增機械手展示功能
    }, 1000);
});

// 3D手部模型相關功能
let hand3DInitialized = false;

// 初始化简化3D手部模型
function initialize3DHandModel() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js 未載入');
        return;
    }
    
    if (typeof initSimpleHand3D === 'undefined') {
        console.error('SimpleHand3D 類未載入');
        return;
    }
    
    try {
        const success = initSimpleHand3D();
        if (success) {
            hand3DInitialized = true;
            window.hand3D = window.simpleHand3D;
            
            // 隱藏載入提示
            const loadingElement = document.querySelector('.hand3d-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            console.log('✅ 简化3D机械手初始化成功');
        } else {
            throw new Error('简化3D模型初始化返回失败');
        }
    } catch (error) {
        console.error('❌ 简化3D手部模型初始化失敗:', error);
        
        // 更强的错误恢复
        hand3DInitialized = false;
        window.hand3D = null;
        
        // 显示备用信息
        const loadingElement = document.querySelector('.hand3d-loading');
        if (loadingElement) {
            loadingElement.innerHTML = '❌ 3D模型加载失败，请刷新页面重试';
            loadingElement.style.display = 'block';
            loadingElement.style.color = '#dc3545';
        }
    }
}

// 測試動畫按鈕事件
function setupTestAnimationButton() {
    const testBtn = document.getElementById('testAnimationBtn');
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            if (hand3DInitialized && window.simpleHand3D) {
                window.simpleHand3D.testFingerAnimation();
                console.log('🤖 开始测试机械手动画');
            } else {
                alert('3D手部模型尚未初始化');
            }
        });
    }
}

// 重置手部按鈕事件
function setupResetHandButton() {
    const resetBtn = document.getElementById('resetHandBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (hand3DInitialized && window.simpleHand3D) {
                // 重置所有手指到伸直狀態
                for (let i = 0; i < 5; i++) {
                    window.simpleHand3D.updateFingerBending(i, 0);
                }
                
                // 重置手部旋轉
                if (window.simpleHand3D.handGroup) {
                    window.simpleHand3D.handGroup.rotation.set(0, 0, 0);
                }
                
                console.log('🔄 3D机械手已重置');
            } else {
                alert('3D手部模型尚未初始化');
            }
        });
    }
}

// 機械手展示按鈕事件
function setupRobotDemoButton() {
    const robotBtn = document.getElementById('robotDemoBtn');
    if (robotBtn) {
        robotBtn.addEventListener('click', () => {
            if (hand3DInitialized && window.simpleHand3D) {
                performRobotDemo();
            } else {
                alert('3D手部模型尚未初始化');
            }
        });
    }
}

// 機械手展示動畫
function performRobotDemo() {
    if (!window.simpleHand3D) return;
    
    console.log('🤖 開始機械手展示...');
    
    let demoStep = 0;
    const demoSteps = [
        // 步驟1：所有手指緩慢彎曲
        () => {
            console.log('機械手激活...');
            for (let i = 0; i < 5; i++) {
                window.simpleHand3D.updateFingerBending(i, 700 + Math.random() * 200);
            }
        },
        // 步驟2：展開手掌
        () => {
            console.log('系統重置...');
            for (let i = 0; i < 5; i++) {
                window.simpleHand3D.updateFingerBending(i, 0);
            }
        },
        // 步驟3-7：逐個彎曲手指
        () => {
            console.log('關節測試：拇指');
            window.simpleHand3D.updateFingerBending(0, 800);
        },
        () => {
            console.log('關節測試：食指');
            window.simpleHand3D.updateFingerBending(1, 800);
        },
        () => {
            console.log('關節測試：中指');
            window.simpleHand3D.updateFingerBending(2, 800);
        },
        () => {
            console.log('關節測試：無名指');
            window.simpleHand3D.updateFingerBending(3, 800);
        },
        () => {
            console.log('關節測試：小指');
            window.simpleHand3D.updateFingerBending(4, 800);
        },
        // 步驟8：機械握拳
        () => {
            console.log('執行握拳程序...');
            window.simpleHand3D.updateFingerBending(0, 600);
            window.simpleHand3D.updateFingerBending(1, 900);
            window.simpleHand3D.updateFingerBending(2, 950);
            window.simpleHand3D.updateFingerBending(3, 900);
            window.simpleHand3D.updateFingerBending(4, 850);
        },
        // 步驟9：最終展示姿態
        () => {
            console.log('展示模式...');
            window.simpleHand3D.updateFingerBending(0, 300);
            window.simpleHand3D.updateFingerBending(1, 150);
            window.simpleHand3D.updateFingerBending(2, 200);
            window.simpleHand3D.updateFingerBending(3, 400);
            window.simpleHand3D.updateFingerBending(4, 500);
        }
    ];
    
    const demoInterval = setInterval(() => {
        if (demoStep < demoSteps.length) {
            demoSteps[demoStep]();
            demoStep++;
        } else {
            clearInterval(demoInterval);
            // 3秒後重置
            setTimeout(() => {
                console.log('機械手系統待機');
                for (let i = 0; i < 5; i++) {
                    window.simpleHand3D.updateFingerBending(i, 0);
                }
            }, 3000);
        }
    }, 1000);
}

// 修改原有的updateAllDisplays函數以包含3D模型更新
const originalUpdateAllDisplays = updateAllDisplays;
updateAllDisplays = function() {
    try {
        // 調用原有的更新函數
        for (let i = 0; i < 5; i++) {
            updateFingerDisplay(i, sensorData.fingers[i]);
        }
        
        // 更新IMU顯示
        updateIMUDisplay('accelerometer', sensorData.accelerometer.x, sensorData.accelerometer.y, sensorData.accelerometer.z);
        updateIMUDisplay('gyroscope', sensorData.gyroscope.x, sensorData.gyroscope.y, sensorData.gyroscope.z);
        updateIMUDisplay('magnetometer', sensorData.magnetometer.x, sensorData.magnetometer.y, sensorData.magnetometer.z);
        
        // 更新3D手部模型（帶錯誤恢復）
        update3DHandModel();
        
    } catch (error) {
        console.error('❌ 顯示更新失敗:', error);
    }
};

// 安全的3D模型更新函數
function update3DHandModel() {
    if (!hand3DInitialized || !window.simpleHand3D) {
        return; // 靜默跳過，避免控制台刷屏
    }
    
    try {
        // 驗證數據有效性
        if (sensorData.fingers && sensorData.fingers.length >= 5) {
            window.simpleHand3D.updateFromSensorData(sensorData);
        }
    } catch (error) {
        console.error('❌ 简化3D模型更新失敗:', error);
        
        // 標記需要重新初始化
        hand3DInitialized = false;
        console.log('🔄 將在3秒後重新初始化简化3D模型...');
        setTimeout(() => {
            initialize3DHandModel();
        }, 3000);
    }
}


// 錯誤處理
window.addEventListener('error', function(event) {
    console.error('JavaScript錯誤:', event.error);
});

// 未處理的Promise拒絕
window.addEventListener('unhandledrejection', function(event) {
    console.error('未處理的Promise拒絕:', event.reason);
    event.preventDefault();
});

// 全域API函數
window.getFingerData = function() {
    return sensorData.fingers;
};

window.getIMUData = function() {
    return {
        accelerometer: sensorData.accelerometer,
        gyroscope: sensorData.gyroscope,
        magnetometer: sensorData.magnetometer
    };
};

window.getAIAnalysisData = function() {
    return aiAnalysisData;
};

window.getAllSensorData = function() {
    return {
        ...sensorData,
        isConnected: isConnected,
        aiAnalysis: aiAnalysisData
    };
};

