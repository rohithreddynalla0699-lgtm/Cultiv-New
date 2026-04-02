import { PRESETS_BY_ITEM_ID } from '../../../data/bowlConfigurations';
import type { FoodItem } from '../../../data/menuData';
import { ItemCard } from './ItemCard';

interface ItemGridProps {
  items: FoodItem[];
  unavailableItemIds?: Set<string>;
  onAdd: (item: FoodItem) => void;
  onCustomize: (item: FoodItem) => void;
}

export function ItemGrid({ items, unavailableItemIds, onAdd, onCustomize }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-foreground/60">
        No items found in this category.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isUnavailable={Boolean(unavailableItemIds?.has(item.id))}
          hasCustomization={Boolean(PRESETS_BY_ITEM_ID[item.id])}
          onAdd={() => onAdd(item)}
          onCustomize={() => onCustomize(item)}
        />
      ))}
    </div>
  );
}
