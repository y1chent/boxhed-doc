import { useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

const SIZE = 7;
const DIVISIONS = 7;

function GridLines({
  plane,
}: {
  plane: 'xz' | 'xy' | 'yz';
}) {
  const lines = [];

  for (let i = 0; i <= DIVISIONS; i++) {
    const val = (i / DIVISIONS) * SIZE;

    if (plane === 'xz') {
      lines.push(
        <Line key={`xz-a-${i}`} points={[[val, 0, 0], [val, 0, SIZE]]} color={MANIM.GREY_E} lineWidth={0.5} />,
        <Line key={`xz-b-${i}`} points={[[0, 0, val], [SIZE, 0, val]]} color={MANIM.GREY_E} lineWidth={0.5} />,
      );
    } else if (plane === 'xy') {
      lines.push(
        <Line key={`xy-a-${i}`} points={[[val, 0, 0], [val, SIZE, 0]]} color={MANIM.GREY_E} lineWidth={0.5} />,
        <Line key={`xy-b-${i}`} points={[[0, val, 0], [SIZE, val, 0]]} color={MANIM.GREY_E} lineWidth={0.5} />,
      );
    } else {
      lines.push(
        <Line key={`yz-a-${i}`} points={[[0, val, 0], [0, val, SIZE]]} color={MANIM.GREY_E} lineWidth={0.5} />,
        <Line key={`yz-b-${i}`} points={[[0, 0, val], [0, SIZE, val]]} color={MANIM.GREY_E} lineWidth={0.5} />,
      );
    }
  }

  return <>{lines}</>;
}

interface GridPlanesProps {
  phase: Phase;
  transitionRef: React.RefObject<number>;
}

export function GridPlanes({ phase, transitionRef }: GridPlanesProps) {
  const xzRef = useRef<THREE.Group>(null);
  const yzRef = useRef<THREE.Group>(null);

  const is2D = phase === 'done';
  const isTransitioning = phase === 'camera-transition';

  useFrame(() => {
    if (isTransitioning) {
      const t = transitionRef.current ?? 0;
      [xzRef.current, yzRef.current].forEach(group => {
        if (!group) return;
        group.traverse((child) => {
          if ((child as any).material) {
            const mat = (child as any).material;
            mat.transparent = true;
            mat.opacity = 1 - t;
          }
        });
      });
    }
    if (is2D) {
      if (xzRef.current && xzRef.current.visible) xzRef.current.visible = false;
      if (yzRef.current && yzRef.current.visible) yzRef.current.visible = false;
    }
  });

  return (
    <group>
      <group ref={xzRef}>
        <GridLines plane="xz" />
      </group>
      <GridLines plane="xy" />
      <group ref={yzRef}>
        <GridLines plane="yz" />
      </group>
    </group>
  );
}
