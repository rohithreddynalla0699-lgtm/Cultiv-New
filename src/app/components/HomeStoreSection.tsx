import { motion } from 'framer-motion';
import { ArrowRight, Clock3, MapPin, Navigation2 } from 'lucide-react';
import { CardStagger, CardStaggerItem, HoverLift, SectionReveal } from '../core/motion/cultivMotion';

interface HomeStoreSectionProps {
  onOrderClick: () => void;
}

const STORES = [
  {
    name: 'Siddipet Central',
    tag: 'Most ordered',
    detail: 'Pickup in 18–28 min',
  },
  {
    name: 'Komati Cheruvu Side',
    tag: 'Closest pickup',
    detail: 'Ideal for lunch pickup and after-work bowls',
  },
  {
    name: 'Prashanth Nagar',
    tag: 'Expanding soon',
    detail: 'Scaffolded next-zone service for nearby neighborhoods',
  },
] as const;

export function HomeStoreSection({ onOrderClick }: HomeStoreSectionProps) {
  return (
    <SectionReveal id="locations" className="relative overflow-hidden bg-background py-20 md:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f6f5ef_0%,#eff4e8_45%,#f7f6f1_100%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div className="rounded-[34px] border border-primary/12 bg-white/90 p-7 md:p-8 shadow-lg">
              <p className="text-xs uppercase tracking-[0.22em] text-primary/70">Find your CULTIV</p>
              <h2 className="mt-3 text-4xl md:text-5xl tracking-tight font-semibold">Every pickup starts with the right store.</h2>
              <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-foreground/62">Choose the store that matches your route and pickup routine. Your order will be ready at the counter in 18–28 minutes.</p>

              <div className="mt-8 rounded-[28px] border border-primary/16 bg-[linear-gradient(145deg,rgba(45,80,22,0.08),rgba(255,255,255,0.96))] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary/60">Selected store</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Siddipet Central</h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground/60">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Central district</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> 11 AM – 9 PM</span>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    onClick={onOrderClick}
                    whileHover={HoverLift.whileHover}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                  >
                    Order from this store
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>

            <CardStagger className="grid gap-4">
              {STORES.map((store) => (
                <motion.div
                  key={store.name}
                  variants={CardStaggerItem}
                  whileHover={HoverLift.whileHover}
                  className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-primary/60">{store.tag}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">{store.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-foreground/62">{store.detail}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Navigation2 className="h-4.5 w-4.5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardStagger>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}