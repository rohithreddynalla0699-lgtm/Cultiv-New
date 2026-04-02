import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';

export interface StoreLocatorStore {
  id: string;
  name: string;
  city: string;
  code: string;
  zipCode: string;
  isActive: boolean;
}

export const SELECTED_STORE_STORAGE_KEY = 'cultiv_selected_store_id_v1';
const STORE_CHANGED_EVENT = 'cultiv:store-changed';
const OPEN_SELECTOR_EVENT = 'cultiv:open-store-selector';

export const CUSTOMER_STORE_METADATA: StoreLocatorStore[] = [
  { id: 'store-siddipet', name: 'Siddipet Central', city: 'Siddipet', code: 'SID-CEN', zipCode: '502103', isActive: true },
  { id: 'store-hyderabad', name: 'Banjara Hills', city: 'Hyderabad', code: 'HYD-BAN', zipCode: '500034', isActive: true },
  { id: 'store-warangal', name: 'Warangal North', city: 'Warangal', code: 'WRG-NTH', zipCode: '506002', isActive: false },
];

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadStores(): StoreLocatorStore[] {
  // Store metadata source-of-truth is static app config, not mutable admin cache.
  // This prevents stale admin localStorage from regressing customer-facing store details.
  return CUSTOMER_STORE_METADATA;
}

export function loadSelectedStoreId(stores = loadStores()) {
  if (!isBrowser()) {
    return DEFAULT_ORDER_STORE_ID;
  }

  const storedId = localStorage.getItem(SELECTED_STORE_STORAGE_KEY) ?? DEFAULT_ORDER_STORE_ID;
  const activeStore = stores.find((store) => store.id === storedId && store.isActive);
  return activeStore ? activeStore.id : (stores.find((store) => store.isActive)?.id ?? DEFAULT_ORDER_STORE_ID);
}

export function getSelectedStore(stores = loadStores()) {
  const selectedStoreId = loadSelectedStoreId(stores);
  return stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? CUSTOMER_STORE_METADATA[0];
}

export function setSelectedStoreId(storeId: string, stores = loadStores()) {
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
    listener(loadSelectedStoreId());
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
