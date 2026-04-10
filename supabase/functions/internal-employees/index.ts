// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type EmployeeRole = 'manager' | 'kitchen' | 'counter';
type ShiftStatus = 'on_shift' | 'off_shift';
type EmployeesAction = 'dashboard' | 'upsert_employee' | 'deactivate_employee' | 'delete_employee';
type DashboardPeriod = 'this_week' | 'last_week' | 'this_month' | 'last_month';

interface InternalEmployeesRequest {
  internalSessionToken?: string;
  roleKey?: RoleKey;
  scopeType?: ScopeType;
  scopeStoreId?: string | null;
  action?: EmployeesAction;
  period?: DashboardPeriod;

  employeeId?: string;
  name?: string;
  role?: EmployeeRole;
  storeId?: string;
  storeCode?: string;
  pin?: string;
  phone?: string;
  isActive?: boolean;
}

interface InternalAccessSessionRow {
  id: string;
  session_token: string;
  internal_user_id: string;
  role_key: RoleKey;
  scope_type: ScopeType;
  scope_store_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
}

const loadPermissionKeys = async (db: ReturnType<typeof createClient>, internalUserId: string): Promise<string[]> => {
  const { data } = await db
    .from('internal_users')
    .select('roles!inner(role_permissions(is_allowed, permissions(permission_key)))')
    .eq('id', internalUserId)
    .maybeSingle();

  const permissionKeys = (data?.roles?.role_permissions ?? [])
    .filter((entry: any) => entry?.is_allowed)
    .map((entry: any) => entry?.permissions?.permission_key?.trim())
    .filter((permissionKey: string | undefined): permissionKey is string => Boolean(permissionKey));

  return Array.from(new Set(permissionKeys));
};

interface EmployeeRow {
  id: string;
  full_name: string;
  employee_role: EmployeeRole;
  store_id: string;
  stores?: {
    code: string;
  } | null;
  phone: string | null;
  shift_status: ShiftStatus;
  is_active: boolean;
}

interface EmployeeShiftRow {
  shift_id: string;
  employee_id: string;
  store_id: string;
  shift_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_hours: number | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const HOURS_MS = 1000 * 60 * 60;

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const roundHours = (hours: number) => Number(Math.max(0, hours).toFixed(2));

const normalizeAction = (body: InternalEmployeesRequest): { value?: EmployeesAction; error?: string } => {
  if (body.action !== 'dashboard' && body.action !== 'upsert_employee' && body.action !== 'deactivate_employee' && body.action !== 'delete_employee') {
    return { error: 'action must be one of dashboard, upsert_employee, deactivate_employee, or delete_employee.' };
  }
  return { value: body.action };
};

const getUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getUtcWeekStart = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return getUtcDateKey(start);
};

const getUtcMonthStart = (date: Date) => getUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));

const getUtcMonthEnd = (date: Date) => getUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));

const getUtcDaysAgo = (date: Date, days: number) => {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() - days);
  return getUtcDateKey(copy);
};

const getShiftHours = (shift: EmployeeShiftRow, now: Date) => {
  if (shift.clock_out_at) {
    return roundHours(Number(shift.total_hours ?? 0));
  }
  return roundHours((now.getTime() - Date.parse(shift.clock_in_at)) / HOURS_MS);
};

const parsePhone = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '').slice(0, 10);
  return digits.length > 0 ? digits : null;
};

const parsePin = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const pin = value.trim();
  if (!pin) return null;
  if (!/^\d{6}$/.test(pin)) return null;
  return pin;
};

const normalizePeriod = (value?: string): DashboardPeriod => {
  if (value === 'last_week' || value === 'this_month' || value === 'last_month') {
    return value;
  }
  return 'this_week';
};

