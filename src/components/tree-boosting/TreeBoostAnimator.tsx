import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MANIM } from '../../theme/colors';
import { getExampleTrees, LEAF_VALUES, computeRegions, computeMergedBlocks } from '../../utils/treeSplits';
import { VoxelGrid } from './VoxelGrid';
import type { TreeBoostPhase, TreeRoundSubPhase } from '../../types';

// ── Timing ──────────────────────────────────────────
const IDLE_DELAY = 0.5;
const SPLIT_ROOT_DURATION = 1.5;
const PAUSE_AFTER_ROOT = 0.8;
const SPLIT_CHILDREN_DURATION = 1.5;
const PAUSE_AFTER_CHILDREN = 0.8;
const SHOW_REGIONS_DURATION = 2.0;
const PAUSE_REGIONS_DURATION = 1.0;
const FADE_REGIONS_DURATION = 1.5;
const FADE_PLANES_DURATION = 1.0;
const PAUSE_BETWEEN_TREES = 0.6;
const SHOW_VOXELS_DURATION = 2.5;

const TREE_PLANE_COLORS = [MANIM.BLUE_B, MANIM.GREEN_C, MANIM.YELLOW_C];
const NUM_TREES = 3;

// ── Helpers ─────────────────────────────────────────
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setGroupOpacity(group: THREE.Group | null, opacity: number) {
  if (!group) return;
  group.traverse((child) => {
    child.visible = opacity > 0;
    const mesh = child as THREE.Mesh;
    if (mesh.material) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = opacity;
    }
  });
}

