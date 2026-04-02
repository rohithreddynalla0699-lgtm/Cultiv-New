/**
 * CULTIV Store Employee Session Model
 * 
 * Tracks the active employee operating a terminal/device for a store.
 * This session is created when an employee successfully clocks in via ShiftTerminal,
 * and cleared when they clock out or log out.
 * 
 * The session is the source of truth for "who is performing operations right now"
 * and flows into POS (placed_by), Orders Board (updated_by), Inventory (performed_by).
 */

// Core employee session identity
export interface StoreEmployeeSession {
  // Unique session ID (generated at shift start)
  session_id: string;

  // Employee identity
  employee_id: string;
  employee_name: string;
  employee_role: 'staff' | 'store_manager';

  // Store scope (employee can only operate within allowed stores)
  store_id: string;
  store_name: string;

  // Shift tracking
  shift_id: string; // Foreign key to shifts table
  clocked_in_at: string; // ISO 8601 timestamp
  clocked_out_at: string | null; // null until shift ends

  // Session lifecycle
  session_started_at: string; // ISO 8601 timestamp
  session_expires_at: string; // ISO 8601 timestamp (auto-logout)
  last_activity_at: string; // ISO 8601 timestamp (for inactivity tracking)

  // Session status
  is_active: boolean; // true while employee is on shift
  is_locked: boolean; // true if terminal was locked/suspended

  // Device/terminal info (optional, for audit)
  device_id?: string;
  device_name?: string;
}

// Result of session creation (after successful shift start)
export interface CreateEmployeeSessionResult {
  success: boolean;
  session?: StoreEmployeeSession;
  error?: string;
}

// Result of session termination (after shift end or logout)
export interface EndEmployeeSessionResult {
  success: boolean;
  session?: StoreEmployeeSession;
  error?: string;
}

// Query result for fetching current session
export interface GetCurrentSessionResult {
  success: boolean;
  session?: StoreEmployeeSession | null;
  error?: string;
}

// For updating last activity time
export interface TouchSessionResult {
  success: boolean;
  last_activity_at?: string;
  error?: string;
}

// Context value shape
export interface StoreSessionContextValue {
  // Current active session (null if no one logged in)
  session: StoreEmployeeSession | null;

  // State
  isSessionLoading: boolean;
  sessionError: string | null;
  isExpiringSoon: boolean;

  // Actions
  initializeSession: () => Promise<void>; // Call on app mount to check persistent session
  createSession: (
    employeeId: string,
    employeeName: string,
    employeeRole: 'staff' | 'store_manager',
    storeId: string,
    storeName: string,
    shiftId: string
  ) => Promise<CreateEmployeeSessionResult>;

  endSession: () => Promise<EndEmployeeSessionResult>;

  touchSession: () => Promise<void>; // Update last_activity_at on user interaction

  clearSession: () => void; // Synchronous clear (e.g., logout)

  // Helpers
  hasActiveSession: boolean; // true if session && session.is_active
  isOperatingInStore: (storeId: string) => boolean; // Check if session is for this store
  canPerformAction: () => boolean; // true if hasActiveSession && !isLocked
}

// Auth-level employee info (from PIN resolution, stored temporarily)
export interface AuthenticatedEmployee {
  employee_id: string;
  name: string;
  role: 'staff' | 'store_manager';
  allowed_store_ids: string[];
  is_active: boolean;
}

// Session storage key for persistence (optional, for device memory)
export const STORE_SESSION_STORAGE_KEY = 'cultiv_store_employee_session';

// Session expiry duration (12 hours for shift worker)
export const SESSION_EXPIRY_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Inactivity timeout (30 minutes without interaction, then auto-logout)
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Warning threshold before auto-logout
export const SESSION_EXPIRING_WARNING_MS = 5 * 60 * 1000; // 5 minutes before timeout
