// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type NotificationEventChannel = 'email' | 'sms';
export type NotificationEventPurpose = 'receipt' | 'signup_verification' | 'password_reset';
export type NotificationEventStatus = 'sent' | 'failed' | 'not_delivered';

export async function logNotificationEvent(
  db: ReturnType<typeof createClient>,
  params: {
    channel: NotificationEventChannel;
    purpose: NotificationEventPurpose;
    status: NotificationEventStatus;
    provider?: string | null;
    recipient?: string | null;
    customerId?: string | null;
    orderId?: string | null;
    storeId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const nowIso = new Date().toISOString();

  try {
    const { error } = await db.from('notification_events').insert({
      channel: params.channel,
      purpose: params.purpose,
      status: params.status,
      provider: params.provider ?? null,
      recipient: params.recipient ?? null,
      customer_id: params.customerId ?? null,
      order_id: params.orderId ?? null,
      store_id: params.storeId ?? null,
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? {},
      sent_at: params.status === 'sent' ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (error) {
      console.error('[notification-events] failed to write notification event', {
        channel: params.channel,
        purpose: params.purpose,
        status: params.status,
        orderId: params.orderId ?? null,
        customerId: params.customerId ?? null,
        error: error.message,
      });
    }
  } catch (error) {
    console.error('[notification-events] unexpected failure writing notification event', {
      channel: params.channel,
      purpose: params.purpose,
      status: params.status,
      orderId: params.orderId ?? null,
      customerId: params.customerId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
