import { useEffect, useMemo, useReducer, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CreditCard, ReceiptText, ShoppingBag } from 'lucide-react';
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
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { useStoreSession } from '../../hooks/useStoreSession';
import { createInternalPosOrder } from '../../lib/internalOpsApi';
import { menuService } from '../../services/menuService';
import { posService } from '../../services/posService';
import { customerDirectoryService } from '../../services/customerDirectoryService';
import { POS_TAX_RATE } from '../../constants/business';
import { CategoryRail } from './counter-billing/CategoryRail';
import { ItemGrid } from './counter-billing/ItemGrid';
import { ItemCustomizer } from './counter-billing/ItemCustomizer';
import { CartPanel } from './counter-billing/CartPanel';
import { PaymentPanel } from './counter-billing/PaymentPanel';
import { ReceiptView } from './counter-billing/ReceiptView';
import { useReceiptData } from '../../receipts/hooks/useReceiptData';
import { printReceiptElement } from '../../receipts/utils/printReceiptElement';
import { createDraftLineKey } from '../../data/cartDraft';
import type { CounterPaymentMethod, Order, OrderItemSelection } from '../../types/platform';
import type {
  PosCartLine,
  PosCheckoutState,
  PosCustomerLookupResult,
  PosCreatedOrder,
  PosReceiptDeliveryOption,
  PosStep,
} from '../../types/pos';
import {
  calculateChangeDue,
  getPaymentValidationMessage,
  getReceiptContactErrors,
  isValidEmail,
  normalizePosPhone,
} from './counter-billing/posCheckout';

type SupportedCategorySlug =
  | 'signature-bowls'
  | 'breakfast-bowls'
  | 'high-protein-cups'
  | 'salad-bowls'
  | 'kids-meal'
  | 'drinks-juices';

type TipOption = 'none' | '5' | '10' | '15' | 'custom';

interface CustomizerState {
  item: FoodItem;
  selections: Record<string, string[]>;
  quantity: number;
  categoryName: string;
}

type CheckoutUiState = PosCheckoutState & {
  receiptDeliveryOption: PosReceiptDeliveryOption;
  receiptSuccessMessage: string | null;
};

type CheckoutAction =
  | { type: 'go_to_step'; step: PosStep }
  | { type: 'set_customer_phone'; value: string }
  | { type: 'set_customer_email'; value: string }
  | { type: 'skip_customer' }
  | { type: 'start_customer_lookup' }
  | { type: 'customer_lookup_found'; customer: PosCustomerLookupResult }
  | { type: 'customer_lookup_not_found' }
  | { type: 'customer_lookup_failed'; message: string }
  | { type: 'link_customer' }
  | { type: 'unlink_customer' }
  | { type: 'set_payment_method'; method: CounterPaymentMethod }
  | { type: 'set_cash_received'; value: string; total: number }
  | { type: 'set_exact_cash'; total: number }
  | { type: 'set_reference'; value: string }
  | { type: 'start_payment_submit' }
  | { type: 'payment_failed'; message: string }
  | { type: 'payment_succeeded'; createdOrder: PosCreatedOrder }
  | { type: 'clear_payment_error' }
  | { type: 'select_receipt_option'; option: PosReceiptDeliveryOption }
  | { type: 'start_receipt_send' }
  | { type: 'receipt_failed'; message: string }
  | { type: 'receipt_succeeded'; message: string }
  | { type: 'reset_checkout' };

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

