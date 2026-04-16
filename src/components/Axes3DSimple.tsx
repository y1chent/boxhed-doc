import { Line } from '@react-three/drei';
import { MANIM } from '../theme/colors';
import { AxisLabel } from './AxisLabel';

const AXIS_LENGTH = 7;
const TICK_SIZE = 0.1;

function Ticks({ axis }: { axis: 'x' | 'y' | 'z' }) {
  const ticks = [];
  for (let i = 1; i <= 6; i++) {
    let start: [number, number, number];
    let end: [number, number, number];

    if (axis === 'x') {
      start = [i, -TICK_SIZE, 0];
      end = [i, TICK_SIZE, 0];
    } else if (axis === 'y') {
      start = [0, i, -TICK_SIZE];
      end = [0, i, TICK_SIZE];
    } else {
      start = [-TICK_SIZE, 0, i];
      end = [TICK_SIZE, 0, i];
    }

    ticks.push(
      <Line key={`${axis}-${i}`} points={[start, end]} color={MANIM.GREY_C} lineWidth={1} />,
    );
  }
  return <>{ticks}</>;
}

export function Axes3DSimple() {
  return (
    <group>
      {/* X axis — t */}
      <Line points={[[0, 0, 0], [AXIS_LENGTH, 0, 0]]} color={MANIM.GREY_B} lineWidth={1.5} />
      <mesh position={[AXIS_LENGTH, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.06, 0.25, 12]} />
        <meshBasicMaterial color={MANIM.GREY_B} />
      </mesh>
      <AxisLabel position={[AXIS_LENGTH + 0.5, 0, 0]} latex="t" />
      <Ticks axis="x" />

      {/* Y axis — X1 */}
      <Line points={[[0, 0, 0], [0, AXIS_LENGTH, 0]]} color={MANIM.GREY_B} lineWidth={1.5} />
      <mesh position={[0, AXIS_LENGTH, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.06, 0.25, 12]} />
        <meshBasicMaterial color={MANIM.GREY_B} />
      </mesh>
      <AxisLabel position={[0, AXIS_LENGTH + 0.5, 0]} latex="X_1" />
      <Ticks axis="y" />

      {/* Z axis — X2 */}
      <Line points={[[0, 0, 0], [0, 0, AXIS_LENGTH]]} color={MANIM.GREY_B} lineWidth={1.5} />
      <mesh position={[0, 0, AXIS_LENGTH]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.25, 12]} />
        <meshBasicMaterial color={MANIM.GREY_B} />
      </mesh>
      <AxisLabel position={[0, 0, AXIS_LENGTH + 0.5]} latex="X_2" />
      <Ticks axis="z" />
    </group>
  );
}
