// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
// @ts-ignore: Deno remote imports
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { generateOtpCode, hashOtp, sendSms } from "../_shared/phone-update.ts";

declare const Deno: any;

const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.slice(-10);
};

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

interface SignupRequest {
  full_name?: string;
  phone?: string;
  email?: string;
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

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BITS = 256;
const OTP_EXPIRY_MS = 2 * 60 * 1000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const createPbkdf2Hash = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
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
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_HASH_BITS
  );
  const hashBytes = new Uint8Array(derivedBits);

  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hashBytes)}`;
};

serve(async (req: any) => {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse({ success: true }, 200);
    }

    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const body: SignupRequest = await req.json();
    const { full_name, phone, email, password } = body;

    // Validate required fields
    if (!full_name || !full_name.trim()) {
      return jsonResponse({
        success: false,
        message: "Full name is required.",
      }, 400);
    }

    if (!phone || !phone.trim()) {
      return jsonResponse({
        success: false,
        message: "Phone number is required.",
      }, 400);
    }

    if (!email || !email.trim()) {
      return jsonResponse({
        success: false,
        message: "Email is required.",
      }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse({
        success: false,
        message: "Password must be at least 6 characters.",
      }, 400);
    }

    // Normalize inputs
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = normalizeEmail(email);

    if (normalizedPhone.length !== 10) {
      return jsonResponse({
        success: false,
        message: "Phone number must be 10 digits.",
      }, 400);
    }


    let passwordHash = "";

    try {
      passwordHash = await hash(password);
    } catch (err) {
      console.error("[customer-signup] bcrypt hash failed", err);

      try {
        passwordHash = await createPbkdf2Hash(password);
      } catch (fallbackErr) {
        console.error("[customer-signup] fallback hash failed", fallbackErr);
        return jsonResponse({
          success: false,
          message: "password hashing failed",
          error: String((fallbackErr as { message?: string } | null)?.message ?? fallbackErr),
        }, 500);
      }
    }

    // Create service-role client to insert into customers
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );


    const nowIso = new Date().toISOString();
    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const verificationExpiresAtIso = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

    // Insert into customers table (password_hash column)
    const { data: insertedCustomer, error: insertError } = await supabase
      .from("customers")
      .insert({
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: passwordHash,
        phone_verified: false,
        phone_verification_required: true,
        is_active: true,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      // Check for unique constraint violations
      const errorMessage = (insertError.message || "").toLowerCase();
      const errorCode = insertError.code || "";
      const isUniqueViolation =
        errorCode === "23505" ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint");

      if (isUniqueViolation) {

        const [phoneLookup, emailLookup] = await Promise.all([
          supabase
            .from("customers")
            .select("id")
            .eq("phone", normalizedPhone)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("customers")
            .select("id")
            .eq("email", normalizedEmail)
            .limit(1)
            .maybeSingle(),
        ]);

        if (phoneLookup.error) {
          console.error("[customer-signup] phone conflict lookup error:", phoneLookup.error);
        }
        if (emailLookup.error) {
          console.error("[customer-signup] email conflict lookup error:", emailLookup.error);
        }

        const phoneExists = Boolean(phoneLookup.data?.id);
        const emailExists = Boolean(emailLookup.data?.id);


        let code = "SIGNUP_CONFLICT";
        let message = "We could not create your account right now. Please try again.";

        if (phoneExists && emailExists) {
          code = "ACCOUNT_EXISTS";
          message = "An account already exists. Please sign in.";
        } else if (phoneExists) {
          code = "PHONE_EXISTS";
          message = "An account with this phone number already exists. Please sign in.";
        } else if (emailExists) {
          code = "EMAIL_EXISTS";
          message = "An account with this email already exists. Please sign in.";
        }


        return jsonResponse({
          success: false,
          code,
          message,
        }, 409);
      }

      console.error("[customer-signup] insert error:", insertError);
      return jsonResponse({
        success: false,
        message:
          "Could not create your CULTIV profile right now. Please try again.",
      }, 500);
    }

    if (!insertedCustomer?.id) {
      return jsonResponse({
        success: false,
        message: "Could not create your CULTIV profile right now. Please try again.",
      }, 500);
    }

    const { data: verificationRequest, error: verificationInsertError } = await supabase
      .from("customer_signup_verification_requests")
      .insert({
        customer_id: insertedCustomer.id,
        phone_normalized: normalizedPhone,
        otp_hash: otpHash,
        status: "pending",
        requested_at: nowIso,
        expires_at: verificationExpiresAtIso,
        last_otp_sent_at: nowIso,
        otp_attempts: 0,
        resend_attempts: 0,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .maybeSingle();

    if (verificationInsertError || !verificationRequest?.id) {
      console.error("[customer-signup] verification request insert failed", verificationInsertError);
      await supabase.from("customers").delete().eq("id", insertedCustomer.id);
      return jsonResponse({
        success: false,
        message: "Could not start phone verification right now. Please try again.",
      }, 500);
    }

    try {
      await sendSms(normalizedPhone, `Your CULTIV verification code is ${otpCode}`);
    } catch (smsError) {
      console.error("[customer-signup] signup verification SMS send failed", smsError);
      await supabase.from("customer_signup_verification_requests").delete().eq("id", verificationRequest.id);
      await supabase.from("customers").delete().eq("id", insertedCustomer.id);
      return jsonResponse({
        success: false,
        message: "Could not send your verification code right now. Please try again.",
      }, 500);
    }

    return jsonResponse({
      success: true,
      customerId: insertedCustomer.id,
      verification_request_id: verificationRequest.id,
      verification_expires_at: verificationExpiresAtIso,
      message: "Enter the verification code sent to your phone to finish creating your account.",
    }, 201);
  } catch (err) {
    console.error("[customer-signup] unexpected error:", err);
    return jsonResponse({
      success: false,
      message: "customer-signup crashed",
      error: String((err as { message?: string } | null)?.message ?? err),
    }, 500);
  }
});
