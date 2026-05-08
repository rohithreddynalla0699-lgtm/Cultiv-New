import { loadDraftCart, resetDraftCartStorage } from './cartDraft';
import { SELECTED_STORE_STORAGE_KEY } from './storeLocator';

export const CHECKOUT_CONTACT_STORAGE_KEY = 'cultiv_checkout_contact_v1';
const CHECKOUT_CONTACT_SCOPE_PREFIX = 'cultiv_checkout_contact_scope_v1:';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export interface CheckoutContactDraft {
  mode?: 'profile' | 'different';
  fullName?: string;
  phone?: string;
  email?: string;
}

function getCheckoutContactStorageKey(scope: string) {
  return `${CHECKOUT_CONTACT_SCOPE_PREFIX}${scope}`;
}

export function getCheckoutContactScope(userId: string | null | undefined) {
  return userId ? `user:${userId}` : 'guest';
}

export function loadCheckoutContactDraft(scope: string): CheckoutContactDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(getCheckoutContactStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutContactDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      mode: parsed.mode === 'different' ? 'different' : parsed.mode === 'profile' ? 'profile' : undefined,
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    };
  } catch {
    return null;
  }
}

export function saveCheckoutContactDraft(scope: string, draft: CheckoutContactDraft) {
  if (!isBrowser()) return;
  localStorage.setItem(getCheckoutContactStorageKey(scope), JSON.stringify(draft));
}

export function clearCheckoutContactDraft(scope: string) {
  if (!isBrowser()) return;
  localStorage.removeItem(getCheckoutContactStorageKey(scope));
}

function clearAllCheckoutContactDrafts() {
  if (!isBrowser()) return;

  const keysToDelete: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key === CHECKOUT_CONTACT_STORAGE_KEY || key.startsWith(CHECKOUT_CONTACT_SCOPE_PREFIX)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => localStorage.removeItem(key));
}

export function hasActiveShoppingSessionState() {
  if (!isBrowser()) return false;

  if (loadDraftCart().length > 0) {
    return true;
  }

  const selectedStoreId = localStorage.getItem(SELECTED_STORE_STORAGE_KEY)?.trim();
  if (selectedStoreId) {
    return true;
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key === CHECKOUT_CONTACT_STORAGE_KEY || key.startsWith(CHECKOUT_CONTACT_SCOPE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (!value || value === '{}' || value === 'null') continue;

      try {
        const parsed = JSON.parse(value) as CheckoutContactDraft;
        if (
          (typeof parsed.fullName === 'string' && parsed.fullName.trim())
          || (typeof parsed.phone === 'string' && parsed.phone.trim())
          || (typeof parsed.email === 'string' && parsed.email.trim())
        ) {
          return true;
        }
      } catch {
        return true;
      }
    }
  }

  return false;
}

export function hasActiveCartItems() {
  if (!isBrowser()) return false;
  return loadDraftCart().length > 0;
}

export function resetShoppingSessionStorage() {
  if (!isBrowser()) return;

  resetDraftCartStorage();

  clearAllCheckoutContactDrafts();
  localStorage.removeItem(SELECTED_STORE_STORAGE_KEY);

  window.dispatchEvent(new CustomEvent('cultiv:shopping-session-reset'));
}
