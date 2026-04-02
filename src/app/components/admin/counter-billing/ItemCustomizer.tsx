import type { BuilderStep } from '../../../data/menuData';
import type { FoodItem } from '../../../data/menuData';

interface ItemCustomizerProps {
  item: FoodItem;
  steps: BuilderStep[];
  selections: Record<string, string[]>;
  quantity: number;
  totalPrice: number;
  validationError?: string;
  onBack: () => void;
  onToggleChoice: (step: BuilderStep, ingredientId: string) => void;
  onQuantityChange: (delta: number) => void;
  onAddToCart: () => void;
}

export function ItemCustomizer({
  item,
  steps,
  selections,
  quantity,
  totalPrice,
  validationError,
  onBack,
  onToggleChoice,
  onQuantityChange,
  onAddToCart,
}: ItemCustomizerProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/55">Customize Item</p>
          <h3 className="text-base font-semibold text-foreground">{item.name}</h3>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/75">
          Back to Items
        </button>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="rounded-xl border border-border p-3">
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-0.5 text-xs text-foreground/55">{step.subtitle}</p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {step.ingredients.map((ingredient) => {
                const selected = (selections[step.id] ?? []).includes(ingredient.id);
                return (
                  <button
                    key={ingredient.id}
                    type="button"
                    onClick={() => onToggleChoice(step, ingredient.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground/75 hover:bg-muted'}`}
                  >
                    <span className="block">{ingredient.name}</span>
                    <span className="mt-0.5 block text-[11px] text-foreground/55">
                      {ingredient.price > 0 ? `+Rs ${ingredient.price}` : 'Included'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {validationError ? <p className="text-sm font-medium text-red-700">{validationError}</p> : null}

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
        <div className="inline-flex items-center gap-2">
          <button type="button" onClick={() => onQuantityChange(-1)} className="rounded-lg border border-border px-2.5 py-1 text-sm font-semibold">-</button>
          <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
          <button type="button" onClick={() => onQuantityChange(1)} className="rounded-lg border border-border px-2.5 py-1 text-sm font-semibold">+</button>
        </div>
        <button type="button" onClick={onAddToCart} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Add to Cart · Rs {totalPrice.toFixed(2)}
        </button>
      </div>
    </section>
  );
}
