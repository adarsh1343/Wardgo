import { router, useLocalSearchParams } from 'expo-router';
import { createItem } from '../../database/repositories/items';
import { useApp } from '../../features/app/AppState';
import { EMPTY_INPUT, ItemForm } from '../../features/wardrobe/ItemForm';
import type { Category } from '../../types/models';

export default function NewItemScreen() {
  const { db, notifyDataChanged } = useApp();
  const params = useLocalSearchParams<{ source?: string; category?: string }>();
  const source = params.source === 'camera' || params.source === 'library' ? params.source : undefined;
  const category = (['top', 'bottom', 'footwear', 'accessory'] as Category[]).find((c) => c === params.category) ?? 'top';

  return (
    <ItemForm
      initial={{ ...EMPTY_INPUT, category }}
      initialImages={[]}
      autoLaunch={source}
      submitLabel="Add to wardrobe"
      onSubmit={async (input, images) => {
        const id = await createItem(db, input, images);
        notifyDataChanged();
        router.replace(`/item/${id}`);
      }}
    />
  );
}
