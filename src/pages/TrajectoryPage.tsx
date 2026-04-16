import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../components/Scene';
import { Axes3D } from '../components/Axes3D';
import { GridPlanes } from '../components/GridPlanes';
import { Trajectory } from '../components/Trajectory';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

export function TrajectoryPage() {
  const [phase, setPhase] = useState<Phase>('draw-smooth');
  const transitionRef = useRef(0);

  return (
    <div style={{ width: '100vw', height: '100vh', background: MANIM.BACKGROUND }}>
      <Canvas camera={{ position: [14, 10, 12], fov: 40 }}>
        <color attach="background" args={[MANIM.BACKGROUND]} />
        <Scene phase={phase} transitionRef={transitionRef} />
        <Axes3D phase={phase} transitionRef={transitionRef} />
        <GridPlanes phase={phase} transitionRef={transitionRef} />
        <Trajectory phase={phase} setPhase={setPhase} transitionRef={transitionRef} />
      </Canvas>
    </div>
  );
}
