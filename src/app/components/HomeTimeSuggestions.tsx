// HomeTimeSuggestions — contextual meal recommendation blocks based on the current time of day.

import { motion } from 'framer-motion';
import { ArrowRight, Clock3 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { CardStagger, CardStaggerItem, HoverLift, SectionReveal } from '../core/motion/cultivMotion';

type DayPeriod = 'morning' | 'afternoon' | 'evening';

interface HomeTimeSuggestionsProps {
  onCategorySelect: (category: string) => void;
}

const PERIOD_COPY: Record<DayPeriod, { headline: string; category: string; blurb: string; image: string }> = {
  morning: {
    headline: 'Morning Ritual',
    category: 'Breakfast Bowls',
    blurb: 'Start clean and steady with breakfast bowls and fresh juice.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
  },
  afternoon: {
    headline: 'Midday Fuel',
    category: 'Signature Bowls',
    blurb: 'Balanced bowls for stable energy through the day.',
    image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
  evening: {
    headline: 'Evening Light Meal',
    category: 'Salad Bowls',
    blurb: 'Lighter bowls for evenings and easy dinners.',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1080',
  },
};

function getCurrentPeriod(): DayPeriod {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function HomeTimeSuggestions({ onCategorySelect }: HomeTimeSuggestionsProps) {
  const currentPeriod = getCurrentPeriod();
  const active = PERIOD_COPY[currentPeriod];

  return (
    <SectionReveal className="py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8f7f2_0%,#f3f5ed_48%,#f8f7f2_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Time-based picks</p>
              <h2 className="mt-2 text-4xl md:text-5xl tracking-tight font-semibold">Built for your daily rhythm.</h2>
              <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">Recommendations that read more like food guidance than a utility block, with the current moment quietly highlighted.</p>
            </div>
            <div className="rounded-full border border-primary/16 bg-white/72 px-4 py-2 text-sm text-foreground/68 shadow-sm">
              Right now: <span className="font-medium text-primary">{active.headline}</span>
            </div>
          </div>

          <CardStagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(Object.keys(PERIOD_COPY) as DayPeriod[]).map((period) => {
              const block = PERIOD_COPY[period];
              const isActive = period === currentPeriod;
              return (
                <motion.button
                  key={period}
                  variants={CardStaggerItem}
                  onClick={() => onCategorySelect(block.category)}
                  whileHover={HoverLift.whileHover}
                  className={`group overflow-hidden rounded-[30px] border text-left transition-all duration-300 hover:scale-[1.02] ${
                    isActive
                      ? 'border-primary/30 bg-primary/[0.05] shadow-lg'
                      : 'border-border bg-white/88 shadow-md hover:shadow-lg'
                  }`}
                >
                  <div className="relative h-52 overflow-hidden">
                    <ImageWithFallback src={block.image} alt={block.category} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/90 px-3 py-1 text-xs uppercase tracking-[0.16em] text-primary/80">
                      <Clock3 className="h-3.5 w-3.5" />
                      {block.headline}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-2xl font-semibold tracking-tight">{block.category}</h3>
                      {isActive ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">Best fit now</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/68">{block.blurb}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Order this now
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </CardStagger>
        </div>
      </div>
    </SectionReveal>
  );
}
