// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

type RoleKey = 'owner' | 'admin' | 'store';
type ScopeType = 'global' | 'store' | 'owner' | 'admin';
type EmployeeRole = 'manager' | 'kitchen' | 'counter';

type ShiftAction = 'dashboard' | 'submit_pin';

interface InternalShiftControlRequest {
  internalSessionToken?: string;
  roleKey?: RoleKey;
  scopeType?: ScopeType;
  scopeStoreId?: string | null;
  action?: ShiftAction;
  employeeId?: string;
  pin?: string;
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

interface EmployeeRow {
  id: string;
  full_name: string;
  employee_role: EmployeeRole;
  store_id: string;
  pin_hash: string;
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

const extractSessionToken = (body: InternalShiftControlRequest): { value?: string; error?: string } => {
  const token = (body.internalSessionToken ?? '').trim();
  if (!token) return { error: 'internalSessionToken is required.' };
  return { value: token };
};

const normalizeAction = (body: InternalShiftControlRequest): { value?: ShiftAction; error?: string } => {
  if (body.action !== 'dashboard' && body.action !== 'submit_pin') {
    return { error: 'action must be one of dashboard or submit_pin.' };
  }
  return { value: body.action };
};

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

const verifyPin = async (rawPin: string, storedPinHash: string): Promise<boolean> => {
  if (!storedPinHash) return false;

  if (isBcryptHash(storedPinHash)) {
    try {
      return await bcrypt.compare(rawPin, storedPinHash);
    } catch {
      return false;
    }
  }

  return timingSafeEqual(rawPin, storedPinHash);
};

const roundHours = (hours: number) => Number(Math.max(0, hours).toFixed(2));

const getUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getUtcWeekStart = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return getUtcDateKey(start);
};

const getUtcMonthStart = (date: Date) => getUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));

