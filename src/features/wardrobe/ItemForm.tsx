import { router } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { Chip, ChipRow, PixelTag } from '../../components/Chip';
import { Banner, PipMeter } from '../../components/Feedback';
import { Field } from '../../components/Field';
import { ItemPhoto } from '../../components/ItemPhoto';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { Screen, SectionTitle } from '../../components/Screen';
import type { ImageInput, ItemInput } from '../../database/repositories/items';
import {
  CATEGORIES,
  COLORS,
  FORMALITY_LABELS,
  getColor,
  getSubcategory,
  PATTERNS,
  SEASONS,
  STYLE_TAGS,
  SUBCATEGORIES,
  WARMTH_LABELS,
} from '../../engine/catalog';
import { deleteImageFiles, importPhoto } from '../../services/storage/images';
import { choosePhoto, takePhoto } from '../../services/storage/pickPhoto';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, radii } from '../../theme/tokens';
import type { Category, Formality, RainSuitability, Season, Warmth } from '../../types/models';

export const EMPTY_INPUT: ItemInput = {
  name: '',
  category: 'top',
  subcategory: '',
  primaryColor: '',
  secondaryColors: [],
  pattern: 'solid',
  material: '',
  seasons: [],
  formality: 2,
  styleTags: [],
  warmth: 2,
  rain: 'ok',
  notes: '',
  favorite: false,
  available: true,
};

interface ItemFormProps {
  initial: ItemInput;
  initialImages: ImageInput[];
  autoLaunch?: 'camera' | 'library';
  submitLabel: string;
  onSubmit: (input: ItemInput, images: ImageInput[]) => Promise<void>;
}

