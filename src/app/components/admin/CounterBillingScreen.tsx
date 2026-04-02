import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  BOWL_BUILDER_STEPS,
  BREAKFAST_CUSTOMIZE_STEPS,
  CATEGORY_BY_SLUG,
  getAllowedOptionGroupIdsForItem,
  MENU_CATEGORIES,
  getBreakfastFamilyFromItemId,
  resolveBreakfastPriceFromFruitSelections,
  type BuilderStep,
  type FoodItem,
} from '../../data/menuData';
import { DRINKS_BY_SECTION, DRINK_SECTION_META, type DrinkSection } from '../../data/drinksData';
import {
  PRESETS_BY_ITEM_ID,
  SIGNATURE_BASE_PRICE_BY_BLEND,
  resolveProteinBlend,
  type PresetConfig,
} from '../../data/bowlConfigurations';
import type { CounterPaymentMethod, OrderItemSelection } from '../../types/platform';

type SupportedCategorySlug = 'signature-bowls' | 'breakfast-bowls' | 'high-protein-cups' | 'salad-bowls' | 'kids-meal' | 'drinks-juices';

interface CartLine {
  id: string;
  itemId: string;
  categoryName: string;
  title: string;
  quantity: number;
  unitPrice: number;
  selections: OrderItemSelection[];
}