const getPeriodRange = (now: Date, period: DashboardPeriod) => {
  const today = getUtcDateKey(now);
  const thisWeekStart = getUtcWeekStart(now);
  const thisMonthStart = getUtcMonthStart(now);
  const lastWeekEndDate = new Date(`${thisWeekStart}T00:00:00.000Z`);
  lastWeekEndDate.setUTCDate(lastWeekEndDate.getUTCDate() - 1);
  const lastWeekEnd = getUtcDateKey(lastWeekEndDate);
  const lastWeekStartDate = new Date(`${thisWeekStart}T00:00:00.000Z`);
  lastWeekStartDate.setUTCDate(lastWeekStartDate.getUTCDate() - 7);
  const lastWeekStart = getUtcDateKey(lastWeekStartDate);
  const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonthStart = getUtcDateKey(previousMonthDate);
  const lastMonthEnd = getUtcMonthEnd(previousMonthDate);

  switch (period) {
    case 'last_week':
      return { label: 'Last week', start: lastWeekStart, end: lastWeekEnd };
    case 'this_month':
      return { label: 'This month', start: thisMonthStart, end: today };
    case 'last_month':
      return { label: 'Last month', start: lastMonthStart, end: lastMonthEnd };
    case 'this_week':
    default:
      return { label: 'This week', start: thisWeekStart, end: today };
  }
};

const verifyAndLoadSession = async (
  db: ReturnType<typeof createClient>,
  token: string,
): Promise<{ valid: true; session: InternalAccessSessionRow } | { valid: false; error: string }> => {
  const { data, error } = await db
    .from('internal_access_sessions')
    .select('id, session_token, internal_user_id, role_key, scope_type, scope_store_id, expires_at, revoked_at, last_seen_at')
    .eq('session_token', token)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Internal session not found.' };
  }

  if (data.revoked_at !== null) {
    return { valid: false, error: 'Internal session has been revoked.' };
  }

  if (new Date(data.expires_at) <= new Date()) {
    return { valid: false, error: 'Internal session has expired.' };
  }

  db
    .from('internal_access_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('session_token', token)
    .then(() => {})
    .catch(() => {});

  return { valid: true, session: data as InternalAccessSessionRow };
};

const getScopedStores = async (db: ReturnType<typeof createClient>, session: InternalAccessSessionRow): Promise<{ storeIds?: string[]; error?: string }> => {
  if (session.scope_type === 'store') {
    if (!session.scope_store_id) {
      return { error: 'Store-scoped session missing store scope.' };
    }
    return { storeIds: [session.scope_store_id] };
  }

  const { data, error } = await db
    .from('stores')
    .select('id')
    .eq('is_active', true);

  if (error) {
    return { error: 'Could not load stores for this session.' };
  }

  return { storeIds: (data ?? []).map((row: { id: string }) => row.id) };
};

const buildDashboard = async (db: ReturnType<typeof createClient>, storeIds: string[], period: DashboardPeriod) => {
  const now = new Date();
  const today = getUtcDateKey(now);
  const weekStart = getUtcWeekStart(now);
  const monthStart = getUtcMonthStart(now);
  const periodRange = getPeriodRange(now, period);
  const historyStart = getUtcDaysAgo(now, 62);

  if (storeIds.length === 0) {
    return { employees: [] };
  }

  const { data: employees, error: employeesError } = await db
    .from('employees')
    .select('id, full_name, employee_role, store_id, stores(code), phone, shift_status, is_active')
    .in('store_id', storeIds)
    .eq('is_deleted', false)
    .order('full_name', { ascending: true });

  if (employeesError) {
    return { error: 'Could not load employees.' };
  }

  const employeeRows = (employees ?? []) as EmployeeRow[];
  const employeeIds = employeeRows.map((employee) => employee.id);

  let shiftRows: EmployeeShiftRow[] = [];
  if (employeeIds.length > 0) {
    const { data: shifts, error: shiftsError } = await db
      .from('employee_shifts')
      .select('shift_id, employee_id, store_id, shift_date, clock_in_at, clock_out_at, total_hours')
      .in('store_id', storeIds)
      .in('employee_id', employeeIds)
      .gte('shift_date', historyStart)
      .order('clock_in_at', { ascending: false });

    if (shiftsError) {
      return { error: 'Could not load employee shift history.' };
    }

    shiftRows = (shifts ?? []) as EmployeeShiftRow[];
  }

  const shiftsByEmployeeId = new Map<string, EmployeeShiftRow[]>();
  for (const shift of shiftRows) {
    const existing = shiftsByEmployeeId.get(shift.employee_id) ?? [];
    existing.push(shift);
    shiftsByEmployeeId.set(shift.employee_id, existing);
  }

  return {
    employees: employeeRows.map((employee) => {
      const employeeShifts = shiftsByEmployeeId.get(employee.id) ?? [];
      const selectedPeriodShifts = employeeShifts.filter((shift) => shift.shift_date >= periodRange.start && shift.shift_date <= periodRange.end);

      const todayHours = roundHours(
        employeeShifts
          .filter((shift) => shift.shift_date === today)
          .reduce((sum, shift) => sum + getShiftHours(shift, now), 0),
      );

      const weekHours = roundHours(
        employeeShifts
          .filter((shift) => shift.shift_date >= weekStart)
          .reduce((sum, shift) => sum + getShiftHours(shift, now), 0),
      );

      const monthHours = roundHours(
        employeeShifts
          .filter((shift) => shift.shift_date >= monthStart)
          .reduce((sum, shift) => sum + getShiftHours(shift, now), 0),
      );

      const summaryHours = roundHours(
        selectedPeriodShifts.reduce((sum, shift) => sum + getShiftHours(shift, now), 0),
      );

      return {
        employeeId: employee.id,
        name: employee.full_name,
        role: employee.employee_role,
        storeId: employee.store_id,
        storeCode: employee.stores?.code ?? '',
        isActive: employee.is_active,
        phone: employee.phone,
        shiftStatus: employee.shift_status,
        summaryLabel: periodRange.label,
        summaryHours,
        todayHours,
        weekHours,
        monthHours,
        recentShifts: selectedPeriodShifts.map((shift) => ({
          shiftId: shift.shift_id,
          shiftDate: shift.shift_date,
          clockInAt: shift.clock_in_at,
          clockOutAt: shift.clock_out_at,
          totalHours: getShiftHours(shift, now),
        })),
      };
    }),
  };
};

