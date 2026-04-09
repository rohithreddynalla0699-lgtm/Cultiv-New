// OrderHistoryScreen — paginated order history with active order tracking and reorder shortcuts.

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, ReceiptText, Store, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { CardStagger, CardStaggerItem, HoverLift, PageReveal } from '../core/motion/cultivMotion';
import { ActiveOrderTracker } from './ActiveOrderTracker';
import type { Order } from '../types/platform';
import type { HomeOrderLaunchState, OrdersSuccessLocationState } from '../types/navigation';
import { mapOrderItemsToDraftLines, resolveReorderCategorySlug } from '../utils/orderReorder';
import { DEFAULT_FIRST_ORDER_CATEGORY_SLUG, PICKUP_ESTIMATE_WINDOW, POS_TAX_RATE } from '../constants/business';

type OrderFilter = 'all' | 'online' | 'instore';

const isInStoreOrder = (order: Order) =>
	order.orderType === 'walk_in' || order.source === 'walk_in' || order.source === 'walk-in';

export function OrderHistoryScreen() {
	const { user, orders, activeOrders } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');

	const successState = (location.state as OrdersSuccessLocationState | null) ?? null;

	if (!user) {
		return <Navigate to="/" replace />;
	}

	const sortedOrders = orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const onlineOrders = sortedOrders.filter((order) => order.source === 'app');
	const inStoreOrders = sortedOrders.filter((order) => isInStoreOrder(order));

	const filteredOrders = useMemo(() => {
		switch (activeFilter) {
			case 'online':
				return onlineOrders;
			case 'instore':
				return inStoreOrders;
			default:
				return sortedOrders;
		}
	}, [activeFilter, sortedOrders, onlineOrders, inStoreOrders]);

	const justPlacedOrder = successState?.orderId ? orders.find((order) => order.id === successState.orderId) : undefined;

	const tabData: Array<{ key: OrderFilter; label: string; count: number }> = [
		{ key: 'all', label: 'All', count: sortedOrders.length },
		{ key: 'online', label: 'Online', count: onlineOrders.length },
		{ key: 'instore', label: 'In-Store', count: inStoreOrders.length },
	];

	const getPaymentLabel = (order: Order) => {
		if (isInStoreOrder(order)) {
			return 'In-store counter';
		}
		if (user.paymentProfile.preferredMethod === 'card') {
			return 'Card';
		}
		if (user.paymentProfile.preferredMethod === 'upi') {
			return 'UPI';
		}
		return 'Saved method';
	};

	const handleReorder = (order: Order) => {
		const nextState: HomeOrderLaunchState = {
			openOrder: true,
			categorySlug: resolveReorderCategorySlug(order),
			reorderCartLines: mapOrderItemsToDraftLines(order),
			reorderSourceOrderId: order.id,
		};
		navigate('/', {
			state: nextState,
		});
	};

	const getGstBreakdown = (order: Order) => {
		const taxableSubtotal = Math.max(0, order.subtotal - order.rewardDiscount);
		const derivedGstAmount = Math.round(taxableSubtotal * POS_TAX_RATE * 100) / 100;
		const gstAmount = order.taxAmount ?? derivedGstAmount;
		const tipAmount = order.tipAmount ?? 0;
		const expectedTotal = Math.round((taxableSubtotal + gstAmount + tipAmount) * 100) / 100;
		const hasGstAwareTotal = Math.abs(expectedTotal - order.total) <= 0.05;
		return {
			hasGstAwareTotal,
			gstAmount,
			tipAmount,
		};
	};

	return (
		<PageReveal className="min-h-screen bg-[radial-gradient(circle_at_6%_10%,rgba(45,80,22,0.12),transparent_24%),radial-gradient(circle_at_94%_16%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] p-4">
			<div className="relative max-w-5xl mx-auto pt-24 md:pt-28 space-y-5">
				<div className="pointer-events-none absolute -top-8 left-6 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
				<div className="pointer-events-none absolute top-28 right-0 h-44 w-44 rounded-full bg-[#7E996C]/15 blur-3xl" />
				<Link to="/profile" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground text-sm font-medium mb-2">
					<ArrowLeft className="w-4 h-4" /> Back to Profile
				</Link>

				<div className="relative z-10 flex items-center gap-4">
					<Logo variant="emblem" animated />
					<div>
						<p className="text-xs uppercase tracking-[0.24em] text-primary/62">Your history with CULTIV</p>
						<h1 className="text-3xl font-semibold tracking-tight">Order History</h1>
						<p className="text-foreground/70">Revisit your meals, switch between online and in-store memories, and reorder in seconds.</p>
					</div>
				</div>

				{successState?.orderPlaced ? (
					<div className="relative z-10 rounded-2xl border border-primary/14 bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(241,246,236,0.82))] px-4 py-4 shadow-[0_10px_28px_rgba(45,80,22,0.1)]">
						<p className="text-sm font-semibold text-primary">Order placed successfully.</p>
						<p className="mt-1 text-xs text-foreground/68">Order number: #{successState.orderId?.slice(-6) ?? 'N/A'}</p>
						<p className="mt-1 text-xs text-foreground/68">
							Pickup window: {successState.fulfillmentWindow ?? PICKUP_ESTIMATE_WINDOW}
						</p>
						<div className="mt-3 rounded-xl border border-primary/10 bg-white/75 px-3 py-2">
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">What happens next</p>
							<ul className="mt-1 space-y-0.5 text-xs text-foreground/66">
								<li>1. Your order is now in the kitchen queue.</li>
								<li>2. Track status updates in real time below.</li>
								<li>3. Pickup when your order is marked ready.</li>
							</ul>
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							{successState.orderId ? (
								<Link
									to={`/orders/${successState.orderId}`}
									className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
								>
									Track Order
								</Link>
							) : null}
							{justPlacedOrder ? (
								<button
									type="button"
									onClick={() => handleReorder(justPlacedOrder)}
									className="inline-flex items-center gap-2 rounded-full border border-primary/18 px-4 py-2 text-xs font-semibold text-primary"
								>
									Reorder
								</button>
							) : null}
						</div>
					</div>
				) : null}

				{activeOrders[0] ? <motion.div variants={CardStaggerItem} className="relative z-10"><ActiveOrderTracker order={activeOrders[0]} compact /></motion.div> : null}

				<motion.div variants={CardStaggerItem} className="relative z-10 rounded-[28px] border border-primary/14 bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(241,246,236,0.82))] p-3 shadow-[0_18px_52px_rgba(45,80,22,0.11)]">
					<div className="flex flex-wrap gap-2">
						{tabData.map((tab) => {
							const isActive = activeFilter === tab.key;
							return (
								<motion.button
									key={tab.key}
									type="button"
									onClick={() => setActiveFilter(tab.key)}
									className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'text-primary-foreground' : 'text-foreground/70 hover:text-foreground'}`}
								>
									{isActive ? <motion.span layoutId="order-history-tab-indicator" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 280, damping: 24 }} /> : null}
									<span className="relative z-10">{tab.label} ({tab.count})</span>
								</motion.button>
							);
						})}
					</div>
				</motion.div>

				<AnimatePresence mode="wait">
					<motion.div
						key={activeFilter}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.22 }}
						className="relative z-10"
					>
						{filteredOrders.length === 0 ? (
							<div className="rounded-[30px] border border-primary/14 bg-[linear-gradient(155deg,rgba(255,255,255,0.92),rgba(240,246,233,0.82))] shadow-[0_18px_52px_rgba(45,80,22,0.11)] p-10 text-center">
								<Package className="w-12 h-12 text-primary mx-auto mb-4" />
								<h2 className="text-2xl font-semibold tracking-tight">Your CULTIV history starts here.</h2>
								<p className="mt-3 text-foreground/68 max-w-xl mx-auto">Once you place an order, it will appear here for quick reordering and tracking.</p>
								<button
									onClick={() => {
										const nextState: HomeOrderLaunchState = {
											openOrder: true,
											categorySlug: DEFAULT_FIRST_ORDER_CATEGORY_SLUG,
										};
										navigate('/', { state: nextState });
									}}
									className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
								>
									Order your first bowl
								</button>
							</div>
						) : (
							<CardStagger className="space-y-4">
								{filteredOrders.map((order) => {
									const statusLabel = order.statusTimeline.find((event) => event.status === order.status)?.label ?? order.status;
									// Status badge color for customer
									let statusBadgeClass = '';
									let statusBadgeLabel = '';
									switch (order.status) {
										case 'cancelled':
											statusBadgeClass = 'bg-rose-100 text-rose-700 border border-rose-200';
											statusBadgeLabel = 'Cancelled';
											break;
										case 'completed':
											statusBadgeClass = 'bg-primary/8 text-primary border border-primary/20';
											statusBadgeLabel = 'Completed';
											break;
								default:
									statusBadgeClass = 'bg-background/75 text-foreground/72 border border-border';
									statusBadgeLabel = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1).replace(/_/g, ' ');
									break;
							}
							const orderDate = new Date(order.createdAt);
							const inStoreOrder = isInStoreOrder(order);
							const modeLabel = inStoreOrder ? 'In-Store' : 'Online';
							const fulfillmentLabel = inStoreOrder ? 'In-Store' : 'Pickup';
							const itemTitles = order.items.map((item) => item.title);

									return (
										<motion.article
											key={order.id}
											variants={CardStaggerItem}
											whileHover={HoverLift.whileHover}
											className="rounded-[28px] border border-primary/14 bg-[linear-gradient(155deg,rgba(255,255,255,0.92),rgba(240,246,233,0.82))] p-6 shadow-[0_18px_52px_rgba(45,80,22,0.11)]"
										>
											<div className="flex flex-wrap items-start justify-between gap-4">
												<div className="space-y-1">
													<p className="text-sm font-semibold">Order #{order.id.slice(-6)}</p>
													<p className="text-sm text-foreground/62">{orderDate.toLocaleDateString()} • {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
												</div>
												<div className="flex flex-wrap items-center gap-2">
													<span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${inStoreOrder ? 'bg-[#EAF2E1] text-primary' : 'bg-primary/10 text-primary'}`}>
														{inStoreOrder ? <Store className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
														{modeLabel}
													</span>
													<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}>{statusBadgeLabel}</span>
												</div>
											</div>

											<div className="mt-4 rounded-2xl border border-primary/12 bg-[#F7FAF2] p-4">
												<p className="text-xs uppercase tracking-[0.2em] text-primary/58">Items</p>
												<ul className="mt-2 space-y-1 text-sm text-foreground/76">
													{itemTitles.map((title, index) => (
														<li key={`${order.id}-${title}-${index}`} className="leading-6">{title}</li>
													))}
												</ul>
											</div>

											<div className="mt-4 flex flex-wrap items-center justify-between gap-4">
												<div className="flex flex-wrap gap-2 text-xs text-foreground/68">
													<span className="rounded-full bg-background/75 px-3 py-1">Total: ₹{order.total.toFixed(2)}</span>
													{getGstBreakdown(order).hasGstAwareTotal ? <span className="rounded-full bg-background/75 px-3 py-1">GST: ₹{getGstBreakdown(order).gstAmount.toFixed(2)}</span> : null}
													{getGstBreakdown(order).hasGstAwareTotal ? <span className="rounded-full bg-background/75 px-3 py-1">Tip: ₹{getGstBreakdown(order).tipAmount.toFixed(2)}</span> : null}
													<span className="rounded-full bg-background/75 px-3 py-1">Payment: {getPaymentLabel(order)}</span>
													<span className="rounded-full bg-background/75 px-3 py-1">{fulfillmentLabel}</span>
												</div>
												<div className="flex flex-wrap gap-2">
													<motion.button
														onClick={() => handleReorder(order)}
														className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
														whileTap={{ scale: 0.97 }}
													>
														Reorder
													</motion.button>
													<Link to={`/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-sm font-medium text-primary">
														<ReceiptText className="h-4 w-4" />
														View Details
													</Link>
												</div>
											</div>
										</motion.article>
									);
								})}
							</CardStagger>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</PageReveal>
	);
}
