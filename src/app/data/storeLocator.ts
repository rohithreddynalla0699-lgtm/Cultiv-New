import { DEFAULT_ORDER_STORE_ID } from '../constants/admin';

export interface StoreLocatorStore {
  id: string;
  name: string;
  city: string;
  pin: string;
  isActive: boolean;
}

export const ADMIN_STORES_STORAGE_KEY = 'cultiv_admin_stores_v1';
export const SELECTED_STORE_STORAGE_KEY = 'cultiv_selected_store_id_v1';
const STORE_CHANGED_EVENT = 'cultiv:store-changed';
const OPEN_SELECTOR_EVENT = 'cultiv:open-store-selector';

const KNOWN_STORE_PIN_BY_ID: Record<string, string> = {
  'store-siddipet': '502103',
  'store-hyderabad': '500034',
  'store-warangal': '506002',
};

const FALLBACK_STORES: StoreLocatorStore[] = [
  { id: 'store-siddipet', name: 'Siddipet Central', city: 'Siddipet', pin: '502103', isActive: true },
  { id: 'store-hyderabad', name: 'Banjara Hills', city: 'Hyderabad', pin: '500034', isActive: true },
  { id: 'store-warangal', name: 'Warangal North', city: 'Warangal', pin: '506002', isActive: false },
];

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadStores(): StoreLocatorStore[] {
  if (!isBrowser()) {
    return FALLBACK_STORES;
  }

  try {
    const raw = localStorage.getItem(ADMIN_STORES_STORAGE_KEY);
    if (!raw) {
      return FALLBACK_STORES;
    }

    const parsed = JSON.parse(raw) as Array<Partial<StoreLocatorStore>>;
    const normalized = parsed
      .filter((store) => Boolean(store.id) && Boolean(store.name))
      .map((store) => ({
        id: store.id as string,
        name: store.name as string,
        city: store.city ?? 'Store City',
        pin: KNOWN_STORE_PIN_BY_ID[store.id as string] ?? store.pin ?? '000000',
        isActive: store.isActive ?? true,
      }));

    return normalized.length > 0 ? normalized : FALLBACK_STORES;
  } catch {
    return FALLBACK_STORES;
  }
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
  return stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? FALLBACK_STORES[0];
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
