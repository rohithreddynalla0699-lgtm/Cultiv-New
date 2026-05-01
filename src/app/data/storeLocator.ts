// @ts-ignore
import { supabase } from '../../lib/supabase.js';

export interface StoreLocatorStore {
  id: string;
  name: string;
  city: string;
  code: string;
  addressLine1?: string;
  state?: string;
  zipCode: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}

export const SELECTED_STORE_STORAGE_KEY = 'cultiv_selected_store_id_v1';
const STORE_CHANGED_EVENT = 'cultiv:store-changed';
const OPEN_SELECTOR_EVENT = 'cultiv:open-store-selector';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export async function loadStores(): Promise<StoreLocatorStore[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, city, code, address_line_1, state, postal_code, phone, latitude, longitude, is_active')
    .order('name', { ascending: true });

  if (error || !data) {
    console.error('Failed to load stores:', error);
    return [];
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
    latitude: typeof store.latitude === 'number' ? store.latitude : (store.latitude == null ? undefined : Number(store.latitude)),
    longitude: typeof store.longitude === 'number' ? store.longitude : (store.longitude == null ? undefined : Number(store.longitude)),
    isActive: store.is_active,
  }));
}

const clearSelectedStoreId = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(SELECTED_STORE_STORAGE_KEY);
};

const persistSelectedStoreId = (storeId: string) => {
  if (!isBrowser()) return;
  localStorage.setItem(SELECTED_STORE_STORAGE_KEY, storeId);
};

export function loadSelectedStoreId(stores: StoreLocatorStore[] = []) {
  const safeStores = Array.isArray(stores) ? stores : [];
  const activeStores = safeStores.filter((store) => store.isActive);

  if (activeStores.length === 0) {
    clearSelectedStoreId();
    return '';
  }

  if (!isBrowser()) {
    return activeStores[0]?.id ?? '';
  }

  const storedId = localStorage.getItem(SELECTED_STORE_STORAGE_KEY)?.trim() ?? '';
  const activeStore = activeStores.find((store) => store.id === storedId);

  if (activeStore) {
    return activeStore.id;
  }

  clearSelectedStoreId();

  const fallbackStoreId = activeStores[0]?.id ?? '';
  if (fallbackStoreId) {
    persistSelectedStoreId(fallbackStoreId);
  }

  return fallbackStoreId;
}

export function getSelectedStore(stores: StoreLocatorStore[] = []) {
  const safeStores = Array.isArray(stores) ? stores : [];
  const selectedStoreId = loadSelectedStoreId(safeStores);
  return safeStores.find((store) => store.id === selectedStoreId) ?? safeStores.find((store) => store.isActive) ?? null;
}

export function setSelectedStoreId(
  storeId: string,
  stores: StoreLocatorStore[] = [],
) {
  const safeStores = Array.isArray(stores) ? stores : [];

  const activeStore = safeStores.find((store) => store.id === storeId && store.isActive);
  if (!activeStore || !isBrowser()) {
    return false;
  }

  persistSelectedStoreId(activeStore.id);
  window.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, { detail: { storeId: activeStore.id } }));
  return true;
}

export function subscribeSelectedStore(listener: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  const handleChanged = () => {
    listener();
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
