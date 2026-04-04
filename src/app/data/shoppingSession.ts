import { resetDraftCartStorage } from './cartDraft';
import { SELECTED_STORE_STORAGE_KEY } from './storeLocator';

export const CHECKOUT_CONTACT_STORAGE_KEY = 'cultiv_checkout_contact_v1';
export const GUEST_CONFIRMATION_STORAGE_KEY = 'cultiv_guest_order_confirmation_v1';
export const GUEST_AUTH_PROMPT_DISMISSED_KEY = 'cultiv_guest_auth_prompt_dismissed_v1';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function resetShoppingSessionStorage() {
  if (!isBrowser()) return;

  resetDraftCartStorage();

  localStorage.removeItem(CHECKOUT_CONTACT_STORAGE_KEY);
  localStorage.removeItem(GUEST_CONFIRMATION_STORAGE_KEY);
  localStorage.removeItem(GUEST_AUTH_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(SELECTED_STORE_STORAGE_KEY);

  window.dispatchEvent(new CustomEvent('cultiv:shopping-session-reset'));
}