const getShiftHours = (shift: EmployeeShiftRow, now: Date) => {
  if (shift.clock_out_at) {
    return roundHours(Number(shift.total_hours ?? 0));
  }
  return roundHours((now.getTime() - Date.parse(shift.clock_in_at)) / HOURS_MS);
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

const enforceStoreScope = (session: InternalAccessSessionRow): { storeId?: string; error?: string } => {
  if (session.scope_type !== 'store' || !session.scope_store_id) {
    return { error: 'Shift control requires a store-scoped internal session.' };
  }
  return { storeId: session.scope_store_id };
};

const loadDashboard = async (db: ReturnType<typeof createClient>, storeId: string) => {
  const now = new Date();
  const today = getUtcDateKey(now);
  const weekStart = getUtcWeekStart(now);
  const monthStart = getUtcMonthStart(now);

  const { data: employees, error: employeesError } = await db
    .from('employees')
    .select('id, full_name, employee_role, store_id, pin_hash, is_active')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (employeesError) {
    return { error: 'Could not load employees for this store.' };
  }

  const employeeRows = (employees ?? []) as EmployeeRow[];
  const employeeIds = employeeRows.map((employee) => employee.id);

  let shiftRows: EmployeeShiftRow[] = [];
  if (employeeIds.length > 0) {
    const { data: shifts, error: shiftsError } = await db
      .from('employee_shifts')
      .select('shift_id, employee_id, store_id, shift_date, clock_in_at, clock_out_at, total_hours')
      .eq('store_id', storeId)
      .gte('shift_date', monthStart)
      .in('employee_id', employeeIds)
      .order('clock_in_at', { ascending: false });

    if (shiftsError) {
      return { error: 'Could not load shift history for this store.' };
    }

    shiftRows = (shifts ?? []) as EmployeeShiftRow[];
  }

  const shiftsByEmployeeId = new Map<string, EmployeeShiftRow[]>();
  for (const shift of shiftRows) {
    const existing = shiftsByEmployeeId.get(shift.employee_id) ?? [];
    existing.push(shift);
    shiftsByEmployeeId.set(shift.employee_id, existing);
  }

  const employeesPayload = employeeRows.map((employee) => {
    const employeeShifts = shiftsByEmployeeId.get(employee.id) ?? [];
    const openShiftToday = employeeShifts.find((shift) => shift.shift_date === today && shift.clock_out_at === null) ?? null;
    const todayHours = roundHours(employeeShifts.filter((shift) => shift.shift_date === today).reduce((sum, shift) => sum + getShiftHours(shift, now), 0));
    const weekHours = roundHours(employeeShifts.filter((shift) => shift.shift_date >= weekStart).reduce((sum, shift) => sum + getShiftHours(shift, now), 0));
    const monthHours = roundHours(employeeShifts.reduce((sum, shift) => sum + getShiftHours(shift, now), 0));

    return {
      employeeId: employee.id,
      name: employee.full_name,
      role: employee.employee_role,
      status: openShiftToday ? 'on_shift' : 'off_shift',
      clockInAt: openShiftToday?.clock_in_at ?? null,
      todayHours,
      weekHours,
      monthHours,
    };
  });

  return {
    data: {
      employees: employeesPayload,
      currentlyOnShift: employeesPayload.filter((employee) => employee.status === 'on_shift').length,
    },
  };
};

const toggleByPin = async (db: ReturnType<typeof createClient>, storeId: string, employeeId: string, pin: string) => {
  if (!employeeId.trim()) {
    return { status: 400, error: 'employeeId is required.' };
  }

  if (!/^\d{6}$/.test(pin.trim())) {
    return { status: 400, error: 'pin must be a valid 6-digit string.' };
  }

  const { data: matchedEmployee, error: employeeError } = await db
    .from('employees')
    .select('id, full_name, employee_role, store_id, pin_hash, is_active')
    .eq('id', employeeId)
    .eq('store_id', storeId)
    .eq('is_active', true);

  if (employeeError) {
    return { status: 500, error: 'Could not validate employee PIN.' };
  }

  const employee = ((matchedEmployee ?? []) as EmployeeRow[])[0] ?? null;
  if (!employee) {
    return { status: 403, error: 'Employee is not active in this store.' };
  }

  const pinMatched = await verifyPin(pin.trim(), employee.pin_hash);
  if (!pinMatched) {
    return { status: 401, error: 'Wrong PIN' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = getUtcDateKey(now);

  const { data: openShiftRows, error: openShiftError } = await db
    .from('employee_shifts')
    .select('shift_id, employee_id, store_id, shift_date, clock_in_at, clock_out_at, total_hours')
    .eq('employee_id', employee.id)
    .eq('shift_date', today)
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1);

  if (openShiftError) {
    return { status: 500, error: 'Could not inspect the current shift state.' };
  }

  const openShift = ((openShiftRows ?? []) as EmployeeShiftRow[])[0] ?? null;

  if (openShift) {
    const totalHours = roundHours((Date.parse(nowIso) - Date.parse(openShift.clock_in_at)) / HOURS_MS);

    const { error: updateShiftError } = await db
      .from('employee_shifts')
      .update({
        clock_out_at: nowIso,
        total_hours: totalHours,
        updated_at: nowIso,
      })
      .eq('shift_id', openShift.shift_id);

    if (updateShiftError) {
      return { status: 500, error: 'Could not clock out this employee.' };
    }

    await db
      .from('employees')
      .update({ shift_status: 'off_shift', updated_at: nowIso })
      .eq('id', employee.id);

    return {
      data: {
        action: 'clock_out',
        shiftId: openShift.shift_id,
        employeeId: employee.id,
        employeeName: employee.full_name,
        employeeRole: employee.employee_role,
      },
    };
  }

  const { data: insertedShift, error: insertShiftError } = await db
    .from('employee_shifts')
    .insert({
    employee_id: employee.id,
      store_id: storeId,
      shift_date: today,
      clock_in_at: nowIso,
      total_hours: 0,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('shift_id')
    .single();

  if (insertShiftError) {
    if (insertShiftError.code === '23505') {
      return { status: 409, error: 'An open shift already exists for this employee today.' };
    }
    return { status: 500, error: 'Could not clock in this employee.' };
  }

  await db
    .from('employees')
    .update({ shift_status: 'on_shift', updated_at: nowIso })
    .eq('id', employee.id);

  return {
    data: {
      action: 'clock_in',
      shiftId: insertedShift.shift_id,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeRole: employee.employee_role,
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
    return json(500, { error: 'Server is not configured for shift control.' });
  }

  let body: InternalShiftControlRequest;
  try {
    body = (await req.json()) as InternalShiftControlRequest;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const tokenResult = extractSessionToken(body);
  if (tokenResult.error || !tokenResult.value) {
    return json(400, { error: tokenResult.error ?? 'Invalid session payload.' });
  }

  const actionResult = normalizeAction(body);
  if (actionResult.error || !actionResult.value) {
    return json(400, { error: actionResult.error ?? 'Invalid shift action.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const verifyResult = await verifyAndLoadSession(db, tokenResult.value);
  if (!verifyResult.valid) {
    return json(401, { error: verifyResult.error });
  }

  const scopeResult = enforceStoreScope(verifyResult.session);
  if (scopeResult.error || !scopeResult.storeId) {
    return json(403, { error: scopeResult.error ?? 'Store scope is required.' });
  }

  if (actionResult.value === 'dashboard') {
    const result = await loadDashboard(db, scopeResult.storeId);
    if ('error' in result) {
      return json(500, { error: result.error });
    }
    return json(200, result.data);
  }

  const result = await toggleByPin(db, scopeResult.storeId, body.employeeId ?? '', body.pin ?? '');
  if ('error' in result) {
    return json(result.status, { error: result.error });
  }

  return json(200, result.data);
});