const ROLE_SET = new Set<EmployeeRole>(['manager', 'kitchen', 'counter']);

const generateEmployeeCode = () => `EMP-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

const deactivateEmployee = async (db: ReturnType<typeof createClient>, session: InternalAccessSessionRow, employeeId: string) => {
  if (!employeeId || typeof employeeId !== 'string') {
    return { status: 400, payload: { error: 'employeeId is required.' } };
  }

  const { data: existingEmployee, error: existingError } = await db
    .from('employees')
    .select('id, full_name, store_id, is_active')
    .eq('id', employeeId)
    .single();

  if (existingError || !existingEmployee) {
    return { status: 404, payload: { error: 'Employee not found.' } };
  }

  if (session.scope_type === 'store' && existingEmployee.store_id !== session.scope_store_id) {
    return { status: 403, payload: { error: 'Employee is out of this store scope.' } };
  }

  if (!existingEmployee.is_active) {
    return {
      status: 200,
      payload: {
        success: true,
        message: `${existingEmployee.full_name} is already inactive.`,
      },
    };
  }

  const nowIso = new Date().toISOString();
  const { data: openShiftRows, error: openShiftError } = await db
    .from('employee_shifts')
    .select('shift_id, clock_in_at')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1);

  if (openShiftError) {
    return { status: 500, payload: { error: 'Could not close the active shift before deactivation.' } };
  }

  const openShift = (openShiftRows ?? [])[0] ?? null;
  if (openShift) {
    const totalHours = roundHours((Date.parse(nowIso) - Date.parse(openShift.clock_in_at)) / HOURS_MS);
    const { error: closeShiftError } = await db
      .from('employee_shifts')
      .update({
        clock_out_at: nowIso,
        total_hours: totalHours,
        updated_at: nowIso,
      })
      .eq('shift_id', openShift.shift_id);

    if (closeShiftError) {
      return { status: 500, payload: { error: 'Could not close the active shift before deactivation.' } };
    }
  }

  const { error: deactivateError } = await db
    .from('employees')
    .update({
      is_active: false,
      shift_status: 'off_shift',
      updated_at: nowIso,
    })
    .eq('id', employeeId);

  if (deactivateError) {
    return { status: 500, payload: { error: 'Could not deactivate employee.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      message: `${existingEmployee.full_name} was deactivated.`,
    },
  };
};

const deleteEmployee = async (db: ReturnType<typeof createClient>, session: InternalAccessSessionRow, employeeId: string) => {
  if (!employeeId || typeof employeeId !== 'string') {
    return { status: 400, payload: { error: 'employeeId is required.' } };
  }

  const { data: existingEmployee, error: existingError } = await db
    .from('employees')
    .select('id, full_name, store_id')
    .eq('id', employeeId)
    .single();

  if (existingError || !existingEmployee) {
    return { status: 404, payload: { error: 'Employee not found.' } };
  }

  if (session.scope_type === 'store' && existingEmployee.store_id !== session.scope_store_id) {
    return { status: 403, payload: { error: 'Employee is out of this store scope.' } };
  }

  const { data: shifts, error: shiftsError } = await db
    .from('employee_shifts')
    .select('shift_id')
    .eq('employee_id', employeeId)
    .limit(1);

  if (shiftsError) {
    return { status: 500, payload: { error: 'Could not retrieve employee shift history.' } };
  }

  const hasShifts = (shifts ?? []).length > 0;

  if (hasShifts) {
    return {
      status: 409,
      payload: {
        error: 'This employee has shift/history records, so they cannot be permanently deleted. Please deactivate instead.',
      },
    };
  }

  const { error: deleteError } = await db
    .from('employees')
    .delete()
    .eq('id', employeeId);

  if (deleteError) {
    return { status: 500, payload: { error: 'Could not delete employee.' } };
  }

  return {
    status: 200,
    payload: {
      success: true,
      message: `${existingEmployee.full_name} was permanently deleted.`,
    },
  };
};

const saveEmployee = async (db: ReturnType<typeof createClient>, session: InternalAccessSessionRow, body: InternalEmployeesRequest) => {
  const name = (body.name ?? '').trim();
  const role = body.role;
  const requestedStoreId = (body.storeId ?? '').trim();
  const requestedStoreCode = (body.storeCode ?? '').trim().toUpperCase();
  const isActive = body.isActive === false ? false : true;
  const phone = parsePhone(body.phone);
  const pin = parsePin(body.pin);
  const employeeId = (body.employeeId ?? '').trim() || null;

  if (!name) {
    return { status: 400, payload: { error: 'name is required.' } };
  }

  if (!role || !ROLE_SET.has(role)) {
    return { status: 400, payload: { error: 'role must be one of manager, kitchen, or counter.' } };
  }

  if (!requestedStoreId && !requestedStoreCode) {
    return { status: 400, payload: { error: 'storeId or storeCode is required.' } };
  }

  let storeLookup = db
    .from('stores')
    .select('id, code, is_active');

  storeLookup = requestedStoreId
    ? storeLookup.eq('id', requestedStoreId)
    : storeLookup.eq('code', requestedStoreCode);

  const { data: storeRow, error: storeError } = await storeLookup.single();

  if (storeError || !storeRow || !storeRow.is_active) {
    return { status: 400, payload: { error: 'Selected store is not available.' } };
  }

  const storeId = storeRow.id;

  const nowIso = new Date().toISOString();

  if (session.scope_type === 'store' && session.scope_store_id !== storeId) {
    return { status: 403, payload: { error: 'Store-scoped users can only manage employees for their store.' } };
  }

  if (employeeId) {
    const { data: existingEmployee, error: existingError } = await db
      .from('employees')
      .select('id, store_id')
      .eq('id', employeeId)
      .single();

    if (existingError || !existingEmployee) {
      return { status: 404, payload: { error: 'Employee not found.' } };
    }

    if (session.scope_type === 'store' && existingEmployee.store_id !== session.scope_store_id) {
      return { status: 403, payload: { error: 'Employee is out of this store scope.' } };
    }

    const updatePayload: Record<string, unknown> = {
      full_name: name,
      employee_role: role,
      store_id: storeId,
      phone,
      is_active: isActive,
      updated_at: nowIso,
    };

    if (!isActive) {
      const { data: openShiftRows, error: openShiftError } = await db
        .from('employee_shifts')
        .select('shift_id, clock_in_at')
        .eq('employee_id', employeeId)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1);

      if (openShiftError) {
        return { status: 500, payload: { error: 'Could not close the active shift before deactivation.' } };
      }

      const openShift = (openShiftRows ?? [])[0] ?? null;
      if (openShift) {
        const totalHours = roundHours((Date.parse(nowIso) - Date.parse(openShift.clock_in_at)) / HOURS_MS);
        const { error: closeShiftError } = await db
          .from('employee_shifts')
          .update({
            clock_out_at: nowIso,
            total_hours: totalHours,
            updated_at: nowIso,
          })
          .eq('shift_id', openShift.shift_id);

        if (closeShiftError) {
          return { status: 500, payload: { error: 'Could not close the active shift before deactivation.' } };
        }
      }

      updatePayload.shift_status = 'off_shift';
    }

    if (pin) {
      updatePayload.pin_hash = await bcrypt.hash(pin, 10);
    }

    const { data: updated, error: updateError } = await db
      .from('employees')
      .update(updatePayload)
      .eq('id', employeeId)
      .select('id, full_name, employee_role, store_id, is_active')
      .single();

    if (updateError || !updated) {
      return { status: 500, payload: { error: 'Could not update employee.' } };
    }

    return {
      status: 200,
      payload: {
        employeeId: updated.id,
        name: updated.full_name,
        role: updated.employee_role,
        storeId: updated.store_id,
        isActive: updated.is_active,
      },
    };
  }

  if (!pin) {
    return { status: 400, payload: { error: 'A valid 6-digit PIN is required for new employees.' } };
  }

  let insertedEmployee: { id: string; full_name: string; employee_role: EmployeeRole; store_id: string; is_active: boolean } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const employeeCode = generateEmployeeCode();
    const pinHash = await bcrypt.hash(pin, 10);

    const { data: created, error: createError } = await db
      .from('employees')
      .insert({
        employee_code: employeeCode,
        full_name: name,
        employee_role: role,
        store_id: storeId,
        pin_hash: pinHash,
        phone,
        shift_status: 'off_shift',
        is_active: isActive,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, full_name, employee_role, store_id, is_active')
      .single();

    if (!createError && created) {
      insertedEmployee = created;
      break;
    }

    if (createError && String(createError.message ?? '').includes('employees_employee_code_key')) {
      continue;
    }

    return { status: 500, payload: { error: 'Could not create employee.' } };
  }

  if (!insertedEmployee) {
    return { status: 500, payload: { error: 'Could not create employee. Try again.' } };
  }

  return {
    status: 200,
    payload: {
      employeeId: insertedEmployee.id,
      name: insertedEmployee.full_name,
      role: insertedEmployee.employee_role,
      storeId: insertedEmployee.store_id,
      isActive: insertedEmployee.is_active,
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server is not configured for internal employees.' });
  }

  let body: InternalEmployeesRequest;
  try {
    body = (await req.json()) as InternalEmployeesRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const action = normalizeAction(body);
  if (!action.value) {
    return json(400, { error: action.error ?? 'Invalid action.' });
  }

  const token = (body.internalSessionToken ?? '').trim();
  if (!token) {
    return json(400, { error: 'internalSessionToken is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const sessionResult = await verifyAndLoadSession(db, token);
  if (!sessionResult.valid) {
    return json(401, { error: sessionResult.error });
  }

  const session = sessionResult.session;
  const permissionKeys = await loadPermissionKeys(db, session.internal_user_id);
  if (!permissionKeys.includes('can_manage_employees')) {
    return json(403, { error: 'This internal session cannot manage employees.' });
  }

  if (action.value === 'dashboard') {
    const period = normalizePeriod(body.period);
    const scoped = await getScopedStores(db, session);
    if (!scoped.storeIds) {
      return json(403, { error: scoped.error ?? 'Session cannot access any store.' });
    }

    const result = await buildDashboard(db, scoped.storeIds, period);
    if ('error' in result) {
      return json(500, { error: result.error });
    }

    return json(200, { employees: result.employees });
  }

  if (action.value === 'delete_employee') {
    const deleteResult = await deleteEmployee(db, session, body.employeeId ?? '');
    return json(deleteResult.status, deleteResult.payload as Record<string, unknown>);
  }

  if (action.value === 'deactivate_employee') {
    const deactivateResult = await deactivateEmployee(db, session, body.employeeId ?? '');
    return json(deactivateResult.status, deactivateResult.payload as Record<string, unknown>);
  }

  const saveResult = await saveEmployee(db, session, body);
  return json(saveResult.status, saveResult.payload as Record<string, unknown>);
});
