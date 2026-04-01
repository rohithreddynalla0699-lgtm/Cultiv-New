// HomeRewardsSnapshot — premium app and rewards section shown on home for loyalty and routine retention.

import { motion } from 'framer-motion';
import { ArrowRight, Download, Gift, Repeat2, Star, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HoverLift, SectionReveal, CardStagger, CardStaggerItem } from '../core/motion/cultivMotion';
import { requestOpenAppWaitlist } from '../data/appLaunch';

export function HomeRewardsSnapshot() {
  const { user, loyaltyProfile } = useAuth();
  const featureCards = [
    { icon: Repeat2, title: 'Reorder faster', copy: 'Keep your usual bowls ready to repeat when the week gets busy.' },
    { icon: Gift, title: 'Earn rewards', copy: 'Track points, unlocked benefits, and membership progress in one place.' },
    { icon: Truck, title: 'Keep orders in view', copy: 'Pickup tracking stays easier when your routine lives inside the app.' },
  ] as const;

  return (
    <SectionReveal className="py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7f6f1_0%,#edf3e7_42%,#f7f6f1_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.08fr_0.92fr] items-stretch">
          <motion.div whileHover={HoverLift.whileHover} className="rounded-[34px] border border-primary/16 bg-[linear-gradient(135deg,rgba(45,80,22,0.1),rgba(255,255,255,0.9))] p-7 md:p-8 shadow-lg">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/70">App + rewards</p>
            <h2 className="mt-3 text-4xl md:text-5xl tracking-tight font-semibold">Keep your CULTIV routine in one place.</h2>
            <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">
              Save your orders, earn rewards, reorder faster, and keep pickup easier every time you come back.
            </p>

            <CardStagger className="mt-8 grid gap-4 md:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div key={feature.title} variants={CardStaggerItem} className="rounded-[24px] border border-primary/12 bg-white/72 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/62">{feature.copy}</p>
                  </motion.div>
                );
              })}
            </CardStagger>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => requestOpenAppWaitlist()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/16 bg-white/80 px-5 py-3 text-sm font-medium text-primary shadow-sm"
              >
                <Download className="h-4 w-4" />
                Join App Waitlist
              </button>
              <Link to="/rewards" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-md">
                View rewards
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div whileHover={HoverLift.whileHover} className="rounded-[34px] border border-primary/14 bg-white/90 p-7 md:p-8 shadow-lg">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Member snapshot</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight">{user && loyaltyProfile ? loyaltyProfile.currentTier : 'Start a CULTIV account'}</h3>
            <p className="mt-3 text-sm leading-7 text-foreground/64">
              {user && loyaltyProfile
                ? `${loyaltyProfile.expiringSoonPoints} points are expiring soon. Redeem before they expire.`
                : 'Sign in to track points, saved orders, order history, and member-only benefits as your routine grows.'}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-primary/14 bg-[#F7F8F2] px-4 py-4">
                <div className="flex items-center gap-2 text-primary/80"><Star className="h-4 w-4" /> Points</div>
                <div className="mt-2 text-2xl font-semibold">{user && loyaltyProfile ? loyaltyProfile.availablePoints : 0}</div>
              </div>
              <div className="rounded-2xl border border-primary/14 bg-[#F7F8F2] px-4 py-4">
                <div className="flex items-center gap-2 text-primary/80"><Gift className="h-4 w-4" /> Expiring soon</div>
                <div className="mt-2 text-2xl font-semibold">{user && loyaltyProfile ? loyaltyProfile.expiringSoonPoints : 0}</div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-primary/12 bg-primary/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Why it matters</p>
              <p className="mt-2 text-sm leading-7 text-foreground/64">The more consistent the ordering pattern, the faster CULTIV can become a real everyday habit instead of a one-off meal.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionReveal>
  );
}
