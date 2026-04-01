import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-primary/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(241,246,236,0.82))] p-5 shadow-[0_18px_48px_rgba(45,80,22,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/58">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
        </div>
        {icon ? <div className="rounded-2xl bg-primary/7 p-3 text-primary">{icon}</div> : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-foreground/60">{hint}</p> : null}
    </div>
  );
}