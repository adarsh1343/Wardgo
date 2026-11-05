// Memphis geometric primitives. All are decorative: hidden from VoiceOver and
// never interactive (pointerEvents="none" on the wrapper that places them).
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

export function Squiggle({ width = 80, color, strokeWidth = 4, waves = 4 }: { width?: number; color: string; strokeWidth?: number; waves?: number }) {
  const h = 16;
  const seg = width / waves;
  let d = `M ${strokeWidth} ${h / 2}`;
  for (let i = 0; i < waves; i++) {
    const x0 = i * seg + strokeWidth;
    d += ` Q ${x0 + seg / 4} ${i % 2 === 0 ? 0 : h} ${x0 + seg / 2} ${h / 2} T ${x0 + seg} ${h / 2}`;
  }
  return (
    <Svg width={width + strokeWidth * 2} height={h + strokeWidth} viewBox={`0 -${strokeWidth / 2} ${width + strokeWidth * 2} ${h + strokeWidth}`} {...hidden}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function Zigzag({ width = 80, color, strokeWidth = 4, peaks = 5, height = 14 }: { width?: number; color: string; strokeWidth?: number; peaks?: number; height?: number }) {
  const step = width / (peaks * 2);
  const pts: string[] = [];
  for (let i = 0; i <= peaks * 2; i++) pts.push(`${i * step + strokeWidth},${i % 2 === 0 ? height : strokeWidth}`);
  return (
    <Svg width={width + strokeWidth * 2} height={height + strokeWidth} {...hidden}>
      <Path d={`M ${pts.join(' L ')}`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="miter" />
    </Svg>
  );
}

export function DotGrid({ rows = 3, cols = 5, gap = 10, radius = 2.2, color }: { rows?: number; cols?: number; gap?: number; radius?: number; color: string }) {
  const dots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push(<Circle key={`${r}-${c}`} cx={c * gap + radius} cy={r * gap + radius} r={radius} fill={color} />);
  return (
    <Svg width={(cols - 1) * gap + radius * 2} height={(rows - 1) * gap + radius * 2} {...hidden}>
      {dots}
    </Svg>
  );
}

export function Triangle({ size = 28, color, outline, rotate = 0 }: { size?: number; color: string; outline?: string; rotate?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" style={{ transform: [{ rotate: `${rotate}deg` }] }} {...hidden}>
      <Polygon points="16,3 30,29 2,29" fill={color} stroke={outline ?? 'none'} strokeWidth={outline ? 2.5 : 0} strokeLinejoin="round" />
    </Svg>
  );
}

export function Ring({ size = 32, color, strokeWidth = 5 }: { size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} {...hidden}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - strokeWidth / 2} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export function Disc({ size = 32, color, outline }: { size?: number; color: string; outline?: string }) {
  return (
    <Svg width={size} height={size} {...hidden}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - (outline ? 1.5 : 0)} fill={color} stroke={outline ?? 'none'} strokeWidth={outline ? 2.5 : 0} />
    </Svg>
  );
}

export function HalfDisc({ size = 40, color, rotate = 0 }: { size?: number; color: string; rotate?: number }) {
  return (
    <Svg width={size} height={size / 2} viewBox="0 0 40 20" style={{ transform: [{ rotate: `${rotate}deg` }] }} {...hidden}>
      <Path d="M0 20 A20 20 0 0 1 40 20 Z" fill={color} />
    </Svg>
  );
}

export function Checker({ rows = 2, cols = 6, cell = 6, a, b }: { rows?: number; cols?: number; cell?: number; a: string; b: string }) {
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push(<Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={(r + c) % 2 === 0 ? a : b} />);
  return (
    <Svg width={cols * cell} height={rows * cell} {...hidden}>
      {cells}
    </Svg>
  );
}

/** Thin striped bar used as a section divider. */
export function StripeBar({ width = 120, height = 8, color, gap = 6 }: { width?: number; height?: number; color: string; gap?: number }) {
  const stripes = [];
  for (let x = -height; x < width + height; x += gap) {
    stripes.push(<Path key={x} d={`M ${x} ${height} L ${x + height} 0`} stroke={color} strokeWidth={2} />);
  }
  return (
    <Svg width={width} height={height} {...hidden}>
      {stripes}
    </Svg>
  );
}
