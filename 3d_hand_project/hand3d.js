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
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
    }
    
    createLights() {
        // 環境光 - 提供基礎照明
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // 主要方向光 - 模擬太陽光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(5, 8, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.scene.add(directionalLight);
        
        // 補光 - 減少陰影過深
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-3, 3, -3);
        this.scene.add(fillLight);
        
        // 點光源 - 增加細節照明
        const pointLight = new THREE.PointLight(0xffffff, 0.6, 20);
        pointLight.position.set(-5, 5, 5);
        pointLight.castShadow = true;
        this.scene.add(pointLight);
        
        // 邊緣光 - 增強立體感
        const rimLight = new THREE.DirectionalLight(0xccddff, 0.4);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);
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
        // 創建更逼真的手掌形狀
        const palmGeometry = new THREE.BoxGeometry(2.2, 0.4, 2.8);
        
        // 使用更逼真的肌膚材質
        const palmMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xfdbcb4,
            shininess: 30,
            specular: 0x111111
        });
        
        const palm = new THREE.Mesh(palmGeometry, palmMaterial);
        palm.position.set(0, 0, 0);
        palm.castShadow = true;
        palm.receiveShadow = true;
        
        // 添加手掌的圓角效果
        palm.scale.set(1, 1, 0.9);
        
        this.handModel.add(palm);
        
        // 添加手腕部分
        const wristGeometry = new THREE.CylinderGeometry(0.8, 0.9, 1.5, 12);
        const wristMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xfdbcb4,
            shininess: 30,
            specular: 0x111111
        });
        const wrist = new THREE.Mesh(wristGeometry, wristMaterial);
        wrist.position.set(0, -0.75, -1.2);
        wrist.castShadow = true;
        wrist.receiveShadow = true;
        this.handModel.add(wrist);
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
        
        // 根據手指類型調整關節配置
        let joints;
        if (name === 'thumb') {
            joints = [
                { length: 0.9, radius: 0.15 }, // 拇指較粗短
                { length: 0.7, radius: 0.12 },
                { length: 0.5, radius: 0.1 }
            ];
        } else if (name === 'pinky') {
            joints = [
                { length: 0.6, radius: 0.08 }, // 小指較細短
                { length: 0.5, radius: 0.07 },
                { length: 0.3, radius: 0.06 }
            ];
        } else {
            joints = [
                { length: 0.8, radius: 0.12 }, // 其他手指
                { length: 0.7, radius: 0.1 },
                { length: 0.5, radius: 0.08 }
            ];
        }
        
        let currentY = 0;
        const jointMeshes = [];
        
        joints.forEach((joint, jointIndex) => {
            // 創建更圓滑的手指關節 - 使用 CylinderGeometry 替代 CapsuleGeometry
            const jointGeometry = new THREE.CylinderGeometry(
                joint.radius, joint.radius, joint.length, 12
            );
            
            // 添加圓形端蓋
            const topCapGeometry = new THREE.SphereGeometry(joint.radius, 8, 8);
            const bottomCapGeometry = new THREE.SphereGeometry(joint.radius, 8, 8);
            
            // 使用更逼真的肌膚材質
            const jointMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xfdbcb4,
                shininess: 30,
                specular: 0x111111,
                transparent: true,
                opacity: 0.95
            });
            
            const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
            const topCap = new THREE.Mesh(topCapGeometry, jointMaterial);
            const bottomCap = new THREE.Mesh(bottomCapGeometry, jointMaterial);
            
            // 設置位置
            jointMesh.position.y = currentY + joint.length / 2;
            topCap.position.y = currentY + joint.length;
            bottomCap.position.y = currentY;
            
            jointMesh.castShadow = true;
            jointMesh.receiveShadow = true;
            topCap.castShadow = true;
            topCap.receiveShadow = true;
            bottomCap.castShadow = true;
            bottomCap.receiveShadow = true;
            
            // 設置旋轉軸心在關節底部
            const jointPivot = new THREE.Group();
            jointPivot.position.y = currentY;
            
            // 調整關節位置
            jointMesh.position.y = joint.length / 2;
            topCap.position.y = joint.length;
            bottomCap.position.y = 0;
            
            jointPivot.add(jointMesh);
            jointPivot.add(topCap);
            jointPivot.add(bottomCap);
            
            // 添加指甲（僅在最後一個關節）
            if (jointIndex === joints.length - 1) {
                const nailGeometry = new THREE.SphereGeometry(joint.radius * 0.8, 8, 6, 0, Math.PI);
                const nailMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0xf5d5c8,
                    shininess: 50,
                    specular: 0x222222
                });
                const nail = new THREE.Mesh(nailGeometry, nailMaterial);
                nail.position.set(0, joint.length * 0.8, joint.radius * 0.3);
                nail.rotation.x = -Math.PI / 2;
                jointPivot.add(nail);
            }
            
            fingerGroup.add(jointPivot);
            jointMeshes.push(jointPivot);
            
            currentY += joint.length;
        });
        
        // 儲存關節引用以便動畫
        fingerGroup.joints = jointMeshes;
        
        return fingerGroup;
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
        
        this.imuData = imuData;
    }
    
    updateFromSensorData(sensorData) {
        // 更新手指彎曲
        if (sensorData.fingers) {
            sensorData.fingers.forEach((value, index) => {
                this.updateFingerBending(index, value);
            });
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
        
        // 更自然的手部浮動動畫
        const time = Date.now() * 0.001;
        if (this.handModel) {
            // 輕微的上下浮動
            this.handModel.position.y = Math.sin(time * 0.8) * 0.05 - 1;
            
            // 輕微的左右搖擺
            this.handModel.rotation.y += Math.sin(time * 0.5) * 0.002;
            
            // 輕微的前後傾斜
            this.handModel.rotation.x += Math.cos(time * 0.3) * 0.001;
        }
        
        this.renderer.render(this.scene, this.camera);
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

