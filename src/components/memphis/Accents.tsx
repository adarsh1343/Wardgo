// Composed Memphis clusters for screen headers. Each screen gets its own
// arrangement so the app feels collected rather than templated, while the
// same vocabulary (squiggle, dots, triangle, ring, checker) ties it together.
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Checker, Disc, DotGrid, HalfDisc, Ring, Squiggle, Triangle, Zigzag } from './Shapes';

export type AccentVariant = 'today' | 'wardrobe' | 'outfits' | 'settings' | 'detail';

export function MemphisAccent({ variant }: { variant: AccentVariant }) {
  const { colors } = useTheme();
  const wrap = {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    width: 150,
    height: 110,
  };
  const abs = (style: object) => ({ position: 'absolute' as const, ...style });
  return (
    <View pointerEvents="none" style={wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {variant === 'today' && (
        <>
          <View style={abs({ right: 14, top: 8 })}>
            <Disc size={52} color={colors.highlight} outline={colors.border} />
          </View>
          <View style={abs({ right: 64, top: 42 })}>
            <Triangle size={30} color={colors.secondary} outline={colors.border} rotate={-12} />
          </View>
          <View style={abs({ right: 6, top: 70 })}>
            <Squiggle width={70} color={colors.primary} />
          </View>
          <View style={abs({ right: 96, top: 6 })}>
            <DotGrid rows={3} cols={3} gap={9} color={colors.text} />
          </View>
        </>
      )}
      {variant === 'wardrobe' && (
        <>
          <View style={abs({ right: 20, top: 10 })}>
            <Ring size={46} color={colors.primary} />
          </View>
          <View style={abs({ right: 58, top: 52 })}>
            <Zigzag width={64} color={colors.secondary} />
          </View>
          <View style={abs({ right: 4, top: 60 })}>
            <Checker rows={2} cols={4} cell={7} a={colors.text} b="transparent" />
          </View>
        </>
      )}
      {variant === 'outfits' && (
        <>
          <View style={abs({ right: 12, top: 14 })}>
            <HalfDisc size={56} color={colors.mint} rotate={180} />
          </View>
          <View style={abs({ right: 70, top: 14 })}>
            <Triangle size={26} color={colors.highlight} outline={colors.border} rotate={20} />
          </View>
          <View style={abs({ right: 18, top: 66 })}>
            <Squiggle width={60} color={colors.secondary} waves={3} />
          </View>
        </>
      )}
      {variant === 'settings' && (
        <>
          <View style={abs({ right: 16, top: 12 })}>
            <DotGrid rows={4} cols={5} gap={10} color={colors.primary} />
          </View>
          <View style={abs({ right: 70, top: 52 })}>
            <Ring size={30} color={colors.secondary} strokeWidth={4} />
          </View>
        </>
      )}
      {variant === 'detail' && (
        <View style={abs({ right: 16, top: 12 })}>
          <Zigzag width={56} color={colors.highlight} />
        </View>
      )}
    </View>
  );
}
