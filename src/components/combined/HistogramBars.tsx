import * as THREE from 'three';
import type { HistogramBar } from '../../utils/histogramLambda';

export function HistogramBars({
  bars,
  barScale,
  groupRef,
}: {
  bars: HistogramBar[];
  barScale: number;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group ref={groupRef as React.Ref<THREE.Group>}>
      {bars.map((bar, i) => {
        const width = bar.tEnd - bar.tStart;
        const height = Math.abs(bar.value) * barScale;
        const depth = 0.15;
        const cx = (bar.tStart + bar.tEnd) / 2;
        const cy = (bar.value * barScale) / 2;
        return (
          <mesh key={i} position={[cx, cy, 0]} visible={false}>
            <boxGeometry args={[width, height || 0.001, depth]} />
            <meshBasicMaterial
              color={bar.color}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
