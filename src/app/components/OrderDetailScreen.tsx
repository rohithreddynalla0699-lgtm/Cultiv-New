// OrderDetailScreen — detailed view of a single order including live status timeline and item breakdown.

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { Logo } from './Logo';
import { ActiveOrderTracker } from './ActiveOrderTracker';
import type { AuthRedirectState, HomeOrderLaunchState } from '../types/navigation';
import { resolveCategorySlugFromLabel } from '../utils/categoryRouting';
import { mapOrderItemsToDraftLines } from '../utils/orderReorder';
import { DEFAULT_REORDER_FALLBACK_CATEGORY_SLUG, POS_TAX_RATE } from '../constants/business';

export function OrderDetailScreen() {
	const { user, getOrderById } = useAuth();
	const { orderId } = useParams();
	const navigate = useNavigate();

	if (!user) {
		const nextState: AuthRedirectState = { from: `/orders/${orderId ?? ''}` };
		return <Navigate to="/login" replace state={nextState} />;
	}

	const order = orderId ? getOrderById(orderId) : undefined;
	if (!order) {
		return <Navigate to="/orders" replace />;
	}

	const taxableSubtotal = Math.max(0, order.subtotal - order.rewardDiscount);
	const derivedGstAmount = Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100;
	const gstAmount = order.taxAmount ?? derivedGstAmount;
	const tipAmount = order.tipAmount ?? 0;
	const expectedGstTotal = Math.round((taxableSubtotal + gstAmount + tipAmount) * 100) / 100;
	const hasGstAwareTotal = Math.abs(expectedGstTotal - order.total) <= 0.05;

	return (
		<PageReveal className="min-h-screen bg-gradient-to-br from-[#f5f5f0] via-background to-[#f7f6f2] px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-5xl space-y-6">
				<Link to="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground">
					<ArrowLeft className="h-4 w-4" />
					Back to Order History
				</Link>

				<div className="flex flex-wrap items-center gap-4">
					<Logo variant="emblem" animated />
					<div>
						<p className="text-xs uppercase tracking-[0.24em] text-primary/60">Order detail</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Keep every CULTIV order in view.</h1>
					</div>
				</div>

				{order.status !== 'completed' ? <ActiveOrderTracker order={order} /> : null}

				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="rounded-[30px] border border-primary/10 bg-white/85 p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
						<div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Order #{order.id.slice(-6)}</p>
								<h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{order.category}</h2>
							</div>
							<div className="rounded-full bg-primary/6 px-4 py-2 text-sm font-medium text-primary">₹{order.total}</div>
						</div>

						<div className="mt-6 space-y-4">
							{order.items.map((item) => (
								<div key={item.id} className="rounded-2xl border border-border bg-background/80 p-5">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="font-medium">{item.title}</p>
											<p className="text-sm text-foreground/55">{item.quantity} x {item.category}</p>
										</div>
										<p className="font-medium text-primary">₹{item.price}</p>
									</div>
									<div className="mt-4 space-y-2 text-sm leading-6 text-foreground/66">
										{item.selections.map((selection) => (
											<p key={selection.section}>
												<span className="font-medium text-foreground/82">{selection.section}:</span> {selection.choices.join(', ')}
											</p>
										))}
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="space-y-6">
						<div className="rounded-[30px] border border-primary/10 bg-white/85 p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
							<div className="flex items-center gap-3">
								<div className="rounded-full bg-primary/8 p-3 text-primary">
									<ReceiptText className="h-5 w-5" />
								</div>
								<div>
									<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Summary</p>
									<h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Order details</h3>
								</div>
							</div>

							<div className="mt-5 space-y-3 text-sm text-foreground/66">
								<div className="flex justify-between"><span>Placed on</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
								<div className="flex justify-between"><span>Order type</span><span className="capitalize">{order.orderType.replace('_', ' ')}</span></div>
								<div className="flex justify-between"><span>Status</span><span>{order.statusTimeline.find((event) => event.status === order.status)?.label}</span></div>
								<div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
								{order.rewardDiscount > 0 ? <div className="flex justify-between text-primary/80"><span>Reward discount</span><span>-₹{order.rewardDiscount.toFixed(2)}</span></div> : null}
								{hasGstAwareTotal ? (
									<>
										<div className="flex justify-between"><span>Taxable subtotal</span><span>₹{taxableSubtotal.toFixed(2)}</span></div>
										<div className="flex justify-between"><span>GST</span><span>₹{gstAmount.toFixed(2)}</span></div>
										<div className="flex justify-between"><span>Tip</span><span>₹{tipAmount.toFixed(2)}</span></div>
									</>
								) : null}
								<div className="flex justify-between border-t border-border pt-3 text-base font-medium text-foreground"><span>Total</span><span>₹{order.total.toFixed(2)}</span></div>
							</div>

							<div className="mt-6 space-y-2 rounded-2xl border border-border bg-background/75 p-4 text-sm leading-6 text-foreground/64">
								<p><span className="font-medium text-foreground/82">Customer:</span> {order.fullName}</p>
								<p><span className="font-medium text-foreground/82">Phone:</span> {order.phone}</p>
							</div>

							<button
								onClick={() => {
									const nextState: HomeOrderLaunchState = {
										openOrder: true,
										categorySlug: resolveCategorySlugFromLabel(order.category) ?? DEFAULT_REORDER_FALLBACK_CATEGORY_SLUG,
										reorderCartLines: mapOrderItemsToDraftLines(order),
										reorderSourceOrderId: order.id,
									};
									navigate('/', { state: nextState });
								}}
								className="mt-6 w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92"
							>
								Reorder This Meal
							</button>
						</div>
					</div>
				</div>
			</div>
		</PageReveal>
	);
}
