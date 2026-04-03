import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PRESETS_BY_ITEM_ID } from '../../data/bowlConfigurations';
import {
  BOWL_BUILDER_STEPS,
  BREAKFAST_CUSTOMIZE_STEPS,
  getBreakfastFamilyFromItemId,
  resolveBreakfastPriceFromFruitSelections,
  type BuilderStep,
  type FoodItem,
  type MenuCategoryData,
} from '../../data/menuData';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { menuService } from '../../services/menuService';
import { posService } from '../../services/posService';
import { POS_TAX_RATE } from '../../constants/business';
import { CategoryRail } from './counter-billing/CategoryRail';
import { ItemGrid } from './counter-billing/ItemGrid';
import { ItemCustomizer } from './counter-billing/ItemCustomizer';
import { CartPanel } from './counter-billing/CartPanel';
import { PaymentPanel } from './counter-billing/PaymentPanel';
import { ReceiptView } from './counter-billing/ReceiptView';
import type { CounterPaymentMethod, OrderItemSelection } from '../../types/platform';
import type { PosCartLine, PosReceipt } from '../../types/pos';

type SupportedCategorySlug = 'signature-bowls' | 'breakfast-bowls' | 'high-protein-cups' | 'salad-bowls' | 'kids-meal' | 'drinks-juices';
type TipOption = 'none' | '5' | '10' | '15' | 'custom';

interface CustomizerState {
  item: FoodItem;
  selections: Record<string, string[]>;
  quantity: number;
  categoryName: string;
}

const CATEGORY_ICON: Record<SupportedCategorySlug, string> = {
  'signature-bowls': 'B',
  'breakfast-bowls': 'S',
  'high-protein-cups': 'P',
  'salad-bowls': 'L',
  'kids-meal': 'K',
  'drinks-juices': 'D',
};

const SUPPORTED_CATEGORY_SLUGS: SupportedCategorySlug[] = [
  'signature-bowls',
  'breakfast-bowls',
  'high-protein-cups',
  'salad-bowls',
  'kids-meal',
  'drinks-juices',
];

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizePhoneInput = (value: string) => value.replace(/\D/g, '').slice(0, 10);

function mapSelectionsToLabels(selections: Record<string, string[]>, steps: BuilderStep[]): OrderItemSelection[] {
  const stepById = Object.fromEntries(steps.map((step) => [step.id, step]));
  return Object.entries(selections)
    .map(([stepId, selectedIds]) => ({
      section: stepById[stepId]?.title ?? stepId,
      choices: selectedIds.map((id) => stepById[stepId]?.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id),
    }))
    .filter((entry) => entry.choices.length > 0);
}

function mapSelectionLabelsToIds(selections: OrderItemSelection[], steps: BuilderStep[]) {
  const stepByTitle = new Map(steps.map((step) => [step.title.toLowerCase(), step]));
  const nextSelections: Record<string, string[]> = {};

  for (const selection of selections) {
    const step = stepByTitle.get(selection.section.toLowerCase());
    if (!step) continue;
    const ids = selection.choices
      .map((choice) => step.ingredients.find((ingredient) => ingredient.name === choice)?.id)
      .filter((value): value is string => Boolean(value));
    nextSelections[step.id] = ids;
  }

  return nextSelections;
}

function getCustomizeSteps(itemId: string) {
  const preset = PRESETS_BY_ITEM_ID[itemId];
  if (!preset) return [] as BuilderStep[];
  if (preset.mode === 'breakfast') return BREAKFAST_CUSTOMIZE_STEPS;
  return BOWL_BUILDER_STEPS;
}

function calculateUnitPrice(item: FoodItem, selections: Record<string, string[]>) {
  const preset = PRESETS_BY_ITEM_ID[item.id];
  if (!preset) return item.price;

  const steps = getCustomizeSteps(item.id);
  const extras = steps.flatMap((step) => {
    const selectedIds = selections[step.id] ?? [];
    return step.ingredients.filter((ingredient) => selectedIds.includes(ingredient.id));
  });

  let basePrice = preset.basePrice;
  if (preset.mode === 'breakfast') {
    const family = getBreakfastFamilyFromItemId(item.id);
    if (family) {
      basePrice = resolveBreakfastPriceFromFruitSelections(family, selections.fruits ?? []).basePrice;
    }
  }

  const extrasPrice = extras.reduce((sum, ingredient) => sum + ingredient.price, 0);
  return basePrice + extrasPrice;
}

