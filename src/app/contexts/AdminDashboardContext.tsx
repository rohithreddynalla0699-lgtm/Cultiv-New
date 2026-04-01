import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ADMIN_ACCESS_PIN, DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import { INVENTORY_MASTER_LIST } from '../constants/inventoryCatalog';
import type {
  AdminOrderNoteMap,
  AdminPermissions,
  EmployeeInput,
  EmployeeRecord,
  EmployeeRole,
  EmployeeShift,
  InternalAccessSession,
  InventoryItem,
  InventoryStatus,
  StoreInput,
  StoreRecord,
  StoreScope,
} from '../types/admin';

interface AdminDashboardContextType {
  stores: StoreRecord[];
  employees: EmployeeRecord[];
  inventory: InventoryItem[];
  scopedEmployees: EmployeeRecord[];
  scopedInventory: InventoryItem[];
  orderNotes: AdminOrderNoteMap;
  session: InternalAccessSession | null;
  permissions: AdminPermissions;
  activeStoreScope: StoreScope;
  activeStore: StoreRecord | null;
  loginAsAdmin: (pin: string) => { success: boolean; message: string };
  loginAsStore: (storeId: string, pin: string) => { success: boolean; message: string };
  logoutInternalAccess: () => void;
  setActiveStoreScope: (scope: StoreScope) => void;
  addStore: (input: StoreInput) => { success: boolean; message: string };
  updateStore: (storeId: string, input: StoreInput) => { success: boolean; message: string };
  addEmployee: (input: EmployeeInput) => { success: boolean; message: string };
  updateEmployee: (employeeId: string, input: EmployeeInput) => { success: boolean; message: string };
  clockInEmployee: (employeeId: string) => void;
  clockOutEmployee: (employeeId: string) => void;
  addInventoryStock: (itemId: string, amount: number) => void;
  reduceInventoryStock: (itemId: string, amount: number) => void;
  updateInventoryThreshold: (itemId: string, threshold: number) => void;
  markInventoryOutOfStock: (itemId: string) => void;
  saveOrderNote: (orderId: string, note: string) => void;
  getStoreName: (storeId: string) => string;
  showIdleWarning: boolean;
  idleCountdown: number;
  dismissIdleWarning: () => void;
}

const STORAGE_KEYS = {
  stores: 'cultiv_admin_stores_v1',
  employees: 'cultiv_admin_employees_v2',
  inventory: 'cultiv_admin_inventory_v4',
  orderNotes: 'cultiv_admin_order_notes_v1',
  session: 'cultiv_admin_access_session_v1',
  activeStoreScope: 'cultiv_admin_active_store_scope_v1',
  inventoryResetApplied: 'cultiv_admin_inventory_reset_applied_v1',
} as const;

const nowIso = () => new Date().toISOString();
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_WARNING_BEFORE_MS = 60 * 1000;

const daysAgo = (days: number, hour = 9, minute = 0) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const seedStores: StoreRecord[] = [
  {
    id: 'store-siddipet',
    name: 'Siddipet Central',
    city: 'Siddipet',
    code: 'SID-CEN',
    pin: '502103',
    isActive: true,
    createdAt: daysAgo(210),
  },
  {
    id: 'store-hyderabad',
    name: 'Banjara Hills',
    city: 'Hyderabad',
    code: 'HYD-BAN',
    pin: '500034',
    isActive: true,
    createdAt: daysAgo(135),
  },
  {
    id: 'store-warangal',
    name: 'Warangal North',
    city: 'Warangal',
    code: 'WRG-NTH',
    pin: '506002',
    isActive: false,
    createdAt: daysAgo(48),
  },
];

