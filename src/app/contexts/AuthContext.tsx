// AuthContext — DB-first customer order management, loyalty tracking, and address storage.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Address,
  AuthActionResult,
  LoyaltyProfile,
  PointsActivityItem,
  PointsBatch,
  LoginInput,
  Offer,
  Order,
  OrderItem,
  OrderStatus,
  PlaceOrderInput,
  CustomerCheckoutPaymentMethod,
  CreateCounterWalkInOrderInput,
  SavedPaymentMethod,
  SavedPaymentMethodInput,
  SavedAddressInput,
  SignupInput,
  UpdateSavedPaymentMethodInput,
  UpdateSavedAddressInput,
  User,
  UserPreferences,
  WalkInLinkInput,
} from '../types/platform';
import { createEmptyLoyaltyProfile, type LoyaltyBatchSummary, type LoyaltySummary } from '../types/loyalty';
import type { PosCustomerLookupResult } from '../types/pos';
import { setDraftCartScope } from '../data/cartDraft';
import { resetShoppingSessionStorage } from '../data/shoppingSession';
import { BOWL_BUILDER_STEPS, BREAKFAST_CUSTOMIZE_STEPS } from '../data/menuData';
import { fetchOperationalOrdersFromSupabase, updateSupabaseOrderStatus } from '../data/orderRepository';
import {
  DISCOUNT_REWARD_VALUES,
  FREE_ITEM_REWARD_VALUES,
  normalizeRewardId,
  OFFER_LIBRARY,
  REWARD_ID_SET,
} from '../config/rewardsCatalog';
import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import { POS_TAX_RATE, PRICE_EPSILON, REWARD_MAX_DISCOUNT_RATIO, REWARD_MIN_ORDER_SUBTOTAL } from '../constants/business';
import type { CheckoutPaymentIntent, ConfirmCheckoutPaymentInput } from '../services/checkoutPaymentProvider';
// @ts-ignore - Supabase client is defined in JS module.
import { supabase } from '../../lib/supabase';

interface AuthRecord extends User {
  password: string;
}

interface ResetTokenRecord {
  token: string;
  userId: string;
  expiresAt: string;
}

interface PhoneChangeVerificationRecord {
  code: string;
  userId: string;
  newPhone: string;
  expiresAt: string;
}

interface InternalAccessSessionSnapshot {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
}

interface CustomerAccountSummary {
  id: string;
  reward_points: number;
  phone_verified: boolean;
  email_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  customerAccount: CustomerAccountSummary | null;
  isAuthenticated: boolean;
  orders: Order[];
  sharedOrders: Order[];
  activeOrders: Order[];
  offers: Offer[];
  loyaltyProfile: LoyaltyProfile | null;
  loyaltySummary: LoyaltySummary | null;
  loyaltyLoading: boolean;
  refreshLoyalty: () => Promise<void>;
  login: (input: LoginInput) => Promise<AuthActionResult>;
  signup: (input: SignupInput) => Promise<AuthActionResult>;
  requestPasswordReset: (identifier: string) => Promise<AuthActionResult>;
  resetPassword: (token: string, password: string) => Promise<AuthActionResult>;
  logout: () => void;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  createCheckoutPaymentIntent: (input: PlaceOrderInput) => Promise<CheckoutPaymentIntent>;
  confirmCheckoutPayment: (input: ConfirmCheckoutPaymentInput) => Promise<CheckoutPaymentResult>;
  createCounterWalkInOrder: (input: CreateCounterWalkInOrderInput) => Promise<Order>;
  lookupPosCustomerByPhone: (phone: string) => Promise<PosCustomerLookupResult | null>;
  linkWalkInOrder: (input: WalkInLinkInput) => Promise<AuthActionResult>;
  redeemReward: (offerId: string) => Promise<AuthActionResult>;
  updateProfile: (updates: Partial<Pick<User, 'fullName'>> & { preferences?: Partial<UserPreferences> }) => Promise<AuthActionResult>;
  addSavedAddress: (input: SavedAddressInput) => Promise<AuthActionResult>;
  updateSavedAddress: (input: UpdateSavedAddressInput) => Promise<AuthActionResult>;
  deleteSavedAddress: (addressId: string) => Promise<AuthActionResult>;
  setDefaultAddress: (addressId: string) => Promise<AuthActionResult>;
  addSavedPaymentMethod: (input: SavedPaymentMethodInput) => Promise<AuthActionResult>;
  updateSavedPaymentMethod: (input: UpdateSavedPaymentMethodInput) => Promise<AuthActionResult>;
  deleteSavedPaymentMethod: (paymentMethodId: string) => Promise<AuthActionResult>;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<AuthActionResult>;
  requestPhoneChangeVerification: (newPhone: string) => Promise<AuthActionResult>;
  confirmPhoneChangeVerification: (code: string) => Promise<AuthActionResult>;
  getOrderById: (orderId: string) => Order | undefined;
  updateOrderStatus: (orderId: string, status: OrderStatus, reason?: string) => Promise<AuthActionResult>;
  pendingGuestOrderClaims: Order[];
  claimPendingGuestOrders: () => void;
  rejectPendingGuestClaims: () => void;
}

interface CheckoutPaymentResult {
  success: boolean;
  order?: Order;
  message?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  users: 'cultiv_users_v2',
  currentUserId: 'cultiv_current_user_v2',
  customerAccount: 'cultiv_customer_account_v1',
  customerSessionToken: 'cultiv_customer_session_token_v1',
  orders: 'cultiv_orders_v2',
  resetTokens: 'cultiv_reset_tokens_v2',
  phoneChangeVerifications: 'cultiv_phone_change_verifications_v1',
  rejectedGuestClaims: 'cultiv_rejected_guest_claims_v1',
} as const;

const ADMIN_ACCESS_SESSION_STORAGE_KEY = 'cultiv_admin_access_session_v1';

const SYNC_URL: string | undefined = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SYNC_SERVER_URL;
const AUTH_SYNC_CLIENT_ID = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const STATUS_CONTENT: Record<OrderStatus, { label: string; description: string }> = {
  placed: { label: 'Order Placed', description: 'Your order is in the CULTIV queue.' },
  preparing: { label: 'Preparing', description: 'Fresh ingredients are being assembled.' },
  ready_for_pickup: { label: 'Ready for Pickup', description: 'Your order is ready at the counter.' },
  completed: { label: 'Completed', description: 'Your order has been fulfilled.' },
  cancelled: { label: 'Cancelled', description: 'This order was cancelled.' },
};

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

const PASSWORD_HASH_PREFIX = 'h$';

const hashPassword = (password: string) => {
  let hash = 5381;
  for (let index = 0; index < password.length; index += 1) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(index);
  }
  return `${PASSWORD_HASH_PREFIX}${(hash >>> 0).toString(36)}`;
};

const ensureHashedPassword = (password: string) => (
  password.startsWith(PASSWORD_HASH_PREFIX) ? password : hashPassword(password)
);

const verifyPassword = (input: string, stored: string) => {
  if (stored.startsWith(PASSWORD_HASH_PREFIX)) {
    return hashPassword(input) === stored;
  }
  return input === stored;
};

const isValidPhoneForAuthFlows = (phone: string) => /^\d{10}$/.test(phone.trim());

const isValidPasswordPolicy = (password: string) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must include at least one letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number.';
  }
  return '';
};

const createDefaultPaymentProfile = () => ({
  preferredMethod: 'upi' as const,
  savedMethods: [],
});

const createVerificationCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const normalizeUserRecord = (record: AuthRecord): AuthRecord => {
  const savedAddresses = (record.savedAddresses ?? []).map((address, index) => ({
    ...address,
    userId: address.userId ?? record.id,
    isDefault: address.isDefault ?? (record.defaultAddressId ? address.id === record.defaultAddressId : index === 0),
  }));

  const defaultAddressId =
    record.defaultAddressId ?? savedAddresses.find((address) => address.isDefault)?.id ?? savedAddresses[0]?.id;

  const savedMethods = (record.paymentProfile?.savedMethods ?? [])
    .filter((method) => method.type === 'upi' || method.type === 'card')
    .map((method, index) => ({
      ...method,
      isDefault: method.isDefault ?? index === 0,
    }));

  const preferredMethod =
    record.paymentProfile?.preferredMethod === 'card' || record.paymentProfile?.preferredMethod === 'upi'
      ? record.paymentProfile.preferredMethod
      : savedMethods.find((method) => method.isDefault)?.type ?? 'upi';

  return {
    ...record,
    password: ensureHashedPassword(record.password),
    savedAddresses: savedAddresses.map((address) => ({
      ...address,
      isDefault: defaultAddressId ? address.id === defaultAddressId : address.isDefault,
    })),
    preferences: record.preferences ?? {},
    paymentProfile: {
      ...createDefaultPaymentProfile(),
      ...record.paymentProfile,
      preferredMethod,
      savedMethods: savedMethods.map((method) => ({
        ...method,
        isDefault: savedMethods.length ? method.id === savedMethods.find((entry) => entry.isDefault)?.id : false,
      })),
    },
    defaultAddressId,
    emailLocked: record.emailLocked ?? true,
    phoneEditable: record.phoneEditable ?? false,
  };
};

const normalizeUserRecords = (records: AuthRecord[]) => records.map(normalizeUserRecord);

