import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SensorData {
  fingers: number[];
  rotation: { x: number; y: number; z: number };
}

export default function SimpleHand3D({ sensorData }: { sensorData: SensorData | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const handGroupRef = useRef<THREE.Group | null>(null);
  const fingerGroupsRef = useRef<THREE.Group[]>([]);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // 初始化相机
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 创建灯光
    createLights(scene);

    // 创建手部模型
    const handGroup = new THREE.Group();
    scene.add(handGroup);
    handGroupRef.current = handGroup;
    createSimpleHandModel(handGroup);

    // 添加事件监听并保存清理函数
    const cleanupEventListeners = addEventListeners(renderer.domElement, handGroup, camera);

    // 开始动画循环
    animate();

    // 清理函数
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      if (cleanupEventListeners) {
        cleanupEventListeners();
      }
    };
  }, []);

  useEffect(() => {
    if (sensorData && handGroupRef.current) {
      // 更新手指弯曲
      sensorData.fingers.forEach((value, index) => {
        if (index < 5 && fingerGroupsRef.current[index]) {
          updateFingerBending(index, value);
        }
      });

      // 更新手部旋转
      updateHandRotation(sensorData.rotation);
    }
  }, [sensorData]);

  const createLights = (scene: THREE.Scene) => {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x808080, 0.8);
    scene.add(ambientLight);
    
    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // 蓝色科技光
    const blueLight = new THREE.DirectionalLight(0x4a90e2, 0.6);
    blueLight.position.set(-5, 3, 3);
    scene.add(blueLight);
    
    // 橙色暖光
    const orangeLight = new THREE.DirectionalLight(0xff8c42, 0.4);
    orangeLight.position.set(3, -2, 5);
    scene.add(orangeLight);
    
    // 顶部补光
    const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    
    // 前补光
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
    frontLight.position.set(0, 0, 10);
    scene.add(frontLight);
  };

  interface FingerConfig {
    name: string;
    position: [number, number, number];
    scale: number;
    joints: number;
  }

  const createSimpleHandModel = (handGroup: THREE.Group) => {
    // 创建手掌
    const palmGeometry = new THREE.BoxGeometry(3, 0.8, 4);
    const palmMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6b7280,
      metalness: 0.7,
      roughness: 0.3
    });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.set(0, 0, 0);
    palm.castShadow = true;
    palm.receiveShadow = true;
    handGroup.add(palm);

    // 创建5根手指
    const fingerConfigs: FingerConfig[] = [
      { name: 'thumb', position: [-1.8, 0.4, 1.2], scale: 0.8, joints: 3 },
      { name: 'index', position: [-0.9, 0.4, 2.2], scale: 1.0, joints: 3 },
      { name: 'middle', position: [0, 0.4, 2.3], scale: 1.1, joints: 3 },
      { name: 'ring', position: [0.9, 0.4, 2.2], scale: 0.95, joints: 3 },
      { name: 'pinky', position: [1.7, 0.4, 1.8], scale: 0.75, joints: 3 }
    ];

    fingerGroupsRef.current = [];
    fingerConfigs.forEach((config, index) => {
      const fingerGroup = createFinger(config, index);
      fingerGroup.position.set(config.position[0], config.position[1], config.position[2]);
      fingerGroup.scale.setScalar(config.scale);
      fingerGroupsRef.current.push(fingerGroup);
      handGroup.add(fingerGroup);
    });
  };

  const createFinger = (config: any, fingerIndex: number) => {
    const fingerGroup = new THREE.Group();
    
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
        color: jointIndex === 0 ? 0x6b7280 : 0x4b5563,
        metalness: 0.7,
        roughness: 0.3
      });
      
      const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
      jointMesh.position.y = joint.length / 2;
      jointMesh.castShadow = true;
      
      // 关节组（用于旋转）
      const jointPivot = new THREE.Group();
      jointPivot.position.y = currentY;
      jointPivot.add(jointMesh);
      
      fingerGroup.add(jointPivot);
      currentY += joint.length;
    });
    
    return fingerGroup;
  };

  const updateFingerBending = (fingerIndex: number, value: number) => {
    if (fingerIndex < 0 || fingerIndex >= 5) return;
    const finger = fingerGroupsRef.current[fingerIndex];
    if (!finger) return;
    
    const bendAngle = (value / 1023) * Math.PI / 2;
    
    if (finger.children && finger.children.length > 0) {
      finger.children.forEach((joint, jointIndex) => {
        const jointBend = bendAngle * (jointIndex + 1) / finger.children.length;
        joint.rotation.x = -jointBend;
      });
    }
  };

  const updateHandRotation = (rotation: { x: number; y: number; z: number }) => {
    if (!handGroupRef.current) return;
    
    // 平滑旋转更新
    handGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      handGroupRef.current.rotation.x, rotation.x, 0.1
    );
    handGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      handGroupRef.current.rotation.y, rotation.y, 0.1
    );
    handGroupRef.current.rotation.z = THREE.MathUtils.lerp(
      handGroupRef.current.rotation.z, rotation.z, 0.1
    );
  };

  const addEventListeners = (
    canvas: HTMLCanvasElement,
    handGroup: THREE.Group,
    camera: THREE.PerspectiveCamera
  ) => {
    // 鼠标控制
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    
    const onMouseDown = (event: MouseEvent) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    
    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown || !handGroup) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      handGroup.rotation.y += deltaX * 0.01;
      handGroup.rotation.x += deltaY * 0.01;
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    
    const onMouseUp = () => {
      isMouseDown = false;
    };
    
    const onWheel = (event: WheelEvent) => {
      const delta = event.deltaY * 0.001;
      camera.position.z = Math.max(3, Math.min(15, camera.position.z + delta));
    };
    
    const onResize = () => {
      if (!containerRef.current || !camera || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('resize', onResize);
    
    // 返回清理函数
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);
    
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return <div ref={containerRef} className="w-full h-full" />;
}