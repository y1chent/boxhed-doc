import * as THREE from 'three';
import { MANIM } from '../theme/colors';
import type { DepthTwoTree, Region, SplitAxis } from '../types';

const SPACE_SIZE = 7;

const axisIndex: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };

export function computeRegions(
  tree: DepthTwoTree,
  leafValues: [number, number, number, number] = [0, 0, 0, 0],
): Region[] {
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [SPACE_SIZE, SPACE_SIZE, SPACE_SIZE];

  const ri = axisIndex[tree.root.axis];

  const leftMin: [number, number, number] = [...min];
  const leftMax: [number, number, number] = [...max];
  leftMax[ri] = tree.root.position;

  const rightMin: [number, number, number] = [...min];
  const rightMax: [number, number, number] = [...max];
  rightMin[ri] = tree.root.position;

  const li = axisIndex[tree.left.axis];
  const llMin: [number, number, number] = [...leftMin];
  const llMax: [number, number, number] = [...leftMax];
  llMax[li] = tree.left.position;

  const lrMin: [number, number, number] = [...leftMin];
  const lrMax: [number, number, number] = [...leftMax];
  lrMin[li] = tree.left.position;

  const rri = axisIndex[tree.right.axis];
  const rlMin: [number, number, number] = [...rightMin];
  const rlMax: [number, number, number] = [...rightMax];
  rlMax[rri] = tree.right.position;

  const rrMin: [number, number, number] = [...rightMin];
  const rrMax: [number, number, number] = [...rightMax];
  rrMin[rri] = tree.right.position;

  return [
    { min: llMin, max: llMax, color: MANIM.BLUE_C, value: leafValues[0] },
    { min: lrMin, max: lrMax, color: MANIM.GREEN_C, value: leafValues[1] },
    { min: rlMin, max: rlMax, color: MANIM.YELLOW_C, value: leafValues[2] },
    { min: rrMin, max: rrMax, color: MANIM.RED_C, value: leafValues[3] },
  ];
}

export function getExampleTree(): DepthTwoTree {
  return {
    root: { axis: 'x', position: 3 },
    left: { axis: 'y', position: 4 },
    right: { axis: 'z', position: 5 },
  };
}

export const LEAF_VALUES: [number, number, number, number][] = [
  [0.3, -0.2, 0.5, -0.1],
  [-0.1, 0.4, -0.3, 0.2],
  [0.2, -0.1, 0.1, -0.4],
];

export function getExampleTrees(): DepthTwoTree[] {
  return [
    { root: { axis: 'x', position: 3 }, left: { axis: 'y', position: 4 }, right: { axis: 'z', position: 5 } },
    { root: { axis: 'y', position: 4 }, left: { axis: 'z', position: 2 }, right: { axis: 'x', position: 5 } },
    { root: { axis: 'z', position: 3 }, left: { axis: 'x', position: 4 }, right: { axis: 'y', position: 2 } },
  ];
}

const _blueColor = new THREE.Color(MANIM.BLUE_C);
const _whiteColor = new THREE.Color(MANIM.WHITE);
const _redColor = new THREE.Color(MANIM.RED_C);

export function valueToColor(value: number, target: THREE.Color): THREE.Color {
  const maxAbs = 0.8;
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  if (t < 0) {
    target.copy(_blueColor).lerp(_whiteColor, 1 + t);
  } else {
    target.copy(_whiteColor).lerp(_redColor, t);
  }
  return target;
}

export interface MergedBlock {
  min: [number, number, number];
  max: [number, number, number];
  value: number;
}

export function computeMergedBlocks(
  trees: DepthTwoTree[],
  allRegions: Region[][],
): MergedBlock[] {
  // Collect all unique split points per axis across all trees
  const cuts: [Set<number>, Set<number>, Set<number>] = [new Set(), new Set(), new Set()];
  for (const tree of trees) {
    cuts[axisIndex[tree.root.axis]].add(tree.root.position);
    cuts[axisIndex[tree.left.axis]].add(tree.left.position);
    cuts[axisIndex[tree.right.axis]].add(tree.right.position);
  }
  // Build sorted boundary arrays (0, ...cuts, 7) per axis
  const bounds = cuts.map((s) => [0, ...Array.from(s).sort((a, b) => a - b), SPACE_SIZE]);

  const blocks: MergedBlock[] = [];
  for (let xi = 0; xi < bounds[0].length - 1; xi++) {
    for (let yi = 0; yi < bounds[1].length - 1; yi++) {
      for (let zi = 0; zi < bounds[2].length - 1; zi++) {
        const bMin: [number, number, number] = [bounds[0][xi], bounds[1][yi], bounds[2][zi]];
        const bMax: [number, number, number] = [bounds[0][xi + 1], bounds[1][yi + 1], bounds[2][zi + 1]];
        // Sample the center to accumulate leaf values
        const cx = (bMin[0] + bMax[0]) / 2;
        const cy = (bMin[1] + bMax[1]) / 2;
        const cz = (bMin[2] + bMax[2]) / 2;
        let value = 0;
        for (let t = 0; t < trees.length; t++) {
          for (const region of allRegions[t]) {
            if (
              cx >= region.min[0] && cx < region.max[0] &&
              cy >= region.min[1] && cy < region.max[1] &&
              cz >= region.min[2] && cz < region.max[2]
            ) {
              value += region.value;
              break;
            }
          }
        }
        blocks.push({ min: bMin, max: bMax, value });
      }
    }
  }
  return blocks;
}
