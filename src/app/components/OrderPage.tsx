// OrderPage — full-page three-partition ordering (menu rail, presets, live cart).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CreditCard, Minus, Plus, ShoppingBag, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageReveal } from '../core/motion/cultivMotion';
import { ImageWithFallback } from './figma/ImageWithFallback';
import {
  BOWL_BUILDER_STEPS,
  BREAKFAST_AVAILABLE_FRUIT_IDS,
  BREAKFAST_CUSTOMIZE_STEPS,
  BREAKFAST_SECTION_ITEM_IDS,
  getAllowedOptionGroupIdsForItem,
  getBreakfastFamilyFromItemId,
  MENU_CATEGORIES,
  resolveBreakfastPriceFromFruitSelections,
  type BuilderStep,
  type FoodItem,
} from '../data/menuData';
import { TABLE_BUILD_OPTIONS_BY_TYPE, type TableBuildType } from '../data/buildYourOwnTableData';
import { DRINKS_BY_SECTION, DRINK_SECTION_META, type DrinkItem, type DrinkSection } from '../data/drinksData';
import {
  addDraftLine,
  clearDraftCart,
  createDraftLineKey,
  loadDraftCart,
  removeDraftLine,
  saveDraftCart,
  subscribeDraftCart,
  updateDraftLineQuantity,
  type DraftCustomizeSnapshot,
  type DraftCartLine,
} from '../data/cartDraft';
import {
  PRESETS_BY_ITEM_ID,
  SIGNATURE_BASE_PRICE_BY_BLEND,
  TABLE_BUILD_TYPE_BY_ITEM_ID,
  resolveProteinBlend,
} from '../data/bowlConfigurations';
import { AuthPromptBeforeCheckout } from './AuthPromptBeforeCheckout';
import { MockCheckoutPaymentModal } from './MockCheckoutPaymentModal';
import { OrderReviewModal } from './OrderReviewModal';
import { useAuth } from '../contexts/AuthContext';
import { DISCOUNT_REWARD_VALUES, FREE_ITEM_REWARD_DETAILS } from '../config/rewardsCatalog';
import type { OrderPageLocationState } from '../types/navigation';
import type { CustomerCheckoutPaymentMethod, PlaceOrderInput } from '../types/platform';
import { resolveCheckoutPaymentProvider, type CheckoutPaymentIntent } from '../services/checkoutPaymentProvider';
import { getSelectedStore, loadSelectedStoreId, loadStores, requestOpenStoreSelector, subscribeSelectedStore, type StoreLocatorStore } from '../data/storeLocator';
import {
  CHECKOUT_CONTACT_STORAGE_KEY,
  GUEST_AUTH_PROMPT_DISMISSED_KEY,
  GUEST_CONFIRMATION_STORAGE_KEY,
} from '../data/shoppingSession';
import {
  DEFAULT_ACTIVE_ORDER_CATEGORY_SLUG,
  POS_TAX_RATE,
  PICKUP_ESTIMATE_WINDOW,
  PRICE_EPSILON,
  REWARD_MAX_DISCOUNT_RATIO,
  REWARD_MIN_ORDER_SUBTOTAL,
} from '../constants/business';

type TipOption = 'none' | '5' | '10' | '15' | 'custom';

type CartLine = DraftCartLine;

interface CustomerState {
  fullName: string;
  phone: string;
  email: string;
}

interface GuestOrderConfirmation {
  orderId: string;
  fulfillmentWindow?: string;
  createdAt: number;
}

interface GatewaySuccessPayload {
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
}

interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface PaymentLaunchResult {
  outcome: 'succeeded' | 'failed' | 'cancelled';
  message?: string;
  payload?: GatewaySuccessPayload;
}

interface MockPaymentSession {
  paymentMethod: CustomerCheckoutPaymentMethod;
  amount: number;
  itemCount: number;
  customerName: string;
  paymentReference: string;
  idempotencyKey: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (eventName: string, callback: (payload: any) => void) => void;
    };
  }
}

interface CustomizeState {
  itemId: string;
  title: string;
  categoryName: string;
  basePrice: number;
  mode: 'signature' | 'table' | 'breakfast' | 'generic';
  selections: Record<string, string[]>;
  stepIndex: number;
  hideBaseStep?: boolean;
  allowedProteinIds?: string[];
  servesLabel?: string;
}

const CATEGORY_PRIORITY = [
  'build-your-own-bowl',
  'signature-bowls',
  'breakfast-bowls',
  'high-protein-cups',
  'salad-bowls',
  'kids-meal',
  'drinks-juices',
] as const;

const CATEGORY_INDEX = Object.fromEntries(MENU_CATEGORIES.map((category) => [category.slug, category]));
const STEP_BY_ID = Object.fromEntries(
  [...BOWL_BUILDER_STEPS, ...BREAKFAST_CUSTOMIZE_STEPS].map((step) => [step.id, step]),
);

interface MenuSection {
  id: string;
  title: string;
  subtitle: string;
  accentLabel?: string;
  items: FoodItem[];
}

const CATEGORY_CONTEXT: Record<string, { accentLabel?: string; helperText: string }> = {
  'build-your-own-bowl': {
    accentLabel: 'GROUP ORDER',
    helperText: 'Serves 4-5 people with preset and custom paths.',
  },
  'breakfast-bowls': {
    accentLabel: 'MORNING FUEL',
    helperText: 'Preset favorites with optional customization and direct add.',
  },
  'signature-bowls': {
    accentLabel: 'EVERYDAY PICKS',
    helperText: 'Balanced single-person bowls with direct compare.',
  },
  'high-protein-cups': {
    accentLabel: 'QUICK PROTEIN',
    helperText: 'Fast direct-add cups for routine refuels.',
  },
  'salad-bowls': {
    accentLabel: 'NO RICE',
    helperText: 'Signature-style salads built without rice base.',
  },
  'kids-meal': {
    accentLabel: 'FAMILY PICK',
    helperText: 'Kid-friendly portions made for simple ordering.',
  },
  'drinks-juices': {
    accentLabel: 'REFRESH',
    helperText: 'All drinks visible with direct add speed.',
  },
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function buildMenuSections(slug: string, items: FoodItem[]): MenuSection[] {
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
    const small = items.filter((item) => item.name.includes('(Small)'));
    const large = items.filter((item) => item.name.includes('(Large)'));
    const specialty = items.filter((item) => !item.name.includes('(Small)') && !item.name.includes('(Large)'));
    return [
      {
        id: 'small-cups',
        title: 'Small Cups',
        subtitle: 'Lean single-serve portions for quick protein top-ups.',
        accentLabel: 'SMALL',
        items: small,
      },
      {
        id: 'large-cups',
        title: 'Large Cups',
        subtitle: 'Bigger portions for stronger protein goals.',
        accentLabel: 'LARGE',
        items: large,
      },
      {
        id: 'specialty-cups',
        title: 'Specialty Cups',
        subtitle: 'Egg and mixed options for variety.',
        items: specialty,
      },
    ].filter((section) => section.items.length > 0);
  }

  if (slug === 'build-your-own-bowl') {
    return [
      {
        id: 'table-bowls',
        title: 'Table Bowl Lineup',
        subtitle: 'Shared bowls for 4-5 people with protein-led options.',
        accentLabel: 'SERVES 4-5',
        items,
      },
    ];
  }

  if (slug === 'breakfast-bowls') {
    const yogurtChia = items.filter((item) => BREAKFAST_SECTION_ITEM_IDS.chiaYogurtBowls.some((id) => id === item.id));
    const overnightOats = items.filter((item) => BREAKFAST_SECTION_ITEM_IDS.overnightOats.some((id) => id === item.id));

    return [
      {
        id: 'chia-yogurt-bowls',
        title: 'Chia Yogurt Bowls',
        subtitle: 'Preset chia yogurt bowls with customize support.',
        accentLabel: 'CHIA YOGURT',
        items: yogurtChia,
      },
      {
        id: 'overnight-oats',
        title: 'Overnight Oats',
        subtitle: 'Preset overnight oats with customize support.',
        accentLabel: 'OVERNIGHT',
        items: overnightOats,
      },
    ].filter((section) => section.items.length > 0);
  }

  return [
    {
      id: 'all-items',
      title: sectionTitleBySlug(slug),
      subtitle: sectionSubtitleBySlug(slug),
      items,
    },
  ];
}

