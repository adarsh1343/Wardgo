import { memo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { ICONS, type IconName, PIXEL_PALETTE, WEATHER_SPRITES } from '../../assets/pixel/sprites';
import type { WeatherIconKind } from '../../engine/weather';
import { pixelRuns } from './pixelRuns';

interface PixelArtProps {
  art: readonly string[];
  /** Size of one art pixel in device points. Integers keep edges crisp. */
  scale?: number;
  /** Color used for 'X' (ink) pixels. */
  color?: string;
  /** Per-call palette overrides. */
  palette?: Record<string, string>;
  /** Decorative by default; pass a label to expose it to VoiceOver. */
  accessibilityLabel?: string;
}

function PixelArtBase({ art, scale = 2, color = '#1B1A1F', palette, accessibilityLabel }: PixelArtProps) {
  const rows = art.length;
  const cols = art[0]?.length ?? 0;
  const px = Math.max(1, Math.round(scale));
  const runs = pixelRuns(art);
  const decorative = !accessibilityLabel;
  return (
    <Svg
      width={cols * px}
      height={rows * px}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
    >
      {runs.map((r) => (
        <Rect
          key={`${r.x}-${r.y}`}
          // Integer point coordinates keep every edge on a device-pixel boundary (crisp, no blur).
          x={r.x * px}
          y={r.y * px}
          width={r.w * px}
          height={px}
          fill={r.ch === 'X' ? color : (palette?.[r.ch] ?? PIXEL_PALETTE[r.ch] ?? color)}
        />
      ))}
    </Svg>
  );
}

export const PixelArt = memo(PixelArtBase);

interface PixelIconProps {
  name: IconName;
  /** Rendered size in points; snapped to a multiple of 12 for crispness. */
  size?: number;
  color: string;
  accessibilityLabel?: string;
}

/** 12×12 monochrome UI icon. */
export function PixelIcon({ name, size = 24, color, accessibilityLabel }: PixelIconProps) {
  return <PixelArt art={ICONS[name]} scale={Math.max(1, Math.round(size / 12))} color={color} accessibilityLabel={accessibilityLabel} />;
}

export function WeatherSprite({ kind, size = 64, accessibilityLabel }: { kind: WeatherIconKind; size?: number; accessibilityLabel?: string }) {
  return <PixelArt art={WEATHER_SPRITES[kind]} scale={Math.max(1, Math.round(size / 16))} accessibilityLabel={accessibilityLabel} />;
}
