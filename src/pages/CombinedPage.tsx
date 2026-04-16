import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '../components/Scene';
import { Axes3D } from '../components/Axes3D';
import { GridPlanes } from '../components/GridPlanes';
import { CombinedAnimator } from '../components/combined/CombinedAnimator';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

export function CombinedPage() {
  const transitionRef = useRef(0);
  const [derivedPhase, setDerivedPhase] = useState<Phase>('draw-smooth');

  return (
    <div style={{ width: '100vw', height: '100vh', background: MANIM.BACKGROUND }}>
      <Canvas camera={{ position: [14, 10, 12], fov: 40 }}>
        <color attach="background" args={[MANIM.BACKGROUND]} />
        <Scene phase={derivedPhase} transitionRef={transitionRef} />
        <Axes3D phase={derivedPhase} transitionRef={transitionRef} formulaLatex="" />
        <GridPlanes phase={derivedPhase} transitionRef={transitionRef} />
        <CombinedAnimator transitionRef={transitionRef} onDerivedPhaseChange={setDerivedPhase} />
      </Canvas>
    </div>
  );
}
