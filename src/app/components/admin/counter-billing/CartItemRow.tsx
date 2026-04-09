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
    <div className="rounded-[14px] border border-[#E7EDE0] bg-white p-2 shadow-[0_3px_8px_rgba(31,46,18,0.04)]">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#1F2719]">{line.title}</p>
          {line.selections.length > 0 ? (
            <p className="mt-0.5 text-[9px] leading-[1.35] text-[#667085]">
              {line.selections.map((selection) => `${selection.section}: ${selection.choices.join(', ')}`).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="min-h-[24px] rounded-full border border-[#D9E2CD] px-1.5 text-[9px] font-semibold text-primary transition hover:bg-primary/5"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[24px] rounded-full border border-[#F2D6D6] px-1.5 text-[9px] font-semibold text-[#B42318] transition hover:bg-[#FEF3F2]"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[#E1E7D9] bg-[#F8FAF5] p-0.5">
          <button
            type="button"
            onClick={onDecrement}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#1F2719] shadow-sm"
          >
            -
          </button>
          <span className="min-w-5 text-center text-[11px] font-semibold text-[#1F2719]">{line.quantity}</span>
          <button
            type="button"
            onClick={onIncrement}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#1F2719] shadow-sm"
          >
            +
          </button>
        </div>
        <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#1F2719]">
          Rs {(line.unitPrice * line.quantity).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
