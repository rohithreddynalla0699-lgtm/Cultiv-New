import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from './AuthShell';
import { ErrorShake } from '../core/motion/cultivMotion';
import { Modal } from './Modal';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfUse } from './TermsOfUse';

const getPasswordPolicyError = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  return '';
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupField =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'agreeToTerms';

type SignupFieldErrors = Partial<Record<SignupField, string>>;

export function SignupScreen() {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: searchParams.get('phone') ?? '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [modal, setModal] = useState<null | 'privacy' | 'terms'>(null);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLButtonElement>(null);

  const inputBaseClass =
    'w-full rounded-2xl border bg-white/85 px-3.5 py-2.5 text-[14px] outline-none transition-all placeholder:text-foreground/35';

  const resolveInputClass = (field: SignupField) =>
    `${inputBaseClass} ${
      fieldErrors[field]
        ? 'border-red-300 focus:border-red-500'
        : 'border-border focus:border-primary'
    }`;

  const renderFieldMessage = (message?: string) => (
    <p
      className={`mt-1 min-h-[0.9rem] text-[11px] ${
        message ? 'font-medium text-red-600' : 'text-transparent'
      }`}
    >
      {message ?? 'placeholder'}
    </p>
  );

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));

    if (error) setError('');

    if (fieldErrors[field]) {
      setFieldErrors((previous) => ({ ...previous, [field]: '' }));
    }

    if (
      (field === 'password' || field === 'confirmPassword') &&
      fieldErrors.confirmPassword
    ) {
      setFieldErrors((previous) => ({ ...previous, confirmPassword: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors: SignupFieldErrors = {};

    const trimmedFullName = formData.fullName.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedFullName) nextErrors.fullName = 'Full name is required';

    if (!trimmedPhone) {
      nextErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(trimmedPhone)) {
      nextErrors.phone = 'Enter a valid 10-digit phone number';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else {
      const passwordPolicyError = getPasswordPolicyError(formData.password);
      if (passwordPolicyError) nextErrors.password = passwordPolicyError;
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreed) {
      nextErrors.agreeToTerms =
        'You must agree to the Privacy Policy and Terms of Use to continue';
    }

    setFieldErrors(nextErrors);

    const firstInvalidFieldOrder: SignupField[] = [
      'fullName',
      'phone',
      'email',
      'password',
      'confirmPassword',
      'agreeToTerms',
    ];

    const firstInvalidField = firstInvalidFieldOrder.find((field) =>
      Boolean(nextErrors[field]),
    );

    if (firstInvalidField) {
      if (firstInvalidField === 'fullName') fullNameRef.current?.focus();
      if (firstInvalidField === 'phone') phoneRef.current?.focus();
      if (firstInvalidField === 'email') emailRef.current?.focus();
      if (firstInvalidField === 'password') passwordRef.current?.focus();
      if (firstInvalidField === 'confirmPassword')
        confirmPasswordRef.current?.focus();
      if (firstInvalidField === 'agreeToTerms') agreeRef.current?.focus();
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await signup({
        ...formData,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
      });

      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.message);
      }
    } catch {
      setError('Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Join CULTIV"
      subtitle="Create a calm, premium member profile for saved orders, rewards, and repeat benefits."
      footer={
        <p className="text-center text-sm text-foreground/60">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      }
    >
      <>
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-2.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.06,
                delayChildren: 0.1,
              },
            },
          }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
          >
            <label
              htmlFor="signup-full-name"
              className="mb-1 block text-xs font-semibold tracking-[0.01em] text-foreground/78"
            >
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="signup-full-name"
              ref={fullNameRef}
              className={resolveInputClass('fullName')}
              placeholder="Full name"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              required
            />
            {renderFieldMessage(fieldErrors.fullName)}
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
          >
            <label
              htmlFor="signup-phone"
              className="mb-1 block text-xs font-semibold tracking-[0.01em] text-foreground/78"
            >
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              id="signup-phone"
              ref={phoneRef}
              className={resolveInputClass('phone')}
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) =>
                updateField('phone', e.target.value.replace(/[^0-9]/g, ''))
              }
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              required
            />
            {renderFieldMessage(fieldErrors.phone)}
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
          >
            <label
              htmlFor="signup-email"
              className="mb-1 block text-xs font-semibold tracking-[0.01em] text-foreground/78"
            >
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="signup-email"
              ref={emailRef}
              className={resolveInputClass('email')}
              placeholder="Email address"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
            />
            {renderFieldMessage(fieldErrors.email)}
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
          >
            <label
              htmlFor="signup-password"
              className="mb-1 block text-xs font-semibold tracking-[0.01em] text-foreground/78"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="signup-password"
                ref={passwordRef}
                className={`${resolveInputClass('password')} pr-12`}
                placeholder="Create password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <p
              className={`mt-1 min-h-[0.9rem] text-[11px] ${
                fieldErrors.password
                  ? 'font-medium text-red-600'
                  : 'text-foreground/45'
              }`}
            >
              {fieldErrors.password ??
                'Use at least 8 characters with one letter and one number.'}
            </p>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
          >
            <label
              htmlFor="signup-confirm-password"
              className="mb-1 block text-xs font-semibold tracking-[0.01em] text-foreground/78"
            >
              Confirm password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="signup-confirm-password"
                ref={confirmPasswordRef}
                className={`${resolveInputClass('confirmPassword')} pr-12`}
                placeholder="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) =>
                  updateField('confirmPassword', e.target.value)
                }
                required
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/45"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {renderFieldMessage(fieldErrors.confirmPassword)}
          </motion.div>

          <motion.button
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
            ref={agreeRef}
            type="button"
            onClick={() => {
              setAgreed(!agreed);
              if (error) setError('');
              if (fieldErrors.agreeToTerms) {
                setFieldErrors((previous) => ({
                  ...previous,
                  agreeToTerms: '',
                }));
              }
            }}
            className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
              fieldErrors.agreeToTerms
                ? 'border-red-300 bg-red-50/70 text-red-700'
                : 'border-primary/12 bg-primary/[0.03] text-foreground/72 hover:bg-primary/[0.05]'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded border ${
                agreed
                  ? 'border-primary bg-primary'
                  : 'border-border bg-white/80'
              }`}
            >
              {agreed ? (
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              ) : null}
            </span>
            <span>
              I agree to the{' '}
              <button
                type="button"
                className="font-normal underline underline-offset-4 decoration-1 text-[13px] text-primary/80 hover:text-primary focus:outline-none transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal('privacy');
                }}
              >
                Privacy Policy
              </button>{' '}
              and{' '}
              <button
                type="button"
                className="font-normal underline underline-offset-4 decoration-1 text-[13px] text-primary/80 hover:text-primary focus:outline-none transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal('terms');
                }}
              >
                Terms of Use
              </button>{' '}
              <span className="text-red-400">*</span>
            </span>
          </motion.button>

          <p
            className={`-mt-1 min-h-[0.9rem] text-[11px] ${
              fieldErrors.agreeToTerms
                ? 'font-medium text-red-600'
                : 'text-transparent'
            }`}
          >
            {fieldErrors.agreeToTerms ?? 'placeholder'}
          </p>

          <motion.div
            {...(error ? ErrorShake : {})}
            className={`min-h-[2.5rem] rounded-2xl px-3 py-2 text-xs transition-all ${
              error
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-transparent bg-transparent text-transparent'
            }`}
          >
            {error || 'Placeholder for stable layout.'}
          </motion.div>

          <motion.button
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-full bg-gradient-to-r from-primary to-[#2f5e18] py-2.5 text-sm font-semibold tracking-[0.01em] text-primary-foreground shadow-[0_12px_28px_rgba(45,80,22,0.28)] transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            <motion.span
              animate={isLoading ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
              transition={{ duration: 1.5, repeat: isLoading ? Infinity : 0 }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </motion.span>
          </motion.button>
        </motion.form>

        <Modal
          open={modal === 'privacy'}
          onClose={() => setModal(null)}
          ariaLabel="Privacy Policy"
        >
          {modal === 'privacy' && <PrivacyPolicy variant="modal" />}
        </Modal>

        <Modal
          open={modal === 'terms'}
          onClose={() => setModal(null)}
          ariaLabel="Terms of Use"
        >
          {modal === 'terms' && <TermsOfUse variant="modal" />}
        </Modal>
      </>
    </AuthShell>
  );
}