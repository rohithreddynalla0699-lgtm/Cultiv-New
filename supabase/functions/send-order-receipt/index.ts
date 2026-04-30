// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadAuthorizedReceipt } from '../_shared/receipt-data.ts';

type DeliveryMethod = 'print' | 'email' | 'text' | 'all';
type DigitalMethod = 'email' | 'text';
type AuditDeliveryMethod = 'email' | 'sms';

interface SendOrderReceiptRequest {
  orderId?: string;
  deliveryMethod?: DeliveryMethod;
  email?: string;
  phone?: string;
  customerSessionToken?: string;
  internalSessionToken?: string;
}

interface DeliveryResult {
  method: DigitalMethod;
  success: boolean;
  recipient: string | null;
  provider: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOULD_LOG_FAILURES = Deno.env.get('APP_ENV') !== 'production';

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const roundMoney = (value: number) => Number((value ?? 0).toFixed(2));

const formatCurrency = (value: number) => `Rs ${roundMoney(value).toFixed(2)}`;

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
};

const toPaymentLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'upi') return 'UPI';
  if (normalized === 'card') return 'Card';
  if (normalized === 'cash') return 'Cash';
  return value || 'Recorded';
};

const normalizeEmail = (value: string | undefined | null) => {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
};

const normalizePhone = (value: string | undefined | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
};

const getEmailProvider = () => {
  const provider = String(Deno.env.get('RECEIPT_EMAIL_PROVIDER') ?? '').trim().toLowerCase();
  if (!provider) return null;
  if (provider === 'resend' || provider === 'sendgrid') return provider;
  return null;
};

