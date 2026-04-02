import { useEffect, useState } from 'react';

interface OrderNotesDrawerProps {
  orderId?: string;
  initialValue?: string;
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (nextValue: string) => Promise<void> | void;
}

export function OrderNotesDrawer({ orderId, initialValue, isOpen, isSaving, onClose, onSave }: OrderNotesDrawerProps) {
  const [draft, setDraft] = useState(initialValue ?? '');

  useEffect(() => {
    if (isOpen) {
      setDraft(initialValue ?? '');
    }
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30">
      <aside className="h-full w-full max-w-md border-l border-border bg-background p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Order Notes</h3>
          <button type="button" onClick={onClose} className="text-sm font-medium text-foreground/65 hover:text-foreground">
            Close
          </button>
        </div>

        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/52">Order #{orderId}</p>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add instructions, escalation context, or pickup notes."
          rows={10}
          className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary/30 transition focus:ring"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground/75 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onSave(draft);
            }}
            disabled={isSaving}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </aside>
    </div>
  );
}
