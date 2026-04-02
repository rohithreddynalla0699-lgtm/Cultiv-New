// AuthContext — localStorage-backed auth, order management, loyalty tracking, and address storage.

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
import { setDraftCartScope } from '../data/cartDraft';
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
import { PRICE_EPSILON, REWARD_MAX_DISCOUNT_RATIO, REWARD_MIN_ORDER_SUBTOTAL } from '../constants/business';
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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  orders: Order[];
  sharedOrders: Order[];
  activeOrders: Order[];
  offers: Offer[];
  loyaltyProfile: LoyaltyProfile | null;
  login: (input: LoginInput) => Promise<AuthActionResult>;
  signup: (input: SignupInput) => Promise<AuthActionResult>;
  requestPasswordReset: (identifier: string) => Promise<AuthActionResult>;
  resetPassword: (token: string, password: string) => Promise<AuthActionResult>;
  logout: () => void;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  createCounterWalkInOrder: (input: CreateCounterWalkInOrderInput) => Promise<Order>;
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
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<AuthActionResult>;
  pendingGuestOrderClaims: Order[];
  claimPendingGuestOrders: () => void;
  rejectPendingGuestOrderClaims: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  users: 'cultiv_users_v2',
  currentUserId: 'cultiv_current_user_v2',
  orders: 'cultiv_orders_v2',
  loyalty: 'cultiv_loyalty_v2',
  resetTokens: 'cultiv_reset_tokens_v2',
  phoneChangeVerifications: 'cultiv_phone_change_verifications_v1',
  rejectedGuestClaims: 'cultiv_rejected_guest_claims_v1',
} as const;

const SYNC_URL: string | undefined = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SYNC_SERVER_URL;
const AUTH_SYNC_CLIENT_ID = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const STATUS_CONTENT: Record<OrderStatus, { label: string; description: string }> = {
  placed: { label: 'Order Placed', description: 'Your order is in the CULTIV queue.' },
  preparing: { label: 'Preparing', description: 'Fresh ingredients are being assembled.' },
  ready_for_pickup: { label: 'Ready for Pickup', description: 'Your order is ready at the counter.' },
  completed: { label: 'Completed', description: 'Your order has been fulfilled.' },
};

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

const PASSWORD_HASH_PREFIX = 'h$';

