// Smoke tests for the design system and key feature components: they render,
// expose accessible roles/labels, and respond to presses.
import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { AppText } from '../src/components/AppText';
import { Button } from '../src/components/Button';
import { Chip, PixelTag } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { Banner, PipMeter, SaveBurst } from '../src/components/Feedback';
import { MemphisAccent } from '../src/components/memphis/Accents';
import { PixelIcon, WeatherSprite } from '../src/components/pixel/PixelArt';
import { Sticker } from '../src/components/Sticker';
import { ICONS, WEATHER_SPRITES } from '../src/assets/pixel/sprites';
import { PieceCard } from '../src/features/outfits/PieceCard';
import { WeatherCard } from '../src/features/today/WeatherCard';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { makeItem } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() } }));
jest.mock('../src/services/storage/images', () => ({ imageUri: (n: string | null) => (n ? `file:///mock/${n}` : null) }));
// jest.mock factories are hoisted above imports, so they must use require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const wrap = (ui: ReactNode, mode: 'light' | 'dark' = 'light') => <ThemeProvider mode={mode}>{ui}</ThemeProvider>;

describe('design system', () => {
  test.each(['light', 'dark'] as const)('core components render in %s mode', async (mode) => {
    await render(
      wrap(
        <>
          <AppText variant="display">Today’s fit</AppText>
          <AppText variant="pixel">MON 19 OCT</AppText>
          <Sticker shape="ticket">
            <AppText>Inside a sticker</AppText>
          </Sticker>
          <PixelTag label="Locked" />
          <MemphisAccent variant="today" />
          <Banner text="Rain likely" tone="warn" />
        </>,
        mode,
      ),
    );
    expect(screen.getByText('Today’s fit')).toBeTruthy();
    expect(screen.getByText('LOCKED')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('every pixel icon and weather sprite renders', async () => {
    await render(
      wrap(
        <>
          {Object.keys(ICONS).map((n) => (
            <PixelIcon key={n} name={n as keyof typeof ICONS} color="#000" />
          ))}
          {Object.keys(WEATHER_SPRITES).map((k) => (
            <WeatherSprite key={k} kind={k as keyof typeof WEATHER_SPRITES} />
          ))}
        </>,
      ),
    );
  });

  test('button is accessible and pressable', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(wrap(<Button label="Regenerate" icon="dice" onPress={onPress} />));
    await user.press(screen.getByRole('button', { name: 'Regenerate' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('chip exposes checked state (not color alone)', async () => {
    await render(wrap(<Chip label="Casual" selected onPress={() => undefined} />));
    expect(screen.getByRole('checkbox', { name: 'Casual' })).toBeChecked();
  });

  test('pip meter is adjustable', async () => {
    await render(wrap(<PipMeter label="Warmth" value={3} onChange={() => undefined} />));
    expect(screen.getByRole('adjustable', { name: 'Warmth' })).toBeTruthy();
    expect(screen.getByText('3/5')).toBeTruthy();
  });

  test('empty state and save burst render', async () => {
    await render(
      wrap(
        <>
          <EmptyState title="Nothing here" body="Add something" sprite="emptyAlbum" />
          <SaveBurst trigger={1} label="SAVED!" />
        </>,
      ),
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('SAVED!')).toBeTruthy();
  });
});

describe('feature components', () => {
  const jeans = makeItem('jeans', { id: 'grey-jeans', name: 'Grey jeans' });

  test('piece card lock toggle is a labelled switch with text state', async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();
    const { rerender } = await render(wrap(<PieceCard slot="bottom" item={jeans} width={160} locked={false} onToggleLock={onToggle} onSwap={() => undefined} />));
    const lock = screen.getByRole('switch', { name: 'Lock Grey jeans' });
    expect(lock).not.toBeChecked();
    expect(screen.getByText('Lock')).toBeTruthy();
    await user.press(lock);
    expect(onToggle).toHaveBeenCalled();

    await rerender(wrap(<PieceCard slot="bottom" item={jeans} width={160} locked onToggleLock={onToggle} onSwap={() => undefined} />));
    expect(screen.getByRole('switch', { name: 'Lock Grey jeans' })).toBeChecked();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('LOCKED')).toBeTruthy();
    // Swapping a locked piece is disabled.
    expect(screen.getByRole('button', { name: 'Swap bottom' })).toBeDisabled();
  });

  test('weather card: live data, stale flag, no location', async () => {
    const snapshot = {
      tempC: 8,
      feelsLikeC: 5,
      highC: 11,
      lowC: 4,
      precipProbability: 70,
      windKph: 22,
      code: 63,
      summary: 'Rain',
      isDay: true,
      locationName: 'Berlin',
      latitude: 52.52,
      longitude: 13.41,
      fetchedAt: new Date().toISOString(),
    };
    const { rerender } = await render(wrap(<WeatherCard snapshot={snapshot} stale={false} error={null} loading={false} units="C" hasLocation onRefresh={() => undefined} />));
    expect(screen.getByText('Rain')).toBeTruthy();
    expect(screen.getByText('70% rain')).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(screen.getByText(/Open-Meteo/)).toBeTruthy();

    await rerender(wrap(<WeatherCard snapshot={snapshot} stale error="Could not reach the weather service. Showing saved weather." loading={false} units="F" hasLocation onRefresh={() => undefined} />));
    expect(screen.getByText('STALE')).toBeTruthy();
    expect(screen.getByText('46°')).toBeTruthy(); // 8°C in °F

    await rerender(wrap(<WeatherCard snapshot={null} stale={false} error={null} loading={false} units="C" hasLocation={false} onRefresh={() => undefined} />));
    expect(screen.getByRole('button', { name: 'Set location' })).toBeTruthy();
  });
});

describe('reduced motion', () => {
  test('components render with Reduce Motion enabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(wrap(<SaveBurst trigger={2} label="LOGGED!" />));
    expect(screen.getByText('LOGGED!')).toBeTruthy();
  });
});
