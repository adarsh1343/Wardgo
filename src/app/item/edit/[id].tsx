import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { getItem, updateItem } from '../../../database/repositories/items';
import { useApp, useLiveQuery } from '../../../features/app/AppState';
import { ItemForm } from '../../../features/wardrobe/ItemForm';
import { deleteImageFiles } from '../../../services/storage/images';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, notifyDataChanged } = useApp();
  // Load once: the form owns its state after that.
  const { data: item, loading } = useLiveQuery((d) => getItem(d, id), [id]);

  if (loading && item === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!item) return <EmptyState title="Item not found" body="It may have been deleted." />;

  const { id: _id, createdAt: _c, updatedAt: _u, images, ...input } = item;
  return (
    <ItemForm
      key={item.id}
      initial={input}
      initialImages={images.map((i) => ({ fileName: i.fileName, thumbFileName: i.thumbFileName }))}
      submitLabel="Save changes"
      onSubmit={async (next, nextImages) => {
        const removed = await updateItem(db, item.id, next, nextImages);
        deleteImageFiles(removed); // only after the database change succeeded
        notifyDataChanged();
        router.back();
      }}
    />
  );
}
