import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, useWindowDimensions, View, useAnimatedValue } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { Chip, ChipRow, PixelTag } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { Banner, SaveBurst } from '../../components/Feedback';
import { Field } from '../../components/Field';
import { StripeBar } from '../../components/memphis/Shapes';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { Screen, ScreenHeader, SectionTitle } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { Sticker } from '../../components/Sticker';
import { getOutfit, outfitToSlots } from '../../database/repositories/outfits';
import { OCCASIONS, SLOT_LABELS, SLOT_ORDER } from '../../engine/catalog';
import { useApp } from '../../features/app/AppState';
import { PieceCard } from '../../features/outfits/PieceCard';
import { TuneSheet } from '../../features/today/TuneSheet';
import { WeatherCard } from '../../features/today/WeatherCard';
import { useTodayOutfit } from '../../features/today/useTodayOutfit';
import { useWeather } from '../../features/today/useWeather';
import { useTheme } from '../../theme/ThemeProvider';
import { borders } from '../../theme/tokens';
import type { SlotKey } from '../../types/models';
import { formatPixelDate } from '../../utils/date';

export default function TodayScreen() {
  const { colors, reduceMotion } = useTheme();
  const { prefs, db } = useApp();
  const weather = useWeather();
  const today = useTodayOutfit(weather.snapshot, weather.loading);
  const params = useLocalSearchParams<{ lock?: string; outfit?: string }>();
  const { width } = useWindowDimensions();
  const [tuneOpen, setTuneOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveFav, setSaveFav] = useState(false);
  const [burst, setBurst] = useState(0);
  const [burstLabel, setBurstLabel] = useState('SAVED!');
  const [savedId, setSavedId] = useState<string | null>(null);
  const spin = useAnimatedValue(0);

  // Deep links: /?lock=<itemId> ("style this item") or /?outfit=<outfitId>.
  useEffect(() => {
    if (today.status === 'loading') return;
    if (params.lock) {
      today.startWith({ lockItemId: params.lock });
      router.setParams({ lock: undefined });
    } else if (params.outfit) {
      const id = params.outfit;
      router.setParams({ outfit: undefined });
      getOutfit(db, id).then((o) => o && today.startWith({ slots: outfitToSlots(o) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.lock, params.outfit, today.status]);

  const regenerate = (scope: Parameters<typeof today.regenerate>[0]) => {
    if (!reduceMotion) {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }).start();
    }
    setSavedId(null);
    today.regenerate(scope);
  };
  // Stepped rotation reads as "pixel" motion rather than a smooth spin.
  const rotate = spin.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '90deg', '180deg', '270deg', '360deg'] });

  const cardWidth = Math.floor((Math.min(width, 700) - 16 * 2 - 14) / 2);
  const s = today.session;
  const current = s.current;
  const pieces = current
    ? SLOT_ORDER.filter((slot) => current.slots[slot] && today.itemsById.get(current.slots[slot]!)).map((slot) => ({
        slot,
        item: today.itemsById.get(current.slots[slot]!)!,
      }))
    : [];

  const openSave = () => {
    const occ = OCCASIONS.find((o) => o.key === today.occasion)?.label ?? 'Everyday';
    setSaveName(`${occ} · ${formatPixelDate().toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`);
    setSaveFav(false);
    setSaveOpen(true);
  };

  const doSave = async () => {
    const id = await today.save(saveName, { favorite: saveFav });
    setSaveOpen(false);
    setSavedId(id);
    setBurstLabel('SAVED!');
    setBurst((b) => b + 1);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={weather.loading && !!weather.snapshot} onRefresh={() => weather.refresh(true)}>
        <ScreenHeader eyebrow={formatPixelDate()} title="Today’s fit" accent="today" />

        <WeatherCard
          snapshot={weather.snapshot}
          stale={weather.stale}
          error={weather.error}
          loading={weather.loading}
          units={prefs.units}
          hasLocation={prefs.location.mode !== 'none'}
          onRefresh={() => weather.refresh(true)}
        />

        {today.status === 'loading' ? (
          <Sticker tone="alt" style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <PixelIcon name="dice" size={36} color={colors.text} />
            <AppText variant="pixel">SHUFFLING YOUR CLOSET…</AppText>
          </Sticker>
        ) : null}

        {today.status === 'empty' ? (
          <EmptyState
            title="Your closet is empty"
            body="Snap a few pieces — a top, a bottom and some shoes — and Wardgo will start styling you for the weather."
            action={<Button label="Add your first piece" icon="camera" onPress={() => router.push('/item/new')} />}
          />
        ) : null}

        {today.status === 'insufficient' ? (
          <EmptyState
            title="Almost there"
            body={`${today.emptyReason ?? ''}${today.missing.length ? ` Missing: ${today.missing.map((m) => SLOT_LABELS[m].toLowerCase()).join(', ')}.` : ''}`}
            action={<Button label="Add a piece" icon="plus" onPress={() => router.push('/item/new')} />}
          />
        ) : null}

        {today.status === 'ready' && current ? (
          <>
            <View style={{ gap: 8 }}>
              <AppText variant="pixel" muted>
                OCCASION
              </AppText>
              <ChipRow scroll>
                {OCCASIONS.map((o) => (
                  <Chip key={o.key} label={o.label} selected={today.occasion === o.key} onPress={() => today.setOccasion(o.key)} tone="secondary" />
                ))}
              </ChipRow>
            </View>

            {s.message ? <Banner text={s.message} tone="warn" onDismiss={today.clearMessage} /> : null}
            {current.warnings.map((w) => (
              <Banner key={w} text={w} tone="info" />
            ))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              {pieces.map(({ slot, item }) => (
                <PieceCard
                  key={`${slot}-${item.id}`}
                  slot={slot}
                  item={item}
                  width={cardWidth}
                  locked={s.lockedIds.includes(item.id)}
                  highlight={s.changedSlots.includes(slot)}
                  onToggleLock={() => today.toggleLock(item.id)}
                  onSwap={() => regenerate({ kind: 'slot', slot })}
                />
              ))}
              {!current.slots.outerwear ? (
                <AddLayerTile width={cardWidth} onPress={() => regenerate({ kind: 'slot', slot: 'outerwear' as SlotKey })} />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={s.lockedIds.length ? `Regenerate unlocked (${pieces.length - s.lockedIds.length})` : 'Regenerate'}
                  size="lg"
                  loading={today.busy}
                  onPress={() => regenerate({ kind: 'all' })}
                  accessibilityHint="Replaces every piece that is not locked"
                  trailing={
                    <Animated.View style={{ transform: [{ rotate }] }} pointerEvents="none">
                      <PixelIcon name="dice" size={24} color={colors.onPrimary} />
                    </Animated.View>
                  }
                />
              </View>
              <IconButton icon="undo" onPress={today.undo} accessibilityLabel="Undo" accessibilityHint="Restore the previous outfit" disabled={s.past.length === 0} size={52} />
              <IconButton icon="filter" onPress={() => setTuneOpen(true)} accessibilityLabel="Tune the vibe" accessibilityHint="More casual, formal, colorful and more" size={52} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button
                label={savedId ? 'Saved' : 'Save outfit'}
                icon={savedId ? 'check' : 'heart'}
                variant="secondary"
                onPress={savedId ? () => router.push(`/outfit/${savedId}`) : openSave}
                style={{ flexGrow: 1 }}
              />
              <Button
                label="Wore it today"
                icon="check"
                variant="mint"
                onPress={async () => {
                  await today.markWorn();
                  setBurstLabel('LOGGED!');
                  setBurst((b) => b + 1);
                }}
                style={{ flexGrow: 1 }}
              />
            </View>
            <Button label="Not for me — try another" icon="close" variant="ghost" size="sm" onPress={today.dislike} accessibilityHint="Remembers you disliked this combination and regenerates" />

            <Sticker tone="alt" shape="ticket" style={{ gap: 10 }}>
              <SectionTitle title="Why this outfit" />
              <View style={{ marginTop: -2 }}>
                <StripeBar width={120} color={colors.secondary} />
              </View>
              {current.reasons.map((r) => (
                <View key={r} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{ paddingTop: 4 }}>
                    <PixelIcon name="star" size={12} color={colors.primary} />
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {r}
                  </AppText>
                </View>
              ))}
              {s.lockedIds.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <PixelTag label={`${s.lockedIds.length} locked`} />
                  <AppText variant="small" muted>
                    Locked pieces never change when you regenerate.
                  </AppText>
                </View>
              ) : null}
            </Sticker>
          </>
        ) : null}
      </Screen>

      <SaveBurst trigger={burst} label={burstLabel} />

      <TuneSheet
        visible={tuneOpen}
        value={today.adjustments}
        onClose={() => setTuneOpen(false)}
        onApply={(a) => {
          setTuneOpen(false);
          today.applyAdjustments(a);
        }}
      />

      <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} title="Save this outfit" footer={<Button label="Save" icon="heart" variant="secondary" onPress={doSave} disabled={!saveName.trim()} />}>
        <Field label="Name" value={saveName} onChangeText={setSaveName} maxLength={60} autoFocus />
        <Chip label="Add to favorites" selected={saveFav} onPress={() => setSaveFav(!saveFav)} icon="star" tone="highlight" />
        <AppText variant="small" muted>
          Saved outfits point at your wardrobe items — nothing is duplicated. Add it to albums from the outfit page.
        </AppText>
      </Sheet>
    </View>
  );
}

function AddLayerTile({ width, onPress }: { width: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add an outer layer"
      style={({ pressed }) => ({
        width,
        minHeight: 120,
        borderWidth: borders.bold,
        borderStyle: 'dashed',
        borderColor: colors.border,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <PixelIcon name="outerwear" size={36} color={colors.textMuted} />
      <AppText variant="caption" muted center>
        Add a layer
      </AppText>
    </Pressable>
  );
}
