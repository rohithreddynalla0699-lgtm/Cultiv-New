import { motion } from 'framer-motion';
import { ArrowRight, CircleDot, Salad, Soup, Sparkles } from 'lucide-react';
import { CardStagger, CardStaggerItem, HoverLift, SectionReveal } from '../core/motion/cultivMotion';

interface HomeHowItWorksProps {
  onOrderClick: () => void;
}

const STEPS = [
  {
    icon: CircleDot,
    title: 'Choose your base',
    description: 'Start with grains, greens, or a lighter mix depending on the meal you want.',
  },
  {
    icon: Salad,
    title: 'Pick your protein',
    description: 'Build around chicken, egg, paneer, or plant-forward options that fit your routine.',
  },
  {
    icon: Sparkles,
    title: 'Add fresh toppings',
    description: 'Layer in crunch, color, and sauces that make the bowl feel complete.',
  },
  {
    icon: Soup,
    title: 'Finish your order',
    description: 'Order for pickup and keep the next one even faster with your saved preferences.',
  },
] as const;

export function HomeHowItWorks({ onOrderClick }: HomeHowItWorksProps) {
  return (
    <SectionReveal className="relative overflow-hidden bg-background py-20 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(45,80,22,0.08),transparent_22%),linear-gradient(180deg,#f7f6f1_0%,#f2f5ea_48%,#f7f6f1_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Build your bowl</p>
              <h2 className="mt-2 text-4xl md:text-5xl tracking-tight font-semibold">Custom food should still feel easy.</h2>
              <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">A simple, calm food flow designed to make first orders clear and repeat orders fast.</p>
            </div>
            <motion.button
              type="button"
              onClick={onOrderClick}
              whileHover={HoverLift.whileHover}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-md"
            >
              Start your bowl
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>

          <CardStagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  variants={CardStaggerItem}
                  whileHover={HoverLift.whileHover}
                  className="rounded-[28px] border border-primary/12 bg-white/88 p-6 shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-primary/60">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-foreground/64">{step.description}</p>
                </motion.div>
              );
            })}
          </CardStagger>
        </div>
      </div>
    </SectionReveal>
  );
}