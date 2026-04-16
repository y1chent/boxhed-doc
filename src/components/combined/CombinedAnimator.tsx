import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MANIM } from '../../theme/colors';
import { getExampleTrees, LEAF_VALUES, computeRegions, computeMergedBlocks } from '../../utils/treeSplits';
import {
  generateTrajectoryPoints,
  createTrajectoryCurve,
  generatePiecewiseConstant,
  VISUAL_SCALE,
} from '../../utils/trajectory';
import { computeHistogramBars } from '../../utils/histogramLambda';
import { VoxelGrid } from '../tree-boosting/VoxelGrid';
import { Trajectory } from '../Trajectory';
import { HistogramBars } from './HistogramBars';
import type { Phase, TreeBoostPhase, TreeRoundSubPhase, CombinedStage } from '../../types';

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

const HOLD_VOXELS_DURATION = 1.5;
const FADE_VOXELS_DURATION = 1.5;
const SHOW_VOXELS_AGAIN_DURATION = 1.5;
const HOLD_COMBINED_DURATION = 1.5;
const HISTOGRAM_TRANSITION_DURATION = 2.5;

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

// ── Ref factory ─────────────────────────────────────
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
interface CombinedAnimatorProps {
  transitionRef: React.RefObject<number>;
  onDerivedPhaseChange: (phase: Phase) => void;
}

