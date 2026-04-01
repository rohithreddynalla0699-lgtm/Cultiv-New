import type { ReactNode } from 'react';

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-[#F5E8C8] text-[#7A5A18] border-[#E7D1A0]',
  preparing: 'bg-[#E6EFE2] text-[#355424] border-[#C8D8BE]',
  ready: 'bg-[#DDF1E8] text-[#1F6A49] border-[#B7DCCB]',
  picked_up: 'bg-[#ECECE7] text-[#5E5E57] border-[#D8D8D1]',
  in_stock: 'bg-[#E6EFE2] text-[#355424] border-[#C8D8BE]',
  low_stock: 'bg-[#F9ECD4] text-[#8B5A12] border-[#E9D0A0]',
  out_of_stock: 'bg-[#F7DDDD] text-[#8B2E2E] border-[#E7B5B5]',
  on_shift: 'bg-[#DDF1E8] text-[#1F6A49] border-[#B7DCCB]',
  off_shift: 'bg-[#ECECE7] text-[#5E5E57] border-[#D8D8D1]',
  active: 'bg-[#DDF1E8] text-[#1F6A49] border-[#B7DCCB]',
  inactive: 'bg-[#F3E4D8] text-[#8A4E20] border-[#E5C8B0]',
};

interface StatusBadgeProps {
  status: string;
  label?: ReactNode;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-background text-foreground/70 border-border'}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}