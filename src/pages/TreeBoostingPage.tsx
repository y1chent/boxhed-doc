import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { GridPlanes } from '../components/GridPlanes';
import { Axes3DSimple } from '../components/Axes3DSimple';
import { TreeBoostScene } from '../components/tree-boosting/TreeBoostScene';
import { TreeBoostAnimator } from '../components/tree-boosting/TreeBoostAnimator';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

export function TreeBoostingPage() {
  const transitionRef = useRef(0);
  const staticPhase: Phase = 'draw-smooth';

  return (
    <div style={{ width: '100vw', height: '100vh', background: MANIM.BACKGROUND }}>
      <Canvas camera={{ position: [14, 10, 12], fov: 40 }}>
        <color attach="background" args={[MANIM.BACKGROUND]} />
        <TreeBoostScene />
        <Axes3DSimple />
        <GridPlanes phase={staticPhase} transitionRef={transitionRef} />
        <TreeBoostAnimator />
      </Canvas>
    </div>
  );
}
