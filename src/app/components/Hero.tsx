// Hero — editorial hero section with premium food imagery, layered depth, and order CTAs.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock3, Leaf, ShieldCheck } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { SectionReveal, HoverLift } from "../core/motion/cultivMotion";
import { useNavigate } from "react-router-dom";
import { MENU_CATEGORIES } from "../data/menuData";

interface HeroProps {
  onOrderClick: () => void;
  onExploreMenu?: () => void;
}

export function Hero({ onOrderClick, onExploreMenu }: HeroProps) {
  const navigate = useNavigate();
  const [bowlCount, setBowlCount] = useState(0);
  const targetCount = 2184;
  const featuredChickenPrice = MENU_CATEGORIES
    .find((category) => category.slug === 'signature-bowls')
    ?.items.find((item) => item.id === 'everyday-chicken-bowl')
    ?.price ?? 189;

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = targetCount / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetCount) {
        setBowlCount(targetCount);
        clearInterval(timer);
      } else {
        setBowlCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, []);

  return (
    <SectionReveal className="relative overflow-hidden bg-background pt-24 md:pt-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(45,80,22,0.10),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(153,168,126,0.16),transparent_22%),linear-gradient(180deg,#f8f7f2_0%,#f3f4ec_44%,#f8f7f2_100%)]" />

      <div className="container mx-auto px-6 relative z-10 py-14 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] min-h-[78vh]">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-white/86 px-5 py-2.5 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm font-medium tracking-wide text-primary">{bowlCount.toLocaleString()}+ bowls served in Siddipet</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }} className="mt-7 text-6xl sm:text-7xl md:text-8xl leading-[0.92] tracking-tight font-semibold">
              CULTIVATE
              <br />
              BETTER
              <br />
              HABITS
            </motion.h1>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }} className="mt-8 space-y-2.5">
              <p className="text-xl md:text-2xl leading-relaxed text-foreground/82">Clean food. Simple prep. Daily ritual.</p>
              <p className="text-xl md:text-2xl leading-relaxed text-foreground/82">Honest bowls built with real ingredients.</p>
              <p className="text-base leading-7 text-foreground/58">Designed for everyday eating.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-9 flex flex-col sm:flex-row gap-4">
              <motion.button
                onClick={onOrderClick}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-[0_16px_42px_rgba(45,80,22,0.18)]"
                whileHover={HoverLift.whileHover}
                whileTap={{ scale: 0.98 }}
              >
                Order Now
                <ArrowRight className="h-4 w-4" />
              </motion.button>
              <motion.button
                onClick={() => (onExploreMenu ? onExploreMenu() : navigate('/menu'))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/16 bg-white/74 px-8 py-4 text-base font-medium text-foreground shadow-sm"
                whileHover={HoverLift.whileHover}
                whileTap={{ scale: 0.98 }}
              >
                Explore Menu
              </motion.button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }} className="mt-10 grid gap-3 sm:grid-cols-3 max-w-2xl">
              <div className="rounded-2xl border border-primary/12 bg-white/75 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary"><Leaf className="h-4 w-4" /><span className="text-xs uppercase tracking-[0.18em]">Real ingredients</span></div>
                <p className="mt-2 text-sm text-foreground/62">Clean proteins, grains, greens, and bright toppings.</p>
              </div>
              <div className="rounded-2xl border border-primary/12 bg-white/75 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary"><Clock3 className="h-4 w-4" /><span className="text-xs uppercase tracking-[0.18em]">Easy routine</span></div>
                <p className="mt-2 text-sm text-foreground/62">Pickup-first flow built for everyday repeat ordering.</p>
              </div>
              <div className="rounded-2xl border border-primary/12 bg-white/75 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-xs uppercase tracking-[0.18em]">Consistent prep</span></div>
                <p className="mt-2 text-sm text-foreground/62">Designed to feel reliable, calm, and worth repeating.</p>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.12 }} className="relative lg:h-[720px]">

            <motion.div className="relative ml-auto max-w-[620px] rounded-[36px] border border-white/40 bg-white/70 p-4 shadow-xl">
              <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                <div className="relative overflow-hidden rounded-[28px] min-h-[420px]">
                  <ImageWithFallback src="https://images.unsplash.com/photo-1543332164-6e82f355badc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" alt="CULTIV bowl" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Featured bowl</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">Everyday Chicken Bowl</h3>
                    </div>
                    <div className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium">₹{featuredChickenPrice}</div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[28px] border border-white/45 bg-[#f7f6f1] p-4 shadow-sm">
                    <ImageWithFallback src="https://images.unsplash.com/photo-1610970881699-44a5587cabec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" alt="Green juice" className="h-44 w-full rounded-2xl object-cover" />
                    <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-primary/60">Light add-on</p>
                    <h4 className="mt-2 text-lg font-semibold">Green Juice</h4>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">Fresh, bright, and easy to add to a morning or post-workout order.</p>
                  </div>
                  <div className="rounded-[28px] border border-primary/12 bg-white/82 p-5 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary/60">The ritual</p>
                    <h4 className="mt-2 text-lg font-semibold tracking-tight">Designed to earn a place in your week.</h4>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">Simple food, honest ingredients, and a flow that makes repeat ordering feel natural.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-10" />
    </SectionReveal>
  );
}