const hashPassword = (password: string) => {
  // Demo-safe non-cryptographic hash to avoid storing plaintext passwords.
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
  // Backward compatibility for any older seed/session data.
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
type SupabaseSourceChannel = 'app' | 'walk-in' | 'phone';

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

const resolveSupabaseOrderType = (orderType: 'pickup' | 'walk-in', source: SupabaseSourceChannel): SupabaseOrderType => {
  if (source === 'phone') return 'phone';
  return orderType === 'walk-in' ? 'walk_in' : 'online';
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

const ORDER_NUMBER_PREFIX = 'CULTIV';
const ORDER_NUMBER_SEQUENCE_LENGTH = 4;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatOrderNumberDate = (date: Date) => {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

const getUtcDayRange = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const generateOrderNumber = async () => {
  const now = new Date();
  const dateToken = formatOrderNumberDate(now);
  const { startIso, endIso } = getUtcDayRange(now);

  const { count, error } = await supabase
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (error) {
    throw new Error(`Could not generate order number: ${error.message}`);
  }

  const sequence = (count ?? 0) + 1;
  const paddedSequence = String(sequence).padStart(ORDER_NUMBER_SEQUENCE_LENGTH, '0');
  return `${ORDER_NUMBER_PREFIX}${dateToken}${paddedSequence}`;
};

const resolveMenuItemId = (itemId: string) => {
  const normalized = itemId.trim();
  if (!normalized) return null;
  return UUID_PATTERN.test(normalized) ? normalized : null;
};

const persistOrderToSupabase = async (order: Order): Promise<boolean> => {
  try {
    const sourceChannel: SupabaseSourceChannel = order.source;

    let orderInsert: { order_id: string } | null = null;
    let orderInsertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderNumber = await generateOrderNumber();
      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_type: resolveSupabaseOrderType(order.orderType, sourceChannel),
          source_channel: sourceChannel,
          order_status: order.status,
          store_id: order.storeId ?? DEFAULT_ORDER_STORE_ID,
          customer_name: order.fullName,
          customer_phone: order.phone,
          customer_email: order.email,
          payment_method: order.paymentMethod ?? null,
          notes: null,
          subtotal_amount: Math.round(order.subtotal),
          discount_amount: Math.round(order.rewardDiscount),
          total_amount: Math.round(order.total),
          order_number: orderNumber,
        })
        .select('order_id')
        .single();

      if (!error && data?.order_id) {
        orderInsert = data as { order_id: string };
        orderInsertError = null;
        break;
      }

      orderInsertError = error ? { code: error.code, message: error.message } : { message: 'Could not create orders row.' };

      if (error?.code !== '23505') {
        break;
      }
    }

    if (!orderInsert?.order_id) {
      throw new Error(orderInsertError?.message ?? 'Could not create orders row.');
    }

    const supabaseOrderId = orderInsert.order_id as string;

    try {
      for (const item of order.items) {
        const lineTotal = Math.round(item.price * item.quantity);
        const { data: itemInsert, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: supabaseOrderId,
            menu_item_id: resolveMenuItemId(item.id),
            item_name: item.title,
            item_category: item.category,
            unit_price: Math.round(item.price),
            quantity: item.quantity,
            line_total: lineTotal,
          })
          .select('order_item_id')
          .single();

        if (itemError || !itemInsert?.order_item_id) {
          throw new Error(itemError?.message ?? 'Could not create order_items row.');
        }

        const selectionRows = buildSelectionSnapshotRows(itemInsert.order_item_id as string, item.selections);
        if (selectionRows.length > 0) {
          const { error: selectionError } = await supabase
            .from('order_item_selections')
            .insert(selectionRows);

          if (selectionError) {
            throw new Error(selectionError.message);
          }
        }
      }

      return true;
    } catch (error) {
      await supabase.from('orders').delete().eq('order_id', supabaseOrderId);
      throw error;
    }
  } catch (error) {
    console.error('Supabase order persistence failed. Falling back to local-only persistence.', error);
    return false;
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

const buildSeedState = () => {
  const seedUser: AuthRecord = {
    id: 'user-seed-1',
    fullName: 'Aarav Menon',
    phone: '9876543210',
    email: 'member@cultiv.app',
    password: hashPassword('cultiv123'),
    createdAt: daysAgo(120),
    savedAddresses: [
      {
        id: 'address-seed-1',
        userId: 'user-seed-1',
        label: 'Home',
        addressLine: '12 Palm Grove Road',
        landmark: 'Near Indiranagar Metro',
        city: 'Bengaluru',
        pincode: '560038',
			isDefault: true,
      },
    ],
    preferences: {
      favoriteCategory: 'Rice Bowls',
      preferredOrderType: 'pickup',
      preferredProtein: 'Chicken',
		dietaryPreference: 'High-protein balance',
      familyMealUsage: true,
		kidsMealUsage: true,
    },
  paymentProfile: {
    preferredMethod: 'upi',
    upiId: 'aarav@upi',
    savedMethods: [
      {
        id: 'payment-seed-1',
        type: 'upi',
        label: 'Primary UPI',
        upiId: 'aarav@upi',
        billingName: 'Aarav Menon',
        isDefault: true,
      },
      {
        id: 'payment-seed-2',
        type: 'card',
        label: 'Visa ending 4821',
        last4: '4821',
        billingName: 'Aarav Menon',
      },
    ],
  },
	defaultAddressId: 'address-seed-1',
	emailLocked: true,
	phoneEditable: false,
  };

  const seedOrders: Order[] = [
    {
      id: 'order-seed-1',
      userId: 'user-seed-1',
      storeId: 'store-siddipet',
      category: 'Rice Bowls',
      items: [
        {
          id: 'item-seed-1',
          orderId: 'order-seed-1',
          category: 'Rice Bowls',
          title: 'Brown Rice Bowl',
          selections: [
            { section: 'Rice', choices: ['Brown Rice'] },
            { section: 'Protein', choices: ['Chicken (Meat-Based)'] },
            { section: 'Toppings', choices: ['Roasted Chilli Corn Salsa', 'Green Chilli Salsa'] },
          ],
          quantity: 1,
          price: 209,
        },
      ],
      orderType: 'pickup',
      subtotal: 209,
      rewardDiscount: 0,
      total: 209,
      status: 'preparing',
      createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
      phone: '9876543210',
      fullName: 'Aarav Menon',
      email: 'member@cultiv.app',
      source: 'app',
      fulfillmentWindow: buildFulfillmentWindow(),
      statusTimeline: buildStatusTimeline(new Date(Date.now() - 35 * 60_000).toISOString()),
    },
    {
      id: 'order-seed-2',
      userId: 'user-seed-1',
      storeId: 'store-hyderabad',
      category: 'High Protein',
      items: [
        {
          id: 'item-seed-2',
          orderId: 'order-seed-2',
          category: 'High Protein',
          title: 'High Protein Bowl',
          selections: [
            { section: 'Rice', choices: ['White Rice'] },
            { section: 'Protein', choices: ['Chicken (Meat-Based)', 'Plant Protein'] },
          ],
          quantity: 1,
          price: 269,
        },
      ],
      orderType: 'pickup',
      subtotal: 269,
      rewardDiscount: 0,
      total: 269,
      status: 'completed',
      createdAt: daysAgo(8),
      phone: '9876543210',
      fullName: 'Aarav Menon',
      email: 'member@cultiv.app',
      source: 'app',
      fulfillmentWindow: '07:10 PM - 07:30 PM',
      statusTimeline: buildStatusTimeline(daysAgo(8)),
    },
    {
      id: 'order-seed-3',
      userId: 'user-seed-1',
      storeId: 'store-siddipet',
      category: 'Kids Meals',
      items: [
        {
          id: 'item-seed-3',
          orderId: 'order-seed-3',
          category: 'Kids Meals',
          title: 'Mild Kids Bowl',
          selections: [
            { section: 'Base', choices: ['Soft Rice'] },
            { section: 'Protein', choices: ['Egg'] },
            { section: 'Treat', choices: ['Fresh Fruit'] },
          ],
          quantity: 1,
          price: 99,
        },
      ],
      orderType: 'walk-in',
      subtotal: 99,
      rewardDiscount: 0,
      total: 99,
      status: 'completed',
      createdAt: daysAgo(18),
      phone: '9876543210',
      fullName: 'Aarav Menon',
      email: 'member@cultiv.app',
      source: 'walk-in',
      fulfillmentWindow: '01:20 PM - 01:30 PM',
      statusTimeline: buildStatusTimeline(daysAgo(18)),
    },
  ];

  const loyaltyProfiles: Record<string, LoyaltyProfile> = {
    'user-seed-1': {
      userId: 'user-seed-1',
      pointsBatches: [
        {
          points: 148,
          earnedAt: Date.now() - 12 * DAY_MS,
          expiresAt: Date.now() + 78 * DAY_MS,
        },
      ],
      availablePoints: 148,
      expiringSoonPoints: 0,
      expiredPoints: 0,
      availableRewards: [],
      pointsActivity: [
        {
          type: 'earn',
          points: 148,
          date: Date.now() - 12 * DAY_MS,
          description: 'Points earned from recent orders.',
        },
      ],
      totalOrders: 4,
      totalSpend: 1154,
      currentTier: 'Routine Member',
    },
  };

  return {
    users: [seedUser],
    orders: seedOrders,
    loyaltyProfiles,
    currentUserId: null as string | null,
    resetTokens: [] as ResetTokenRecord[],
    phoneChangeVerifications: [] as PhoneChangeVerificationRecord[],
  };
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
  const [allOrders, setAllOrders] = useState<Order[]>(() => normalizeOrderRecords(readStorage(STORAGE_KEYS.orders, seedState.orders), users));
  const [loyaltyProfiles, setLoyaltyProfiles] = useState<Record<string, LoyaltyProfile>>(() => normalizeLoyaltyProfiles(readStorage(STORAGE_KEYS.loyalty, seedState.loyaltyProfiles)));
  const [resetTokens, setResetTokens] = useState<ResetTokenRecord[]>(() => readStorage(STORAGE_KEYS.resetTokens, seedState.resetTokens));
  const [phoneChangeVerifications, setPhoneChangeVerifications] = useState<PhoneChangeVerificationRecord[]>(() => readStorage(STORAGE_KEYS.phoneChangeVerifications, seedState.phoneChangeVerifications));
  const [rejectedGuestClaimIds, setRejectedGuestClaimIds] = useState<string[]>(() => readStorage(STORAGE_KEYS.rejectedGuestClaims, []));
  const [pendingGuestOrderClaims, setPendingGuestOrderClaims] = useState<Order[]>([]);
  const [supabaseSharedOrders, setSupabaseSharedOrders] = useState<Order[]>([]);
  const [supabaseReadSuccessful, setSupabaseReadSuccessful] = useState(false);
  const [supabaseReadDegraded, setSupabaseReadDegraded] = useState(false);
  const [supabaseRefreshTick, setSupabaseRefreshTick] = useState(0);
  const usersRef = useRef(users);
  const ordersRef = useRef(allOrders);

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
    setDraftCartScope(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.orders, allOrders);
  }, [allOrders]);

  // Optional cross-device sync for auth + orders (enabled by VITE_SYNC_SERVER_URL)
  useEffect(() => {
    if (!SYNC_URL) return;
    fetch(`${SYNC_URL}/api/state`, { signal: AbortSignal.timeout(4000) })
      .then((response) => response.json())
      .then((state: Record<string, unknown>) => {
        if (Array.isArray(state.users) && state.users.length > 0) {
          setUsers(normalizeUserRecords(state.users as AuthRecord[]));
        }
        if (Array.isArray(state.orders) && state.orders.length > 0) {
          setAllOrders(normalizeOrderRecords(state.orders as Order[], usersRef.current));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!SYNC_URL) return;
    const id = window.setTimeout(() => {
      fetch(`${SYNC_URL}/api/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Client-ID': AUTH_SYNC_CLIENT_ID },
        body: JSON.stringify({ users, orders: allOrders }),
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(id);
  }, [users, allOrders]);

  useEffect(() => {
    if (!SYNC_URL) return;
    const es = new EventSource(`${SYNC_URL}/api/events`);
    es.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data) as Record<string, unknown>;
        if (state._sourceClientId === AUTH_SYNC_CLIENT_ID) return;

        if (Array.isArray(state.users) && JSON.stringify(state.users) !== JSON.stringify(usersRef.current)) {
          const nextUsers = normalizeUserRecords(state.users as AuthRecord[]);
          setUsers(nextUsers);
        }
        if (Array.isArray(state.orders) && JSON.stringify(state.orders) !== JSON.stringify(ordersRef.current)) {
          setAllOrders(normalizeOrderRecords(state.orders as Order[], usersRef.current));
        }
      } catch {
        // ignore malformed payloads
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.loyalty, loyaltyProfiles);
  }, [loyaltyProfiles]);

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
      const nextOrders = await fetchOperationalOrdersFromSupabase();
      const hasRecentLocalOrders = allOrders.some((order) => Date.now() - new Date(order.createdAt).getTime() < 24 * 60 * 60 * 1000);
      if (nextOrders.length === 0 && hasRecentLocalOrders) {
        console.warn('Supabase returned zero orders while recent local orders exist. Using local fallback for safety.');
        setSupabaseReadDegraded(true);
        return;
      }
      setSupabaseSharedOrders(nextOrders);
      setSupabaseReadSuccessful(true);
      setSupabaseReadDegraded(false);
    } catch (error) {
      console.error('Supabase admin order read failed, using local fallback.', error);
      setSupabaseReadDegraded(true);
    }
  }, [allOrders]);

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

  const userRecord = users.find((entry) => entry.id === currentUserId) ?? null;
  const user = userRecord ? ({ ...userRecord, password: undefined } as unknown as User) : null;
  const guestOrders = allOrders.filter((order) => !order.userId && order.source === 'app');
  const orders = user ? allOrders.filter((order) => order.userId === user.id) : guestOrders;
  const sharedOrders = (supabaseReadSuccessful && !supabaseReadDegraded) ? supabaseSharedOrders : allOrders;
  const activeOrders = orders.filter((order) => order.status !== 'completed');
  const loyaltyProfile = user ? loyaltyProfiles[user.id] ?? null : null;

  const syncLoyaltyForOrder = (userId: string, total: number, category: string) => {
    setLoyaltyProfiles((previous) => {
      const now = Date.now();
      const existing = purgeExpiredPoints(previous[userId] ?? {
        userId,
        pointsBatches: [],
        availablePoints: 0,
        expiringSoonPoints: 0,
        expiredPoints: 0,
        availableRewards: [],
        pointsActivity: [],
        totalOrders: 0,
        totalSpend: 0,
        currentTier: 'Founding Member',
      }, now);

      const earnedPoints = Math.max(0, Math.floor(total / 10));
      const pointsBatches = earnedPoints > 0
        ? sortBatchesByEarnedDate([
          ...existing.pointsBatches,
          {
            points: earnedPoints,
            earnedAt: now,
            expiresAt: now + POINT_EXPIRY_MS,
          },
        ])
        : existing.pointsBatches;

      const totalOrders = existing.totalOrders + 1;
      const totalSpend = existing.totalSpend + total;
      const summary = summarizePoints(pointsBatches, now);
      const earnedMessage = category === 'Kids Meals'
        ? `Earned ${earnedPoints} points from your Kids Meals order.`
        : `Earned ${earnedPoints} points from your order.`;

      return {
        ...previous,
        [userId]: {
          userId,
          pointsBatches,
          availablePoints: summary.availablePoints,
          expiringSoonPoints: summary.expiringSoonPoints,
          expiredPoints: summary.expiredPoints,
          availableRewards: existing.availableRewards,
          pointsActivity: earnedPoints > 0
            ? addActivity(existing.pointsActivity, {
              type: 'earn',
              points: earnedPoints,
              date: now,
              description: earnedMessage,
            })
            : existing.pointsActivity,
          totalOrders,
          totalSpend,
          currentTier: deriveTier(totalSpend),
        },
      };
    });
  };

  const detectClaimableGuestOrders = (targetUser: AuthRecord): Order[] => {
    const normalizedPhone = normalizePhone(targetUser.phone);
    const targetEmail = normalizeEmail(targetUser.email);

    return allOrders.filter((order) => {
      if (order.userId || order.source !== 'app') return false;
      if (rejectedGuestClaimIds.includes(order.id)) return false;
      const phoneMatches = normalizePhone(order.phone) === normalizedPhone;
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
    const normalized = normalizePhone(identifier);
    const candidate = users.find(
      (entry) => entry.email?.toLowerCase() === identifier.toLowerCase() || normalizePhone(entry.phone) === normalized
    );

    if (!candidate || !verifyPassword(password, candidate.password)) {
      return { success: false, message: 'Invalid phone, email, or password.' };
    }

    setCurrentUserId(candidate.id);
    const claimable = detectClaimableGuestOrders(candidate);
    if (claimable.length > 0) {
      setPendingGuestOrderClaims(claimable);
    }
    return { success: true, message: 'Welcome back to your CULTIV routine.' };
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
    const normalizedPhone = normalizePhone(normalizedPhoneInput);

    const phoneExists = users.some((entry) => normalizePhone(entry.phone) === normalizedPhone);
    if (phoneExists) {
      return { success: false, message: 'A CULTIV profile already exists for this phone number.' };
    }

    if (users.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
      return { success: false, message: 'This email is already attached to a CULTIV profile.' };
    }

    const passwordPolicyMessage = isValidPasswordPolicy(password);
    if (passwordPolicyMessage) {
      return { success: false, message: passwordPolicyMessage };
    }

    const newUserId = createId('user');
    const newUser: AuthRecord = {
      id: newUserId,
      fullName,
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
      savedAddresses: [],
      preferences: {},
    paymentProfile: {
      preferredMethod: 'upi',
      savedMethods: [],
    },
		defaultAddressId: undefined,
		emailLocked: true,
		phoneEditable: false,
    };

    setUsers((previous) => [...previous, newUser]);
    setLoyaltyProfiles((previous) => ({
      ...previous,
      [newUserId]: {
        userId: newUserId,
        pointsBatches: [],
        availablePoints: 0,
        expiringSoonPoints: 0,
        expiredPoints: 0,
        availableRewards: [],
        pointsActivity: [],
        totalOrders: 0,
        totalSpend: 0,
        currentTier: 'Founding Member',
      },
    }));
    setCurrentUserId(newUserId);
    const claimable = detectClaimableGuestOrders(newUser);
    if (claimable.length > 0) {
      setPendingGuestOrderClaims(claimable);
    }

    return { success: true, message: 'Your CULTIV profile is ready.' };
  };

  const requestPasswordReset = async (identifier: string): Promise<AuthActionResult> => {
    const normalized = normalizePhone(identifier);
    const candidate = users.find(
      (entry) => entry.email?.toLowerCase() === identifier.toLowerCase() || normalizePhone(entry.phone) === normalized
    );
    if (!candidate) {
      return {
        success: false,
        message: 'We could not find a CULTIV profile for that phone or email.',
      };
    }

    const token = createId('reset');
    setResetTokens((previous) => [
      ...previous.filter((entry) => entry.userId !== candidate.id),
      { token, userId: candidate.id, expiresAt: new Date(Date.now() + 20 * 60_000).toISOString() },
    ]);

    return {
      success: true,
      message: 'A secure reset link is ready for this mock flow.',
      resetToken: token,
    };
  };

  const resetPassword = async (token: string, password: string): Promise<AuthActionResult> => {
    const tokenRecord = resetTokens.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());
    if (!tokenRecord) {
      return { success: false, message: 'This reset link is no longer valid.' };
    }

    const passwordPolicyMessage = isValidPasswordPolicy(password);
    if (passwordPolicyMessage) {
      return { success: false, message: passwordPolicyMessage };
    }

    setUsers((previous) => previous.map((entry) => (entry.id === tokenRecord.userId ? { ...entry, password: hashPassword(password) } : entry)));
    setResetTokens((previous) => previous.filter((entry) => entry.token !== token));
    return { success: true, message: 'Your password has been updated.' };
  };

  const requestPhoneChangeVerification = async (newPhone: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to update your phone number.' };
    }

    const normalizedPhoneInput = newPhone.trim();
    if (!isValidPhoneForAuthFlows(normalizedPhoneInput)) {
      return { success: false, message: 'Enter a valid 10-digit numeric phone number.' };
    }
    const normalizedPhone = normalizePhone(normalizedPhoneInput);

    if (normalizedPhone === normalizePhone(userRecord.phone)) {
      return { success: false, message: 'This phone number is already on your profile.' };
    }

    const phoneExists = users.some((entry) => entry.id !== userRecord.id && normalizePhone(entry.phone) === normalizedPhone);
    if (phoneExists) {
      return { success: false, message: 'Another CULTIV profile is already using this phone number.' };
    }

    const code = createVerificationCode();
    setPhoneChangeVerifications((previous) => [
      ...previous.filter((entry) => entry.userId !== userRecord.id),
      {
        code,
        userId: userRecord.id,
        newPhone: normalizedPhone,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    ]);

    return {
      success: true,
	  message: 'A verification code was generated for this flow.',
      verificationCode: code,
    };
  };

  const confirmPhoneChangeVerification = async (code: string): Promise<AuthActionResult> => {
    if (!userRecord) {
      return { success: false, message: 'Sign in to update your phone number.' };
    }

    const verification = phoneChangeVerifications.find(
      (entry) => entry.userId === userRecord.id && entry.code === code.trim() && new Date(entry.expiresAt).getTime() > Date.now()
    );

    if (!verification) {
      return { success: false, message: 'This verification code is invalid or has expired.' };
    }

    setUsers((previous) => previous.map((entry) => (
      entry.id === userRecord.id
        ? { ...entry, phone: verification.newPhone }
        : entry
    )));
    setPhoneChangeVerifications((previous) => previous.filter((entry) => entry.userId !== userRecord.id));

    return { success: true, message: 'Your phone number has been updated.' };
  };

  const placeOrder = async (input: PlaceOrderInput): Promise<Order> => {
    const normalizedStoreId = input.storeId.trim();
    if (!normalizedStoreId) {
      throw new Error('Pickup store selection is required.');
    }

    const trimmedName = input.fullName.trim();
    if (!trimmedName) {
      throw new Error('Customer name is required.');
    }

    const normalizedPhone = normalizePhone(input.phone);
    if (normalizedPhone.length !== 10) {
      throw new Error('Valid phone number is required.');
    }

    const normalizedEmail = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
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

    const linkedUserId = currentUserId ?? undefined;
    const usedRewardIds = [...new Set(input.usedRewardIds ?? [])];
    const requestedDiscount = Math.max(0, input.rewardDiscount ?? 0);
    const foodSubtotal = input.items
      .filter((item) => item.category !== 'Rewards')
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (linkedUserId && usedRewardIds.length > 0) {
      if (input.subtotal < REWARD_MIN_ORDER_SUBTOTAL) {
        throw new Error(`Minimum order of ₹${REWARD_MIN_ORDER_SUBTOTAL} is required to use rewards.`);
      }

      if (foodSubtotal <= 0 || Math.abs(foodSubtotal - input.subtotal) > PRICE_EPSILON) {
        throw new Error('Rewards can only be applied to food items.');
      }

      const profile = purgeExpiredPoints(loyaltyProfiles[linkedUserId] ?? {
        userId: linkedUserId,
        pointsBatches: [],
        availablePoints: 0,
        expiringSoonPoints: 0,
        expiredPoints: 0,
        availableRewards: [],
        pointsActivity: [],
        totalOrders: 0,
        totalSpend: 0,
        currentTier: 'Founding Member',
      });

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

    const expectedTotal = Math.max(0, input.subtotal - requestedDiscount);
    if (Math.abs(expectedTotal - input.total) > PRICE_EPSILON) {
      throw new Error('Order total mismatch.');
    }

    const orderId = createId('order');
    const createdAt = new Date().toISOString();
    const items: OrderItem[] = input.items.map((item) => ({ ...item, orderId }));
    const status = 'placed';

    const newOrder: Order = {
      id: orderId,
      userId: linkedUserId,
      storeId: normalizedStoreId,
      category: input.category,
      items,
      orderType: input.orderType,
      subtotal: input.subtotal,
      rewardDiscount: requestedDiscount,
      total: input.total,
      status,
      createdAt,
      phone: normalizedPhone,
      fullName: trimmedName,
      email: normalizedEmail,
      source: input.source ?? 'app',
      fulfillmentWindow: buildFulfillmentWindow(),
      statusTimeline: buildStatusTimeline(createdAt),
    };

    setAllOrders((previous) => [newOrder, ...previous]);
    const persistedToSupabase = await persistOrderToSupabase(newOrder);
    if (persistedToSupabase) {
      setSupabaseRefreshTick((value) => value + 1);
    } else {
      setSupabaseReadDegraded(true);
    }
    if (linkedUserId) {
      if (usedRewardIds.length > 0) {
        setLoyaltyProfiles((previous) => {
          const existing = previous[linkedUserId];
          if (!existing) return previous;

          const used = new Set(usedRewardIds);
          return {
            ...previous,
            [linkedUserId]: {
              ...existing,
              availableRewards: existing.availableRewards.filter((rewardId) => !used.has(rewardId)),
            },
          };
        });
      }
      syncLoyaltyForOrder(linkedUserId, newOrder.total, newOrder.category);
    }

    return newOrder;
  };

  const createCounterWalkInOrder = async (input: CreateCounterWalkInOrderInput): Promise<Order> => {
    if (!input.storeId.trim()) {
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

    const normalizedPhone = normalizePhone(input.phone);
    if (normalizedPhone.length !== 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }
    if (input.tipPercentage < 0 || input.tipAmount < 0) {
      throw new Error('Tip details are invalid.');
    }

    const displayName = input.fullName?.trim() || 'Walk-in Customer';
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
    const total = subtotal + input.tipAmount;
    if (!Number.isFinite(total) || total < 0) {
      throw new Error('Computed billing total is invalid.');
    }

    const newOrder: Order = {
      id: orderId,
      storeId: input.storeId,
      category: items[0]?.category ?? 'Counter Billing',
      items,
      orderType: 'walk-in',
      subtotal,
      rewardDiscount: 0,
      total,
      status: 'completed',
      createdAt,
      phone: normalizedPhone,
      fullName: displayName,
      email: `walkin-${normalizedPhone}@cultiv.local`,
      source: 'walk-in',
      paymentMethod: input.paymentMethod,
      tipPercentage: input.tipPercentage,
      tipAmount: input.tipAmount,
      fulfillmentWindow: buildFulfillmentWindow(),
      statusTimeline: buildStatusTimeline(createdAt),
    };

    setAllOrders((previous) => [newOrder, ...previous]);
    const persistedToSupabase = await persistOrderToSupabase(newOrder);
    if (persistedToSupabase) {
      setSupabaseRefreshTick((value) => value + 1);
    } else {
      setSupabaseReadDegraded(true);
    }
    return newOrder;
  };

  const linkWalkInOrder = async ({ phone, reference }: WalkInLinkInput): Promise<AuthActionResult> => {
    if (!userRecord) {
      return {
        success: false,
        message: 'Sign in to link walk-in orders.',
        userExists: false,
      };
    }

	const normalizedPhone = normalizePhone(phone);
    const currentUserPhone = normalizePhone(userRecord.phone);
    if (normalizedPhone !== currentUserPhone) {
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

    const orderId = createId('walkin');
    const createdAt = new Date().toISOString();
    const linkedOrder: Order = {
      id: orderId,
      userId: candidate.id,
      storeId: DEFAULT_ORDER_STORE_ID,
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
      orderType: 'walk-in',
      subtotal: 189,
      rewardDiscount: 0,
      total: 189,
      status: 'completed',
      createdAt,
      phone: normalizedPhone,
      fullName: candidate.fullName,
      email: normalizeEmail(candidate.email),
      source: 'walk-in',
      fulfillmentWindow: 'In-store linked successfully',
      statusTimeline: buildStatusTimeline(createdAt),
    };

    setAllOrders((previous) => [linkedOrder, ...previous]);
    const persistedToSupabase = await persistOrderToSupabase(linkedOrder);
    if (persistedToSupabase) {
      setSupabaseRefreshTick((value) => value + 1);
    } else {
      setSupabaseReadDegraded(true);
    }
    syncLoyaltyForOrder(candidate.id, linkedOrder.total, linkedOrder.category);

    return {
      success: true,
		message: reference
			? `In-store order ${reference} is now attached to the CULTIV profile.`
			: 'This walk-in order is now attached to the CULTIV profile.',
      userExists: true,
    };
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
          : entry
      )
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

  const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<AuthActionResult> => {
    const existingOrder = sharedOrders.find((entry) => entry.id === orderId) ?? allOrders.find((entry) => entry.id === orderId);
    if (!existingOrder) {
      return { success: false, message: 'Order not found.' };
    }

    const supportedStatuses: OrderStatus[] = ['placed', 'preparing', 'ready_for_pickup', 'completed'];
    if (!supportedStatuses.includes(status)) {
      return { success: false, message: 'Unsupported order status.' };
    }

    if (!supportedStatuses.includes(existingOrder.status)) {
      return { success: false, message: 'Order has an unsupported current status.' };
    }

    if (existingOrder.status === 'completed') {
      return { success: false, message: 'Completed orders cannot be changed.' };
    }

    const currentIndex = existingOrder.statusTimeline.findIndex((entry) => entry.status === existingOrder.status);
    if (currentIndex < 0 || currentIndex >= existingOrder.statusTimeline.length - 1) {
      return { success: false, message: 'Order cannot move to another status.' };
    }

    const nextExpectedStatus = existingOrder.statusTimeline[currentIndex + 1]?.status;
    if (!nextExpectedStatus || status !== nextExpectedStatus) {
      return { success: false, message: 'Use the next step in the order workflow.' };
    }

    let supabasePersisted = false;
    try {
      await updateSupabaseOrderStatus(orderId, status);
      supabasePersisted = true;
      setSupabaseReadSuccessful(true);
      setSupabaseReadDegraded(false);
      setSupabaseRefreshTick((value) => value + 1);
    } catch (error) {
      console.error('Supabase status update failed, using local fallback update.', error);
      setSupabaseReadDegraded(true);
    }

    setAllOrders((previous) => previous.map((entry) => (
      entry.id === orderId ? { ...entry, status } : entry
    )));

    if (!supabasePersisted) {
      return { success: true, message: 'Order status updated locally (Supabase fallback).' };
    }

    return { success: true, message: 'Order status updated.' };
  };


  const logout = () => {
    setCurrentUserId(null);
    setPendingGuestOrderClaims([]);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    orders,
    sharedOrders,
    activeOrders,
    offers: OFFER_LIBRARY,
    loyaltyProfile,
    login,
    signup,
    requestPasswordReset,
    resetPassword,
    logout,
    placeOrder,
    createCounterWalkInOrder,
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
    rejectPendingGuestOrderClaims,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};