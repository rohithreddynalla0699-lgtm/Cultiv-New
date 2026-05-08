// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
// @ts-ignore: Deno remote imports
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { createCustomerSession, extractClientIp } from "../_shared/customer-session.ts";
import { createCorsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.slice(-10);
};

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

const LOGIN_FAILURE_MESSAGE = "Invalid email, phone, or password.";
const LOGIN_LOCKED_MESSAGE = "Too many failed login attempts. Please wait and try again.";
const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MINUTES = 15;

interface LoginRequest {
  identifier?: string; // email or phone
  password?: string;
}

const jsonResponse = (corsHeaders: Record<string, string>, body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256Base64Url = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
};

const verifyPbkdf2Hash = async (password: string, storedHash: string): Promise<boolean> => {
  const [algorithm, iterationsText, saltBase64, hashBase64] = storedHash.split("$");
  if (algorithm !== "pbkdf2" || !iterationsText || !saltBase64 || !hashBase64) {
    return false;
  }

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = base64ToBytes(saltBase64);
  const expectedHash = base64ToBytes(hashBase64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    expectedHash.length * 8
  );
  const actualHash = new Uint8Array(derivedBits);

  return constantTimeEqual(actualHash, expectedHash);
};

interface LoginResponse {
  success: boolean;
  message: string;
  customer_id?: string;
  customer_session_token?: string;
  customer_session_expires_at?: string;
  customer?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    reward_points: number;
    phone_verified: boolean;
    email_verified: boolean;
  };
}

const LOGIN_VERIFICATION_REQUIRED_MESSAGE = "Verify your phone number to finish setting up your CULTIV account.";

const buildNormalizedIdentifier = (identifier: string) => {
  const normalizedPhone = normalizePhone(identifier);
  if (normalizedPhone.length === 10) {
    return normalizedPhone;
  }
  return normalizeEmail(identifier);
};

const loadAttemptState = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const { data } = await db
    .from("customer_auth_attempts")
    .select("failure_count, locked_until, last_failed_at")
    .eq("attempt_key", attemptKey)
    .maybeSingle();

  return data ?? null;
};

const getNextFailureState = (existing: { failure_count?: number | null; locked_until?: string | null; last_failed_at?: string | null } | null) => {
  const now = Date.now();
  const shouldResetWindow = Boolean(
    existing?.last_failed_at
      && now - new Date(existing.last_failed_at).getTime() > LOCK_WINDOW_MINUTES * 60 * 1000
  );
  const lockExpired = Boolean(
    existing?.locked_until
      && new Date(existing.locked_until).getTime() <= now
  );
  const baselineCount = (!existing || shouldResetWindow || lockExpired)
    ? 0
    : Number(existing.failure_count ?? 0);
  const nextFailureCount = baselineCount + 1;
  const lockedUntil = nextFailureCount >= LOCK_THRESHOLD
    ? new Date(now + LOCK_WINDOW_MINUTES * 60 * 1000).toISOString()
    : null;

  return {
    nextFailureCount,
    lockedUntil,
    startsNewWindow: !existing || shouldResetWindow || lockExpired,
  };
};

const registerFailedAttempt = async (
  db: ReturnType<typeof createClient>,
  attemptKey: string,
  attemptScope: "login_ip" | "login_identifier",
) => {
  const existing = await loadAttemptState(db, attemptKey);
  const { nextFailureCount, lockedUntil, startsNewWindow } = getNextFailureState(existing);
  const nowIso = new Date().toISOString();

  await db
    .from("customer_auth_attempts")
    .upsert({
      attempt_key: attemptKey,
      attempt_scope: attemptScope,
      failure_count: nextFailureCount,
      first_failed_at: startsNewWindow ? nowIso : undefined,
      last_failed_at: nowIso,
      locked_until: lockedUntil,
      updated_at: nowIso,
    });

  return { nextFailureCount, lockedUntil };
};

const clearFailedAttempts = async (db: ReturnType<typeof createClient>, attemptKeys: string[]) => {
  const uniqueAttemptKeys = Array.from(new Set(attemptKeys.filter(Boolean)));
  if (uniqueAttemptKeys.length === 0) return;

  await db
    .from("customer_auth_attempts")
    .delete()
    .in("attempt_key", uniqueAttemptKeys);
};