export function CombinedAnimator({ transitionRef, onDerivedPhaseChange }: CombinedAnimatorProps) {
  // ── Combined stage state ──
  const stageRef = useRef<CombinedStage>('tree-boost');
  const treePhaseRef = useRef<TreeBoostPhase>({ kind: 'idle' });
  const elapsedRef = useRef(0);
  const phaseStartRef = useRef(0);

  // ── Tree-boost refs ──
  const tree0Refs = useTreeRoundRefs();
  const tree1Refs = useTreeRoundRefs();
  const tree2Refs = useTreeRoundRefs();
  const treeRefs: TreeRoundRefs[] = [tree0Refs, tree1Refs, tree2Refs];
  const voxelGroupRef = useRef<THREE.Group>(null);

  // ── Trajectory refs ──
  const trajectoryGroupRef = useRef<THREE.Group>(null);
  const [trajPhase, setTrajPhase] = useState<Phase>('done');

  // ── Histogram refs ──
  const histogramGroupRef = useRef<THREE.Group>(null);

  // Track derived phase to avoid re-renders
  const derivedPhaseRef = useRef<Phase>('draw-smooth');
  const updateDerivedPhase = useCallback((p: Phase) => {
    if (derivedPhaseRef.current !== p) {
      derivedPhaseRef.current = p;
      onDerivedPhaseChange(p);
    }
  }, [onDerivedPhaseChange]);

  // ── Tree-boost data ──
  const trees = useMemo(() => getExampleTrees(), []);
  const allRegions = useMemo(
    () => trees.map((t, i) => computeRegions(t, LEAF_VALUES[i])),
    [trees],
  );
  const mergedBlocks = useMemo(
    () => computeMergedBlocks(trees, allRegions),
    [trees, allRegions],
  );
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

  // ── Trajectory data ──
  const pwPoints = useMemo(() => {
    const rawWaypoints = generateTrajectoryPoints();
    const { curve } = createTrajectoryCurve(rawWaypoints);
    return generatePiecewiseConstant(curve);
  }, []);

  // ── Histogram data ──
  const { bars, barScale } = useMemo(() => {
    const { bars: b, maxAbsValue } = computeHistogramBars(mergedBlocks, pwPoints, VISUAL_SCALE);
    const scale = maxAbsValue > 0 ? (VISUAL_SCALE / maxAbsValue) * 0.85 : 1;
    return { bars: b, barScale: scale };
  }, [mergedBlocks, pwPoints]);

  // ── Phase advance helpers ──
  function advanceTreePhase(nextPhase: TreeBoostPhase) {
    phaseStartRef.current = elapsedRef.current;
    treePhaseRef.current = nextPhase;
  }

  function advanceTreeSubPhase(treeIndex: number, subPhase: TreeRoundSubPhase) {
    advanceTreePhase({ kind: 'tree-round', treeIndex, subPhase });
  }

  function advanceStage(stage: CombinedStage) {
    phaseStartRef.current = elapsedRef.current;
    stageRef.current = stage;
  }

  // ── Trajectory phase intercept ──
  const handleTrajSetPhase = useCallback((p: Phase) => {
    if (p === 'camera-transition' && stageRef.current === 'trajectory') {
      // Intercept: don't enter camera-transition, advance to show-voxels-again
      phaseStartRef.current = elapsedRef.current;
      stageRef.current = 'show-voxels-again';
      return;
    }
    setTrajPhase(p);
  }, []);

  // Ensure derived phase is set on mount
  useEffect(() => {
    updateDerivedPhase('draw-smooth');
  }, [updateDerivedPhase]);

  // ── Animation loop ──
  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const stage = stageRef.current;
    const t = elapsedRef.current - phaseStartRef.current;

    // ═══════════════════════════════════════════════
    // Stage: tree-boost (replicated from TreeBoostAnimator)
    // ═══════════════════════════════════════════════
    if (stage === 'tree-boost') {
      const phase = treePhaseRef.current;

      if (phase.kind === 'idle') {
        if (elapsedRef.current >= IDLE_DELAY) {
          advanceTreeSubPhase(0, 'split-root');
        }
        return;
      }

      if (phase.kind === 'pause-between-trees') {
        if (t >= PAUSE_BETWEEN_TREES) {
          advanceTreeSubPhase(phase.afterTree + 1, 'split-root');
        }
        return;
      }

      if (phase.kind === 'show-voxels') {
        const progress = Math.min(1, t / SHOW_VOXELS_DURATION);
        const opacity = easeInOutCubic(progress) * 0.6;
        setGroupOpacity(voxelGroupRef.current, opacity);
        if (progress >= 1) {
          // Instead of 'done', advance to hold-voxels
          advanceStage('hold-voxels');
        }
        return;
      }

      if (phase.kind === 'done') return;

      // tree-round sub-phases
      const { treeIndex, subPhase } = phase;
      const refs = treeRefs[treeIndex];

      if (subPhase === 'split-root') {
        const progress = Math.min(1, t / SPLIT_ROOT_DURATION);
        setGroupOpacity(refs.rootPlane.current, easeInOutCubic(progress) * 0.4);
        if (progress >= 1) advanceTreeSubPhase(treeIndex, 'pause-after-root');
      } else if (subPhase === 'pause-after-root') {
        if (t >= PAUSE_AFTER_ROOT) advanceTreeSubPhase(treeIndex, 'split-children');
      } else if (subPhase === 'split-children') {
        const progress = Math.min(1, t / SPLIT_CHILDREN_DURATION);
        const opacity = easeInOutCubic(progress) * 0.4;
        setGroupOpacity(refs.leftPlane.current, opacity);
        setGroupOpacity(refs.rightPlane.current, opacity);
        if (progress >= 1) advanceTreeSubPhase(treeIndex, 'pause-after-children');
      } else if (subPhase === 'pause-after-children') {
        if (t >= PAUSE_AFTER_CHILDREN) advanceTreeSubPhase(treeIndex, 'show-regions');
      } else if (subPhase === 'show-regions') {
        const progress = Math.min(1, t / SHOW_REGIONS_DURATION);
        const opacity = easeInOutCubic(progress) * 0.2;
        refs.regions.forEach((ref) => setGroupOpacity(ref.current, opacity));
        if (progress >= 1) advanceTreeSubPhase(treeIndex, 'pause-regions');
      } else if (subPhase === 'pause-regions') {
        if (t >= PAUSE_REGIONS_DURATION) advanceTreeSubPhase(treeIndex, 'fade-regions');
      } else if (subPhase === 'fade-regions') {
        const progress = Math.min(1, t / FADE_REGIONS_DURATION);
        const opacity = 0.2 * (1 - easeInOutCubic(progress));
        refs.regions.forEach((ref) => setGroupOpacity(ref.current, opacity));
        if (progress >= 1) advanceTreeSubPhase(treeIndex, 'fade-planes');
      } else if (subPhase === 'fade-planes') {
        const progress = Math.min(1, t / FADE_PLANES_DURATION);
        const opacity = 0.4 * (1 - easeInOutCubic(progress));
        setGroupOpacity(refs.rootPlane.current, opacity);
        setGroupOpacity(refs.leftPlane.current, opacity);
        setGroupOpacity(refs.rightPlane.current, opacity);
        if (progress >= 1) {
          if (treeIndex < NUM_TREES - 1) {
            advanceTreePhase({ kind: 'pause-between-trees', afterTree: treeIndex });
          } else {
            advanceTreePhase({ kind: 'show-voxels' });
          }
        }
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: hold-voxels
    // ═══════════════════════════════════════════════
    if (stage === 'hold-voxels') {
      if (t >= HOLD_VOXELS_DURATION) {
        advanceStage('fade-voxels');
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: fade-voxels
    // ═══════════════════════════════════════════════
    if (stage === 'fade-voxels') {
      const progress = Math.min(1, t / FADE_VOXELS_DURATION);
      const opacity = 0.6 * (1 - easeInOutCubic(progress));
      setGroupOpacity(voxelGroupRef.current, opacity);
      if (progress >= 1) {
        setTrajPhase('draw-smooth');
        advanceStage('trajectory');
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: trajectory (Trajectory component drives itself)
    // ═══════════════════════════════════════════════
    if (stage === 'trajectory') {
      // Passive — Trajectory's useFrame handles animation.
      // handleTrajSetPhase intercepts camera-transition.
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: show-voxels-again
    // ═══════════════════════════════════════════════
    if (stage === 'show-voxels-again') {
      const progress = Math.min(1, t / SHOW_VOXELS_AGAIN_DURATION);
      const opacity = easeInOutCubic(progress) * 0.15;
      setGroupOpacity(voxelGroupRef.current, opacity);
      if (progress >= 1) {
        advanceStage('hold-combined');
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: hold-combined
    // ═══════════════════════════════════════════════
    if (stage === 'hold-combined') {
      if (t >= HOLD_COMBINED_DURATION) {
        updateDerivedPhase('camera-transition');
        advanceStage('histogram-transition');
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // Stage: histogram-transition
    // ═══════════════════════════════════════════════
    if (stage === 'histogram-transition') {
      const progress = Math.min(1, t / HISTOGRAM_TRANSITION_DURATION);
      const eased = easeInOutCubic(progress);

      // Write progress for Scene/Axes3D/GridPlanes
      (transitionRef as React.MutableRefObject<number>).current = eased;

      // Fade trajectory group out
      setGroupOpacity(trajectoryGroupRef.current, 1 - eased);

      // Fade voxel blocks out
      setGroupOpacity(voxelGroupRef.current, 0.15 * (1 - eased));

      // Fade histogram bars in
      setGroupOpacity(histogramGroupRef.current, eased);

      if (progress >= 1) {
        updateDerivedPhase('done');
        advanceStage('done');
      }
      return;
    }

    // done — nothing to do
  });

  return (
    <group>
      {/* Tree-boost visuals */}
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

      {/* Trajectory wrapped for opacity control */}
      <group ref={trajectoryGroupRef}>
        <Trajectory phase={trajPhase} setPhase={handleTrajSetPhase} transitionRef={transitionRef} />
      </group>

      {/* Histogram bars */}
      <HistogramBars bars={bars} barScale={barScale} groupRef={histogramGroupRef} />
    </group>
  );
}
