import type { PosMenuCategory } from '../../../types/pos';

interface CategoryRailProps {
  categories: PosMenuCategory[];
  activeCategorySlug: string;
  onSelect: (slug: string) => void;
}

export function CategoryRail({ categories, activeCategorySlug, onSelect }: CategoryRailProps) {
  return (
    <aside className="h-full rounded-2xl border border-border bg-background p-3">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">Categories</p>
      <div className="max-h-[calc(100vh-230px)] space-y-1 overflow-y-auto pr-1">
        {categories.map((category) => {
          const active = category.slug === activeCategorySlug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => onSelect(category.slug)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground/80'}`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-foreground/60'}`}>
                {category.itemCount}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
