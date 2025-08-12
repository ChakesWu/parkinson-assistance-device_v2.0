import * as THREE from 'three';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class Hand3D {
    container: HTMLElement;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    handModel: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    bones: { [key: string]: any };
    animationId: number | null;
    fingerData: number[];
    imuData: {
        accelerometer: { x: number; y: number; z: number };
        gyroscope: { x: number; y: number; z: number };
        magnetometer: { x: number; y: number; z: number };
    };
    dynamicLights: THREE.SpotLight[];

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.handModel = null;
        this.mixer = null;
        this.bones = {};
        this.animationId = null;
        this.fingerData = [0, 0, 0, 0, 0];
        this.imuData = {
            accelerometer: { x: 0, y: 0, z: 0 },
            gyroscope: { x: 0, y: 0, z: 0 },
            magnetometer: { x: 0, y: 0, z: 0 }
        };
        this.dynamicLights = [];
        
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
        
        // 創建背景
        this.scene.background = new THREE.Color(0x0a0a0a);
        
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
        // @ts-ignore
        this.renderer.shadowMap.enabled = true;
        // @ts-ignore
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 增強渲染效果 (移除不再支持的属性)
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    createLights() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0x2a3f5f, 0.3);
        this.scene!.add(ambientLight);
        
        // 主要方向光
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
        this.scene!.add(directionalLight);
        
        // 藍色科技光
        const techLight = new THREE.DirectionalLight(0x4a90e2, 0.8);
        techLight.position.set(-8, 5, 4);
        this.scene!.add(techLight);
        
        // 橙色暖光
        const warmLight = new THREE.DirectionalLight(0xff8c42, 0.4);
        warmLight.position.set(6, 3, -4);
        this.scene!.add(warmLight);
        
        // 頂部環境光
        const skyLight = new THREE.HemisphereLight(0x87ceeb, 0x2f4f4f, 0.6);
        this.scene!.add(skyLight);
        
        // 背光
        const rimLight = new THREE.DirectionalLight(0x00ffff, 0.5);
        rimLight.position.set(0, 8, -12);
        this.scene!.add(rimLight);
        
        // 底部補光
        const bottomLight = new THREE.DirectionalLight(0x6a5acd, 0.3);
        bottomLight.position.set(0, -5, 8);
        this.scene!.add(bottomLight);
        
        // 添加動態光效
        this.createDynamicLights();
    }
    
    createDynamicLights() {
        // 創建動態旋轉的彩色光源
        const spotLight1 = new THREE.SpotLight(0xff0080, 1, 15, Math.PI * 0.1);
        spotLight1.position.set(5, 8, 5);
        spotLight1.target.position.set(0, 0, 0);
        this.scene!.add(spotLight1);
        this.scene!.add(spotLight1.target);
        
        const spotLight2 = new THREE.SpotLight(0x0080ff, 1, 15, Math.PI * 0.1);
        spotLight2.position.set(-5, 8, 5);
        spotLight2.target.position.set(0, 0, 0);
        this.scene!.add(spotLight2);
        this.scene!.add(spotLight2.target);
        
        // 存儲動態光源以便在動畫中使用
        this.dynamicLights = [spotLight1, spotLight2];
    }
    
    loadHandModel() {
        // 檢查 GLTFLoader 是否可用
        // @ts-ignore
        if (typeof GLTFLoader === 'undefined') {
            console.error('GLTFLoader 未載入，使用備用模型');
            this.createFallbackModel();
            return;
        }
        
        const loader = new GLTFLoader();
        
        loader.load(
            '/models/hand_model.glb',
            (gltf) => {
                this.handModel = gltf.scene;
                
                // 設置模型屬性
                this.handModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // 設置模型大小和位置 (左手顯示)
                this.handModel.scale.set(2, 2, 2);
                this.handModel.position.set(0, -1, 0);

                // 設置手部初始旋轉，確保手掌和手指在同一水平面
                this.handModel.rotation.x = 0;
                this.handModel.rotation.y = 0;
                this.handModel.rotation.z = 0;

                // 確保顯示為左手 (如果模型原本是右手，需要鏡像)
                // 注意：如果GLB模型已經是左手，則不需要鏡像
                // this.handModel.scale.x = -2; // 取消註釋以鏡像X軸
                
                // 如果有動畫，設置動畫混合器
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.handModel);
                }
                
                // 收集骨骼引用
                this.collectBones();
                
                this.scene?.add(this.handModel);
                
                console.log('3D手部模型載入成功');
            },
            undefined,
            (error) => {
                console.error('載入3D模型失敗:', error);
                // 如果載入失敗，回退到程序生成的模型
                this.createFallbackModel();
            }
        );
    }
    
    collectBones() {
        if (!this.handModel) return;
        
        // 根據實際的骨骼名稱收集手指骨骼 (左手邏輯：拇指到小指)
        const fingerBonePatterns = [
            // finger1: 拇指 (左手)
            ['thumb.01.L', 'thumb.02.L', 'thumb.03.L'],
            // finger2: 食指 (左手)
            ['finger_index.01.L', 'finger_index.02.L', 'finger_index.03.L'],
            // finger3: 中指 (左手)
            ['finger_middle.01.L', 'finger_middle.02.L', 'finger_middle.03.L'],
            // finger4: 無名指 (左手)
            ['finger_ring.01.L', 'finger_ring.02.L', 'finger_ring.03.L'],
            // finger5: 小指 (左手)
            ['finger_pinky.01.L', 'finger_pinky.02.L', 'finger_pinky.03.L']
        ];
        
        this.handModel.traverse((child) => {
            if (child instanceof THREE.Bone || child.type === 'Bone') {
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
    }
    
    createFallbackModel() {
        // 如果GLB載入失敗，創建簡化的手部模型
        this.handModel = new THREE.Group();
        
        // 創建手掌
        this.createPalm();
        
        // 創建五根手指
        this.createFingers();
        
        this.scene?.add(this.handModel);
        
        console.log('使用備用手部模型');
    }
    
    createPalm() {
        // 創建機械手掌的主體
        const palmGeometry = new THREE.BoxGeometry(2.4, 0.6, 3.0);
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
        this.handModel?.add(palm);
        
        // 添加機械手腕
        this.createRobotWrist();
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
        this.handModel?.add(wrist);
    }
    
    createFingers() {
        // 左手手指配置 (finger1=拇指, finger2=食指, finger3=中指, finger4=無名指, finger5=小指)
        const fingerConfigs = [
            { name: 'thumb', position: [1.4, 0.3, 0.8], rotation: [0, 0, 0.4], scale: [0.9, 0.9, 0.8] },    // finger1: 拇指 (左手位置)
            { name: 'index', position: [0.7, 0.3, 2.0], rotation: [0, 0, 0], scale: [1, 1, 1] },            // finger2: 食指
            { name: 'middle', position: [0, 0.3, 2.1], rotation: [0, 0, 0], scale: [1, 1, 1.1] },           // finger3: 中指
            { name: 'ring', position: [-0.7, 0.3, 2.0], rotation: [0, 0, 0], scale: [1, 1, 0.95] },         // finger4: 無名指
            { name: 'pinky', position: [-1.3, 0.3, 1.6], rotation: [0, 0, -0.1], scale: [0.8, 0.8, 0.8] }  // finger5: 小指
        ];
        
        fingerConfigs.forEach((config, index) => {
            const finger = this.createFinger(config.name, index);
            finger.position.set(config.position[0], config.position[1], config.position[2]);
            finger.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);
            finger.scale.set(config.scale[0], config.scale[1], config.scale[2]);
            
            if (!this.bones[index]) {
                this.bones[index] = [];
            }
            // @ts-ignore
            this.bones[index] = finger.joints;
            
            this.handModel?.add(finger);
        });
    }
    
    createFinger(name: string, index: number) {
        const fingerGroup = new THREE.Group();
        fingerGroup.name = name;
        
        // 根據手指類型調整關節配置
        let joints;
        if (name === 'thumb') {
            joints = [
                { length: 0.9, radius: 0.16, type: 'base' },
                { length: 0.7, radius: 0.13, type: 'middle' },
                { length: 0.5, radius: 0.11, type: 'tip' }
            ];
        } else if (name === 'pinky') {
            joints = [
                { length: 0.6, radius: 0.09, type: 'base' },
                { length: 0.5, radius: 0.08, type: 'middle' },
                { length: 0.3, radius: 0.07, type: 'tip' }
            ];
        } else {
            joints = [
                { length: 0.8, radius: 0.13, type: 'base' },
                { length: 0.7, radius: 0.11, type: 'middle' },
                { length: 0.5, radius: 0.09, type: 'tip' }
            ];
        }
        
        let currentY = 0;
        const jointMeshes: THREE.Group[] = [];
        
        joints.forEach((joint, jointIndex) => {
            // 創建機械手指關節
            const jointPivot = this.createRobotJoint(joint, jointIndex, joints.length);
            jointPivot.position.y = currentY;
            
            fingerGroup.add(jointPivot);
            jointMeshes.push(jointPivot);
            
            currentY += joint.length;
        });
        
        // 儲存關節引用以便動畫
        // @ts-ignore
        fingerGroup.joints = jointMeshes;
        
        return fingerGroup;
    }
    
    createRobotJoint(joint: any, jointIndex: number, totalJoints: number) {
        const jointPivot = new THREE.Group();
        
        // 主要關節材質
        const jointMaterial = new THREE.MeshPhysicalMaterial({ 
            color: jointIndex === 0 ? 0x4a5568 : 0x2d3748,
            metalness: 0.9,
            roughness: 0.2,
            clearcoat: 0.3
        });
        
        // 創建機械關節主體
        const mainGeometry = new THREE.CylinderGeometry(
            joint.radius * 0.9, joint.radius, joint.length * 0.8, 8
        );
        const mainJoint = new THREE.Mesh(mainGeometry, jointMaterial);
        mainJoint.position.y = joint.length * 0.4;
        mainJoint.castShadow = true;
        mainJoint.receiveShadow = true;
        jointPivot.add(mainJoint);
        
        return jointPivot;
    }
    
    updateFingerBending(fingerIndex: number, value: number) {
        if (fingerIndex < 0 || fingerIndex >= 5) return;

        // 現在value是弯曲度值（0=伸直，正值=彎曲）
        // 將弯曲度值映射到角度，假設最大弯曲度為300對應90度
        const maxBendValue = 300;
        const normalizedValue = Math.max(0, Math.min(value / maxBendValue, 1));
        const bendAngle = normalizedValue * Math.PI / 2; // 0-90度轉換為弧度
        
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
            const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
            const finger = this.handModel.children.find(child => 
                child.name === fingerNames[fingerIndex]
            );
            
            // @ts-ignore
            if (finger && finger.joints) {
                // @ts-ignore
                // 修改：使用正角度，讓手指在水平面上彎曲
                finger.joints.forEach((joint, jointIndex) => {
                    const jointBend = bendAngle * (jointIndex + 1) / (finger as any).joints.length;
                    joint.rotation.x = jointBend; // 改為正角度，水平面彎曲
                });
            }
        }
        
        this.fingerData[fingerIndex] = value;
    }
    
    updateHandRotation(imuData: any) {
        if (!this.handModel) return;
        
        // 使用加速度計數據計算手部傾斜
        const { x, y, z } = imuData.accelerometer;
        
        // 計算旋轉角度
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
    
    updateFromSensorData(sensorData: any) {
        // 更新手指彎曲
        if (sensorData.fingers) {
            sensorData.fingers.forEach((value: number, index: number) => {
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
        
        if (this.renderer) {
            this.renderer.domElement.addEventListener('mousedown', (event) => {
                isMouseDown = true;
                mouseX = event.clientX;
                mouseY = event.clientY;
            });
            
            this.renderer.domElement.addEventListener('mousemove', (event) => {
                if (!isMouseDown || !this.handModel) return;
                
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
                if (this.camera) {
                    this.camera.position.z = Math.max(2, Math.min(10, this.camera.position.z + delta));
                }
            });
        }
    }
    
    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        
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
            // 機械手輕微浮動
            this.handModel.position.y = Math.sin(time * 1.2) * 0.03 - 1;
            
            // 機械手微旋轉
            this.handModel.rotation.y += Math.sin(time * 0.3) * 0.001;
        }
        
        this.renderer?.render(this.scene!, this.camera!);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
    }
}

export default Hand3D;