function sectionTitleBySlug(slug: string) {
  if (slug === 'signature-bowls') return 'Signature Lineup';
  if (slug === 'salad-bowls') return 'Salad Lineup';
  if (slug === 'breakfast-bowls') return 'Breakfast Lineup';
  if (slug === 'kids-meal') return 'Kids Favorites';
  return 'Menu Lineup';
}

function sectionSubtitleBySlug(slug: string) {
  if (slug === 'signature-bowls') return 'Compare everyday presets quickly and customize when needed.';
  if (slug === 'salad-bowls') return 'Single-person salads with no rice base.';
  if (slug === 'breakfast-bowls') return 'Preset breakfast bowls with optional customization paths.';
  if (slug === 'kids-meal') return 'Milder portions made for family ordering routines.';
  return 'Scan quickly and add what you need.';
}

function supportsCustomize(slug: string) {
  return (
    slug === 'build-your-own-bowl'
    || slug === 'signature-bowls'
    || slug === 'salad-bowls'
    || slug === 'breakfast-bowls'
  );
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(0, 10);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSelectedIngredients(steps: BuilderStep[], selections: Record<string, string[]>) {
  return steps.flatMap((step) =>
    (selections[step.id] ?? []).flatMap((id) => step.ingredients.filter((ingredient) => ingredient.id === id)),
  );
}

function getAllowedProteinIdsForTableType(type: TableBuildType) {
  if (type === 'veg') return ['rajma', 'channa'];
  if (type === 'chicken') return ['classic-chicken', 'spicy-chicken'];
  return ['rajma', 'channa', 'classic-chicken', 'spicy-chicken'];
}

function mapSelectionsToLabels(selections: Record<string, string[]>) {
  return Object.entries(selections)
    .map(([sectionId, ids]) => {
      const section = STEP_BY_ID[sectionId];
      return {
        section: section?.title ?? sectionId,
        choices: ids.map((id) => section?.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id),
      };
    })
    .filter((entry) => entry.choices.length > 0);
}

const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const ensureRazorpayScript = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Payment checkout is unavailable in this environment.');
  }

  if (window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load payment checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load payment checkout.'));
    document.body.appendChild(script);
  });

  if (!window.Razorpay) {
    throw new Error('Payment checkout failed to initialize.');
  }
};

