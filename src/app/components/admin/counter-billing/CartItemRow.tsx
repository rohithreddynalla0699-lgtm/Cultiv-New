import type { PosCartLine } from '../../../types/pos';

interface CartItemRowProps {
  line: PosCartLine;
  onEdit: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItemRow({ line, onEdit, onIncrement, onDecrement, onRemove }: CartItemRowProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{line.title}</p>
          {line.selections.length > 0 ? (
            <p className="mt-1 text-xs text-foreground/60">
              {line.selections.map((selection) => `${selection.section}: ${selection.choices.join(', ')}`).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">Edit</button>
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-red-700 hover:underline">Remove</button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={onDecrement} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">-</button>
          <span className="min-w-7 text-center text-sm font-semibold">{line.quantity}</span>
          <button type="button" onClick={onIncrement} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">+</button>
        </div>
        <p className="text-sm font-semibold text-foreground">Rs {(line.unitPrice * line.quantity).toFixed(2)}</p>
      </div>
    </div>
  );
}
