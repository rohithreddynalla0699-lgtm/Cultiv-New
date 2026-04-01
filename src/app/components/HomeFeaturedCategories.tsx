import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { CardStagger, CardStaggerItem, HoverLift, SectionReveal } from '../core/motion/cultivMotion';

interface HomeFeaturedCategoriesProps {
  onCategorySelect: (category: string) => void;
}

const FEATURED_CATEGORIES = [
  {
    title: 'Breakfast Bowls',
    description: 'Warm grains, eggs, and fresh toppings for an easier morning rhythm.',
    category: 'Breakfast Bowls',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
  },
  {
    title: 'Signature Bowls',
    description: 'Balanced lunch-and-dinner bowls built for stable energy every day.',
    category: 'Signature Bowls',
    image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
  {
    title: 'Drinks & Juices',
    description: 'Fresh, clean pours that round out breakfast and lighter meal routines.',
    category: 'Drinks & Juices',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
] as const;

export function HomeFeaturedCategories({ onCategorySelect }: HomeFeaturedCategoriesProps) {
  return (
    <SectionReveal className="relative overflow-hidden bg-background py-16 md:py-20">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7f6f1_0%,#f3f5ed_35%,#f7f6f1_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 md:mb-10">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Now serving</p>
            <h2 className="mt-2 text-4xl md:text-5xl tracking-tight font-semibold">The categories that define CULTIV.</h2>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">A fast read on what to order now, from breakfast bowls to everyday staples and lighter juice add-ons.</p>
          </div>

          <CardStagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURED_CATEGORIES.map((item) => (
              <motion.button
                key={item.title}
                type="button"
                variants={CardStaggerItem}
                whileHover={HoverLift.whileHover}
                onClick={() => onCategorySelect(item.category)}
                className="group overflow-hidden rounded-[30px] border border-primary/12 bg-white/90 text-left shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="relative h-56 overflow-hidden">
                  <ImageWithFallback src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-2xl font-semibold tracking-tight">{item.title}</h3>
                    <ArrowRight className="h-5 w-5 text-primary/70 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground/66">{item.description}</p>
                </div>
              </motion.button>
            ))}
          </CardStagger>
        </div>
      </div>
    </SectionReveal>
  );
}