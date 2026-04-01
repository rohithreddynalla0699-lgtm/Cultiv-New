// SavedAddressesSection — add, edit, delete, and set-default saved addresses within the profile.

import { useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SavedAddressesSection() {
	const { user, addSavedAddress, updateSavedAddress, deleteSavedAddress, setDefaultAddress } = useAuth();
	const [isAdding, setIsAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [message, setMessage] = useState('');
	const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error'>('info');
	const [form, setForm] = useState({ label: 'Home', addressLine: '', landmark: '', city: '', pincode: '', isDefault: false });

	if (!user) {
		return null;
	}

	const resetForm = () => {
		setForm({ label: 'Home', addressLine: '', landmark: '', city: '', pincode: '', isDefault: false });
		setIsAdding(false);
		setEditingId(null);
	};

	const validateForm = () => {
		const normalizedLabel = form.label.trim().toLowerCase();
		if (!normalizedLabel) return 'Label is required.';

		const duplicateLabel = user.savedAddresses.some((address) => {
			if (editingId && address.id === editingId) return false;
			return address.label.trim().toLowerCase() === normalizedLabel;
		});
		if (duplicateLabel) return 'This label already exists. Please use a unique label.';

		if (form.addressLine.trim().length < 8) return 'Please enter a fuller address.';
		if (!/^\d{6}$/.test(form.pincode.trim())) return 'Use a valid 6-digit pincode.';
		if (!form.city.trim()) return 'City is required.';
		return '';
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const validationMessage = validateForm();
		if (validationMessage) {
			setMessage(validationMessage);
			setMessageTone('error');
			return;
		}

		const result = editingId ? await updateSavedAddress({ id: editingId, ...form }) : await addSavedAddress(form);
		setMessage(result.message);
		setMessageTone(result.success ? 'success' : 'error');
		if (result.success) {
			resetForm();
		}
	};

	return (
		<div className="rounded-[28px] border border-primary/10 bg-white/80 p-6 shadow-[0_16px_48px_rgba(45,80,22,0.07)]">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-primary/60">Saved details</p>
					<h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Keep your order details ready.</h3>
				</div>
				<button
					type="button"
					onClick={() => {
						setMessage('');
						setMessageTone('info');
						if (editingId) resetForm();
						else setIsAdding((current) => !current);
					}}
					className="inline-flex items-center gap-2 rounded-full border border-primary/18 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/8"
				>
					<Plus className="h-4 w-4" />
					{editingId ? 'Close editor' : 'Add address'}
				</button>
			</div>

			<div className="mt-5 grid gap-3">
				{user.savedAddresses.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-primary/18 bg-primary/[0.03] p-5 text-sm leading-6 text-foreground/64 md:col-span-2">
						No saved details yet. Add one now so future checkouts stay simple.
					</div>
				) : (
					user.savedAddresses.map((address) => (
						<div key={address.id} className="rounded-2xl border border-border bg-background/80 p-5">
							<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
								<div className="min-w-0 flex items-start gap-3">
								<div className="mt-0.5 rounded-full bg-primary/8 p-2 text-primary">
									<MapPin className="h-4 w-4" />
								</div>
									<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium">{address.label}</p>
										{address.isDefault ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-primary">Default</span> : null}
									</div>
										<p className="mt-1 text-sm leading-6 text-foreground/66 whitespace-normal">{address.addressLine}</p>
										<p className="text-sm leading-6 text-foreground/56 whitespace-normal">{[address.landmark, `${address.city} ${address.pincode}`].filter(Boolean).join(' • ')}</p>
								</div>
							</div>
								<div className="shrink-0 self-start flex items-center gap-2">
									<button
										type="button"
										onClick={async () => {
											const result = await setDefaultAddress(address.id);
											setMessage(result.message);
											setMessageTone(result.success ? 'success' : 'error');
										}}
										className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
											address.isDefault
												? 'border-primary bg-primary/12 text-primary'
												: 'border-border text-foreground/55 hover:border-primary hover:text-primary'
										}`}
										aria-label="Set default address"
									>
										<Star className={`h-4 w-4 ${address.isDefault ? 'fill-primary' : ''}`} />
									</button>
									<button type="button" onClick={() => { setEditingId(address.id); setIsAdding(false); setMessage(''); setMessageTone('info'); setForm({ label: address.label, addressLine: address.addressLine, landmark: address.landmark ?? '', city: address.city, pincode: address.pincode, isDefault: Boolean(address.isDefault) }); }} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/55 transition-colors hover:border-primary hover:text-primary" aria-label="Edit address">
										<Pencil className="h-4 w-4" />
									</button>
									<button type="button" onClick={async () => { const result = await deleteSavedAddress(address.id); setMessage(result.message); setMessageTone(result.success ? 'success' : 'error'); if (editingId === address.id) resetForm(); }} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/55 transition-colors hover:border-red-300 hover:text-red-600" aria-label="Delete address">
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{isAdding || editingId ? (
				<form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
					<p className="md:col-span-2 text-xs text-foreground/55">Fields marked <span className="text-primary">*</span> are mandatory.</p>
					<label className="grid gap-1 text-sm text-foreground/72">
						<span>Label <span className="text-primary">*</span></span>
						<input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Home, Work, Office" className="rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" required />
					</label>
					<label className="grid gap-1 text-sm text-foreground/72">
						<span>City <span className="text-primary">*</span></span>
						<input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" className="rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" required />
					</label>
					<label className="md:col-span-2 grid gap-1 text-sm text-foreground/72">
						<span>Address line <span className="text-primary">*</span></span>
						<input value={form.addressLine} onChange={(event) => setForm((current) => ({ ...current, addressLine: event.target.value }))} placeholder="Flat / House / Street" className="rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" required />
					</label>
					<label className="grid gap-1 text-sm text-foreground/72">
						<span>Landmark</span>
						<input value={form.landmark} onChange={(event) => setForm((current) => ({ ...current, landmark: event.target.value }))} placeholder="Optional" className="rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
					</label>
					<label className="grid gap-1 text-sm text-foreground/72">
						<span>Pincode <span className="text-primary">*</span></span>
						<input value={form.pincode} onChange={(event) => setForm((current) => ({ ...current, pincode: event.target.value }))} placeholder="6-digit pincode" className="rounded-2xl border border-border bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" required />
					</label>
					<label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-foreground/66">
						<input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} className="h-4 w-4 rounded border-border accent-primary" />
						Set as default saved detail
					</label>
					<div className="md:col-span-2 flex justify-end">
						<button type="submit" className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-92">{editingId ? 'Update Address' : 'Save Address'}</button>
					</div>
				</form>
			) : null}

			{message ? (
				<p className={`mt-4 text-sm ${messageTone === 'error' ? 'text-red-600' : messageTone === 'success' ? 'text-green-700' : 'text-foreground/62'}`}>
					{message}
				</p>
			) : (
				<p className="mt-4 text-sm text-foreground/56">Your default saved detail appears first when needed.</p>
			)}
		</div>
	);
}
