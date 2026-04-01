// HomeQuickActions — signature picks section with quick ordering cards and reorder access.

import { motion } from 'framer-motion';
import { ArrowRight, Flame, Repeat2, Sparkles, UtensilsCrossed, Waves } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { CardStagger, CardStaggerItem, HoverLift, SectionReveal } from '../core/motion/cultivMotion';

interface HomeQuickActionsProps {
  onCategorySelect: (category: string) => void;
  onReorderLast: () => void;
}

const QUICK_ACTIONS = [
  {
    title: 'Signature Bowl',
    description: 'The balanced bowl people come back to when they want an easy, steady lunch.',
    category: 'Signature Bowls',
    icon: Sparkles,
    image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    badge: 'Best seller',
  },
  {
    title: 'High Protein Bowl',
    description: 'Built for training days, bigger hunger, and a stronger protein-first meal.',
    category: 'High Protein',
    icon: Flame,
    image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    badge: 'Training pick',
  },
  {
    title: 'Kids Meal',
    description: 'A simpler, milder bowl built for lighter appetites and family routines.',
    category: 'Kids Meal',
    icon: UtensilsCrossed,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    badge: 'Family favorite',
  },
  {
    title: 'Drinks & Juices',
    description: 'A fresh, lighter add-on for morning orders and post-meal balance.',
    category: 'Drinks & Juices',
    icon: Waves,
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    badge: 'Fresh pour',
  },
] as const;

export function HomeQuickActions({ onCategorySelect, onReorderLast }: HomeQuickActionsProps) {
  return (
    <SectionReveal id="journal" className="py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7f6f1_0%,#f2f4eb_45%,#f7f6f1_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Signature picks</p>
              <h2 className="mt-2 text-4xl md:text-5xl tracking-tight font-semibold">What people keep coming back for.</h2>
              <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">A quick way into the bowls and add-ons that define everyday CULTIV ordering.</p>
            </div>
            <motion.button
              type="button"
              onClick={onReorderLast}
              whileTap={{ scale: 0.98 }}
              whileHover={HoverLift.whileHover}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <Repeat2 className="h-4 w-4" />
              Reorder last order
            </motion.button>
          </div>

          <CardStagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.title}
                  variants={CardStaggerItem}
                  onClick={() => onCategorySelect(action.category)}
                  whileHover={HoverLift.whileHover}
                  className="group overflow-hidden rounded-[30px] border border-primary/12 bg-white/90 text-left shadow-md transition-all duration-300 hover:shadow-lg"
                >
                  <div className="relative h-52 overflow-hidden">
                    <ImageWithFallback src={action.image} alt={action.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary/78">
                      <Icon className="h-3.5 w-3.5" />
                      {action.badge}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-semibold tracking-tight mb-2 flex items-center justify-between gap-3">
                      {action.title}
                      <ArrowRight className="h-5 w-5 text-primary/70 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm text-foreground/66 leading-6">{action.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Order now
                      <ArrowRight className="h-4 w-4" />
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
