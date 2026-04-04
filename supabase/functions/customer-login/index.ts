// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
// @ts-ignore: Deno remote imports
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

declare const Deno: any;

const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.slice(-10);
};

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

interface LoginRequest {
  identifier?: string; // email or phone
  password?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
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

const toBase64Url = (value: string | Uint8Array): string => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const createCustomerSessionToken = async (
  customer: { id: string; email: string; phone: string },
  signingSecret: string,
): Promise<{ token: string; expiresAtIso: string }> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expirySeconds = nowSeconds + (60 * 60 * 24 * 7);
  const payload = {
    customer_id: customer.id,
    email: customer.email,
    phone: customer.phone,
    iat: nowSeconds,
    exp: expirySeconds,
    iss: "cultiv-customer-auth",
  };

  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadBase64),
  );
  const signatureBase64 = toBase64Url(new Uint8Array(signatureBuffer));

  return {
    token: `${payloadBase64}.${signatureBase64}`,
    expiresAtIso: new Date(expirySeconds * 1000).toISOString(),
  };
};

serve(async (req: any) => {
  try {

    if (req.method === "OPTIONS") {
      return jsonResponse({ success: true }, 200);
    }

    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const body: LoginRequest = await req.json();
    const { identifier, password } = body;


    // Validate required fields
    if (!identifier || !identifier.trim()) {
      return jsonResponse({
        success: false,
        message: "Email or phone number is required.",
      }, 400);
    }

    if (!password || !password.trim()) {
      return jsonResponse({
        success: false,
        message: "Password is required.",
      }, 400);
    }

    // Create service-role client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Try to find customer by phone or email
    let customer = null;
    let findError = null;

    // First try as phone
    const normalizedPhone = normalizePhone(identifier);
    const normalizedIdentifier = normalizedPhone.length === 10
      ? normalizedPhone
      : normalizeEmail(identifier);


    if (normalizedPhone.length === 10) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, password_hash, reward_points, phone_verified, email_verified")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error) {
        console.error("[customer-login] phone lookup error:", error);
        findError = error;
      } else if (data) {
        customer = data;
      }
    }

    // If not found by phone, try by email
    if (!customer) {
      const normalizedEmail = normalizeEmail(identifier);
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, password_hash, reward_points, phone_verified, email_verified")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error("[customer-login] email lookup error:", error);
        findError = error;
      } else if (data) {
        customer = data;
      }
    }


    // Customer not found
    if (!customer) {
      return jsonResponse({
        success: false,
        message: "Invalid email, phone, or password.",
      }, 401);
    }


    const storedPasswordHash = customer.password_hash || "";
    const passwordMatches = storedPasswordHash.startsWith("pbkdf2$")
      ? await verifyPbkdf2Hash(password, storedPasswordHash)
      : await compare(password, storedPasswordHash);


    if (!passwordMatches) {
      return jsonResponse({
        success: false,
        message: "Invalid email, phone, or password.",
      }, 401);
    }

    // Success - return customer profile
    const signingSecret = Deno.env.get("CUSTOMER_SESSION_SIGNING_SECRET") || "";
    if (!signingSecret) {
      console.error("[customer-login] CUSTOMER_SESSION_SIGNING_SECRET is missing");
      return jsonResponse({
        success: false,
        message: "Customer session configuration is missing. Please contact support.",
      }, 500);
    }

    const customerSession = await createCustomerSessionToken(
      {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
      },
      signingSecret,
    );

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