serve(async (req: any) => {
  try {
    const corsHeaders = createCorsHeaders(req, {
      allowedHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
    });

    if (req.method === "OPTIONS") {
      return jsonResponse(corsHeaders, { success: true }, 200);
    }

    if (req.method !== "POST") {
      return jsonResponse(corsHeaders, { success: false, message: "Method not allowed" }, 405);
    }

    const body: LoginRequest = await req.json();
    const { identifier, password } = body;


    // Validate required fields
    if (!identifier || !identifier.trim()) {
      return jsonResponse(corsHeaders, {
        success: false,
        message: "Email or phone number is required.",
      }, 400);
    }

    if (!password || !password.trim()) {
      return jsonResponse(corsHeaders, {
        success: false,
        message: "Password is required.",
      }, 400);
    }

    // Create service-role client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const clientIp = extractClientIp(req) ?? "unknown";
    const normalizedIdentifier = buildNormalizedIdentifier(identifier);
    const identifierHash = await sha256Base64Url(normalizedIdentifier);
    const ipAttemptKey = `customer_login_ip:${clientIp}`;
    const identifierAttemptKey = `customer_login_identifier:${identifierHash}`;

    const [ipAttemptState, identifierAttemptState] = await Promise.all([
      loadAttemptState(supabase, ipAttemptKey),
      loadAttemptState(supabase, identifierAttemptKey),
    ]);

    const isLocked = [ipAttemptState, identifierAttemptState].some(
      (attemptState) => attemptState?.locked_until && new Date(attemptState.locked_until).getTime() > Date.now(),
    );

    if (isLocked) {
      return jsonResponse({
        success: false,
        message: LOGIN_LOCKED_MESSAGE,
      }, 429);
    }

    // Try to find customer by phone or email
    let customer = null;

    // First try as phone
    const normalizedPhone = normalizePhone(identifier);

    if (normalizedPhone.length === 10) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, password_hash, reward_points, phone_verified, email_verified, is_active, phone_verification_required")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error) {
        console.error("[customer-login] phone lookup error:", error);
      } else if (data) {
        customer = data;
      }
    }

    // If not found by phone, try by email
    if (!customer) {
      const normalizedEmail = normalizeEmail(identifier);
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, password_hash, reward_points, phone_verified, email_verified, is_active, phone_verification_required")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error("[customer-login] email lookup error:", error);
      } else if (data) {
        customer = data;
      }
    }


    // Customer not found
    if (!customer) {
      await Promise.all([
        registerFailedAttempt(supabase, ipAttemptKey, "login_ip"),
        registerFailedAttempt(supabase, identifierAttemptKey, "login_identifier"),
      ]);
      return jsonResponse({
        success: false,
        message: LOGIN_FAILURE_MESSAGE,
      }, 401);
    }


    const storedPasswordHash = customer.password_hash || "";
    const passwordMatches = storedPasswordHash.startsWith("pbkdf2$")
      ? await verifyPbkdf2Hash(password, storedPasswordHash)
      : await compare(password, storedPasswordHash);


    if (!passwordMatches) {
      await Promise.all([
        registerFailedAttempt(supabase, ipAttemptKey, "login_ip"),
        registerFailedAttempt(supabase, identifierAttemptKey, "login_identifier"),
      ]);
      return jsonResponse({
        success: false,
        message: LOGIN_FAILURE_MESSAGE,
      }, 401);
    }

    if (customer.is_active === false) {
      return jsonResponse({
        success: false,
        message: LOGIN_FAILURE_MESSAGE,
      }, 401);
    }

    if (customer.phone_verification_required === true) {
      return jsonResponse({
        success: false,
        message: LOGIN_VERIFICATION_REQUIRED_MESSAGE,
        requires_verification: true,
      }, 403);
    }

    await clearFailedAttempts(supabase, [ipAttemptKey, identifierAttemptKey]);

    let customerSession;
    try {
      customerSession = await createCustomerSession(supabase, customer.id, req);
    } catch (sessionError) {
      console.error("[customer-login] customer session create failed", sessionError);
      return jsonResponse({
        success: false,
        message: "Could not start your customer session right now. Please try again.",
      }, 500);
    }

    const response: LoginResponse = {
      success: true,
      message: "Welcome back to your CULTIV routine.",
      customer_id: customer.id,
      customer_session_token: customerSession.token,
      customer_session_expires_at: customerSession.expiresAtIso,
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        reward_points: customer.reward_points || 0,
        phone_verified: customer.phone_verified || false,
        email_verified: customer.email_verified || false,
      },
    };

    return jsonResponse(response as unknown as Record<string, unknown>, 200);
  } catch (err) {
    console.error("[customer-login] unexpected error:", err);
    return jsonResponse({
      success: false,
      message: "Could not log in right now. Please try again.",
    }, 500);
  }
});
