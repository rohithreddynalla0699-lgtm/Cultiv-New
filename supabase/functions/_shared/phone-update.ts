// @ts-nocheck

const normalizePhone = (phone: string): string => {
  const cleaned = (phone ?? '').replace(/\D/g, '');
  return cleaned;
};

const isValidPhone = (phone: string): boolean => {
  return /^\d{10}$/.test(phone);
};

const formatSmsDestination = (normalizedPhone: string): string => `+91${normalizedPhone}`;

const generateOtpCode = (): string => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const numeric = values[0] % 1000000;
  return numeric.toString().padStart(6, '0');
};

const toHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const getHmacKey = async (): Promise<CryptoKey> => {
  const secret = Deno.env.get('OTP_HASH_SECRET') ?? 'cultiv-dev-otp-secret';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
};

const hashOtp = async (otpCode: string): Promise<string> => {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(otpCode));
  return toHex(signature);
};

const compareHashes = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const verifyOtp = async (otpCode: string, expectedHash: string): Promise<boolean> => {
  const actualHash = await hashOtp(otpCode);
  return compareHashes(actualHash, expectedHash);
};

const sendSms = async (normalizedPhone: string, message: string): Promise<void> => {
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');
  const destination = formatSmsDestination(normalizedPhone);

  if (twilioAccountSid && twilioAuthToken && twilioFrom) {
    const formBody = new URLSearchParams();
    formBody.set('To', destination);
    formBody.set('From', twilioFrom);
    formBody.set('Body', message);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`SMS provider error: ${response.status} ${response.statusText} - ${responseText}`);
    }
    return;
  }

  console.log(`[DEV SMS] OTP send to ${destination}: ${message}`);
};

export {
  normalizePhone,
  isValidPhone,
  formatSmsDestination,
  generateOtpCode,
  hashOtp,
  verifyOtp,
  sendSms,
};
