// @ts-ignore
import { supabase } from '../../lib/supabase.js';
import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';

export interface StoreLocatorStore {
  id: string;
  name: string;
  city: string;
  code: string;
  addressLine1?: string;
  state?: string;
  zipCode: string;
  phone?: string;
  isActive: boolean;
}

export const SELECTED_STORE_STORAGE_KEY = 'cultiv_selected_store_id_v1';
const STORE_CHANGED_EVENT = 'cultiv:store-changed';
const OPEN_SELECTOR_EVENT = 'cultiv:open-store-selector';

export const CUSTOMER_STORE_METADATA: StoreLocatorStore[] = [
  {
    id: 'store-siddipet',
    name: 'CULTIV Siddipet',
    city: 'Siddipet',
    code: 'SID-CEN',
    addressLine1: '',
    state: '',
    zipCode: '',
    phone: '',
    isActive: true,
  },
];

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export async function loadStores(allowFallback = true): Promise<StoreLocatorStore[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, city, code, address_line_1, state, postal_code, phone, is_active')
    .order('name', { ascending: true });

  if (error || !data) {
    console.error('Failed to load stores:', error);
    return allowFallback ? CUSTOMER_STORE_METADATA : [];
  }

  return data.map((store: any) => ({
    id: store.id,
    name: store.name,
    city: store.city,
    code: store.code,
    addressLine1: store.address_line_1 ?? '',
    state: store.state ?? '',
    zipCode: store.postal_code ?? '',
    phone: store.phone ?? '',
    isActive: store.is_active,
  }));
}

export function loadSelectedStoreId(stores: StoreLocatorStore[] = CUSTOMER_STORE_METADATA) {
  if (!Array.isArray(stores) || stores.length === 0) {
    stores = CUSTOMER_STORE_METADATA;
  }

  if (!isBrowser()) {
    return DEFAULT_ORDER_STORE_ID;
  }

  const storedId = localStorage.getItem(SELECTED_STORE_STORAGE_KEY) ?? DEFAULT_ORDER_STORE_ID;
  const activeStore = stores.find((store) => store.id === storedId && store.isActive);

  return activeStore
    ? activeStore.id
    : (stores.find((store) => store.isActive)?.id ?? DEFAULT_ORDER_STORE_ID);
}

export function getSelectedStore(stores: StoreLocatorStore[] = CUSTOMER_STORE_METADATA) {
  if (!Array.isArray(stores) || stores.length === 0) {
    stores = CUSTOMER_STORE_METADATA;
  }

  const selectedStoreId = loadSelectedStoreId(stores);
  return stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? CUSTOMER_STORE_METADATA[0];
}

export function setSelectedStoreId(
  storeId: string,
  stores: StoreLocatorStore[] = CUSTOMER_STORE_METADATA,
) {
  if (!Array.isArray(stores) || stores.length === 0) {
    stores = CUSTOMER_STORE_METADATA;
  }

  const activeStore = stores.find((store) => store.id === storeId && store.isActive);
  if (!activeStore || !isBrowser()) {
    return false;
  }

  localStorage.setItem(SELECTED_STORE_STORAGE_KEY, activeStore.id);
  window.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, { detail: { storeId: activeStore.id } }));
  return true;
}

export function subscribeSelectedStore(listener: (storeId: string) => void) {
  if (!isBrowser()) {
    return () => {};
  }

  const handleChanged = () => {
    listener(loadSelectedStoreId(CUSTOMER_STORE_METADATA));
  };

  window.addEventListener(STORE_CHANGED_EVENT, handleChanged);
  window.addEventListener('storage', handleChanged);

  return () => {
    window.removeEventListener(STORE_CHANGED_EVENT, handleChanged);
    window.removeEventListener('storage', handleChanged);
  };
}

export function requestOpenStoreSelector() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(OPEN_SELECTOR_EVENT));
}

export function subscribeOpenStoreSelector(listener: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(OPEN_SELECTOR_EVENT, listener);
  return () => window.removeEventListener(OPEN_SELECTOR_EVENT, listener);
}
