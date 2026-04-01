// Ecosystem — CULTIV phased roadmap listing five verticals with their current launch status.

import { Utensils, Sun, Leaf, Beaker, Dumbbell } from "lucide-react";
import { Logo } from "./Logo";

export function Ecosystem() {
  const phases = [
    {
      title: "BOWLS",
      tag: "Now Open",
      tagColor: "bg-primary text-primary-foreground",
      icon: Utensils,
      glow: "shadow-primary/20"
    },
    {
      title: "MORNING",
      subtitle: "(Juices + Breakfast Bowls)",
      tag: "Coming Next",
      tagColor: "bg-foreground/10 text-foreground backdrop-blur-sm",
      icon: Sun,
      glow: "shadow-foreground/5"
    },
    {
      title: "HARVEST",
      subtitle: "(Fresh-grown vegetables, greens, sourcing)",
      tag: "In Development",
      tagColor: "bg-foreground/10 text-foreground/70 backdrop-blur-sm",
      icon: Leaf,
      glow: "shadow-foreground/5"
    },
    {
      title: "CORE",
      subtitle: "(Nutrition blends, prebiotic powders, ABC formulas)",
      tag: "Research Phase",
      tagColor: "bg-foreground/10 text-foreground/60 backdrop-blur-sm",
      icon: Beaker,
      glow: "shadow-foreground/5"
    },
    {
      title: "PERFORMANCE",
      subtitle: "(Fitness centers and training spaces)",
      tag: "Long-Term Vision",
      tagColor: "bg-foreground/10 text-foreground/50 backdrop-blur-sm",
      icon: Dumbbell,
      glow: "shadow-foreground/5"
    }
  ];

  return (
    <section id="ecosystem" className="py-32 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-background" />
      
      {/* Grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.05]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl mb-6 tracking-tight font-semibold uppercase">
              The CULTIV<br />Ecosystem
            </h2>
            <p className="text-xl text-foreground/70 leading-relaxed max-w-2xl mx-auto">
              Built step by step. Each phase launches only when the previous one is stable.
            </p>
          </div>

          <div className="space-y-5">
            {phases.map((phase, index) => {
              const Icon = phase.icon;
              const isActive = index === 0;
              
              return (
                <div 
                  key={index}
                  className={`
                    relative bg-card/80 backdrop-blur-md rounded-2xl border border-border 
                    transition-all duration-300 hover:shadow-xl hover:scale-[1.01]
                    ${isActive ? 'shadow-lg shadow-primary/10' : 'shadow-md'}
                  `}
                >
                  {/* Glow effect for active phase */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl" />
                  )}
                  
                  <div className="relative p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-5 flex-1">
                        <div className={`
                          w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                          ${isActive 
                            ? 'bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30' 
                            : 'bg-foreground/5'
                          }
                        `}>
                          <Icon 
                            className={`w-7 h-7 ${isActive ? 'text-primary-foreground' : 'text-foreground/60'}`} 
                            strokeWidth={2} 
                          />
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="text-2xl font-semibold tracking-tight mb-1">
                            {phase.title}
                          </h3>
                          {phase.subtitle && (
                            <p className="text-sm text-foreground/60 mt-2">
                              {phase.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <span className={`
                        px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap
                        ${phase.tagColor}
                      `}>
                        {phase.tag}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <p className="text-foreground/50 text-sm font-medium tracking-wide">
              Built with discipline. Expanded with intention. Scaled with care.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}