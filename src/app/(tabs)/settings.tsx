import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { Chip, ChipRow } from '../../components/Chip';
import { Banner } from '../../components/Feedback';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { Screen, ScreenHeader, SectionTitle } from '../../components/Screen';
import { Sticker } from '../../components/Sticker';
import { ToggleRow } from '../../features/wardrobe/ItemForm';
import { useApp } from '../../features/app/AppState';
import { cancelMorningReminder, scheduleMorningReminder } from '../../services/notifications/reminders';
import { applyRestore, createBackupFile, deleteAllData, pickBackup, shareBackup } from '../../services/storage/backup';
import type { RestoreMode } from '../../services/storage/backupFormat';
import { useTheme } from '../../theme/ThemeProvider';
import { borders } from '../../theme/tokens';

const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { db, prefs, updatePrefs, reloadPrefs, notifyDataChanged } = useApp();
  const [status, setStatus] = useState<{ text: string; tone: 'info' | 'success' | 'error' | 'warn' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const setReminder = async (next: { enabled: boolean; hour: number; minute: number }) => {
    if (next.enabled) {
      const res = await scheduleMorningReminder(next.hour, next.minute);
      if (!res.ok) {
        setStatus({ text: res.message ?? 'Could not schedule the reminder.', tone: 'error' });
        await updatePrefs({ reminder: { ...next, enabled: false } });
        return;
      }
    } else {
      await cancelMorningReminder();
    }
    await updatePrefs({ reminder: next });
  };

  const shiftTime = (deltaMin: number) => {
    const total = (prefs.reminder.hour * 60 + prefs.reminder.minute + deltaMin + 1440) % 1440;
    setReminder({ ...prefs.reminder, hour: Math.floor(total / 60), minute: total % 60 });
  };

  const doExport = async () => {
    setBusy('export');
    setStatus(null);
    try {
      const res = await createBackupFile(db);
      const shared = await shareBackup(res.uri);
      setStatus({
        text: shared
          ? `Backup created: ${res.items} items, ${res.images} photos${res.missingImages ? ` (${res.missingImages} photo files were missing and skipped)` : ''}. Save it to Files, iCloud Drive or another device.`
          : 'Sharing is not available on this device.',
        tone: shared ? 'success' : 'warn',
      });
    } catch (e) {
      setStatus({ text: `Export failed: ${e instanceof Error ? e.message : 'unknown error'}`, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async (plan: Awaited<ReturnType<Extract<Awaited<ReturnType<typeof pickBackup>>, { ok: true }>['plan']>>, mode: RestoreMode) => {
    setBusy('restore');
    try {
      await applyRestore(db, plan, mode);
      await reloadPrefs();
      notifyDataChanged();
      const r = plan.report;
      setStatus({
        text: `Restored ${r.items} items, ${r.outfits} outfits, ${r.albums} albums.${r.skippedDuplicates ? ` Skipped ${r.skippedDuplicates} duplicates.` : ''}${r.missingImages ? ` ${r.missingImages} photos were missing from the backup.` : ''}${r.repairedLinks ? ` Repaired ${r.repairedLinks} broken links.` : ''}`,
        tone: 'success',
      });
    } catch (e) {
      setStatus({ text: `Restore failed and nothing was changed: ${e instanceof Error ? e.message : 'unknown error'}`, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setStatus(null);
    const picked = await pickBackup(db);
    if (!picked.ok) {
      if (!picked.canceled) setStatus({ text: picked.error, tone: 'error' });
      return;
    }
    const warn = picked.warnings.length ? `\n\nNote: ${picked.warnings.join(' ')}` : '';
    Alert.alert('Restore backup?', `${picked.summary}${warn}\n\nMerge keeps everything on this phone and adds what is missing. Replace deletes current data first.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Merge', onPress: async () => runRestore(await picked.plan('merge'), 'merge') },
      {
        text: 'Replace all',
        style: 'destructive',
        onPress: async () => runRestore(await picked.plan('replace'), 'replace'),
      },
    ]);
  };

  const doDeleteAll = () => {
    Alert.alert('Delete all Wardgo data?', 'Every item, photo, outfit, album, preference and history entry on this phone will be permanently deleted. Export a backup first if you might want it back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Are you sure?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, delete',
              style: 'destructive',
              onPress: async () => {
                await cancelMorningReminder();
                await deleteAllData(db);
                await reloadPrefs();
                notifyDataChanged();
                setStatus({ text: 'All data deleted.', tone: 'info' });
              },
            },
          ]),
      },
    ]);
  };

  const loc = prefs.location;

  return (
    <Screen>
      <ScreenHeader eyebrow="PREFERENCES" title="Settings" accent="settings" />
      {status ? <Banner text={status.text} tone={status.tone} onDismiss={() => setStatus(null)} /> : null}

      <Sticker style={{ gap: 14 }}>
        <SectionTitle title="Look & units" />
        <AppText variant="bodyStrong">Theme</AppText>
        <ChipRow>
          {(['system', 'light', 'dark'] as const).map((m) => (
            <Chip key={m} label={m === 'system' ? 'Match iPhone' : m === 'light' ? 'Light' : 'Dark'} selected={prefs.themeMode === m} onPress={() => updatePrefs({ themeMode: m })} />
          ))}
        </ChipRow>
        <AppText variant="bodyStrong">Temperature</AppText>
        <ChipRow>
          <Chip label="Celsius (°C)" selected={prefs.units === 'C'} onPress={() => updatePrefs({ units: 'C' })} />
          <Chip label="Fahrenheit (°F)" selected={prefs.units === 'F'} onPress={() => updatePrefs({ units: 'F' })} />
        </ChipRow>
      </Sticker>

      <Sticker style={{ gap: 14 }} shape="ticketAlt">
        <SectionTitle title="Weather" />
        <SettingsLink
          icon="pin"
          title={loc.mode === 'none' ? 'No location set' : loc.name}
          subtitle={loc.mode === 'none' ? 'Tap to use your location or search a city' : loc.mode === 'device' ? 'From your phone’s location' : 'Chosen manually'}
          onPress={() => router.push('/location')}
        />
        <AppText variant="bodyStrong">Refresh weather</AppText>
        <ChipRow>
          {[
            [30, 'Every 30 min'],
            [60, 'Hourly'],
            [180, 'Every 3 h'],
            [0, 'Only when I pull'],
          ].map(([m, label]) => (
            <Chip key={m} label={label as string} selected={prefs.weatherRefreshMinutes === m} onPress={() => updatePrefs({ weatherRefreshMinutes: m as number })} tone="mint" />
          ))}
        </ChipRow>
        <AppText variant="small" muted>
          Weather is fetched only while the app is open. Forecast data by Open-Meteo.com (CC BY 4.0).
        </AppText>
      </Sticker>

      <Sticker style={{ gap: 14 }}>
        <SectionTitle title="Personal style" />
        <SettingsLink icon="star" title="Style profile" subtitle="Favourite & avoided styles and colors, occasions, temperature comfort" onPress={() => router.push('/style-profile')} />
        <SettingsLink icon="undo" title="History & feedback" subtitle="What you wore, past suggestions, likes and dislikes" onPress={() => router.push('/history')} />
      </Sticker>

      <Sticker style={{ gap: 12 }} shape="ticket">
        <SectionTitle title="Morning reminder" />
        <ToggleRow
          label="Daily reminder"
          hint="A local notification that opens Today. It does not fetch weather in the background — weather updates when you open the app."
          value={prefs.reminder.enabled}
          onChange={(v) => setReminder({ ...prefs.reminder, enabled: v })}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: prefs.reminder.enabled ? 1 : 0.5 }}>
          <IconButton icon="arrowLeft" onPress={() => shiftTime(-15)} accessibilityLabel="15 minutes earlier" disabled={!prefs.reminder.enabled} />
          <View
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: borders.bold, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
            accessible
            accessibilityLabel={`Reminder time ${pad(prefs.reminder.hour)}:${pad(prefs.reminder.minute)}`}
          >
            <AppText variant="pixelLarge" style={{ fontSize: 22, lineHeight: 28 }}>
              {`${pad(prefs.reminder.hour)}:${pad(prefs.reminder.minute)}`}
            </AppText>
          </View>
          <IconButton icon="arrowRight" onPress={() => shiftTime(15)} accessibilityLabel="15 minutes later" disabled={!prefs.reminder.enabled} />
        </View>
      </Sticker>

      <Sticker style={{ gap: 12 }}>
        <SectionTitle title="Your data" />
        <AppText variant="small" muted>
          Everything lives on this phone. A backup is one file with your items, photos, outfits, albums and preferences. App storage is not a backup — export regularly.
        </AppText>
        <Button label="Export backup" icon="album" onPress={doExport} loading={busy === 'export'} />
        <Button label="Restore from backup" icon="refresh" variant="ghost" onPress={doRestore} loading={busy === 'restore'} />
        <Button label="Delete all data" icon="trash" variant="danger" onPress={doDeleteAll} />
      </Sticker>

      <Sticker tone="alt" lift={0} style={{ gap: 8 }}>
        <SectionTitle title="Privacy" />
        <AppText variant="small">• Photos and wardrobe data never leave this phone unless you export them.</AppText>
        <AppText variant="small">• Only an approximate location (about 1 km) is sent to Open-Meteo to get the forecast. No account, no tracking, no ads.</AppText>
        <AppText variant="small">• Recommendations are computed on the phone with local rules — no AI service.</AppText>
        <AppText variant="caption" muted style={{ marginTop: 6 }}>
          Wardgo {Constants.expoConfig?.version ?? ''} · pixel art & icons are original to this project · fonts: Archivo Black, DM Sans, Silkscreen (SIL Open Font License)
        </AppText>
      </Sticker>
    </Screen>
  );
}

function SettingsLink({ icon, title, subtitle, onPress }: { icon: 'pin' | 'star' | 'undo'; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.highlight, borderWidth: borders.thin, borderColor: colors.border, borderRadius: 999 }}>
        <PixelIcon name={icon} size={24} color={colors.onHighlight} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" muted>
          {subtitle}
        </AppText>
      </View>
      <PixelIcon name="arrowRight" size={12} color={colors.text} />
    </Pressable>
  );
}
