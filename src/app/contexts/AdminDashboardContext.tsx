import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ADMIN_ACCESS_PIN, ADMIN_OPERATOR_PIN, ADMIN_STORE_ACCESS_PIN_BY_ID, DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import { CUSTOMER_STORE_METADATA } from '../data/storeLocator';
import { INVENTORY_MASTER_LIST } from '../constants/inventoryCatalog';
import type {
  AdminOrderNoteMap,
  AdminPermissions,
  EmployeeInput,
  EmployeeRecord,
  EmployeeRole,
  EmployeeShift,
  InventoryItem,
  InventoryStatus,
  InternalAccessSession,
  StoreInput,
  StoreRecord,
  StoreScope,
} from '../types/admin';

interface AdminDashboardContextType {
  session: InternalAccessSession | null;
  stores: StoreRecord[];
  employees: EmployeeRecord[];
  inventory: InventoryItem[];
  scopedEmployees: EmployeeRecord[];
  scopedInventory: InventoryItem[];
  orderNotes: AdminOrderNoteMap;
  permissions: AdminPermissions;
  activeStoreScope: StoreScope;
  activeStore: StoreRecord | null;
  setActiveStoreScope: (scope: StoreScope) => void;
  loginAsOwner: (pin: string) => { success: boolean; message: string };
  loginAsAdmin: (pin: string) => { success: boolean; message: string };
  loginAsStore: (storeId: string, pin: string) => { success: boolean; message: string };
  logoutInternalAccess: () => void;
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
}

const STORAGE_KEYS = {
  session: 'cultiv_admin_access_session_v1',
  stores: 'cultiv_admin_stores_v1',
  employees: 'cultiv_admin_employees_v2',
  inventory: 'cultiv_admin_inventory_v4',
  orderNotes: 'cultiv_admin_order_notes_v1',
  activeStoreScope: 'cultiv_admin_active_store_scope_v1',
  inventoryResetApplied: 'cultiv_admin_inventory_reset_applied_v1',
} as const;

const daysAgo = (days: number, hour = 9, minute = 0) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const nowIso = () => new Date().toISOString();

const isSixDigitPin = (value: string) => /^\d{6}$/.test(value.trim());

const LEGACY_INTERNAL_STORE_PINS_BY_ID: Record<string, string[]> = {
  'store-siddipet': ['240101', '502103'],
  'store-hyderabad': ['240202', '500034'],
  'store-warangal': ['240303', '506002'],
};

const seedStores: StoreRecord[] = CUSTOMER_STORE_METADATA.map((store) => ({
  id: store.id,
  name: store.name,
  city: store.city,
  code: store.code,
  pin: ADMIN_STORE_ACCESS_PIN_BY_ID[store.id] ?? '000000',
  isActive: store.isActive,
  createdAt: store.id === 'store-siddipet'
    ? daysAgo(210)
    : store.id === 'store-hyderabad'
      ? daysAgo(135)
      : daysAgo(48),
}));

