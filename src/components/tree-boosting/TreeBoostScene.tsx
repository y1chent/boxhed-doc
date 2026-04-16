import { OrbitControls } from '@react-three/drei';
import { MANIM } from '../../theme/colors';

export function TreeBoostScene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <fog attach="fog" args={[MANIM.BACKGROUND, 20, 35]} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.2}
        target={[3.5, 3.5, 3.5]}
      />
    </>
  );
}