const seedEmployees: EmployeeRecord[] = [
  {
    id: 'emp-1',
    name: 'Riya Sharma',
    role: 'manager',
    storeId: 'store-siddipet',
    phone: '9876500011',
    isActive: true,
    createdAt: daysAgo(180),
    status: 'on_shift',
    shifts: [
      {
        id: 'shift-1',
        employeeId: 'emp-1',
        storeId: 'store-siddipet',
        loginAt: daysAgo(0, 9, 2),
        totalHoursWorked: 0,
      },
      {
        id: 'shift-1b',
        employeeId: 'emp-1',
        storeId: 'store-siddipet',
        loginAt: daysAgo(1, 9, 0),
        logoutAt: daysAgo(1, 17, 6),
        totalHoursWorked: 8.1,
      },
    ],
  },
  {
    id: 'emp-2',
    name: 'Aman Verma',
    role: 'kitchen',
    storeId: 'store-siddipet',
    phone: '9876500012',
    isActive: true,
    createdAt: daysAgo(122),
    status: 'on_shift',
    shifts: [
      {
        id: 'shift-2',
        employeeId: 'emp-2',
        storeId: 'store-siddipet',
        loginAt: daysAgo(0, 10, 15),
        totalHoursWorked: 0,
      },
    ],
  },
  {
    id: 'emp-3',
    name: 'Neha Patel',
    role: 'counter',
    storeId: 'store-hyderabad',
    phone: '9876500013',
    isActive: true,
    createdAt: daysAgo(95),
    status: 'off_shift',
    shifts: [
      {
        id: 'shift-3',
        employeeId: 'emp-3',
        storeId: 'store-hyderabad',
        loginAt: daysAgo(2, 9, 0),
        logoutAt: daysAgo(2, 17, 0),
        totalHoursWorked: 8,
      },
    ],
  },
  {
    id: 'emp-4',
    name: 'Sana Khan',
    role: 'kitchen',
    storeId: 'store-hyderabad',
    phone: '9876500014',
    isActive: false,
    createdAt: daysAgo(70),
    status: 'off_shift',
    shifts: [
      {
        id: 'shift-4',
        employeeId: 'emp-4',
        storeId: 'store-hyderabad',
        loginAt: daysAgo(5, 11, 0),
        logoutAt: daysAgo(5, 16, 30),
        totalHoursWorked: 5.5,
      },
    ],
  },
];

const getInventoryStatus = (quantity: number, threshold: number): InventoryStatus => {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
};

const toCategoryLabel = (category: string) => {
  switch (category) {
    case 'rice':
      return 'Rice';
    case 'proteins':
      return 'Proteins';
    case 'veggies':
      return 'Veggies';
    case 'breakfast':
      return 'Breakfast';
    case 'drinks':
      return 'Drinks';
    case 'packaging':
    default:
      return 'Packaging';
  }
};

const createInventorySeedForStore = (storeId: string, quantityOverrides: Record<string, number>): InventoryItem[] => (
  INVENTORY_MASTER_LIST.map((entry) => {
    const quantity = quantityOverrides[entry.id] ?? (entry.category === 'packaging' ? entry.threshold + 20 : entry.threshold + 3);
    const status = getInventoryStatus(quantity, entry.threshold);
    return {
      id: `${storeId}__${entry.id}`,
      code: entry.id,
      storeId,
      name: entry.displayName,
      category: toCategoryLabel(entry.category),
      quantity,
      unit: entry.unit,
      threshold: entry.threshold,
      status,
      updatedAt: nowIso(),
    };
  })
);

