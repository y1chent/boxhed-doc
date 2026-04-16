import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2, Vector3, Mesh } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
  generateTrajectoryPoints,
  createTrajectoryCurve,
  generatePiecewiseConstant,
  generateLambdaCurve,
  VISUAL_SCALE,
} from '../utils/trajectory';
import { MANIM } from '../theme/colors';
import type { Phase } from '../types';

const SMOOTH_DURATION = 3;
const SMOOTH_DELAY = 0.5;
const PAUSE_DURATION = 1;
const PIECEWISE_DURATION = 2;
const FADE_DURATION = 1;
const CAMERA_TRANSITION_DURATION = 2.5;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildLine(positions: number[], color: number, linewidth: number, opacity = 1) {
  const geo = new LineGeometry();
  geo.setPositions(positions);
  const mat = new LineMaterial({
    color,
    linewidth,
    worldUnits: true,
    transparent: true,
    opacity,
  });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  geo.instanceCount = 0;
  return line;
}

interface TrajectoryProps {
  phase: Phase;
  setPhase: (p: Phase) => void;
  transitionRef: React.RefObject<number>;
}

export function Trajectory({ phase, setPhase, transitionRef }: TrajectoryProps) {
  const { size } = useThree();
  const S = VISUAL_SCALE;

  // Generate all data in (0,1) range, then scale for display
  const { scaledPoints, scaledPwPoints, projSourcePositions, projTargetPositions } = useMemo(() => {
    const rawWaypoints = generateTrajectoryPoints();
    const { points: rawCurvePoints, curve } = createTrajectoryCurve(rawWaypoints);
    const rawPw = generatePiecewiseConstant(curve);
    const { points: rawLambda, sourcePoints: rawSource, maxLambda } = generateLambdaCurve(rawPw);

    const lambdaScale = (S / maxLambda) * 0.85;

    // Source positions: 3D piecewise constant positions (scaled)
    const srcPos: number[] = [];
    for (const p of rawSource) {
      srcPos.push(p.x * S, p.y * S, p.z * S);
    }

    // Target positions: 2D lambda curve positions (scaled)
    const tgtPos: number[] = [];
    for (const p of rawLambda) {
      tgtPos.push(p.x * S, p.y * lambdaScale, 0);
    }

    return {
      scaledPoints: rawCurvePoints.map(p => new Vector3(p.x * S, p.y * S, p.z * S)),
      scaledPwPoints: rawPw.map(p => new Vector3(p.x * S, p.y * S, p.z * S)),
      projSourcePositions: srcPos,
      projTargetPositions: tgtPos,
    };
  }, [S]);

  // Build smooth Line2 objects
  const { mainLine, glowLine } = useMemo(() => {
    const pos: number[] = [];
    for (const p of scaledPoints) {
      pos.push(p.x, p.y, p.z);
    }
    return {
      mainLine: buildLine(pos, 0x58c4dd, 0.035),
      glowLine: buildLine(pos, 0x58c4dd, 0.10, 0.12),
    };
  }, [scaledPoints]);

  // Build piecewise constant Line2 objects
  const { pwMainLine, pwGlowLine } = useMemo(() => {
    const pos: number[] = [];
    for (const p of scaledPwPoints) {
      pos.push(p.x, p.y, p.z);
    }
    return {
      pwMainLine: buildLine(pos, 0x83c167, 0.035),
      pwGlowLine: buildLine(pos, 0x83c167, 0.10, 0.12),
    };
  }, [scaledPwPoints]);

  // Build projection line — starts at 3D source positions, morphs to 2D lambda positions
  // Uses the same number of vertices as the lambda curve (matched by generateLambdaCurve)
  const { projMainLine, projGlowLine } = useMemo(() => {
    // Start at the 3D source positions
    const main = buildLine(projSourcePositions, 0x83c167, 0.035);
    const glow = buildLine(projSourcePositions, 0x83c167, 0.10, 0.12);
    main.visible = false;
    glow.visible = false;
    return { projMainLine: main, projGlowLine: glow };
  }, [projSourcePositions]);

  // Pre-allocate interpolation buffer
  const interpBuffer = useMemo(() => new Float32Array(projSourcePositions.length), [projSourcePositions]);

  const elapsedRef = useRef(0);
  const phaseStartRef = useRef(0);
  const dotRef = useRef<Mesh>(null!);

  useFrame((_, delta) => {
    if (phase === 'done') return;
    elapsedRef.current += delta;

    if (phase === 'draw-smooth') {
      if (elapsedRef.current < SMOOTH_DELAY) return;
      const progress = Math.min(1, (elapsedRef.current - SMOOTH_DELAY) / SMOOTH_DURATION);
      const eased = easeInOutCubic(progress);
      const segCount = Math.max(1, Math.floor(eased * (scaledPoints.length - 1)));

      mainLine.geometry.instanceCount = segCount;
      glowLine.geometry.instanceCount = segCount;

      if (dotRef.current) {
        const idx = Math.min(segCount, scaledPoints.length - 1);
        const p = scaledPoints[idx];
        dotRef.current.position.set(p.x, p.y, p.z);
      }

      if (progress >= 1) {
        mainLine.geometry.instanceCount = scaledPoints.length - 1;
        glowLine.geometry.instanceCount = scaledPoints.length - 1;
        phaseStartRef.current = elapsedRef.current;
        setPhase('pause');
      }
    } else if (phase === 'pause') {
      if (elapsedRef.current - phaseStartRef.current >= PAUSE_DURATION) {
        phaseStartRef.current = elapsedRef.current;
        setPhase('draw-piecewise');
      }
    } else if (phase === 'draw-piecewise') {
      const progress = Math.min(1, (elapsedRef.current - phaseStartRef.current) / PIECEWISE_DURATION);
      const eased = easeInOutCubic(progress);
      const segCount = Math.max(1, Math.floor(eased * (scaledPwPoints.length - 1)));

      pwMainLine.geometry.instanceCount = segCount;
      pwGlowLine.geometry.instanceCount = segCount;

      if (progress >= 1) {
        pwMainLine.geometry.instanceCount = scaledPwPoints.length - 1;
        pwGlowLine.geometry.instanceCount = scaledPwPoints.length - 1;
        phaseStartRef.current = elapsedRef.current;
        setPhase('fade-smooth');
      }
    } else if (phase === 'fade-smooth') {
      const progress = Math.min(1, (elapsedRef.current - phaseStartRef.current) / FADE_DURATION);
      const eased = easeInOutCubic(progress);

      (mainLine.material as LineMaterial).opacity = 1 - eased;
      (glowLine.material as LineMaterial).opacity = 0.12 * (1 - eased);

      if (progress >= 1) {
        mainLine.visible = false;
        glowLine.visible = false;
        // Show projection line (starts at same positions as piecewise), hide original piecewise
        const numVerts = projSourcePositions.length / 3;
        projMainLine.visible = true;
        projGlowLine.visible = true;
        projMainLine.geometry.instanceCount = numVerts - 1;
        projGlowLine.geometry.instanceCount = numVerts - 1;
        pwMainLine.visible = false;
        pwGlowLine.visible = false;
        phaseStartRef.current = elapsedRef.current;
        setPhase('camera-transition');
      }
    } else if (phase === 'camera-transition') {
      const progress = Math.min(1, (elapsedRef.current - phaseStartRef.current) / CAMERA_TRANSITION_DURATION);
      const eased = easeInOutCubic(progress);

      // Write progress to shared ref for Scene/Axes/Grid to read
      (transitionRef as React.MutableRefObject<number>).current = eased;

      // Interpolate projection line vertices from 3D source → 2D lambda target
      for (let i = 0; i < projSourcePositions.length; i++) {
        interpBuffer[i] = projSourcePositions[i] + eased * (projTargetPositions[i] - projSourcePositions[i]);
      }
      projMainLine.geometry.setPositions(interpBuffer as any);
      projGlowLine.geometry.setPositions(interpBuffer as any);

      // Cross-fade color from green to yellow
      const r = 0x83 / 255 + eased * (0xff / 255 - 0x83 / 255);
      const g = 0xc1 / 255 + eased * (0xff / 255 - 0xc1 / 255);
      const b = 0x67 / 255 + eased * (0x00 / 255 - 0x67 / 255);
      (projMainLine.material as LineMaterial).color.setRGB(r, g, b);
      (projGlowLine.material as LineMaterial).color.setRGB(r, g, b);

      if (progress >= 1) {
        setPhase('done');
      }
    }
  });

  // Update resolution on resize
  useEffect(() => {
    const res = new Vector2(size.width, size.height);
    (mainLine.material as LineMaterial).resolution.copy(res);
    (glowLine.material as LineMaterial).resolution.copy(res);
    (pwMainLine.material as LineMaterial).resolution.copy(res);
    (pwGlowLine.material as LineMaterial).resolution.copy(res);
    (projMainLine.material as LineMaterial).resolution.copy(res);
    (projGlowLine.material as LineMaterial).resolution.copy(res);
  }, [size, mainLine, glowLine, pwMainLine, pwGlowLine, projMainLine, projGlowLine]);

  const startPos = scaledPoints[0];
  const showDot = phase === 'draw-smooth';

  return (
    <group>
      {/* Smooth curve */}
      <primitive object={glowLine} />
      <primitive object={mainLine} />
      {/* Piecewise constant */}
      <primitive object={pwGlowLine} />
      <primitive object={pwMainLine} />
      {/* Projection line (morphs from piecewise 3D → lambda 2D) */}
      <primitive object={projGlowLine} />
      <primitive object={projMainLine} />
      {/* Leading edge dot (smooth phase only) */}
      {showDot && (
        <mesh ref={dotRef} position={[startPos.x, startPos.y, startPos.z]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color={MANIM.BLUE_A} transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  );
}