const getSmsProvider = () => {
  const provider = String(Deno.env.get('RECEIPT_SMS_PROVIDER') ?? '').trim().toLowerCase();
  if (!provider) return null;
  if (provider === 'twilio') return provider;
  return null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderReceiptEmailHtml(receipt: any) {
  const itemRows = receipt.items.map((item: any) => {
    const selections = (item.selections ?? []).map((selection: any) =>
      `<div style="font-size:12px;color:#667085;margin-top:4px;"><strong>${escapeHtml(selection.section)}:</strong> ${escapeHtml(selection.choices.join(', '))}</div>`
    ).join('');

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef2e8;">
          <div style="font-weight:600;color:#1d2939;">${escapeHtml(item.title)}</div>
          ${selections}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eef2e8;text-align:right;color:#344054;">${item.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eef2e8;text-align:right;color:#344054;">${formatCurrency(item.price)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eef2e8;text-align:right;font-weight:600;color:#1d2939;">${formatCurrency(item.lineTotal ?? item.price * item.quantity)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#f6f8f2;padding:24px;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5ebdd;border-radius:20px;overflow:hidden;">
        <div style="padding:24px 24px 16px;text-align:center;border-bottom:1px solid #eef2e8;">
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#15230f;">CULTIV</div>
          <div style="margin-top:8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6d7c62;">${escapeHtml(receipt.business.storeName || 'Modern Bowls. Honest Food.')}</div>
          <div style="margin-top:12px;font-size:13px;color:#667085;line-height:1.6;">
            ${receipt.business.legalName ? `<div style="font-weight:600;color:#344054;">${escapeHtml(receipt.business.legalName)}</div>` : ''}
            ${receipt.business.addressLine1 ? `<div>${escapeHtml([receipt.business.addressLine1, receipt.business.addressLine2].filter(Boolean).join(', '))}</div>` : ''}
            <div>${escapeHtml([receipt.business.city, receipt.business.state, receipt.business.postalCode].filter(Boolean).join(', '))}</div>
            ${receipt.business.phone ? `<div>Phone: ${escapeHtml(receipt.business.phone)}</div>` : ''}
            ${receipt.business.gstin ? `<div>GSTIN: ${escapeHtml(receipt.business.gstin)}</div>` : ''}
          </div>
        </div>
        <div style="padding:24px;">
          <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:13px;color:#475467;">
            <div><strong>Receipt #</strong> ${escapeHtml(receipt.meta.orderNumber)}</div>
            <div><strong>Date/Time</strong> ${escapeHtml(formatDate(receipt.meta.createdAt))}</div>
            <div><strong>Payment</strong> ${escapeHtml(toPaymentLabel(receipt.meta.paymentMethod))}</div>
          </div>
          <table style="width:100%;margin-top:20px;border-collapse:collapse;">
            <thead>
              <tr style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#6d7c62;text-align:left;">
                <th style="padding-bottom:8px;">Item</th>
                <th style="padding-bottom:8px;text-align:right;">Qty</th>
                <th style="padding-bottom:8px;text-align:right;">Unit</th>
                <th style="padding-bottom:8px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="margin-top:20px;border-top:1px solid #eef2e8;padding-top:16px;font-size:14px;color:#344054;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Subtotal</span><strong>${formatCurrency(receipt.totals.subtotal)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Discount</span><strong>${formatCurrency(receipt.totals.discount)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>GST</span><strong>${formatCurrency(receipt.totals.tax)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Tip</span><strong>${formatCurrency(receipt.totals.tip)}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:18px;color:#15230f;"><span>Total</span><strong>${formatCurrency(receipt.totals.total)}</strong></div>
          </div>
          <p style="margin-top:24px;font-size:13px;line-height:1.6;color:#667085;">Thank you for choosing CULTIV. We appreciate your order and look forward to serving you again.</p>
        </div>
      </div>
    </div>
  `;
}

function renderReceiptEmailText(receipt: any) {
  const lines = [
    `CULTIV receipt #${receipt.meta.orderNumber}`,
    `Date: ${formatDate(receipt.meta.createdAt)}`,
    `Store: ${receipt.business.storeName || 'CULTIV'}`,
    '',
    ...receipt.items.map((item: any) => `- ${item.title} x${item.quantity} ${formatCurrency(item.lineTotal ?? item.price * item.quantity)}`),
    '',
    `Subtotal: ${formatCurrency(receipt.totals.subtotal)}`,
    `Discount: ${formatCurrency(receipt.totals.discount)}`,
    `GST: ${formatCurrency(receipt.totals.tax)}`,
    `Tip: ${formatCurrency(receipt.totals.tip)}`,
    `Total: ${formatCurrency(receipt.totals.total)}`,
    `Payment: ${toPaymentLabel(receipt.meta.paymentMethod)}`,
    '',
    'Thank you for choosing CULTIV.',
  ];
  return lines.join('\n');
}

function renderReceiptSmsText(receipt: any) {
  return `CULTIV receipt #${receipt.meta.orderNumber}: Total ${formatCurrency(receipt.totals.total)}. Paid by ${toPaymentLabel(receipt.meta.paymentMethod)}. Thank you!`;
}

async function logDeliveryAttempt(params: {
  db: ReturnType<typeof createClient>;
  orderId: string;
  method: AuditDeliveryMethod;
  recipient: string | null;
  success: boolean;
  provider: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}) {
  const status = params.success ? 'success' : 'failed';
  const { error } = await params.db.from('receipt_deliveries').insert({
    order_id: params.orderId,
    delivery_method: params.method,
    recipient: params.recipient,
    status,
    provider: params.provider ?? 'none',
    error_code: params.errorCode,
    error_message: params.errorMessage,
    sent_at: params.success ? new Date().toISOString() : null,
  });

  if (error && SHOULD_LOG_FAILURES) {
    console.error('[send-order-receipt] failed to write receipt_deliveries row', {
      orderId: params.orderId,
      method: params.method,
      status,
      recipient: params.recipient,
      errorCode: params.errorCode,
      insertError: error.message,
    });
  }
}

async function sendEmailReceipt(params: {
  receipt: any;
  recipient: string | null;
}): Promise<DeliveryResult> {
  const provider = getEmailProvider();
  if (!params.recipient) {
    return {
      method: 'email',
      success: false,
      recipient: null,
      provider,
      errorCode: 'MISSING_RECIPIENT',
      errorMessage: 'Email address is required for email receipt delivery.',
    };
  }
  if (!provider) {
    return {
      method: 'email',
      success: false,
      recipient: params.recipient,
      provider: null,
      errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
      errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
    };
  }

  const fromEmail = String(Deno.env.get('RECEIPT_FROM_EMAIL') ?? '').trim();
  if (!fromEmail) {
    return {
      method: 'email',
      success: false,
      recipient: params.recipient,
      provider,
      errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
      errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
    };
  }

  const subject = `CULTIV receipt #${params.receipt.meta.orderNumber}`;
  const html = renderReceiptEmailHtml(params.receipt);
  const text = renderReceiptEmailText(params.receipt);

  try {
    if (provider === 'resend') {
      const apiKey = String(Deno.env.get('RESEND_API_KEY') ?? '').trim();
      if (!apiKey) {
        return {
          method: 'email',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
          errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
        };
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.recipient],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          method: 'email',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'EMAIL_SEND_FAILED',
          errorMessage: `Email provider rejected the receipt request (${response.status}).`,
        };
      }
    } else if (provider === 'sendgrid') {
      const apiKey = String(Deno.env.get('SENDGRID_API_KEY') ?? '').trim();
      if (!apiKey) {
        return {
          method: 'email',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
          errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
        };
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: { email: fromEmail, name: 'CULTIV' },
          personalizations: [{ to: [{ email: params.recipient }] }],
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });

      if (!response.ok) {
        return {
          method: 'email',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'EMAIL_SEND_FAILED',
          errorMessage: `Email provider rejected the receipt request (${response.status}).`,
        };
      }
    }

    return {
      method: 'email',
      success: true,
      recipient: params.recipient,
      provider,
      errorCode: null,
      errorMessage: null,
    };
  } catch {
    return {
      method: 'email',
      success: false,
      recipient: params.recipient,
      provider,
      errorCode: 'EMAIL_SEND_FAILED',
      errorMessage: 'Could not send email receipt right now.',
    };
  }
}