export function ItemForm({ initial, initialImages, autoLaunch, submitLabel, onSubmit }: ItemFormProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState<ItemInput>(initial);
  const [images, setImages] = useState<ImageInput[]>(initialImages);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ warmth: false, formality: false, rain: false, name: initial.name.length > 0 });
  // Photos imported in this session that are not yet saved (deleted on cancel).
  const pending = useRef<Set<string>>(new Set());
  const committed = useRef(false);
  const launched = useRef(false);

  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Clean up unsaved photos if the user leaves without saving.
  const imagesRef = useRef(images);
  useLayoutEffect(() => {
    imagesRef.current = images;
  });
  useEffect(
    () => () => {
      if (!committed.current) deleteImageFiles(imagesRef.current.filter((i) => pending.current.has(i.fileName)));
    },
    [],
  );

  const addPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    const res = source === 'camera' ? await takePhoto() : await choosePhoto();
    if (!res.ok) {
      if (res.reason !== 'canceled') setError(res.message ?? 'Could not get a photo.');
      return;
    }
    setImporting(true);
    try {
      const stored = await importPhoto(res.asset);
      pending.current.add(stored.fileName);
      setImages((prev) => [...prev, stored]);
    } catch {
      setError('That photo could not be saved. Try another one.');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (autoLaunch && !launched.current) {
      launched.current = true;
      addPhoto(autoLaunch);
    }
  }, [autoLaunch]);

  const pickSub = (key: string) => {
    const def = getSubcategory(key);
    if (!def) return;
    setInput((p) => {
      const next: ItemInput = { ...p, subcategory: key };
      if (!touched.warmth) next.warmth = def.warmth;
      if (!touched.formality) next.formality = def.formality;
      if (!touched.rain) next.rain = def.rain;
      if (!touched.name) {
        const color = getColor(p.primaryColor)?.label;
        next.name = color ? `${color} ${def.label.toLowerCase()}` : def.label;
      }
      return next;
    });
  };

  const pickColor = (key: string) => {
    setInput((p) => {
      const next = { ...p, primaryColor: key, secondaryColors: p.secondaryColors.filter((c) => c !== key) };
      const def = getSubcategory(p.subcategory);
      if (!touched.name && def) next.name = `${getColor(key)?.label ?? ''} ${def.label.toLowerCase()}`.trim();
      return next;
    });
  };

  const movePrimary = (idx: number) => {
    setImages((prev) => {
      const copy = [...prev];
      const [img] = copy.splice(idx, 1);
      return img ? [img, ...copy] : prev;
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const img = prev[idx];
      if (img && pending.current.has(img.fileName)) {
        deleteImageFiles([img]);
        pending.current.delete(img.fileName);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const submit = async () => {
    if (!input.subcategory) return setError('Pick a type (e.g. T-shirt, Jeans, Sneakers).');
    if (!input.primaryColor) return setError('Pick the main color.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...input, name: input.name.trim() || getSubcategory(input.subcategory)?.label || 'Untitled piece' }, images);
      committed.current = true;
      pending.current.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const subs = SUBCATEGORIES.filter((s) => s.category === input.category);

  return (
    <Screen
      topInset={false}
      footer={
        <View style={{ padding: 16, paddingBottom: 28, borderTopWidth: borders.bold, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', gap: 10 }}>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label={submitLabel} icon="check" onPress={submit} loading={saving} disabled={importing} style={{ flex: 2 }} />
        </View>
      }
    >
      {error ? <Banner text={error} tone="error" onDismiss={() => setError(null)} /> : null}

      <SectionTitle title="Photos" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16, paddingBottom: 6 }}>
        {images.map((img, idx) => (
          <View key={img.fileName} style={{ width: 132 }}>
            <View style={{ borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.soft, overflow: 'hidden' }}>
              <ItemPhoto item={null} fileName={img.thumbFileName ?? img.fileName} style={{ width: 128, height: 160 }} label={`Photo ${idx + 1}`} />
              {idx === 0 ? (
                <View style={{ position: 'absolute', left: 6, top: 6 }}>
                  <PixelTag label="Main" />
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {idx > 0 ? (
                <IconButton icon="star" onPress={() => movePrimary(idx)} accessibilityLabel={`Make photo ${idx + 1} the main photo`} />
              ) : null}
              <IconButton icon="trash" onPress={() => removeImage(idx)} accessibilityLabel={`Remove photo ${idx + 1}`} />
            </View>
          </View>
        ))}
        <View style={{ gap: 10, justifyContent: 'center' }}>
          <PhotoAddButton icon="camera" label="Camera" onPress={() => addPhoto('camera')} disabled={importing} />
          <PhotoAddButton icon="gallery" label="Library" onPress={() => addPhoto('library')} disabled={importing} />
        </View>
      </ScrollView>
      {importing ? <AppText variant="pixel">SAVING PHOTO…</AppText> : null}

      <SectionTitle title="What is it?" />
      <ChipRow>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={c.plural}
            icon={c.key}
            selected={input.category === c.key}
            onPress={() => setInput((p) => ({ ...p, category: c.key as Category, subcategory: p.category === c.key ? p.subcategory : '' }))}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {subs.map((s) => (
          <Chip key={s.key} label={s.label} selected={input.subcategory === s.key} onPress={() => pickSub(s.key)} tone="secondary" />
        ))}
      </ChipRow>

      <Field
        label="Name"
        value={input.name}
        onChangeText={(v) => {
          setTouched((t) => ({ ...t, name: true }));
          set('name', v);
        }}
        placeholder="e.g. Grey slim jeans"
        maxLength={60}
      />

      <SectionTitle title="Main color" />
      <ChipRow>
        {COLORS.map((c) => (
          <Chip key={c.key} label={c.label} swatch={c.hex} selected={input.primaryColor === c.key} onPress={() => pickColor(c.key)} />
        ))}
      </ChipRow>
      <AppText variant="bodyStrong">Other colors (optional)</AppText>
      <ChipRow>
        {COLORS.filter((c) => c.key !== input.primaryColor).map((c) => (
          <Chip key={c.key} label={c.label} swatch={c.hex} selected={input.secondaryColors.includes(c.key)} onPress={() => set('secondaryColors', toggleIn(input.secondaryColors, c.key))} tone="mint" />
        ))}
      </ChipRow>

      <SectionTitle title="Pattern" />
      <ChipRow>
        {PATTERNS.map((p) => (
          <Chip key={p.key} label={p.label} selected={input.pattern === p.key} onPress={() => set('pattern', p.key)} tone="highlight" />
        ))}
      </ChipRow>

      <Field label="Material (optional)" value={input.material} onChangeText={(v) => set('material', v)} placeholder="e.g. cotton, wool, leather" maxLength={40} />

      <SectionTitle title="Fit for the weather" />
      <PipMeter
        label="Warmth"
        value={input.warmth}
        valueLabel={WARMTH_LABELS[input.warmth]}
        tone="secondary"
        onChange={(v) => {
          setTouched((t) => ({ ...t, warmth: true }));
          set('warmth', v as Warmth);
        }}
      />
      <AppText variant="bodyStrong">Rain</AppText>
      <ChipRow>
        {(
          [
            ['no', 'Avoid rain'],
            ['ok', 'Fine in drizzle'],
            ['waterproof', 'Waterproof'],
          ] as [RainSuitability, string][]
        ).map(([k, label]) => (
          <Chip
            key={k}
            label={label}
            icon="drop"
            selected={input.rain === k}
            onPress={() => {
              setTouched((t) => ({ ...t, rain: true }));
              set('rain', k);
            }}
          />
        ))}
      </ChipRow>
      <AppText variant="bodyStrong">Seasons (leave empty for all-season)</AppText>
      <ChipRow>
        {SEASONS.map((s) => (
          <Chip key={s.key} label={s.label} selected={input.seasons.includes(s.key)} onPress={() => set('seasons', toggleIn<Season>(input.seasons, s.key))} tone="mint" />
        ))}
      </ChipRow>

      <SectionTitle title="Style" />
      <PipMeter
        label="Formality"
        value={input.formality}
        valueLabel={FORMALITY_LABELS[input.formality]}
        onChange={(v) => {
          setTouched((t) => ({ ...t, formality: true }));
          set('formality', v as Formality);
        }}
      />
      <ChipRow>
        {STYLE_TAGS.map((s) => (
          <Chip key={s} label={s} selected={input.styleTags.includes(s)} onPress={() => set('styleTags', toggleIn(input.styleTags, s))} tone="secondary" />
        ))}
      </ChipRow>

      <Field label="Notes (optional)" value={input.notes} onChangeText={(v) => set('notes', v)} multiline maxLength={500} placeholder="Fit, care, where you bought it…" />

      <ToggleRow label="Favorite" hint="Favorites get a small boost in recommendations." value={input.favorite} onChange={(v) => set('favorite', v)} />
      <ToggleRow label="Available to wear" hint="Turn off while it is in the laundry, lent out or packed away." value={input.available} onChange={(v) => set('available', v)} />
    </Screen>
  );
}

function PhotoAddButton({ icon, label, onPress, disabled }: { icon: 'camera' | 'gallery'; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={icon === 'camera' ? 'Take a photo' : 'Choose a photo from your library'}
      style={({ pressed }) => ({
        width: 120,
        height: 72,
        borderWidth: borders.bold,
        borderStyle: 'dashed',
        borderColor: colors.border,
        borderRadius: radii.sharp,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
      })}
    >
      <PixelIcon name={icon} size={24} color={colors.text} />
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="small" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.sunk }} accessibilityLabel={label} accessibilityHint={hint} />
    </View>
  );
}
