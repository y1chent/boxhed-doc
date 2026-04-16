import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

const FINAL_CAM_POS = new THREE.Vector3(3.5, 3.0, 18);
const FINAL_CAM_TARGET = new THREE.Vector3(3.5, 3.0, 0);

interface SceneProps {
  phase: Phase;
  transitionRef: React.RefObject<number>;
}

export function Scene({ phase, transitionRef }: SceneProps) {
  const controlsRef = useRef<any>(null);
  const startPosRef = useRef(new THREE.Vector3());
  const startTargetRef = useRef(new THREE.Vector3());
  const capturedRef = useRef(false);

  const is3D = phase === 'draw-smooth' || phase === 'pause' || phase === 'draw-piecewise' || phase === 'fade-smooth';

  useFrame(({ camera }) => {
    if (phase === 'camera-transition') {
      if (!capturedRef.current) {
        startPosRef.current.copy(camera.position);
        if (controlsRef.current) {
          startTargetRef.current.copy(controlsRef.current.target);
        }
        capturedRef.current = true;
      }

      const t = transitionRef.current ?? 0;
      camera.position.lerpVectors(startPosRef.current, FINAL_CAM_POS, t);

      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTargetRef.current, FINAL_CAM_TARGET, t);
        controlsRef.current.update();
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <fog attach="fog" args={[MANIM.BACKGROUND, 20, 35]} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        autoRotate={is3D}
        autoRotateSpeed={0.2}
        target={[3, 3, 3]}
        enabled={is3D}
      />
    </>
  );
}
