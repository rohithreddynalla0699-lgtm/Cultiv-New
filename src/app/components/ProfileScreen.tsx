// ProfileScreen — member profile page for editing name, phone, and payment methods.

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CreditCard, LockKeyhole, LogOut, Mail, PencilLine, Phone, Plus, ShieldCheck, Star, Trash2, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { CardStagger, CardStaggerItem, HoverLift, PageReveal } from '../core/motion/cultivMotion';
import { WalkInLinkPrompt } from './WalkInLinkPrompt';

const inlineMessageMotion = {
	initial: { opacity: 0, y: 6 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -4 },
	transition: { duration: 0.2 },
};

const cardRevealMotion = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -6 },
	transition: { duration: 0.22 },
};

export function ProfileScreen() {
	const {
		user,
		logout,
		updateProfile,
		addSavedPaymentMethod,
		deleteSavedPaymentMethod,
		setDefaultPaymentMethod,
		requestPhoneChangeVerification,
		confirmPhoneChangeVerification,
	} = useAuth();
	const navigate = useNavigate();
	const [isEditingProfile, setIsEditingProfile] = useState(false);
	const [profileMessage, setProfileMessage] = useState('');
	const [profileForm, setProfileForm] = useState({
		fullName: user?.fullName ?? '',
	});
	const [newPhone, setNewPhone] = useState(user?.phone ?? '');
	const [otpCode, setOtpCode] = useState('');
	const [awaitingPhoneOtp, setAwaitingPhoneOtp] = useState(false);
	const [phoneMessage, setPhoneMessage] = useState('');
	const [mockOtpHint, setMockOtpHint] = useState('');
	const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
	const [paymentMessage, setPaymentMessage] = useState('');
	const [paymentForm, setPaymentForm] = useState({
		type: 'upi' as 'upi' | 'card',
		label: '',
		cardNumber: '',
		expiry: '',
		upiId: user?.paymentProfile?.upiId ?? '',
		billingName: user?.fullName ?? '',
		isDefault: !(user?.paymentProfile?.savedMethods.length ?? 0),
	});

	if (!user) {
		return <Navigate to="/" replace />;
	}

	const memberSince = new Date(user.createdAt).toLocaleDateString();

	const handleProfileUpdate = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!profileForm.fullName.trim()) {
			setProfileMessage('Please enter your name.');
			return;
		}

		const result = await updateProfile({
			fullName: profileForm.fullName,
		});

		setProfileMessage(result.message);
		if (result.success) {
			setIsEditingProfile(false);
		}
	};

	const handleRequestPhoneOtp = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = await requestPhoneChangeVerification(newPhone);
		setPhoneMessage(result.message);
		if (result.success) {
			setAwaitingPhoneOtp(true);
			setMockOtpHint(result.verificationCode ? `Demo OTP: ${result.verificationCode}` : '');
		}
	};

	const handleConfirmPhoneOtp = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!otpCode.trim()) {
			setPhoneMessage('Enter the OTP sent to your email.');
			return;
		}

		const result = await confirmPhoneChangeVerification(otpCode);
		setPhoneMessage(result.message);
		if (result.success) {
			setAwaitingPhoneOtp(false);
			setOtpCode('');
			setMockOtpHint('');
			setNewPhone(user.phone);
		}
	};

	const handlePaymentSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (paymentForm.type === 'upi' && !paymentForm.upiId.trim()) {
			setPaymentMessage('Please enter a UPI ID.');
			return;
		}

		const normalizedCardNumber = paymentForm.cardNumber.replace(/\D/g, '');
		if (paymentForm.type === 'card' && normalizedCardNumber.length !== 16) {
			setPaymentMessage('Please enter a valid 16-digit card number.');
			return;
		}
		if (paymentForm.type === 'card' && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(paymentForm.expiry.trim())) {
			setPaymentMessage('Use card expiry format MM/YY.');
			return;
		}

		const cardLast4 = paymentForm.type === 'card' ? normalizedCardNumber.slice(-4) : undefined;
		const paymentLabel = paymentForm.label.trim() || (paymentForm.type === 'card' ? `Card ending ${cardLast4}` : 'Primary UPI');

		const result = await addSavedPaymentMethod({
			type: paymentForm.type,
			label: paymentLabel,
			last4: cardLast4,
			upiId: paymentForm.type === 'upi' ? paymentForm.upiId : undefined,
			billingName: paymentForm.billingName || user.fullName,
			isDefault: paymentForm.isDefault,
		});

		setPaymentMessage(result.message);
		if (result.success) {
			setIsAddingPaymentMethod(false);
			setPaymentForm({
				type: 'upi',
				label: '',
				cardNumber: '',
				expiry: '',
				upiId: user.paymentProfile?.upiId ?? '',
				billingName: user.fullName,
				isDefault: false,
			});
		}
	};

	return (
		<PageReveal className="min-h-screen bg-[radial-gradient(circle_at_6%_10%,rgba(45,80,22,0.12),transparent_24%),radial-gradient(circle_at_94%_16%,rgba(126,153,108,0.16),transparent_28%),linear-gradient(160deg,#F1F4EC_0%,#F8F7F2_52%,#EEF3E8_100%)] p-4">
			<div className="relative max-w-5xl mx-auto pt-24 md:pt-28 space-y-6">
				<div className="pointer-events-none absolute -top-8 left-6 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
				<div className="pointer-events-none absolute top-28 right-0 h-44 w-44 rounded-full bg-[#7E996C]/15 blur-3xl" />
				<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/58">
					<Link to="/" className="inline-flex items-center gap-2 font-medium hover:text-foreground">
						<ArrowLeft className="w-4 h-4" /> Back to Home
					</Link>
					<p className="text-xs uppercase tracking-[0.18em] text-foreground/46">Account / Profile</p>
				</div>

				<CardStagger className="space-y-6">
					<motion.div variants={CardStaggerItem} className="bg-card rounded-3xl shadow-xl p-8 border border-border overflow-hidden relative">
						<div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[radial-gradient(circle_at_top_right,rgba(45,80,22,0.22),transparent_32%)]" />
						<div className="relative z-10">
							<div className="flex flex-wrap items-start justify-between gap-6 mb-8">
								<div className="flex items-center gap-4">
									<Logo variant="emblem" animated />
									<div>
										<p className="text-xs uppercase tracking-[0.24em] text-primary/62">Account summary</p>
										<h1 className="text-3xl font-semibold tracking-tight">Your CULTIV Profile</h1>
										<p className="text-foreground/70 max-w-xl">Manage your account details.</p>
										<p className="mt-2 text-xs text-foreground/55">Member since {memberSince}</p>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-3">
									<motion.button
										type="button"
										onClick={() => {
											setProfileMessage('');
											setIsEditingProfile((current) => !current);
										}}
										className="inline-flex items-center gap-2 rounded-full border border-primary/16 px-4 py-2 text-sm font-medium text-primary"
										whileHover={HoverLift.whileHover}
										whileTap={{ scale: 0.98 }}
									>
										<PencilLine className="h-4 w-4" />
										Edit Profile
									</motion.button>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="rounded-2xl bg-background/60 p-5 flex items-start gap-3">
									<User className="w-5 h-5 mt-0.5 text-foreground/50" />
									<div>
										<p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Full name</p>
										<p className="mt-2 font-medium">{user.fullName}</p>
									</div>
								</div>

								<div className="rounded-2xl bg-background/60 p-5 flex items-start gap-3">
									<Phone className="w-5 h-5 mt-0.5 text-foreground/50" />
									<div>
										<p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Phone</p>
										<p className="mt-2 font-medium">{user.phone}</p>
									</div>
								</div>

								<div className="rounded-2xl bg-background/60 p-5 flex items-start gap-3">
									<Mail className="w-5 h-5 mt-0.5 text-foreground/50" />
									<div>
										<div className="flex items-center gap-2">
											<p className="text-xs uppercase tracking-[0.18em] text-foreground/48">Email</p>
											<LockKeyhole className="h-3.5 w-3.5 text-foreground/40" />
										</div>
										<p className="mt-2 font-medium">{user.email || 'Email can be added later'}</p>
										<p className="mt-1 text-sm text-foreground/55">Phone changes are verified through this email.</p>
									</div>
								</div>
							</div>

							<AnimatePresence initial={false}>
								{isEditingProfile ? (
									<motion.form
										key="edit-profile-form"
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -6 }}
										transition={{ duration: 0.25 }}
										onSubmit={handleProfileUpdate}
										className="mt-6 rounded-[28px] border border-primary/12 bg-[linear-gradient(180deg,rgba(45,80,22,0.05),rgba(255,255,255,0.8))] p-6"
									>
										<div className="mb-4 flex items-start justify-between gap-4">
											<div>
												<p className="text-xs uppercase tracking-[0.2em] text-primary/60">Edit profile</p>
												<h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">Update the details CULTIV remembers.</h2>
											</div>
											<button type="button" onClick={() => setIsEditingProfile(false)} className="text-sm text-foreground/56">
												Close
											</button>
										</div>

										<div className="grid gap-3 md:grid-cols-2">
											<input
												value={profileForm.fullName}
												onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
												placeholder="Full name"
												className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
												required
											/>
											<div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground/60">
												Email stays locked to account history.
											</div>

											{!awaitingPhoneOtp ? (
												<>
													<input
														value={newPhone}
														onChange={(event) => setNewPhone(event.target.value)}
														placeholder="New phone number"
														className="rounded-2xl border border-border bg-white/85 px-4 py-3 outline-none transition-colors focus:border-primary"
													/>
													<motion.button
														type="button"
														onClick={handleRequestPhoneOtp}
														className="rounded-full border border-primary/16 px-5 py-3 text-sm font-medium text-primary"
														whileHover={HoverLift.whileHover}
														whileTap={{ scale: 0.98 }}
													>
														Send OTP
													</motion.button>
												</>
											) : (
												<>
													<input
														value={otpCode}
														onChange={(event) => setOtpCode(event.target.value)}
														placeholder="Enter OTP from email"
														className="rounded-2xl border border-border bg-white/85 px-4 py-3 outline-none transition-colors focus:border-primary"
													/>
													<motion.button
														type="button"
														onClick={handleConfirmPhoneOtp}
														className="rounded-full border border-primary/16 px-5 py-3 text-sm font-medium text-primary"
														whileHover={HoverLift.whileHover}
														whileTap={{ scale: 0.98 }}
													>
														Verify Phone
													</motion.button>
												</>
											)}
										</div>

										<AnimatePresence mode="popLayout" initial={false}>
											{phoneMessage ? (
												<motion.p key="phone-message" className="mt-3 text-sm text-foreground/62" {...inlineMessageMotion}>
													{phoneMessage}
												</motion.p>
											) : null}

											{mockOtpHint ? (
												<motion.p key="otp-hint" className="mt-1 text-xs text-primary/70" {...inlineMessageMotion}>
													{mockOtpHint}
												</motion.p>
											) : null}

											{profileMessage ? (
												<motion.p key="profile-message" className="mt-4 text-sm text-foreground/62" {...inlineMessageMotion}>
													{profileMessage}
												</motion.p>
											) : null}
										</AnimatePresence>

										<div className="mt-5 flex justify-end">
											<motion.button
												type="submit"
												className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
												whileHover={HoverLift.whileHover}
												whileTap={{ scale: 0.98 }}
											>
												Save Profile
											</motion.button>
										</div>
									</motion.form>
								) : null}
							</AnimatePresence>
						</div>
					</motion.div>

					<motion.div variants={CardStaggerItem} className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
						<div className="space-y-6">
							<div className="rounded-[28px] border border-primary/10 bg-white/80 p-6 shadow-[0_16px_48px_rgba(45,80,22,0.07)]">
								<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Saved details</p>
								<h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Pickup-first ordering profile.</h3>
								<p className="mt-2 text-sm leading-6 text-foreground/62">Your account keeps essentials ready for faster pickup and repeat ordering.</p>
							</div>
							<WalkInLinkPrompt defaultPhone={user.phone} />
						</div>

						<div className="space-y-6">
							<div className="rounded-[28px] border border-primary/10 bg-white/85 p-6 shadow-[0_16px_48px_rgba(45,80,22,0.07)]">
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Payment details</p>
										<h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Saved payment methods.</h2>
										<p className="mt-2 text-sm leading-6 text-foreground/62">Keep cards and UPI preferences ready for a lighter checkout.</p>
									</div>
									<motion.button
										type="button"
										onClick={() => {
											setPaymentMessage('');
											setIsAddingPaymentMethod((current) => !current);
										}}
										className="inline-flex items-center gap-2 rounded-full border border-primary/16 px-4 py-2 text-sm font-medium text-primary"
										whileHover={HoverLift.whileHover}
										whileTap={{ scale: 0.98 }}
									>
										<Plus className="h-4 w-4" />
										{isAddingPaymentMethod ? 'Close' : 'Add payment'}
									</motion.button>
								</div>

								<div className="mt-5 space-y-3">
									<AnimatePresence mode="popLayout" initial={false}>
										{user.paymentProfile.savedMethods.length === 0 ? (
											<motion.div
												key="empty-payment-state"
												className="rounded-2xl border border-dashed border-primary/16 bg-primary/[0.03] p-5 text-sm leading-6 text-foreground/62"
												{...cardRevealMotion}
											>
												No saved payment methods yet. Add a preferred method to make future ordering smoother.
											</motion.div>
										) : (
											user.paymentProfile.savedMethods.map((method, index) => (
												<motion.div
													key={method.id}
													className="rounded-2xl border border-border bg-background/70 p-4"
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: -6 }}
													transition={{ duration: 0.22, delay: index * 0.04 }}
													layout
												>
													<div className="flex items-start justify-between gap-3">
														<div className="flex items-start gap-3">
															<div className="rounded-full bg-primary/8 p-2 text-primary">
																<CreditCard className="h-4 w-4" />
															</div>
															<div>
																<div className="flex flex-wrap items-center gap-2">
																	<p className="font-medium">{method.label}</p>
																	{method.isDefault ? (
																		<motion.span
																			initial={{ opacity: 0, scale: 0.96 }}
																			animate={{ opacity: 1, scale: 1 }}
																			className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-primary"
																		>
																			Default
																		</motion.span>
																	) : null}
																</div>
																<p className="mt-1 text-sm text-foreground/60">
																	{method.type === 'upi' ? method.upiId : method.last4 ? `Card ending ${method.last4}` : 'Saved card'}
																	{method.billingName ? ` • ${method.billingName}` : ''}
																</p>
															</div>
														</div>

														<div className="flex items-center gap-2">
															<motion.button
																type="button"
																onClick={async () => {
																	const result = await setDefaultPaymentMethod(method.id);
																	setPaymentMessage(result.message);
																}}
																className="rounded-full border border-border p-2 text-foreground/55 transition-colors hover:border-primary hover:text-primary"
																aria-label="Set default payment method"
																whileHover={HoverLift.whileHover}
																whileTap={{ scale: 0.96 }}
															>
																<Star className="h-4 w-4" />
															</motion.button>

															<motion.button
																type="button"
																onClick={async () => {
																	const result = await deleteSavedPaymentMethod(method.id);
																	setPaymentMessage(result.message);
																}}
																className="rounded-full border border-border p-2 text-foreground/55 transition-colors hover:border-red-300 hover:text-red-600"
																aria-label="Delete payment method"
																whileHover={HoverLift.whileHover}
																whileTap={{ scale: 0.96 }}
															>
																<Trash2 className="h-4 w-4" />
															</motion.button>
														</div>
													</div>
												</motion.div>
											))
										)}
									</AnimatePresence>
								</div>

								<AnimatePresence initial={false}>
									{isAddingPaymentMethod ? (
										<motion.form
											key="add-payment-form"
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											transition={{ duration: 0.25 }}
											onSubmit={handlePaymentSubmit}
											className="mt-5 grid gap-3"
										>
											<select
												value={paymentForm.type}
												onChange={(event) => setPaymentForm((current) => ({ ...current, type: event.target.value as 'upi' | 'card' }))}
												className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
											>
												<option value="upi">UPI</option>
												<option value="card">Card</option>
											</select>

											<input
												value={paymentForm.label}
												onChange={(event) => setPaymentForm((current) => ({ ...current, label: event.target.value }))}
												placeholder={paymentForm.type === 'card' ? 'Card label (optional)' : 'Label'}
												className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
											/>

											{paymentForm.type === 'card' ? (
												<input
													value={paymentForm.cardNumber}
													onChange={(event) => setPaymentForm((current) => ({ ...current, cardNumber: event.target.value }))}
													placeholder="Card number"
													className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
													maxLength={19}
												/>
											) : null}

											{paymentForm.type === 'card' ? (
												<input
													value={paymentForm.expiry}
													onChange={(event) => setPaymentForm((current) => ({ ...current, expiry: event.target.value }))}
													placeholder="Expiry (MM/YY)"
													className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
													maxLength={5}
												/>
											) : null}

											{paymentForm.type === 'upi' ? (
												<input
													value={paymentForm.upiId}
													onChange={(event) => setPaymentForm((current) => ({ ...current, upiId: event.target.value }))}
													placeholder="UPI ID"
													className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
												/>
											) : null}

											<input
												value={paymentForm.billingName}
												onChange={(event) => setPaymentForm((current) => ({ ...current, billingName: event.target.value }))}
												placeholder={paymentForm.type === 'card' ? 'Name on card' : 'Billing name'}
												className="rounded-2xl border border-border bg-white/80 px-4 py-3 outline-none transition-colors focus:border-primary"
											/>

											<label className="inline-flex items-center gap-2 text-sm text-foreground/66">
												<input
													type="checkbox"
													checked={paymentForm.isDefault}
													onChange={(event) => setPaymentForm((current) => ({ ...current, isDefault: event.target.checked }))}
													className="h-4 w-4 rounded border-border accent-primary"
												/>
												Set as preferred payment method
											</label>

											<AnimatePresence initial={false}>
												{paymentMessage ? (
													<motion.p key="payment-message" className="text-sm text-foreground/62" {...inlineMessageMotion}>
														{paymentMessage}
													</motion.p>
												) : null}
											</AnimatePresence>

											<div className="flex justify-end">
												<motion.button
													type="submit"
													className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
													whileHover={HoverLift.whileHover}
													whileTap={{ scale: 0.98 }}
												>
													Save Payment Method
												</motion.button>
											</div>
										</motion.form>
									) : null}
								</AnimatePresence>

								<AnimatePresence initial={false}>
									{!isAddingPaymentMethod && paymentMessage ? (
										<motion.p key="payment-message-inline" className="mt-4 text-sm text-foreground/62" {...inlineMessageMotion}>
											{paymentMessage}
										</motion.p>
									) : null}
								</AnimatePresence>
							</div>

							<div className="bg-card rounded-3xl shadow-xl p-8 border border-border">
								<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Account actions</p>
								<div className="mt-5 grid gap-3">
									<div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 px-5 py-4">
										<div className="text-left">
											<p className="font-medium">Support</p>
											<p className="mt-1 text-sm text-foreground/58">Secure support tools and account assistance are coming soon.</p>
										</div>
										<ShieldCheck className="h-5 w-5 text-foreground/40" />
									</div>

									<motion.button
										onClick={() => {
											logout();
											navigate('/', { replace: true });
										}}
										className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-700"
										whileHover={HoverLift.whileHover}
										whileTap={{ scale: 0.98 }}
									>
										<div className="text-left">
											<p className="font-medium">Sign Out</p>
											<p className="mt-1 text-sm text-red-700/72">Leave this member space and return to the menu.</p>
										</div>
										<LogOut className="w-5 h-5" />
									</motion.button>
								</div>
							</div>
						</div>
					</motion.div>
				</CardStagger>
			</div>
		</PageReveal>
	);
}