interface UiMessage {
  tone: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

interface CustomizeState {
  itemId: string;
  title: string;
  categoryName: string;
  categorySlug: SupportedCategorySlug;
  basePrice: number;
  mode: 'signature' | 'breakfast' | 'generic';
  selections: Record<string, string[]>;
  stepIndex: number;
  hideBaseStep?: boolean;
  allowedProteinIds?: string[];
}

interface MenuSection {
  id: string;
  title: string;
  subtitle: string;
  accentLabel?: string;
  items: FoodItem[];
}

const COUNTER_CATEGORY_SLUGS: SupportedCategorySlug[] = [
  'signature-bowls',
  'breakfast-bowls',
  'high-protein-cups',
  'salad-bowls',
  'kids-meal',
  'drinks-juices',
];

const PAYMENT_OPTIONS: CounterPaymentMethod[] = ['cash', 'card', 'upi'];
const TIP_OPTIONS = [0, 5, 10, 15] as const;

const CATEGORY_SHORT_LABELS: Record<SupportedCategorySlug, string> = {
  'signature-bowls': 'Signature',
  'breakfast-bowls': 'Breakfast',
  'high-protein-cups': 'High Protein',
  'salad-bowls': 'Salad',
  'kids-meal': 'Kids',
  'drinks-juices': 'Drinks',
};

const QUICK_CUSTOMIZE_CHIPS = [
  { id: 'white-rice', label: 'White Rice', group: 'rice' },
  { id: 'brown-rice', label: 'Brown Rice', group: 'rice' },
  { id: 'rajma', label: 'Rajma', group: 'protein' },
  { id: 'channa', label: 'Channa', group: 'protein' },
  { id: 'chicken-classic', label: 'Chicken Classic', group: 'protein' },
  { id: 'chicken-spicy', label: 'Chicken Spicy', group: 'protein' },
  { id: 'no-onion', label: 'No Onion', group: 'preference' },
  { id: 'extra-sauce', label: 'Extra Sauce', group: 'preference' },
] as const;

const QUICK_CUSTOMIZE_GROUP_BY_ID = Object.fromEntries(
  QUICK_CUSTOMIZE_CHIPS.map((chip) => [chip.id, chip.group]),
) as Record<(typeof QUICK_CUSTOMIZE_CHIPS)[number]['id'], (typeof QUICK_CUSTOMIZE_CHIPS)[number]['group']>;

const QUICK_CUSTOMIZE_LABEL_BY_ID = Object.fromEntries(
  QUICK_CUSTOMIZE_CHIPS.map((chip) => [chip.id, chip.label]),
) as Record<(typeof QUICK_CUSTOMIZE_CHIPS)[number]['id'], string>;

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizePhoneInput = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const formatPhoneDisplay = (value: string) => {
  const digits = normalizePhoneInput(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

const createGuestTrackingPhone = () => {
  const suffix = Date.now().toString().slice(-7);
  return `999${suffix}`;
};

function buildMenuSections(slug: SupportedCategorySlug, items: FoodItem[]): MenuSection[] {
  if (slug === 'drinks-juices') {
    return DRINK_SECTION_META.map((sectionMeta) => ({
      id: sectionMeta.id,
      title: sectionMeta.title,
      subtitle: sectionMeta.subtitle,
      accentLabel: sectionMeta.accentLabel,
      items: DRINKS_BY_SECTION[sectionMeta.id as DrinkSection],
    }));
  }

  if (slug === 'high-protein-cups') {
    return [
      {
        id: 'small-cups',
        title: 'Small Cups',
        subtitle: 'Quick single-serve protein portions.',
        accentLabel: 'SMALL',
        items: items.filter((item) => item.name.includes('(Small)')),
      },
      {
        id: 'large-cups',
        title: 'Large Cups',
        subtitle: 'Bigger portions for stronger protein refuels.',
        accentLabel: 'LARGE',
        items: items.filter((item) => item.name.includes('(Large)')),
      },
      {
        id: 'specialty-cups',
        title: 'Specialty Cups',
        subtitle: 'Egg and mixed options.',
        items: items.filter((item) => !item.name.includes('(Small)') && !item.name.includes('(Large)')),
      },
    ].filter((section) => section.items.length > 0);
  }

  if (slug === 'breakfast-bowls') {
    return [
      {
        id: 'chia-yogurt-bowls',
        title: 'Chia Yogurt Bowls',
        subtitle: 'Preset breakfast bowls with optional customization.',
        accentLabel: 'CHIA YOGURT',
        items: items.filter((item) => getBreakfastFamilyFromItemId(item.id) === 'chia-yogurt'),
      },
      {
        id: 'overnight-oats',
        title: 'Overnight Oats',
        subtitle: 'Preset overnight oat options with live pricing rules.',
        accentLabel: 'OVERNIGHT',
        items: items.filter((item) => getBreakfastFamilyFromItemId(item.id) === 'overnight-oats'),
      },
    ].filter((section) => section.items.length > 0);
  }

  return [
    {
      id: `${slug}-items`,
      title: CATEGORY_BY_SLUG[slug]?.name ?? 'Items',
      subtitle: CATEGORY_BY_SLUG[slug]?.description ?? 'Choose and add quickly.',
      items,
    },
  ];
}

function mapSelectionsToLabels(selections: Record<string, string[]>, steps: BuilderStep[]) {
  const stepById = Object.fromEntries(steps.map((step) => [step.id, step]));
  return Object.entries(selections)
    .map(([sectionId, ids]) => {
      const step = stepById[sectionId];
      return {
        section: step?.title ?? sectionId,
        choices: ids.map((id) => step?.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id),
      };
    })
    .filter((entry) => entry.choices.length > 0);
}

function buildShortSummary(selections: OrderItemSelection[]) {
  const textBySection = selections.map((selection) => ({
    section: selection.section.toLowerCase(),
    value: selection.choices.join(', '),
  }));

  const riceOrBase = textBySection.find((entry) => entry.section.includes('rice') || entry.section.includes('base'))?.value;
  const protein = textBySection.find((entry) => entry.section.includes('protein'))?.value;

  if (riceOrBase || protein) {
    return [riceOrBase, protein].filter(Boolean).join(' • ');
  }

  const quick = textBySection.find((entry) => entry.section.includes('quick'))?.value;
  if (quick) return quick;

  return selections[0]?.choices[0] ?? 'Standard';
}

function getSelectedIngredients(steps: BuilderStep[], selections: Record<string, string[]>) {
  return steps.flatMap((step) => (selections[step.id] ?? []).flatMap((id) => step.ingredients.filter((ingredient) => ingredient.id === id)));
}

function getCustomizeSteps(customizing: CustomizeState | null) {
  if (!customizing) return [];

  const allowedGroupIds = getAllowedOptionGroupIdsForItem(customizing.itemId);
  if (customizing.mode === 'breakfast') {
    const breakfastSteps = BREAKFAST_CUSTOMIZE_STEPS;
    if (!allowedGroupIds || allowedGroupIds.length === 0) return breakfastSteps;
    const filteredBreakfastSteps = breakfastSteps.filter((step) => allowedGroupIds.includes(step.id));
    return filteredBreakfastSteps.length > 0 ? filteredBreakfastSteps : breakfastSteps;
  }

  const baseSteps = BOWL_BUILDER_STEPS;
  const scopedSteps = (!allowedGroupIds || allowedGroupIds.length === 0)
    ? baseSteps
    : (() => {
      const filtered = baseSteps.filter((step) => allowedGroupIds.includes(step.id));
      return filtered.length > 0 ? filtered : baseSteps;
    })();

  return scopedSteps
    .filter((step) => !(customizing.hideBaseStep && step.id === 'base'))
    .map((step) => {
      if (step.id !== 'protein' || !customizing.allowedProteinIds?.length) return step;
      return {
        ...step,
        ingredients: step.ingredients.filter((ingredient) => customizing.allowedProteinIds?.includes(ingredient.id)),
      };
    });
}

export function CounterBillingScreen() {
  const { createCounterWalkInOrder } = useAuth();
  const { activeStoreScope, activeStore, permissions } = useAdminDashboard();

  const categories = useMemo(
    () => COUNTER_CATEGORY_SLUGS.map((slug) => MENU_CATEGORIES.find((category) => category.slug === slug)).filter(Boolean) as Array<(typeof MENU_CATEGORIES)[number]>,
    [],
  );

  const [activeCategorySlug, setActiveCategorySlug] = useState<SupportedCategorySlug>('signature-bowls');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [expandedLineIds, setExpandedLineIds] = useState<Set<string>>(new Set());
  const [selectedQuickChipIds, setSelectedQuickChipIds] = useState<Array<(typeof QUICK_CUSTOMIZE_CHIPS)[number]['id']>>([]);
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentMethod | null>(null);
  const [tipPercentage, setTipPercentage] = useState<(typeof TIP_OPTIONS)[number]>(0);
  const [phone, setPhone] = useState('');
  const [phoneSkipped, setPhoneSkipped] = useState(false);
  const [guestTrackingPhone, setGuestTrackingPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [message, setMessage] = useState<UiMessage>({
    tone: 'info',
    text: 'Add items on the left, then complete the four billing steps on the right.',
  });
  const [isPaying, setIsPaying] = useState(false);
  const [customizing, setCustomizing] = useState<CustomizeState | null>(null);
  const [customizeError, setCustomizeError] = useState('');
  const [successState, setSuccessState] = useState<{ orderId: string } | null>(null);

  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const canBillForStore = activeStoreScope !== 'all' && activeStoreScope.length > 0;
  const activeCategory = CATEGORY_BY_SLUG[activeCategorySlug];
  const sections = useMemo(() => buildMenuSections(activeCategorySlug, activeCategory.items), [activeCategory.items, activeCategorySlug]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [cart]);
  const tipAmount = useMemo(() => Math.round(subtotal * (tipPercentage / 100)), [subtotal, tipPercentage]);
  const finalTotal = subtotal + tipAmount;

  const customizeSteps = useMemo(() => getCustomizeSteps(customizing), [customizing]);
  const customizeStep = customizing ? customizeSteps[customizing.stepIndex] : null;
  const customizeIngredients = customizing ? getSelectedIngredients(customizeSteps, customizing.selections) : [];

  const customizeResolved = useMemo(() => {
    if (!customizing) return null;

    if (customizing.mode === 'signature') {
      const blend = resolveProteinBlend(customizing.selections.protein ?? []);
      if (blend) {
        const label = blend === 'power' ? 'Power' : blend === 'veg' ? 'Veg' : 'Chicken';
        return {
          title: `Everyday ${label} Bowl`,
          basePrice: SIGNATURE_BASE_PRICE_BY_BLEND[blend],
        };
      }
    }

    if (customizing.mode === 'breakfast') {
      const family = getBreakfastFamilyFromItemId(customizing.itemId);
      if (family) {
        const pricing = resolveBreakfastPriceFromFruitSelections(family, customizing.selections.fruits ?? []);
        return {
          title: customizing.title,
          basePrice: pricing.basePrice,
        };
      }
    }

    return {
      title: customizing.title,
      basePrice: customizing.basePrice,
    };
  }, [customizing]);

  const customizeUnitPrice = (customizeResolved?.basePrice ?? customizing?.basePrice ?? 0)
    + customizeIngredients.reduce((sum, ingredient) => sum + ingredient.price, 0);

  const normalizedPhone = useMemo(() => normalizePhoneInput(phone), [phone]);
  const effectivePhone = phoneSkipped ? guestTrackingPhone : normalizedPhone;
  const phoneReady = (phoneSkipped && guestTrackingPhone.length === 10) || normalizedPhone.length === 10;
  const cartReady = cart.length > 0;
  const paymentReady = paymentMethod !== null;

  useEffect(() => () => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!cart.length || phoneSkipped || normalizedPhone.length > 0) return;
    phoneInputRef.current?.focus();
  }, [cart.length, normalizedPhone.length, phoneSkipped]);

  useEffect(() => {
    setExpandedLineIds(new Set());
  }, [cart.length]);

  const stopQtyHold = () => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startQtyHold = (lineId: string, delta: number) => {
    updateLineQty(lineId, delta);
    stopQtyHold();
    holdIntervalRef.current = window.setInterval(() => {
      updateLineQty(lineId, delta);
    }, 130);
  };

  const applyQuickChips = (selections: OrderItemSelection[]) => {
    if (!selectedQuickChipIds.length) return selections;
    return [
      ...selections,
      {
        section: 'Quick Changes',
        choices: selectedQuickChipIds.map((chipId) => QUICK_CUSTOMIZE_LABEL_BY_ID[chipId]),
      },
    ];
  };

  const addLinesToCart = (lines: Array<Omit<CartLine, 'id'>>) => {
    setCart((previous) => [
      ...previous,
      ...lines.map((line) => ({
        ...line,
        id: createId('line'),
      })),
    ]);
  };

  const addLine = (item: FoodItem) => {
    const preset = PRESETS_BY_ITEM_ID[item.id];
    if (preset) {
      const quickState: CustomizeState = {
        itemId: item.id,
        title: preset.title,
        categoryName: preset.categoryName,
        categorySlug: activeCategorySlug,
        basePrice: preset.basePrice,
        mode: preset.mode === 'signature' || preset.mode === 'breakfast' ? preset.mode : 'generic',
        selections: preset.defaultSelections,
        stepIndex: 0,
        hideBaseStep: preset.hideBaseStep,
        allowedProteinIds: preset.allowedProteinIds,
      };
      addLinesToCart([
        {
          itemId: item.id,
          categoryName: preset.categoryName,
          title: preset.title,
          quantity: 1,
          unitPrice: preset.basePrice,
          selections: applyQuickChips(mapSelectionsToLabels(preset.defaultSelections, getCustomizeSteps(quickState))),
        },
      ]);
      setMessage({ tone: 'success', text: `${preset.title} added to cart.` });
      return;
    }

    addLinesToCart([
      {
        itemId: item.id,
        categoryName: activeCategory.name,
        title: item.name,
        quantity: 1,
        unitPrice: item.price,
        selections: applyQuickChips([]),
      },
    ]);
    setMessage({ tone: 'success', text: `${item.name} added to cart.` });
  };

  const openCustomize = (item: FoodItem, preset: PresetConfig) => {
    setCustomizeError('');
    setCustomizing({
      itemId: item.id,
      title: preset.title,
      categoryName: preset.categoryName,
      categorySlug: activeCategorySlug,
      basePrice: preset.basePrice,
      mode: preset.mode === 'signature' || preset.mode === 'breakfast' ? preset.mode : 'generic',
      selections: preset.defaultSelections,
      stepIndex: 0,
      hideBaseStep: preset.hideBaseStep,
      allowedProteinIds: preset.allowedProteinIds,
    });
  };

  const updateCustomizeChoice = (step: BuilderStep, ingredientId: string) => {
    setCustomizing((current) => {
      if (!current) return current;
      const currentChoices = current.selections[step.id] ?? [];
      const nextChoices = step.type === 'single'
        ? currentChoices[0] === ingredientId ? [] : [ingredientId]
        : currentChoices.includes(ingredientId)
          ? currentChoices.filter((id) => id !== ingredientId)
          : [...currentChoices, ingredientId];

      return {
        ...current,
        selections: {
          ...current.selections,
          [step.id]: nextChoices,
        },
      };
    });
  };

  const nextCustomizeStep = () => {
    if (!customizing || !customizeStep) return;
    if (customizeStep.required && (customizing.selections[customizeStep.id] ?? []).length === 0) {
      setCustomizeError(`Please choose at least one ${customizeStep.title.toLowerCase()}.`);
      return;
    }
    setCustomizeError('');
    setCustomizing((current) => current ? ({ ...current, stepIndex: Math.min(customizeSteps.length - 1, current.stepIndex + 1) }) : current);
  };

  const previousCustomizeStep = () => {
    setCustomizeError('');
    setCustomizing((current) => current ? ({ ...current, stepIndex: Math.max(0, current.stepIndex - 1) }) : current);
  };

  const addCustomizedItem = () => {
    if (!customizing) return;
    if (customizeStep?.required && (customizing.selections[customizeStep.id] ?? []).length === 0) {
      setCustomizeError(`Please choose at least one ${customizeStep.title.toLowerCase()}.`);
      return;
    }

    addLinesToCart([
      {
        itemId: customizing.itemId,
        categoryName: customizing.categoryName,
        title: customizeResolved?.title ?? customizing.title,
        quantity: 1,
        unitPrice: customizeUnitPrice,
        selections: applyQuickChips(mapSelectionsToLabels(customizing.selections, customizeSteps)),
      },
    ]);
    setMessage({ tone: 'success', text: `${customizeResolved?.title ?? customizing.title} added to cart.` });
    setCustomizing(null);
    setCustomizeError('');
  };

  const updateLineQty = (lineId: string, delta: number) => {
    setCart((previous) => previous.map((line) => line.id === lineId ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line));
  };

  const removeLine = (lineId: string) => {
    setCart((previous) => previous.filter((line) => line.id !== lineId));
    setMessage({ tone: 'warning', text: 'Item removed from cart.' });
  };

  const toggleLineExpand = (lineId: string) => {
    setExpandedLineIds((previous) => {
      const next = new Set(previous);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const toggleQuickChip = (chipId: (typeof QUICK_CUSTOMIZE_CHIPS)[number]['id']) => {
    setSelectedQuickChipIds((previous) => {
      if (previous.includes(chipId)) {
        return previous.filter((entry) => entry !== chipId);
      }

      const chipGroup = QUICK_CUSTOMIZE_GROUP_BY_ID[chipId];
      if (chipGroup === 'preference') {
        return [...previous, chipId];
      }

      return [
        ...previous.filter((entry) => QUICK_CUSTOMIZE_GROUP_BY_ID[entry] !== chipGroup),
        chipId,
      ];
    });
  };

  const skipPhoneFlow = () => {
    setPhoneSkipped(true);
    setGuestTrackingPhone(createGuestTrackingPhone());
    setPhone('');
    if (!customerName.trim()) {
      setCustomerName('Walk-in Guest');
    }
    setMessage({ tone: 'warning', text: 'Phone skipped. Order will be placed for Walk-in Guest.' });
  };

  const enablePhoneFlow = () => {
    setPhoneSkipped(false);
    setGuestTrackingPhone('');
    setMessage({ tone: 'info', text: 'Phone capture is enabled for customer tracking.' });
    window.setTimeout(() => phoneInputRef.current?.focus(), 0);
  };

  const handlePayNow = async () => {
    if (isPaying) {
      return;
    }
    if (!canBillForStore) {
      setMessage({ tone: 'error', text: 'Select a specific store scope before billing.' });
      return;
    }
    if (!phoneReady) {
      setMessage({ tone: 'error', text: 'Enter a valid phone or use Skip Phone (Walk-in Guest).' });
      return;
    }
    if (!cart.length) {
      setMessage({ tone: 'error', text: 'Cart is empty. Add at least one item before payment.' });
      return;
    }
    if (!paymentReady) {
      setMessage({ tone: 'error', text: 'Select a payment method before Pay Now.' });
      return;
    }

    setIsPaying(true);
    try {
      const selectedPaymentMethod = paymentMethod;
      if (!selectedPaymentMethod) {
        setMessage({ tone: 'error', text: 'Select a payment method before Pay Now.' });
        return;
      }

      const createdOrder = await createCounterWalkInOrder({
        storeId: activeStoreScope,
        fullName: customerName.trim() || (phoneSkipped ? 'Walk-in Guest' : 'Walk-in Customer'),
        phone: effectivePhone,
        paymentMethod: selectedPaymentMethod,
        tipPercentage,
        tipAmount,
        items: cart.map((line) => ({
          category: line.categoryName,
          title: line.title,
          selections: line.selections,
          quantity: line.quantity,
          price: line.unitPrice,
        })),
      });

      setCart([]);
      setExpandedLineIds(new Set());
      setSelectedQuickChipIds([]);
      setCustomerName(phoneSkipped ? 'Walk-in Guest' : '');
      setPhone('');
      setGuestTrackingPhone('');
      setTipPercentage(0);
      setPaymentMethod(null);
      setSuccessState({ orderId: createdOrder.id });
      setMessage({
        tone: 'success',
        text: `Payment successful. ${createdOrder.id} logged as completed for reporting/history.`,
      });

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = window.setTimeout(() => {
        setSuccessState(null);
        if (phoneSkipped) {
          setCustomerName('Walk-in Guest');
        }
      }, 2500);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to complete billing right now.' });
    } finally {
      setIsPaying(false);
    }
  };

  const messageStyles: Record<UiMessage['tone'], string> = {
    info: 'border-primary/22 bg-[#F7FAF3] text-foreground/78',
    success: 'border-[#8AD39B] bg-[#ECF9EF] text-[#0F6B2D]',
    warning: 'border-[#E5C777] bg-[#FFF8E6] text-[#8B5A12]',
    error: 'border-[#E6A2A2] bg-[#FFF0F0] text-[#8B2E2E]',
  };

  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      {permissions.canSwitchStores && activeStoreScope === 'all' ? (
        <div className="rounded-2xl border border-[#E9D0A0] bg-[#FFF9F0] px-4 py-3 text-sm text-[#8B5A12]">
          Select one store scope in the context bar before taking counter payment.
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_356px]">
        <section className="flex max-h-[calc(100vh-172px)] flex-col overflow-hidden rounded-[22px] border border-primary/12 bg-white shadow-[0_8px_28px_rgba(45,80,22,0.08)]">
          <div className="shrink-0 border-b border-primary/10 bg-white px-4 py-3">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  data-testid={`counter-category-${category.slug}`}
                  onClick={() => setActiveCategorySlug(category.slug as SupportedCategorySlug)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeCategorySlug === category.slug ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  {CATEGORY_SHORT_LABELS[category.slug as SupportedCategorySlug]} <span className={`ml-1 text-[10px] ${activeCategorySlug === category.slug ? 'text-primary-foreground/80' : 'text-foreground/40'}`}>({category.items.length})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/50">Quick:</span>
              {QUICK_CUSTOMIZE_CHIPS.map((chip) => {
                const selected = selectedQuickChipIds.includes(chip.id);
                return (
                  <button key={chip.id} type="button" onClick={() => toggleQuickChip(chip.id)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${selected ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-[#F7FAF3] text-foreground/68'}`}>
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold text-foreground">{section.title}</p>
                    {section.accentLabel ? <span className="text-[10px] font-medium text-primary/56">{section.accentLabel}</span> : null}
                  </div>

                  <div className="grid gap-2 grid-cols-2">
                    {section.items.map((item) => {
                      const preset = PRESETS_BY_ITEM_ID[item.id];
                      return (
                        <article key={item.id} className="rounded-[14px] border border-primary/10 bg-white p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug text-foreground">{item.name}</p>
                            <p className="shrink-0 text-sm font-bold text-primary">₹{item.price}</p>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button type="button" onClick={() => addLine(item)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add</button>
                            {preset ? <button type="button" onClick={() => openCustomize(item, preset)} className="rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-foreground/70">Customize</button> : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex max-h-[calc(100vh-172px)] flex-col overflow-hidden rounded-[22px] border border-primary/20 bg-[#EDF5E6] shadow-[0_8px_28px_rgba(45,80,22,0.12)]">
          <div className="shrink-0 border-b border-primary/14 bg-[#E4F0D8] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">Checkout / Billing</p>
              <p className="text-xs font-medium text-primary/60">{activeStore?.name ?? ''}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">

          {successState ? (
            <div className="rounded-2xl border border-[#8AD39B] bg-[#ECF9EF] px-4 py-4 text-[#0F6B2D]">
              <p className="text-sm font-semibold">ORDER #{successState.orderId.toUpperCase()}</p>
              <p className="mt-1 text-base font-semibold">Payment Successful</p>
              <p className="mt-1 text-sm font-medium">Marked Completed (Handed Over)</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="rounded-2xl bg-[#F7FAF3] px-4 py-4 text-sm text-foreground/62">Cart is empty. Add real CULTIV items from the left.</div>
            ) : cart.map((line) => (
              <div key={line.id} className="rounded-2xl border border-primary/10 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{line.title}</p>
                    <p className="mt-1 text-xs text-foreground/56">{buildShortSummary(line.selections)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">₹{line.unitPrice * line.quantity}</p>
                    <button type="button" onClick={() => removeLine(line.id)} className="mt-1 text-xs font-medium text-primary hover:underline">Remove</button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={() => startQtyHold(line.id, -1)}
                      onMouseUp={stopQtyHold}
                      onMouseLeave={stopQtyHold}
                      onTouchStart={() => startQtyHold(line.id, -1)}
                      onTouchEnd={stopQtyHold}
                      onTouchCancel={stopQtyHold}
                      className="rounded-xl border border-primary/16 px-3.5 py-2.5 text-sm font-medium"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-base font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onMouseDown={() => startQtyHold(line.id, 1)}
                      onMouseUp={stopQtyHold}
                      onMouseLeave={stopQtyHold}
                      onTouchStart={() => startQtyHold(line.id, 1)}
                      onTouchEnd={stopQtyHold}
                      onTouchCancel={stopQtyHold}
                      className="rounded-xl border border-primary/16 px-3.5 py-2.5 text-sm font-medium"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button type="button" onClick={() => toggleLineExpand(line.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/68">
                    Expand details
                    {expandedLineIds.has(line.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {expandedLineIds.has(line.id) && line.selections.length > 0 ? (
                  <p className="mt-2 rounded-xl bg-[#F7FAF3] px-3 py-2 text-xs text-foreground/62">{line.selections.map((selection) => `${selection.section}: ${selection.choices.join(', ')}`).join(' · ')}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/10 bg-[#F7FAF3] p-4">
            <p className="text-sm font-semibold text-foreground">Step 1 — Customer Details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-foreground/68 sm:col-span-2">
                <span className="mb-2 block font-medium">Phone Number</span>
                <input
                  ref={phoneInputRef}
                  value={formatPhoneDisplay(phone)}
                  onChange={(event) => {
                    setPhoneSkipped(false);
                    setPhone(normalizePhoneInput(event.target.value));
                  }}
                  placeholder="10-digit phone"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-primary/12 bg-white px-4 py-3 outline-none transition-colors focus:border-primary"
                />
              </label>
              <label className="block text-sm text-foreground/68 sm:col-span-2">
                <span className="mb-2 block font-medium">Customer Name</span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Optional" className="w-full rounded-2xl border border-primary/12 bg-white px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button type="button" data-testid="skip-phone-button" onClick={phoneSkipped ? enablePhoneFlow : skipPhoneFlow} className="rounded-xl border border-primary/18 bg-white px-3 py-2 text-xs font-semibold text-foreground/74">
                  {phoneSkipped ? 'Use Phone Capture' : 'Skip Phone (Walk-in Guest)'}
                </button>
                <p className="text-xs text-foreground/58">Phone helps with rewards.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 2 — Tip (Optional)</p>
            <div className="flex flex-wrap gap-2">
              {TIP_OPTIONS.map((option) => (
                <button key={option} type="button" onClick={() => setTipPercentage(option)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipPercentage === option ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/70'}`}>
                  {option === 0 ? 'No Tip' : `${option}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7FAF3] p-4">
            <div className="flex items-center justify-between text-sm text-foreground/70">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-foreground/70">
              <span>Tip</span>
              <span>₹{tipAmount}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-base font-semibold text-foreground">
              <span>Total Payable</span>
              <span>₹{finalTotal}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Step 3 — Payment Method</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button key={option} data-testid={`payment-option-${option}`} type="button" onClick={() => setPaymentMethod(option)} className={`rounded-2xl px-4 py-4 text-sm font-bold uppercase tracking-[0.06em] transition-all ${paymentMethod === option ? 'bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(45,80,22,0.22)]' : 'border border-primary/16 bg-white text-foreground/74 hover:border-primary/30 hover:bg-[#F7FAF3]'}`}>
                  {option}
                </button>
              ))}
            </div>
            {!paymentReady ? <p className="text-xs font-medium text-[#8B2E2E]">Select payment method to continue.</p> : null}
          </div>

          <div className="rounded-2xl border border-primary/12 bg-[#F7FAF3] p-3 text-xs">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/62">Readiness</p>
            <div className="mt-2 space-y-1.5">
              <p className="inline-flex items-center gap-2 text-foreground/74">
                {cartReady ? <CheckCircle2 className="h-4 w-4 text-[#1E8A3B]" /> : <AlertTriangle className="h-4 w-4 text-[#B36B00]" />}
                Cart has at least 1 item
              </p>
              <p className="inline-flex items-center gap-2 text-foreground/74">
                {phoneReady ? <CheckCircle2 className="h-4 w-4 text-[#1E8A3B]" /> : <AlertTriangle className="h-4 w-4 text-[#B36B00]" />}
                Phone ready or skipped for walk-in guest
              </p>
              <p className="inline-flex items-center gap-2 text-foreground/74">
                {paymentReady ? <CheckCircle2 className="h-4 w-4 text-[#1E8A3B]" /> : <AlertTriangle className="h-4 w-4 text-[#B36B00]" />}
                Payment method selected
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground">Step 4 — Pay Now</p>
          <button type="button" data-testid="pay-now-button" disabled={!canBillForStore || !cart.length || isPaying || !phoneReady || !paymentReady} onClick={() => void handlePayNow()} className="w-full rounded-2xl bg-primary px-4 py-5 text-base font-bold tracking-wide text-primary-foreground shadow-[0_6px_22px_rgba(45,80,22,0.30)] transition-all hover:shadow-[0_8px_28px_rgba(45,80,22,0.38)] disabled:cursor-not-allowed disabled:opacity-50">
            {isPaying ? 'Processing...' : 'Pay Now'}
          </button>

          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${messageStyles[message.tone]}`}>
            {message.text}
          </div>

          </div>
          </div>
        </section>
      </div>

      {customizing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/28 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-primary/12 bg-white p-5 shadow-[0_26px_70px_rgba(16,24,16,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Customize</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">{customizeResolved?.title ?? customizing.title}</p>
                <p className="mt-2 text-sm text-foreground/64">Use the same CULTIV selection logic as customer ordering.</p>
              </div>
              <button type="button" onClick={() => { setCustomizing(null); setCustomizeError(''); }} className="rounded-xl border border-primary/14 bg-white px-3 py-2 text-sm font-medium text-foreground/72">Close</button>
            </div>

            {customizeStep ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{customizeStep.title}</p>
                  <p className="mt-1 text-sm text-foreground/60">{customizeStep.subtitle}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {customizeStep.ingredients.map((ingredient) => {
                    const selected = (customizing.selections[customizeStep.id] ?? []).includes(ingredient.id);
                    return (
                      <button key={ingredient.id} type="button" onClick={() => updateCustomizeChoice(customizeStep, ingredient.id)} className={`rounded-2xl px-4 py-3 text-left text-sm ${selected ? 'bg-primary text-primary-foreground' : 'border border-primary/16 bg-white text-foreground/74'}`}>
                        <p className="font-semibold">{ingredient.name}</p>
                        <p className={`mt-1 text-xs ${selected ? 'text-primary-foreground/82' : 'text-foreground/58'}`}>{ingredient.price > 0 ? `+₹${ingredient.price}` : 'Included'}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl bg-[#F7FAF3] p-4">
                  <div className="flex items-center justify-between text-sm text-foreground/68">
                    <span>Base + selections</span>
                    <span>₹{customizeUnitPrice}</span>
                  </div>
                  {customizeIngredients.length > 0 ? <p className="mt-2 text-xs text-foreground/58">Selected: {customizeIngredients.map((ingredient) => ingredient.name).join(', ')}</p> : null}
                </div>

                {customizeError ? <p className="text-sm font-medium text-[#8B2E2E]">{customizeError}</p> : null}

                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={previousCustomizeStep} disabled={customizing.stepIndex === 0} className="rounded-xl border border-primary/16 bg-white px-4 py-2.5 text-sm font-medium text-foreground/74 disabled:opacity-40">Back</button>
                  {customizing.stepIndex < customizeSteps.length - 1 ? (
                    <button type="button" onClick={nextCustomizeStep} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Next</button>
                  ) : (
                    <button type="button" onClick={addCustomizedItem} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add to Cart</button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
