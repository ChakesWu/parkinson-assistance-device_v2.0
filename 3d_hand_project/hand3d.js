// 3D 手部模型類
class Hand3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.handModel = null;
        this.mixer = null;
        this.bones = {};
        this.animationId = null;
        
        // 手指數據
        this.fingerData = [0, 0, 0, 0, 0]; // 電位器數據 0-1023
        this.imuData = {
            accelerometer: { x: 0, y: 0, z: 0 },
            gyroscope: { x: 0, y: 0, z: 0 },
            magnetometer: { x: 0, y: 0, z: 0 }
        };
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.loadHandModel();
        this.addEventListeners();
        this.animate();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        
        // 創建漸層背景
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // 創建漸層
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 512, 512);
        
        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
        
        // 添加地面
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -3;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // 啟用陰影
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 增強渲染效果以支持PBR材質
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // 背景設置
        this.renderer.setClearColor(0x0a0a0a, 0.8); // 深色科技背景
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    createLights() {
        // 環境光 - 為機械手提供基礎科技感照明
        const ambientLight = new THREE.AmbientLight(0x2a3f5f, 0.3);
        this.scene.add(ambientLight);
        
        // 主要方向光 - 強烈的白光突出金屬質感
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(8, 10, 6);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -12;
        directionalLight.shadow.camera.right = 12;
        directionalLight.shadow.camera.top = 12;
        directionalLight.shadow.camera.bottom = -12;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);
        
        // 藍色科技光 - 從左側照射，營造科技感
        const techLight = new THREE.DirectionalLight(0x4a90e2, 0.8);
        techLight.position.set(-8, 5, 4);
        this.scene.add(techLight);
        
        // 橙色暖光 - 從右側照射，平衡色溫
        const warmLight = new THREE.DirectionalLight(0xff8c42, 0.4);
        warmLight.position.set(6, 3, -4);
        this.scene.add(warmLight);
        
        // 頂部環境光 - 模擬天空光
        const skyLight = new THREE.HemisphereLight(0x87ceeb, 0x2f4f4f, 0.6);
        this.scene.add(skyLight);
        
        // 背光 - 創造酷炫的邊緣光效果
        const rimLight = new THREE.DirectionalLight(0x00ffff, 0.5);
        rimLight.position.set(0, 8, -12);
        this.scene.add(rimLight);
        
        // 底部補光 - 照亮陰影區域
        const bottomLight = new THREE.DirectionalLight(0x6a5acd, 0.3);
        bottomLight.position.set(0, -5, 8);
        this.scene.add(bottomLight);
        
        // 添加動態光效
        this.createDynamicLights();
    }
    
    createDynamicLights() {
        // 創建動態旋轉的彩色光源
        const spotLight1 = new THREE.SpotLight(0xff0080, 1, 15, Math.PI * 0.1);
        spotLight1.position.set(5, 8, 5);
        spotLight1.target.position.set(0, 0, 0);
        this.scene.add(spotLight1);
        this.scene.add(spotLight1.target);
        
        const spotLight2 = new THREE.SpotLight(0x0080ff, 1, 15, Math.PI * 0.1);
        spotLight2.position.set(-5, 8, 5);
        spotLight2.target.position.set(0, 0, 0);
        this.scene.add(spotLight2);
        this.scene.add(spotLight2.target);
        
        // 存儲動態光源以便在動畫中使用
        this.dynamicLights = [spotLight1, spotLight2];
    }
    
    loadHandModel() {
        // 檢查 GLTFLoader 是否可用
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.error('GLTFLoader 未載入，使用備用模型');
            this.createFallbackModel();
            return;
        }
        
        const loader = new THREE.GLTFLoader();
        
        loader.load(
            'hand_model.glb',
            (gltf) => {
                this.handModel = gltf.scene;
                
                // 設置模型屬性
                this.handModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // 設置模型大小和位置
                this.handModel.scale.set(2, 2, 2);
                this.handModel.position.set(0, -1, 0);
                
                // 如果有動畫，設置動畫混合器
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.handModel);
                }
                
                // 收集骨骼引用
                this.collectBones();
                
                this.scene.add(this.handModel);
                
                // 隱藏載入提示
                const loadingElement = document.querySelector('.hand3d-loading');
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                
                console.log('3D手部模型載入成功');
            },
            (progress) => {
                console.log('載入進度:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('載入3D模型失敗:', error);
                // 如果載入失敗，回退到程序生成的模型
                this.createFallbackModel();
            }
        );
    }
    
    collectBones() {
        if (!this.handModel) return;
        
        // 根據實際的骨骼名稱收集手指骨骼
        const fingerBonePatterns = [
            // 拇指 (左手)
            ['thumb.01.L', 'thumb.02.L', 'thumb.03.L'],
            // 食指 (左手)
            ['finger_index.01.L', 'finger_index.02.L', 'finger_index.03.L'],
            // 中指 (左手)
            ['finger_middle.01.L', 'finger_middle.02.L', 'finger_middle.03.L'],
            // 無名指 (左手)
            ['finger_ring.01.L', 'finger_ring.02.L', 'finger_ring.03.L'],
            // 小指 (左手)
            ['finger_pinky.01.L', 'finger_pinky.02.L', 'finger_pinky.03.L']
        ];
        
        this.handModel.traverse((child) => {
            if (child.isBone || child.type === 'Bone') {
                const boneName = child.name;
                
                // 嘗試匹配手指骨骼
                fingerBonePatterns.forEach((fingerBones, fingerIndex) => {
                    fingerBones.forEach((expectedName, jointIndex) => {
                        if (boneName === expectedName) {
                            if (!this.bones[fingerIndex]) {
                                this.bones[fingerIndex] = [];
                            }
                            this.bones[fingerIndex][jointIndex] = child;
                        }
                    });
                });
                
                // 也保存所有骨骼以便調試
                this.bones[boneName] = child;
            }
        });
        
        console.log('收集到的骨骼:', this.bones);
        console.log('手指骨骼映射:');
        for (let i = 0; i < 5; i++) {
            if (this.bones[i]) {
                console.log(`手指 ${i}:`, this.bones[i].map(bone => bone ? bone.name : 'null'));
            }
        }
    }
    
    createFallbackModel() {
        // 如果GLB載入失敗，創建簡化的手部模型
        this.handModel = new THREE.Group();
        
        // 創建手掌
        this.createPalm();
        
        // 創建五根手指
        this.createFingers();
        
        this.scene.add(this.handModel);
        
        // 隱藏載入提示
        const loadingElement = document.querySelector('.hand3d-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        console.log('使用備用手部模型');
    }
    
    createPalm() {
        // 創建機械手掌的主體 - 更有棱角的設計
        const palmGeometry = new THREE.BoxGeometry(2.4, 0.6, 3.0);
        
        // 機械手掌的金屬材質
        const palmMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x4a5568,
            metalness: 0.8,
            roughness: 0.2,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1
        });
        
        const palm = new THREE.Mesh(palmGeometry, palmMaterial);
        palm.position.set(0, 0, 0);
        palm.castShadow = true;
        palm.receiveShadow = true;
        this.handModel.add(palm);
        
        // 添加機械手掌的裝飾線條
        const plateGeometry = new THREE.BoxGeometry(2.0, 0.05, 2.6);
        const plateMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x2d3748,
            metalness: 0.9,
            roughness: 0.1
        });
        
        const topPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        topPlate.position.set(0, 0.32, 0);
        this.handModel.add(topPlate);
        
        const bottomPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        bottomPlate.position.set(0, -0.32, 0);
        this.handModel.add(bottomPlate);
        
        // 添加LED指示燈
        this.createPalmLEDs();
        
        // 添加機械手腕
        this.createRobotWrist();
        
        // 添加機械細節
        this.createMechanicalDetails();
    }
    
    createPalmLEDs() {
        // 創建LED指示燈
        const ledGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const ledMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff88,
            emissive: 0x004422,
            transparent: true,
            opacity: 0.8
        });
        
        const ledPositions = [
            [-0.8, 0.35, 0.5],
            [0, 0.35, 0.8],
            [0.8, 0.35, 0.5]
        ];
        
        ledPositions.forEach(pos => {
            const led = new THREE.Mesh(ledGeometry, ledMaterial);
            led.position.set(...pos);
            this.handModel.add(led);
            
            // 添加LED光源效果
            const ledLight = new THREE.PointLight(0x00ff88, 0.5, 2);
            ledLight.position.copy(led.position);
            this.handModel.add(ledLight);
        });
    }
    
    createRobotWrist() {
        // 機械手腕主體
        const wristGeometry = new THREE.CylinderGeometry(0.9, 1.0, 1.8, 12);
        const wristMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x2d3748,
            metalness: 0.9,
            roughness: 0.3
        });
        const wrist = new THREE.Mesh(wristGeometry, wristMaterial);
        wrist.position.set(0, -0.9, -1.2);
        wrist.castShadow = true;
        wrist.receiveShadow = true;
        this.handModel.add(wrist);
        
        // 手腕關節環
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
            const ringGeometry = new THREE.TorusGeometry(1.1, 0.08, 8, 16);
            const ringMaterial = new THREE.MeshPhysicalMaterial({ 
                color: 0x1a202c,
                metalness: 1.0,
                roughness: 0.1
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.set(0, -0.4 - i * 0.4, -1.2);
            ring.rotation.x = Math.PI / 2;
            this.handModel.add(ring);
        }
    }
    
    createMechanicalDetails() {
        // 添加螺丝和機械細節
        const screwGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8);
        const screwMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x718096,
            metalness: 0.9,
            roughness: 0.4
        });
        
        const screwPositions = [
            [-1.0, 0.35, -1.0], [1.0, 0.35, -1.0],
            [-1.0, 0.35, 1.0], [1.0, 0.35, 1.0]
        ];
        
        screwPositions.forEach(pos => {
            const screw = new THREE.Mesh(screwGeometry, screwMaterial);
            screw.position.set(...pos);
            this.handModel.add(screw);
        });
        
        // 添加通風口
        this.createVentilation();
    }
    
    createVentilation() {
        const ventGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.8);
        const ventMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        for (let i = 0; i < 4; i++) {
            const vent = new THREE.Mesh(ventGeometry, ventMaterial);
            vent.position.set(-0.6 + i * 0.4, 0.32, -0.8);
            this.handModel.add(vent);
        }
    }
    
    createFingers() {
        const fingerConfigs = [
            { name: 'thumb', position: [-1.4, 0.3, 0.8], rotation: [0, 0, -0.4], scale: [0.9, 0.9, 0.8] },
            { name: 'index', position: [-0.7, 0.3, 2.0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            { name: 'middle', position: [0, 0.3, 2.1], rotation: [0, 0, 0], scale: [1, 1, 1.1] },
            { name: 'ring', position: [0.7, 0.3, 2.0], rotation: [0, 0, 0], scale: [1, 1, 0.95] },
            { name: 'pinky', position: [1.3, 0.3, 1.6], rotation: [0, 0, 0.1], scale: [0.8, 0.8, 0.8] }
        ];
        
        fingerConfigs.forEach((config, index) => {
            const finger = this.createFinger(config.name, index);
            finger.position.set(...config.position);
            finger.rotation.set(...config.rotation);
            finger.scale.set(...config.scale);
            
            if (!this.bones[index]) {
                this.bones[index] = [];
            }
            this.bones[index] = finger.joints;
            
            this.handModel.add(finger);
        });
    }
    
    createFinger(name, index) {
        const fingerGroup = new THREE.Group();
        fingerGroup.name = name;
        
        // 根據手指類型調整關節配置 - 機械手指版本
        let joints;
        if (name === 'thumb') {
            joints = [
                { length: 0.9, radius: 0.16, type: 'base' }, // 拇指較粗短
                { length: 0.7, radius: 0.13, type: 'middle' },
                { length: 0.5, radius: 0.11, type: 'tip' }
            ];
        } else if (name === 'pinky') {
            joints = [
                { length: 0.6, radius: 0.09, type: 'base' }, // 小指較細短
                { length: 0.5, radius: 0.08, type: 'middle' },
                { length: 0.3, radius: 0.07, type: 'tip' }
            ];
        } else {
            joints = [
                { length: 0.8, radius: 0.13, type: 'base' }, // 其他手指
                { length: 0.7, radius: 0.11, type: 'middle' },
                { length: 0.5, radius: 0.09, type: 'tip' }
            ];
        }
        
        let currentY = 0;
        const jointMeshes = [];
        
        joints.forEach((joint, jointIndex) => {
            // 創建機械手指關節
            const jointPivot = this.createRobotJoint(joint, jointIndex, joints.length);
            jointPivot.position.y = currentY;
            
            fingerGroup.add(jointPivot);
            jointMeshes.push(jointPivot);
            
            currentY += joint.length;
        });
        
        // 儲存關節引用以便動畫
        fingerGroup.joints = jointMeshes;
        
        return fingerGroup;
    }
    
    createRobotJoint(joint, jointIndex, totalJoints) {
        const jointPivot = new THREE.Group();
        
        // 主要關節材質
        const jointMaterial = new THREE.MeshPhysicalMaterial({ 
            color: jointIndex === 0 ? 0x4a5568 : 0x2d3748, // 基節較亮
            metalness: 0.9,
            roughness: 0.2,
            clearcoat: 0.3
        });
        
        // 創建機械關節主體 - 更有棱角的設計
        const mainGeometry = new THREE.CylinderGeometry(
            joint.radius * 0.9, joint.radius, joint.length * 0.8, 8
        );
        const mainJoint = new THREE.Mesh(mainGeometry, jointMaterial);
        mainJoint.position.y = joint.length * 0.4;
        mainJoint.castShadow = true;
        mainJoint.receiveShadow = true;
        jointPivot.add(mainJoint);
        
        // 添加關節連接器
        this.createJointConnector(jointPivot, joint, jointIndex);
        
        // 添加關節環（鉸鏈效果）
        this.createJointRings(jointPivot, joint);
        
        // 添加機械指尖（最後一個關節）
        if (jointIndex === totalJoints - 1) {
            this.createRobotFingerTip(jointPivot, joint);
        }
        
        // 添加關節LED指示燈
        this.createJointLED(jointPivot, joint, jointIndex);
        
        return jointPivot;
    }
    
    createJointConnector(jointPivot, joint, jointIndex) {
        // 關節連接器
        const connectorGeometry = new THREE.CylinderGeometry(
            joint.radius * 1.1, joint.radius * 1.1, 0.1, 8
        );
        const connectorMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x1a202c,
            metalness: 1.0,
            roughness: 0.1
        });
        
        const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
        connector.position.y = 0;
        jointPivot.add(connector);
        
        // 添加螺釘細節
        const screwGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6);
        const screwMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x718096,
            metalness: 0.9,
            roughness: 0.4
        });
        
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * joint.radius * 0.8;
            const z = Math.sin(angle) * joint.radius * 0.8;
            
            const screw = new THREE.Mesh(screwGeometry, screwMaterial);
            screw.position.set(x, 0, z);
            jointPivot.add(screw);
        }
    }
    
    createJointRings(jointPivot, joint) {
        // 機械關節環
        for (let i = 0; i < 2; i++) {
            const ringGeometry = new THREE.TorusGeometry(joint.radius * 0.7, 0.03, 6, 12);
            const ringMaterial = new THREE.MeshPhysicalMaterial({ 
                color: 0x1a202c,
                metalness: 1.0,
                roughness: 0.1
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.y = joint.length * 0.2 + i * joint.length * 0.4;
            ring.rotation.x = Math.PI / 2;
            jointPivot.add(ring);
        }
    }
    
    createRobotFingerTip(jointPivot, joint) {
        // 機械指尖
        const tipGeometry = new THREE.ConeGeometry(joint.radius * 0.8, joint.length * 0.3, 8);
        const tipMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x1a202c,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 0.8
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.position.y = joint.length * 0.85;
        tip.castShadow = true;
        jointPivot.add(tip);
        
        // 添加感應器
        const sensorGeometry = new THREE.SphereGeometry(joint.radius * 0.3, 8, 8);
        const sensorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff4444,
            emissive: 0x441111,
            transparent: true,
            opacity: 0.7
        });
        const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
        sensor.position.y = joint.length * 0.9;
        jointPivot.add(sensor);
    }
    
    createJointLED(jointPivot, joint, jointIndex) {
        // 關節狀態LED
        const ledGeometry = new THREE.SphereGeometry(0.04, 6, 6);
        const ledColor = jointIndex === 0 ? 0x4444ff : 0x44ff44; // 藍色基節，綠色其他
        const ledMaterial = new THREE.MeshBasicMaterial({ 
            color: ledColor,
            emissive: ledColor,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(joint.radius * 0.9, joint.length * 0.5, 0);
        jointPivot.add(led);
        
        // 添加LED光源
        const ledLight = new THREE.PointLight(ledColor, 0.3, 1);
        ledLight.position.copy(led.position);
        jointPivot.add(ledLight);
    }
    
    updateFingerBending(fingerIndex, value) {
        if (fingerIndex < 0 || fingerIndex >= 5) return;
        
        const bendAngle = (value / 1023) * Math.PI / 2; // 0-90度轉換為弧度
        
        // 如果有rigged模型的骨骼
        if (this.bones[fingerIndex] && Array.isArray(this.bones[fingerIndex])) {
            this.bones[fingerIndex].forEach((bone, jointIndex) => {
                if (bone && bone.rotation) {
                    const jointBend = bendAngle * (jointIndex + 1) / this.bones[fingerIndex].length;
                    bone.rotation.x = -jointBend;
                }
            });
        }
        // 如果是備用模型
        else if (this.handModel && this.handModel.children) {
            const finger = this.handModel.children.find(child => 
                child.name === ['thumb', 'index', 'middle', 'ring', 'pinky'][fingerIndex]
            );
            
            if (finger && finger.joints) {
                finger.joints.forEach((joint, jointIndex) => {
                    const jointBend = bendAngle * (jointIndex + 1) / finger.joints.length;
                    joint.rotation.x = -jointBend;
                });
            }
        }
        
        this.fingerData[fingerIndex] = value;
    }
    
    updateHandRotation(imuData) {
        if (!this.handModel) return;
        
        // 使用加速度計數據計算手部傾斜
        const { x, y, z } = imuData.accelerometer;
        
        // 計算旋轉角度（簡化版本）
        const rotationX = Math.atan2(y, Math.sqrt(x * x + z * z));
        const rotationZ = Math.atan2(x, Math.sqrt(y * y + z * z));
        
        // 平滑旋轉更新
        this.handModel.rotation.x = THREE.MathUtils.lerp(
            this.handModel.rotation.x, rotationX, 0.1
        );
        this.handModel.rotation.z = THREE.MathUtils.lerp(
            this.handModel.rotation.z, rotationZ, 0.1
        );
        // 水平旋轉（yaw）跟手同步
        if (typeof this.yaw === 'number') {
            this.handModel.rotation.y = THREE.MathUtils.lerp(
                this.handModel.rotation.y, this.yaw, 0.1
            );
        }
        
        this.imuData = imuData;
    }
    
    updateFromSensorData(sensorData) {
        // 更新手指彎曲
        if (sensorData.fingers) {
            sensorData.fingers.forEach((value, index) => {
                this.updateFingerBending(index, value);
            });
        }
        
        // 以陀螺儀 z 軸角速度（deg/s）積分更新 yaw（弧度）
        if (sensorData.gyroscope && isFinite(sensorData.gyroscope.z)) {
            if (!this._lastYawTs) this._lastYawTs = performance.now();
            const now = performance.now();
            const dt = (now - this._lastYawTs) / 1000;
            this._lastYawTs = now;
            if (!this.yaw) this.yaw = 0;
            if (dt > 0) {
                this.yaw += sensorData.gyroscope.z * Math.PI / 180 * dt;
            }
        }

        // 更新手部旋轉
        if (sensorData.accelerometer) {
            this.updateHandRotation({
                accelerometer: sensorData.accelerometer,
                gyroscope: sensorData.gyroscope || { x: 0, y: 0, z: 0 },
                magnetometer: sensorData.magnetometer || { x: 0, y: 0, z: 0 }
            });
        }
    }
    
    resetYaw() {
        this.yaw = 0;
        this._lastYawTs = null;
    }
    
    addEventListeners() {
        // 窗口大小調整
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // 鼠標控制
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            this.handModel.rotation.y += deltaX * 0.01;
            this.handModel.rotation.x += deltaY * 0.01;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        // 滾輪縮放
        this.renderer.domElement.addEventListener('wheel', (event) => {
            const delta = event.deltaY * 0.001;
            this.camera.position.z = Math.max(2, Math.min(10, this.camera.position.z + delta));
        });
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
        
        // 更新動畫混合器
        if (this.mixer) {
            this.mixer.update(0.016); // 假設60fps
        }
        
        // 機械手動畫效果
        const time = Date.now() * 0.001;
        if (this.handModel) {
            // 機械手輕微浮動（更精確的機械感）
            this.handModel.position.y = Math.sin(time * 1.2) * 0.03 - 1;
            
            // 機械手微旋轉
            this.handModel.rotation.y += Math.sin(time * 0.3) * 0.001;
        }
        
        // 動態光效動畫
        if (this.dynamicLights) {
            this.dynamicLights.forEach((light, index) => {
                if (light) {
                    // 光源圓形運動
                    const radius = 8;
                    const speed = 0.5 + index * 0.3;
                    const angle = time * speed + index * Math.PI;
                    
                    light.position.x = Math.cos(angle) * radius;
                    light.position.z = Math.sin(angle) * radius;
                    light.position.y = 8 + Math.sin(time * 2 + index) * 2;
                    
                    // 光強度脈動
                    light.intensity = 0.8 + Math.sin(time * 3 + index * 2) * 0.4;
                }
            });
        }
        
        // LED燈閃爍效果
        this.animateLEDs(time);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    animateLEDs(time) {
        // 遍歷手部模型找到LED元件並添加閃爍效果
        if (this.handModel) {
            this.handModel.traverse((child) => {
                if (child.material && child.material.emissive) {
                    // 檢查是否是LED材質
                    if (child.material.color.getHex() === 0x00ff88) {
                        // 綠色LED脈動
                        child.material.emissiveIntensity = 0.3 + Math.sin(time * 4) * 0.2;
                    } else if (child.material.color.getHex() === 0x4444ff) {
                        // 藍色LED脈動
                        child.material.emissiveIntensity = 0.3 + Math.sin(time * 6) * 0.2;
                    } else if (child.material.color.getHex() === 0x44ff44) {
                        // 其他綠色LED脈動
                        child.material.emissiveIntensity = 0.3 + Math.sin(time * 5 + 1) * 0.2;
                    } else if (child.material.color.getHex() === 0xff4444) {
                        // 紅色傳感器LED脈動
                        child.material.emissiveIntensity = 0.4 + Math.sin(time * 8) * 0.3;
                    }
                }
            });
        }
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
    }
    
    // 測試方法
    testFingerAnimation() {
        let testValue = 0;
        let direction = 1;
        
        const testInterval = setInterval(() => {
            testValue += direction * 50;
            if (testValue >= 1023 || testValue <= 0) {
                direction *= -1;
            }
            
            // 測試所有手指
            for (let i = 0; i < 5; i++) {
                this.updateFingerBending(i, testValue);
            }
        }, 100);
        
        // 10秒後停止測試
        setTimeout(() => {
            clearInterval(testInterval);
            // 重置手指位置
            for (let i = 0; i < 5; i++) {
                this.updateFingerBending(i, 0);
            }
        }, 10000);
    }
}

// 全域變量
let hand3D = null;

// 初始化3D手部模型
function initHand3D() {
    if (hand3D) {
        hand3D.destroy();
    }
    
    hand3D = new Hand3D('hand3d-container');
    
    // 連接到現有的感測器數據
    if (window.getAllSensorData) {
        const updateLoop = () => {
            const sensorData = window.getAllSensorData();
            if (sensorData && sensorData.isConnected) {
                hand3D.updateFromSensorData(sensorData);
            }
            requestAnimationFrame(updateLoop);
        };
        updateLoop();
    }
}

// 導出到全域
window.Hand3D = Hand3D;
window.initHand3D = initHand3D;

