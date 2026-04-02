import type { FoodItem } from '../../../data/menuData';

interface ItemCardProps {
  item: FoodItem;
  isUnavailable: boolean;
  hasCustomization: boolean;
  onAdd: () => void;
  onCustomize: () => void;
}

export function ItemCard({ item, isUnavailable, hasCustomization, onAdd, onCustomize }: ItemCardProps) {
  return (
    <article className={`rounded-xl border p-3 shadow-sm ${isUnavailable ? 'border-red-200 bg-red-50/40' : 'border-border bg-background'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
          <p className="mt-1 text-xs text-foreground/60">Rs {item.price}</p>
        </div>
        {isUnavailable ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-700">Unavailable</span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={isUnavailable}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add
        </button>
        {hasCustomization ? (
          <button
            type="button"
            onClick={onCustomize}
            disabled={isUnavailable}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/75 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Customize
          </button>
        ) : null}
      </div>
    </article>
  );
}
