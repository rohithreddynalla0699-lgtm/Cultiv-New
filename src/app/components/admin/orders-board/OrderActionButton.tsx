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
      className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(45,80,22,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_14px_24px_rgba(45,80,22,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {isLoading ? 'Updating...' : label}
    </button>
  );
}
