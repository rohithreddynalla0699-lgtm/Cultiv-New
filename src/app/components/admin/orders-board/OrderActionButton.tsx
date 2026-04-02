interface OrderActionButtonProps {
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function OrderActionButton({ label, isLoading, disabled, onClick }: OrderActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {isLoading ? 'Updating...' : label}
    </button>
  );
}
