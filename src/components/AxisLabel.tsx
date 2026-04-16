import { Html } from '@react-three/drei';
import katex from 'katex';
import { useMemo } from 'react';

interface AxisLabelProps {
  position: [number, number, number];
  latex: string;
  fontSize?: number;
  opacity?: number;
}

export function AxisLabel({ position, latex, fontSize = 22, opacity = 1 }: AxisLabelProps) {
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false }),
    [latex],
  );

  return (
    <Html position={position} center>
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: '#ffffff',
          fontSize: `${fontSize}px`,
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: '0 0 10px rgba(88, 196, 221, 0.4)',
          whiteSpace: 'nowrap',
          opacity,
        }}
      />
    </Html>
  );
}
