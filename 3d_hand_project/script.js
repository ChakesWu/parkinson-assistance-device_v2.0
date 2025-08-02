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
    
    try {
        while (isConnected) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const dataString = decoder.decode(value);
            parseSerialData(dataString);
        }
    } catch (error) {
        console.error('讀取數據失敗:', error);
        onDeviceDisconnected();
    } finally {
        reader.releaseLock();
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
    
    // 重置數據顯示
    resetDisplays();
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
            
            // 解析JSON格式的數據
            if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                const jsonData = JSON.parse(trimmedLine);
                
                // 更新感測器數據
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
                
                // 更新顯示
                updateAllDisplays();
            }
            // 解析CSV格式的數據 (備用格式)
            else if (trimmedLine.includes(',')) {
                const values = trimmedLine.split(',').map(v => parseFloat(v));
                if (values.length >= 5) {
                    // 假設前5個值是手指數據
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
    // 更新數值顯示
    fingerValueElements[fingerIndex].textContent = value;
    
    // 更新進度條
    const percentage = (value / 1023) * 100;
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
    }, 1000);
});

// 3D手部模型相關功能
let hand3DInitialized = false;

// 初始化3D手部模型
function initialize3DHandModel() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js 未載入');
        return;
    }
    
    if (typeof initHand3D === 'undefined') {
        console.error('Hand3D 類未載入');
        return;
    }
    
    try {
        initHand3D();
        hand3DInitialized = true;
        
        // 隱藏載入提示
        const loadingElement = document.querySelector('.hand3d-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        console.log('3D手部模型初始化成功');
    } catch (error) {
        console.error('3D手部模型初始化失敗:', error);
    }
}

// 測試動畫按鈕事件
function setupTestAnimationButton() {
    const testBtn = document.getElementById('testAnimationBtn');
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            if (hand3DInitialized && window.hand3D) {
                window.hand3D.testFingerAnimation();
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
            if (hand3DInitialized && window.hand3D) {
                // 重置所有手指到伸直狀態
                for (let i = 0; i < 5; i++) {
                    window.hand3D.updateFingerBending(i, 0);
                }
                
                // 重置手部旋轉
                if (window.hand3D.handModel) {
                    window.hand3D.handModel.rotation.set(0, 0, 0);
                }
            } else {
                alert('3D手部模型尚未初始化');
            }
        });
    }
}

// 修改原有的updateAllDisplays函數以包含3D模型更新
const originalUpdateAllDisplays = updateAllDisplays;
updateAllDisplays = function() {
    // 調用原有的更新函數
    for (let i = 0; i < 5; i++) {
        updateFingerDisplay(i, sensorData.fingers[i]);
    }
    
    // 更新IMU顯示
    updateIMUDisplay('accelerometer', sensorData.accelerometer.x, sensorData.accelerometer.y, sensorData.accelerometer.z);
    updateIMUDisplay('gyroscope', sensorData.gyroscope.x, sensorData.gyroscope.y, sensorData.gyroscope.z);
    updateIMUDisplay('magnetometer', sensorData.magnetometer.x, sensorData.magnetometer.y, sensorData.magnetometer.z);
    
    // 更新3D手部模型
    if (hand3DInitialized && window.hand3D) {
        window.hand3D.updateFromSensorData(sensorData);
    }
};;


// 錯誤處理
window.addEventListener('error', function(event) {
    console.error('JavaScript錯誤:', event.error);
});

// 未處理的Promise拒絕
window.addEventListener('unhandledrejection', function(event) {
    console.error('未處理的Promise拒絕:', event.reason);
    event.preventDefault();
});