const seedEmployees: EmployeeRecord[] = [
  {
    id: 'emp-1',
    name: 'Riya Sharma',
    role: 'manager',
    storeId: 'store-siddipet',
    pin: '510101',
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
    pin: '510102',
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
    pin: '510103',
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
    pin: '510104',
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

const normalizeStoreCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '-');

const normalizeRole = (role: string): EmployeeRole => {
  const value = role.trim().toLowerCase();
  if (value.includes('manager') || value.includes('lead')) return 'manager';
  if (value.includes('counter')) return 'counter';
  return 'kitchen';
};

const normalizeSession = (session: InternalAccessSession | null, stores: StoreRecord[]) => {
  if (!session) return null;
  if (session.role === 'owner' || session.role === 'admin') {
    return session;
  }
  const store = stores.find((entry) => entry.id === session.storeId && entry.isActive);
  if (!store) return null;
  if (session.storeId === store.id) {
    return session;
  }
  return {
    ...session,
    role: 'store',
    storeId: store.id,
  };
};

const ROLE_PERMISSIONS: Record<InternalAccessSession['role'], AdminPermissions> = {
  owner: {
    canManageStores: true,
    canManageEmployees: true,
    canManageMenu: true,
    canViewReports: true,
    canAccessOrders: true,
    canAccessPos: true,
    canAccessInventory: true,
    canSwitchStores: true,
    canViewAllStores: true,
  },
  admin: {
    canManageStores: false,
    canManageEmployees: true,
    canManageMenu: true,
    canViewReports: true,
    canAccessOrders: true,
    canAccessPos: true,
    canAccessInventory: true,
    canSwitchStores: true,
    canViewAllStores: true,
  },
  store: {
    canManageStores: false,
    canManageEmployees: false,
    canManageMenu: false,
    canViewReports: false,
    canAccessOrders: true,
    canAccessPos: true,
    canAccessInventory: true,
    canSwitchStores: false,
    canViewAllStores: false,
  },
};

const normalizeStores = (stores: StoreRecord[]) => stores.map((store) => {
  const seedStore = seedStores.find((s) => s.id === store.id);
  const currentPin = typeof store.pin === 'string' ? store.pin.trim() : '';
  const canonicalPin = seedStore?.pin ?? '000000';
  const shouldRestoreCanonicalPin = Boolean(
    seedStore
      && (
        !isSixDigitPin(currentPin)
        || LEGACY_INTERNAL_STORE_PINS_BY_ID[store.id]?.includes(currentPin)
      ),
  );

  return {
    ...store,
    city: store.city.trim(),
    code: normalizeStoreCode(store.code),
    pin: shouldRestoreCanonicalPin ? canonicalPin : currentPin,
  };
});

const normalizeEmployees = (employees: EmployeeRecord[]) => employees.map((employee) => {
  const storeId = employee.storeId ?? DEFAULT_ORDER_STORE_ID;
  const seedEmployee = seedEmployees.find((entry) => entry.id === employee.id);
  const normalizedPin = isSixDigitPin(employee.pin ?? '')
    ? employee.pin.trim()
    : seedEmployee?.pin ?? '510999';
  return {
    ...employee,
    role: normalizeRole(employee.role),
    storeId,
    pin: normalizedPin,
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
  const [storedScope, setStoredScope] = useState<StoreScope>(() => readStorage(STORAGE_KEYS.activeStoreScope, 'all'));
  const [session, setSession] = useState<InternalAccessSession | null>(() => normalizeSession(readStorage(STORAGE_KEYS.session, null), seedStores));

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
    writeStorage(STORAGE_KEYS.activeStoreScope, storedScope);
  }, [storedScope]);

  useEffect(() => {
    if (session) {
      writeStorage(STORAGE_KEYS.session, session);
    } else {
      localStorage.removeItem(STORAGE_KEYS.session);
    }
  }, [session]);

  useEffect(() => {
    const normalized = normalizeSession(session, stores);
    if (normalized !== session) {
      setSession(normalized);
    }
  }, [session, stores]);

  const loginAsOwner = (pin: string) => {
    if (pin.trim() !== ADMIN_ACCESS_PIN) {
      return { success: false, message: 'Owner PIN did not match.' };
    }
    const nextSession: InternalAccessSession = { role: 'owner', loggedInAt: nowIso() };
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, 'all');
    setSession(nextSession);
    setStoredScope('all');
    return { success: true, message: 'Owner access enabled.' };
  };

  const loginAsAdmin = (pin: string) => {
    if (pin.trim() !== ADMIN_OPERATOR_PIN) {
      return { success: false, message: 'Admin PIN did not match.' };
    }
    const nextSession: InternalAccessSession = { role: 'admin', loggedInAt: nowIso() };
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, 'all');
    setSession(nextSession);
    setStoredScope('all');
    return { success: true, message: 'Admin access enabled.' };
  };

  const loginAsStore = (storeId: string, pin: string) => {
    const store = stores.find((entry) => entry.id === storeId);
    if (!store || !store.isActive) {
      return { success: false, message: 'Select an active store.' };
    }
    if (store.pin !== pin.trim()) {
      return { success: false, message: 'Store PIN did not match.' };
    }
    const nextSession: InternalAccessSession = { role: 'store', storeId: store.id, loggedInAt: nowIso() };
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, store.id);
    setSession(nextSession);
    setStoredScope(store.id);
    return { success: true, message: `${store.name} workspace is ready.` };
  };

  const logoutInternalAccess = () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    writeStorage(STORAGE_KEYS.activeStoreScope, 'all');
    setSession(null);
    setStoredScope('all');
  };

  const permissions = useMemo<AdminPermissions>(() => {
    if (!session) {
      return {
        canManageStores: false,
        canManageEmployees: false,
        canManageMenu: false,
        canViewReports: false,
        canAccessOrders: false,
        canAccessPos: false,
        canAccessInventory: false,
        canSwitchStores: false,
        canViewAllStores: false,
      };
    }
    return ROLE_PERMISSIONS[session.role];
  }, [session]);

  const activeStoreScope = storedScope;
  const activeStore = activeStoreScope === 'all' ? null : stores.find((store) => store.id === activeStoreScope) ?? null;

  const matchesScope = (storeId: string) => activeStoreScope === 'all' || storeId === activeStoreScope;

  const scopedEmployees = useMemo(() => employees.filter((employee) => matchesScope(employee.storeId)), [activeStoreScope, employees]);
  const scopedInventory = useMemo(() => inventory.filter((item) => matchesScope(item.storeId)), [activeStoreScope, inventory]);

  const getStoreName = (storeId: string) => stores.find((store) => store.id === storeId)?.name ?? 'Unknown store';

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

    return { success: true, message: 'Store updated.' };
  };

  const validateEmployeeInput = (input: EmployeeInput, currentEmployeeId?: string) => {
    if (!input.name.trim()) return 'Employee name is required.';
    if (!stores.some((store) => store.id === input.storeId)) return 'Assign the employee to a valid store.';
    if (!isSixDigitPin(input.pin)) return 'Employee PIN must be a valid 6-digit number.';
    if (input.phone && !/^\d{10}$/.test(input.phone.trim())) return 'Use a valid 10-digit phone or leave it empty.';
    const duplicate = employees.find((employee) => employee.pin === input.pin.trim() && employee.id !== currentEmployeeId);
    if (duplicate) return 'Employee PIN must be unique.';
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
        pin: input.pin.trim(),
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
    const error = validateEmployeeInput(input, employeeId);
    if (error) return { success: false, message: error };

    setEmployees((previous) => previous.map((employee) => {
      if (employee.id !== employeeId) return employee;

      const nextEmployee: EmployeeRecord = {
        ...employee,
        name: input.name.trim(),
        role: input.role,
        storeId: input.storeId,
        pin: input.pin.trim(),
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

  const value: AdminDashboardContextType = {
    session,
    stores,
    employees,
    inventory,
    scopedEmployees,
    scopedInventory,
    orderNotes,
    permissions,
    activeStoreScope,
    activeStore,
    setActiveStoreScope,
    loginAsOwner,
    loginAsAdmin,
    loginAsStore,
    logoutInternalAccess,
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