// 简化版3D机械手 - 使用基础几何体，更稳定可靠
class SimpleHand3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.handGroup = null;
        this.fingerGroups = [];
        this.animationId = null;
        
        // 手指数据
        this.fingerData = [0, 0, 0, 0, 0];
        this.imuData = { x: 0, y: 0, z: 0 };

        // 水平旋轉（yaw）狀態：弧度與時間戳，用於以 gyro.z 積分
        this.yaw = 0;            // 弧度
        this.lastYawTs = null;   // performance.now() 毫秒
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.createSimpleHandModel();
        this.addEventListeners();
        this.animate();
        
        // 隐藏加载提示
        const loadingElement = this.container.querySelector('.hand3d-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        console.log('✅ 简化3D机械手模型加载成功');
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff); // 纯白色背景，让机械手更清晰
    }
    
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 0, 0);
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false // 关闭alpha通道，使用不透明背景
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
    }
    
    createLights() {
        // 环境光 - 增强亮度，让机械手更清晰
        const ambientLight = new THREE.AmbientLight(0x808080, 0.8);
        this.scene.add(ambientLight);
        
        // 主光源 - 增强亮度和对比度
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 蓝色科技光 - 增强科技感
        const blueLight = new THREE.DirectionalLight(0x4a90e2, 0.6);
        blueLight.position.set(-5, 3, 3);
        this.scene.add(blueLight);
        
        // 橙色暖光 - 增强金属质感
        const orangeLight = new THREE.DirectionalLight(0xff8c42, 0.4);
        orangeLight.position.set(3, -2, 5);
        this.scene.add(orangeLight);
        
        // 添加顶部补光，增强机械手细节
        const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
        topLight.position.set(0, 10, 0);
        this.scene.add(topLight);
        
        // 添加前补光，让机械手正面更亮
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 10);
        this.scene.add(frontLight);
    }
    
    createSimpleHandModel() {
        this.handGroup = new THREE.Group();
        
        // 创建手掌
        this.createPalm();
        
        // 创建5根手指
        this.createFingers();
        
        // 添加装饰和LED
        this.createDecorations();
        
        this.scene.add(this.handGroup);
    }
    
    createPalm() {
        // 主手掌 - 圆角方形
        const palmGeometry = new THREE.BoxGeometry(3, 0.8, 4);
        const palmMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x6b7280, // 中灰色，更清晰可见
            metalness: 0.7,
            roughness: 0.3
        });
        
        const palm = new THREE.Mesh(palmGeometry, palmMaterial);
        palm.position.set(0, 0, 0);
        palm.castShadow = true;
        palm.receiveShadow = true;
        
        // 添加边框效果，让轮廓更清晰
        const palmEdges = new THREE.EdgesGeometry(palmGeometry);
        const palmEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x374151, linewidth: 1 });
        const palmWireframe = new THREE.LineSegments(palmEdges, palmEdgeMaterial);
        palmWireframe.position.copy(palm.position);
        
        this.handGroup.add(palm);
        this.handGroup.add(palmWireframe);
        
        // 手掌装饰板
        const plateGeometry = new THREE.BoxGeometry(2.5, 0.1, 3.5);
        const plateMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4b5563, // 中深灰色，清晰可见
            metalness: 0.8,
            roughness: 0.2
        });
        
        const topPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        topPlate.position.set(0, 0.45, 0);
        this.handGroup.add(topPlate);
        
        // 手腕
        const wristGeometry = new THREE.CylinderGeometry(1.2, 1.4, 2, 12);
        const wristMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4b5563, // 与装饰板保持一致
            metalness: 0.8,
            roughness: 0.25
        });
        const wrist = new THREE.Mesh(wristGeometry, wristMaterial);
        wrist.position.set(0, -1, -1.5);
        wrist.castShadow = true;
        this.handGroup.add(wrist);
    }
    
    createFingers() {
        const fingerConfigs = [
            { name: 'thumb', position: [-1.8, 0.4, 1.2], scale: 0.8, joints: 3 },
            { name: 'index', position: [-0.9, 0.4, 2.2], scale: 1.0, joints: 3 },
            { name: 'middle', position: [0, 0.4, 2.3], scale: 1.1, joints: 3 },
            { name: 'ring', position: [0.9, 0.4, 2.2], scale: 0.95, joints: 3 },
            { name: 'pinky', position: [1.7, 0.4, 1.8], scale: 0.75, joints: 3 }
        ];
        
        fingerConfigs.forEach((config, index) => {
            const fingerGroup = this.createFinger(config, index);
            fingerGroup.position.set(...config.position);
            fingerGroup.scale.setScalar(config.scale);
            this.fingerGroups.push(fingerGroup);
            this.handGroup.add(fingerGroup);
        });
    }
    
    createFinger(config, fingerIndex) {
        const fingerGroup = new THREE.Group();
        fingerGroup.name = config.name;
        fingerGroup.joints = [];
        
        const jointSizes = [
            { length: 1.0, radius: 0.15 },
            { length: 0.8, radius: 0.12 },
            { length: 0.6, radius: 0.1 }
        ];
        
        let currentY = 0;
        
        jointSizes.forEach((joint, jointIndex) => {
            // 关节主体
            const jointGeometry = new THREE.CylinderGeometry(
                joint.radius, joint.radius * 0.9, joint.length, 8
            );
            const jointMaterial = new THREE.MeshPhysicalMaterial({
                color: jointIndex === 0 ? 0x6b7280 : 0x4b5563, // 中灰色，清晰可见
                metalness: 0.7,
                roughness: 0.3
            });
            
            const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
            jointMesh.position.y = joint.length / 2;
            jointMesh.castShadow = true;
            
            // 添加关节边框效果
            const jointEdges = new THREE.EdgesGeometry(jointGeometry);
            const jointEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x374151, linewidth: 1 });
            const jointWireframe = new THREE.LineSegments(jointEdges, jointEdgeMaterial);
            jointWireframe.position.copy(jointMesh.position);
            
            // 关节组（用于旋转）
            const jointPivot = new THREE.Group();
            jointPivot.position.y = currentY;
            jointPivot.add(jointMesh);
            jointPivot.add(jointWireframe);
            
            // 关节连接器
            if (jointIndex < jointSizes.length - 1) {
                const connectorGeometry = new THREE.CylinderGeometry(joint.radius * 1.1, joint.radius * 1.1, 0.1, 8);
                            const connectorMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x374151, // 中深灰色，清晰可见
                metalness: 0.8,
                roughness: 0.2
            });
                const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
                connector.position.y = joint.length;
                jointPivot.add(connector);
            }
            
            // LED指示灯
            const ledGeometry = new THREE.SphereGeometry(0.04, 8, 8);
            const ledColor = jointIndex === 0 ? 0x4444ff : 0x44ff44;
            const ledMaterial = new THREE.MeshBasicMaterial({
                color: ledColor,
                emissive: ledColor,
                emissiveIntensity: 1.2 // 大幅增强发光强度
            });
            const led = new THREE.Mesh(ledGeometry, ledMaterial);
            led.position.set(joint.radius * 0.8, joint.length * 0.5, 0);
            jointPivot.add(led);
            
            // 指尖传感器（最后一个关节）
            if (jointIndex === jointSizes.length - 1) {
                const tipGeometry = new THREE.SphereGeometry(joint.radius * 0.8, 8, 8);
                            const tipMaterial = new THREE.MeshBasicMaterial({
                color: 0xff4444,
                emissive: 0x441111,
                transparent: true,
                opacity: 1.0 // 完全不透明，更清晰
            });
                const tip = new THREE.Mesh(tipGeometry, tipMaterial);
                tip.position.y = joint.length * 0.9;
                jointPivot.add(tip);
            }
            
            fingerGroup.joints.push(jointPivot);
            fingerGroup.add(jointPivot);
            
            currentY += joint.length;
        });
        
        return fingerGroup;
    }
    
    createDecorations() {
        // 手掌LED指示灯
        const ledPositions = [
            [-1, 0.5, 0.5],
            [0, 0.5, 1],
            [1, 0.5, 0.5]
        ];
        
        ledPositions.forEach(pos => {
            const ledGeometry = new THREE.SphereGeometry(0.08, 8, 8);
            const ledMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                emissive: 0x004422,
                transparent: true,
                opacity: 1.0 // 完全不透明，更清晰
            });
            const led = new THREE.Mesh(ledGeometry, ledMaterial);
            led.position.set(...pos);
            this.handGroup.add(led);
        });
        
        // 装饰螺丝
        const screwPositions = [
            [-1.2, 0.5, -1.5], [1.2, 0.5, -1.5],
            [-1.2, 0.5, 1.5], [1.2, 0.5, 1.5]
        ];
        
        screwPositions.forEach(pos => {
            const screwGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6);
                    const screwMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x6b7280, // 中灰色，清晰可见
            metalness: 0.7,
            roughness: 0.4
        });
            const screw = new THREE.Mesh(screwGeometry, screwMaterial);
            screw.position.set(...pos);
            this.handGroup.add(screw);
        });
    }
    
    updateFingerBending(fingerIndex, value) {
        if (fingerIndex < 0 || fingerIndex >= 5) return;
        if (!this.fingerGroups[fingerIndex]) return;
        
        const bendAngle = (value / 1023) * Math.PI / 2; // 0-90度
        const finger = this.fingerGroups[fingerIndex];
        
        if (finger.joints && finger.joints.length > 0) {
            finger.joints.forEach((joint, jointIndex) => {
                const jointBend = bendAngle * (jointIndex + 1) / finger.joints.length;
                joint.rotation.x = -jointBend;
            });
        }
        
        this.fingerData[fingerIndex] = value;
    }
    
    updateHandRotation(imuData) {
        if (!this.handGroup) return;
        
        const { x, y, z } = imuData;
        
        // 计算旋转角度
        const rotationX = Math.atan2(y, Math.sqrt(x * x + z * z)) * 0.5;
        const rotationZ = Math.atan2(x, Math.sqrt(y * y + z * z)) * 0.5;
        
        // 平滑旋转更新（俯仰/側傾 由加速度計）
        this.handGroup.rotation.x = THREE.MathUtils.lerp(
            this.handGroup.rotation.x, rotationX, 0.1
        );
        this.handGroup.rotation.z = THREE.MathUtils.lerp(
            this.handGroup.rotation.z, rotationZ, 0.1
        );

        // 水平旋轉（yaw）由陀螺儀積分結果控制
        this.handGroup.rotation.y = THREE.MathUtils.lerp(
            this.handGroup.rotation.y, this.yaw, 0.1
        );
        
        this.imuData = imuData;
    }
    
    updateFromSensorData(sensorData) {
        try {
            // 更新手指弯曲
            if (sensorData.fingers && Array.isArray(sensorData.fingers)) {
                sensorData.fingers.forEach((value, index) => {
                    if (index < 5) {
                        this.updateFingerBending(index, value);
                    }
                });
            }
            
            // 以陀螺儀 z 軸角速度（deg/s）積分更新 yaw（弧度），達成「跟手同步」水平旋轉
            if (sensorData.gyroscope && isFinite(sensorData.gyroscope.z)) {
                const now = performance.now();
                const dt = this.lastYawTs ? (now - this.lastYawTs) / 1000 : 0;
                this.lastYawTs = now;
                if (dt > 0) {
                    const yawDelta = sensorData.gyroscope.z * Math.PI / 180 * dt; // deg/s -> rad/s * s
                    this.yaw += yawDelta;
                }
            }

            // 更新手部旋转（俯仰/側傾 由加速度計; 水平由 this.yaw）
            if (sensorData.accelerometer) {
                this.updateHandRotation(sensorData.accelerometer);
            }
        } catch (error) {
            console.error('简化3D模型更新错误:', error);
        }
    }

    // 將當前方向設定為 0，抑制漂移
    resetYaw() {
        this.yaw = 0;
        this.lastYawTs = null;
    }
    
    addEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // 鼠标控制
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (!isMouseDown || !this.handGroup) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            this.handGroup.rotation.y += deltaX * 0.01;
            this.handGroup.rotation.x += deltaY * 0.01;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        // 滚轮缩放
        this.renderer.domElement.addEventListener('wheel', (event) => {
            const delta = event.deltaY * 0.001;
            this.camera.position.z = Math.max(3, Math.min(15, this.camera.position.z + delta));
        });

        // 鍵盤快捷鍵：R 重置水平角（yaw）
        this._onKeyDown = (e) => {
            if (e.key === 'r' || e.key === 'R') {
                this.resetYaw();
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.001;
        
        if (this.handGroup) {
            // 轻微浮动
            this.handGroup.position.y = Math.sin(time * 1.2) * 0.05;
            
            // LED闪烁效果
            this.handGroup.traverse((child) => {
                if (child.material && child.material.emissive) {
                    if (child.material.color.getHex() === 0x00ff88) {
                        // 绿色LED
                        child.material.emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.4;
                    } else if (child.material.color.getHex() === 0x4444ff) {
                        // 蓝色LED
                        child.material.emissiveIntensity = 0.8 + Math.sin(time * 6) * 0.4;
                    } else if (child.material.color.getHex() === 0x44ff44) {
                        // 其他绿色LED
                        child.material.emissiveIntensity = 0.8 + Math.sin(time * 5 + 1) * 0.4;
                    } else if (child.material.color.getHex() === 0xff4444) {
                        // 红色传感器LED
                        child.material.emissiveIntensity = 1.0 + Math.sin(time * 8) * 0.5;
                    }
                }
            });
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer && this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        
        // 清理几何体和材质
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        // 解除鍵盤監聽
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
        }
    }
    
    // 测试动画
    testFingerAnimation() {
        let testValue = 0;
        let direction = 1;
        
        const testInterval = setInterval(() => {
            testValue += direction * 50;
            if (testValue >= 1023 || testValue <= 0) {
                direction *= -1;
            }
            
            // 测试所有手指
            for (let i = 0; i < 5; i++) {
                this.updateFingerBending(i, testValue);
            }
        }, 100);
        
        // 10秒后停止测试
        setTimeout(() => {
            clearInterval(testInterval);
            // 重置手指位置
            for (let i = 0; i < 5; i++) {
                this.updateFingerBending(i, 0);
            }
        }, 10000);
    }
}

// 全局变量
let simpleHand3D = null;

// 初始化简化3D手部模型
function initSimpleHand3D() {
    try {
        if (simpleHand3D) {
            simpleHand3D.destroy();
        }
        
        simpleHand3D = new SimpleHand3D('hand3d-container');
        
        // 更新全局变量
        window.simpleHand3D = simpleHand3D;
        // 提供全域重置方法
        window.resetYaw = () => simpleHand3D && simpleHand3D.resetYaw();
        
        console.log('✅ 简化3D机械手初始化成功');
        return true;
    } catch (error) {
        console.error('❌ 简化3D机械手初始化失败:', error);
        return false;
    }
}

// 导出到全局
window.SimpleHand3D = SimpleHand3D;
window.initSimpleHand3D = initSimpleHand3D;

// 更新全局变量
function updateGlobalSimpleHand3D() {
    window.simpleHand3D = simpleHand3D;
}