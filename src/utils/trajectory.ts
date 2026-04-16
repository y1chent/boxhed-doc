import { Vector3, CatmullRomCurve3 } from 'three';

export const VISUAL_SCALE = 7;

export function generateTrajectoryPoints(
  numWaypoints = 8,
  timeRange: [number, number] = [0.05, 0.95],
  x1Range: [number, number] = [0.05, 0.95],
  x2Range: [number, number] = [0.05, 0.95],
  seed = 42,
): Vector3[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  const waypoints: Vector3[] = [];
  for (let i = 0; i < numWaypoints; i++) {
    const t = timeRange[0] + (i / (numWaypoints - 1)) * (timeRange[1] - timeRange[0]);
    const x1 = x1Range[0] + rand() * (x1Range[1] - x1Range[0]);
    const x2 = x2Range[0] + rand() * (x2Range[1] - x2Range[0]);
    waypoints.push(new Vector3(t, x1, x2));
  }
  return waypoints;
}

export function createTrajectoryCurve(
  waypoints: Vector3[],
  segments = 200,
): { curve: CatmullRomCurve3; points: Vector3[] } {
  const curve = new CatmullRomCurve3(waypoints, false, 'catmullrom', 0.5);
  const points = curve.getPoints(segments);
  return { curve, points };
}

export function generatePiecewiseConstant(
  curve: CatmullRomCurve3,
  timeRange: [number, number] = [0.05, 0.95],
  minLen = 0.05,
  maxLen = 0.25,
  seed = 137,
): Vector3[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  const tMin = timeRange[0];
  const tMax = timeRange[1];
  const totalT = tMax - tMin;
  const points: Vector3[] = [];

  let t = tMin;
  while (t < tMax) {
    const stepLen = Math.min(minLen + rand() * (maxLen - minLen), tMax - t);
    const tNext = t + stepLen;

    const u = (t - tMin) / totalT;
    const sample = curve.getPointAt(Math.min(u, 1));

    points.push(new Vector3(t, sample.y, sample.z));
    points.push(new Vector3(tNext, sample.y, sample.z));

    t = tNext;
  }

  return points;
}

function betaPDF22(x: number): number {
  return 6 * x * (1 - x);
}

/**
 * Generate the lambda curve and matching 3D source points for projection animation.
 * Returns two arrays of the same length:
 * - lambdaPoints: the 2D lambda(t) curve points (t, lambda, 0)
 * - sourcePoints: the corresponding 3D piecewise positions (t, x1, x2)
 * These can be lerped per-vertex during the projection animation.
 */
export function generateLambdaCurve(
  pwPoints: Vector3[],
  samplesPerPiece = 30,
): { points: Vector3[]; sourcePoints: Vector3[]; maxLambda: number } {
  const points: Vector3[] = [];
  const sourcePoints: Vector3[] = [];
  let maxLambda = 0;
  const numPieces = pwPoints.length / 2;

  for (let i = 0; i < numPieces; i++) {
    const pStart = pwPoints[2 * i];
    const pEnd = pwPoints[2 * i + 1];
    const tStart = pStart.x;
    const tEnd = pEnd.x;
    const x1 = pStart.y;
    const x2 = pStart.z;

    const cX1X2 = betaPDF22(x1) * betaPDF22(x2);

    // Add jump point at start of this piece (connects to previous piece's end)
    if (i > 0) {
      const lambdaAtBoundary = betaPDF22(tStart) * cX1X2;
      points.push(new Vector3(tStart, lambdaAtBoundary, 0));
      sourcePoints.push(new Vector3(tStart, x1, x2));
    }

    for (let j = 0; j < samplesPerPiece; j++) {
      const frac = j / (samplesPerPiece - 1);
      const t = tStart + frac * (tEnd - tStart);
      const lambda = betaPDF22(t) * cX1X2;
      if (lambda > maxLambda) maxLambda = lambda;
      points.push(new Vector3(t, lambda, 0));
      sourcePoints.push(new Vector3(t, x1, x2));
    }

    // Add end-of-piece point for the jump
    if (i < numPieces - 1) {
      const lambdaAtEnd = betaPDF22(tEnd) * cX1X2;
      points.push(new Vector3(tEnd, lambdaAtEnd, 0));
      sourcePoints.push(new Vector3(tEnd, x1, x2));
    }
  }

  return { points, sourcePoints, maxLambda };
}
