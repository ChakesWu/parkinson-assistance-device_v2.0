"use client";
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeToContainer = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const initIfNeeded = () => {
      if (initializedRef.current) {
        resizeToContainer();
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // 初始化场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);
      sceneRef.current = scene;

      // 初始化相机（先用安全的默認比例，隨後由 ResizeObserver 校正）
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      camera.position.set(0, 2, 8);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // 初始化渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 初始尺寸設置
      resizeToContainer();

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

      // 標記初始化完成，並在卸載時清理
      initializedRef.current = true;
      cleanupRef.current = () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        if (rendererRef.current) {
          rendererRef.current.dispose();
          if (containerRef.current && rendererRef.current.domElement.parentElement === containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
          }
        }
        if (cleanupEventListeners) {
          cleanupEventListeners();
        }
      };
    };

    const cleanupRef = { current: undefined as undefined | (() => void) };

    // 使用 ResizeObserver 以便容器尺寸變化（例如側邊欄開合）時也能正確調整
    const ro = new ResizeObserver(() => {
      initIfNeeded();
      resizeToContainer();
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    // 若初次渲染已具有尺寸，嘗試立即初始化
    initIfNeeded();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('🎮 SimpleHand3D received sensorData:', sensorData);
    if (sensorData && handGroupRef.current) {
      console.log('✅ Updating 3D hand model with data:', {
        fingers: sensorData.fingers,
        rotation: sensorData.rotation
      });

      // 更新手指弯曲
      sensorData.fingers.forEach((value, index) => {
        if (index < 5 && fingerGroupsRef.current[index]) {
          console.log(`👆 Updating finger ${index} to value ${value}`);
          updateFingerBending(index, value);
        }
      });

      // 更新手部旋转
      console.log('🔄 Updating hand rotation:', sensorData.rotation);
      updateHandRotation(sensorData.rotation);
    } else {
      console.log('❌ Cannot update 3D hand:', {
        hasSensorData: !!sensorData,
        hasHandGroup: !!handGroupRef.current
      });
    }
  }, [sensorData]);

  const createLights = (scene: THREE.Scene) => {
    // 柔和環境光
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1a1a, 0.6);
    scene.add(hemi);

    // 主光源
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(6, 8, 6);
    key.castShadow = true;
    scene.add(key);

    // 冷色輔光
    const cool = new THREE.DirectionalLight(0x4a90e2, 0.7);
    cool.position.set(-6, 3, 4);
    scene.add(cool);

    // 背光輪廓
    const rim = new THREE.DirectionalLight(0xffa366, 0.4);
    rim.position.set(-2, 2, -6);
    scene.add(rim);
  };

  interface FingerConfig {
    name: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
    position: [number, number, number];
    scale: number;
    baseRotation?: [number, number, number]; // x, y, z in radians
  }

  const createSimpleHandModel = (handGroup: THREE.Group) => {
    // 创建手掌
    const palmGeometry = new THREE.BoxGeometry(3.2, 0.8, 4.2);
    const palmMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6b7280,
      metalness: 0.9,
      roughness: 0.25,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3
    });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.set(0, 0, 0);
    palm.castShadow = true;
    palm.receiveShadow = true;
    handGroup.add(palm);

    // 掌邊線條（機械風格輪廓）
    const palmEdges = new THREE.EdgesGeometry(palmGeometry);
    const palmLine = new THREE.LineSegments(
      palmEdges,
      new THREE.LineBasicMaterial({ color: 0x2c3540, linewidth: 1 })
    );
    palm.add(palmLine);

    // 手腕基座
    const wristGeom = new THREE.CylinderGeometry(1.2, 1.2, 1.0, 24);
    const wristMat = new THREE.MeshPhysicalMaterial({
      color: 0x4b5563,
      metalness: 0.85,
      roughness: 0.3
    });
    const wrist = new THREE.Mesh(wristGeom, wristMat);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, 0, -2.6);
    wrist.castShadow = true;
    handGroup.add(wrist);

    // 创建5根手指
    const fingerConfigs: FingerConfig[] = [
      // baseRotation: [x, y, z]
      { name: 'thumb',  position: [-1.7, 0.35, 1.2], scale: 0.9,  baseRotation: [0,  Math.PI / 10, -Math.PI / 6] },
      { name: 'index',  position: [-0.9, 0.4,  2.2], scale: 1.0,  baseRotation: [0,  THREE.MathUtils.degToRad(2),  THREE.MathUtils.degToRad(-8)] },
      { name: 'middle', position: [0,    0.4,  2.3], scale: 1.1,  baseRotation: [0,  0,                                     0] },
      { name: 'ring',   position: [0.9,  0.4,  2.2], scale: 0.97, baseRotation: [0,  THREE.MathUtils.degToRad(-2), THREE.MathUtils.degToRad(6)] },
      { name: 'pinky',  position: [1.7,  0.4,  1.9], scale: 0.82, baseRotation: [0,  THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(12)] }
    ];

    fingerGroupsRef.current = [];
    fingerConfigs.forEach((config, index) => {
      const fingerGroup = createFinger(config, index);
      fingerGroup.position.set(config.position[0], config.position[1], config.position[2]);
      fingerGroup.scale.setScalar(config.scale);
      // 基座方向（手掌與手指之間的平行/傾斜角）
      if (config.baseRotation) {
        fingerGroup.rotation.set(config.baseRotation[0], config.baseRotation[1], config.baseRotation[2]);
      }
      fingerGroupsRef.current.push(fingerGroup);
      handGroup.add(fingerGroup);
    });
  };

  const createFinger = (config: FingerConfig, fingerIndex: number) => {
    const fingerGroup = new THREE.Group();
    // MCP、PIP、DIP 關節尺寸
    const jointSizes = [
      { length: 1.0, radius: 0.16 }, // MCP -> 近端指骨
      { length: 0.85, radius: 0.13 }, // PIP -> 中節
      { length: 0.65, radius: 0.11 } // DIP -> 末節
    ];

    let currentY = 0;
    let parent: THREE.Group = fingerGroup;

    jointSizes.forEach((joint, jointIndex) => {
      // 關節樞軸（層級鏈接，實現連動）
      const jointPivot = new THREE.Group();
      jointPivot.position.y = currentY;
      parent.add(jointPivot);

      // 指節網格
      const jointGeometry = new THREE.CylinderGeometry(
        joint.radius, joint.radius * 0.92, joint.length, 16
      );
      const jointMaterial = new THREE.MeshPhysicalMaterial({
        color: jointIndex === 0 ? 0x6b7280 : 0x4b5563,
        metalness: 0.9,
        roughness: 0.25,
        emissive: 0x0a0f14,
        emissiveIntensity: 0.15
      });
      const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
      jointMesh.position.y = joint.length / 2;
      jointMesh.castShadow = true;
      jointMesh.receiveShadow = true;
      jointPivot.add(jointMesh);

      // 邊線，增強機械感
      const edges = new THREE.EdgesGeometry(jointGeometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x1f2933 })
      );
      jointMesh.add(line);

      // 關節裝飾環（發光）
      const ring = new THREE.TorusGeometry(joint.radius * 0.95, 0.03, 8, 32);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, emissive: 0x1a9fff, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 });
      const ringMesh = new THREE.Mesh(ring, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.02;
      jointPivot.add(ringMesh);

      // 下一層父節點為當前樞軸
      parent = jointPivot;
      currentY += joint.length;
    });

    return fingerGroup;
  };

  const updateFingerBending = (fingerIndex: number, value: number) => {
    if (fingerIndex < 0 || fingerIndex >= 5) return;
    const finger = fingerGroupsRef.current[fingerIndex];
    if (!finger) return;

    // 正規化與非線性映射（較符合人體彎曲）
    const t = THREE.MathUtils.clamp(value / 1023, 0, 1);
    const eased = t * t * (3 - 2 * t); // smoothstep

    // 角度上限（弧度）
    const isThumb = fingerIndex === 0;
    const maxMCP = isThumb ? THREE.MathUtils.degToRad(50) : THREE.MathUtils.degToRad(70);
    const maxPIP = isThumb ? THREE.MathUtils.degToRad(60) : THREE.MathUtils.degToRad(100);
    const maxDIP = isThumb ? THREE.MathUtils.degToRad(45) : THREE.MathUtils.degToRad(65);

    const mcpAngle = eased * maxMCP;
    const pipAngle = eased * maxPIP;
    const dipAngle = (eased * maxDIP);

    // finger 結構：層級關節 [MCP, PIP, DIP]
    if (finger.children && finger.children.length >= 1) {
      const mcpPivot = finger.children[0] as THREE.Group;
      mcpPivot.rotation.x = -mcpAngle;

      if (mcpPivot.children && mcpPivot.children.length >= 1) {
        const pipPivot = mcpPivot.children.find(c => c.type === 'Group') as THREE.Group | undefined;
        if (pipPivot) {
          pipPivot.rotation.x = -pipAngle;

          const dipPivot = (pipPivot.children || []).find(c => c.type === 'Group') as THREE.Group | undefined;
          if (dipPivot) {
            dipPivot.rotation.x = -dipAngle;
          }
        }
      }
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

  return <div ref={containerRef} className="w-full h-full min-h-[300px]" />;
}