const seedInventory: InventoryItem[] = [
  ...createInventorySeedForStore('store-siddipet', {
    white_basmati_rice: 12,
    brown_rice: 4,
    classic_chicken: 2,
    spicy_chicken: 5,
    rajma: 3,
    channa: 2,
    eggs: 0,
    cheese: 3,
    onion: 4,
    cucumber: 3,
    lettuce: 3,
    capsicum: 2,
    green_cabbage: 2,
    red_cabbage: 2,
    carrots: 3,
    tomato: 3,
    lemon: 2,
    sweet_corn: 4,
    small_chilli: 1,
    big_chilli: 2,
    dried_red_chilli: 1,
    avocado: 2,
    ginger: 1,
    yogurt: 4,
    chia_seeds: 2,
    banana: 2,
    apple: 2,
    mixed_berries: 1,
    mango: 2,
    granola: 2,
    honey: 3,
    watermelon: 2,
    water_bottles: 3,
    coke: 2,
    regular_bowl: 120,
    regular_bowl_lid: 118,
    breakfast_bowl: 30,
    breakfast_bowl_lid: 30,
    paper_cup: 0,
    paper_cup_lid: 46,
    spoon: 140,
    paper_bag: 60,
    tissue_pack: 18,
  }),
  ...createInventorySeedForStore('store-hyderabad', {
    white_basmati_rice: 10,
    brown_rice: 2,
    classic_chicken: 4,
    spicy_chicken: 2,
    rajma: 2,
    channa: 1,
    eggs: 2,
    cheese: 1,
    onion: 3,
    cucumber: 3,
    lettuce: 2,
    capsicum: 2,
    green_cabbage: 2,
    red_cabbage: 1,
    carrots: 2,
    tomato: 3,
    lemon: 2,
    sweet_corn: 1,
    small_chilli: 1,
    big_chilli: 1,
    dried_red_chilli: 1,
    avocado: 2,
    ginger: 1,
    yogurt: 2,
    chia_seeds: 1,
    banana: 1,
    apple: 1,
    mixed_berries: 0,
    mango: 1,
    granola: 1,
    honey: 1,
    watermelon: 2,
    water_bottles: 1,
    coke: 4,
    regular_bowl: 52,
    regular_bowl_lid: 48,
    breakfast_bowl: 42,
    breakfast_bowl_lid: 30,
    paper_cup: 65,
    paper_cup_lid: 40,
    spoon: 100,
    paper_bag: 35,
    tissue_pack: 25,
  }),
  ...createInventorySeedForStore('store-warangal', {
    white_basmati_rice: 6,
    brown_rice: 3,
    classic_chicken: 3,
    spicy_chicken: 3,
    rajma: 2,
    channa: 2,
    eggs: 2,
    cheese: 2,
    water_bottles: 2,
    coke: 2,
    regular_bowl: 60,
    regular_bowl_lid: 60,
    breakfast_bowl: 40,
    breakfast_bowl_lid: 40,
    paper_cup: 50,
    paper_cup_lid: 50,
    spoon: 100,
    paper_bag: 50,
    tissue_pack: 20,
  }),
];

const AdminDashboardContext = createContext<AdminDashboardContextType | undefined>(undefined);

// ── Optional sync server layer ────────────────────────────────────────────────
const SYNC_URL: string | undefined = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env.VITE_SYNC_SERVER_URL;
const CLIENT_ID = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

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

const getShiftHours = (shift: EmployeeShift) => {
  const end = shift.logoutAt ? new Date(shift.logoutAt).getTime() : Date.now();
  const start = new Date(shift.loginAt).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  return Number(Math.max(0, hours).toFixed(2));
};

const isSixDigitPin = (value: string) => /^\d{6}$/.test(value.trim());

const normalizeStoreCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '-');

const normalizeRole = (role: string): EmployeeRole => {
  const value = role.trim().toLowerCase();
  if (value.includes('manager') || value.includes('lead')) return 'manager';
  if (value.includes('counter')) return 'counter';
  return 'kitchen';
};

const normalizeStores = (stores: StoreRecord[]) => stores.map((store) => ({
  ...store,
  city: store.city.trim(),
  code: normalizeStoreCode(store.code),
  pin: store.pin.trim(),
}));

const normalizeEmployees = (employees: EmployeeRecord[]) => employees.map((employee) => {
  const storeId = employee.storeId ?? DEFAULT_ORDER_STORE_ID;
  return {
    ...employee,
    role: normalizeRole(employee.role),
    storeId,
    phone: employee.phone?.trim() || undefined,
    isActive: employee.isActive ?? true,
    createdAt: employee.createdAt ?? nowIso(),
    status: employee.isActive === false ? 'off_shift' : employee.status,
    shifts: employee.shifts.map((shift) => ({
      ...shift,
      storeId: shift.storeId ?? storeId,
      totalHoursWorked: getShiftHours(shift),
    })),
  };
});

