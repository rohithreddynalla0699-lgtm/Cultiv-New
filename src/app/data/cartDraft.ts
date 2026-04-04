export interface DraftSelection {
  section: string;
  choices: string[];
}

export interface DraftCustomizeSnapshot {
  mode: 'signature' | 'table' | 'breakfast' | 'generic';
  selections: Record<string, string[]>;
  basePrice: number;
  hideBaseStep?: boolean;
  allowedProteinIds?: string[];
  servesLabel?: string;
}

export interface DraftCartLine {
  key: string;
  itemId: string;
  title: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  selections?: DraftSelection[];
  customizeSnapshot?: DraftCustomizeSnapshot;
}

const LEGACY_DRAFT_CART_STORAGE_KEY = 'cultiv_order_draft_v1';
const DRAFT_CART_STORAGE_KEY_PREFIX = 'cultiv_order_draft_scope_v1:';
const ACTIVE_DRAFT_SCOPE_KEY = 'cultiv_active_draft_scope_v1';
const GUEST_DRAFT_SESSION_KEY = 'cultiv_guest_draft_session_v1';
const DRAFT_CART_EVENT = 'cultiv:draft-cart-changed';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function emitDraftCartChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(DRAFT_CART_EVENT));
}

function getGuestDraftSessionId() {
  if (!isBrowser()) return 'guest-default';
  const existing = localStorage.getItem(GUEST_DRAFT_SESSION_KEY);
  if (existing) return existing;
  const created = `guest-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(GUEST_DRAFT_SESSION_KEY, created);
  return created;
}

function getStorageKeyForScope(scope: string) {
  return `${DRAFT_CART_STORAGE_KEY_PREFIX}${scope}`;
}

function readLinesFromStorageKey(storageKey: string): DraftCartLine[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as DraftCartLine[];
  return Array.isArray(parsed) ? parsed : [];
}

function resolveActiveScope() {
  if (!isBrowser()) return 'guest:guest-default';

  const active = localStorage.getItem(ACTIVE_DRAFT_SCOPE_KEY);
  if (active) return active;

  const fallbackScope = `guest:${getGuestDraftSessionId()}`;
  localStorage.setItem(ACTIVE_DRAFT_SCOPE_KEY, fallbackScope);

  // One-time migration from legacy global key into guest scope.
  const legacyRaw = localStorage.getItem(LEGACY_DRAFT_CART_STORAGE_KEY);
  if (legacyRaw && !localStorage.getItem(getStorageKeyForScope(fallbackScope))) {
    localStorage.setItem(getStorageKeyForScope(fallbackScope), legacyRaw);
  }

  return fallbackScope;
}

function getActiveDraftStorageKey() {
  const scope = resolveActiveScope();
  return getStorageKeyForScope(scope);
}

export function setDraftCartScope(userId: string | null) {
  if (!isBrowser()) return;
  const nextScope = userId ? `user:${userId}` : `guest:${getGuestDraftSessionId()}`;
  const previousScope = localStorage.getItem(ACTIVE_DRAFT_SCOPE_KEY);
  if (previousScope === nextScope) return;

  localStorage.setItem(ACTIVE_DRAFT_SCOPE_KEY, nextScope);
  emitDraftCartChanged();
}

export function resetDraftCartStorage() {
  if (!isBrowser()) return;

  const keysToDelete: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key === LEGACY_DRAFT_CART_STORAGE_KEY || key.startsWith(DRAFT_CART_STORAGE_KEY_PREFIX) || key === ACTIVE_DRAFT_SCOPE_KEY || key === GUEST_DRAFT_SESSION_KEY) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => localStorage.removeItem(key));

  const nextGuestScope = `guest:${getGuestDraftSessionId()}`;
  localStorage.setItem(ACTIVE_DRAFT_SCOPE_KEY, nextGuestScope);
  localStorage.setItem(getStorageKeyForScope(nextGuestScope), JSON.stringify([]));
  emitDraftCartChanged();
}

export function createDraftLineKey(itemId: string, selections: DraftSelection[] = []) {
  return `${itemId}:${JSON.stringify(selections)}`;
}

export function loadDraftCart(): DraftCartLine[] {
  if (!isBrowser()) return [];
  try {
    return readLinesFromStorageKey(getActiveDraftStorageKey());
  } catch {
    return [];
  }
}

export function saveDraftCart(lines: DraftCartLine[]) {
  if (!isBrowser()) return;
  localStorage.setItem(getActiveDraftStorageKey(), JSON.stringify(lines));
  emitDraftCartChanged();
}

export function clearDraftCart() {
  saveDraftCart([]);
}

export function addDraftLine(line: Omit<DraftCartLine, 'key'> & { key?: string }) {
  const current = loadDraftCart();
  const key = line.key ?? createDraftLineKey(line.itemId, line.selections ?? []);
  const existing = current.find((entry) => entry.key === key);

  if (existing) {
    saveDraftCart(
      current.map((entry) =>
        entry.key === key ? { ...entry, quantity: Math.min(30, entry.quantity + line.quantity) } : entry,
      ),
    );
    return;
  }

  saveDraftCart([{ ...line, key }, ...current]);
}

export function updateDraftLineQuantity(key: string, direction: 'inc' | 'dec') {
  const current = loadDraftCart();
  const next = current
    .map((line) => {
      if (line.key !== key) return line;
      if (direction === 'inc') return { ...line, quantity: Math.min(30, line.quantity + 1) };
      return { ...line, quantity: line.quantity - 1 };
    })
    .filter((line) => line.quantity > 0);
  saveDraftCart(next);
}

export function removeDraftLine(key: string) {
  const current = loadDraftCart();
  saveDraftCart(current.filter((line) => line.key !== key));
}

export function subscribeDraftCart(onChange: () => void) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    const activeStorageKey = getActiveDraftStorageKey();
    if (event.key === activeStorageKey || event.key === ACTIVE_DRAFT_SCOPE_KEY) onChange();
  };
  const onLocalEvent = () => onChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener(DRAFT_CART_EVENT, onLocalEvent);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(DRAFT_CART_EVENT, onLocalEvent);
  };
}
