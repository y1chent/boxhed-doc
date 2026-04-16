import * as THREE from 'three';
import { valueToColor } from '../../utils/treeSplits';
import type { MergedBlock } from '../../utils/treeSplits';

export function VoxelGrid({
  blocks,
  groupRef,
}: {
  blocks: MergedBlock[];
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group ref={groupRef as React.Ref<THREE.Group>}>
      {blocks.map((block, i) => {
        const size: [number, number, number] = [
          block.max[0] - block.min[0],
          block.max[1] - block.min[1],
          block.max[2] - block.min[2],
        ];
        const center: [number, number, number] = [
          (block.min[0] + block.max[0]) / 2,
          (block.min[1] + block.max[1]) / 2,
          (block.min[2] + block.max[2]) / 2,
        ];
        const color = valueToColor(block.value, new THREE.Color());
        return (
          <mesh key={i} position={center} visible={false}>
            <boxGeometry args={size} />
            <meshBasicMaterial
              color={color}
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
