import { Search } from 'lucide-react';
import type { InventoryItem } from '../../types/admin';
import { StatusBadge } from './StatusBadge';

interface InventoryRowProps {
  item: InventoryItem;
  storeName?: string;
  onAdd: () => void;
  onReduce: () => void;
  onMarkOut: () => void;
  onThresholdChange: (value: number) => void;
}

export function InventoryRow({ item, storeName, onAdd, onReduce, onMarkOut, onThresholdChange }: InventoryRowProps) {
  const lastUpdated = new Date(item.updatedAt).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-[24px] border border-primary/12 bg-white/90 p-4 shadow-[0_14px_36px_rgba(45,80,22,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">{item.name}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-sm text-foreground/58">Category: {item.category}{storeName ? ` · ${storeName}` : ''} · Last Updated: {lastUpdated}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{item.quantity} <span className="text-base font-medium text-foreground/54">{item.unit}</span></p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-foreground/46">Low stock at {item.threshold} {item.unit}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex items-center gap-2 text-sm text-foreground/64">
          <Search className="h-4 w-4 text-foreground/40" />
          Threshold
          <input type="number" min={0} value={item.threshold} onChange={(event) => onThresholdChange(Number(event.target.value))} className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
        </label>
        <div className="grid gap-2 sm:grid-cols-3 md:flex">
          <button type="button" onClick={onAdd} className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/74">Add stock</button>
          <button type="button" onClick={onReduce} className="rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/74">Reduce stock</button>
          <button type="button" onClick={onMarkOut} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Mark out of stock</button>
        </div>
      </div>
    </div>
  );
}