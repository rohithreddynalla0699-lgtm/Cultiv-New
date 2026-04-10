// platform.ts — shared TypeScript types for users, orders, loyalty profiles, addresses, and auth actions.

export type OrderStatus = 'placed' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';

export type OrderType = 'pickup' | 'walk_in';
export type CounterPaymentMethod = 'cash' | 'card' | 'upi';
export type CustomerCheckoutPaymentMethod = 'card' | 'upi';

export interface Address {
	id: string;
	userId: string;
	label: string;
	addressLine: string;
	landmark?: string;
	city: string;
	pincode: string;
	isDefault?: boolean;
}

export interface UserPreferences {
	favoriteCategory?: string;
	preferredOrderType?: 'pickup';
	preferredProtein?: string;
	dietaryPreference?: string;
	familyMealUsage?: boolean;
	kidsMealUsage?: boolean;
}

export type PaymentMethodType = 'card' | 'upi';

export interface SavedPaymentMethod {
	id: string;
	type: PaymentMethodType;
	label: string;
	last4?: string;
	upiId?: string;
	billingName?: string;
	isDefault?: boolean;
}

export interface PaymentProfile {
	preferredMethod?: PaymentMethodType;
	savedMethods: SavedPaymentMethod[];
	upiId?: string;
}

export interface User {
	id: string;
	fullName: string;
	phone: string;
	email?: string;
	createdAt: string;
	savedAddresses: Address[];
	preferences: UserPreferences;
	paymentProfile: PaymentProfile;
	defaultAddressId?: string;
	emailLocked?: boolean;
	phoneEditable?: boolean;
}

export interface OrderItemSelection {
	section: string;
	choices: string[];
}

export interface OrderItem {
	id: string;
	orderId: string;
	category: string;
	title: string;
	selections: OrderItemSelection[];
	quantity: number;
	price: number;
}

export interface OrderStatusEvent {
	status: OrderStatus;
	label: string;
	description: string;
	at: string;
}

export interface Order {
	id: string;
	userId?: string;
	customerId?: string | null;
	storeId?: string;
	category: string;
	items: OrderItem[];
	orderType: OrderType;
	subtotal: number;
	rewardDiscount: number;
	taxAmount?: number;
	total: number;
	status: OrderStatus;
	createdAt: string;
	phone: string;
	fullName: string;
	email: string;
	source: 'app' | 'walk_in' | 'phone';
	paymentMethod?: CounterPaymentMethod;
	tipPercentage?: number;
	tipAmount?: number;
	fulfillmentWindow: string;
	statusTimeline: OrderStatusEvent[];
	cancellation_reason?: string;
}

export interface Offer {
	id: string;
	title: string;
	description: string;
	type: string;
	value: string;
	active: boolean;
	eligibilityRule: string;
	pointCost?: number;
	badge?: string;
	/** How this offer is unlocked */
	unlockType?: 'first' | 'points' | 'orders' | 'spend' | 'inactivity';
	/** Threshold value for unlockType (points needed, orders needed, ₹ spend, or days inactive) */
	unlockValue?: number;
	/** True when this offer applies automatically — no manual redemption required */
	autoApply?: boolean;
}

export interface PointsBatch {
	points: number;
	earnedAt: number;
	expiresAt: number;
}

export interface PointsActivityItem {
	type: 'earn' | 'redeem' | 'expire';
	points: number;
	date: number;
	description: string;
}

export interface LoyaltyProfile {
	userId: string;
	pointsBatches: PointsBatch[];
	availablePoints: number;
	expiringSoonPoints: number;
	expiredPoints: number;
	availableRewards: string[];
	pointsActivity: PointsActivityItem[];
	totalOrders: number;
	totalSpend: number;
	currentTier: string;
}

export interface SignupInput {
	fullName: string;
	phone: string;
	email: string;
	password: string;
	confirmPassword?: string;
}

export interface LoginInput {
	identifier: string;
	password: string;
}

export interface PlaceOrderInput {
	category: string;
	items: Omit<OrderItem, 'orderId'>[];
	storeId: string;
	orderType: 'pickup';
	paymentMethod: CustomerCheckoutPaymentMethod;
	subtotal: number;
	rewardDiscount?: number;
	tipPercentage?: number;
	tipAmount?: number;
	usedRewardIds?: string[];
	total: number;
	fullName: string;
	phone: string;
	email: string;
	source?: 'app' | 'walk_in' | 'phone';
}

export interface CounterOrderItemInput {
	category: string;
	title: string;
	selections: OrderItemSelection[];
	quantity: number;
	price: number;
}

export interface CreateCounterWalkInOrderInput {
	storeId: string;
	fullName?: string;
	phone?: string;
	email?: string;
	linkedCustomerId?: string | null;
	orderChannel?: 'in_store';
	items: CounterOrderItemInput[];
	paymentMethod: CounterPaymentMethod;
	tipPercentage: number;
	tipAmount: number;
	placedBy?: string;
}

export interface AuthActionResult {
	success: boolean;
	message: string;
	resetToken?: string;
	verificationCode?: string;
	userExists?: boolean;
}

export interface WalkInLinkInput {
	phone: string;
	reference?: string;
}
