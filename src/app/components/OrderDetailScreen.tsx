// OrderDetailScreen — detailed view of a single order including live status timeline and item breakdown.

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ReceiptText, Clock, MapPin, Phone, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageReveal } from '../core/motion/cultivMotion';
import { Logo } from './Logo';
import { ActiveOrderTracker } from './ActiveOrderTracker';
import type { HomeOrderLaunchState } from '../types/navigation';
import { resolveCategorySlugFromLabel } from '../utils/categoryRouting';
import { mapOrderItemsToDraftLines } from '../utils/orderReorder';
import { DEFAULT_REORDER_FALLBACK_CATEGORY_SLUG, POS_TAX_RATE } from '../constants/business';

export function OrderDetailScreen() {
	const { user, getOrderById } = useAuth();
	const { orderId } = useParams();
	const navigate = useNavigate();

	if (!user) {
		return <Navigate to="/" replace />;
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

	const statusLabel = order.statusTimeline.find((event) => event.status === order.status)?.label ?? order.status;
	const isCompleted = order.status === 'completed';
	const sourceLabel = order.source === 'walk-in' ? 'In-Store' : 'Online';

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
						<h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">#{order.id.slice(-6)} — {order.category}</h1>
						<p className="mt-1 text-sm text-foreground/65">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
					</div>
				</div>

				{order.status !== 'completed' && <ActiveOrderTracker order={order} />}

				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="rounded-[30px] border border-primary/10 bg-white/85 p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
						<div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Order Items</p>
								<h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</h2>
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
									{item.selections.length > 0 && (
										<div className="mt-4 space-y-2 text-sm leading-6 text-foreground/66">
											{item.selections.map((selection) => (
												<p key={selection.section}>
													<span className="font-medium text-foreground/82">{selection.section}:</span> {selection.choices.join(', ')}
												</p>
											))}
										</div>
									)}
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
								<div className="flex items-center gap-2">
									<span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isCompleted ? 'bg-primary/8 text-primary' : 'bg-amber-50 text-amber-700'}`}>
										{statusLabel}
									</span>
								</div>
								<div className="border-t border-border/50 pt-3">
									<div className="flex justify-between"><span>Placed on</span><span className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</span></div>
									<div className="flex justify-between"><span>Type</span><span className="font-medium capitalize">{sourceLabel}</span></div>
									<div className="flex justify-between"><span>Mode</span><span className="font-medium capitalize">{order.orderType.replace('_', ' ')}</span></div>
								</div>
								<div className="border-t border-border/50 pt-3">
									<div className="flex justify-between"><span>Subtotal</span><span className="font-medium">₹{order.subtotal.toFixed(2)}</span></div>
									{order.rewardDiscount > 0 && <div className="flex justify-between text-primary"><span>Reward discount</span><span>-₹{order.rewardDiscount.toFixed(2)}</span></div>}
									{hasGstAwareTotal ? (
										<>
											<div className="flex justify-between"><span>Taxable subtotal</span><span className="font-medium">₹{taxableSubtotal.toFixed(2)}</span></div>
											<div className="flex justify-between"><span>GST (5%)</span><span className="font-medium">₹{gstAmount.toFixed(2)}</span></div>
											<div className="flex justify-between"><span>Tip</span><span className="font-medium">₹{tipAmount.toFixed(2)}</span></div>
										</>
									) : null}
									<div className="border-t border-border pt-3 flex justify-between text-base font-medium text-foreground"><span>Total Amount</span><span className="text-primary">₹{order.total.toFixed(2)}</span></div>
								</div>
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

						<div className="rounded-[30px] border border-primary/10 bg-white/85 p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
							<div className="flex items-center gap-3 mb-4">
								<div className="rounded-full bg-primary/8 p-3 text-primary">
									<MapPin className="h-5 w-5" />
								</div>
								<div>
									<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Pickup</p>
									<h3 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{order.storeLocation}</h3>
								</div>
							</div>
							<p className="text-sm text-foreground/65 ml-14">{order.fulfillmentWindow}</p>
						</div>

						<div className="rounded-[30px] border border-primary/10 bg-white/85 p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
							<div className="flex items-center gap-3 mb-4">
								<div className="rounded-full bg-primary/8 p-3 text-primary">
									<Phone className="h-5 w-5" />
								</div>
								<div>
									<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Customer Info</p>
									<h3 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{order.fullName}</h3>
								</div>
							</div>
							<div className="space-y-2 ml-14 text-sm text-foreground/65">
								<p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {order.phone}</p>
								{order.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {order.email}</p>}
							</div>
						</div>
					</div>
				</div>

				{!isCompleted && (
					<div className="rounded-[30px] border border-primary/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.92),rgba(241,246,236,0.82))] p-6 shadow-[0_18px_60px_rgba(45,80,22,0.08)]">
						<div className="flex items-center gap-3 mb-4">
							<div className="rounded-full bg-primary/8 p-3 text-primary">
								<Clock className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-primary/60">What Happens Next</p>
								<h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Order Timeline</h3>
							</div>
						</div>
						<ol className="space-y-3 text-sm text-foreground/70 ml-14">
							<li><span className="font-medium text-foreground">1. Kitchen Queue</span> — Your order is being prepared by our culinary team.</li>
							<li><span className="font-medium text-foreground">2. Ready Status</span> — You'll receive a notification when your order is ready to pick up.</li>
							<li><span className="font-medium text-foreground">3. Pickup Window</span> — Visit our location during {order.fulfillmentWindow} to collect your meal.</li>
							<li><span className="font-medium text-foreground">4. Enjoy!</span> — We hope you enjoy your CULTIV meal.</li>
						</ol>
					</div>
				)}
			</div>
		</PageReveal>
	);
}