const initialCheckoutState: CheckoutUiState = {
  step: 'cart',
  customer: {
    phone: '',
    email: '',
    skipped: false,
  },
  customerLookup: {
    status: 'idle',
    result: null,
    linkedCustomer: null,
    error: null,
  },
  payment: {
    method: null,
    cashReceived: '',
    changeDue: 0,
    reference: '',
  },
  createdOrder: null,
  isSubmittingPayment: false,
  isSendingReceipt: false,
  paymentError: null,
  receiptError: null,
  receiptDeliveryOption: 'print',
  receiptSuccessMessage: null,
};

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function checkoutReducer(state: CheckoutUiState, action: CheckoutAction): CheckoutUiState {
  switch (action.type) {
    case 'go_to_step':
      return {
        ...state,
        step: action.step,
        paymentError: action.step === 'payment' ? state.paymentError : null,
      };
    case 'set_customer_phone':
      return {
        ...state,
        customer: {
          ...state.customer,
          phone: normalizePosPhone(action.value),
          skipped: false,
        },
        customerLookup: {
          status: 'idle',
          result: null,
          linkedCustomer: null,
          error: null,
        },
        paymentError: null,
        receiptError: null,
      };
    case 'set_customer_email':
      return {
        ...state,
        customer: {
          ...state.customer,
          email: action.value,
        },
        receiptError: null,
      };
    case 'skip_customer':
      return {
        ...state,
        customer: {
          ...state.customer,
          phone: '',
          skipped: true,
        },
        customerLookup: {
          status: 'idle',
          result: null,
          linkedCustomer: null,
          error: null,
        },
        paymentError: null,
      };
    case 'start_customer_lookup':
      return {
        ...state,
        customerLookup: {
          ...state.customerLookup,
          status: 'loading',
          result: null,
          linkedCustomer: null,
          error: null,
        },
      };
    case 'customer_lookup_found':
      return {
        ...state,
        customerLookup: {
          status: 'found',
          result: action.customer,
          linkedCustomer: null,
          error: null,
        },
      };
    case 'customer_lookup_not_found':
      return {
        ...state,
        customerLookup: {
          status: 'not_found',
          result: null,
          linkedCustomer: null,
          error: null,
        },
      };
    case 'customer_lookup_failed':
      return {
        ...state,
        customerLookup: {
          status: 'idle',
          result: null,
          linkedCustomer: null,
          error: action.message,
        },
      };
    case 'link_customer':
      return state.customerLookup.result
        ? {
            ...state,
            customerLookup: {
              status: 'linked',
              result: state.customerLookup.result,
              linkedCustomer: state.customerLookup.result,
              error: null,
            },
          }
        : state;
    case 'unlink_customer':
      return {
        ...state,
        customerLookup: {
          status: state.customerLookup.result ? 'found' : 'idle',
          result: state.customerLookup.result,
          linkedCustomer: null,
          error: null,
        },
      };
    case 'set_payment_method':
      return {
        ...state,
        payment: {
          ...state.payment,
          method: action.method,
        },
        paymentError: null,
      };
    case 'set_cash_received':
      return {
        ...state,
        payment: {
          ...state.payment,
          cashReceived: action.value,
          changeDue: calculateChangeDue(action.total, action.value),
        },
        paymentError: null,
      };
    case 'set_exact_cash':
      return {
        ...state,
        payment: {
          ...state.payment,
          cashReceived: action.total.toFixed(2),
          changeDue: 0,
        },
        paymentError: null,
      };
    case 'set_reference':
      return {
        ...state,
        payment: {
          ...state.payment,
          reference: action.value,
        },
      };
    case 'start_payment_submit':
      return {
        ...state,
        isSubmittingPayment: true,
        paymentError: null,
      };
    case 'payment_failed':
      return {
        ...state,
        isSubmittingPayment: false,
        paymentError: action.message,
      };
    case 'payment_succeeded':
      return {
        ...state,
        step: 'receipt',
        createdOrder: action.createdOrder,
        isSubmittingPayment: false,
        paymentError: null,
        receiptError: null,
        receiptSuccessMessage: null,
        receiptDeliveryOption: 'print',
      };
    case 'clear_payment_error':
      return {
        ...state,
        paymentError: null,
      };
    case 'select_receipt_option':
      return {
        ...state,
        receiptDeliveryOption: action.option,
        receiptError: null,
        receiptSuccessMessage: null,
      };
    case 'start_receipt_send':
      return {
        ...state,
        isSendingReceipt: true,
        receiptError: null,
        receiptSuccessMessage: null,
      };
    case 'receipt_failed':
      return {
        ...state,
        isSendingReceipt: false,
        receiptError: action.message,
      };
    case 'receipt_succeeded':
      return {
        ...state,
        isSendingReceipt: false,
        receiptError: null,
        receiptSuccessMessage: action.message,
      };
    case 'reset_checkout':
      return initialCheckoutState;
    default:
      return state;
  }
}

