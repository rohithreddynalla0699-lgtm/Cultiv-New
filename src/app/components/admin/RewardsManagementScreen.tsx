import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';
import { rewardsAdminService } from '../../services/rewardsAdminService';
import type {
  InternalRewardCatalogRecord,
  InternalRewardCustomerDetail,
  InternalRewardCustomerRecord,
  InternalRewardProgramSettingsRecord,
} from '../../lib/internalOpsApi';

type RewardFormState = {
  rewardCode: string;
  title: string;
  description: string;
  rewardType: 'discount' | 'free_item';
  pointCost: string;
  discountAmount: string;
  freeItemTitle: string;
  freeItemCategory: string;
  freeItemFoodValue: string;
  badge: string;
  eligibilityRule: string;
  isActive: boolean;
  sortOrder: string;
};

type SettingsFormState = {
  earnRateRupeesPerPoint: string;
  pointsExpiryDays: string;
  minOrderSubtotal: string;
  maxDiscountRatio: string;
  allowRewardRedemption: boolean;
  allowCheckoutRewardUse: boolean;
};

type AdjustmentMode = 'add' | 'remove';

const EMPTY_REWARD_FORM: RewardFormState = {
  rewardCode: '',
  title: '',
  description: '',
  rewardType: 'free_item',
  pointCost: '',
  discountAmount: '',
  freeItemTitle: '',
  freeItemCategory: 'Rewards',
  freeItemFoodValue: '',
  badge: '',
  eligibilityRule: 'Redeem with points anytime before expiry.',
  isActive: true,
  sortOrder: '',
};

const createSettingsForm = (settings: InternalRewardProgramSettingsRecord | null): SettingsFormState => ({
  earnRateRupeesPerPoint: String(settings?.earnRateRupeesPerPoint ?? 10),
  pointsExpiryDays: String(settings?.pointsExpiryDays ?? 90),
  minOrderSubtotal: String(settings?.minOrderSubtotal ?? 99),
  maxDiscountRatio: String(settings?.maxDiscountRatio ?? 0.3),
  allowRewardRedemption: settings?.allowRewardRedemption ?? true,
  allowCheckoutRewardUse: settings?.allowCheckoutRewardUse ?? true,
});

const createRewardForm = (reward: InternalRewardCatalogRecord): RewardFormState => ({
  rewardCode: reward.rewardCode,
  title: reward.title,
  description: reward.description,
  rewardType: reward.rewardType,
  pointCost: String(reward.pointCost),
  discountAmount: reward.discountAmount == null ? '' : String(reward.discountAmount),
  freeItemTitle: reward.freeItemTitle ?? '',
  freeItemCategory: reward.freeItemCategory ?? 'Rewards',
  freeItemFoodValue: reward.freeItemFoodValue == null ? '' : String(reward.freeItemFoodValue),
  badge: reward.badge ?? '',
  eligibilityRule: reward.eligibilityRule,
  isActive: reward.isActive,
  sortOrder: String(reward.sortOrder),
});

const numericValue = (value: string) => Number(value.trim());