export function OrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, createCheckoutPaymentIntent, confirmCheckoutPayment, loyaltyProfile, offers } = useAuth();
  const locationState = (location.state as OrderPageLocationState | null) ?? null;

  const [activeCategorySlug, setActiveCategorySlug] = useState<string>(DEFAULT_ACTIVE_ORDER_CATEGORY_SLUG);
  const [cartLines, setCartLines] = useState<CartLine[]>(() => loadDraftCart());
  const [customer, setCustomer] = useState<CustomerState>({ fullName: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [guestOrderConfirmation, setGuestOrderConfirmation] = useState<GuestOrderConfirmation | null>(null);
  const [customizing, setCustomizing] = useState<CustomizeState | null>(null);
  const [pendingCategorySlug, setPendingCategorySlug] = useState<string | null>(null);
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<string | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [editingLineQuantity, setEditingLineQuantity] = useState<number>(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showGuestAuthPrompt, setShowGuestAuthPrompt] = useState(true);
  const [selectedRewardIds, setSelectedRewardIds] = useState<string[]>([]);
  const [selectedTipOption, setSelectedTipOption] = useState<TipOption>('none');
  const [customTipInput, setCustomTipInput] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CustomerCheckoutPaymentMethod>('upi');
  const [mockPaymentSession, setMockPaymentSession] = useState<MockPaymentSession | null>(null);
  const submissionLockRef = useRef(false);
  const mockPaymentResolverRef = useRef<((result: PaymentLaunchResult) => void) | null>(null);
  const [stores, setStores] = useState<StoreLocatorStore[]>(() => loadStores());
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => loadSelectedStoreId(loadStores()));
  const selectedStore = useMemo(
    () => getSelectedStore(stores),
    [stores],
  );

  useEffect(() => {
    if (!isBrowser()) return;
    try {
      const rawContact = localStorage.getItem(CHECKOUT_CONTACT_STORAGE_KEY);
      if (rawContact) {
        const parsed = JSON.parse(rawContact) as Partial<CustomerState>;
        setCustomer((current) => ({
          fullName: current.fullName || (parsed.fullName ?? ''),
          phone: current.phone || (parsed.phone ?? ''),
          email: current.email || (parsed.email ?? ''),
        }));
      }

      const rawGuestConfirmation = localStorage.getItem(GUEST_CONFIRMATION_STORAGE_KEY);
      if (rawGuestConfirmation) {
        const parsed = JSON.parse(rawGuestConfirmation) as GuestOrderConfirmation;
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        if (parsed?.orderId && (!parsed.createdAt || Date.now() - parsed.createdAt < TWENTY_FOUR_HOURS)) {
          setGuestOrderConfirmation(parsed);
        } else {
          localStorage.removeItem(GUEST_CONFIRMATION_STORAGE_KEY);
        }
      }

      const promptDismissed = localStorage.getItem(GUEST_AUTH_PROMPT_DISMISSED_KEY) === '1';
      setShowGuestAuthPrompt(!promptDismissed);
    } catch {
      // Ignore malformed local storage payloads.
    }
  }, []);

  useEffect(() => {
    setCustomer((current) => ({
      fullName: current.fullName || user?.fullName || '',
      phone: current.phone || user?.phone || '',
      email: current.email || user?.email || '',
    }));
  }, [user]);

  useEffect(() => {
    if (user?.paymentProfile?.preferredMethod === 'card' || user?.paymentProfile?.preferredMethod === 'upi') {
      setSelectedPaymentMethod(user.paymentProfile.preferredMethod);
    }
  }, [user]);

  useEffect(() => {
    if (!isBrowser()) return;
    localStorage.setItem(CHECKOUT_CONTACT_STORAGE_KEY, JSON.stringify(customer));
  }, [customer]);

  useEffect(() => {
    return () => {
      if (mockPaymentResolverRef.current) {
        mockPaymentResolverRef.current({
          outcome: 'cancelled',
          message: 'Payment was cancelled. Your cart is still saved.',
        });
        mockPaymentResolverRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    if (guestOrderConfirmation) {
      localStorage.setItem(GUEST_CONFIRMATION_STORAGE_KEY, JSON.stringify(guestOrderConfirmation));
    } else {
      localStorage.removeItem(GUEST_CONFIRMATION_STORAGE_KEY);
    }
  }, [guestOrderConfirmation]);

  useEffect(() => {
    if (!user || !guestOrderConfirmation) return;
    setGuestOrderConfirmation(null);
  }, [guestOrderConfirmation, user]);

  useEffect(() => {
    const syncStores = () => {
      const nextStores = loadStores();
      setStores(nextStores);
      setSelectedStoreId(loadSelectedStoreId(nextStores));
    };

    syncStores();
    const unsubscribe = subscribeSelectedStore(() => {
      syncStores();
    });
    return unsubscribe;
  }, []);

  useEffect(() => subscribeDraftCart(() => setCartLines(loadDraftCart())), []);

  useEffect(() => {
    if (!locationState?.categorySlug) return;
    if (!CATEGORY_INDEX[locationState.categorySlug]) return;

    setActiveCategorySlug(locationState.categorySlug);

    const hasCustomizeState = Boolean(
      locationState.openCustomize || locationState.presetConfig || locationState.tableOrder,
    );
    if (!hasCustomizeState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, locationState, navigate]);

  useEffect(() => {
    if (!locationState?.reorderCartLines || !Array.isArray(locationState.reorderCartLines)) return;

    const safeLines = locationState.reorderCartLines
      .filter((line) => line && typeof line === 'object' && line.itemId && line.title && line.unitPrice)
      .map((line) => ({
        key: line.key,
        itemId: line.itemId,
        title: line.title,
        categoryName: line.categoryName,
        unitPrice: line.unitPrice,
        quantity: Math.max(1, line.quantity),
        selections: line.selections ?? [],
      }));

    saveDraftCart(safeLines);
    setCartLines(loadDraftCart());

    if (locationState.categorySlug && CATEGORY_INDEX[locationState.categorySlug]) {
      setActiveCategorySlug(locationState.categorySlug);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, locationState, navigate]);

  useEffect(() => {
    if (!locationState?.openCustomize) return;

    if (locationState.presetConfig) {
      const preset = locationState.presetConfig;
      const matchingCategory = MENU_CATEGORIES.find((category) => category.name === preset.categoryName);
      if (matchingCategory) {
        setActiveCategorySlug(matchingCategory.slug);
      }

      setCustomizing({
        itemId: preset.itemId ?? `preset-${preset.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: preset.title,
        categoryName: preset.categoryName,
        basePrice: preset.basePrice,
        mode: preset.mode === 'salad' ? 'generic' : preset.mode,
        selections: preset.defaultSelections,
        stepIndex: 0,
        hideBaseStep: preset.hideBaseStep,
        allowedProteinIds: preset.allowedProteinIds,
      });
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (locationState.tableOrder) {
      const type =
        locationState.buildType === 'veg' ||
        locationState.buildType === 'both' ||
        locationState.buildType === 'chicken'
          ? locationState.buildType
          : 'chicken';
      const option = TABLE_BUILD_OPTIONS_BY_TYPE[type];
      setActiveCategorySlug(DEFAULT_ACTIVE_ORDER_CATEGORY_SLUG);
      setCustomizing({
        itemId: `table-${type}`,
        title: option.title,
        categoryName: 'Build Your Own Bowl',
        basePrice: option.basePrice,
        mode: 'table',
        selections: option.defaultSelections,
        stepIndex: 0,
        allowedProteinIds: getAllowedProteinIdsForTableType(type),
        servesLabel: 'Serves 4-5 people',
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, locationState, navigate]);

  useEffect(() => {
    if (!recentlyAddedItemId) return;
    const timeout = window.setTimeout(() => setRecentlyAddedItemId(null), 1100);
    return () => window.clearTimeout(timeout);
  }, [recentlyAddedItemId]);

  useEffect(() => {
    setExpandedSections({});
  }, [activeCategorySlug]);

  const categories = useMemo(
    () => CATEGORY_PRIORITY.map((slug) => CATEGORY_INDEX[slug]).filter(Boolean),
    [],
  );

  const activeCategory = CATEGORY_INDEX[activeCategorySlug] ?? categories[0];
  const activeCategorySections = useMemo(
    () => buildMenuSections(activeCategory.slug, activeCategory.items),
    [activeCategory.slug, activeCategory.items],
  );
  const activeCategoryContext = CATEGORY_CONTEXT[activeCategory.slug];

  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const availableCheckoutRewards = useMemo(() => {
    if (!user || !loyaltyProfile) return [];

    const availableRewardIds = new Set(loyaltyProfile.availableRewards);
    return offers
      .filter((offer) => availableRewardIds.has(offer.id))
      .sort((a, b) => (a.pointCost ?? 0) - (b.pointCost ?? 0));
  }, [loyaltyProfile, offers, user]);

  const selectedDiscountRewardId = selectedRewardIds.find((rewardId) => Number.isFinite(DISCOUNT_REWARD_VALUES[rewardId]));
  const rewardDiscount = selectedDiscountRewardId ? DISCOUNT_REWARD_VALUES[selectedDiscountRewardId] : 0;
  const taxableSubtotal = Math.max(0, cartTotal - rewardDiscount);
  const gstAmount = Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100;
  const tipPercentage = selectedTipOption === 'custom' || selectedTipOption === 'none' ? 0 : Number(selectedTipOption);
  const parsedCustomTip = Number(customTipInput || 0);
  const customTipAmount = selectedTipOption === 'custom' && Number.isFinite(parsedCustomTip) ? Math.max(0, parsedCustomTip) : 0;
  const tipAmount = selectedTipOption === 'custom'
    ? Math.round(customTipAmount * 100) / 100
    : Math.round(taxableSubtotal * (tipPercentage / 100) * 100) / 100;
  const payableTotal = Math.round((taxableSubtotal + gstAmount + tipAmount) * 100) / 100;

  const selectedFreeRewardItems = selectedRewardIds
    .filter((rewardId) => !Number.isFinite(DISCOUNT_REWARD_VALUES[rewardId]))
    .map((rewardId, index) => {
      const details = FREE_ITEM_REWARD_DETAILS[rewardId];
      if (!details) {
        return null;
      }

      return {
        id: `reward-${rewardId}-${index}`,
        category: details.category,
        title: details.title,
        selections: [{ section: 'Reward', choices: ['Applied at checkout'] }],
        quantity: 1,
        price: 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const getRewardValidationMessage = (rewardIds: string[]) => {
    if (rewardIds.length === 0) return '';
    if (cartTotal < REWARD_MIN_ORDER_SUBTOTAL) return `Minimum order of ₹${REWARD_MIN_ORDER_SUBTOTAL} is required to use rewards.`;
    if (cartCount <= 0 || cartTotal <= 0) return 'Rewards apply only to food items.';

    const discountRewards = rewardIds.filter((rewardId) => Number.isFinite(DISCOUNT_REWARD_VALUES[rewardId]));
    if (discountRewards.length > 1) {
      return 'Only one discount reward can be used per order.';
    }

    const discountAmount = discountRewards.length ? DISCOUNT_REWARD_VALUES[discountRewards[0]] : 0;
    if (discountAmount > cartTotal + PRICE_EPSILON) {
      return 'Reward discount cannot exceed items total.';
    }

    if (discountAmount > cartTotal * REWARD_MAX_DISCOUNT_RATIO + PRICE_EPSILON) {
      return 'Discount reward cannot exceed 30% of order total.';
    }

    const freeItemValue = rewardIds
      .filter((rewardId) => !Number.isFinite(DISCOUNT_REWARD_VALUES[rewardId]))
      .reduce((sum, rewardId) => sum + (FREE_ITEM_REWARD_DETAILS[rewardId]?.foodValue ?? 0), 0);

    if (freeItemValue > cartTotal + PRICE_EPSILON) {
      return 'Free item rewards cannot exceed items total.';
    }

    return '';
  };
  const customizeSteps = useMemo(() => {
    if (!customizing) return BOWL_BUILDER_STEPS;

    const allowedGroupIds = getAllowedOptionGroupIdsForItem(customizing.itemId);

    if (customizing.mode === 'breakfast') {
      const breakfastSteps = BREAKFAST_CUSTOMIZE_STEPS;
      if (!allowedGroupIds || allowedGroupIds.length === 0) {
        return breakfastSteps;
      }
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
      .filter((step) => {
        if (customizing.hideBaseStep && step.id === 'base') return false;
        return true;
      })
      .map((step) => {
        if (step.id !== 'protein' || !customizing.allowedProteinIds?.length) return step;
        return {
          ...step,
          ingredients: step.ingredients.filter((ingredient) => customizing.allowedProteinIds?.includes(ingredient.id)),
        };
      });
  }, [customizing]);
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

    if (customizing.mode === 'table') {
      const blend = resolveProteinBlend(customizing.selections.protein ?? []);
      if (blend) {
        const tableType: TableBuildType = blend === 'power' ? 'both' : blend;
        const option = TABLE_BUILD_OPTIONS_BY_TYPE[tableType];
        return { title: option.title, basePrice: option.basePrice };
      }
    }

    if (customizing.mode === 'breakfast') {
      const family = getBreakfastFamilyFromItemId(customizing.itemId);
      if (family) {
        const pricing = resolveBreakfastPriceFromFruitSelections(family, customizing.selections.fruits ?? []);
        return {
          title: customizing.title,
          basePrice: pricing.basePrice,
          breakfastPower: pricing.isPower,
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

  const addToCart = (item: FoodItem) => {
    const preset = PRESETS_BY_ITEM_ID[item.id];
    if (preset) {
      const selections = mapSelectionsToLabels(preset.defaultSelections);
      const customizeSnapshot: DraftCustomizeSnapshot = {
        mode: preset.mode === 'salad' ? 'generic' : preset.mode,
        selections: preset.defaultSelections,
        basePrice: preset.basePrice,
        hideBaseStep: preset.hideBaseStep,
        allowedProteinIds: preset.allowedProteinIds,
      };
      addDraftLine({
        key: createDraftLineKey(item.id, selections),
        itemId: item.id,
        title: preset.title,
        categoryName: preset.categoryName,
        unitPrice: preset.basePrice,
        quantity: 1,
        selections,
        customizeSnapshot,
      });
      setRecentlyAddedItemId(item.id);
      return;
    }

    if (activeCategory.slug === 'build-your-own-bowl') {
      const buildType = TABLE_BUILD_TYPE_BY_ITEM_ID[item.id];
      if (buildType) {
        const option = TABLE_BUILD_OPTIONS_BY_TYPE[buildType];
        const selections = [
          { section: 'Serving', choices: ['Serves 4-5 people'] },
          ...mapSelectionsToLabels(option.defaultSelections),
        ];
        const customizeSnapshot: DraftCustomizeSnapshot = {
          mode: 'table',
          selections: option.defaultSelections,
          basePrice: option.basePrice,
          allowedProteinIds: getAllowedProteinIdsForTableType(buildType),
          servesLabel: 'Serves 4-5 people',
        };
        addDraftLine({
          key: createDraftLineKey(`table-${buildType}`, selections),
          itemId: `table-${buildType}`,
          title: option.title,
          categoryName: 'Build Your Own Bowl',
          unitPrice: option.basePrice,
          quantity: 1,
          selections,
          customizeSnapshot,
        });
        setRecentlyAddedItemId(item.id);
        return;
      }
    }

    addDraftLine({
      key: createDraftLineKey(item.id),
      itemId: item.id,
      title: item.name,
      categoryName: activeCategory.name,
      unitPrice: item.price,
      quantity: 1,
    });
    setRecentlyAddedItemId(item.id);
  };

  const updateQuantity = (key: string, direction: 'inc' | 'dec') => {
    updateDraftLineQuantity(key, direction);
  };

  const removeLine = (key: string) => {
    removeDraftLine(key);
  };

  const openCustomize = (item: FoodItem) => {
    setEditingLineKey(null);
    setEditingLineQuantity(1);

    const preset = PRESETS_BY_ITEM_ID[item.id];
    if (preset) {
      setCustomizing({
        itemId: item.id,
        title: preset.title,
        categoryName: preset.categoryName,
        basePrice: preset.basePrice,
        mode: preset.mode === 'salad' ? 'generic' : preset.mode,
        selections: preset.defaultSelections,
        stepIndex: 0,
        hideBaseStep: preset.hideBaseStep,
        allowedProteinIds: preset.allowedProteinIds,
      });
      return;
    }

    if (activeCategory.slug === 'build-your-own-bowl') {
      const buildType = TABLE_BUILD_TYPE_BY_ITEM_ID[item.id];
      if (buildType) {
        const option = TABLE_BUILD_OPTIONS_BY_TYPE[buildType];
        setCustomizing({
          itemId: `table-${buildType}`,
          title: option.title,
          categoryName: 'Build Your Own Bowl',
          basePrice: option.basePrice,
          mode: 'table',
          selections: option.defaultSelections,
          stepIndex: 0,
          allowedProteinIds: getAllowedProteinIdsForTableType(buildType),
          servesLabel: 'Serves 4-5 people',
        });
        return;
      }
    }

    setCustomizing({
      itemId: item.id,
      title: item.name,
      categoryName: activeCategory.name,
      basePrice: item.price,
      mode: 'generic',
      selections: {},
      stepIndex: 0,
    });
  };

  const closeCustomize = () => {
    setCustomizing(null);
    setPendingCategorySlug(null);
    setEditingLineKey(null);
    setEditingLineQuantity(1);
  };

  const editCartLine = (line: CartLine) => {
    if (!line.customizeSnapshot) return;

    const matchingCategory = MENU_CATEGORIES.find((category) => category.name === line.categoryName);
    if (matchingCategory) {
      setActiveCategorySlug(matchingCategory.slug);
    }

    setCustomizing({
      itemId: line.itemId,
      title: line.title,
      categoryName: line.categoryName,
      basePrice: line.customizeSnapshot.basePrice,
      mode: line.customizeSnapshot.mode,
      selections: line.customizeSnapshot.selections,
      stepIndex: 0,
      hideBaseStep: line.customizeSnapshot.hideBaseStep,
      allowedProteinIds: line.customizeSnapshot.allowedProteinIds,
      servesLabel: line.customizeSnapshot.servesLabel,
    });
    setEditingLineKey(line.key);
    setEditingLineQuantity(line.quantity);
    setPendingCategorySlug(null);
  };

  const shouldShowCustomize = supportsCustomize(activeCategory.slug);

  const toggleCustomizeIngredient = (step: BuilderStep, ingredientId: string) => {
    setCustomizing((current) => {
      if (!current) return current;
      const currentChoices = current.selections[step.id] ?? [];

      let nextChoices: string[];
      if (step.type === 'single') {
        nextChoices = currentChoices[0] === ingredientId ? [] : [ingredientId];
      } else {
        nextChoices = currentChoices.includes(ingredientId)
          ? currentChoices.filter((id) => id !== ingredientId)
          : [...currentChoices, ingredientId];
      }

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
    if (!customizing) return;

    const selections = customizeSteps
      .map((step) => ({
        section: step.title,
        choices: [...(customizing.selections[step.id] ?? [])]
          .sort((a, b) => a.localeCompare(b))
          .map((id) => step.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id)
          .filter(Boolean),
      }))
      .filter((entry) => entry.choices.length > 0);

    if (editingLineKey) {
      removeDraftLine(editingLineKey);
    }

    addDraftLine({
      key: createDraftLineKey(customizing.itemId, selections),
      itemId: customizing.itemId,
      title: customizeResolved?.title ?? customizing.title,
      categoryName: customizing.categoryName,
      unitPrice: customizeUnitPrice,
      quantity: Math.max(1, editingLineQuantity),
      selections,
      customizeSnapshot: {
        mode: customizing.mode,
        selections: customizing.selections,
        basePrice: customizeResolved?.basePrice ?? customizing.basePrice,
        hideBaseStep: customizing.hideBaseStep,
        allowedProteinIds: customizing.allowedProteinIds,
        servesLabel: customizing.servesLabel,
      },
    });

    closeCustomize();
    setErrors((previous) => ({ ...previous, customize: '' }));
  };

  const customizeBack = () => {
    setCustomizing((current) => {
      if (!current) return current;
      return { ...current, stepIndex: Math.max(0, current.stepIndex - 1) };
    });
  };

  const customizeNext = () => {
    setCustomizing((current) => {
      if (!current) return current;
      const step = customizeSteps[current.stepIndex];
      if (!step) return current;

      if (step.required && (current.selections[step.id] ?? []).length === 0) {
        setErrors((previous) => ({ ...previous, customize: `Please choose at least one ${step.title.toLowerCase()}.` }));
        return current;
      }

      setErrors((previous) => ({ ...previous, customize: '' }));
      return { ...current, stepIndex: Math.min(customizeSteps.length - 1, current.stepIndex + 1) };
    });
  };

  const validateOrder = () => {
    const next: Record<string, string> = {};

    if (!customer.fullName.trim()) {
      next.fullName = 'Name is required.';
    }

    const phone = normalizePhone(customer.phone);
    if (phone.length !== 10) {
      next.phone = 'Enter a valid 10-digit phone number.';
    }

    const email = normalizeEmail(customer.email);
    if (!email) {
      next.email = 'Email is required for order confirmation.';
    } else if (!isValidEmail(email)) {
      next.email = 'Enter a valid email address.';
    }

    if (cartLines.length === 0) {
      next.cart = 'Add at least one item before placing order.';
    }

    if (selectedRewardIds.some((rewardId) => !availableCheckoutRewards.some((offer) => offer.id === rewardId))) {
      next.reward = 'One or more selected rewards are no longer available. Please reselect.';
    }

    const rewardValidationMessage = getRewardValidationMessage(selectedRewardIds);
    if (rewardValidationMessage) {
      next.reward = rewardValidationMessage;
    }

    if (!selectedStoreId || !stores.some((store) => store.id === selectedStoreId && store.isActive)) {
      next.store = 'Select a valid pickup store.';
    }

    if (selectedPaymentMethod !== 'upi' && selectedPaymentMethod !== 'card') {
      next.paymentMethod = 'Choose UPI or Card to continue.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toggleCheckoutReward = (rewardId: string) => {
    setSelectedRewardIds((previous) => {
      const alreadySelected = previous.includes(rewardId);
      if (alreadySelected) {
        const nextSelection = previous.filter((entry) => entry !== rewardId);
        setErrors((current) => ({ ...current, reward: getRewardValidationMessage(nextSelection) }));
        return nextSelection;
      }

      const nextSelection = [...previous, rewardId];
      const rewardValidationMessage = getRewardValidationMessage(nextSelection);
      if (rewardValidationMessage) {
        setErrors((current) => ({ ...current, reward: rewardValidationMessage }));
        return previous;
      }

      setErrors((current) => ({ ...current, reward: '' }));
      return nextSelection;
    });
  };

  const placeFromCart = () => {
    if (submissionLockRef.current || isSubmitting) {
      return;
    }
    if (!validateOrder()) return;

    // Show review modal instead of immediately placing order
    setShowReviewModal(true);
  };

  const runRazorpayCheckout = async (intent: CheckoutPaymentIntent): Promise<PaymentLaunchResult> => {
    if (!intent.gatewayOrderId || !intent.gatewayKeyId) {
      return {
        outcome: 'failed',
        message: 'Payment gateway is unavailable for this checkout attempt. Please retry.',
      };
    }

    await ensureRazorpayScript();

    return new Promise((resolve) => {
      if (!window.Razorpay) {
        resolve({ outcome: 'failed', message: 'Could not initialize payment checkout. Please try again.' });
        return;
      }

      const razorpay = new window.Razorpay({
        key: intent.gatewayKeyId,
        amount: intent.amountPaise,
        currency: intent.currency,
        name: 'CULTIV',
        description: 'Pickup order payment',
        order_id: intent.gatewayOrderId,
        prefill: {
          name: customer.fullName,
          contact: normalizePhone(customer.phone),
          email: normalizeEmail(customer.email),
        },
        method: {
          upi: intent.paymentMethod === 'upi',
          card: intent.paymentMethod === 'card',
          netbanking: false,
          wallet: false,
          emi: false,
          paylater: false,
        },
        modal: {
          ondismiss: () => {
            resolve({ outcome: 'cancelled', message: 'Payment was cancelled. Your cart is still saved.' });
          },
        },
        handler: (response: RazorpaySuccessPayload) => {
          resolve({
            outcome: 'succeeded',
            payload: {
              gatewayOrderId: response.razorpay_order_id,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature,
            },
          });
        },
      });

      razorpay.on('payment.failed', (response: any) => {
        resolve({
          outcome: 'failed',
          message: response?.error?.description || 'Payment failed. Please retry.',
          payload: {
            gatewayOrderId: response?.error?.metadata?.order_id ?? intent.gatewayOrderId,
            gatewayPaymentId: response?.error?.metadata?.payment_id,
          },
        });
      });

      razorpay.open();
    });
  };

  const runMockCheckout = async (intent: CheckoutPaymentIntent, orderInput: PlaceOrderInput): Promise<PaymentLaunchResult> => {
    const paymentReference = intent.gatewayOrderId || `mock_order_${intent.paymentId.slice(0, 10)}`;

    return new Promise((resolve) => {
      mockPaymentResolverRef.current = resolve;
      setMockPaymentSession({
        paymentMethod: intent.paymentMethod,
        amount: orderInput.total,
        itemCount: orderInput.items.reduce((sum, item) => sum + item.quantity, 0),
        customerName: orderInput.fullName,
        paymentReference,
        idempotencyKey: intent.idempotencyKey,
      });
    });
  };

  const finalizeMockPaymentDecision = (outcome: 'succeeded' | 'failed' | 'cancelled') => {
    setMockPaymentSession((current) => {
      if (!current) return current;

      const resolver = mockPaymentResolverRef.current;
      mockPaymentResolverRef.current = null;

      const paymentReference = current.paymentReference;
      if (outcome === 'succeeded') {
        const mockGatewayPaymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        resolver?.({
          outcome: 'succeeded',
          payload: {
            gatewayOrderId: paymentReference,
            gatewayPaymentId: mockGatewayPaymentId,
            gatewaySignature: `mock_sig_${mockGatewayPaymentId.slice(-6)}`,
          },
        });
      } else if (outcome === 'failed') {
        resolver?.({
          outcome: 'failed',
          message: 'Payment failed. Please retry.',
          payload: {
            gatewayOrderId: paymentReference,
          },
        });
      } else {
        resolver?.({
          outcome: 'cancelled',
          message: 'Payment was cancelled. Your cart is still saved.',
          payload: {
            gatewayOrderId: paymentReference,
          },
        });
      }

      return current;
    });

    setTimeout(() => {
      setMockPaymentSession(null);
    }, 120);
  };

  const launchCheckoutPayment = async (intent: CheckoutPaymentIntent, orderInput: PlaceOrderInput): Promise<PaymentLaunchResult> => {
    const provider = resolveCheckoutPaymentProvider(intent.gateway);
    if (provider === 'mock') {
      return runMockCheckout(intent, orderInput);
    }

    return runRazorpayCheckout(intent);
  };

  const confirmAndPlaceOrder = async () => {
    if (submissionLockRef.current || isSubmitting) {
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setGuestOrderConfirmation(null);
    try {
      const orderInput: PlaceOrderInput = {
        category: 'Central Ordering',
        storeId: selectedStoreId,
        items: [
          ...cartLines.map((line) => ({
            id: line.itemId,
            category: line.categoryName,
            title: line.title,
            selections: line.selections ?? [],
            quantity: line.quantity,
            price: line.unitPrice,
          })),
          ...selectedFreeRewardItems,
        ],
        orderType: 'pickup',
        subtotal: cartTotal,
        rewardDiscount,
        tipPercentage,
        tipAmount,
        usedRewardIds: selectedRewardIds,
        total: payableTotal,
        paymentMethod: selectedPaymentMethod,
        fullName: customer.fullName.trim(),
        phone: normalizePhone(customer.phone),
        email: normalizeEmail(customer.email),
      };

      const paymentIntent = await createCheckoutPaymentIntent(orderInput);
      const paymentResult = await launchCheckoutPayment(paymentIntent, orderInput);

      if (paymentResult.outcome === 'cancelled') {
        await confirmCheckoutPayment({
          paymentId: paymentIntent.paymentId,
          outcome: 'cancelled',
          gatewayOrderId: paymentResult.payload?.gatewayOrderId ?? paymentIntent.gatewayOrderId,
          gatewayPaymentId: paymentResult.payload?.gatewayPaymentId,
          failureReason: paymentResult.message || 'Payment was cancelled.',
        });
        setErrors((previous) => ({ ...previous, submit: paymentResult.message || 'Payment was cancelled.' }));
        return;
      }

      if (paymentResult.outcome === 'failed') {
        await confirmCheckoutPayment({
          paymentId: paymentIntent.paymentId,
          outcome: 'failed',
          gatewayOrderId: paymentResult.payload?.gatewayOrderId ?? paymentIntent.gatewayOrderId,
          gatewayPaymentId: paymentResult.payload?.gatewayPaymentId,
          failureReason: paymentResult.message || 'Payment failed.',
        });
        setErrors((previous) => ({ ...previous, submit: paymentResult.message || 'Payment failed.' }));
        return;
      }

      if (!paymentResult.payload?.gatewayOrderId || !paymentResult.payload?.gatewayPaymentId) {
        throw new Error('Payment response is incomplete. Please retry checkout.');
      }

      const confirmed = await confirmCheckoutPayment({
        paymentId: paymentIntent.paymentId,
        orderInput,
        outcome: 'succeeded',
        gatewayOrderId: paymentResult.payload.gatewayOrderId,
        gatewayPaymentId: paymentResult.payload.gatewayPaymentId,
        gatewaySignature: paymentResult.payload.gatewaySignature,
      });

      if (!confirmed.success || !confirmed.order) {
        throw new Error(confirmed.message || 'Payment captured but order could not be confirmed.');
      }

      const placedOrder = confirmed.order;
      clearDraftCart();
      setCartLines([]);
      setSelectedRewardIds([]);
      setErrors({ submit: '' });
      setShowReviewModal(false);

      // Navigate to new order success screen (not order history)
      navigate(`/order-success/${placedOrder.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not place order. Please try again.';
      setErrors((previous) => ({ ...previous, submit: errorMessage }));
    } finally {
      setIsSubmitting(false);
      submissionLockRef.current = false;
    }
  };

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_6%_10%,rgba(45,80,22,0.12),transparent_24%),radial-gradient(circle_at_94%_16%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] pb-24 lg:h-screen lg:overflow-hidden lg:pb-0">
      <div className="pt-24 md:pt-28 lg:h-full lg:pb-6">
        <div className="mx-auto w-full h-full px-3 sm:px-5 lg:grid lg:grid-cols-[210px_minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-4 xl:grid-cols-[230px_minmax(0,1fr)_390px] xl:gap-x-6 2xl:grid-cols-[250px_minmax(0,1fr)_420px] 2xl:gap-x-8">
            <div className="px-3 py-3 text-sm text-foreground/58 lg:col-span-3 xl:px-2">
              <div className="flex flex-wrap items-center gap-3">
                <span>Siddipet Central</span>
                <span className="h-1 w-1 rounded-full bg-foreground/35" />
                <span>Pickup</span>
                <span className="h-1 w-1 rounded-full bg-foreground/35" />
                <span>{PICKUP_ESTIMATE_WINDOW}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-foreground/56">
                <span className="rounded-full bg-white/82 px-2.5 py-1">Menu</span>
                <span>→</span>
                <span className="rounded-full bg-white/82 px-2.5 py-1">Cart</span>
                <span>→</span>
                <span className="rounded-full bg-white/82 px-2.5 py-1">Checkout</span>
                <span>→</span>
                <span className="rounded-full bg-white/82 px-2.5 py-1">Confirmation</span>
              </div>
            </div>

            <aside className="bg-transparent px-2 py-4 lg:min-h-0 lg:overflow-hidden xl:px-3">
              <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45">Menu</p>
              <div className="flex gap-2 overflow-x-auto pb-1.5 pr-1 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0 lg:pr-0">
                {categories.map((category) => {
                  const active = category.slug === activeCategory.slug;
                  const isPending = category.slug === pendingCategorySlug;
                  return (
                    <motion.button
                      layout
                      key={category.slug}
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      onClick={() => {
                        if (customizing && category.slug !== activeCategorySlug) {
                          setPendingCategorySlug(category.slug);
                        } else {
                          setActiveCategorySlug(category.slug);
                        }
                      }}
                      className={`min-h-[44px] w-auto shrink-0 whitespace-nowrap rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-all duration-200 lg:min-h-0 lg:w-full lg:shrink lg:whitespace-normal lg:px-3 lg:py-2.5 ${
                        active
                          ? 'bg-primary text-white shadow-[0_8px_18px_rgba(45,80,22,0.22)]'
                          : isPending
                          ? 'bg-amber-100 text-amber-800'
                          : customizing
                          ? 'text-foreground/38 hover:bg-white/60 hover:text-foreground/60'
                          : 'text-foreground/70 hover:bg-white/75 hover:text-foreground'
                      }`}
                    >
                      {category.name}
                    </motion.button>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 bg-transparent px-3 py-5 md:px-4 md:py-7 xl:px-2 xl:py-8 lg:min-h-0 lg:overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                {!customizing ? (
                  <motion.div
                    key={`browse-${activeCategory.slug}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    <div className="mb-7 rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,250,242,0.68))] px-5 py-4 shadow-[0_10px_28px_rgba(20,35,10,0.045)] backdrop-blur-[1.5px]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        {activeCategoryContext?.accentLabel ? (
                          <p className="mb-2 inline-flex rounded-full border border-primary/16 bg-[linear-gradient(165deg,rgba(255,255,255,0.95),rgba(240,246,232,0.95))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/76 shadow-[0_6px_16px_rgba(20,35,10,0.08)]">
                            {activeCategoryContext.accentLabel}
                          </p>
                        ) : null}
                        <h1 className="text-3xl font-semibold tracking-tight">{activeCategory.name}</h1>
                        <p className="mt-1.5 text-sm text-foreground/62">{activeCategory.description}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foreground/44">{activeCategory.items.length} items</p>
                    </div>
                    <p className="mt-3 text-xs text-foreground/54">{activeCategoryContext?.helperText ?? 'Scan quickly and add what you need.'}</p>
                  </div>

                    <div className="space-y-9">
                      {activeCategorySections.map((section, sectionIndex) => (
                        <section key={section.id} className={sectionIndex < activeCategorySections.length - 1 ? 'pb-4 md:pb-6' : ''}>
                        <div className="mb-3.5 flex items-end justify-between gap-4">
                          <div>
                            {section.accentLabel ? (
                              <p className="mb-2 inline-flex rounded-full border border-primary/16 bg-[linear-gradient(165deg,rgba(255,255,255,0.95),rgba(240,246,232,0.95))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/76 shadow-[0_6px_16px_rgba(20,35,10,0.08)]">
                                {section.accentLabel}
                              </p>
                            ) : null}
                            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{section.title}</h2>
                            <p className="mt-1 text-sm text-foreground/58">{section.subtitle}</p>
                          </div>
                          <p className="text-xs uppercase tracking-[0.16em] text-foreground/44">{section.items.length} items</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                          {(expandedSections[section.id] ? section.items : section.items.slice(0, 4)).map((item) => {
                            const drinkChip = activeCategory.slug === 'drinks-juices' ? (item as DrinkItem).sectionChip : null;
                            return (
                              <article key={item.id} className="group overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(251,252,248,0.9))] shadow-[0_7px_20px_rgba(20,35,10,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(20,35,10,0.07)]">
                                <div className="relative h-36 overflow-hidden">
                                  <ImageWithFallback src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                  {item.badge ? (
                                    <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/68 backdrop-blur-sm">
                                      {item.badge}
                                    </span>
                                  ) : null}
                                  {!item.badge && drinkChip ? (
                                    <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/68 backdrop-blur-sm">
                                      {drinkChip}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-1 flex-col p-4">
                                  <h3 className="text-[15px] font-semibold leading-snug">{item.name}</h3>
                                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/60">{item.description}</p>
                                  {activeCategory.slug === 'build-your-own-bowl' ? (
                                    <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary/70">Serves 4-5 people</p>
                                  ) : null}
                                  {activeCategory.slug !== 'drinks-juices' ? (
                                    <div className="mt-1.5 text-[11px] text-foreground/52">{item.calories} cal · {item.protein}g protein</div>
                                  ) : null}
                                  <div className="mt-3.5">
                                    <span className="text-lg font-semibold tabular-nums">₹{item.price}</span>
                                    <div className={`mt-4 grid gap-2.5 ${shouldShowCustomize ? 'grid-cols-[1.12fr_1fr]' : 'grid-cols-1'}`}>
                                      <motion.button
                                        type="button"
                                        onClick={() => addToCart(item)}
                                        whileTap={{ scale: 0.985 }}
                                        animate={recentlyAddedItemId === item.id ? { scale: [1, 1.03, 1], opacity: [1, 0.92, 1] } : { scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.26, ease: 'easeOut' }}
                                        className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 md:min-h-0 md:px-3.5 md:py-2"
                                      >
                                        {recentlyAddedItemId === item.id ? 'Added' : 'Quick Add'}
                                      </motion.button>
                                      {shouldShowCustomize ? (
                                        <button
                                          type="button"
                                          onClick={() => openCustomize(item)}
                                          className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center rounded-full border border-primary/16 bg-white/92 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/6 md:min-h-0 md:px-3.5 md:py-2"
                                        >
                                          Customize Item
                                        </button>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-[11px] text-foreground/52">You can edit this later in cart.</p>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        {section.items.length > 4 ? (
                          <div className="mt-3 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setExpandedSections((previous) => ({ ...previous, [section.id]: !previous[section.id] }))}
                              className="rounded-full border border-primary/14 bg-white/88 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                            >
                              {expandedSections[section.id] ? 'Show Fewer Choices' : `Show More Choices (${section.items.length - 4})`}
                            </button>
                          </div>
                        ) : null}
                      </section>
                    ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`customize-${customizing?.itemId ?? 'active'}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.26, ease: 'easeOut' }}
                  >
                    {pendingCategorySlug ? (
                    <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Discard this build?</p>
                        <p className="mt-0.5 text-xs text-amber-700">Switching away will lose your current customization.</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingCategorySlug(null)}
                          className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                        >
                          Keep building
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeCustomize();
                            setActiveCategorySlug(pendingCategorySlug);
                            setPendingCategorySlug(null);
                          }}
                          className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mb-5 rounded-2xl border border-primary/12 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">Customization</p>
                    <h2 className="mt-2 text-2xl font-semibold">{customizeResolved?.title ?? customizing.title}</h2>
                    {customizing.mode === 'breakfast' && customizeResolved?.breakfastPower ? (
                      <p className="mt-1.5 inline-flex rounded-full bg-primary/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                        Power Bowl
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-foreground/62">Step {customizing.stepIndex + 1} of {customizeSteps.length}</p>
                    {customizing.servesLabel ? <p className="mt-1 text-xs text-foreground/54">{customizing.servesLabel}</p> : null}
                  </div>

                  {customizeStep ? (
                    <>
                      <div className="mb-4">
                        <h3 className="text-xl font-semibold">{customizeStep.title}</h3>
                        <p className="text-sm text-foreground/62">{customizeStep.subtitle}</p>
                        {errors.customize ? <p className="mt-2 text-xs text-red-600">{errors.customize}</p> : null}
                      </div>

                      <motion.div 
                        layout
                        key={`step-${customizing.stepIndex}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="grid grid-cols-1 gap-3 md:grid-cols-2"
                      >
                        {customizeStep.ingredients.map((ingredient) => {
                          if (customizeStep.id === 'fruits' && !BREAKFAST_AVAILABLE_FRUIT_IDS.includes(ingredient.id)) {
                            return null;
                          }
                          const selected = (customizing.selections[customizeStep.id] ?? []).includes(ingredient.id);
                          return (
                            <motion.button
                              key={ingredient.id}
                              type="button"
                              onClick={() => toggleCustomizeIngredient(customizeStep, ingredient.id)}
                              whileHover={{ scale: 1.02, y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              animate={selected ? { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-alpha-6)' } : {}}
                              className={`rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-primary bg-primary/6' : 'border-primary/12 bg-white hover:border-primary/30'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{ingredient.name}</p>
                                  {ingredient.description ? <p className="mt-1 text-sm text-foreground/58">{ingredient.description}</p> : null}
                                  <p className="mt-2 text-xs text-foreground/52">{ingredient.calories} cal · {ingredient.protein}g protein</p>
                                </div>
                                <div className="text-right">
                                  {ingredient.price > 0 ? <p className="text-sm font-semibold">+₹{ingredient.price}</p> : null}
                                  <motion.span 
                                    layout
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={`mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary text-white' : 'border-primary/22 bg-white'}`}
                                  >
                                    {selected ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.08 }}><Check className="h-3 w-3" /></motion.div> : null}
                                  </motion.span>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </motion.div>

                      <div className="mt-6 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2.5 sm:flex-nowrap sm:gap-2">
                          <button
                            type="button"
                            onClick={closeCustomize}
                            className="min-h-[44px] rounded-full border border-primary/16 bg-white px-[18px] py-2.5 text-sm font-medium text-foreground/70 sm:min-h-0 sm:px-4 sm:py-2"
                          >
                            Cancel
                          </button>
                          {customizing.stepIndex > 0 ? (
                            <button
                              type="button"
                              onClick={customizeBack}
                              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-primary/16 bg-white px-[18px] py-2.5 text-sm font-medium text-foreground/70 sm:min-h-0 sm:gap-1 sm:px-4 sm:py-2"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Back
                            </button>
                          ) : null}
                        </div>

                        {customizing.stepIndex < customizeSteps.length - 1 ? (
                          <button
                            type="button"
                            onClick={customizeNext}
                            className="inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-5.5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 sm:min-h-0 sm:w-auto sm:gap-1 sm:px-5"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={addCustomizedToCart}
                            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-5.5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 sm:min-h-0 sm:w-auto sm:px-5"
                          >
                            <ShoppingBag className="h-4 w-4" />
                            {editingLineKey ? `Update Item · ₹${customizeUnitPrice}` : `Add Customized · ₹${customizeUnitPrice}`}
                          </button>
                        )}
                      </div>
                    </>
                  ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <aside id="checkout-panel" className="bg-transparent p-3 md:p-4 lg:min-h-0 lg:overflow-hidden xl:p-5">
              {/* Flex-column card: header pinned top, scrollable body, CTA pinned bottom */}
              <div className="flex h-full flex-col rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,244,0.94))] shadow-[0_18px_42px_rgba(20,35,10,0.085)]">

                {/* ── Header (always visible) ── */}
                <div className="flex-none px-4 pb-1 pt-4 md:px-5 md:pt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45">Your Order</p>
                  <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">Cart</h2>
                </div>

                {/* ── Scrollable body ── */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 md:px-5">
                  <div className="mt-3 space-y-2 pr-0.5">
                  {customizing ? (
                    <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Building now</p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug">{customizeResolved?.title ?? customizing.title}</p>
                          <div className="mt-1.5 space-y-0.5">
                            {customizeSteps.slice(0, customizing.stepIndex + 1).map((step) => {
                              const choices = (customizing.selections[step.id] ?? [])
                                .map((id) => step.ingredients.find((ing) => ing.id === id)?.name ?? id)
                                .filter(Boolean);
                              if (!choices.length) return null;
                              return (
                                <p key={step.id} className="text-[11px] text-foreground/55">
                                  <span className="font-medium text-foreground/65">{step.title}:</span>{' '}{choices.join(', ')}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                        <p className="shrink-0 text-base font-bold text-primary">₹{customizeUnitPrice}</p>
                      </div>
                      <p className="mt-2 text-[10px] text-primary/55">Step {customizing.stepIndex + 1} of {customizeSteps.length} · finish to add</p>
                    </div>
                  ) : null}
                  {cartLines.length === 0 && !customizing ? (
                    <p className="rounded-2xl border border-primary/12 bg-[#f8faf4] px-4 py-6 text-center text-sm text-foreground/58">
                      Your cart is empty. Add items from the middle panel.
                    </p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {cartLines.map((line) => (
                      <motion.div
                        key={line.key}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-primary/12 bg-[#f9fbf6] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-snug">{line.title}</p>
                            <p className="mt-0.5 text-xs text-foreground/56 tabular-nums">₹{line.unitPrice} each</p>
                            {line.selections && line.selections.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {line.selections.map((selection) => (
                                  <p key={`${line.key}-${selection.section}`} className="text-[11px] leading-snug text-foreground/56">
                                    <span className="font-medium text-foreground/66">{selection.section}:</span>{' '}
                                    {selection.choices.join(', ')}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {line.customizeSnapshot ? (
                              <button
                                type="button"
                                onClick={() => editCartLine(line)}
                                className="text-xs font-medium text-primary/70 hover:text-primary"
                              >
                                Edit
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeLine(line.key)}
                              className="text-xs font-medium text-foreground/48 hover:text-foreground"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <motion.button
                              type="button"
                              onClick={() => updateQuantity(line.key, 'dec')}
                              whileTap={{ scale: 0.9 }}
                              aria-label={`Decrease quantity for ${line.title}`}
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/16 bg-white transition-transform active:scale-95 md:h-7 md:w-7"
                            >
                              <Minus className="h-4 w-4 md:h-3.5 md:w-3.5" />
                            </motion.button>
                            <motion.span 
                              key={line.quantity}
                              initial={{ scale: 1.2 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              className="w-8 text-center text-sm font-semibold tabular-nums"
                            >
                              {line.quantity}
                            </motion.span>
                            <motion.button
                              type="button"
                              onClick={() => updateQuantity(line.key, 'inc')}
                              whileTap={{ scale: 0.9 }}
                              aria-label={`Increase quantity for ${line.title}`}
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/16 bg-white transition-transform active:scale-95 md:h-7 md:w-7"
                            >
                              <Plus className="h-4 w-4 md:h-3.5 md:w-3.5" />
                            </motion.button>
                          </div>
                          <motion.span 
                            key={`total-${line.unitPrice}-${line.quantity}`}
                            initial={{ scale: 1.1, opacity: 0.6 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="text-sm font-semibold tabular-nums"
                          >
                            ₹{line.unitPrice * line.quantity}
                          </motion.span>
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                  )}
                  </div>

                  <div className="mt-3 rounded-2xl border border-primary/10 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/45">Order Summary</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground/60">Items ({cartCount}{customizing ? ' + 1 building' : ''})</span>
                        <span className="tabular-nums font-medium">₹{cartTotal.toFixed(2)}</span>
                      </div>
                      {customizing ? (
                        <div className="flex items-center justify-between text-sm text-foreground/60">
                          <span>Building</span>
                          <span className="tabular-nums">₹{customizeUnitPrice}</span>
                        </div>
                      ) : null}
                      {rewardDiscount > 0 ? (
                        <div className="flex items-center justify-between text-sm text-primary/80">
                          <span>Reward discount</span>
                          <span className="tabular-nums font-medium">−₹{rewardDiscount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-sm text-foreground/60">
                        <span>Taxable subtotal</span>
                        <span className="tabular-nums">₹{taxableSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-foreground/60">
                        <span>GST (5%)</span>
                        <span className="tabular-nums">₹{gstAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 border-t border-primary/8 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Tip (optional)</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {([
                          { value: 'none', label: 'No Tip' },
                          { value: '5', label: '5%' },
                          { value: '10', label: '10%' },
                          { value: '15', label: '15%' },
                          { value: 'custom', label: 'Custom' },
                        ] as Array<{ value: TipOption; label: string }>).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedTipOption(option.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${selectedTipOption === option.value ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground/70 hover:border-primary/40'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {selectedTipOption === 'custom' ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customTipInput}
                          onChange={(event) => setCustomTipInput(event.target.value)}
                          placeholder="Enter custom tip"
                          className="mt-2 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary/30"
                        />
                      ) : null}
                      {tipAmount > 0 ? (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-foreground/60">Tip amount</span>
                          <span className="tabular-nums font-medium text-foreground/88">₹{tipAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>

                    <motion.div 
                      key={`payable-${payableTotal}`}
                      initial={{ scale: 0.95, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                      className="mt-3 flex items-center justify-between border-t border-primary/10 pt-3 text-lg font-semibold"
                    >
                      <span>Total Amount</span>
                      <span className="tabular-nums text-primary text-xl">₹{payableTotal.toFixed(2)}</span>
                    </motion.div>
                    <div className="mt-2 flex items-center justify-between text-xs text-foreground/50">
                      <span>Pickup ready in</span>
                      <span className="font-medium">{PICKUP_ESTIMATE_WINDOW}</span>
                    </div>
                  </div>

                    {user && availableCheckoutRewards.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-primary/10 bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">Use your rewards</p>
                        <div className="mt-3 space-y-2.5">
                          {availableCheckoutRewards.map((reward) => {
                            const isSelected = selectedRewardIds.includes(reward.id);
                            const nextSelection = isSelected
                              ? selectedRewardIds.filter((id) => id !== reward.id)
                              : [...selectedRewardIds, reward.id];
                            const disabled = !isSelected && Boolean(getRewardValidationMessage(nextSelection));

                            return (
                              <button
                                key={reward.id}
                                type="button"
                                onClick={() => toggleCheckoutReward(reward.id)}
                                disabled={disabled}
                                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${isSelected ? 'border-primary/35 bg-primary/10' : 'border-primary/12 bg-[#f9fbf6] hover:border-primary/28'} ${disabled ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-2.5">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground/88">{reward.title}</p>
                                    <p className="mt-0.5 text-xs text-foreground/56">{reward.value}</p>
                                  </div>
                                  <span className="text-xs font-semibold text-primary/70">{isSelected ? 'Selected' : 'Use'}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {selectedFreeRewardItems.length > 0 ? (
                          <p className="mt-2 text-[11px] text-foreground/55">
                            Added free items: {selectedFreeRewardItems.map((item) => item.title).join(', ')}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-foreground/52">Rewards apply to your items total. Minimum order ₹{REWARD_MIN_ORDER_SUBTOTAL}.</p>
                      </div>
                    ) : null}

                  <div className="mt-3 space-y-2">
                    <div className={`rounded-xl border bg-white px-3 py-3 ${errors.paymentMethod ? 'border-red-400' : 'border-primary/14'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Payment Method</p>
                      <p className="mt-1 text-xs text-foreground/56">Prepaid checkout only. Cash at pickup is not available for website orders.</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPaymentMethod('upi');
                            setErrors((current) => ({ ...current, paymentMethod: '' }));
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selectedPaymentMethod === 'upi' ? 'border-primary bg-primary/10' : 'border-primary/15 hover:border-primary/30'}`}
                        >
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground/88">UPI</p>
                          </div>
                          <p className="mt-1 text-[11px] text-foreground/58">Pay instantly with any UPI app.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPaymentMethod('card');
                            setErrors((current) => ({ ...current, paymentMethod: '' }));
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selectedPaymentMethod === 'card' ? 'border-primary bg-primary/10' : 'border-primary/15 hover:border-primary/30'}`}
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <p className="text-sm font-semibold text-foreground/88">Card</p>
                          </div>
                          <p className="mt-1 text-[11px] text-foreground/58">Credit and debit cards supported.</p>
                        </button>
                      </div>
                    </div>
                    {errors.paymentMethod ? <p className="text-xs text-red-600">{errors.paymentMethod}</p> : null}

                    <div data-testid="order-store-select" className={`rounded-xl border bg-white px-3 py-2.5 ${errors.store ? 'border-red-400' : 'border-primary/14'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Pickup from</p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground/88">{selectedStore.name}</p>
                          <p className="text-xs text-foreground/55">{selectedStore.city} • {selectedStore.zipCode}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestOpenStoreSelector()}
                          className="rounded-full border border-primary/22 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary/38"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                    {errors.store ? <p className="text-xs text-red-600">{errors.store}</p> : null}
                    <input
                      type="text"
                      value={customer.fullName}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Full Name"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${errors.fullName ? 'border-red-400' : 'border-primary/14'}`}
                    />
                    {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone Number"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${errors.phone ? 'border-red-400' : 'border-primary/14'}`}
                    />
                    {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
                    <input
                      type="email"
                      value={customer.email}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email Address"
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${errors.email ? 'border-red-400' : 'border-primary/14'}`}
                    />
                    {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
                  </div>

                  {errors.cart ? <p className="mt-2 text-xs text-red-600">{errors.cart}</p> : null}
                  {errors.reward ? <p className="mt-1.5 text-xs text-red-600">{errors.reward}</p> : null}
                  {errors.submit ? <p className="mt-1.5 text-xs text-red-600">{errors.submit}</p> : null}

                  {guestOrderConfirmation ? (
                    <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground/75">
                      <p className="font-semibold text-primary">Order placed successfully.</p>
                      <p className="mt-1">Order number: #{guestOrderConfirmation.orderId.slice(-6)}</p>
                      <p className="mt-1">Pickup window: {guestOrderConfirmation.fulfillmentWindow ?? PICKUP_ESTIMATE_WINDOW}</p>
                    </div>
                  ) : null}
                </div>

                {/* ── Sticky footer: Place Order + optional sign-in nudge ── */}
                <div className="flex-none border-t border-primary/8 px-4 pb-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:px-5 md:pb-5">
                  <button
                    type="button"
                    onClick={placeFromCart}
                    disabled={isSubmitting || Boolean(customizing)}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {isSubmitting ? 'Processing Payment...' : customizing ? 'Finish customization to continue' : `Pay & Place Order · ₹${payableTotal.toFixed(2)}`}
                  </button>

                  {!user && showGuestAuthPrompt && cartCount > 0 ? (
                    <AuthPromptBeforeCheckout
                      fromPath="/order"
                      onDismiss={() => {
                        setShowGuestAuthPrompt(false);
                        if (isBrowser()) {
                          localStorage.setItem(GUEST_AUTH_PROMPT_DISMISSED_KEY, '1');
                        }
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </aside>
        </div>
      </div>

      {cartCount > 0 && !customizing ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.65rem)] z-30 lg:hidden">
          <button
            type="button"
            onClick={() => document.getElementById('checkout-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-primary/14 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(242,247,235,0.94))] px-[18px] py-3.5 shadow-[0_12px_28px_rgba(20,35,10,0.18)]"
          >
            <span className="min-w-0 pr-2 text-sm font-medium text-foreground/72 truncate">{cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
            <span className="shrink-0 text-sm font-semibold text-primary whitespace-nowrap">Review Cart · ₹{payableTotal.toFixed(2)}</span>
          </button>
        </div>
      ) : null}

      {/* Order Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <OrderReviewModal
            items={cartLines}
            store={selectedStore}
            customer={customer}
            subtotal={cartTotal}
            rewardDiscount={rewardDiscount}
            taxAmount={gstAmount}
            tipAmount={tipAmount}
            total={payableTotal}
            pickupEstimate={PICKUP_ESTIMATE_WINDOW}
            paymentMethod={selectedPaymentMethod}
            isSubmitting={isSubmitting}
            onConfirm={confirmAndPlaceOrder}
            onEdit={() => setShowReviewModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mockPaymentSession ? (
          <MockCheckoutPaymentModal
            paymentMethod={mockPaymentSession.paymentMethod}
            amount={mockPaymentSession.amount}
            itemCount={mockPaymentSession.itemCount}
            customerName={mockPaymentSession.customerName}
            paymentReference={mockPaymentSession.paymentReference}
            idempotencyKey={mockPaymentSession.idempotencyKey}
            onSimulateSuccess={() => finalizeMockPaymentDecision('succeeded')}
            onSimulateFailure={() => finalizeMockPaymentDecision('failed')}
            onSimulateCancel={() => finalizeMockPaymentDecision('cancelled')}
          />
        ) : null}
      </AnimatePresence>
    </PageReveal>
  );
}
