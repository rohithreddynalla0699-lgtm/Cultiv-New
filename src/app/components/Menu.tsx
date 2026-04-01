// Menu — full-page menu category gallery.

import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { PageReveal, CardStagger, CardStaggerItem, HoverLift } from '../core/motion/cultivMotion';
import { MENU_CATEGORIES } from '../data/menuData';

export function Menu() {
  return (
    <PageReveal className="min-h-screen bg-[linear-gradient(160deg,#f8f7f2_0%,#f2f5ea_50%,#f8f7f2_100%)]">
      <div className="pt-28 pb-20">
        <div className="container mx-auto px-6">

          {/* Page header */}
          <div className="mb-14 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/70 mb-3">What we serve</p>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">Our Menu</h1>
            <p className="mt-4 text-base md:text-lg text-foreground/60 max-w-2xl mx-auto leading-relaxed">
              Eight categories. Clean ingredients. Built for everyday eating.
            </p>
          </div>

          {/* Category grid */}
          <CardStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {MENU_CATEGORIES.map((category) => {
              const cardContent = (
                <>
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden">
                    <ImageWithFallback
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-semibold tracking-tight">{category.name}</h2>
                      <ArrowRight className="h-5 w-5 text-primary/60 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/62">{category.description}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.16em] text-foreground/45">{category.items.length} items</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        View Menu
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </>
              );

              return (
                <motion.div key={category.slug} variants={CardStaggerItem} whileHover={HoverLift.whileHover}>
                  <Link
                    to="/order"
                    state={{ categorySlug: category.slug }}
                    className="group block overflow-hidden rounded-[28px] border border-primary/12 bg-white shadow-md transition-shadow hover:shadow-xl"
                  >
                    {cardContent}
                  </Link>
                </motion.div>
              );
            })}
          </CardStagger>

        </div>
      </div>

    </PageReveal>
  );
}