export function RewardsManagementScreen() {
  const { permissions, session } = useAdminDashboard();
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingReward, setSavingReward] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [catalog, setCatalog] = useState<InternalRewardCatalogRecord[]>([]);
  const [settings, setSettings] = useState<InternalRewardProgramSettingsRecord | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(createSettingsForm(null));
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState<RewardFormState>(EMPTY_REWARD_FORM);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [adjustingPoints, setAdjustingPoints] = useState(false);
  const [customerResults, setCustomerResults] = useState<InternalRewardCustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<InternalRewardCustomerDetail | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>('add');
  const [adjustmentPoints, setAdjustmentPoints] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string }>({
    tone: 'info',
    text: 'Manage rewards catalog and program settings from backend truth.',
  });

  useEffect(() => {
    if (!permissions.canManageRewards || !session) {
      return;
    }

    let isActive = true;
    setLoading(true);

    void rewardsAdminService.loadDashboard(session)
      .then((dashboard) => {
        if (!isActive) return;
        setCatalog(dashboard.catalog);
        setSettings(dashboard.programSettings);
        setSettingsForm(createSettingsForm(dashboard.programSettings));
      })
      .catch((error) => {
        if (!isActive) return;
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Could not load rewards management dashboard.',
        });
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [permissions.canManageRewards, refreshKey, session]);

  useEffect(() => {
    if (message.tone === 'info') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage({
        tone: 'info',
        text: editingRewardId
          ? 'Editing backend reward catalog entry.'
          : 'Manage rewards catalog and program settings from backend truth.',
      });
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [editingRewardId, message]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const visibleCatalog = useMemo(
    () => [...catalog].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)),
    [catalog],
  );

  if (!permissions.canManageRewards) {
    return <Navigate to="/operations/summary" replace />;
  }

  const resetRewardForm = () => {
    setEditingRewardId(null);
    setRewardForm(EMPTY_REWARD_FORM);
  };

  const startEdit = (reward: InternalRewardCatalogRecord) => {
    setEditingRewardId(reward.id);
    setRewardForm(createRewardForm(reward));
    setMessage({
      tone: 'info',
      text: `Editing ${reward.title}.`,
    });
  };

  const handleSaveReward = async () => {
    if (!session) {
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    if (!rewardForm.rewardCode.trim() || !rewardForm.title.trim()) {
      setMessage({ tone: 'error', text: 'Reward code and title are required.' });
      return;
    }

    const pointCost = numericValue(rewardForm.pointCost);
    if (!Number.isInteger(pointCost) || pointCost <= 0) {
      setMessage({ tone: 'error', text: 'Point cost must be a whole number greater than zero.' });
      return;
    }

    if (rewardForm.rewardType === 'discount') {
      const discountAmount = numericValue(rewardForm.discountAmount);
      if (!Number.isFinite(discountAmount) || discountAmount < 0) {
        setMessage({ tone: 'error', text: 'Discount amount must be zero or greater.' });
        return;
      }
    } else {
      if (!rewardForm.freeItemTitle.trim() || !rewardForm.freeItemCategory.trim()) {
        setMessage({ tone: 'error', text: 'Free item title and category are required for free item rewards.' });
        return;
      }
      const freeItemFoodValue = numericValue(rewardForm.freeItemFoodValue);
      if (!Number.isFinite(freeItemFoodValue) || freeItemFoodValue < 0) {
        setMessage({ tone: 'error', text: 'Free item food value must be zero or greater.' });
        return;
      }
    }

    const sortOrder = rewardForm.sortOrder.trim() ? numericValue(rewardForm.sortOrder) : 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setMessage({ tone: 'error', text: 'Sort order must be zero or greater.' });
      return;
    }

    setSavingReward(true);
    const result = await rewardsAdminService.saveReward(session, {
      rewardId: editingRewardId ?? undefined,
      rewardCode: rewardForm.rewardCode.trim(),
      title: rewardForm.title.trim(),
      description: rewardForm.description.trim() || null,
      rewardType: rewardForm.rewardType,
      pointCost,
      discountAmount: rewardForm.rewardType === 'discount' ? numericValue(rewardForm.discountAmount) : null,
      freeItemTitle: rewardForm.rewardType === 'free_item' ? rewardForm.freeItemTitle.trim() : null,
      freeItemCategory: rewardForm.rewardType === 'free_item' ? rewardForm.freeItemCategory.trim() : null,
      freeItemFoodValue: rewardForm.rewardType === 'free_item' ? numericValue(rewardForm.freeItemFoodValue) : null,
      badge: rewardForm.badge.trim() || null,
      eligibilityRule: rewardForm.eligibilityRule.trim() || null,
      isActive: rewardForm.isActive,
      sortOrder,
    });
    setSavingReward(false);

    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success) {
      resetRewardForm();
      refresh();
    }
  };

  const handleToggleActive = async (reward: InternalRewardCatalogRecord) => {
    if (!session) {
      return;
    }

    const result = await rewardsAdminService.setRewardAvailability(session, reward.id, !reward.isActive);
    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });
    if (result.success) {
      refresh();
    }
  };

  const handleSaveSettings = async () => {
    if (!session) {
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    const earnRateRupeesPerPoint = numericValue(settingsForm.earnRateRupeesPerPoint);
    const pointsExpiryDays = numericValue(settingsForm.pointsExpiryDays);
    const minOrderSubtotal = numericValue(settingsForm.minOrderSubtotal);
    const maxDiscountRatio = numericValue(settingsForm.maxDiscountRatio);

    if (!Number.isInteger(earnRateRupeesPerPoint) || earnRateRupeesPerPoint <= 0) {
      setMessage({ tone: 'error', text: 'Earn rate must be a whole number greater than zero.' });
      return;
    }
    if (!Number.isInteger(pointsExpiryDays) || pointsExpiryDays <= 0) {
      setMessage({ tone: 'error', text: 'Points expiry days must be a whole number greater than zero.' });
      return;
    }
    if (!Number.isFinite(minOrderSubtotal) || minOrderSubtotal < 0) {
      setMessage({ tone: 'error', text: 'Minimum order subtotal must be zero or greater.' });
      return;
    }
    if (!Number.isFinite(maxDiscountRatio) || maxDiscountRatio < 0 || maxDiscountRatio > 1) {
      setMessage({ tone: 'error', text: 'Max discount ratio must be between 0 and 1.' });
      return;
    }

    setSavingSettings(true);
    const result = await rewardsAdminService.saveProgramSettings(session, {
      earnRateRupeesPerPoint,
      pointsExpiryDays,
      minOrderSubtotal,
      maxDiscountRatio,
      allowRewardRedemption: settingsForm.allowRewardRedemption,
      allowCheckoutRewardUse: settingsForm.allowCheckoutRewardUse,
    });
    setSavingSettings(false);

    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success) {
      refresh();
    }
  };

  const handleSearchCustomers = async () => {
    if (!session) {
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    const trimmedSearch = customerSearch.trim();
    if (!trimmedSearch) {
      setCustomerResults([]);
      setSelectedCustomer(null);
      setSelectedCustomerId(null);
      setMessage({ tone: 'error', text: 'Enter a customer name, phone, or email to search.' });
      return;
    }

    setSearchingCustomers(true);
    try {
      const result = await rewardsAdminService.lookupCustomerRewards(session, { search: trimmedSearch });
      setCustomerResults(result.results);
      if (result.results.length === 0) {
        setSelectedCustomer(null);
        setSelectedCustomerId(null);
      }
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not search customer rewards.',
      });
    } finally {
      setSearchingCustomers(false);
    }
  };

  const handleSelectCustomer = async (customerId: string) => {
    if (!session) {
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    setSearchingCustomers(true);
    try {
      const result = await rewardsAdminService.lookupCustomerRewards(session, { customerId });
      setSelectedCustomer(result.customer);
      setSelectedCustomerId(customerId);
      setAdjustmentPoints('');
      setAdjustmentReason('');
      setAdjustmentError(null);
      if (result.customer) {
        setMessage({
          tone: 'info',
          text: `Viewing reward activity for ${result.customer.customer.fullName}.`,
        });
      }
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not load customer rewards.',
      });
    } finally {
      setSearchingCustomers(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!session) {
      setAdjustmentError('Internal session not found.');
      setMessage({ tone: 'error', text: 'Internal session not found.' });
      return;
    }

    if (!selectedCustomerId) {
      setAdjustmentError('Select a customer before adjusting points.');
      setMessage({ tone: 'error', text: 'Select a customer before adjusting points.' });
      return;
    }

    const parsedPoints = numericValue(adjustmentPoints);
    if (!Number.isInteger(parsedPoints) || parsedPoints <= 0) {
      setAdjustmentError('Points must be a whole number greater than zero.');
      setMessage({ tone: 'error', text: 'Points must be a whole number greater than zero.' });
      return;
    }

    if (!adjustmentReason.trim()) {
      setAdjustmentError('A reason is required for every point adjustment.');
      setMessage({ tone: 'error', text: 'A reason is required for every point adjustment.' });
      return;
    }

    setAdjustmentError(null);
    setAdjustingPoints(true);
    const pointsDelta = adjustmentMode === 'add' ? parsedPoints : -parsedPoints;
    const result = await rewardsAdminService.adjustCustomerPoints(session, {
      customerId: selectedCustomerId,
      pointsDelta,
      reason: adjustmentReason.trim(),
    });
    setAdjustingPoints(false);

    setAdjustmentError(result.success ? null : result.message);
    setMessage({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success && result.customer) {
      setSelectedCustomer(result.customer);
      setCustomerResults((current) => current.map((entry) => (
        entry.customerId === result.customer?.customer.customerId
          ? { ...entry, rewardPoints: result.customer.customer.rewardPoints }
          : entry
      )));
      setAdjustmentPoints('');
      setAdjustmentReason('');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Rewards"
        title="Rewards management"
        description="Control backend reward catalog, live program settings, and admin customer point adjustments without touching customer checkout or POS reward application."
        action={<button type="button" onClick={() => void refresh()} className="rounded-full border border-primary/16 bg-white px-4 py-2 text-sm font-medium text-foreground/72">Refresh</button>}
      />

      <div className={`rounded-[24px] border px-4 py-3 text-sm ${
        message.tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : message.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-primary/12 bg-white/78 text-foreground/68'
      }`}
      >
        {message.text}
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_40px_rgba(45,80,22,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Catalog</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Reward catalog</h2>
            </div>
            <div className="rounded-full bg-[#F7FAF3] px-3 py-1.5 text-sm font-medium text-foreground/68">
              {visibleCatalog.length} rewards
            </div>
          </div>

          {loading ? (
            <div className="rounded-[22px] border border-dashed border-primary/16 bg-background/40 px-4 py-8 text-sm text-foreground/58">
              Loading rewards catalog…
            </div>
          ) : (
            <div className="overflow-hidden rounded-[22px] border border-primary/10">
              <div className="grid grid-cols-[1.6fr_0.8fr_0.7fr_0.6fr_1fr] gap-3 bg-[#F7FAF3] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">
                <span>Reward</span>
                <span>Type</span>
                <span>Points</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {visibleCatalog.map((reward) => (
                <div key={reward.id} className="grid grid-cols-[1.6fr_0.8fr_0.7fr_0.6fr_1fr] items-center gap-3 border-t border-primary/8 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{reward.title}</p>
                    <p className="text-xs text-foreground/56">{reward.rewardCode} · {reward.rewardType === 'discount' ? `₹${reward.discountAmount ?? 0} off` : reward.freeItemTitle ?? 'Free item reward'}</p>
                  </div>
                  <p className="text-sm text-foreground/68">{reward.rewardType === 'discount' ? 'Discount' : 'Free item'}</p>
                  <p className="text-sm text-foreground/68">{reward.pointCost}</p>
                  <div><StatusBadge status={reward.isActive ? 'active' : 'inactive'} /></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(reward)} className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74">Edit</button>
                    <button type="button" onClick={() => void handleToggleActive(reward)} className="rounded-lg border border-primary/16 bg-white px-3 py-1.5 text-xs font-medium text-foreground/74">
                      {reward.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
              {visibleCatalog.length === 0 ? (
                <div className="px-4 py-6 text-sm text-foreground/58">No rewards found yet.</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_40px_rgba(45,80,22,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Editor</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{editingRewardId ? 'Edit reward' : 'Add reward'}</h2>
            </div>
            {editingRewardId ? (
              <button type="button" onClick={resetRewardForm} className="rounded-full border border-primary/16 bg-white px-3 py-1.5 text-sm font-medium text-foreground/72">New reward</button>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground/72">
                Reward Code
                <input value={rewardForm.rewardCode} onChange={(event) => setRewardForm((current) => ({ ...current, rewardCode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm font-medium text-foreground/72">
                Title
                <input value={rewardForm.title} onChange={(event) => setRewardForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
            </div>

            <label className="block text-sm font-medium text-foreground/72">
              Description
              <textarea value={rewardForm.description} onChange={(event) => setRewardForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium text-foreground/72">
                Type
                <select value={rewardForm.rewardType} onChange={(event) => setRewardForm((current) => ({ ...current, rewardType: event.target.value as 'discount' | 'free_item' }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary">
                  <option value="free_item">Free item</option>
                  <option value="discount">Discount</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-foreground/72">
                Point Cost
                <input value={rewardForm.pointCost} onChange={(event) => setRewardForm((current) => ({ ...current, pointCost: event.target.value }))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm font-medium text-foreground/72">
                Sort Order
                <input value={rewardForm.sortOrder} onChange={(event) => setRewardForm((current) => ({ ...current, sortOrder: event.target.value }))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
            </div>

            {rewardForm.rewardType === 'discount' ? (
              <label className="block text-sm font-medium text-foreground/72">
                Discount Amount
                <input value={rewardForm.discountAmount} onChange={(event) => setRewardForm((current) => ({ ...current, discountAmount: event.target.value }))} inputMode="decimal" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-medium text-foreground/72">
                  Free Item Title
                  <input value={rewardForm.freeItemTitle} onChange={(event) => setRewardForm((current) => ({ ...current, freeItemTitle: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                </label>
                <label className="block text-sm font-medium text-foreground/72">
                  Category
                  <input value={rewardForm.freeItemCategory} onChange={(event) => setRewardForm((current) => ({ ...current, freeItemCategory: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                </label>
                <label className="block text-sm font-medium text-foreground/72">
                  Food Value
                  <input value={rewardForm.freeItemFoodValue} onChange={(event) => setRewardForm((current) => ({ ...current, freeItemFoodValue: event.target.value }))} inputMode="decimal" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                </label>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground/72">
                Badge
                <input value={rewardForm.badge} onChange={(event) => setRewardForm((current) => ({ ...current, badge: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
              <label className="block text-sm font-medium text-foreground/72">
                Eligibility Rule
                <input value={rewardForm.eligibilityRule} onChange={(event) => setRewardForm((current) => ({ ...current, eligibilityRule: event.target.value }))} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-foreground/72">
              <input type="checkbox" checked={rewardForm.isActive} onChange={(event) => setRewardForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-primary" />
              Reward is active
            </label>

            <div className="flex gap-3">
              <button type="button" onClick={resetRewardForm} disabled={savingReward} className="flex-1 rounded-2xl border border-primary/16 bg-white px-4 py-3 text-sm font-medium text-foreground/72 disabled:opacity-50">Reset</button>
              <button type="button" onClick={() => void handleSaveReward()} disabled={savingReward} className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {savingReward ? 'Saving…' : editingRewardId ? 'Save reward' : 'Create reward'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_40px_rgba(45,80,22,0.08)]">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Program Settings</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Live reward rules</h2>
          <p className="mt-2 text-sm text-foreground/62">These values are used by backend rewards summary, redemption, and checkout validation. Customer checkout logic is otherwise unchanged in this phase.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm font-medium text-foreground/72">
            Earn Rate Rupees / Point
            <input value={settingsForm.earnRateRupeesPerPoint} onChange={(event) => setSettingsForm((current) => ({ ...current, earnRateRupeesPerPoint: event.target.value }))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
          </label>
          <label className="block text-sm font-medium text-foreground/72">
            Points Expiry Days
            <input value={settingsForm.pointsExpiryDays} onChange={(event) => setSettingsForm((current) => ({ ...current, pointsExpiryDays: event.target.value }))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
          </label>
          <label className="block text-sm font-medium text-foreground/72">
            Min Order Subtotal
            <input value={settingsForm.minOrderSubtotal} onChange={(event) => setSettingsForm((current) => ({ ...current, minOrderSubtotal: event.target.value }))} inputMode="decimal" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
          </label>
          <label className="block text-sm font-medium text-foreground/72">
            Max Discount Ratio
            <input value={settingsForm.maxDiscountRatio} onChange={(event) => setSettingsForm((current) => ({ ...current, maxDiscountRatio: event.target.value }))} inputMode="decimal" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-primary/12 bg-background/60 px-4 py-3 text-sm font-medium text-foreground/72">
            <input type="checkbox" checked={settingsForm.allowRewardRedemption} onChange={(event) => setSettingsForm((current) => ({ ...current, allowRewardRedemption: event.target.checked }))} className="h-4 w-4 accent-primary" />
            Allow reward redemption
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-primary/12 bg-background/60 px-4 py-3 text-sm font-medium text-foreground/72">
            <input type="checkbox" checked={settingsForm.allowCheckoutRewardUse} onChange={(event) => setSettingsForm((current) => ({ ...current, allowCheckoutRewardUse: event.target.checked }))} className="h-4 w-4 accent-primary" />
            Allow checkout reward use
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => void handleSaveSettings()} disabled={savingSettings || loading || !settings} className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_40px_rgba(45,80,22,0.08)]">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Customer Rewards</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Manual point adjustments</h2>
          <p className="mt-2 text-sm text-foreground/62">Search a customer by name, phone, or email, review their rewards state, then add or remove points with a required reason.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search by name, phone, or email"
                className="flex-1 rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary"
              />
              <button
                type="button"
                onClick={() => void handleSearchCustomers()}
                disabled={searchingCustomers}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {searchingCustomers ? 'Searching…' : 'Search'}
              </button>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-primary/10">
              <div className="bg-[#F7FAF3] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/58">Results</div>
              {customerResults.length === 0 ? (
                <div className="px-4 py-5 text-sm text-foreground/58">Search results will appear here.</div>
              ) : (
                customerResults.map((customer) => (
                  <button
                    key={customer.customerId}
                    type="button"
                    onClick={() => void handleSelectCustomer(customer.customerId)}
                    className={`grid w-full grid-cols-[1fr_auto] gap-3 border-t border-primary/8 px-4 py-3 text-left transition-colors ${
                      selectedCustomerId === customer.customerId ? 'bg-[#F4F8EF]' : 'bg-white hover:bg-[#FAFCF7]'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{customer.fullName}</p>
                      <p className="text-xs text-foreground/56">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
                    </div>
                    <div className="rounded-full bg-[#F7FAF3] px-3 py-1.5 text-sm font-medium text-foreground/68">
                      {customer.rewardPoints} pts
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[22px] border border-primary/10 bg-background/40 p-4">
              {selectedCustomer ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{selectedCustomer.customer.fullName}</p>
                      <p className="text-sm text-foreground/62">{selectedCustomer.customer.phone}{selectedCustomer.customer.email ? ` · ${selectedCustomer.customer.email}` : ''}</p>
                    </div>
                    <div className="rounded-full bg-[#F7FAF3] px-4 py-2 text-sm font-semibold text-foreground/72">
                      {selectedCustomer.customer.rewardPoints} available points
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
                    <div className="space-y-4">
                      <div className="rounded-[20px] border border-primary/10 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/58">Adjust Points</p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => setAdjustmentMode('add')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${adjustmentMode === 'add' ? 'bg-primary text-primary-foreground' : 'border border-primary/14 bg-white text-foreground/72'}`}>Add</button>
                          <button type="button" onClick={() => setAdjustmentMode('remove')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${adjustmentMode === 'remove' ? 'bg-primary text-primary-foreground' : 'border border-primary/14 bg-white text-foreground/72'}`}>Remove</button>
                        </div>
                        <label className="mt-4 block text-sm font-medium text-foreground/72">
                          Points
                          <input value={adjustmentPoints} onChange={(event) => setAdjustmentPoints(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                        </label>
                        <label className="mt-4 block text-sm font-medium text-foreground/72">
                          Reason
                          <textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-primary/12 bg-background/80 px-4 py-3 outline-none transition-colors focus:border-primary" />
                        </label>
                        {adjustmentError ? (
                          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {adjustmentError}
                          </div>
                        ) : null}
                        <button type="button" onClick={() => void handleAdjustPoints()} disabled={adjustingPoints} className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                          {adjustingPoints ? 'Saving…' : adjustmentMode === 'add' ? 'Add points' : 'Remove points'}
                        </button>
                      </div>

                      <div className="rounded-[20px] border border-primary/10 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/58">Reward Entitlements</p>
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="text-sm font-medium text-foreground/72">Available</p>
                            {selectedCustomer.availableEntitlements.length === 0 ? (
                              <p className="mt-1 text-sm text-foreground/56">No available entitlements.</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {selectedCustomer.availableEntitlements.map((entitlement) => (
                                  <div key={entitlement.entitlementId} className="rounded-xl border border-primary/10 bg-background/50 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-foreground">{entitlement.title}</p>
                                      <StatusBadge status="active" label="Available" />
                                    </div>
                                    <p className="mt-1 text-xs text-foreground/56">{entitlement.rewardCode ?? 'reward'} · Redeemed {new Date(entitlement.redeemedAt).toLocaleDateString()}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-medium text-foreground/72">Used</p>
                            {selectedCustomer.usedEntitlements.length === 0 ? (
                              <p className="mt-1 text-sm text-foreground/56">No used entitlements.</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {selectedCustomer.usedEntitlements.map((entitlement) => (
                                  <div key={entitlement.entitlementId} className="rounded-xl border border-primary/10 bg-background/50 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-foreground">{entitlement.title}</p>
                                      <StatusBadge status="inactive" label="Used" />
                                    </div>
                                    <p className="mt-1 text-xs text-foreground/56">{entitlement.rewardCode ?? 'reward'} · Used {entitlement.usedAt ? new Date(entitlement.usedAt).toLocaleDateString() : 'recently'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-primary/10 bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/58">Recent Ledger Activity</p>
                      {selectedCustomer.recentActivity.length === 0 ? (
                        <p className="mt-3 text-sm text-foreground/56">No loyalty activity yet.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {selectedCustomer.recentActivity.map((entry) => (
                            <div key={entry.loyaltyEntryId} className="rounded-xl border border-primary/10 bg-background/50 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{entry.entryType}</p>
                                <span className="text-sm font-semibold text-foreground">{entry.points} pts</span>
                              </div>
                              <p className="mt-1 text-xs text-foreground/56">
                                Remaining: {entry.pointsRemaining} · {new Date(entry.createdAt).toLocaleString()}
                              </p>
                              {typeof entry.metadata?.reason === 'string' && entry.metadata.reason ? (
                                <p className="mt-1 text-xs text-foreground/56">Reason: {entry.metadata.reason}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-1 py-6 text-sm text-foreground/58">
                  Select a customer to view reward points, recent loyalty activity, and reward entitlements.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
