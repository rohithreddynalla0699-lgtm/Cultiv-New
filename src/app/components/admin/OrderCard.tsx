import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from './StatusBadge';

interface OrderCardProps {
  orderId: string;
  customerName: string;
  storeName?: string;
  placedTime: string;
  waitingMinutes: number;
  itemsSummary: string[];
  totalPayable: number;
  rewardUsed?: string;
  status: 'new' | 'preparing' | 'ready' | 'picked_up';
  pickupEstimate: string;
  note?: string;
  source?: 'app' | 'walk-in' | 'phone';
  onPrimaryAction?: () => void;
  onNoteSave?: (value: string) => void;
  isTransitioning?: boolean;
}

export function OrderCard({
  orderId,
  customerName,
  storeName,
  placedTime,
  waitingMinutes,
  itemsSummary,
  totalPayable,
  rewardUsed,
  status,
  pickupEstimate,
  note,
  source,
  onPrimaryAction,
  onNoteSave,
  isTransitioning,
}: OrderCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note ?? '');
  const [confirmPickupOpen, setConfirmPickupOpen] = useState(false);

  const displayedItems = useMemo(() => itemsSummary.slice(0, 2), [itemsSummary]);
  const remainingItems = Math.max(itemsSummary.length - displayedItems.length, 0);
  const primaryActionLabel = status === 'new'
    ? 'Start Preparing'
    : status === 'preparing'
      ? 'Mark Ready'
      : status === 'ready'
        ? 'Mark Picked Up'
        : null;
  const urgencyLevel = waitingMinutes >= 12 ? 'urgent' : waitingMinutes >= 8 ? 'attention' : 'normal';
  const cardBorderClass = urgencyLevel === 'urgent'
    ? 'border-[#C94848]'
    : urgencyLevel === 'attention'
      ? 'border-[#D68E2E]'
      : 'border-primary/12';
  const sourceLabel = source === 'walk-in' ? 'Walk-In' : source === 'phone' ? 'Phone' : 'Website';
  const sourceClassName = source === 'walk-in'
    ? 'bg-[#DDF1E8] text-[#1F6A49]'
    : source === 'phone'
      ? 'bg-[#E8EFFD] text-[#244A95]'
      : 'bg-[#ECECE7] text-[#5E5E57]';

  return (
    <article className={`rounded-[22px] border bg-white/92 p-3.5 shadow-[0_12px_30px_rgba(45,80,22,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(45,80,22,0.12)] ${cardBorderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/56">#{orderId.slice(-6)}</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${sourceClassName}`}>
              {sourceLabel}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-foreground">{customerName}</h3>
          <p className="mt-1 text-xs text-foreground/58">
            {placedTime} · Pickup {pickupEstimate}
            {storeName ? ` · ${storeName}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">₹{totalPayable}</p>
          <p className={`mt-1 text-xs font-medium ${urgencyLevel === 'urgent' ? 'text-[#9B2D2D]' : urgencyLevel === 'attention' ? 'text-[#8B5A12]' : 'text-foreground/54'}`}>
            Waiting {waitingMinutes} min
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#F7FAF3] px-3 py-2.5">
        <ul className="space-y-0.5 text-sm leading-5 text-foreground/74">
          {displayedItems.map((item) => <li key={`${orderId}-${item}`}>{item}</li>)}
        </ul>
        {remainingItems > 0 ? <p className="mt-1 text-xs font-medium text-foreground/56">+{remainingItems} more</p> : null}
      </div>

      {rewardUsed ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {rewardUsed}
        </div>
      ) : null}

      <div className="mt-2">
        {!noteOpen ? (
          <button type="button" onClick={() => setNoteOpen(true)} className="text-xs font-medium text-primary hover:underline">
            {note ? 'Edit note' : '+ Add note'}
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-background/72 p-2.5">
            <input
              type="text"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add pickup note"
              className="w-full bg-transparent text-sm outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setNoteOpen(false)} className="text-xs font-medium text-foreground/62">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  onNoteSave?.(noteDraft);
                  setNoteOpen(false);
                }}
                className="rounded-full border border-primary/16 px-3 py-1.5 text-xs font-medium text-primary"
              >
                Save note
              </button>
            </div>
          </div>
        )}
      </div>

      {primaryActionLabel ? (
        <button
          type="button"
          data-testid={`order-action-${orderId}`}
          onClick={() => {
            if (status === 'ready') {
              setConfirmPickupOpen(true);
              return;
            }
            onPrimaryAction?.();
          }}
          disabled={!onPrimaryAction || isTransitioning}
          className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isTransitioning ? 'Updating...' : primaryActionLabel}
        </button>
      ) : null}

      {confirmPickupOpen ? (
        <div className="mt-3 rounded-xl border border-[#E9D0A0] bg-[#FFF9F0] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8B5A12]">Confirm Pickup</p>
          <p className="mt-1 text-sm font-medium text-foreground">{customerName} · #{orderId.slice(-6)}</p>
          <p className="mt-1 text-xs text-foreground/62">₹{totalPayable} · {itemsSummary.length} item lines</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmPickupOpen(false)} className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/70">Cancel</button>
            <button
              type="button"
              onClick={() => {
                setConfirmPickupOpen(false);
                onPrimaryAction?.();
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Confirm Picked Up
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}