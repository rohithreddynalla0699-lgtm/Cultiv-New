// ProfileScreen — customer account summary with backend-backed identity and honest feature availability.

import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, LockKeyhole, LogOut, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { CardStagger, CardStaggerItem, HoverLift, PageReveal } from '../core/motion/cultivMotion';
import { WalkInLinkPrompt } from './WalkInLinkPrompt';

export function ProfileScreen() {
  const { user, customerAccount, loyaltySummary, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString();

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_6%_10%,rgba(45,80,22,0.12),transparent_24%),radial-gradient(circle_at_94%_16%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] p-4">
      <div className="relative mx-auto max-w-5xl space-y-6 pt-24 md:pt-28">
        <div className="pointer-events-none absolute -top-8 left-6 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute top-28 right-0 h-44 w-44 rounded-full bg-[#7E996C]/15 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/58">
          <Link to="/" className="inline-flex items-center gap-2 font-medium hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/46">Account / Profile</p>
        </div>

        <CardStagger className="space-y-6">
          <motion.div variants={CardStaggerItem} className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-xl">
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[radial-gradient(circle_at_top_right,rgba(45,80,22,0.22),transparent_32%)]" />
            <div className="relative z-10">
              <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <Logo variant="emblem" animated />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/62">Account summary</p>
                    <h1 className="text-3xl font-semibold tracking-tight">Your CULTIV Profile</h1>
                    <p className="text-foreground/70 max-w-xl">This page shows backend-backed account identity and live rewards status.</p>
                    <p className="mt-2 text-xs text-foreground/55">Member since {memberSince}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl bg-background/60 p-5">
                  <User className="mt-0.5 h-5 w-5 text-foreground/50" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Full name</p>
                    <p className="mt-2 font-medium">{user.fullName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-background/60 p-5">
                  <Phone className="mt-0.5 h-5 w-5 text-foreground/50" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Phone</p>
                      {customerAccount?.phone_verified ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium">{user.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-background/60 p-5">
                  <Mail className="mt-0.5 h-5 w-5 text-foreground/50" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Email</p>
                      <LockKeyhole className="h-3.5 w-3.5 text-foreground/40" />
                      {customerAccount?.email_verified ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium">{user.email || 'No email on file'}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={CardStaggerItem} className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-primary/10 bg-white/80 p-6 shadow-[0_16px_48px_rgba(45,80,22,0.07)]">
                <p className="text-xs uppercase tracking-[0.22em] text-primary/60">Loyalty snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Live rewards summary.</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/62">Reward totals on this screen come from backend loyalty data, not device-only profile storage.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Available points</p>
                    <p className="mt-2 text-2xl font-semibold">{loyaltySummary?.availablePoints ?? customerAccount?.reward_points ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Active batches</p>
                    <p className="mt-2 text-2xl font-semibold">{loyaltySummary?.activeBatches?.length ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Recent activity</p>
                    <p className="mt-2 text-2xl font-semibold">{loyaltySummary?.recentActivity?.length ?? 0}</p>
                  </div>
                </div>
              </div>

              <WalkInLinkPrompt defaultPhone={user.phone} />
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-primary/10 bg-white/85 p-6 shadow-[0_16px_48px_rgba(45,80,22,0.07)]">
                <p className="text-xs uppercase tracking-[0.22em] text-primary/60">Account editing</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Read-only for now.</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/62">
                  Profile editing, saved addresses, and saved payment methods are hidden until they are fully backend-backed.
                </p>
                <div className="mt-5 rounded-2xl border border-border bg-background/78 px-4 py-4 text-sm leading-6 text-foreground/60">
                  Checkout still works normally. Enter phone, email, and payment method during each order, and CULTIV will keep order history and rewards linked to your real customer account.
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
                <p className="text-xs uppercase tracking-[0.22em] text-primary/60">Account actions</p>
                <div className="mt-5 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 px-5 py-4">
                    <div className="text-left">
                      <p className="font-medium">Support</p>
                      <p className="mt-1 text-sm text-foreground/58">Secure account editing and recovery tools are intentionally limited until they are fully backend-backed.</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-foreground/40" />
                  </div>

                  <motion.button
                    onClick={() => {
                      logout();
                      navigate('/', { replace: true });
                    }}
                    className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-700"
                    whileHover={HoverLift.whileHover}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-left">
                      <p className="font-medium">Sign Out</p>
                      <p className="mt-1 text-sm text-red-700/72">Leave this member space and return to the menu.</p>
                    </div>
                    <LogOut className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </CardStagger>
      </div>
    </PageReveal>
  );
}
