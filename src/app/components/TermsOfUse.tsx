// TermsOfUse — full terms of use page for CULTIV

import { Link } from "react-router-dom";

type TermsOfUseProps = {
  variant?: 'page' | 'modal';
};

export function TermsOfUse({ variant = 'page' }: TermsOfUseProps) {
  const content = (
    <>
      <div className="mb-2">
        <span className="text-xs uppercase tracking-[0.2em] text-primary/60 font-semibold">
          Legal · Terms
        </span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
        Terms of Use
      </h1>
      <p className="mb-4 text-sm sm:text-[15px] leading-7 text-foreground/70">
        Effective Date: April 6, 2026
      </p>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        These Terms of Use (“Terms”) govern your use of the CULTIV website, app, and member services (“Services”). By using our Services, you agree to these Terms.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        1. Account Registration
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>You must provide accurate information when creating your CULTIV account.</li>
        <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
        <li>You are responsible for all activity under your account.</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        2. Use of Services
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>You may use the Services only for personal, non-commercial purposes.</li>
        <li>You may not misuse the Services or attempt to access them in an unauthorized manner.</li>
        <li>We may suspend or terminate your access if you violate these Terms.</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        3. Orders and Rewards
      </h2>
      <ul className="list-disc space-y-2 pl-5 mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        <li>All orders and rewards are subject to availability and our policies.</li>
        <li>We reserve the right to modify or discontinue any aspect of the Services at any time.</li>
      </ul>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        4. Intellectual Property
      </h2>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        All content and branding on the Services are the property of CULTIV. You may not use, copy, or distribute any content without our permission.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        5. Limitation of Liability
      </h2>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        The Services are provided “as is” without warranties of any kind. CULTIV is not liable for any damages arising from your use of the Services.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        6. Changes to Terms
      </h2>
      <p className="mb-6 text-sm sm:text-[15px] leading-7 text-foreground/70">
        We may update these Terms from time to time. We will notify you of material changes by updating this page with a new effective date. Continued use of the Services constitutes acceptance of the updated Terms.
      </p>
      <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-3">
        7. Contact Us
      </h2>
      <p className="mb-8 text-sm sm:text-[15px] leading-7 text-foreground/70">
        If you have any questions about these Terms, please contact us at{' '}
        <a href="mailto:support@cultiv.app" className="underline text-primary">
          support@cultiv.app
        </a>.
      </p>
    </>
  );

  if (variant === 'modal') {
    return (
      <div className="w-full">
        {content}
      </div>
    );
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