// ── Inline sub-components ───────────────────────────
function SplitPlaneInline({
  axis,
  pos,
  bounds,
  color,
  groupRef,
}: {
  axis: 'x' | 'y' | 'z';
  pos: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  color: string;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const ai = { x: 0, y: 1, z: 2 }[axis];
  const others = [0, 1, 2].filter((i) => i !== ai);
  const a0 = others[0];
  const a1 = others[1];

  const w = bounds.max[a0] - bounds.min[a0];
  const h = bounds.max[a1] - bounds.min[a1];

  const center: [number, number, number] = [0, 0, 0];
  center[ai] = pos;
  center[a0] = (bounds.min[a0] + bounds.max[a0]) / 2;
  center[a1] = (bounds.min[a1] + bounds.max[a1]) / 2;

  let rotation: [number, number, number] = [0, 0, 0];
  if (axis === 'x') rotation = [0, Math.PI / 2, 0];
  else if (axis === 'y') rotation = [-Math.PI / 2, 0, 0];

  return (
    <group ref={groupRef as React.Ref<THREE.Group>} position={center} rotation={rotation}>
      <mesh visible={false}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function RegionBoxInline({
  min,
  max,
  color,
  groupRef,
}: {
  min: [number, number, number];
  max: [number, number, number];
  color: string;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  return (
    <group ref={groupRef as React.Ref<THREE.Group>} position={center}>
      <mesh visible={false}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Ref factory (must be called at top level, not in loop) ──
interface TreeRoundRefs {
  rootPlane: React.RefObject<THREE.Group | null>;
  leftPlane: React.RefObject<THREE.Group | null>;
  rightPlane: React.RefObject<THREE.Group | null>;
  regions: React.RefObject<THREE.Group | null>[];
}

function useTreeRoundRefs(): TreeRoundRefs {
  return {
    rootPlane: useRef<THREE.Group>(null),
    leftPlane: useRef<THREE.Group>(null),
    rightPlane: useRef<THREE.Group>(null),
    regions: [
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
    ],
  };
}

// ── Main component ──────────────────────────────────
export function TreeBoostAnimator() {
  const phaseRef = useRef<TreeBoostPhase>({ kind: 'idle' });
  const elapsedRef = useRef(0);
  const phaseStartRef = useRef(0);

  // eslint-disable-next-line react-hooks/rules-of-hooks -- called unconditionally 3 times
  const tree0Refs = useTreeRoundRefs();
  const tree1Refs = useTreeRoundRefs();
  const tree2Refs = useTreeRoundRefs();
  const treeRefs: TreeRoundRefs[] = [tree0Refs, tree1Refs, tree2Refs];

  const voxelGroupRef = useRef<THREE.Group>(null);

  const trees = useMemo(() => getExampleTrees(), []);
  const allRegions = useMemo(
    () => trees.map((t, i) => computeRegions(t, LEAF_VALUES[i])),
    [trees],
  );
  const mergedBlocks = useMemo(
    () => computeMergedBlocks(trees, allRegions),
    [trees, allRegions],
  );

  // Pre-compute bounds per tree
  const treeBounds = useMemo(() => {
    const full = { min: [0, 0, 0] as [number, number, number], max: [7, 7, 7] as [number, number, number] };
    return trees.map((tree) => {
      const ri = { x: 0, y: 1, z: 2 }[tree.root.axis];
      const left = { min: [0, 0, 0] as [number, number, number], max: [7, 7, 7] as [number, number, number] };
      left.max[ri] = tree.root.position;
      const right = { min: [0, 0, 0] as [number, number, number], max: [7, 7, 7] as [number, number, number] };
      right.min[ri] = tree.root.position;
      return { full, left, right };
    });
  }, [trees]);

  // ── Phase advance helper ──
  function advancePhase(nextPhase: TreeBoostPhase) {
    phaseStartRef.current = elapsedRef.current;
    phaseRef.current = nextPhase;
  }

  function advanceSubPhase(treeIndex: number, subPhase: TreeRoundSubPhase) {
    advancePhase({ kind: 'tree-round', treeIndex, subPhase });
  }

  // ── Animation loop ──
  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const phase = phaseRef.current;
    const t = elapsedRef.current - phaseStartRef.current;

    if (phase.kind === 'idle') {
      if (elapsedRef.current >= IDLE_DELAY) {
        advanceSubPhase(0, 'split-root');
      }
      return;
    }

    if (phase.kind === 'pause-between-trees') {
      if (t >= PAUSE_BETWEEN_TREES) {
        advanceSubPhase(phase.afterTree + 1, 'split-root');
      }
      return;
    }

    if (phase.kind === 'show-voxels') {
      const progress = Math.min(1, t / SHOW_VOXELS_DURATION);
      const opacity = easeInOutCubic(progress) * 0.6;
      setGroupOpacity(voxelGroupRef.current, opacity);
      if (progress >= 1) advancePhase({ kind: 'done' });
      return;
    }

    if (phase.kind === 'done') return;

    // ── tree-round ──
    const { treeIndex, subPhase } = phase;
    const refs = treeRefs[treeIndex];

    if (subPhase === 'split-root') {
      const progress = Math.min(1, t / SPLIT_ROOT_DURATION);
      setGroupOpacity(refs.rootPlane.current, easeInOutCubic(progress) * 0.4);
      if (progress >= 1) advanceSubPhase(treeIndex, 'pause-after-root');
    } else if (subPhase === 'pause-after-root') {
      if (t >= PAUSE_AFTER_ROOT) advanceSubPhase(treeIndex, 'split-children');
    } else if (subPhase === 'split-children') {
      const progress = Math.min(1, t / SPLIT_CHILDREN_DURATION);
      const opacity = easeInOutCubic(progress) * 0.4;
      setGroupOpacity(refs.leftPlane.current, opacity);
      setGroupOpacity(refs.rightPlane.current, opacity);
      if (progress >= 1) advanceSubPhase(treeIndex, 'pause-after-children');
    } else if (subPhase === 'pause-after-children') {
      if (t >= PAUSE_AFTER_CHILDREN) advanceSubPhase(treeIndex, 'show-regions');
    } else if (subPhase === 'show-regions') {
      const progress = Math.min(1, t / SHOW_REGIONS_DURATION);
      const opacity = easeInOutCubic(progress) * 0.2;
      refs.regions.forEach((ref) => setGroupOpacity(ref.current, opacity));
      if (progress >= 1) advanceSubPhase(treeIndex, 'pause-regions');
    } else if (subPhase === 'pause-regions') {
      if (t >= PAUSE_REGIONS_DURATION) advanceSubPhase(treeIndex, 'fade-regions');
    } else if (subPhase === 'fade-regions') {
      const progress = Math.min(1, t / FADE_REGIONS_DURATION);
      const opacity = 0.2 * (1 - easeInOutCubic(progress));
      refs.regions.forEach((ref) => setGroupOpacity(ref.current, opacity));
      if (progress >= 1) advanceSubPhase(treeIndex, 'fade-planes');
    } else if (subPhase === 'fade-planes') {
      const progress = Math.min(1, t / FADE_PLANES_DURATION);
      const opacity = 0.4 * (1 - easeInOutCubic(progress));
      setGroupOpacity(refs.rootPlane.current, opacity);
      setGroupOpacity(refs.leftPlane.current, opacity);
      setGroupOpacity(refs.rightPlane.current, opacity);
      if (progress >= 1) {
        if (treeIndex < NUM_TREES - 1) {
          advancePhase({ kind: 'pause-between-trees', afterTree: treeIndex });
        } else {
          advancePhase({ kind: 'show-voxels' });
        }
      }
    }
  });

  return (
    <group>
      {trees.map((tree, i) => {
        const bounds = treeBounds[i];
        const refs = treeRefs[i];
        const planeColor = TREE_PLANE_COLORS[i];
        const regions = allRegions[i];
        return (
          <group key={i}>
            <SplitPlaneInline groupRef={refs.rootPlane} axis={tree.root.axis} pos={tree.root.position} bounds={bounds.full} color={planeColor} />
            <SplitPlaneInline groupRef={refs.leftPlane} axis={tree.left.axis} pos={tree.left.position} bounds={bounds.left} color={planeColor} />
            <SplitPlaneInline groupRef={refs.rightPlane} axis={tree.right.axis} pos={tree.right.position} bounds={bounds.right} color={planeColor} />
            {regions.map((region, j) => (
              <RegionBoxInline key={j} groupRef={refs.regions[j]} min={region.min} max={region.max} color={region.color} />
            ))}
          </group>
        );
      })}
      <VoxelGrid blocks={mergedBlocks} groupRef={voxelGroupRef} />
    </group>
  );
}
