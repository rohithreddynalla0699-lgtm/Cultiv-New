// cultivMotion — Framer Motion primitives: animation variants, SectionReveal, CardStagger, and PageReveal.

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const PageRevealVariants = {
	hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
	visible: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.55 }
	}
};

export const CardStaggerItem = {
	hidden: { opacity: 0, y: 12 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.3 }
	}
};

export const HoverLift = {
	whileHover: {
		y: -2,
		transition: { duration: 0.2 }
	}
};

export const ModalTransition = {
	hidden: { opacity: 0, y: 14, scale: 0.985, filter: "blur(4px)" },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		filter: "blur(0px)",
		transition: { duration: 0.3 }
	},
	exit: {
		opacity: 0,
		y: 10,
		scale: 0.99,
		filter: "blur(3px)",
		transition: { duration: 0.2 }
	}
};

export const LogoAnimation = {
	initial: { opacity: 0, y: 6, scale: 0.98 },
	animate: {
		opacity: 1,
		y: 0,
		scale: [1, 1.015, 1],
		transition: {
			opacity: { duration: 0.45 },
			y: { duration: 0.45 },
			scale: { duration: 3.6, repeat: Infinity }
		}
	}
};

// Error shake feedback
export const ErrorShake = {
	animate: {
		x: [-4, 4, -4, 4, 0],
		transition: { duration: 0.4 }
	}
};

// List item entrance (admin boards, order history)
export const ListItemReveal = {
	hidden: { opacity: 0, x: -8 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.25 }
	}
};

// Loading pulse for disabled buttons, spinners
export const LoadingPulse = {
	animate: {
		opacity: [0.6, 1, 0.6],
		transition: { duration: 1.5, repeat: Infinity }
	}
};

// Counter/number animation (points, totals, quantities)
export const CounterPulse = {
	initial: { scale: 1 },
	animate: {
		scale: [1, 1.1, 1],
		transition: { duration: 0.5 }
	}
};

// Success checkmark/state
export const SuccessBounce = {
	initial: { scale: 0, opacity: 0 },
	animate: {
		scale: [0, 1.2, 1],
		opacity: 1,
		transition: { duration: 0.4 }
	}
};

// Collapse/expand panel animation
export const PanelExpand = {
	hidden: { height: 0, opacity: 0 },
	visible: {
		height: "auto",
		opacity: 1,
		transition: { duration: 0.3 }
	},
	exit: {
		height: 0,
		opacity: 0,
		transition: { duration: 0.2 }
	}
};

// Dropdown entrance animation
export const DropdownSlide = {
	hidden: { opacity: 0, y: -8 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.15 }
	},
	exit: {
		opacity: 0,
		y: -8,
		transition: { duration: 0.1 }
	}
};

interface SectionRevealProps {
	id?: string;
	className?: string;
	children: ReactNode;
}

export function PageReveal({ id, className, children }: SectionRevealProps) {
	return (
		<motion.div
			id={id}
			className={className}
			initial="hidden"
			animate="visible"
			variants={PageRevealVariants}
		>
			{children}
		</motion.div>
	);
}

export function SectionReveal({ id, className, children }: SectionRevealProps) {
	return (
		<motion.section
			id={id}
			className={className}
			initial={{ opacity: 0, y: 16 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.2 }}
			transition={{ duration: 0.45 }}
		>
			{children}
		</motion.section>
	);
}

interface CardStaggerProps {
	className?: string;
	children: ReactNode;
}

export function CardStagger({ className, children }: CardStaggerProps) {
	return (
		<motion.div
			className={className}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, amount: 0.2 }}
			variants={{
				hidden: { opacity: 0 },
				visible: {
					opacity: 1,
					transition: {
						staggerChildren: 0.08,
						delayChildren: 0.05
					}
				}
			}}
		>
			{children}
		</motion.div>
	);
}
