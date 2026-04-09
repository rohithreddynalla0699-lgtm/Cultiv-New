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
    <article className={`rounded-[18px] border p-2.5 shadow-sm ${isUnavailable ? 'border-red-200 bg-red-50/40' : 'border-border bg-background'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold leading-5 text-foreground">{item.name}</h4>
          <p className="mt-0.5 text-[11px] text-foreground/60">Rs {item.price}</p>
        </div>
        {isUnavailable ? (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">Unavailable</span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onAdd}
          disabled={isUnavailable}
          className="min-h-[34px] rounded-[12px] bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add
        </button>
        {hasCustomization ? (
          <button
            type="button"
            onClick={onCustomize}
            disabled={isUnavailable}
            className="min-h-[34px] rounded-[12px] border border-border px-3 py-1 text-[11px] font-semibold text-foreground/75 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Customize
          </button>
        ) : null}
      </div>
    </article>
  );
}
