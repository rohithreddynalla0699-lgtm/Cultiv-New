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