async function sendSmsReceipt(params: {
  receipt: any;
  recipient: string | null;
}): Promise<DeliveryResult> {
  const provider = getSmsProvider();
  if (!params.recipient) {
    return {
      method: 'text',
      success: false,
      recipient: null,
      provider,
      errorCode: 'MISSING_RECIPIENT',
      errorMessage: 'Phone number is required for text receipt delivery.',
    };
  }
  if (!provider) {
    return {
      method: 'text',
      success: false,
      recipient: params.recipient,
      provider: null,
      errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
      errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
    };
  }

  try {
    if (provider === 'twilio') {
      const sid = String(Deno.env.get('TWILIO_ACCOUNT_SID') ?? '').trim();
      const token = String(Deno.env.get('TWILIO_AUTH_TOKEN') ?? '').trim();
      const fromPhone = String(Deno.env.get('TWILIO_FROM_PHONE') ?? '').trim();
      if (!sid || !token || !fromPhone) {
        return {
          method: 'text',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'DIGITAL_RECEIPT_PROVIDER_NOT_CONFIGURED',
          errorMessage: 'Digital receipt delivery is not configured yet. Please print the receipt.',
        };
      }

      const authHeader = btoa(`${sid}:${token}`);
      const body = new URLSearchParams({
        To: params.recipient.startsWith('+') ? params.recipient : `+91${params.recipient}`,
        From: fromPhone,
        Body: renderReceiptSmsText(params.receipt),
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        return {
          method: 'text',
          success: false,
          recipient: params.recipient,
          provider,
          errorCode: 'SMS_SEND_FAILED',
          errorMessage: `SMS provider rejected the receipt request (${response.status}).`,
        };
      }
    }

    return {
      method: 'text',
      success: true,
      recipient: params.recipient,
      provider,
      errorCode: null,
      errorMessage: null,
    };
  } catch {
    return {
      method: 'text',
      success: false,
      recipient: params.recipient,
      provider,
      errorCode: 'SMS_SEND_FAILED',
      errorMessage: 'Could not send text receipt right now.',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server is not configured for receipt delivery.' });
  }

  let body: SendOrderReceiptRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const orderId = String(body.orderId ?? '').trim();
  const deliveryMethod = String(body.deliveryMethod ?? '').trim() as DeliveryMethod;
  const customerSessionToken = String(body.customerSessionToken ?? '').trim() || null;
  const internalSessionToken = String(body.internalSessionToken ?? '').trim() || null;

  if (!orderId) {
    return json(400, { success: false, code: 'INVALID_REQUEST', error: 'orderId is required.' });
  }
  if (!deliveryMethod || !['print', 'email', 'text', 'all'].includes(deliveryMethod)) {
    return json(400, { success: false, code: 'INVALID_REQUEST', error: 'deliveryMethod is required.' });
  }
  if (!customerSessionToken && !internalSessionToken) {
    return json(401, { success: false, code: 'INVALID_SESSION', error: 'A customer or internal session token is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let receipt;
  try {
    const result = await loadAuthorizedReceipt({
      db,
      orderId,
      customerSessionToken,
      internalSessionToken,
    });
    receipt = result.receipt;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load receipt.';
    if (/expired|revoked|not found|required/i.test(message) && /session/i.test(message)) {
      return json(401, { success: false, code: 'INVALID_SESSION', error: message });
    }
    if (/does not belong|scope does not allow/i.test(message)) {
      return json(403, { success: false, code: 'FORBIDDEN', error: message });
    }
    if (/Order not found/i.test(message)) {
      return json(404, { success: false, code: 'ORDER_NOT_FOUND', error: message });
    }
    return json(500, { success: false, code: 'RECEIPT_LOAD_FAILED', error: message });
  }

  const attempts: DeliveryResult[] = [];
  const normalizedEmail = normalizeEmail(body.email);
  const normalizedPhone = normalizePhone(body.phone);

  if (deliveryMethod === 'email' || deliveryMethod === 'all') {
    const emailRecipient = normalizedEmail || normalizeEmail(receipt.meta.customerEmail);
    let emailAttempt: DeliveryResult;
    try {
      emailAttempt = await sendEmailReceipt({
        receipt,
        recipient: emailRecipient,
      });
    } catch (error) {
      emailAttempt = {
        method: 'email',
        success: false,
        recipient: emailRecipient,
        provider: getEmailProvider(),
        errorCode: 'UNKNOWN_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unexpected error while sending email receipt.',
      };
      if (SHOULD_LOG_FAILURES) {
        console.error('[send-order-receipt] email send crashed', {
          orderId,
          recipient: emailRecipient,
          error: emailAttempt.errorMessage,
        });
      }
    }
    attempts.push(emailAttempt);
    await logDeliveryAttempt({
      db,
      orderId,
      method: 'email',
      recipient: emailAttempt.recipient,
      success: emailAttempt.success,
      provider: emailAttempt.provider,
      errorCode: emailAttempt.errorCode,
      errorMessage: emailAttempt.errorMessage,
    });
  }

  if (deliveryMethod === 'text' || deliveryMethod === 'all') {
    const smsRecipient = normalizedPhone || normalizePhone(receipt.meta.customerPhone);
    let smsAttempt: DeliveryResult;
    try {
      smsAttempt = await sendSmsReceipt({
        receipt,
        recipient: smsRecipient,
      });
    } catch (error) {
      smsAttempt = {
        method: 'text',
        success: false,
        recipient: smsRecipient,
        provider: getSmsProvider(),
        errorCode: 'UNKNOWN_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unexpected error while sending text receipt.',
      };
      if (SHOULD_LOG_FAILURES) {
        console.error('[send-order-receipt] sms send crashed', {
          orderId,
          recipient: smsRecipient,
          error: smsAttempt.errorMessage,
        });
      }
    }
    attempts.push(smsAttempt);
    await logDeliveryAttempt({
      db,
      orderId,
      method: 'sms',
      recipient: smsAttempt.recipient,
      success: smsAttempt.success,
      provider: smsAttempt.provider,
      errorCode: smsAttempt.errorCode,
      errorMessage: smsAttempt.errorMessage,
    });
  }

  const successfulMethods = attempts.filter((attempt) => attempt.success).map((attempt) => attempt.method);
  const failedAttempts = attempts.filter((attempt) => !attempt.success);
  const partial = successfulMethods.length > 0 && failedAttempts.length > 0;

  if (deliveryMethod === 'print') {
    return json(200, {
      success: true,
      partial: false,
      code: 'PRINT_ONLY',
      results: [],
      deliveredMethods: ['print'],
      failedMethods: [],
      message: 'Print the receipt locally.',
    });
  }

  if (failedAttempts.length === attempts.length) {
    const firstFailure = failedAttempts[0];
    return json(200, {
      success: false,
      partial: false,
      code: firstFailure?.errorCode ?? 'DELIVERY_FAILED',
      results: attempts,
      deliveredMethods: [],
      failedMethods: failedAttempts.map((attempt) => attempt.method === 'text' ? 'sms' : attempt.method),
      message: firstFailure?.errorMessage ?? 'Could not deliver the receipt digitally.',
    });
  }

  return json(200, {
    success: true,
    partial,
    code: partial ? 'PARTIAL_SUCCESS' : 'DELIVERY_SENT',
    results: attempts,
    deliveredMethods: successfulMethods.map((method) => method === 'text' ? 'sms' : method),
    failedMethods: failedAttempts.map((attempt) => attempt.method === 'text' ? 'sms' : attempt.method),
    message: partial ? 'Some receipt delivery methods succeeded.' : 'Receipt delivered successfully.',
  });
});
