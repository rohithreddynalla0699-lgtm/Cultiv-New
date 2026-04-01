// About — brand values section with three pillars: Growth, Discipline, and Consistency.

import { Target, TrendingUp, Repeat } from "lucide-react";
import { motion } from "framer-motion";
import { SectionReveal, CardStagger, CardStaggerItem, HoverLift } from "../core/motion/cultivMotion";

export function About() {
  const values = [
    {
      icon: TrendingUp,
      title: "Growth",
      description: "Small, steady wins that compound over time."
    },
    {
      icon: Target,
      title: "Discipline",
      description: "Reliable food choices that support daily intention."
    },
    {
      icon: Repeat,
      title: "Consistency",
      description: "A dependable rhythm you can return to every day."
    }
  ];

  return (
    <SectionReveal id="about" className="py-16 md:py-20 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[#F5F5F0] to-background" />
      
      {/* Grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.04]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid gap-8 md:gap-10 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight font-semibold leading-[0.94]">
              Not a trend.<br />A practice.
            </h2>
            <p className="mt-5 text-base md:text-lg text-foreground/70 leading-relaxed max-w-lg">
              CULTIV is built for repeatable, everyday eating — simple food, honest ingredients, and routines you can trust.
            </p>
          </div>

          <CardStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div 
                key={index}
                variants={CardStaggerItem}
                className="group bg-card/84 backdrop-blur-sm px-4 py-4 md:px-5 md:py-4 rounded-2xl border border-border/90 shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={HoverLift.whileHover}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-[0_8px_22px_rgba(45,80,22,0.22)] transition-all duration-300 group-hover:shadow-[0_10px_26px_rgba(45,80,22,0.30)] group-hover:-translate-y-0.5">
                    <Icon className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold tracking-tight">{value.title}</h3>
                    <p className="mt-1.5 text-sm md:text-[15px] text-foreground/68 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </CardStagger>
        </div>
      </div>
    </SectionReveal>
  );
}
