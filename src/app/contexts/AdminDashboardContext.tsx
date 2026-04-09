import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ADMIN_STORE_ACCESS_PIN_BY_ID, DEFAULT_ORDER_STORE_ID } from '../constants/admin';
import { CUSTOMER_STORE_METADATA, loadStores, type StoreLocatorStore } from '../data/storeLocator';
import { inventoryService } from '../services/inventoryService';
import { loginInternal } from '../lib/internalOpsApi';
import type {
  InventoryAdjustmentHistoryItem,
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
  inventoryHistory: InventoryAdjustmentHistoryItem[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  scopedEmployees: EmployeeRecord[];
  scopedInventory: InventoryItem[];
  orderNotes: AdminOrderNoteMap;
  permissions: AdminPermissions;
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  isStoreScoped: () => boolean;
  canAccessStore: (storeId: string) => boolean;
  activeStoreScope: StoreScope;
  activeStoreUuid: string | null;
  activeStore: StoreRecord | null;
  setActiveStoreScope: (scope: StoreScope) => void;
  loginAsOwner: (pin: string) => Promise<{ success: boolean; message: string }>;
  loginAsAdmin: (pin: string) => Promise<{ success: boolean; message: string }>;
  loginAsStore: (storeId: string, pin: string) => Promise<{ success: boolean; message: string }>;
  logoutInternalAccess: () => void;
  addStore: (input: StoreInput) => { success: boolean; message: string };
  updateStore: (storeId: string, input: StoreInput) => { success: boolean; message: string };
  addEmployee: (input: EmployeeInput) => { success: boolean; message: string };
  updateEmployee: (employeeId: string, input: EmployeeInput) => { success: boolean; message: string };
  clockInEmployee: (employeeId: string) => void;
  clockOutEmployee: (employeeId: string) => void;
  refreshInventory: () => Promise<void>;
  addInventoryStock: (itemId: string, amount: number) => Promise<{ success: boolean; message: string }>;
  reduceInventoryStock: (itemId: string, amount: number) => Promise<{ success: boolean; message: string }>;
  setInventoryQuantity: (itemId: string, quantity: number) => Promise<{ success: boolean; message: string }>;
  updateInventoryThreshold: (itemId: string, threshold: number) => Promise<{ success: boolean; message: string }>;
  markInventoryOutOfStock: (itemId: string) => Promise<{ success: boolean; message: string }>;
  saveOrderNote: (orderId: string, note: string) => void;
  getStoreName: (storeId: string) => string;
}

const STORAGE_KEYS = {
  session: 'cultiv_admin_access_session_v1',
  stores: 'cultiv_admin_stores_v1',
  employees: 'cultiv_admin_employees_v2',
  orderNotes: 'cultiv_admin_order_notes_v1',
  activeStoreScope: 'cultiv_admin_active_store_scope_v1',
} as const;

const LEGACY_INVENTORY_STORAGE_KEYS = [
  'cultiv_admin_inventory_v4',
  'cultiv_admin_inventory_reset_applied_v1',
] as const;

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

const PERMISSION_KEY_TO_FLAG = {
  can_manage_stores: 'canManageStores',
  can_manage_employees: 'canManageEmployees',
  can_manage_menu: 'canManageMenu',
  can_view_reports: 'canViewReports',
  can_access_orders: 'canAccessOrders',
  can_access_pos: 'canAccessPos',
  can_access_inventory: 'canAccessInventory',
  can_switch_stores: 'canSwitchStores',
  can_view_all_stores: 'canViewAllStores',
} as const;

type PermissionFlag = typeof PERMISSION_KEY_TO_FLAG[keyof typeof PERMISSION_KEY_TO_FLAG];

const permissionsFromPermissionKeys = (permissionKeys: string[]): AdminPermissions => {
  const base: AdminPermissions = {
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

  const uniqueKeys = new Set(permissionKeys);
  (Object.entries(PERMISSION_KEY_TO_FLAG) as [string, PermissionFlag][]).forEach(([permissionKey, flag]) => {
    if (uniqueKeys.has(permissionKey)) {
      base[flag] = true;
    }
  });

  return base;
};

const toRoleLabel = (roleKey: string) => roleKey.charAt(0).toUpperCase() + roleKey.slice(1);

const createAccessSession = (params: {
  userId: string;
  roleId: string;
  internalSessionToken?: string;
  roleKey: InternalAccessSession['roleKey'];
  roleName?: string;
  permissionKeys: string[];
  scopeType?: 'global' | 'store';
  loggedInAt: string;
  scopeStoreId: string | null;
}) => {
  const {
    userId,
    roleId,
    internalSessionToken,
    roleKey,
    roleName,
    permissionKeys,
    scopeType,
    loggedInAt,
    scopeStoreId,
  } = params;
  const resolvedPermissionKeys = permissionKeys;
  const resolvedScopeType = scopeType ?? (scopeStoreId ? 'store' as const : 'global' as const);

  return {
    sessionId: createId('access-session'),
    userId,
    roleId,
    internalSessionToken: internalSessionToken?.trim() ?? '',
    roleKey,
    roleName: roleName?.trim() || toRoleLabel(roleKey),
    permissionKeys: Array.from(new Set(resolvedPermissionKeys)),
    scopeType: resolvedScopeType,
    scopeStoreId,
    loggedInAt,
  } satisfies InternalAccessSession;
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

const sameStringArray = (left: string[], right: string[]) => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const normalizeSession = (session: InternalAccessSession | null, stores: StoreRecord[]) => {
  if (!session) return null;

  if (!session.sessionId || !session.userId || !session.roleKey) {
    return null;
  }

  const normalizedPermissionKeys = Array.isArray(session.permissionKeys) ? session.permissionKeys : [];
  const normalizedInternalSessionToken = typeof session.internalSessionToken === 'string' ? session.internalSessionToken.trim() : '';
  const normalizedScopeStoreId = session.scopeStoreId ?? null;
  const normalizedScopeType = session.scopeType ?? (normalizedScopeStoreId ? 'store' : 'global');
  const normalizedRoleName = session.roleName?.trim() || toRoleLabel(session.roleKey);

  if (normalizedScopeType === 'global') {
    const alreadyNormalized = (
      session.roleName === normalizedRoleName
      && session.internalSessionToken === normalizedInternalSessionToken
      && session.scopeType === 'global'
      && session.scopeStoreId === null
      && sameStringArray(session.permissionKeys, normalizedPermissionKeys)
    );

    if (alreadyNormalized) {
      return session;
    }

    return {
      ...session,
      roleName: normalizedRoleName,
      internalSessionToken: normalizedInternalSessionToken,
      permissionKeys: normalizedPermissionKeys,
      scopeType: 'global',
      scopeStoreId: null,
    } satisfies InternalAccessSession;
  }

  // scopeStoreId is now a DB UUID returned by the edge function — do not validate
  // against the local stores list (which uses app-level string IDs).
  if (!normalizedScopeStoreId) return null;

  const alreadyNormalized = (
    session.roleName === normalizedRoleName
    && session.internalSessionToken === normalizedInternalSessionToken
    && session.scopeType === 'store'
    && session.scopeStoreId === normalizedScopeStoreId
    && sameStringArray(session.permissionKeys, normalizedPermissionKeys)
  );

  if (alreadyNormalized) {
    return session;
  }

  return {
    ...session,
    roleName: normalizedRoleName,
    internalSessionToken: normalizedInternalSessionToken,
    permissionKeys: normalizedPermissionKeys,
    scopeType: 'store',
    scopeStoreId: normalizedScopeStoreId,
  } satisfies InternalAccessSession;
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
  const [canonicalStores, setCanonicalStores] = useState<StoreLocatorStore[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => normalizeEmployees(readStorage(STORAGE_KEYS.employees, seedEmployees)));
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryAdjustmentHistoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<AdminOrderNoteMap>(() => readStorage(STORAGE_KEYS.orderNotes, {}));
  const [storedScope, setStoredScope] = useState<StoreScope>(() => readStorage(STORAGE_KEYS.activeStoreScope, 'all'));
  const [session, setSession] = useState<InternalAccessSession | null>(() => normalizeSession(readStorage(STORAGE_KEYS.session, null), seedStores));

  useEffect(() => {
    let isActive = true;

    void loadStores()
      .then((loadedStores) => {
        if (!isActive) return;
        setCanonicalStores(loadedStores);
      })
      .catch(() => {
        if (!isActive) return;
        setCanonicalStores([]);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof localStorage === 'undefined') {
      return;
    }

    LEGACY_INVENTORY_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.stores, stores);
  }, [stores]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.employees, employees);
  }, [employees]);

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

  const loginAsOwner = async (pin: string) => {
    const { data, error } = await loginInternal({ mode: 'owner', pin });
    if (error || !data) {
      return { success: false, message: error ?? 'Owner login failed.' };
    }
    const nextSession = createAccessSession({
      userId: data.userId,
      roleId: '',
      internalSessionToken: data.internalSessionToken,
      roleKey: 'owner',
      permissionKeys: data.permissionKeys,
      scopeType: 'global',
      loggedInAt: nowIso(),
      scopeStoreId: null,
    });
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, 'all');
    setSession(nextSession);
    setStoredScope('all');
    return { success: true, message: 'Owner access enabled.' };
  };

  const loginAsAdmin = async (pin: string) => {
    const { data, error } = await loginInternal({ mode: 'admin', pin });
    if (error || !data) {
      return { success: false, message: error ?? 'Admin login failed.' };
    }
    const nextSession = createAccessSession({
      userId: data.userId,
      roleId: '',
      internalSessionToken: data.internalSessionToken,
      roleKey: 'admin',
      permissionKeys: data.permissionKeys,
      scopeType: 'global',
      loggedInAt: nowIso(),
      scopeStoreId: null,
    });
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, 'all');
    setSession(nextSession);
    setStoredScope('all');
    return { success: true, message: 'Admin access enabled.' };
  };

  const loginAsStore = async (storeCode: string, pin: string) => {
    const normalizedStoreCode = storeCode.trim().toUpperCase();
    const store = stores.find((entry) => entry.code === normalizedStoreCode);
    if (!store || !store.isActive) {
      return { success: false, message: 'Select an active store.' };
    }

    const { data, error } = await loginInternal({ mode: 'store', pin, storeCode: normalizedStoreCode });
    if (error || !data) {
      return { success: false, message: error ?? 'Store login failed.' };
    }

    const nextSession = createAccessSession({
      userId: data.userId,
      roleId: '',
      internalSessionToken: data.internalSessionToken,
      roleKey: 'store',
      permissionKeys: data.permissionKeys,
      scopeType: 'store',
      loggedInAt: nowIso(),
      scopeStoreId: data.scopeStoreId,   // DB UUID from edge function
    });
    writeStorage(STORAGE_KEYS.session, nextSession);
    writeStorage(STORAGE_KEYS.activeStoreScope, store.id);   // local ID for UI scope filtering
    setSession(nextSession);
    setStoredScope(store.id);   // local ID for UI scope filtering
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
    return permissionsFromPermissionKeys(session.permissionKeys ?? []);
  }, [session]);

  const hasPermission = (permissionKey: string) => {
    if (!session) return false;
    return session.permissionKeys.includes(permissionKey);
  };

  const hasAnyPermission = (permissionKeys: string[]) => {
    if (!session) return false;
    const sessionPermissionSet = new Set(session.permissionKeys);
    return permissionKeys.some((permissionKey) => sessionPermissionSet.has(permissionKey));
  };

  const isStoreScoped = () => Boolean(session && session.scopeType === 'store' && session.scopeStoreId);

  const canAccessStore = (storeId: string) => {
    if (!session) return false;
    if (session.scopeType === 'global') return true;
    return storedScope === storeId;
  };

  const localStoreIdToUuid = useMemo(() => {
    const localStoreIds = new Set(stores.map((store) => store.id));
    const codeToUuid = canonicalStores.reduce<Record<string, string>>((accumulator, store) => {
      const normalizedCode = normalizeStoreCode(store.code);
      if (!normalizedCode || localStoreIds.has(store.id)) {
        return accumulator;
      }
      accumulator[normalizedCode] = store.id;
      return accumulator;
    }, {});

    return stores.reduce<Record<string, string>>((accumulator, store) => {
      const canonicalStoreId = codeToUuid[normalizeStoreCode(store.code)];
      if (canonicalStoreId) {
        accumulator[store.id] = canonicalStoreId;
      }
      return accumulator;
    }, {});
  }, [canonicalStores, stores]);

  const uuidToLocalStoreId = useMemo(
    () => Object.entries(localStoreIdToUuid).reduce<Record<string, string>>((accumulator, [localStoreId, storeUuid]) => {
      accumulator[storeUuid] = localStoreId;
      return accumulator;
    }, {}),
    [localStoreIdToUuid],
  );

  const activeStoreScope = storedScope;
  const activeStoreUuid = session?.scopeStoreId
    ?? (activeStoreScope === 'all' ? null : localStoreIdToUuid[activeStoreScope] ?? null);
  const activeStore = activeStoreScope === 'all' ? null : stores.find((store) => store.id === activeStoreScope) ?? null;

  const matchesScope = (storeId: string) => activeStoreScope === 'all' || storeId === activeStoreScope;

  const scopedEmployees = useMemo(() => employees.filter((employee) => matchesScope(employee.storeId)), [activeStoreScope, employees]);
  const scopedInventory = inventory;

  const getStoreName = (storeId: string) => (
    stores.find((store) => store.id === storeId)?.name
    ?? canonicalStores.find((store) => store.id === storeId)?.name
    ?? 'Unknown store'
  );

  const mapInventoryItem = useCallback((row: Awaited<ReturnType<typeof inventoryService.fetchInventoryDashboard>>['items'][number]): InventoryItem => {
    const uiStoreId = uuidToLocalStoreId[row.storeId] ?? row.storeId;
    const quantity = Math.max(0, Number(row.quantity ?? 0));
    const threshold = Math.max(0, Number(row.threshold ?? 0));

    return {
      id: row.storeInventoryId,
      inventoryItemId: row.inventoryItemId,
      code: row.sku,
      storeId: uiStoreId,
      storeUuid: row.storeId,
      name: row.name,
      category: toCategoryLabel(row.category),
      quantity,
      unit: row.unit,
      threshold,
      status: getInventoryStatus(quantity, threshold),
      updatedAt: row.updatedAt,
      sortOrder: row.sortOrder,
    };
  }, [uuidToLocalStoreId]);

  const mapInventoryHistoryItem = useCallback((row: Awaited<ReturnType<typeof inventoryService.fetchInventoryDashboard>>['adjustments'][number]): InventoryAdjustmentHistoryItem => ({
    id: row.adjustmentId,
    storeId: uuidToLocalStoreId[row.storeId] ?? row.storeId,
    storeUuid: row.storeId,
    storeName: row.storeName,
    itemId: row.inventoryItemId,
    itemCode: row.sku,
    itemName: row.itemName,
    adjustmentType: row.adjustmentType,
    quantityDelta: Number(row.quantityDelta ?? 0),
    quantityBefore: Number(row.quantityBefore ?? 0),
    quantityAfter: Number(row.quantityAfter ?? 0),
    thresholdBefore: row.thresholdBefore == null ? null : Number(row.thresholdBefore),
    thresholdAfter: row.thresholdAfter == null ? null : Number(row.thresholdAfter),
    notes: row.notes ?? null,
    actorName: row.actorName ?? null,
    createdAt: row.createdAt,
  }), [uuidToLocalStoreId]);

  const refreshInventory = useCallback(async () => {
    if (!session || !permissions.canAccessInventory) {
      setInventoryLoading(false);
      setInventory([]);
      setInventoryHistory([]);
      setInventoryError(null);
      return;
    }

    if (activeStoreScope !== 'all' && !activeStoreUuid) {
      setInventoryLoading(false);
      setInventory([]);
      setInventoryHistory([]);
      setInventoryError('The selected store is not mapped to a backend store yet.');
      return;
    }

    setInventoryLoading(true);
    setInventoryError(null);

    try {
      const dashboard = await inventoryService.fetchInventoryDashboard(session, activeStoreUuid, 20);
      setInventory(dashboard.items.map(mapInventoryItem));
      setInventoryHistory(dashboard.adjustments.map(mapInventoryHistoryItem));
    } catch (error) {
      console.error('Failed to load inventory dashboard.', error);
      setInventory([]);
      setInventoryHistory([]);
      setInventoryError(error instanceof Error ? error.message : 'Could not load inventory.');
    } finally {
      setInventoryLoading(false);
    }
  }, [
    activeStoreScope,
    activeStoreUuid,
    mapInventoryHistoryItem,
    mapInventoryItem,
    permissions.canAccessInventory,
    session,
  ]);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

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

  const applyInventoryMutation = useCallback(async (
    itemId: string,
    mutation: {
      adjustmentType: 'set' | 'add' | 'reduce' | 'threshold_update' | 'out_of_stock';
      amount?: number;
      quantity?: number;
      threshold?: number;
      notes?: string;
    },
    successMessage: string,
  ) => {
    if (!session) {
      return { success: false, message: 'You need an active internal session to update inventory.' };
    }

    const currentItem = inventory.find((item) => item.id === itemId);
    if (!currentItem) {
      return { success: false, message: 'Inventory item not found.' };
    }

    try {
      const result = await inventoryService.mutateInventoryItem({
        session,
        storeId: currentItem.storeUuid || activeStoreUuid,
        inventoryItemId: currentItem.inventoryItemId,
        adjustmentType: mutation.adjustmentType,
        amount: mutation.amount,
        quantity: mutation.quantity,
        threshold: mutation.threshold,
        notes: mutation.notes,
      });

      const nextItem = mapInventoryItem(result.item);
      const nextHistoryItem = mapInventoryHistoryItem(result.adjustment);

      setInventory((previous) => previous.map((item) => (
        item.id === itemId ? nextItem : item
      )));
      setInventoryHistory((previous) => [
        nextHistoryItem,
        ...previous.filter((item) => item.id !== nextHistoryItem.id),
      ].slice(0, 20));
      setInventoryError(null);

      return { success: true, message: successMessage };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update inventory.';
      console.error('Failed to update inventory item.', error);
      setInventoryError(message);
      return { success: false, message };
    }
  }, [activeStoreUuid, inventory, mapInventoryHistoryItem, mapInventoryItem, session]);

  const addInventoryStock = async (itemId: string, amount: number) => {
    if (amount <= 0) return { success: false, message: 'Use a value greater than 0.' };
    return applyInventoryMutation(itemId, { adjustmentType: 'add', amount }, 'Inventory updated.');
  };

  const reduceInventoryStock = async (itemId: string, amount: number) => {
    if (amount <= 0) return { success: false, message: 'Use a value greater than 0.' };
    return applyInventoryMutation(itemId, { adjustmentType: 'reduce', amount }, 'Inventory updated.');
  };

  const setInventoryQuantity = async (itemId: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity < 0) {
      return { success: false, message: 'Quantity must be a non-negative number.' };
    }
    return applyInventoryMutation(itemId, { adjustmentType: 'set', quantity }, 'Inventory quantity saved.');
  };

  const updateInventoryThreshold = async (itemId: string, threshold: number) => {
    if (!Number.isFinite(threshold) || threshold < 0) {
      return { success: false, message: 'Threshold must be a non-negative number.' };
    }
    return applyInventoryMutation(itemId, { adjustmentType: 'threshold_update', threshold }, 'Threshold updated.');
  };

  const markInventoryOutOfStock = async (itemId: string) => (
    applyInventoryMutation(itemId, { adjustmentType: 'out_of_stock' }, 'Item marked out of stock.')
  );

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
    inventoryHistory,
    inventoryLoading,
    inventoryError,
    scopedEmployees,
    scopedInventory,
    orderNotes,
    permissions,
    hasPermission,
    hasAnyPermission,
    isStoreScoped,
    canAccessStore,
    activeStoreScope,
    activeStoreUuid,
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
    refreshInventory,
    addInventoryStock,
    reduceInventoryStock,
    setInventoryQuantity,
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
