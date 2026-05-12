// @ts-nocheck

export type EmailProviderName = 'resend';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProviderResult {
  success: boolean;
  provider: EmailProviderName;
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

const normalizeEnv = (value: string | undefined | null) => String(value ?? '').trim();

const readResendConfig = () => {
  const apiKey = normalizeEnv(Deno.env.get('RESEND_API_KEY'));
  const fromAddress = normalizeEnv(Deno.env.get('EMAIL_FROM_ADDRESS'));

  if (!apiKey || !fromAddress) {
    return {
      configured: false as const,
      apiKey,
      fromAddress,
    };
  }

  return {
    configured: true as const,
    apiKey,
    fromAddress,
  };
};

const safeProviderErrorMessage = (status: number) => {
  if (status === 401 || status === 403) {
    return 'Email provider credentials were rejected.';
  }

  if (status === 429) {
    return 'Email provider rate limited the request.';
  }

  if (status >= 500) {
    return 'Email provider is temporarily unavailable.';
  }

  return 'Email provider rejected the request.';
};

export async function sendEmailViaProvider(
  payload: TransactionalEmailPayload,
): Promise<EmailProviderResult> {
  const provider: EmailProviderName = 'resend';
  const config = readResendConfig();

  if (!config.configured) {
    return {
      success: false,
      provider,
      errorCode: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      errorMessage: 'Email delivery is not configured for this environment.',
    };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        provider,
        errorCode: 'EMAIL_SEND_FAILED',
        errorMessage: safeProviderErrorMessage(response.status),
      };
    }

    return {
      success: true,
      provider,
      messageId: typeof responseBody?.id === 'string' ? responseBody.id : null,
    };
  } catch (error) {
    return {
      success: false,
      provider,
      errorCode: 'EMAIL_SEND_FAILED',
      errorMessage: error instanceof Error
        ? `Email request failed: ${error.message}`
        : 'Email request failed unexpectedly.',
    };
  }
}
