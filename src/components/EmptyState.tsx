import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SPRITES } from '../assets/pixel/sprites';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { DotGrid, Squiggle } from './memphis/Shapes';
import { PixelArt } from './pixel/PixelArt';
import { Sticker } from './Sticker';

interface EmptyStateProps {
  title: string;
  body: string;
  sprite?: keyof typeof SPRITES;
  action?: ReactNode;
}

export function EmptyState({ title, body, sprite = 'buddy', action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <Sticker tone="alt" shape="ticket" style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: -46, top: 4 }} pointerEvents="none">
          <DotGrid rows={3} cols={3} gap={9} color={colors.primary} />
        </View>
        <PixelArt art={SPRITES[sprite]} scale={5} />
        <View style={{ position: 'absolute', right: -60, bottom: 0 }} pointerEvents="none">
          <Squiggle width={44} color={colors.secondary} waves={2} />
        </View>
      </View>
      <AppText variant="title" center accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" muted center style={{ maxWidth: 320 }}>
        {body}
      </AppText>
      {action ? <View style={{ marginTop: 6, alignSelf: 'stretch', alignItems: 'center' }}>{action}</View> : null}
    </Sticker>
  );
}
