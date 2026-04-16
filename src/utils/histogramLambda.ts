import { Color, Vector3 } from 'three';
import { MANIM } from '../theme/colors';
import type { MergedBlock } from './treeSplits';

const _blue = new Color(MANIM.BLUE_C);
const _red = new Color(MANIM.RED_C);

export interface HistogramBar {
  tStart: number;
  tEnd: number;
  value: number;
  color: Color;
}

export function computeHistogramBars(
  mergedBlocks: MergedBlock[],
  pwPoints: Vector3[],
  visualScale: number,
): { bars: HistogramBar[]; maxAbsValue: number } {
  const numPieces = pwPoints.length / 2;

  // First pass: collect raw values
  const rawValues: number[] = [];
  const tStarts: number[] = [];
  const tEnds: number[] = [];

  for (let i = 0; i < numPieces; i++) {
    const pStart = pwPoints[2 * i];
    const pEnd = pwPoints[2 * i + 1];

    const cx = ((pStart.x + pEnd.x) / 2) * visualScale;
    const cy = pStart.y * visualScale;
    const cz = pStart.z * visualScale;

    let value = 0;
    for (const block of mergedBlocks) {
      if (
        cx >= block.min[0] && cx < block.max[0] &&
        cy >= block.min[1] && cy < block.max[1] &&
        cz >= block.min[2] && cz < block.max[2]
      ) {
        value = block.value;
        break;
      }
    }

    rawValues.push(value);
    tStarts.push(pStart.x * visualScale);
    tEnds.push(pEnd.x * visualScale);
  }

  // Rescale to 0-1: min -> 0, max -> 1
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const v of rawValues) {
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const range = maxVal - minVal;

  // Second pass: build bars with rescaled values and blue-to-red colors
  const bars: HistogramBar[] = [];
  let maxAbsValue = 0;

  for (let i = 0; i < numPieces; i++) {
    const normalized = range > 0 ? (rawValues[i] - minVal) / range : 0.5;
    // Use normalized as the bar height (0-1 scale)
    const value = normalized;

    if (Math.abs(value) > maxAbsValue) maxAbsValue = Math.abs(value);

    // Blue (0) to Red (1)
    const color = new Color().copy(_blue).lerp(_red, normalized);

    bars.push({
      tStart: tStarts[i],
      tEnd: tEnds[i],
      value,
      color,
    });
  }

  return { bars, maxAbsValue };
}
