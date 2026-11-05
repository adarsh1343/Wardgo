import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, useWindowDimensions, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { PixelTag } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { PromptSheet, Sheet } from '../../components/Sheet';
import { addOutfitsToAlbum, deleteAlbum, getAlbum, removeOutfitFromAlbum, updateAlbum } from '../../database/repositories/albums';
import { listItems } from '../../database/repositories/items';
import { listOutfits } from '../../database/repositories/outfits';
import { useApp, useLiveQuery } from '../../features/app/AppState';
import { OutfitCard } from '../../features/outfits/OutfitCard';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, notifyDataChanged } = useApp();
  const { width } = useWindowDimensions();
  const [editOpen, setEditOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [manage, setManage] = useState(false);
  const { data } = useLiveQuery(
    async (d) => {
      const album = await getAlbum(d, id);
      if (!album) return null;
      const [outfits, items] = await Promise.all([listOutfits(d), listItems(d)]);
      return { album, outfits, items };
    },
    [id],
  );
  const itemsById = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);

  if (data === null) {
    return (
      <Screen topInset={false}>
        <EmptyState title="Album not found" body="It may have been deleted." action={<Button label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (!data) return null;
  const { album, outfits } = data;
  const byId = new Map(outfits.map((o) => [o.id, o]));
  const inAlbum = album.outfitIds.map((oid) => byId.get(oid)).filter((o): o is NonNullable<typeof o> => !!o);
  const candidates = outfits.filter((o) => !album.outfitIds.includes(o.id));
  const cardW = Math.floor((Math.min(width, 700) - 32 - 14) / 2);
  const changed = async () => notifyDataChanged();

  return (
    <View style={{ flex: 1 }}>
      <Screen topInset={false}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PixelTag label="Album" tone="mint" />
            <PixelTag label={`${inAlbum.length} fits`} tone="surface" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {album.name}
            </AppText>
            <IconButton icon="pencil" onPress={() => setEditOpen(true)} accessibilityLabel="Rename album or edit description" />
          </View>
          {album.description ? (
            <AppText variant="body" muted>
              {album.description}
            </AppText>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            label="Add outfits"
            icon="plus"
            onPress={() => {
              setPicked([]);
              setPickOpen(true);
            }}
            size="sm"
          />
          {inAlbum.length > 0 ? <Button label={manage ? 'Done' : 'Manage'} variant="ghost" size="sm" onPress={() => setManage(!manage)} /> : null}
        </View>

        {inAlbum.length === 0 ? (
          <EmptyState
            sprite="emptyAlbum"
            title="This album is empty"
            body={outfits.length ? 'Add some of your saved outfits — they can be in other albums too.' : 'Save an outfit from Today first, then add it here.'}
            action={outfits.length ? <Button label="Add outfits" icon="plus" onPress={() => setPickOpen(true)} /> : <Button label="Go to Today" icon="sun" onPress={() => router.navigate('/')} />}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {inAlbum.map((o, index) => (
              <View key={o.id} style={{ width: cardW }}>
                <OutfitCard outfit={o} itemsById={itemsById} width={cardW} index={index} />
                {manage ? (
                  <View style={{ gap: 6, marginTop: -8 }}>
                    <Button
                      label={album.coverOutfitId === o.id ? 'Cover ✓' : 'Set as cover'}
                      size="sm"
                      variant={album.coverOutfitId === o.id ? 'highlight' : 'ghost'}
                      onPress={async () => {
                        await updateAlbum(db, album.id, { coverOutfitId: o.id });
                        changed();
                      }}
                    />
                    <Button
                      label="Remove"
                      size="sm"
                      variant="ghost"
                      onPress={async () => {
                        await removeOutfitFromAlbum(db, album.id, o.id);
                        changed();
                      }}
                      accessibilityLabel={`Remove ${o.name} from album`}
                      accessibilityHint="The outfit itself is kept"
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <Button
          label="Delete album"
          icon="trash"
          variant="danger"
          onPress={() =>
            Alert.alert(`Delete “${album.name}”?`, 'Only the album is deleted. Its outfits stay in your saved outfits.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete album',
                style: 'destructive',
                onPress: async () => {
                  await deleteAlbum(db, album.id);
                  changed();
                  router.back();
                },
              },
            ])
          }
        />
      </Screen>

      <PromptSheet
        visible={editOpen}
        title="Edit album"
        label="Name"
        initialValue={album.name}
        secondaryLabel="Description"
        initialSecondary={album.description}
        onCancel={() => setEditOpen(false)}
        onSubmit={async (name, description) => {
          setEditOpen(false);
          await updateAlbum(db, album.id, { name, description });
          changed();
        }}
      />

      <Sheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Add outfits"
        footer={
          <Button
            label={picked.length ? `Add ${picked.length}` : 'Select outfits'}
            icon="check"
            disabled={picked.length === 0}
            onPress={async () => {
              await addOutfitsToAlbum(db, album.id, picked);
              setPickOpen(false);
              changed();
            }}
          />
        }
      >
        {candidates.length === 0 ? (
          <AppText variant="body" muted>
            Every saved outfit is already in this album.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {candidates.map((o, index) => (
              <OutfitCard
                key={o.id}
                outfit={o}
                itemsById={itemsById}
                width={Math.floor((Math.min(width, 700) - 32 - 12) / 2)}
                index={index}
                selected={picked.includes(o.id)}
                onPress={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              />
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}
