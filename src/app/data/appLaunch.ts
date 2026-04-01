const OPEN_APP_WAITLIST_EVENT = 'cultiv:open-app-waitlist';
const APP_WAITLIST_STORAGE_KEY = 'cultiv_app_waitlist_v1';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function requestOpenAppWaitlist() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(OPEN_APP_WAITLIST_EVENT));
}

export function subscribeOpenAppWaitlist(listener: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(OPEN_APP_WAITLIST_EVENT, listener);
  return () => window.removeEventListener(OPEN_APP_WAITLIST_EVENT, listener);
}

export function addWaitlistEmail(email: string) {
  if (!isBrowser()) return false;

  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
    return false;
  }

  try {
    const raw = localStorage.getItem(APP_WAITLIST_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(normalized)) {
      list.push(normalized);
      localStorage.setItem(APP_WAITLIST_STORAGE_KEY, JSON.stringify(list));
    }
    return true;
  } catch {
    return false;
  }
}
