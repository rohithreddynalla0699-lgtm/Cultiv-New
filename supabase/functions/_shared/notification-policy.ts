export const notificationChannelPolicy = {
  security: {
    description: 'SMS is the primary channel for security and verification interactions such as OTPs and password-reset verification.',
    preferred: 'sms',
  },
  commerce: {
    description: 'Email is the preferred channel for order receipts and commerce notifications. SMS receipt delivery is retained for backward compatibility.',
    preferred: 'email',
    legacyFallback: 'sms',
  },
} as const;