export function CounterBillingScreen() {
  const { createCounterWalkInOrder } = useAuth();
  const { activeStoreScope, permissions } = useAdminDashboard();
  const { touchActivity } = useStoreSession();

  const [activeCategorySlug, setActiveCategorySlug] = useState<SupportedCategorySlug>('signature-bowls');
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState<MenuCategoryData[]>([]);
  const [cartLines, setCartLines] = useState<PosCartLine[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneSkipped, setPhoneSkipped] = useState(false);
  const [selectedTipOption, setSelectedTipOption] = useState<TipOption>('none');
  const [customTipInput, setCustomTipInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customizer, setCustomizer] = useState<CustomizerState | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [customizerError, setCustomizerError] = useState('');
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'warning' | 'error'; text: string }>({
    tone: 'info',
    text: '',
  });

  useEffect(() => {
    if (!activeStoreScope || activeStoreScope === 'all') {
      setMenuLoaded(false);
      setMenuCatalog([]);
      return;
    }

    setMenuLoaded(false);
    void menuService
      .getMenuByStore(activeStoreScope)
      .then((catalog) => {
        setMenuCatalog(catalog);
        const firstSupported = catalog.find((entry) => SUPPORTED_CATEGORY_SLUGS.includes(entry.slug as SupportedCategorySlug));
        if (firstSupported) {
          setActiveCategorySlug(firstSupported.slug as SupportedCategorySlug);
        }
      })
      .finally(() => setMenuLoaded(true));
  }, [activeStoreScope]);

  useEffect(() => {
    const onActivity = () => {
      void touchActivity();
    };

    document.addEventListener('click', onActivity);
    document.addEventListener('keydown', onActivity);

    return () => {
      document.removeEventListener('click', onActivity);
      document.removeEventListener('keydown', onActivity);
    };
  }, [touchActivity]);

  const categoryList = useMemo(() => {
    return SUPPORTED_CATEGORY_SLUGS.map((slug) => {
      const category = menuCatalog.find((entry) => entry.slug === slug);
      return {
        slug,
        name: category?.name ?? slug,
        icon: CATEGORY_ICON[slug] ?? (category?.name?.slice(0, 1).toUpperCase() || 'M'),
        itemCount: category?.items.length ?? 0,
      };
    }).filter((entry) => entry.itemCount > 0);
  }, [menuCatalog]);

  const activeCategory = menuCatalog.find((entry) => entry.slug === activeCategorySlug) ?? null;
  const activeItems = activeCategory?.items ?? [];

  const subtotal = useMemo(() => cartLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [cartLines]);
  const discountAmount = 0;
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = useMemo(() => Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100, [taxableSubtotal]);
  const tipPercentage = selectedTipOption === 'custom' || selectedTipOption === 'none' ? 0 : Number(selectedTipOption);
  const parsedCustomTip = Number(customTipInput || 0);
  const customTipAmount = selectedTipOption === 'custom' && Number.isFinite(parsedCustomTip) ? Math.max(0, parsedCustomTip) : 0;
  const tipAmount = useMemo(
    () => (selectedTipOption === 'custom'
      ? Math.round(customTipAmount * 100) / 100
      : Math.round(taxableSubtotal * (tipPercentage / 100) * 100) / 100),
    [selectedTipOption, customTipAmount, taxableSubtotal, tipPercentage],
  );
  const total = taxableSubtotal + taxAmount + tipAmount;

  const canCharge = Boolean(
    activeStoreScope !== 'all'
      && cartLines.length > 0
      && paymentMethod
      && (phoneSkipped || normalizePhoneInput(customerPhone).length === 10)
      && !isSubmitting,
  );

  const addItemToCart = (item: FoodItem) => {
    void touchActivity();
    const unitPrice = item.price;
    setCartLines((previous) => [
      ...previous,
      {
        id: createId('line'),
        itemId: item.id,
        title: item.name,
        category: activeCategory?.name ?? 'POS',
        quantity: 1,
        unitPrice,
        selections: [],
      },
    ]);
  };

  const openCustomizer = (item: FoodItem) => {
    const steps = getCustomizeSteps(item.id);
    if (steps.length === 0) {
      addItemToCart(item);
      return;
    }

    const preset = PRESETS_BY_ITEM_ID[item.id];
    setCustomizer({
      item,
      quantity: 1,
      selections: preset?.defaultSelections ?? {},
      categoryName: activeCategory?.name ?? 'POS',
    });
    setEditingLineId(null);
    setCustomizerError('');
  };

  const editCartLine = (lineId: string) => {
    void touchActivity();
    const line = cartLines.find((entry) => entry.id === lineId);
    if (!line) return;

    const menuCategory = menuCatalog.find((entry) => entry.items.some((item) => item.id === line.itemId));
    const item = menuCategory?.items.find((entry) => entry.id === line.itemId);

    if (!item) {
      setMessage({ tone: 'warning', text: 'This item cannot be edited because it is no longer in the current menu.' });
      return;
    }

    if (menuCategory && SUPPORTED_CATEGORY_SLUGS.includes(menuCategory.slug as SupportedCategorySlug)) {
      setActiveCategorySlug(menuCategory.slug as SupportedCategorySlug);
    }

    const steps = getCustomizeSteps(item.id);
    setCustomizer({
      item,
      quantity: line.quantity,
      selections: mapSelectionLabelsToIds(line.selections, steps),
      categoryName: line.category,
    });
    setEditingLineId(line.id);
    setCustomizerError('');
  };

  const updateCustomizerChoice = (step: BuilderStep, ingredientId: string) => {
    void touchActivity();
    setCustomizer((current) => {
      if (!current) return current;
      const currentChoices = current.selections[step.id] ?? [];
      const nextChoices = step.type === 'single'
        ? (currentChoices[0] === ingredientId ? [] : [ingredientId])
        : (currentChoices.includes(ingredientId)
          ? currentChoices.filter((id) => id !== ingredientId)
          : [...currentChoices, ingredientId]);

      return {
        ...current,
        selections: {
          ...current.selections,
          [step.id]: nextChoices,
        },
      };
    });
  };

  const addCustomizedToCart = () => {
    void touchActivity();
    if (!customizer) return;
    const steps = getCustomizeSteps(customizer.item.id);

    const missingRequired = steps.find((step) => step.required && (customizer.selections[step.id] ?? []).length === 0);
    if (missingRequired) {
      setCustomizerError(`Please select ${missingRequired.title.toLowerCase()} before adding to cart.`);
      return;
    }

    const unitPrice = calculateUnitPrice(customizer.item, customizer.selections);
    const selections = mapSelectionsToLabels(customizer.selections, steps);

    setCartLines((previous) => {
      const nextLine: PosCartLine = {
        id: editingLineId ?? createId('line'),
        itemId: customizer.item.id,
        title: customizer.item.name,
        category: customizer.categoryName,
        quantity: customizer.quantity,
        unitPrice,
        selections,
      };

      if (!editingLineId) {
        return [...previous, nextLine];
      }

      return previous.map((line) => (line.id === editingLineId ? nextLine : line));
    });

    setCustomizer(null);
    setEditingLineId(null);
    setCustomizerError('');
  };

  const closeCustomizer = () => {
    setCustomizer(null);
    setEditingLineId(null);
    setCustomizerError('');
  };

  const incrementLine = (lineId: string) => {
    void touchActivity();
    setCartLines((previous) => previous.map((line) => (line.id === lineId ? { ...line, quantity: line.quantity + 1 } : line)));
  };

  const decrementLine = (lineId: string) => {
    void touchActivity();
    setCartLines((previous) => previous
      .map((line) => (line.id === lineId ? { ...line, quantity: Math.max(1, line.quantity - 1) } : line))
      .filter((line) => line.quantity > 0));
  };

  const removeLine = (lineId: string) => {
    void touchActivity();
    setCartLines((previous) => previous.filter((line) => line.id !== lineId));
  };

  const toggleSkipPhone = () => {
    setPhoneSkipped((previous) => !previous);
    setCustomerPhone('');
  };

  const handleCharge = async () => {
    void touchActivity();
    if (!canCharge || !paymentMethod || activeStoreScope === 'all') {
      setMessage({ tone: 'error', text: 'Complete cart, phone, and payment details before charging.' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ tone: 'info', text: 'Creating order and recording payment...' });

    try {
      const receiptResult = await posService.createOrder({
        storeId: activeStoreScope,
        orderChannel: 'in_store',
        customerName: customerName.trim() || undefined,
        customerPhone: normalizePhoneInput(customerPhone),
        paymentMethod,
        tipPercentage,
        tipAmount,
        placedBy: permissions.canManageEmployees ? 'manager-session' : 'staff-session',
        items: cartLines.map((line) => ({
          itemId: line.itemId,
          title: line.title,
          category: line.category,
          quantity: line.quantity,
          price: line.unitPrice,
          selections: line.selections,
        })),
      }, {
        createCounterWalkInOrder,
      });

      await posService.recordPayment({
        orderId: receiptResult.orderId,
        paymentMethod,
        amount: receiptResult.total,
        recordedBy: permissions.canManageEmployees ? 'manager-session' : 'staff-session',
      });

      setReceipt(receiptResult);
      setCartLines([]);
      setSelectedTipOption('none');
      setCustomTipInput('');
      setPaymentMethod(null);
      setMessage({ tone: 'success', text: `Order ${receiptResult.orderId} placed successfully.` });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Network error while charging. Please retry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForNewOrder = () => {
    setReceipt(null);
    setCustomerName('');
    setCustomerPhone('');
    setPhoneSkipped(false);
    setMessage({ tone: 'info', text: 'Ready for next order.' });
  };

  if (activeStoreScope === 'all') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        Select a specific store in the admin header before using Counter Billing.
      </div>
    );
  }

  if (!permissions.canAccessPos) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        Your role does not have access to POS.
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="grid min-h-[calc(100vh-180px)] gap-4 xl:grid-cols-[220px_minmax(0,1fr)_380px]">
        <CategoryRail
          categories={categoryList}
          activeCategorySlug={activeCategorySlug}
          onSelect={(slug) => setActiveCategorySlug(slug as SupportedCategorySlug)}
        />

        <section className="rounded-2xl border border-border bg-background p-4">
          {!menuLoaded ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-foreground/60">
              Loading menu...
            </div>
          ) : customizer ? (
            <ItemCustomizer
              item={customizer.item}
              steps={getCustomizeSteps(customizer.item.id)}
              selections={customizer.selections}
              quantity={customizer.quantity}
              totalPrice={calculateUnitPrice(customizer.item, customizer.selections) * customizer.quantity}
              validationError={customizerError}
              onBack={closeCustomizer}
              onToggleChoice={updateCustomizerChoice}
              onQuantityChange={(delta) => setCustomizer((current) => (current ? { ...current, quantity: Math.max(1, current.quantity + delta) } : current))}
              onAddToCart={addCustomizedToCart}
              submitLabel={editingLineId ? 'Update Item' : 'Add to Cart'}
            />
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">{activeCategory?.name}</h2>
                <p className="text-sm text-foreground/60">Tap Add for quick billing or Customize for configurable bowls.</p>
              </div>

              <ItemGrid
                items={activeItems}
                onAdd={addItemToCart}
                onCustomize={openCustomizer}
              />
            </>
          )}
        </section>

        <div className="space-y-3">
          {receipt ? (
            <ReceiptView receipt={receipt} onNewOrder={resetForNewOrder} />
          ) : null}

          <CartPanel
            cartLines={cartLines}
            subtotal={subtotal}
            taxAmount={taxAmount}
            tipAmount={tipAmount}
            total={total}
            selectedPaymentMethod={paymentMethod}
            customerPhone={customerPhone}
            customerName={customerName}
            phoneSkipped={phoneSkipped}
            selectedTipOption={selectedTipOption}
            customTipInput={customTipInput}
            isSubmitting={isSubmitting}
            canSubmit={canCharge}
            onSelectTipOption={setSelectedTipOption}
            onSetCustomTipInput={setCustomTipInput}
            onPhoneChange={(value) => setCustomerPhone(normalizePhoneInput(value))}
            onNameChange={setCustomerName}
            onToggleSkipPhone={toggleSkipPhone}
            onSelectPaymentMethod={setPaymentMethod}
            onIncrementLine={incrementLine}
            onDecrementLine={decrementLine}
            onEditLine={editCartLine}
            onRemoveLine={removeLine}
            onCharge={() => {
              void handleCharge();
            }}
          />

          {message.text.trim() ? <PaymentPanel message={message.text} tone={message.tone} /> : null}
        </div>
      </div>
    </motion.div>
  );
}