const normalizeInventory = (items: InventoryItem[]) => items.map((item) => ({
  ...item,
  code: item.code ?? item.id.split('__').slice(-1)[0] ?? item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  storeId: item.storeId ?? DEFAULT_ORDER_STORE_ID,
  threshold: Math.max(0, item.threshold),
  quantity: Math.max(0, item.quantity),
  status: getInventoryStatus(Math.max(0, item.quantity), Math.max(0, item.threshold)),
  updatedAt: item.updatedAt ?? nowIso(),
}));

const normalizeSession = (session: InternalAccessSession | null, stores: StoreRecord[]) => {
  if (!session) return null;
  if (session.role === 'admin') {
    return session;
  }
  const store = stores.find((entry) => entry.id === session.storeId && entry.isActive);
  return store ? session : null;
};

const finalizeEmployeeDeactivation = (employee: EmployeeRecord): EmployeeRecord => {
  if (employee.status === 'off_shift') {
    return { ...employee, isActive: false, status: 'off_shift' };
  }

  const logoutAt = nowIso();
  return {
    ...employee,
    isActive: false,
    status: 'off_shift',
    shifts: employee.shifts.map((shift) => (
      shift.logoutAt
        ? shift
        : {
          ...shift,
          logoutAt,
          totalHoursWorked: getShiftHours({ ...shift, logoutAt }),
        }
    )),
  };
};

interface AdminDashboardProviderProps {
  children: ReactNode;
}

