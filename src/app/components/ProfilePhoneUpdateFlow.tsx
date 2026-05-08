import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AuthActionResult, CustomerPhoneUpdateRequestResult } from '../types/platform';

interface ProfilePhoneUpdateFlowProps {
  currentPhone: string;
  phoneVerified: boolean;
  onPhoneUpdated: () => void;
}

const PHONE_PATTERN = /^\d{10}$/;

export function ProfilePhoneUpdateFlow({ currentPhone, phoneVerified, onPhoneUpdated }: ProfilePhoneUpdateFlowProps) {
  const { requestCustomerPhoneUpdate, confirmCustomerPhoneUpdate } = useAuth();
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [hasBlurredPhone, setHasBlurredPhone] = useState(false);
  const [hasAttemptedPhoneSubmit, setHasAttemptedPhoneSubmit] = useState(false);

  const normalizedPhone = newPhone.replace(/\D/g, '');
  const isPhoneValid = PHONE_PATTERN.test(normalizedPhone);
  const isPhoneDifferent = normalizedPhone !== currentPhone.replace(/\D/g, '');
  const canSendCode = isPhoneValid && isPhoneDifferent && !isRequesting;
  const shouldShowPhoneValidation = hasBlurredPhone || hasAttemptedPhoneSubmit;
  const phoneValidationMessage = !shouldShowPhoneValidation
    ? null
    : !newPhone.length
      ? null
      : !isPhoneValid
        ? 'Enter a valid 10-digit phone number.'
        : !isPhoneDifferent
          ? 'New phone number must be different from your current phone.'
          : null;

  useEffect(() => {
    if (!expiresAt) return undefined;

    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const requestStateLabel = useMemo(() => {
    if (!requestId) return 'Start by entering a new phone number to receive a verification code.';
    return `A verification code was sent to ${newPhone || currentPhone}. Enter it below to confirm.`;
  }, [newPhone, requestId, currentPhone]);

  const requestExpiresAt = useMemo(() => {
    if (!expiresAt) return null;
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) return null;
    const delta = Math.max(0, expiresAtDate.getTime() - currentTime);
    const minutes = Math.floor(delta / 60000);
    const seconds = Math.floor((delta % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [expiresAt, currentTime]);

  const isCodeExpired = useMemo(() => {
    if (!expiresAt) return false;
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) return false;
    return expiresAtDate.getTime() <= currentTime;
  }, [expiresAt, currentTime]);

  useEffect(() => {
    if (!requestId) {
      setOtpCode('');
    }
  }, [requestId]);

  const handleRequestCode = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setHasAttemptedPhoneSubmit(true);

    const cleanedPhone = newPhone.replace(/\D/g, '');
    if (!PHONE_PATTERN.test(cleanedPhone)) {
      setErrorMessage('Enter a valid 10-digit phone number.');
      return;
    }

    if (cleanedPhone === currentPhone.replace(/\D/g, '')) {
      setErrorMessage('New phone number must be different from your current phone.');
      return;
    }

    setIsRequesting(true);
    const result: CustomerPhoneUpdateRequestResult = await requestCustomerPhoneUpdate(cleanedPhone);
    setIsRequesting(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setRequestId(result.requestId ?? null);
    setExpiresAt(result.expiresAt ?? null);
    setStatusMessage(result.message);
    setErrorMessage(null);
  };

  const handleVerifyCode = async () => {
    if (!requestId) {
      setErrorMessage('Please request a verification code first.');
      return;
    }

    if (!otpCode.trim()) {
      setErrorMessage('Enter the verification code.');
      return;
    }

    if (isCodeExpired) {
      setErrorMessage('Code expired. Please request a new code.');
      return;
    }

    setIsVerifying(true);
    const result: AuthActionResult = await confirmCustomerPhoneUpdate(requestId, otpCode.trim());
    setIsVerifying(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setStatusMessage('Phone number updated successfully.');
    setErrorMessage(null);
    setRequestId(null);
    setExpiresAt(null);
    setOtpCode('');
    setNewPhone('');
    window.setTimeout(() => {
      onPhoneUpdated();
    }, 700);
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary/60">Phone update</p>
          <h2 className="mt-2 text-xl font-semibold">Update your phone with OTP verification</h2>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {phoneVerified ? 'Verified' : 'Unverified'}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-foreground/70">
          <p className="font-medium">Current phone</p>
          <p className="mt-2 text-base font-medium">{currentPhone}</p>
          <p className="mt-2">Phone changes require OTP confirmation before your profile is updated.</p>
        </div>

        <div className="space-y-3">
          <label htmlFor="profile-phone-update-new-phone" className="block text-sm font-medium text-foreground/80">New phone</label>
          <input
            id="profile-phone-update-new-phone"
            name="newPhone"
            type="tel"
            value={newPhone}
            maxLength={10}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
              setNewPhone(digits);
              setStatusMessage(null);
              setErrorMessage(null);
            }}
            onBlur={() => setHasBlurredPhone(true)}
            placeholder="Enter 10-digit phone number"
            className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={handleRequestCode}
            disabled={!canSendCode}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary/50"
          >
            {isRequesting ? 'Sending code...' : 'Send verification code'}
          </button>
          <div className="min-h-[20px]">
            {phoneValidationMessage ? (
              <p className="text-sm text-red-700">{phoneValidationMessage}</p>
            ) : null}
          </div>
        </div>

        {requestId ? (
          <div className="space-y-3 rounded-2xl border border-border bg-background/75 p-4">
            <p className="text-sm text-foreground/70">{requestStateLabel}</p>
            <label htmlFor="profile-phone-update-otp-code" className="block text-sm font-medium text-foreground/80">Verification code</label>
            <input
              id="profile-phone-update-otp-code"
              name="otpCode"
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isVerifying || isCodeExpired}
                className="inline-flex items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-white transition hover:bg-foreground/80 disabled:cursor-not-allowed disabled:bg-foreground/40 px-5 py-3"
              >
                {isVerifying ? 'Verifying...' : 'Verify code'}
              </button>
              {requestExpiresAt ? (
                <p className="text-sm text-foreground/60">Expires in {requestExpiresAt}</p>
              ) : null}
            </div>
            <div className="min-h-[20px]">
              {isCodeExpired ? (
                <p className="text-sm text-red-700">Code expired. Please request a new code.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-[24px]">
          {statusMessage ? <p className="text-sm text-green-700">{statusMessage}</p> : null}
          {!statusMessage && errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
