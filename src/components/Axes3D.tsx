import { useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MANIM } from '../theme/colors';
import { AxisLabel } from './AxisLabel';
import type { Phase } from '../types';

const AXIS_LENGTH = 7;
const TICK_SIZE = 0.1;
const TICK_COUNT = 6;

function AxisLine({
  start,
  end,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}) {
  return <Line points={[start, end]} color={color} lineWidth={1.5} />;
}

function Arrowhead({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[0.06, 0.25, 12]} />
      <meshBasicMaterial color={MANIM.GREY_B} />
    </mesh>
  );
}

function Ticks({
  axis,
}: {
  axis: 'x' | 'y' | 'z';
}) {
  const ticks = [];
  for (let i = 1; i <= TICK_COUNT; i++) {
    const val = (i / TICK_COUNT) * AXIS_LENGTH;
    let start: [number, number, number];
    let end: [number, number, number];

    if (axis === 'x') {
      start = [val, -TICK_SIZE, 0];
      end = [val, TICK_SIZE, 0];
    } else if (axis === 'y') {
      start = [0, val, -TICK_SIZE];
      end = [0, val, TICK_SIZE];
    } else {
      start = [-TICK_SIZE, 0, val];
      end = [TICK_SIZE, 0, val];
    }

    ticks.push(
      <Line
        key={`${axis}-${i}`}
        points={[start, end]}
        color={MANIM.GREY_C}
        lineWidth={1}
      />,
    );
  }
  return <>{ticks}</>;
}

interface Axes3DProps {
  phase: Phase;
  transitionRef: React.RefObject<number>;
  formulaLatex?: string;
}

export function Axes3D({ phase, transitionRef, formulaLatex }: Axes3DProps) {
  const zGroupRef = useRef<THREE.Group>(null);
  const yTicksRef = useRef<THREE.Group>(null);

  const is2D = phase === 'done';
  const isTransitioning = phase === 'camera-transition';

  let x1Opacity = 1;
  let lambdaOpacity = 0;
  let zOpacity = 1;

  if (isTransitioning) {
    const t = transitionRef.current ?? 0;
    x1Opacity = 1 - t;
    lambdaOpacity = t;
    zOpacity = 1 - t;
  } else if (is2D) {
    x1Opacity = 0;
    lambdaOpacity = 1;
    zOpacity = 0;
  }

  // Animate Z-axis and Y-axis ticks fade
  useFrame(() => {
    const fadeGroups = [zGroupRef.current, yTicksRef.current];
    if (isTransitioning) {
      const t = transitionRef.current ?? 0;
      fadeGroups.forEach(group => {
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
      fadeGroups.forEach(group => {
        if (group && group.visible) group.visible = false;
      });
    }
  });

  return (
    <group>
      {/* X axis — time (t) */}
      <AxisLine start={[0, 0, 0]} end={[AXIS_LENGTH, 0, 0]} color={MANIM.GREY_B} />
      <Arrowhead position={[AXIS_LENGTH, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
      <AxisLabel position={[AXIS_LENGTH + 0.5, 0, 0]} latex="t" />
      <Ticks axis="x" />

      {/* Y axis — X₁ / λ(t) — line and arrowhead stay, ticks and label morph */}
      <AxisLine start={[0, 0, 0]} end={[0, AXIS_LENGTH, 0]} color={MANIM.GREY_B} />
      <Arrowhead position={[0, AXIS_LENGTH, 0]} rotation={[0, 0, 0]} />
      <AxisLabel position={[0, AXIS_LENGTH + 0.5, 0]} latex="X_1" opacity={x1Opacity} />
      <AxisLabel position={[0, AXIS_LENGTH + 0.5, 0]} latex="\lambda(t)" opacity={lambdaOpacity} />
      {formulaLatex !== undefined ? (
        formulaLatex ? <AxisLabel position={[AXIS_LENGTH / 2, -1.2, 0]} latex={formulaLatex} fontSize={12} opacity={lambdaOpacity} /> : null
      ) : (
        <AxisLabel position={[AXIS_LENGTH / 2, -1.2, 0]} latex="\lambda(t,x_1,x_2)=B(t,2,2)\,B(x_1,2,2)\,B(x_2,2,2)" fontSize={12} opacity={lambdaOpacity} />
      )}
      {/* Y-axis ticks fade during transition (X₁ scale no longer applies) */}
      <group ref={yTicksRef}>
        <Ticks axis="y" />
      </group>

      {/* Z axis — X₂ (fades during transition) */}
      <group ref={zGroupRef}>
        <AxisLine start={[0, 0, 0]} end={[0, 0, AXIS_LENGTH]} color={MANIM.GREY_B} />
        <Arrowhead position={[0, 0, AXIS_LENGTH]} rotation={[Math.PI / 2, 0, 0]} />
        <AxisLabel position={[0, 0, AXIS_LENGTH + 0.5]} latex="X_2" opacity={zOpacity} />
        <Ticks axis="z" />
      </group>
    </group>
  );
}