export function AdminDashboardProvider({ children }: AdminDashboardProviderProps) {
  const [stores, setStores] = useState<StoreRecord[]>(() => normalizeStores(readStorage(STORAGE_KEYS.stores, seedStores)));
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => normalizeEmployees(readStorage(STORAGE_KEYS.employees, seedEmployees)));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => normalizeInventory(readStorage(STORAGE_KEYS.inventory, seedInventory)));
  const [orderNotes, setOrderNotes] = useState<AdminOrderNoteMap>(() => readStorage(STORAGE_KEYS.orderNotes, {}));
  const [session, setSession] = useState<InternalAccessSession | null>(() => normalizeSession(readStorage(STORAGE_KEYS.session, null), seedStores));
  const [storedScope, setStoredScope] = useState<StoreScope>(() => readStorage(STORAGE_KEYS.activeStoreScope, 'all'));
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const resetIdleTimerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const hasResetApplied = readStorage(STORAGE_KEYS.inventoryResetApplied, false);
    if (hasResetApplied) {
      return;
    }

    // One-time hard reset to ensure only the approved CULTIV master list remains.
    setInventory(normalizeInventory(seedInventory));
    writeStorage(STORAGE_KEYS.inventoryResetApplied, true);
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.stores, stores);
  }, [stores]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.employees, employees);
  }, [employees]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.inventory, inventory);
  }, [inventory]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.orderNotes, orderNotes);
  }, [orderNotes]);

  useEffect(() => {
    if (session) {
      writeStorage(STORAGE_KEYS.session, session);
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.session);
  }, [session]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.activeStoreScope, storedScope);
  }, [storedScope]);

  useEffect(() => {
    const normalized = normalizeSession(session, stores);
    if (normalized?.role === 'store') {
      setStoredScope(normalized.storeId ?? DEFAULT_ORDER_STORE_ID);
    }
    if (normalized !== session) {
      setSession(normalized);
    }
  }, [session, stores]);

  useEffect(() => {
    if (!session) return;

    let warningTimeoutId: ReturnType<typeof window.setTimeout>;
    let logoutTimeoutId: ReturnType<typeof window.setTimeout>;
    let countdownIntervalId: ReturnType<typeof window.setInterval>;

    const clearAll = () => {
      window.clearTimeout(warningTimeoutId);
      window.clearTimeout(logoutTimeoutId);
      window.clearInterval(countdownIntervalId);
    };

    const scheduleLogout = () => {
      clearAll();
      setShowIdleWarning(false);

      warningTimeoutId = window.setTimeout(() => {
        setShowIdleWarning(true);
        setIdleCountdown(60);
        countdownIntervalId = window.setInterval(() => {
          setIdleCountdown((previous) => Math.max(0, previous - 1));
        }, 1000);
      }, SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS);

      logoutTimeoutId = window.setTimeout(() => {
        clearAll();
        setShowIdleWarning(false);
        setSession(null);
        setStoredScope('all');
      }, SESSION_IDLE_TIMEOUT_MS);
    };

    scheduleLogout();
    resetIdleTimerRef.current = scheduleLogout;

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, scheduleLogout, { passive: true }));

    return () => {
      clearAll();
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, scheduleLogout));
    };
  }, [session]);

  // ── Sync layer (only active when VITE_SYNC_SERVER_URL is set) ─────────────
  const storesRef = useRef(stores);
  const employeesRef = useRef(employees);
  const inventoryRef = useRef(inventory);
  useEffect(() => { storesRef.current = stores; });
  useEffect(() => { employeesRef.current = employees; });
  useEffect(() => { inventoryRef.current = inventory; });

  // Initial load from server (overrides localStorage if server has data)
  useEffect(() => {
    if (!SYNC_URL) return;
    fetch(`${SYNC_URL}/api/state`, { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((s: Record<string, unknown>) => {
        if (Array.isArray(s.stores) && s.stores.length > 0) setStores(normalizeStores(s.stores as StoreRecord[]));
        if (Array.isArray(s.employees) && s.employees.length > 0) setEmployees(normalizeEmployees(s.employees as EmployeeRecord[]));
        if (Array.isArray(s.inventory) && s.inventory.length > 0) setInventory(normalizeInventory(s.inventory as InventoryItem[]));
      })
      .catch(() => {}); // silent fail — localStorage is always the fallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outbound debounced sync (1.2s after any state change)
  useEffect(() => {
    if (!SYNC_URL) return;
    const id = window.setTimeout(() => {
      fetch(`${SYNC_URL}/api/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Client-ID': CLIENT_ID },
        body: JSON.stringify({ stores, employees, inventory }),
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(id);
  }, [stores, employees, inventory]);

  // SSE subscription — receive live updates from other clients
  useEffect(() => {
    if (!SYNC_URL) return;
    const es = new EventSource(`${SYNC_URL}/api/events`);
    es.onmessage = (event) => {
      try {
        const s = JSON.parse(event.data) as Record<string, unknown>;
        if (s._sourceClientId === CLIENT_ID) return; // own echo — skip
        if (Array.isArray(s.stores) && JSON.stringify(s.stores) !== JSON.stringify(storesRef.current)) {
          setStores(normalizeStores(s.stores as StoreRecord[]));
        }
        if (Array.isArray(s.employees) && JSON.stringify(s.employees) !== JSON.stringify(employeesRef.current)) {
          setEmployees(normalizeEmployees(s.employees as EmployeeRecord[]));
        }
        if (Array.isArray(s.inventory) && JSON.stringify(s.inventory) !== JSON.stringify(inventoryRef.current)) {
          setInventory(normalizeInventory(s.inventory as InventoryItem[]));
        }
      } catch {
        // malformed SSE payload — ignore
      }
    };
    return () => es.close();
  }, []); // empty deps — CLIENT_ID is module-level, refs don't need to be listed

  const permissions = useMemo<AdminPermissions>(() => ({
    canManageStores: session?.role === 'admin',
    canManageEmployees: session?.role === 'admin',
    canSwitchStores: session?.role === 'admin',
    canViewAllStores: session?.role === 'admin',
  }), [session]);

  const activeStoreScope = session?.role === 'store' ? (session.storeId ?? DEFAULT_ORDER_STORE_ID) : storedScope;
  const activeStore = activeStoreScope === 'all' ? null : stores.find((store) => store.id === activeStoreScope) ?? null;

  const matchesScope = (storeId: string) => activeStoreScope === 'all' || storeId === activeStoreScope;

  const scopedEmployees = useMemo(() => employees.filter((employee) => matchesScope(employee.storeId)), [activeStoreScope, employees]);
  const scopedInventory = useMemo(() => inventory.filter((item) => matchesScope(item.storeId)), [activeStoreScope, inventory]);

  const getStoreName = (storeId: string) => stores.find((store) => store.id === storeId)?.name ?? 'Unknown store';

  const loginAsAdmin = (pin: string) => {
    if (pin.trim() !== ADMIN_ACCESS_PIN) {
      return { success: false, message: 'Owner PIN did not match.' };
    }
    setSession({ role: 'admin', loggedInAt: nowIso() });
    setStoredScope('all');
    return { success: true, message: 'Owner access enabled.' };
  };

  const loginAsStore = (storeId: string, pin: string) => {
    const store = stores.find((entry) => entry.id === storeId);
    if (!store || !store.isActive) {
      return { success: false, message: 'Select an active store.' };
    }
    if (store.pin !== pin.trim()) {
      return { success: false, message: 'Store PIN did not match.' };
    }
    setSession({ role: 'store', storeId: store.id, loggedInAt: nowIso() });
    setStoredScope(store.id);
    return { success: true, message: `${store.name} workspace is ready.` };
  };

  const logoutInternalAccess = () => {
    setSession(null);
    setStoredScope('all');
  };

  const setActiveStoreScope = (scope: StoreScope) => {
    if (!permissions.canSwitchStores) return;
    if (scope !== 'all' && !stores.some((store) => store.id === scope)) return;
    setStoredScope(scope);
  };

  const validateStoreInput = (input: StoreInput, currentStoreId?: string) => {
    if (!input.name.trim()) return 'Store name is required.';
    if (!input.city.trim()) return 'City is required.';
    if (!input.code.trim()) return 'Store code is required.';
    if (!isSixDigitPin(input.pin)) return 'Use a valid 6-digit PIN.';

    const normalizedCode = normalizeStoreCode(input.code);
    const duplicate = stores.find((store) => store.code === normalizedCode && store.id !== currentStoreId);
    if (duplicate) return 'Store code must be unique.';

    return '';
  };

  const addStore = (input: StoreInput) => {
    const error = validateStoreInput(input);
    if (error) return { success: false, message: error };

    const storeId = createId('store');

    setStores((previous) => [
      {
        id: storeId,
        name: input.name.trim(),
        city: input.city.trim(),
        code: normalizeStoreCode(input.code),
        pin: input.pin.trim(),
        isActive: input.isActive,
        createdAt: nowIso(),
      },
      ...previous,
    ]);

    setInventory((previous) => ([
      ...previous,
      ...createInventorySeedForStore(storeId, {}),
    ]));

    return { success: true, message: 'Store added.' };
  };

  const updateStore = (storeId: string, input: StoreInput) => {
    const error = validateStoreInput(input, storeId);
    if (error) return { success: false, message: error };

    setStores((previous) => previous.map((store) => (
      store.id === storeId
        ? {
          ...store,
          name: input.name.trim(),
          city: input.city.trim(),
          code: normalizeStoreCode(input.code),
          pin: input.pin.trim(),
          isActive: input.isActive,
        }
        : store
    )));

    if (!input.isActive && session?.role === 'store' && session.storeId === storeId) {
      setSession(null);
    }

    return { success: true, message: 'Store updated.' };
  };

  const validateEmployeeInput = (input: EmployeeInput) => {
    if (!input.name.trim()) return 'Employee name is required.';
    if (!stores.some((store) => store.id === input.storeId)) return 'Assign the employee to a valid store.';
    if (input.phone && !/^\d{10}$/.test(input.phone.trim())) return 'Use a valid 10-digit phone or leave it empty.';
    return '';
  };

  const addEmployee = (input: EmployeeInput) => {
    const error = validateEmployeeInput(input);
    if (error) return { success: false, message: error };

    setEmployees((previous) => [
      {
        id: createId('emp'),
        name: input.name.trim(),
        role: input.role,
        storeId: input.storeId,
        phone: input.phone?.trim() || undefined,
        isActive: input.isActive,
        createdAt: nowIso(),
        status: 'off_shift',
        shifts: [],
      },
      ...previous,
    ]);

    return { success: true, message: 'Employee added.' };
  };

  const updateEmployee = (employeeId: string, input: EmployeeInput) => {
    const error = validateEmployeeInput(input);
    if (error) return { success: false, message: error };

    setEmployees((previous) => previous.map((employee) => {
      if (employee.id !== employeeId) return employee;

      const nextEmployee: EmployeeRecord = {
        ...employee,
        name: input.name.trim(),
        role: input.role,
        storeId: input.storeId,
        phone: input.phone?.trim() || undefined,
        isActive: input.isActive,
      };

      return input.isActive ? nextEmployee : finalizeEmployeeDeactivation(nextEmployee);
    }));

    return { success: true, message: 'Employee updated.' };
  };

  const clockInEmployee = (employeeId: string) => {
    setEmployees((previous) => previous.map((employee) => {
      if (employee.id !== employeeId || employee.status === 'on_shift' || !employee.isActive) return employee;
      return {
        ...employee,
        status: 'on_shift',
        shifts: [
          {
            id: createId('shift'),
            employeeId,
            storeId: employee.storeId,
            loginAt: nowIso(),
            totalHoursWorked: 0,
          },
          ...employee.shifts,
        ],
      };
    }));
  };

  const clockOutEmployee = (employeeId: string) => {
    setEmployees((previous) => previous.map((employee) => {
      if (employee.id !== employeeId || employee.status === 'off_shift') return employee;
      const activeShift = employee.shifts.find((shift) => !shift.logoutAt);
      if (!activeShift) return { ...employee, status: 'off_shift' };

      const logoutAt = nowIso();
      return {
        ...employee,
        status: 'off_shift',
        shifts: employee.shifts.map((shift) => shift.id === activeShift.id
          ? {
            ...shift,
            logoutAt,
            totalHoursWorked: getShiftHours({ ...shift, logoutAt }),
          }
          : shift),
      };
    }));
  };

  const patchInventory = (itemId: string, updater: (item: InventoryItem) => InventoryItem) => {
    setInventory((previous) => previous.map((item) => {
      if (item.id !== itemId) return item;
      const updated = updater(item);
      const quantity = Math.max(0, updated.quantity);
      const threshold = Math.max(0, updated.threshold);
      return {
        ...updated,
        quantity,
        threshold,
        status: getInventoryStatus(quantity, threshold),
        updatedAt: nowIso(),
      };
    }));
  };

  const addInventoryStock = (itemId: string, amount: number) => {
    if (amount <= 0) return;
    patchInventory(itemId, (item) => ({ ...item, quantity: item.quantity + amount }));
  };

  const reduceInventoryStock = (itemId: string, amount: number) => {
    if (amount <= 0) return;
    patchInventory(itemId, (item) => ({ ...item, quantity: Math.max(0, item.quantity - amount) }));
  };

  const updateInventoryThreshold = (itemId: string, threshold: number) => {
    patchInventory(itemId, (item) => ({ ...item, threshold: Math.max(0, threshold) }));
  };

  const markInventoryOutOfStock = (itemId: string) => {
    patchInventory(itemId, (item) => ({ ...item, quantity: 0 }));
  };

  const saveOrderNote = (orderId: string, note: string) => {
    setOrderNotes((previous) => ({
      ...previous,
      [orderId]: note.trim(),
    }));
  };

  const dismissIdleWarning = useCallback(() => {
    resetIdleTimerRef.current();
  }, []);

  const value: AdminDashboardContextType = {
    stores,
    employees,
    inventory,
    scopedEmployees,
    scopedInventory,
    orderNotes,
    session,
    permissions,
    activeStoreScope,
    activeStore,
    loginAsAdmin,
    loginAsStore,
    logoutInternalAccess,
    setActiveStoreScope,
    addStore,
    updateStore,
    addEmployee,
    updateEmployee,
    clockInEmployee,
    clockOutEmployee,
    addInventoryStock,
    reduceInventoryStock,
    updateInventoryThreshold,
    markInventoryOutOfStock,
    saveOrderNote,
    getStoreName,
    showIdleWarning,
    idleCountdown,
    dismissIdleWarning,
  };

  return <AdminDashboardContext.Provider value={value}>{children}</AdminDashboardContext.Provider>;
}

export function useAdminDashboard() {
  const context = useContext(AdminDashboardContext);
  if (!context) {
    throw new Error('useAdminDashboard must be used within an AdminDashboardProvider');
  }
  return context;
}