const normalizeEmail = (email: string | undefined | null) => (email ?? '').trim().toLowerCase();

const normalizeOrderRecords = (orders: Order[], records: AuthRecord[]) => (
  orders.map((order) => {
    const linkedUserEmail = order.userId ? records.find((entry) => entry.id === order.userId)?.email : undefined;
    return {
      ...order,
      storeId: order.storeId ?? DEFAULT_ORDER_STORE_ID,
      email: normalizeEmail(order.email || linkedUserEmail),
    };
  })
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const parseStorageEventValue = <T,>(raw: string | null): T | null => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const buildFulfillmentWindow = () => {
  const now = Date.now();
  const startOffset = 18;
  const endOffset = 28;
  const format = (date: Date) =>
    date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  const start = new Date(now + startOffset * 60_000);
  const end = new Date(now + endOffset * 60_000);
  return `${format(start)} - ${format(end)}`;
};

const buildStatusTimeline = (createdAt: string) => {
  const steps: OrderStatus[] = ['placed', 'preparing', 'ready_for_pickup', 'completed'];

  return steps.map((status, index) => ({
    status,
    label: STATUS_CONTENT[status].label,
    description: STATUS_CONTENT[status].description,
    at: new Date(new Date(createdAt).getTime() + index * 12 * 60_000).toISOString(),
  }));
};

const buildCompletedWalkInStatusTimeline = (createdAt: string) => ([
  {
    status: 'completed' as OrderStatus,
    label: STATUS_CONTENT.completed.label,
    description: 'Order was billed, paid, and handed to the customer at the counter.',
    at: createdAt,
  },
]);
const hasValidOrderItems = (items: Array<{
  title: string;
  category: string;
  quantity: number;
  price: number;
}>) => items.every((item) => (
  Boolean(item.title?.trim())
  && Boolean(item.category?.trim())
  && Number.isFinite(item.quantity)
  && item.quantity > 0
  && Number.isFinite(item.price)
  && item.price >= 0
));

type SupabaseOrderType = 'online' | 'walk_in' | 'phone';
type SupabaseSourceChannel = 'app' | 'walk_in' | 'phone';

const SELECTION_STEP_CATALOG = [...BOWL_BUILDER_STEPS, ...BREAKFAST_CUSTOMIZE_STEPS];

const normalizeSelectionToken = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const toSnapshotGroupId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SELECTION_STEP_BY_TITLE = Object.fromEntries(
  SELECTION_STEP_CATALOG.map((step) => [normalizeSelectionToken(step.title), step]),
) as Record<string, (typeof SELECTION_STEP_CATALOG)[number]>;

const OPTION_META_BY_GROUP_AND_NAME = Object.fromEntries(
  SELECTION_STEP_CATALOG.flatMap((step) =>
    step.ingredients.map((ingredient) => [
      `${step.id}::${normalizeSelectionToken(ingredient.name)}`,
      {
        optionItemId: ingredient.id,
        optionItemName: ingredient.name,
        groupId: step.id,
        groupName: step.title,
        priceModifier: ingredient.price,
      },
    ]),
  ),
) as Record<string, {
  optionItemId: string;
  optionItemName: string;
  groupId: string;
  groupName: string;
  priceModifier: number;
}>;

const resolveSupabaseOrderType = (orderType: 'pickup' | 'walk_in', source: SupabaseSourceChannel): SupabaseOrderType => {
  if (source === 'phone') return 'phone';
  return orderType === 'walk_in' ? 'walk_in' : 'online';
};

const resolveSnapshotGroupMeta = (sectionLabel: string) => {
  const step = SELECTION_STEP_BY_TITLE[normalizeSelectionToken(sectionLabel)];
  if (step) {
    return {
      groupId: step.id,
      groupName: step.title,
    };
  }

  return {
    groupId: toSnapshotGroupId(sectionLabel),
    groupName: sectionLabel,
  };
};
const buildSelectionSnapshotRows = (orderItemId: string, selections: OrderItem['selections']) => {
  return selections.flatMap((selection) => {
    const groupMeta = resolveSnapshotGroupMeta(selection.section);

    return selection.choices.map((choice) => {
      const optionMeta = OPTION_META_BY_GROUP_AND_NAME[
        `${groupMeta.groupId}::${normalizeSelectionToken(choice)}`
      ];

      return {
        order_item_id: orderItemId,
        option_item_id: optionMeta?.optionItemId ?? null,
        group_id_snapshot: groupMeta.groupId,
        group_name_snapshot: groupMeta.groupName,
        option_name: optionMeta?.optionItemName ?? choice,
        price_modifier: optionMeta?.priceModifier ?? 0,
      };
    });
  });
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveMenuItemId = (itemId: string) => {
  const normalized = itemId.trim();
  if (!normalized) return null;
  return UUID_PATTERN.test(normalized) ? normalized : null;
};

const buildSelectionSnapshotPayload = (selections: OrderItem['selections']) => (
  selections.flatMap((selection) => {
    const groupMeta = resolveSnapshotGroupMeta(selection.section);

    return selection.choices.map((choice) => {
      const optionMeta = OPTION_META_BY_GROUP_AND_NAME[
        `${groupMeta.groupId}::${normalizeSelectionToken(choice)}`
      ];

      return {
        option_item_id: optionMeta?.optionItemId ?? null,
        group_id_snapshot: groupMeta.groupId,
        group_name_snapshot: groupMeta.groupName,
        option_name: optionMeta?.optionItemName ?? choice,
        price_modifier: optionMeta?.priceModifier ?? 0,
      };
    });
  })
);

interface PersistOrderResult {
  orderId: string;
  orderNumber?: string;
  orderStatus: OrderStatus;
  customerId?: string | null;
}

const buildSupabaseOrderPayload = (order: Order) => {
  const normalizedSource = String(order.source ?? '').trim().toLowerCase();

const sourceChannel: SupabaseSourceChannel =
  normalizedSource === 'walk_in' || normalizedSource === 'walk-in'
    ? 'walk_in'
    : normalizedSource === 'phone'
      ? 'phone'
      : 'app';

const isWalkInOrder = order.orderType === 'walk_in' || sourceChannel === 'walk_in';
  const normalizedStoreId = order.storeId?.trim() || '';
  if (!normalizedStoreId) {
    throw new Error('Store is required before persisting an order.');
  }
  const normalizedCustomerName = order.fullName.trim() || 'Walk-in Guest';
  const normalizedCustomerPhoneValue = order.phone.trim();
  const normalizedCustomerPhone = isWalkInOrder
    ? normalizedCustomerPhoneValue
    : normalizedCustomerPhoneValue || null;
  const normalizedCustomerEmail = order.email.trim() || null;

  return {
    order: {
      customer_id: order.customerId ?? null,
      user_id: order.userId ?? null,
      order_type: resolveSupabaseOrderType(order.orderType as 'pickup' | 'walk_in', sourceChannel),
      source_channel: sourceChannel,
      order_status: order.status,
      store_id: normalizedStoreId,
      customer_name: normalizedCustomerName,
      customer_phone: normalizedCustomerPhone,
      customer_email: normalizedCustomerEmail,
      payment_method: order.paymentMethod ?? null,
      notes: null,
      subtotal_amount: Number(order.subtotal.toFixed(2)),
      discount_amount: Number(order.rewardDiscount.toFixed(2)),
      tax_amount: Number((order.taxAmount ?? 0).toFixed(2)),
      tip_amount: Number((order.tipAmount ?? 0).toFixed(2)),
      total_amount: Number(order.total.toFixed(2)),
    },
    items: order.items.map((item) => ({
      menu_item_id: resolveMenuItemId(item.id),
      item_name: item.title,
      item_category: item.category,
      unit_price: Number(item.price.toFixed(2)),
      quantity: item.quantity,
      line_total: Number((item.price * item.quantity).toFixed(2)),
      selections: buildSelectionSnapshotPayload(item.selections),
    })),
  };
};

const invokeCreateCheckoutPaymentIntent = async (
  order: Order,
  idempotencyKey: string,
  customerSessionToken: string,
): Promise<CheckoutPaymentIntent> => {
  const payload = {
    ...buildSupabaseOrderPayload(order),
    idempotencyKey,
    customerSessionToken,
  };

  const { data, error } = await supabase.functions.invoke('customer-create-payment-intent', {
    body: payload,
  });

  if (error || !data?.success || !data?.paymentId || !data?.gateway) {
    throw new Error(data?.message || error?.message || 'Payment is temporarily unavailable. Please try again.');
  }

  const gateway = String(data.gateway).trim().toLowerCase();
  if (gateway !== 'razorpay') {
    throw new Error('Unsupported payment provider. Please try again.');
  }
  if (!data?.gatewayOrderId || !data?.gatewayKeyId) {
    throw new Error('Payment gateway is unavailable right now. Please try again.');
  }

  return {
    paymentId: data.paymentId,
    idempotencyKey,
    paymentMethod: order.paymentMethod as CustomerCheckoutPaymentMethod,
    amount: Number(data.amount ?? order.total),
    amountPaise: Number(data.amountPaise ?? Math.round(order.total * 100)),
    currency: String(data.currency ?? 'INR'),
    gateway,
    gatewayOrderId: data?.gatewayOrderId ? String(data.gatewayOrderId) : undefined,
    gatewayKeyId: data?.gatewayKeyId ? String(data.gatewayKeyId) : undefined,
  };
};

const invokeConfirmCheckoutPayment = async (input: ConfirmCheckoutPaymentInput): Promise<PersistOrderResult> => {
  const { data, error } = await supabase.functions.invoke('customer-confirm-payment-and-create-order', {
    body: {
      paymentId: input.paymentId,
      outcome: input.outcome,
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      gatewaySignature: input.gatewaySignature,
      failureReason: input.failureReason,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.message || error?.message || 'Payment could not be verified. Please try again.');
  }

  if (input.outcome !== 'succeeded') {
    throw new Error(data?.message || 'Payment was not completed.');
  }

  if (!data?.orderId) {
    throw new Error(data?.message || 'Payment succeeded but order could not be created. Please contact support.');
  }

  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    orderStatus: (data.orderStatus ?? 'placed') as OrderStatus,
  };
};

const persistOrderToSupabase = async (order: Order): Promise<PersistOrderResult> => {
  try {
    const payload = buildSupabaseOrderPayload(order);
    const { data, error } = await supabase.functions.invoke('customer-create-order', {
      body: payload,
    });

    let errorPayload: { message?: string } | null = null;
    if (error?.context && typeof error.context.json === 'function') {
      try {
        errorPayload = await error.context.json();
      } catch {
        errorPayload = null;
      }
    }

    if (error || !data?.success || !data?.orderId) {
      throw new Error(
        data?.message
        || errorPayload?.message
        || error?.message
        || 'Could not create orders row.'
      );
    }

    return {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      orderStatus: (data.orderStatus ?? order.status) as OrderStatus,
      customerId: data.customerId ?? data.customer_id ?? order.customerId ?? null,
    };
  } catch (error) {
    console.error('Supabase order persistence failed.');
    throw error instanceof Error ? error : new Error('Supabase order persistence failed.');
  }
};

const deriveTier = (totalSpend: number) => {
  if (totalSpend >= 2500) return 'Cultiv House';
  if (totalSpend >= 1200) return 'Routine Member';
  return 'Founding Member';
};
const DAY_MS = 24 * 60 * 60 * 1000;
const POINT_EXPIRY_MS = 90 * DAY_MS;
const EXPIRING_SOON_WINDOW_MS = 14 * DAY_MS;
const MAX_ACTIVITY_ITEMS = 100;

const toEpoch = (value: number | string | undefined, fallback = Date.now()) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const sortBatchesByEarnedDate = (batches: PointsBatch[]) => (
  [...batches].sort((a, b) => a.earnedAt - b.earnedAt)
);

const summarizePoints = (batches: PointsBatch[], now = Date.now()) => {
  let availablePoints = 0;
  let expiringSoonPoints = 0;
  let expiredPoints = 0;

  for (const batch of batches) {
    if (batch.expiresAt <= now) {
      expiredPoints += batch.points;
      continue;
    }
    availablePoints += batch.points;
    if (batch.expiresAt - now <= EXPIRING_SOON_WINDOW_MS) {
      expiringSoonPoints += batch.points;
    }
  }

  return { availablePoints, expiringSoonPoints, expiredPoints };
};

const addActivity = (
  history: PointsActivityItem[] | undefined,
  item: PointsActivityItem,
): PointsActivityItem[] => [item, ...(history ?? [])].slice(0, MAX_ACTIVITY_ITEMS);

const normalizeLoyaltyProfile = (profile: LoyaltyProfile): LoyaltyProfile => {
  const now = Date.now();
  const legacyPoints = Number.isFinite((profile as unknown as { points?: number }).points)
    ? Math.max(0, Math.floor((profile as unknown as { points?: number }).points ?? 0))
    : 0;

  const rawBatches = (profile.pointsBatches ?? []).map((batch) => ({
    points: Math.max(0, Math.floor(Number(batch.points ?? 0))),
    earnedAt: toEpoch(batch.earnedAt, now),
    expiresAt: toEpoch(batch.expiresAt, now + POINT_EXPIRY_MS),
  })).filter((batch) => batch.points > 0);

  const migratedBatches = rawBatches.length > 0
    ? rawBatches
    : legacyPoints > 0
      ? [{ points: legacyPoints, earnedAt: now, expiresAt: now + POINT_EXPIRY_MS }]
      : [];

  const pointsBatches = sortBatchesByEarnedDate(migratedBatches);
  const summary = summarizePoints(pointsBatches, now);
  const availableRewards = [...new Set((profile.availableRewards ?? [])
    .map((rewardId) => normalizeRewardId(rewardId))
    .filter((rewardId) => REWARD_ID_SET.has(rewardId)))];

  return {
    userId: profile.userId,
    pointsBatches,
    availablePoints: summary.availablePoints,
    expiringSoonPoints: summary.expiringSoonPoints,
    expiredPoints: summary.expiredPoints,
    availableRewards,
    pointsActivity: profile.pointsActivity ?? [],
    totalOrders: profile.totalOrders ?? 0,
    totalSpend: profile.totalSpend ?? 0,
    currentTier: profile.currentTier ?? deriveTier(profile.totalSpend ?? 0),
  };
};

const normalizeLoyaltyProfiles = (profiles: Record<string, LoyaltyProfile>) => Object.fromEntries(
  Object.entries(profiles).map(([userId, profile]) => [userId, normalizeLoyaltyProfile({ ...profile, userId })]),
);

const purgeExpiredPoints = (profile: LoyaltyProfile, now = Date.now()): LoyaltyProfile => {
  const normalized = normalizeLoyaltyProfile(profile);
  const keptBatches = normalized.pointsBatches.filter((batch) => batch.expiresAt > now);
  const expiredNow = normalized.pointsBatches
    .filter((batch) => batch.expiresAt <= now)
    .reduce((sum, batch) => sum + batch.points, 0);

  const summary = summarizePoints(keptBatches, now);
  return {
    ...normalized,
    pointsBatches: keptBatches,
    availablePoints: summary.availablePoints,
    expiringSoonPoints: summary.expiringSoonPoints,
    expiredPoints: summary.expiredPoints,
    pointsActivity: expiredNow > 0
      ? addActivity(normalized.pointsActivity, {
        type: 'expire',
        points: expiredNow,
        date: now,
        description: 'Points expired after 90 days.',
      })
      : normalized.pointsActivity,
  };
};

const deductPointsFIFO = (profile: LoyaltyProfile, pointsToRedeem: number, now = Date.now()) => {
  let remaining = pointsToRedeem;
  const queue = sortBatchesByEarnedDate(profile.pointsBatches).map((batch) => ({ ...batch }));

  for (const batch of queue) {
    if (remaining <= 0) break;
    const used = Math.min(batch.points, remaining);
    batch.points -= used;
    remaining -= used;
  }

  if (remaining > 0) {
    return null;
  }

  const pointsBatches = queue.filter((batch) => batch.points > 0);
  const summary = summarizePoints(pointsBatches, now);
  return {
    pointsBatches,
    availablePoints: summary.availablePoints,
    expiringSoonPoints: summary.expiringSoonPoints,
    expiredPoints: summary.expiredPoints,
  };
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const buildSeedState = () => ({
  users: [] as AuthRecord[],
  orders: [] as Order[],
  loyaltyProfiles: {} as Record<string, LoyaltyProfile>,
  currentUserId: null as string | null,
  resetTokens: [] as ResetTokenRecord[],
  phoneChangeVerifications: [] as PhoneChangeVerificationRecord[],
});

const upsertBackendCustomerUser = (
  previous: AuthRecord[],
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
  },
): AuthRecord[] => {
  const existing = previous.find((entry) => entry.id === customer.id)
    ?? previous.find((entry) =>
      normalizePhone(entry.phone) === normalizePhone(customer.phone)
      || normalizeEmail(entry.email) === normalizeEmail(customer.email),
    );

  const nextRecord: AuthRecord = normalizeUserRecord({
    id: customer.id,
    fullName: customer.full_name,
    phone: normalizePhone(customer.phone),
    email: normalizeEmail(customer.email),
    password: existing?.password ?? '',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    savedAddresses: (existing?.savedAddresses ?? []).map((address) => ({
      ...address,
      userId: customer.id,
    })),
    preferences: existing?.preferences ?? {},
    paymentProfile: existing?.paymentProfile ?? createDefaultPaymentProfile(),
    defaultAddressId: existing?.defaultAddressId,
    emailLocked: true,
    phoneEditable: false,
  });

  const withoutDuplicates = previous.filter((entry) => (
    entry.id !== nextRecord.id
    && normalizePhone(entry.phone) !== normalizePhone(nextRecord.phone)
    && normalizeEmail(entry.email) !== normalizeEmail(nextRecord.email)
  ));

  return [...withoutDuplicates, nextRecord];
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const seedState = useMemo(() => buildSeedState(), []);
  const [users, setUsers] = useState<AuthRecord[]>(() => normalizeUserRecords(readStorage(STORAGE_KEYS.users, seedState.users)));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => readStorage(STORAGE_KEYS.currentUserId, seedState.currentUserId));
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loyaltyProfiles, setLoyaltyProfiles] = useState<Record<string, LoyaltyProfile>>(() => normalizeLoyaltyProfiles(seedState.loyaltyProfiles));
  const [resetTokens, setResetTokens] = useState<ResetTokenRecord[]>(() => readStorage(STORAGE_KEYS.resetTokens, seedState.resetTokens));
  const [phoneChangeVerifications, setPhoneChangeVerifications] = useState<PhoneChangeVerificationRecord[]>(() => readStorage(STORAGE_KEYS.phoneChangeVerifications, seedState.phoneChangeVerifications));
  const [rejectedGuestClaimIds, setRejectedGuestClaimIds] = useState<string[]>(() => readStorage(STORAGE_KEYS.rejectedGuestClaims, []));
  const [pendingGuestOrderClaims, setPendingGuestOrderClaims] = useState<Order[]>([]);
  const [supabaseSharedOrders, setSupabaseSharedOrders] = useState<Order[]>([]);
  const [supabaseReadSuccessful, setSupabaseReadSuccessful] = useState(false);
  const [supabaseReadDegraded, setSupabaseReadDegraded] = useState(false);
  const [supabaseRefreshTick, setSupabaseRefreshTick] = useState(0);
  const [customerAccount, setCustomerAccount] = useState<CustomerAccountSummary | null>(() => readStorage(STORAGE_KEYS.customerAccount, null));
  const [customerSessionToken, setCustomerSessionToken] = useState<string | null>(() => readStorage(STORAGE_KEYS.customerSessionToken, null));
  const [loyaltySummary, setLoyaltySummary] = useState<LoyaltySummary | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const usersRef = useRef(users);
  const ordersRef = useRef(allOrders);
  const previousUserIdRef = useRef<string | null>(currentUserId);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    ordersRef.current = allOrders;
  }, [allOrders]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    setUsers((previous) => {
      const normalized = normalizeUserRecords(previous);
      const hasChanges = normalized.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(previous[index]));
      return hasChanges ? normalized : previous;
    });
  }, []);

  useEffect(() => {
    setAllOrders((previous) => normalizeOrderRecords(previous, users));
  }, [users]);

  useEffect(() => {
    setLoyaltyProfiles((previous) => Object.fromEntries(
      Object.entries(normalizeLoyaltyProfiles(previous)).map(([userId, profile]) => [userId, purgeExpiredPoints(profile)]),
    ));
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.currentUserId, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.customerAccount, customerAccount);
  }, [customerAccount]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.customerSessionToken, customerSessionToken);
  }, [customerSessionToken]);

  useEffect(() => {
    setDraftCartScope(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || !event.key) {
        return;
      }

      if (event.key === STORAGE_KEYS.currentUserId) {
        const nextUserId = parseStorageEventValue<string | null>(event.newValue);
        setCurrentUserId(nextUserId);
        return;
      }

      if (event.key === STORAGE_KEYS.customerAccount) {
        const nextCustomerAccount = parseStorageEventValue<CustomerAccountSummary | null>(event.newValue);
        setCustomerAccount(nextCustomerAccount);
        return;
      }

      if (event.key === STORAGE_KEYS.customerSessionToken) {
        const nextCustomerSessionToken = parseStorageEventValue<string | null>(event.newValue);
        setCustomerSessionToken(nextCustomerSessionToken);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (currentUserId) return;

    setPendingGuestOrderClaims([]);
    setCustomerAccount(null);
    setCustomerSessionToken(null);
    setLoyaltySummary(null);
    setAllOrders([]);
  }, [currentUserId]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      resetShoppingSessionStorage();
      setDraftCartScope(currentUserId);
    }
    previousUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!customerAccount?.id || currentUserId === customerAccount.id) {
      return;
    }

    setCurrentUserId(customerAccount.id);
  }, [currentUserId, customerAccount?.id]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.resetTokens, resetTokens);
  }, [resetTokens]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.phoneChangeVerifications, phoneChangeVerifications);
  }, [phoneChangeVerifications]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.rejectedGuestClaims, rejectedGuestClaimIds);
  }, [rejectedGuestClaimIds]);
    const refreshSharedOrdersFromSupabase = useCallback(async () => {
    try {
      const internalSession = readStorage<InternalAccessSessionSnapshot | null>(ADMIN_ACCESS_SESSION_STORAGE_KEY, null);
      if (!internalSession?.internalSessionToken) {
        setSupabaseSharedOrders([]);
        setSupabaseReadSuccessful(false);
        setSupabaseReadDegraded(false);
        return;
      }

      const nextOrders = await fetchOperationalOrdersFromSupabase({
        internalSessionToken: internalSession.internalSessionToken,
        roleKey: internalSession.roleKey,
        scopeType: internalSession.scopeType,
        scopeStoreId: internalSession.scopeStoreId,
      });
      setSupabaseSharedOrders(nextOrders);
      setSupabaseReadSuccessful(true);
      setSupabaseReadDegraded(false);
    } catch {
      console.error('Supabase admin order read failed.');
      setSupabaseReadSuccessful(false);
      setSupabaseReadDegraded(true);
    }
  }, []);

  const refreshCustomerOrdersFromSupabase = useCallback(async () => {
    if (!customerSessionToken || !customerAccount?.id) {
      setAllOrders([]);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-list-orders', {
        body: {
          customerSessionToken,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Could not load customer orders.');
      }

      const rows = (data.orders ?? []) as Array<any>;

      const nextOrders: Order[] = rows.map((row) => {
        const orderItems: OrderItem[] = (row.order_items ?? []).map((itemRow: any) => {
          const groupedSelections = (itemRow.order_item_selections ?? []).reduce(
            (sectionAcc: Map<string, string[]>, selectionRow: any) => {
              const section = selectionRow.group_name_snapshot || 'Selections';
              const list = sectionAcc.get(section) ?? [];
              list.push(selectionRow.option_name);
              sectionAcc.set(section, list);
              return sectionAcc;
            },
            new Map<string, string[]>(),
          );

          const groupedEntries = Array.from(groupedSelections.entries()) as Array<[string, string[]]>;

          const uiSelections = groupedEntries.map(([section, choices]) => ({
            section,
            choices,
          }));

          return {
            id: itemRow.order_item_id,
            orderId: itemRow.order_id,
            category: itemRow.item_category,
            title: itemRow.item_name,
            selections: uiSelections,
            quantity: Number(itemRow.quantity),
            price: Number(itemRow.unit_price),
          };
        });

        return {
          id: row.order_id,
          customerId: row.customer_id,
          storeId: row.store_id,
          category: orderItems[0]?.category ?? 'Central Ordering',
          items: orderItems,
          orderType: row.order_type === 'walk_in' ? 'walk_in' : 'pickup',
          subtotal: Number(row.subtotal_amount),
          rewardDiscount: Number(row.discount_amount ?? 0),
          taxAmount: Number(row.tax_amount ?? 0),
          tipAmount: Number(row.tip_amount ?? 0),
          total: Number(row.total_amount),
          status: row.order_status as OrderStatus,
          createdAt: row.created_at,
          phone: row.customer_phone ?? '',
          fullName: row.customer_name || 'Walk-in Guest',
          email: row.customer_email ?? '',
          source: row.source_channel === 'walk-in' ? 'walk_in' : row.source_channel,
          paymentMethod: row.payment_method ?? undefined,
          fulfillmentWindow: '20-30 min',
          statusTimeline: buildStatusTimeline(row.created_at),
          cancellation_reason: row.cancellation_reason ?? undefined,
        };
      });

      setAllOrders(normalizeOrderRecords(nextOrders, usersRef.current));
    } catch (err) {
      console.error('Customer orders read failed.', err);
      setAllOrders([]);
    }
  }, [customerAccount?.id, customerSessionToken]);

  const refreshLoyalty = useCallback(async () => {
  if (!customerSessionToken) {
    setLoyaltySummary(null);
    return;
  }

  setLoyaltyLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('loyalty-summary', {
  body: {
    customerSessionToken,
  },
});

    if (error || !data) {
      throw new Error(error?.message || 'Failed to fetch loyalty summary');
    }

    setLoyaltySummary({
  availablePoints: data.availablePoints ?? 0,
  activeBatches: Array.isArray(data.activeBatches) ? data.activeBatches as LoyaltyBatchSummary[] : [],
  recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
  });
  
  } catch (err) {
    console.error('Failed to refresh loyalty summary', err);
    setLoyaltySummary(null);
  } finally {
    setLoyaltyLoading(false);
  }
}, [customerSessionToken]);

  useEffect(() => {
    let active = true;

    const syncOrders = async () => {
      if (!active) return;
      await refreshSharedOrdersFromSupabase();
    };

    syncOrders();
    const intervalId = window.setInterval(syncOrders, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshSharedOrdersFromSupabase, supabaseRefreshTick]);

  useEffect(() => {
    if (!customerAccount?.id || !customerSessionToken) {
      if (!currentUserId) {
        setAllOrders([]);
      }
      return;
    }

    void refreshCustomerOrdersFromSupabase();
  }, [customerAccount?.id, customerSessionToken, currentUserId, refreshCustomerOrdersFromSupabase, supabaseRefreshTick]);

  useEffect(() => {
    if (!customerAccount?.id || !customerSessionToken) {
      setLoyaltySummary(null);
      return;
    }

    void refreshLoyalty();
  }, [customerAccount?.id, customerSessionToken, refreshLoyalty, supabaseRefreshTick]);

  const userRecord = users.find((entry) => entry.id === currentUserId) ?? null;
  const user = userRecord ? ({ ...userRecord, password: undefined } as unknown as User) : null;

  const guestOrders: Order[] = [];
  const orders = user ? allOrders : guestOrders;

  const hasInternalOrdersSession = Boolean(
    readStorage<InternalAccessSessionSnapshot | null>(ADMIN_ACCESS_SESSION_STORAGE_KEY, null)?.internalSessionToken,
  );

  const sharedOrders = hasInternalOrdersSession
    ? supabaseSharedOrders
    : ((supabaseReadSuccessful && !supabaseReadDegraded) ? supabaseSharedOrders : allOrders);

  const activeOrders = orders.filter(
    (order) => order.status !== 'completed' && order.status !== 'cancelled',
  );

  const loyaltyProfileBase = user
    ? (loyaltyProfiles[user.id] ?? createEmptyLoyaltyProfile(user.id))
    : null;
  const loyaltyProfile = loyaltyProfileBase
    // Legacy profile fields are still used in the UI, but live point totals should
    // follow the DB-backed summary whenever it is available.
    ? { ...loyaltyProfileBase, availablePoints: loyaltySummary?.availablePoints ?? 0 }
    : null;

  useEffect(() => {
    if (!userRecord) {
      setCustomerAccount(null);
      setLoyaltySummary(null);
    }
  }, [userRecord?.id]);
  const detectClaimableGuestOrders = (targetUser: AuthRecord): Order[] => {
    const normalizedPhoneValue = normalizePhone(targetUser.phone);
    const targetEmail = normalizeEmail(targetUser.email);

    return allOrders.filter((order) => {
      if (order.userId || order.source !== 'app') return false;
      if (rejectedGuestClaimIds.includes(order.id)) return false;
      const phoneMatches = normalizePhone(order.phone) === normalizedPhoneValue;
      const emailMatches = Boolean(targetEmail && normalizeEmail(order.email) === targetEmail);
      return phoneMatches || emailMatches;
    });
  };

  const claimPendingGuestOrders = () => {
    if (!userRecord || pendingGuestOrderClaims.length === 0) return;
    const claimIds = new Set(pendingGuestOrderClaims.map((order) => order.id));
    setAllOrders((previous) => previous.map((order) => {
      if (!claimIds.has(order.id)) return order;
      return { ...order, userId: userRecord.id, email: normalizeEmail(order.email || userRecord.email) };
    }));
    setPendingGuestOrderClaims([]);
  };

  const rejectPendingGuestOrderClaims = () => {
    const rejectIds = pendingGuestOrderClaims.map((order) => order.id);
    setRejectedGuestClaimIds((previous) => [...previous, ...rejectIds]);
    setPendingGuestOrderClaims([]);
  };

  const login = async ({ identifier, password }: LoginInput): Promise<AuthActionResult> => {
    try {
      const { data: loginResponse, error: loginError } = await supabase.functions.invoke('customer-login', {
        body: { identifier, password },
      });

      if (loginError || !loginResponse?.success) {
        const message = loginResponse?.message || 'Invalid email, phone, or password.';
        return { success: false, message };
      }

      const customerId = loginResponse.customer_id;
      const customerData = loginResponse.customer;
      const customerSessionTokenFromLogin = loginResponse.customer_session_token;

      if (!customerId || !customerData || !customerSessionTokenFromLogin) {
        return { success: false, message: 'Invalid email, phone, or password.' };
      }

      setUsers((previous) => upsertBackendCustomerUser(previous, customerData));
      setCurrentUserId(customerId);

      setCustomerAccount({
        id: customerId,
        reward_points: customerData.reward_points,
        phone_verified: customerData.phone_verified,
        email_verified: customerData.email_verified,
      });
      setCustomerSessionToken(customerSessionTokenFromLogin);
      setSupabaseRefreshTick((value) => value + 1);

      const userToCheck = {
        id: customerId,
        fullName: customerData.full_name,
        phone: customerData.phone,
        email: customerData.email,
      } as AuthRecord;
      if (userToCheck) {
        const claimable = detectClaimableGuestOrders(userToCheck);
        if (claimable.length > 0) {
          setPendingGuestOrderClaims(claimable);
        }
      }

      return { success: true, message: loginResponse.message };
    } catch (err) {
      console.error('[login] unexpected error calling edge function', err);
      return { success: false, message: 'Could not log in right now. Please try again.' };
    }
  };

  const signup = async ({ fullName, phone, email, password }: SignupInput): Promise<AuthActionResult> => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return { success: false, message: 'Email is required for order confirmations.' };
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return { success: false, message: 'Enter a valid email address.' };
    }

    const normalizedPhoneInput = phone.trim();
    if (!isValidPhoneForAuthFlows(normalizedPhoneInput)) {
      return { success: false, message: 'Enter a valid 10-digit numeric phone number.' };
    }
    const normalizedPhoneValue = normalizePhone(normalizedPhoneInput);

    const passwordPolicyMessage = isValidPasswordPolicy(password);
    if (passwordPolicyMessage) {
      return { success: false, message: passwordPolicyMessage };
    }

    try {
      const signupPayload = {
        full_name: fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhoneValue,
        password,
      };
      const result = await supabase.functions.invoke('customer-signup', {
        body: signupPayload,
      });

      const edgeFunctionResponse = result?.data;
      const edgeFunctionError = result?.error;
            let edgeErrorPayload: { success?: boolean; code?: string; message?: string } | null = null;
      if (edgeFunctionError?.context && typeof edgeFunctionError.context.json === 'function') {
        try {
          edgeErrorPayload = await edgeFunctionError.context.json();
        } catch {
          edgeErrorPayload = null;
        }
      }

      const knownEdgeMessage =
        (edgeFunctionResponse?.success === false ? edgeFunctionResponse?.message : undefined)
        || (edgeErrorPayload?.success === false ? edgeErrorPayload?.message : undefined);

      if (knownEdgeMessage) {
        return { success: false, message: knownEdgeMessage };
      }

      if (edgeFunctionError || !edgeFunctionResponse?.success) {
        const message = edgeFunctionResponse?.message || edgeErrorPayload?.message || 'Could not create your CULTIV profile right now. Please try again.';
        return { success: false, message };
      }

      const customerId = edgeFunctionResponse.customerId ?? edgeFunctionResponse.customer_id;
      const customerSessionTokenFromSignup = edgeFunctionResponse.customer_session_token;
      if (!customerId) {
        return { success: false, message: 'Could not create your CULTIV profile right now. Please try again.' };
      }

      if (!customerSessionTokenFromSignup) {
        return { success: false, message: 'Could not create a secure customer session right now. Please try signing in.' };
      }

      setUsers((previous) => upsertBackendCustomerUser(previous, {
        id: customerId,
        full_name: fullName,
        phone: normalizedPhoneValue,
        email: normalizedEmail,
      }));
      setLoyaltyProfiles((previous) => ({
        ...previous,
        [customerId]: createEmptyLoyaltyProfile(customerId),
      }));
      setCurrentUserId(customerId);
      setCustomerAccount({ id: customerId, reward_points: 0, phone_verified: false, email_verified: false });
      setCustomerSessionToken(customerSessionTokenFromSignup);
      setSupabaseRefreshTick((value) => value + 1);

      const claimable = detectClaimableGuestOrders({
        id: customerId,
        fullName,
        phone: normalizedPhoneValue,
        email: normalizedEmail,
      } as AuthRecord);
      if (claimable.length > 0) {
        setPendingGuestOrderClaims(claimable);
      }

      return { success: true, message: 'Your CULTIV profile is ready.' };
    } catch (err) {
      console.error('[signup] unexpected error calling edge function', err);
      return { success: false, message: 'Could not create your CULTIV profile right now. Please try again.' };
    }
  };

  const requestPasswordReset = async (identifier: string): Promise<AuthActionResult> => {
    return {
      success: false,
      message: 'Self-service password reset is not enabled yet. Please contact CULTIV support for account recovery.',
    };
  };

  const resetPassword = async (token: string, password: string): Promise<AuthActionResult> => {
    void token;
    void password;
    return { success: false, message: 'Password reset is not enabled yet. Please contact CULTIV support.' };
  };

  const requestPhoneChangeVerification = async (newPhone: string): Promise<AuthActionResult> => {
    void newPhone;
    return {
      success: false,
      message: 'Phone change verification is not enabled yet. Please contact CULTIV support.',
    };
  };
    const confirmPhoneChangeVerification = async (code: string): Promise<AuthActionResult> => {
    void code;
    return { success: false, message: 'Phone change verification is not enabled yet. Please contact CULTIV support.' };
  };

  const prepareCheckoutOrder = (input: PlaceOrderInput): { order: Order; linkedCustomerId?: string; usedRewardIds: string[] } => {
    const normalizedStoreId = input.storeId.trim();
    if (!normalizedStoreId) {
      throw new Error('Pickup store selection is required.');
    }

    if (input.paymentMethod !== 'upi' && input.paymentMethod !== 'card') {
      throw new Error('Choose UPI or Card to continue.');
    }

    const trimmedName = input.fullName.trim();
    if (!trimmedName) {
      throw new Error('Customer name is required.');
    }

    const normalizedPhoneValue = normalizePhone(input.phone);
    if (normalizedPhoneValue.length !== 10) {
      throw new Error('Valid phone number is required.');
    }

    const normalizedEmailValue = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(normalizedEmailValue)) {
      throw new Error('Valid email address is required.');
    }

    if (!input.items.length) {
      throw new Error('Order must include at least one item.');
    }

    if (!hasValidOrderItems(input.items.map((item) => ({
      title: item.title,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    })))) {
      throw new Error('Order contains invalid line items.');
    }

    const computedSubtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (Math.abs(computedSubtotal - input.subtotal) > PRICE_EPSILON) {
      throw new Error('Order subtotal mismatch.');
    }

    const linkedCustomerId = currentUserId ?? customerAccount?.id ?? undefined;
    const resolvedCustomerId = customerAccount?.id ?? linkedCustomerId ?? null;
    const usedRewardIds = [...new Set(input.usedRewardIds ?? [])];
    const requestedDiscount = Math.max(0, input.rewardDiscount ?? 0);
    const foodSubtotal = input.items
      .filter((item) => item.category !== 'Rewards')
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (linkedCustomerId && usedRewardIds.length > 0) {
      if (input.subtotal < REWARD_MIN_ORDER_SUBTOTAL) {
        throw new Error(`Minimum order of ₹${REWARD_MIN_ORDER_SUBTOTAL} is required to use rewards.`);
      }

      if (foodSubtotal <= 0 || Math.abs(foodSubtotal - input.subtotal) > PRICE_EPSILON) {
        throw new Error('Rewards can only be applied to food items.');
      }

      const profile = purgeExpiredPoints(loyaltyProfiles[linkedCustomerId] ?? createEmptyLoyaltyProfile(linkedCustomerId));

      const allRewardsAvailable = usedRewardIds.every((rewardId) => profile.availableRewards.includes(rewardId));
      if (!allRewardsAvailable) {
        throw new Error('One or more selected rewards are no longer available.');
      }

      const discountRewardsUsed = usedRewardIds.filter((rewardId) => Number.isFinite(DISCOUNT_REWARD_VALUES[rewardId]));
      if (discountRewardsUsed.length > 1) {
        throw new Error('Only one discount reward can be used per order.');
      }

      const allowedDiscount = discountRewardsUsed.length > 0 ? DISCOUNT_REWARD_VALUES[discountRewardsUsed[0]] : 0;
      if (Math.abs(allowedDiscount - requestedDiscount) > PRICE_EPSILON) {
        throw new Error('Reward discount mismatch.');
      }

      if (requestedDiscount > input.subtotal + PRICE_EPSILON) {
        throw new Error('Reward discount cannot exceed items total.');
      }

      const maxAllowedDiscount = input.subtotal * REWARD_MAX_DISCOUNT_RATIO;
      if (requestedDiscount > maxAllowedDiscount + PRICE_EPSILON) {
        throw new Error('Discount reward cannot exceed 30% of order total.');
      }

      const freeItemValue = usedRewardIds
        .filter((rewardId) => Number.isFinite(FREE_ITEM_REWARD_VALUES[rewardId]))
        .reduce((sum, rewardId) => sum + FREE_ITEM_REWARD_VALUES[rewardId], 0);

      if (freeItemValue > input.subtotal + PRICE_EPSILON) {
        throw new Error('Free item rewards cannot exceed items total.');
      }
    }

    const taxableSubtotal = Math.max(0, input.subtotal - requestedDiscount);
    const gstAmount = Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100;
    const tipAmount = Math.max(0, input.tipAmount ?? 0);
    const tipPercentage = Math.max(0, input.tipPercentage ?? 0);
    const expectedTotal = Math.round((taxableSubtotal + gstAmount + tipAmount) * 100) / 100;
    if (Math.abs(expectedTotal - input.total) > PRICE_EPSILON) {
      throw new Error('Order total mismatch.');
    }

    const orderId = createId('order');
    const createdAt = new Date().toISOString();
    const items: OrderItem[] = input.items.map((item) => ({ ...item, orderId }));
    const status: OrderStatus = 'placed';

    const preparedOrder: Order = {
      id: orderId,
      userId: linkedCustomerId,
      customerId: resolvedCustomerId,
      storeId: normalizedStoreId,
      category: input.category,
      items,
      orderType: input.orderType,
      subtotal: input.subtotal,
      rewardDiscount: requestedDiscount,
      taxAmount: gstAmount,
      total: input.total,
      status,
      createdAt,
      phone: normalizedPhoneValue,
      fullName: trimmedName,
      email: normalizedEmailValue,
      source: input.source ?? 'app',
      paymentMethod: input.paymentMethod,
      tipPercentage,
      tipAmount,
      fulfillmentWindow: buildFulfillmentWindow(),
      statusTimeline: buildStatusTimeline(createdAt),
    };

    return {
      order: preparedOrder,
      linkedCustomerId,
      usedRewardIds,
    };
  };

  const commitPlacedOrderState = (placedOrder: Order, linkedCustomerId: string | undefined, usedRewardIds: string[]) => {
    setAllOrders((previous) => [placedOrder, ...previous]);
    setSupabaseReadSuccessful(true);
    setSupabaseReadDegraded(false);
    setSupabaseRefreshTick((value) => value + 1);
    if (linkedCustomerId) {
      if (usedRewardIds.length > 0) {
        setLoyaltyProfiles((previous) => {
          const existing = previous[linkedCustomerId];
          if (!existing) return previous;

          const used = new Set(usedRewardIds);
          return {
            ...previous,
            [linkedCustomerId]: {
              ...existing,
              availableRewards: existing.availableRewards.filter((rewardId) => !used.has(rewardId)),
            },
          };
        });
      }
    }
  };
    const createCheckoutPaymentIntent = async (input: PlaceOrderInput): Promise<CheckoutPaymentIntent> => {
    const { order } = prepareCheckoutOrder(input);
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : createId('checkout');

    if (!customerSessionToken) {
      throw new Error('Please sign in again to continue checkout securely.');
    }

    try {
      return await invokeCreateCheckoutPaymentIntent(order, idempotencyKey, customerSessionToken);
    } catch (error) {
      setSupabaseReadDegraded(true);
      throw (error instanceof Error ? error : new Error('Could not start payment. Please try again.'));
    }
  };

  const confirmCheckoutPayment = async (input: ConfirmCheckoutPaymentInput): Promise<CheckoutPaymentResult> => {
    try {
      const persisted = await invokeConfirmCheckoutPayment(input);

      if (input.outcome !== 'succeeded') {
        return { success: false, message: 'Payment was not completed.' };
      }

      if (!input.orderInput) {
        throw new Error('Order payload is missing for payment confirmation.');
      }

      const { order, linkedCustomerId, usedRewardIds } = prepareCheckoutOrder(input.orderInput);
      const placedOrder: Order = {
        ...order,
        id: persisted.orderId,
        status: persisted.orderStatus,
        items: order.items.map((item) => ({ ...item, orderId: persisted.orderId })),
      };

      commitPlacedOrderState(placedOrder, linkedCustomerId, usedRewardIds);
      return { success: true, order: placedOrder };
    } catch (error) {
      if (input.outcome === 'failed' || input.outcome === 'cancelled') {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Payment was not completed.',
        };
      }

      setSupabaseReadDegraded(true);
      throw (error instanceof Error ? error : new Error('Could not place order right now. Please try again.'));
    }
  };

  const placeOrder = async (input: PlaceOrderInput): Promise<Order> => {
    prepareCheckoutOrder(input);
    throw new Error('Direct order placement is disabled. Use Pay & Place Order for prepaid checkout.');
  };

  const createCounterWalkInOrder = async (input: CreateCounterWalkInOrderInput): Promise<Order> => {
  const normalizedStoreId = input.storeId.trim();
  const linkedCustomerId = input.linkedCustomerId?.trim() || null;

  if (!normalizedStoreId) {
    throw new Error('Store is required for walk-in billing.');
  }
  if (!input.items.length) {
    throw new Error('Add at least one item before billing.');
  }

  if (!hasValidOrderItems(input.items.map((item) => ({
    title: item.title,
    category: item.category,
    quantity: item.quantity,
    price: item.price,
  })))) {
    throw new Error('Invalid item details in counter billing cart.');
  }

  const normalizedPhoneValue = normalizePhone(input.phone ?? '');
  if (input.phone?.trim() && normalizedPhoneValue.length !== 10) {
    throw new Error('Enter a valid 10-digit phone number or skip customer details.');
  }
  if (input.tipPercentage < 0 || input.tipAmount < 0) {
    throw new Error('Tip details are invalid.');
  }

  const normalizedEmailValue = input.email?.trim() || '';
  const displayName = input.fullName?.trim() || 'Walk-in Guest';
  const createdAt = new Date().toISOString();
  const orderId = createId('walkin');

  const items: OrderItem[] = input.items.map((item) => ({
    id: createId('item'),
    orderId,
    category: item.category,
    title: item.title,
    selections: item.selections,
    quantity: item.quantity,
    price: item.price,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round(subtotal * POS_TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + taxAmount + input.tipAmount) * 100) / 100;

  if (!Number.isFinite(total) || total < 0) {
    throw new Error('Computed billing total is invalid.');
  }

  const newOrder: Order = {
    id: orderId,
    userId: linkedCustomerId ?? undefined,
    customerId: linkedCustomerId,
    storeId: normalizedStoreId,
    category: items[0]?.category ?? 'Counter Billing',
    items,
    orderType: 'walk_in',
    subtotal,
    rewardDiscount: 0,
    taxAmount,
    total,
    status: 'completed',
    createdAt,
    phone: normalizedPhoneValue,
    fullName: displayName,
    email: normalizedEmailValue,
    source: 'walk_in',
    paymentMethod: input.paymentMethod,
    tipPercentage: input.tipPercentage,
    tipAmount: input.tipAmount,
    fulfillmentWindow: 'Handed to customer at counter',
    statusTimeline: buildCompletedWalkInStatusTimeline(createdAt),
  };

  try {
    const persisted = await persistOrderToSupabase(newOrder);
    const syncedOrder: Order = {
      ...newOrder,
      id: persisted.orderId,
      customerId: persisted.customerId ?? newOrder.customerId,
      status: persisted.orderStatus,
      items: newOrder.items.map((item) => ({ ...item, orderId: persisted.orderId })),
    };
    setAllOrders((previous) => [syncedOrder, ...previous]);
    setSupabaseReadSuccessful(true);
    setSupabaseReadDegraded(false);
    setSupabaseRefreshTick((value) => value + 1);
    return syncedOrder;
  } catch (error) {
    setSupabaseReadDegraded(true);
    throw error instanceof Error
      ? error
      : new Error('Could not create counter billing order right now. Please try again.');
  }
};

  const lookupPosCustomerByPhone = async (_phone: string): Promise<PosCustomerLookupResult | null> => {
    throw new Error('POS customer lookup now requires the internal customer directory service.');
  };

  const linkWalkInOrder = async ({ phone, reference }: WalkInLinkInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return {
        success: false,
        message: 'Sign in to link walk-in orders.',
        userExists: false,
      };
    }

    const normalizedPhoneValue = normalizePhone(phone);
    const currentUserPhone = normalizePhone(userRecord.phone);
    if (normalizedPhoneValue !== currentUserPhone) {
      return {
        success: false,
        message: 'Use your logged-in phone number to link walk-in orders.',
        userExists: true,
      };
    }

    const candidate = users.find((entry) => entry.id === userRecord.id);
    if (!candidate) {
      return {
        success: false,
        message: 'No CULTIV profile was found for this phone number.',
        userExists: false,
      };
    }

    const internalSession = readStorage<InternalAccessSessionSnapshot | null>(ADMIN_ACCESS_SESSION_STORAGE_KEY, null);
    const canonicalStoreId = internalSession?.scopeStoreId?.trim() || '';
    if (!canonicalStoreId) {
      return {
        success: false,
        message: 'Select a store before linking a walk-in order.',
        userExists: true,
      };
    }

    const orderId = createId('walkin');
    const createdAt = new Date().toISOString();
    const subtotal = 189;
    const taxAmount = Math.round(subtotal * POS_TAX_RATE * 100) / 100;
    const tipAmount = 0;
    const total = subtotal + taxAmount;
    const linkedOrder: Order = {
      id: orderId,
      userId: candidate.id,
      customerId: customerAccount?.id ?? null,
      storeId: canonicalStoreId,
      category: 'Walk-In Bowl',
      items: [
        {
          id: createId('item'),
          orderId,
          category: 'Walk-In Bowl',
          title: 'Counter order linked to profile',
          selections: [
            { section: 'Source', choices: ['In-store purchase'] },
            { section: 'Benefit', choices: ['Rewards attached to profile'] },
            ...(reference ? [{ section: 'Reference', choices: [reference] }] : []),
          ],
          quantity: 1,
          price: 189,
        },
      ],
      orderType: 'walk_in',
      subtotal,
      rewardDiscount: 0,
      taxAmount,
      tipAmount,
      total,
      status: 'completed',
      createdAt,
      phone: normalizedPhoneValue,
      fullName: candidate.fullName,
      email: normalizeEmail(candidate.email),
      source: 'walk_in',
      fulfillmentWindow: 'In-store linked successfully',
      statusTimeline: buildStatusTimeline(createdAt),
    };

    try {
      const persisted = await persistOrderToSupabase(linkedOrder);
      const syncedOrder: Order = {
        ...linkedOrder,
        id: persisted.orderId,
        status: persisted.orderStatus,
        items: linkedOrder.items.map((item) => ({ ...item, orderId: persisted.orderId })),
      };
      setAllOrders((previous) => [syncedOrder, ...previous]);
      setSupabaseReadSuccessful(true);
      setSupabaseReadDegraded(false);
      setSupabaseRefreshTick((value) => value + 1);

      return {
        success: true,
        message: reference
          ? `In-store order ${reference} is now attached to the CULTIV profile.`
          : 'This walk-in order is now attached to the CULTIV profile.',
        userExists: true,
      };
    } catch {
      setSupabaseReadDegraded(true);
      return {
        success: false,
        message: 'Could not link walk-in order right now. Please try again.',
        userExists: true,
      };
    }
  };

  const redeemReward = async (offerId: string): Promise<AuthActionResult> => {
    if (!user) {
      return { success: false, message: 'Sign in to redeem a member benefit.' };
    }

    const offer = OFFER_LIBRARY.find((entry) => entry.id === offerId);
    const profile = loyaltyProfiles[user.id];
    if (!offer || !profile) {
      return { success: false, message: 'This benefit is not available right now.' };
    }

    const now = Date.now();
    const normalizedProfile = purgeExpiredPoints(profile, now);
    const pointCost = offer.pointCost ?? 0;

    if (!offer.pointCost) {
      return { success: false, message: 'This reward cannot be redeemed with points.' };
    }

    if (normalizedProfile.availableRewards.includes(offer.id)) {
      return { success: true, message: `${offer.title} is already in your account. Use it at checkout.` };
    }

    if (normalizedProfile.availablePoints < pointCost) {
      return { success: false, message: 'You need more non-expired points to redeem this reward.' };
    }

    const deducted = deductPointsFIFO(normalizedProfile, pointCost, now);
    if (!deducted) {
      return { success: false, message: 'Unable to redeem right now. Please try again.' };
    }

    setLoyaltyProfiles((previous) => ({
      ...previous,
      [user.id]: {
        ...normalizedProfile,
        ...deducted,
        availableRewards: [...normalizedProfile.availableRewards, offer.id],
        pointsActivity: addActivity(normalizedProfile.pointsActivity, {
          type: 'redeem',
          points: pointCost,
          date: now,
          description: `Redeemed ${offer.title}.`,
        }),
      },
    }));

    return { success: true, message: `${offer.title} is now saved to your CULTIV profile.` };
  };

  const updateProfile = async (updates: Partial<Pick<User, 'fullName'>> & { preferences?: Partial<UserPreferences> }): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to update your profile.' };
    }

    setUsers((previous) =>
      previous.map((entry) =>
        entry.id === userRecord.id
          ? {
            ...entry,
            ...updates,
            preferences: updates.preferences ? { ...entry.preferences, ...updates.preferences } : entry.preferences,
          }
          : entry,
      ),
    );

    return { success: true, message: 'Your CULTIV profile has been updated.' };
  };

  const addSavedAddress = async (input: SavedAddressInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to save addresses.' };
    }

    const shouldBeDefault = input.isDefault || !userRecord.savedAddresses.length;
    const address: Address = {
      id: createId('address'),
      userId: userRecord.id,
      label: input.label,
      addressLine: input.addressLine,
      landmark: input.landmark,
      city: input.city,
      pincode: input.pincode,
      isDefault: shouldBeDefault,
    };

    setUsers((previous) => previous.map((entry) => (
      entry.id === userRecord.id
        ? {
          ...entry,
          savedAddresses: [
            ...entry.savedAddresses.map((savedAddress) => ({ ...savedAddress, isDefault: shouldBeDefault ? false : savedAddress.isDefault })),
            address,
          ],
          defaultAddressId: shouldBeDefault ? address.id : entry.defaultAddressId,
        }
        : entry
    )));
    return { success: true, message: 'Address saved to your CULTIV profile.' };
  };

  const updateSavedAddress = async (input: UpdateSavedAddressInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to edit saved addresses.' };
    }

    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const shouldBeDefault = input.isDefault || entry.defaultAddressId === input.id;
      return {
        ...entry,
        savedAddresses: entry.savedAddresses.map((address) => address.id === input.id
          ? {
            ...address,
            label: input.label,
            addressLine: input.addressLine,
            landmark: input.landmark,
            city: input.city,
            pincode: input.pincode,
            isDefault: shouldBeDefault,
          }
          : { ...address, isDefault: shouldBeDefault ? false : address.isDefault }),
        defaultAddressId: shouldBeDefault ? input.id : entry.defaultAddressId,
      };
    }));

    return { success: true, message: 'Address updated for your CULTIV profile.' };
  };

  const deleteSavedAddress = async (addressId: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage saved addresses.' };
    }

    let nextDefaultAddressId: string | undefined;
    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const remainingAddresses = entry.savedAddresses.filter((address) => address.id !== addressId);
      nextDefaultAddressId = entry.defaultAddressId === addressId ? remainingAddresses[0]?.id : entry.defaultAddressId;
      return {
        ...entry,
        savedAddresses: remainingAddresses.map((address, index) => ({
          ...address,
          isDefault: nextDefaultAddressId ? address.id === nextDefaultAddressId : index === 0,
        })),
        defaultAddressId: nextDefaultAddressId,
      };
    }));

    return { success: true, message: 'Address removed from your CULTIV profile.' };
  };

  const setDefaultAddress = async (addressId: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage saved addresses.' };
    }

    setUsers((previous) => previous.map((entry) => entry.id === userRecord.id
      ? {
        ...entry,
        defaultAddressId: addressId,
        savedAddresses: entry.savedAddresses.map((address) => ({ ...address, isDefault: address.id === addressId })),
      }
      : entry));

    return { success: true, message: 'Default address updated.' };
  };

  const addSavedPaymentMethod = async (input: SavedPaymentMethodInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage payment details.' };
    }

    const paymentMethod: SavedPaymentMethod = {
      id: createId('payment'),
      type: input.type,
      label: input.label,
      last4: input.last4,
      upiId: input.upiId,
      billingName: input.billingName,
      isDefault: input.isDefault || !userRecord.paymentProfile.savedMethods.length,
    };

    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const shouldBeDefault = Boolean(paymentMethod.isDefault);
      return {
        ...entry,
        paymentProfile: {
          ...entry.paymentProfile,
          preferredMethod: shouldBeDefault ? paymentMethod.type : entry.paymentProfile.preferredMethod,
          upiId: paymentMethod.type === 'upi' ? paymentMethod.upiId ?? entry.paymentProfile.upiId : entry.paymentProfile.upiId,
          savedMethods: [
            ...entry.paymentProfile.savedMethods.map((method) => ({ ...method, isDefault: shouldBeDefault ? false : method.isDefault })),
            paymentMethod,
          ],
        },
      };
    }));

    return { success: true, message: 'Payment method saved to your CULTIV profile.' };
  };

  const updateSavedPaymentMethod = async (input: UpdateSavedPaymentMethodInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage payment details.' };
    }

    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const shouldBeDefault = input.isDefault || entry.paymentProfile.savedMethods.find((method) => method.id === input.id)?.isDefault;
      return {
        ...entry,
        paymentProfile: {
          ...entry.paymentProfile,
          preferredMethod: shouldBeDefault ? input.type : entry.paymentProfile.preferredMethod,
          upiId: input.type === 'upi' ? input.upiId ?? entry.paymentProfile.upiId : entry.paymentProfile.upiId,
          savedMethods: entry.paymentProfile.savedMethods.map((method) => method.id === input.id
            ? {
              ...method,
              type: input.type,
              label: input.label,
              last4: input.last4,
              upiId: input.upiId,
              billingName: input.billingName,
              isDefault: shouldBeDefault,
            }
            : { ...method, isDefault: shouldBeDefault ? false : method.isDefault }),
        },
      };
    }));

    return { success: true, message: 'Payment details updated.' };
  };

  const deleteSavedPaymentMethod = async (paymentMethodId: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage payment details.' };
    }

    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const remainingMethods = entry.paymentProfile.savedMethods.filter((method) => method.id !== paymentMethodId);
      const nextDefaultMethod = remainingMethods.find((method) => method.isDefault) ?? remainingMethods[0];
      return {
        ...entry,
        paymentProfile: {
          ...entry.paymentProfile,
          preferredMethod: nextDefaultMethod?.type,
          upiId: nextDefaultMethod?.type === 'upi' ? nextDefaultMethod.upiId : entry.paymentProfile.upiId,
          savedMethods: remainingMethods.map((method) => ({ ...method, isDefault: nextDefaultMethod ? method.id === nextDefaultMethod.id : false })),
        },
      };
    }));

    return { success: true, message: 'Payment method removed.' };
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to manage payment details.' };
    }

    setUsers((previous) => previous.map((entry) => {
      if (entry.id !== userRecord.id) return entry;
      const defaultMethod = entry.paymentProfile.savedMethods.find((method) => method.id === paymentMethodId);
      return {
        ...entry,
        paymentProfile: {
          ...entry.paymentProfile,
          preferredMethod: defaultMethod?.type,
          upiId: defaultMethod?.type === 'upi' ? defaultMethod.upiId : entry.paymentProfile.upiId,
          savedMethods: entry.paymentProfile.savedMethods.map((method) => ({ ...method, isDefault: method.id === paymentMethodId })),
        },
      };
    }));

    return { success: true, message: 'Preferred payment method updated.' };
  };

  const getOrderById = (orderId: string) => orders.find((order) => order.id === orderId);

  const updateOrderStatus = async (orderId: string, status: OrderStatus, reason?: string): Promise<AuthActionResult> => {
    const internalSession = readStorage<InternalAccessSessionSnapshot | null>(ADMIN_ACCESS_SESSION_STORAGE_KEY, null);
    if (!internalSession?.internalSessionToken) {
      return { success: false, message: 'Internal access session is required.' };
    }

    const existingOrder = sharedOrders.find((entry) => entry.id === orderId) ?? allOrders.find((entry) => entry.id === orderId);
    if (!existingOrder) {
      return { success: false, message: 'Order not found.' };
    }

    const supportedStatuses: OrderStatus[] = ['placed', 'preparing', 'ready_for_pickup', 'completed', 'cancelled'];
    if (!supportedStatuses.includes(status)) {
      return { success: false, message: 'Unsupported order status.' };
    }

    if (!supportedStatuses.includes(existingOrder.status)) {
      return { success: false, message: 'Order has an unsupported current status.' };
    }

    if (existingOrder.status === 'completed' || existingOrder.status === 'cancelled') {
      return { success: false, message: 'Completed or cancelled orders cannot be changed.' };
    }

    if (status === 'cancelled') {
      if (!(existingOrder.status === 'placed' || existingOrder.status === 'preparing')) {
        return { success: false, message: 'Order can only be cancelled from placed or preparing.' };
      }
    } else {
      const currentIndex = existingOrder.statusTimeline.findIndex((entry) => entry.status === existingOrder.status);
      if (currentIndex < 0 || currentIndex >= existingOrder.statusTimeline.length - 1) {
        return { success: false, message: 'Order cannot move to another status.' };
      }
      const nextExpectedStatus = existingOrder.statusTimeline[currentIndex + 1]?.status;
      if (!nextExpectedStatus || status !== nextExpectedStatus) {
        return { success: false, message: 'Use the next step in the order workflow.' };
      }
    }

    try {
      await updateSupabaseOrderStatus(orderId, status, reason, {
        internalSessionToken: internalSession.internalSessionToken,
        roleKey: internalSession.roleKey,
        scopeType: internalSession.scopeType,
        scopeStoreId: internalSession.scopeStoreId,
      });

      setAllOrders((previous) => previous.map((entry) => (
        entry.id === orderId ? { ...entry, status } : entry
      )));
      setSupabaseSharedOrders((previous) => previous.map((entry) => (
        entry.id === orderId ? { ...entry, status } : entry
      )));
      setSupabaseReadSuccessful(true);
      setSupabaseReadDegraded(false);
      setSupabaseRefreshTick((value) => value + 1);
    } catch (err) {
      console.error('Supabase status update failed.', err);
      setSupabaseReadDegraded(true);
      let message = 'Could not update order status. Please try again.';
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === 'object') {
        if ('message' in err && typeof err.message === 'string') {
          message = err.message;
        } else if ('error' in err && typeof err.error === 'string') {
          message = err.error;
        }
      }
      return { success: false, message };
    }

    return { success: true, message: 'Order status updated.' };
  };

  const logout = () => {
    resetShoppingSessionStorage();
    setCurrentUserId(null);
    setCustomerAccount(null);
    setCustomerSessionToken(null);
    setLoyaltySummary(null);
    setPendingGuestOrderClaims([]);
    setAllOrders([]);
  };

  const value: AuthContextType = {
    user,
    customerAccount,
    isAuthenticated: Boolean(user),
    orders,
    sharedOrders,
    activeOrders,
    offers: OFFER_LIBRARY,
    loyaltyProfile,
    loyaltySummary,
    loyaltyLoading,
    refreshLoyalty,
    login,
    signup,
    requestPasswordReset,
    resetPassword,
    logout,
    placeOrder,
    createCheckoutPaymentIntent,
    confirmCheckoutPayment,
    createCounterWalkInOrder,
    lookupPosCustomerByPhone,
    linkWalkInOrder,
    redeemReward,
    updateProfile,
    addSavedAddress,
    updateSavedAddress,
    deleteSavedAddress,
    setDefaultAddress,
    addSavedPaymentMethod,
    updateSavedPaymentMethod,
    deleteSavedPaymentMethod,
    setDefaultPaymentMethod,
    requestPhoneChangeVerification,
    confirmPhoneChangeVerification,
    getOrderById,
    updateOrderStatus,
    pendingGuestOrderClaims,
    claimPendingGuestOrders,
    rejectPendingGuestClaims: rejectPendingGuestOrderClaims,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