function mapSelectionsToLabels(
  selections: Record<string, string[]>,
  steps: BuilderStep[],
): OrderItemSelection[] {
  const stepById = Object.fromEntries(steps.map((step) => [step.id, step]));

  return Object.entries(selections)
    .map(([stepId, selectedIds]) => ({
      section: stepById[stepId]?.title ?? stepId,
      choices: selectedIds.map(
        (id) => stepById[stepId]?.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id,
      ),
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
      basePrice = resolveBreakfastPriceFromFruitSelections(
        family,
        selections.fruits ?? [],
      ).basePrice;
    }
  }

  const extrasPrice = extras.reduce((sum, ingredient) => sum + ingredient.price, 0);
  return basePrice + extrasPrice;
}

function buildPosLineKey(itemId: string, selections: OrderItemSelection[] = []) {
  return createDraftLineKey(itemId, selections);
}

function addOrMergePosLine(previous: PosCartLine[], nextLine: PosCartLine) {
  const existing = previous.find((line) => line.key === nextLine.key);
  if (!existing) {
    return [nextLine, ...previous];
  }

  return previous.map((line) =>
    line.key === nextLine.key
      ? { ...line, quantity: Math.min(30, line.quantity + nextLine.quantity) }
      : line,
  );
}

export function CounterBillingScreen() {
  const { session, activeStoreScope, activeStoreUuid, activeStore, permissions } = useAdminDashboard();
  const { touchActivity } = useStoreSession();

  const [activeCategorySlug, setActiveCategorySlug] =
    useState<SupportedCategorySlug>('signature-bowls');
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState<MenuCategoryData[]>([]);
  const [cartLines, setCartLines] = useState<PosCartLine[]>([]);
  const [selectedTipOption, setSelectedTipOption] = useState<TipOption>('none');
  const [customTipInput, setCustomTipInput] = useState('');
  const [customizer, setCustomizer] = useState<CustomizerState | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [customizerError, setCustomizerError] = useState('');
  const [createdOrderRecord, setCreatedOrderRecord] = useState<Order | null>(null);
  const [message, setMessage] = useState<{
    tone: 'info' | 'success' | 'warning' | 'error';
    text: string;
  }>({
    tone: 'info',
    text: '',
  });
  const [checkoutState, dispatch] = useReducer(checkoutReducer, initialCheckoutState);

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
        const firstSupported = catalog.find((entry) =>
          SUPPORTED_CATEGORY_SLUGS.includes(entry.slug as SupportedCategorySlug),
        );
        if (firstSupported) {
          setActiveCategorySlug(firstSupported.slug as SupportedCategorySlug);
        }
      })
      .catch((error) => {
        console.error('Failed to load POS menu from backend.', error);
        setMenuCatalog([]);
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Unable to load the live menu right now.',
        });
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

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [cartLines],
  );

  const discountAmount = 0;
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(
    () => Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100,
    [taxableSubtotal],
  );

  const tipPercentage =
    selectedTipOption === 'custom' || selectedTipOption === 'none'
      ? 0
      : Number(selectedTipOption);

  const parsedCustomTip = Number(customTipInput || 0);

  const customTipAmount =
    selectedTipOption === 'custom' && Number.isFinite(parsedCustomTip)
      ? Math.max(0, parsedCustomTip)
      : 0;

  const tipAmount = useMemo(
    () =>
      selectedTipOption === 'custom'
        ? Math.round(customTipAmount * 100) / 100
        : Math.round(taxableSubtotal * (tipPercentage / 100) * 100) / 100,
    [selectedTipOption, customTipAmount, taxableSubtotal, tipPercentage],
  );

  const total = taxableSubtotal + taxAmount + tipAmount;
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const storeName = activeStore?.name ?? 'CULTIV';
  const paymentValidationMessage = getPaymentValidationMessage({
    cartCount: cartLines.length,
    total,
    payment: checkoutState.payment,
  });
  const { data: receiptData } = useReceiptData(createdOrderRecord ?? undefined, {
    authMode: 'internal',
  });

  const addItemToCart = (item: FoodItem) => {
    void touchActivity();

    const preset = PRESETS_BY_ITEM_ID[item.id];

    if (preset) {
      const selections = mapSelectionsToLabels(preset.defaultSelections, getCustomizeSteps(item.id));
      const nextLine: PosCartLine = {
        id: createId('line'),
        key: buildPosLineKey(item.id, selections),
        itemId: item.id,
        title: preset.title,
        category: preset.categoryName,
        quantity: 1,
        unitPrice: preset.basePrice,
        selections,
      };

      setCartLines((previous) => addOrMergePosLine(previous, nextLine));
      return;
    }

    const nextLine: PosCartLine = {
      id: createId('line'),
      key: buildPosLineKey(item.id),
      itemId: item.id,
      title: item.name,
      category: activeCategory?.name ?? 'POS',
      quantity: 1,
      unitPrice: item.price,
      selections: [],
    };

    setCartLines((previous) => addOrMergePosLine(previous, nextLine));
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

    const menuCategory = menuCatalog.find((entry) =>
      entry.items.some((item) => item.id === line.itemId),
    );
    const item = menuCategory?.items.find((entry) => entry.id === line.itemId);

    if (!item) {
      setMessage({
        tone: 'warning',
        text: 'This item cannot be edited because it is no longer in the current menu.',
      });
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
      const nextChoices =
        step.type === 'single'
          ? currentChoices[0] === ingredientId
            ? []
            : [ingredientId]
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

  const addCustomizedToCart = () => {
    void touchActivity();

    if (!customizer) return;

    const steps = getCustomizeSteps(customizer.item.id);
    const missingRequired = steps.find(
      (step) => step.required && (customizer.selections[step.id] ?? []).length === 0,
    );

    if (missingRequired) {
      setCustomizerError(
        `Please select ${missingRequired.title.toLowerCase()} before adding to cart.`,
      );
      return;
    }

    const unitPrice = calculateUnitPrice(customizer.item, customizer.selections);
    const selections = steps
      .map((step) => ({
        section: step.title,
        choices: [...(customizer.selections[step.id] ?? [])]
          .sort((left, right) => left.localeCompare(right))
          .map((id) => step.ingredients.find((ingredient) => ingredient.id === id)?.name ?? id)
          .filter(Boolean),
      }))
      .filter((entry) => entry.choices.length > 0);

    setCartLines((previous) => {
      const nextLine: PosCartLine = {
        id: createId('line'),
        key: buildPosLineKey(customizer.item.id, selections),
        itemId: customizer.item.id,
        title: customizer.item.name,
        category: customizer.categoryName,
        quantity: customizer.quantity,
        unitPrice,
        selections,
      };

      if (editingLineId) {
        return addOrMergePosLine(
          previous.filter((line) => line.id !== editingLineId),
          nextLine,
        );
      }

      return addOrMergePosLine(previous, nextLine);
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
    setCartLines((previous) =>
      previous.map((line) =>
        line.id === lineId ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    );
  };

  const decrementLine = (lineId: string) => {
    void touchActivity();
    setCartLines((previous) =>
      previous.map((line) =>
        line.id === lineId ? { ...line, quantity: Math.max(1, line.quantity - 1) } : line,
      ),
    );
  };

  const removeLine = (lineId: string) => {
    void touchActivity();
    setCartLines((previous) => previous.filter((line) => line.id !== lineId));
  };

  const continueToPayment = () => {
    if (cartLines.length === 0) return;
    dispatch({ type: 'go_to_step', step: 'payment' });
  };

  const handleCompletePayment = async () => {
    void touchActivity();

    if (checkoutState.isSubmittingPayment) return;
    if (activeStoreScope === 'all' || !checkoutState.payment.method) return;

    if (paymentValidationMessage) {
      dispatch({ type: 'payment_failed', message: paymentValidationMessage });
      return;
    }

    dispatch({ type: 'start_payment_submit' });

    try {
      if (!session) {
        throw new Error('Internal session expired. Please sign in again before completing checkout.');
      }

      const createResult = await posService.checkoutOrder(
        {
          storeId: activeStoreUuid || activeStore?.id || '',
          orderChannel: 'in_store',
          customerPhone: checkoutState.customer.phone || undefined,
          customerEmail: isValidEmail(checkoutState.customer.email)
            ? checkoutState.customer.email.trim()
            : undefined,
          linkedCustomerId: checkoutState.customerLookup.linkedCustomer?.customerId,
          paymentMethod: checkoutState.payment.method,
          paymentReference: checkoutState.payment.reference.trim() || undefined,
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
        },
        {
          createPosOrder: async (payload) => {
            const { data, error } = await createInternalPosOrder({
              internalSessionToken: session.internalSessionToken,
              ...payload,
            });

            if (error || !data) {
              throw new Error(error ?? 'POS checkout could not be completed.');
            }

            return data;
          },
        },
      );

      const createdOrder = posService.mapCreatedOrder(createResult);
      dispatch({ type: 'payment_succeeded', createdOrder });
      setCreatedOrderRecord(createResult.order);
      setCartLines([]);
      setSelectedTipOption('none');
      setCustomTipInput('');
      setMessage({
        tone: 'success',
        text: `Payment captured for order #${createdOrder.orderNumber}.`,
      });
    } catch (error) {
      dispatch({
        type: 'payment_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Payment could not be completed. Please retry.',
      });
    }
  };

  const handleFindCustomer = async () => {
    void touchActivity();

    if (checkoutState.customerLookup.status === 'loading') return;

    dispatch({ type: 'start_customer_lookup' });

    try {
      if (!session) {
        throw new Error('Internal session expired. Please sign in again before linking a customer.');
      }

      const result = await customerDirectoryService.lookupPosCustomerByPhone(session, checkoutState.customer.phone);
      if (result) {
        dispatch({ type: 'customer_lookup_found', customer: result });
        return;
      }

      dispatch({ type: 'customer_lookup_not_found' });
    } catch (error) {
      dispatch({
        type: 'customer_lookup_failed',
        message: error instanceof Error ? error.message : 'Customer lookup failed. Please try again.',
      });
    }
  };

  const handleSendReceipt = async () => {
    void touchActivity();

    if (!checkoutState.createdOrder || checkoutState.isSendingReceipt) return;

    const contactErrors = getReceiptContactErrors(
      checkoutState.receiptDeliveryOption,
      checkoutState.customer,
    );

    if (contactErrors.phone || contactErrors.email) {
      dispatch({
        type: 'receipt_failed',
        message: contactErrors.phone || contactErrors.email || 'Receipt details are incomplete.',
      });
      return;
    }

    dispatch({ type: 'start_receipt_send' });

    try {
      if (
        checkoutState.receiptDeliveryOption === 'print' ||
        checkoutState.receiptDeliveryOption === 'all'
      ) {
        printReceiptElement();
      }

      if (
        checkoutState.receiptDeliveryOption === 'email' ||
        checkoutState.receiptDeliveryOption === 'text' ||
        checkoutState.receiptDeliveryOption === 'all'
      ) {
        await posService.sendReceipt({
          orderId: checkoutState.createdOrder.orderId,
          option: checkoutState.receiptDeliveryOption,
          phone: checkoutState.customer.phone || undefined,
          email: checkoutState.customer.email.trim() || undefined,
        });
      }

      dispatch({
        type: 'receipt_succeeded',
        message: getReceiptSuccessMessage(checkoutState.receiptDeliveryOption),
      });
    } catch (error) {
      dispatch({
        type: 'receipt_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Receipt could not be sent. Payment is safe. Try again.',
      });
    }
  };

  const resetForNewOrder = () => {
    setCartLines([]);
    setSelectedTipOption('none');
    setCustomTipInput('');
    setCreatedOrderRecord(null);
    setMessage({ tone: 'info', text: 'Ready for the next customer.' });
    dispatch({ type: 'reset_checkout' });
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
      className="space-y-3 pb-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="rounded-[20px] border border-[#E5EBDD] bg-[radial-gradient(circle_at_top_left,rgba(105,137,81,0.08),transparent_28%),linear-gradient(180deg,#FFFFFF_0%,#FAFBF7_100%)] px-3.5 py-3 shadow-[0_12px_28px_rgba(31,46,18,0.06)]">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
              In-store POS
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#667085]">{storeName}</p>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3">
            <StepPill
              icon={ShoppingBag}
              label="Cart"
              active={checkoutState.step === 'cart'}
              complete={checkoutState.step !== 'cart'}
            />
            <StepPill
              icon={CreditCard}
              label="Payment"
              active={checkoutState.step === 'payment'}
              complete={checkoutState.step === 'receipt'}
            />
            <StepPill
              icon={ReceiptText}
              label="Receipt"
              active={checkoutState.step === 'receipt'}
              complete={false}
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100dvh-246px)] gap-2.5 xl:grid-cols-[178px_minmax(0,1fr)_390px]">
        <CategoryRail
          categories={categoryList}
          activeCategorySlug={activeCategorySlug}
          onSelect={(slug) => setActiveCategorySlug(slug as SupportedCategorySlug)}
        />

        <section className="rounded-[20px] border border-border bg-background p-3.5">
          {!menuLoaded ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-center text-sm text-foreground/60">
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
              onQuantityChange={(delta) =>
                setCustomizer((current) =>
                  current
                    ? { ...current, quantity: Math.max(1, current.quantity + delta) }
                    : current,
                )
              }
              onAddToCart={addCustomizedToCart}
              submitLabel={editingLineId ? 'Update Item' : 'Add to Cart'}
            />
          ) : (
            <>
              <div className="mb-3">
                <h2 className="text-[17px] font-semibold text-foreground">{activeCategory?.name}</h2>
              </div>

              <ItemGrid items={activeItems} onAdd={addItemToCart} onCustomize={openCustomizer} />
            </>
          )}
        </section>

        <div className="flex h-[calc(100dvh-246px)] min-h-0 flex-col gap-2">
          {message.text.trim() && !(checkoutState.step === 'receipt' && message.tone === 'success') ? (
            <NoticeBanner tone={message.tone} text={message.text} />
          ) : null}

          <div className="min-h-0 flex-1">
            {checkoutState.step === 'cart' ? (
              <CartPanel
                storeName={storeName}
                cartLines={cartLines}
                subtotal={subtotal}
                discountAmount={discountAmount}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                total={total}
                selectedTipOption={selectedTipOption}
                customTipInput={customTipInput}
                onSelectTipOption={setSelectedTipOption}
                onSetCustomTipInput={setCustomTipInput}
                onIncrementLine={incrementLine}
                onDecrementLine={decrementLine}
                onEditLine={editCartLine}
                onRemoveLine={removeLine}
                onContinue={continueToPayment}
              />
            ) : null}

            {checkoutState.step === 'payment' ? (
              <PaymentPanel
                storeName={storeName}
                itemCount={itemCount}
                customer={checkoutState.customer}
                customerLookup={checkoutState.customerLookup}
                payment={checkoutState.payment}
                subtotal={subtotal}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                total={total}
                isSubmitting={checkoutState.isSubmittingPayment}
                paymentError={checkoutState.paymentError}
                onCustomerPhoneChange={(value) => dispatch({ type: 'set_customer_phone', value })}
                onFindCustomer={() => {
                  void handleFindCustomer();
                }}
                onLinkCustomer={() => dispatch({ type: 'link_customer' })}
                onRemoveLinkedCustomer={() => dispatch({ type: 'unlink_customer' })}
                onSkipCustomer={() => dispatch({ type: 'skip_customer' })}
                onSelectPaymentMethod={(method) => dispatch({ type: 'set_payment_method', method })}
                onCashReceivedChange={(value) =>
                  dispatch({ type: 'set_cash_received', value, total })
                }
                onReferenceChange={(value) => dispatch({ type: 'set_reference', value })}
                onExactCash={() => dispatch({ type: 'set_exact_cash', total })}
                onBack={() => dispatch({ type: 'go_to_step', step: 'cart' })}
                onSubmit={() => {
                  void handleCompletePayment();
                }}
              />
            ) : null}

            {checkoutState.step === 'receipt' && checkoutState.createdOrder ? (
              <ReceiptView
                createdOrder={checkoutState.createdOrder}
                customer={checkoutState.customer}
                receiptData={receiptData ?? null}
                selectedDeliveryOption={checkoutState.receiptDeliveryOption}
                isSendingReceipt={checkoutState.isSendingReceipt}
                receiptError={checkoutState.receiptError}
                receiptSuccessMessage={checkoutState.receiptSuccessMessage}
                onSelectDeliveryOption={(option) =>
                  dispatch({ type: 'select_receipt_option', option })
                }
                onCustomerPhoneChange={(value) => dispatch({ type: 'set_customer_phone', value })}
                onCustomerEmailChange={(value) => dispatch({ type: 'set_customer_email', value })}
                onSendReceipt={() => {
                  void handleSendReceipt();
                }}
                onNewOrder={resetForNewOrder}
              />
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StepPill({
  icon: Icon,
  label,
  active,
  complete,
}: {
  icon: typeof ShoppingBag;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={[
        'flex min-w-[98px] items-center gap-2 rounded-[14px] border px-2.5 py-2',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(45,80,22,0.18)]'
          : 'border-[#E5EBDD] bg-white text-[#1F2719]',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-7 w-7 items-center justify-center rounded-[10px]',
          active ? 'bg-white/15' : 'bg-primary/8 text-primary',
        ].join(' ')}
      >
        {complete && !active ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="text-[12px] font-semibold">{label}</div>
    </div>
  );
}

function NoticeBanner({
  tone,
  text,
}: {
  tone: 'info' | 'success' | 'warning' | 'error';
  text: string;
}) {
  const className =
    tone === 'success'
      ? 'border-[#D0E9D7] bg-[#ECFDF3] text-[#027A48]'
      : tone === 'warning'
        ? 'border-[#F7D79D] bg-[#FFFAEB] text-[#B54708]'
        : tone === 'error'
          ? 'border-[#F2D6D6] bg-[#FEF3F2] text-[#B42318]'
          : 'border-[#D7E2F6] bg-[#EFF4FF] text-[#175CD3]';

  return <div className={`rounded-2xl border px-3.5 py-2.5 text-[13px] font-medium ${className}`}>{text}</div>;
}

function getReceiptSuccessMessage(option: PosReceiptDeliveryOption) {
  if (option === 'all') return 'Receipt printed. Digital delivery is not enabled yet.';
  if (option === 'email') return 'Digital receipt delivery is not enabled yet.';
  if (option === 'text') return 'Digital receipt delivery is not enabled yet.';
  return 'Print dialog opened. You can print again if needed.';
}
