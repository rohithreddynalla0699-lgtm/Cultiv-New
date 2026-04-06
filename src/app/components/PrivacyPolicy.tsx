// PrivacyPolicy — full privacy policy page for CULTIV

import { Link } from "react-router-dom";

type PrivacyPolicyProps = {
  variant?: 'page' | 'modal';
};

export function PrivacyPolicy({ variant = 'page' }: PrivacyPolicyProps) {
  const content = (
    <>
      <div className="mb-2">
        <span className="text-xs uppercase tracking-[0.2em] text-primary/60 font-semibold">
          Legal · Privacy
        </span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
        Privacy Policy
      </h1>
      <p className="mb-4 text-sm sm:text-[15px] leading-7 text-foreground/70">
        Effective Date: April 6, 2026
      </p>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        CULTIV (“we”, “us”, or “our”) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website, app, and services.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        1. Information We Collect
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>
          <strong>Account Information:</strong> When you sign up, we collect your name, phone number, and email address.
        </li>
        <li>
          <strong>Order & Profile Data:</strong> We store your order history, profile preferences, and rewards status to provide a personalized experience.
        </li>
        <li>
          <strong>Support & Feedback:</strong> If you contact us for support or feedback, we may retain your communications.
        </li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        2. How We Use Your Information
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>To create and manage your CULTIV member account</li>
        <li>To process your orders and manage your rewards</li>
        <li>To communicate with you about your account, orders, and updates</li>
        <li>To improve our products, services, and member experience</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        3. Information Sharing
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>We do <strong>not</strong> sell your personal information.</li>
        <li>We may share information with trusted service providers who help us operate our member system, only as needed for those purposes.</li>
        <li>We may disclose information if required by law or to protect the rights and safety of CULTIV or our members.</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        4. Data Security
      </h2>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        We use reasonable security measures to protect your information. However, no system is completely secure, and we cannot guarantee absolute security.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        5. Your Choices
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>You may update your account information at any time in your profile.</li>
        <li>You may request deletion of your account by contacting support.</li>
        <li>You may opt out of non-essential communications at any time.</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        6. Changes to This Policy
      </h2>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        We may update this Privacy Policy from time to time. We will notify you of material changes by updating this page with a new effective date.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        7. Contact Us
      </h2>
      <p className="mb-8 text-sm sm:text-[15px] leading-7 text-foreground/70">
        If you have any questions about this Privacy Policy, please contact us at{' '}
        <a href="mailto:support@cultiv.app" className="underline text-primary">
          support@cultiv.app
        </a>.
      </p>
    </>
  );

  if (variant === 'modal') {
  return <div className="w-full">{content}</div>;
  }

  // Default: page layout
  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f8f7f2_0%,#f2f5ea_50%,#f8f7f2_100%)] flex items-center py-10">
      <div className="w-full max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto rounded-3xl bg-white/90 backdrop-blur-sm border border-primary/10 shadow-[0_20px_50px_rgba(20,35,10,0.12)] p-8 sm:p-10">
          {content}
          <div className="mt-10 flex">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-sm font-medium hover:bg-primary/5 transition"
            >
              <span aria-hidden="true">←</span> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
