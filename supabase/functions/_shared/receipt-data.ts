// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from './customer-session.ts';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';

export interface InternalAccessSessionRow {
  id: string;
  session_token: string;
  internal_user_id: string;
  role_key: RoleKey;
  scope_type: ScopeType;
  scope_store_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
}

const loadPermissionKeys = async (db: ReturnType<typeof createClient>, internalUserId: string) => {
  const { data, error } = await db
    .from('internal_users')
    .select('roles!inner(role_permissions(is_allowed, permissions(permission_key)))')
    .eq('id', internalUserId)
    .single();

  if (error || !data) {
    return { error: 'Could not load internal user permissions.' };
  }

  const permissionKeys = ((data.roles?.role_permissions ?? []) as Array<{ is_allowed?: boolean; permissions?: { permission_key?: string | null } | null }>)
    .filter((entry) => entry.is_allowed)
    .map((entry) => entry.permissions?.permission_key?.trim())
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey));

  return { permissionKeys: Array.from(new Set(permissionKeys)) };
};

export interface ReceiptBusinessMeta {
  brandName: string;
  storeName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  gstin: string;
  code: string;
}

export interface CanonicalReceiptData {
  meta: {
    orderNumber: string;
    orderId: string;
    createdAt: string;
    orderStatus?: string | null;
    storeId?: string | null;
    paymentMethod?: string;
    paymentStatus?: string | null;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentReference?: string;
  };
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: number;
    lineTotal: number;
    selections: Array<{
      section: string;
      choices: string[];
    }>;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    tip: number;
    total: number;
  };
  business: ReceiptBusinessMeta;
}

export async function verifyAndLoadInternalSession(
  db: ReturnType<typeof createClient>,
  token: string,
): Promise<{ valid: true; session: InternalAccessSessionRow } | { valid: false; error: string }> {
  const { data, error } = await db
    .from('internal_access_sessions')
    .select('id, session_token, internal_user_id, role_key, scope_type, scope_store_id, expires_at, revoked_at, last_seen_at')
    .eq('session_token', token)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Internal session not found.' };
  }
  if (data.revoked_at !== null) {
    return { valid: false, error: 'Internal session has been revoked.' };
  }
  if (new Date(data.expires_at) <= new Date()) {
    return { valid: false, error: 'Internal session has expired.' };
  }

  return { valid: true, session: data as InternalAccessSessionRow };
}

