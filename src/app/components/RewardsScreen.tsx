import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Coins, History, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import type { LoyaltyRecentActivityItem } from '../types/loyalty';
import {
  formatLoyaltyActivityDate,
  formatLoyaltyActivityLabel,
  formatLoyaltyActivityPoints,
  getLoyaltyActivityPointsClassName,
} from '../utils/loyaltyFormatters';
import { AvailableRewardsList } from './AvailableRewardsList';

const sectionMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38 },
};

const messageMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22 },
};

const subtleCardMotion = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.995 },
};

export function RewardsScreen() {
  const { user, loyaltyProfile, loyaltySummary, offers, redeemReward } = useAuth();

  const availablePoints =
    loyaltySummary?.availablePoints ?? loyaltyProfile?.availablePoints ?? 0;

  const [redeemMessage, setRedeemMessage] = useState('');

  const recentActivity: LoyaltyRecentActivityItem[] =
    loyaltySummary?.recentActivity ?? [];

  const availableRewardCount = loyaltyProfile?.availableRewards.length ?? 0;
  const expiringSoonPoints = loyaltyProfile?.expiringSoonPoints ?? 0;

  const nextRewardCost =
    (offers ?? [])
      .filter((offer) => offer.active && offer.pointCost && !offer.autoApply)
      .map((offer) => offer.pointCost as number)
      .sort((a, b) => a - b)
      .find((cost) => cost > availablePoints) ?? null;

  const progressToNextReward = nextRewardCost
    ? Math.min(100, Math.round((availablePoints / nextRewardCost) * 100))
    : 100;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!loyaltyProfile) {
    return null;
  }

  async function handleRedeem(id: string) {
    const result = await redeemReward(id);
    setRedeemMessage(result.message);
    setTimeout(() => setRedeemMessage(''), 4000);
  }

  return (
    <PageReveal className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(133,154,104,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(208,218,192,0.15),transparent_24%),linear-gradient(180deg,#f8f7f3_0%,#f3f4eb_52%,#f8f7f2_100%)] px-4 pb-20">
      <div className="mx-auto max-w-3xl space-y-6 pt-24 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.99 }} className="inline-block">
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b7560] transition-colors hover:text-[#27311f]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="rounded-[30px] border border-[#dbe1d1] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(242,246,235,0.92))] p-7 shadow-[0_14px_36px_rgba(28,38,20,0.06)]"
          {...sectionMotion}
          transition={{ duration: 0.4, delay: 0.04 }}
        >
          <div className="flex flex-col items-center text-center">
            <motion.div
              className="mb-3 rounded-full border border-[#d7dec9] bg-[#eef3e6] p-3.5 text-[#566745]"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, delay: 0.1 }}
            >
              <Coins className="h-6 w-6" />
            </motion.div>

            <motion.h1
              className="text-[2.75rem] font-semibold tracking-[-0.045em] text-[#1f2719]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.08 }}
            >
              {availablePoints}
            </motion.h1>

            <motion.p
              className="mt-2 text-[16px] font-semibold text-[#556745]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 }}
            >
              Available Points
            </motion.p>

            <motion.p
              className="mt-1 text-[13px] text-[#727b67]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.16 }}
            >
              Earn 1 point for every ₹10 spent. Valid for 90 days.
            </motion.p>

            <motion.div
              className="mt-5 w-full max-w-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.18 }}
            >
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#66705d]">
                  {nextRewardCost
                    ? `Next reward at ${nextRewardCost} points`
                    : 'Ready to redeem'}
                </span>
                <span className="font-medium text-[#7b8570]">
                  {progressToNextReward}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#e4e8db]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNextReward}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.22 }}
                  className="h-full rounded-full bg-[linear-gradient(90deg,#6f8757_0%,#8fa776_100%)]"
                />
              </div>
            </motion.div>

            <AnimatePresence initial={false}>
              {availableRewardCount > 0 && (
                <motion.div
                  key="available-reward-banner"
                  className="mt-5 rounded-2xl border border-[#d4dcc6] bg-[#eff4e6] px-4 py-3"
                  initial={{ opacity: 0, y: 6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.26, delay: 0.18 }}
                >
                  <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#546644]">
                    <span className="text-sm">🎁</span>
                    {availableRewardCount} reward
                    {availableRewardCount > 1 ? 's are' : ' is'} ready to use at checkout
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {expiringSoonPoints > 0 && (
            <motion.div
              key="expiring-soon-card"
              className="rounded-[26px] border border-[#e7d7ac] bg-[linear-gradient(180deg,rgba(255,252,243,0.98),rgba(251,244,224,0.96))] p-5 shadow-[0_10px_28px_rgba(90,70,20,0.05)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.36, delay: 0.08 }}
            >
              <div className="flex items-start gap-4">
                <motion.div
                  className="rounded-full border border-amber-200 bg-amber-50 p-3 text-amber-700"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.24, delay: 0.14 }}
                >
                  <Clock3 className="h-5 w-5" />
                </motion.div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Expiring Soon
                  </p>
                  <p className="mt-2 text-[1.55rem] font-semibold text-[#332714]">
                    {expiringSoonPoints} points
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-[#7b6640]">
                    These points will expire in the next 14 days. Use them before they’re gone.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {redeemMessage ? (
            <motion.div
              key="redeem-message"
              {...messageMotion}
              className="rounded-2xl border border-[#d4dcc6] bg-[#eff4e6] px-4 py-3 text-center text-[13px] font-medium text-[#556745]"
            >
              {redeemMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          className="rounded-[26px] border border-[#dbe1d1] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,248,243,0.96))] p-5 shadow-[0_12px_32px_rgba(28,38,20,0.05)]"
          {...sectionMotion}
          transition={{ duration: 0.38, delay: 0.14 }}
        >
          <div className="mb-5 flex items-center gap-3">
            <motion.div
              className="rounded-full border border-[#d7dec9] bg-[#eef3e6] p-2.5 text-[#566745]"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, delay: 0.18 }}
            >
              <Zap className="h-4 w-4" />
            </motion.div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b856f]">
                Redeem Rewards
              </p>
              <h2 className="mt-1 text-[1.6rem] font-semibold tracking-[-0.03em] text-[#1f2719]">
                Use points before they expire.
              </h2>
            </div>
          </div>

          <AvailableRewardsList
            profile={loyaltyProfile}
            offers={offers}
            onRedeem={handleRedeem}
          />
        </motion.div>

        <motion.div
          className="rounded-[26px] border border-[#dbe1d1] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,248,243,0.96))] p-5 shadow-[0_12px_32px_rgba(28,38,20,0.05)]"
          {...sectionMotion}
          transition={{ duration: 0.38, delay: 0.2 }}
        >
          <div className="mb-5 flex items-center gap-3">
            <motion.div
              className="rounded-full border border-[#d7dec9] bg-[#eef3e6] p-2.5 text-[#566745]"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, delay: 0.24 }}
            >
              <History className="h-4 w-4" />
            </motion.div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b856f]">
                Points Activity
              </p>
              <h3 className="mt-1 text-[1.2rem] font-semibold text-[#1f2719]">
                Recent history
              </h3>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {recentActivity.length === 0 ? (
              <motion.div
                key="empty-activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24 }}
                className="rounded-2xl border border-[#e1e5d8] bg-[#fafbf7] p-7 text-center"
              >
                <motion.p
                  className="mb-2 text-3xl"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.24, delay: 0.04 }}
                >
                  🪙
                </motion.p>
                <p className="mb-1 text-[15px] font-medium text-[#33402b]">
                  No points activity yet.
                </p>
                <p className="text-[13px] text-[#727b67]">
                  <Link to="/" className="font-medium text-[#5d7348] hover:underline">
                    Place your first order
                  </Link>{' '}
                  to start earning.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="activity-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {recentActivity.map((item, index) => (
                  <motion.div
                    key={`${item.created_at}-${index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: index * 0.05 }}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[#e1e5d8] bg-[#fcfcf8] px-4 py-3.5"
                    whileHover={{ y: -1 }}
                    layout
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#27311f]">
                        {formatLoyaltyActivityLabel(item)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#7a846e]">
                        {formatLoyaltyActivityDate(item.created_at)}
                      </p>
                    </div>

                    <motion.span
                      className={`flex shrink-0 items-center gap-1 text-[13px] font-semibold tabular-nums ${getLoyaltyActivityPointsClassName(
                        item
                      )}`}
                      initial={{ scale: 0.88, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.05 + 0.03 }}
                    >
                      {formatLoyaltyActivityPoints(item)}
                    </motion.span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PageReveal>
  );
}