export type Phase =
  | 'draw-smooth'
  | 'pause'
  | 'draw-piecewise'
  | 'fade-smooth'
  | 'camera-transition'
  | 'done';

export type SplitAxis = 'x' | 'y' | 'z';

export interface TreeSplit {
  axis: SplitAxis;
  position: number; // integer 1-6
}

export interface DepthTwoTree {
  root: TreeSplit;
  left: TreeSplit;  // region where coord < root.position
  right: TreeSplit; // region where coord >= root.position
}

export interface Region {
  min: [number, number, number];
  max: [number, number, number];
  color: string;
  value: number;
}

export type TreeRoundSubPhase =
  | 'split-root'
  | 'pause-after-root'
  | 'split-children'
  | 'pause-after-children'
  | 'show-regions'
  | 'pause-regions'
  | 'fade-regions'
  | 'fade-planes';

export type TreeBoostPhase =
  | { kind: 'idle' }
  | { kind: 'tree-round'; treeIndex: number; subPhase: TreeRoundSubPhase }
  | { kind: 'pause-between-trees'; afterTree: number }
  | { kind: 'show-voxels' }
  | { kind: 'done' };

export type CombinedStage =
  | 'tree-boost'
  | 'hold-voxels'
  | 'fade-voxels'
  | 'trajectory'
  | 'show-voxels-again'
  | 'hold-combined'
  | 'histogram-transition'
  | 'done';