export async function loadAuthorizedReceipt(params: {
  db: ReturnType<typeof createClient>;
  orderId: string;
  customerSessionToken?: string | null;
  internalSessionToken?: string | null;
}): Promise<{
  authContext: 'customer' | 'internal';
  receipt: CanonicalReceiptData;
}> {
  const { db, orderId, customerSessionToken, internalSessionToken } = params;

  let allowedCustomerId: string | null = null;
  let internalScopeStoreId: string | null = null;
  const authContext: 'customer' | 'internal' = internalSessionToken ? 'internal' : 'customer';

  if (internalSessionToken) {
    const verifiedInternalSession = await verifyAndLoadInternalSession(db, internalSessionToken);
    if (!verifiedInternalSession.valid) {
      throw new Error(verifiedInternalSession.error);
    }
    const permissionsResult = await loadPermissionKeys(db, verifiedInternalSession.session.internal_user_id);
    if ('error' in permissionsResult) {
      throw new Error(permissionsResult.error);
    }
    const hasReceiptAccess = permissionsResult.permissionKeys.includes('can_access_orders')
      || permissionsResult.permissionKeys.includes('can_access_pos');
    if (!hasReceiptAccess) {
      throw new Error('You do not have permission to access receipts.');
    }
    internalScopeStoreId = verifiedInternalSession.session.scope_type === 'store'
      ? verifiedInternalSession.session.scope_store_id
      : null;
  } else {
    const customerSession = await verifyAndLoadCustomerSession(db, customerSessionToken ?? '');
    if (!customerSession.valid) {
      throw new Error(customerSession.error);
    }
    allowedCustomerId = customerSession.session.customer_id ?? null;
  }

  const { data: orderRow, error: orderError } = await db
    .from('orders')
    .select(`
      order_id,
      order_number,
      order_status,
      store_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      payment_method,
      subtotal_amount,
      discount_amount,
      tax_amount,
      tip_amount,
      total_amount,
      created_at,
      order_items (
        order_item_id,
        item_name,
        unit_price,
        quantity,
        line_total,
        order_item_selections (
          group_name_snapshot,
          option_name
        )
      )
    `)
    .eq('order_id', orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error('Could not load order receipt.');
  }
  if (!orderRow) {
    throw new Error('Order not found.');
  }
  if (allowedCustomerId && orderRow.customer_id !== allowedCustomerId) {
    throw new Error('This order does not belong to the signed-in customer.');
  }
  if (internalScopeStoreId && orderRow.store_id !== internalScopeStoreId) {
    throw new Error('Store scope does not allow viewing this receipt.');
  }

  const { data: storeRow, error: storeError } = await db
    .from('stores')
    .select(`
      id,
      name,
      code,
      phone,
      email,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
      legal_name,
      gstin
    `)
    .eq('id', orderRow.store_id)
    .maybeSingle();

  if (storeError) {
    throw new Error('Could not load receipt store details.');
  }

  const { data: paymentRow, error: paymentError } = await db
    .from('order_payments')
    .select('payment_method, status, reference, recorded_at')
    .eq('order_id', orderId)
    .maybeSingle();

  if (paymentError) {
    throw new Error('Could not load receipt payment details.');
  }

  const receipt: CanonicalReceiptData = {
    meta: {
      orderNumber: orderRow.order_number || orderRow.order_id,
      orderId: orderRow.order_id,
      createdAt: orderRow.created_at,
      orderStatus: orderRow.order_status ?? null,
      storeId: orderRow.store_id ?? null,
      paymentMethod: paymentRow?.payment_method ?? orderRow.payment_method ?? undefined,
      paymentStatus: paymentRow?.status ?? null,
      customerName: orderRow.customer_name ?? undefined,
      customerPhone: orderRow.customer_phone ?? undefined,
      customerEmail: orderRow.customer_email ?? undefined,
      paymentReference: paymentRow?.reference ?? undefined,
    },
    items: (orderRow.order_items ?? []).map((item: any) => {
      const groupedSelections = (item.order_item_selections ?? []).reduce((acc: Record<string, string[]>, selection: any) => {
        const section = selection.group_name_snapshot || 'Selections';
        acc[section] = acc[section] ?? [];
        acc[section].push(selection.option_name);
        return acc;
      }, {});

      return {
        id: item.order_item_id,
        title: item.item_name,
        quantity: Number(item.quantity ?? 0),
        price: Number(item.unit_price ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        selections: Object.entries(groupedSelections).map(([section, choices]) => ({
          section,
          choices,
        })),
      };
    }),
    totals: {
      subtotal: Number(orderRow.subtotal_amount ?? 0),
      discount: Number(orderRow.discount_amount ?? 0),
      tax: Number(orderRow.tax_amount ?? 0),
      tip: Number(orderRow.tip_amount ?? 0),
      total: Number(orderRow.total_amount ?? 0),
    },
    business: {
      brandName: 'CULTIV',
      storeName: storeRow?.name ?? 'CULTIV',
      legalName: storeRow?.legal_name ?? '',
      addressLine1: storeRow?.address_line_1 ?? '',
      addressLine2: storeRow?.address_line_2 ?? '',
      city: storeRow?.city ?? '',
      state: storeRow?.state ?? '',
      postalCode: storeRow?.postal_code ?? '',
      country: storeRow?.country ?? 'India',
      phone: storeRow?.phone ?? '',
      email: storeRow?.email ?? '',
      gstin: storeRow?.gstin ?? '',
      code: storeRow?.code ?? '',
    },
  };

  return { authContext, receipt };
}
