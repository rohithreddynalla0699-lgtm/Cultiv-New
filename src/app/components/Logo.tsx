// Logo — CULTIV brand mark rendered in wordmark, emblem, or sub-brand variants.

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { LogoAnimation } from "../core/motion/cultivMotion";

interface LogoProps {
  variant?: "wordmark" | "emblem" | "subBrand";
  subBrandName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

export function Logo({ variant = "wordmark", subBrandName, size = "md", className = "", animated = false }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };

  const subBrandSizeClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs"
  };

  const wrapAnimated = (content: ReactNode) => {
    if (!animated) return content;
    return (
      <motion.div initial={LogoAnimation.initial} animate={LogoAnimation.animate}>
        {content}
      </motion.div>
    );
  };

  // Emblem variant - circular with CULTIV inside
  if (variant === "emblem") {
    const emblem = (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <div className="relative w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="text-sm tracking-[-0.02em] font-semibold leading-none">
              CULTI<span className="relative inline-block">
                V
                <svg 
                  viewBox="0 0 12 2" 
                  className="absolute -bottom-0.5 left-0 w-full h-[2px]"
                  fill="currentColor"
                >
                  <rect x="0" y="0" width="12" height="0.5" opacity="0.4" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    return wrapAnimated(emblem);
  }

  // Sub-brand variant - CULTIV with phase name below
  if (variant === "subBrand" && subBrandName) {
    return wrapAnimated(
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <div className={`${sizeClasses[size]} tracking-[-0.02em] font-semibold leading-none`}>
          CULTI<span className="relative inline-block">
            V
            <svg 
              viewBox="0 0 20 2" 
              className="absolute -bottom-1 left-0 w-full h-[2px]"
              fill="currentColor"
            >
              <rect x="0" y="0" width="20" height="0.5" opacity="0.5" />
            </svg>
          </span>
        </div>
        <div className={`${subBrandSizeClasses[size]} tracking-[0.15em] font-medium text-foreground/70 uppercase`}>
          {subBrandName}
        </div>
      </div>
    );
  }

  // Wordmark only variant
  return wrapAnimated(
    <div className={`${sizeClasses[size]} tracking-[-0.02em] font-semibold leading-none ${className}`}>
      CULTI<span className="relative inline-block">
        V
        <svg 
          viewBox="0 0 20 2" 
          className="absolute -bottom-1 left-0 w-full h-[2px]"
          fill="currentColor"
        >
          <rect x="0" y="0" width="20" height="0.5" opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}