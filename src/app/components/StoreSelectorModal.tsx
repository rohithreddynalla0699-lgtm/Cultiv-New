import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface StoreSelectorItem {
  id: string;
  name: string;
  city: string;
  code: string;
  zipCode: string;
  isActive: boolean;
}

interface StoreSelectorModalProps {
  isOpen: boolean;
  stores: StoreSelectorItem[];
  selectedStoreId: string;
  onClose: () => void;
  onSelectStore: (storeId: string) => void;
}

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  siddipet: { lat: 18.1018, lng: 78.8525 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  warangal: { lat: 17.9689, lng: 79.5941 },
};

const MAX_NEARBY_DISTANCE_KM = 25;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceInKm(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function StoreSelectorModal({
  isOpen,
  stores,
  selectedStoreId,
  onClose,
  onSelectStore,
}: StoreSelectorModalProps) {
  const [zipQuery, setZipQuery] = useState('');
  const [appliedZipFilter, setAppliedZipFilter] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setZipQuery('');
      setAppliedZipFilter('');
      setFeedback(null);
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const filteredStores = useMemo(() => {
    if (!appliedZipFilter.trim()) {
      return stores;
    }

    const normalized = appliedZipFilter.trim();
    return stores.filter((store) => store.zipCode.includes(normalized));
  }, [appliedZipFilter, stores]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setFeedback('Location is not available on this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const activeStoresWithCoordinates = stores
          .filter((store) => store.isActive)
          .map((store) => {
            const coordinates = CITY_COORDINATES[store.city.toLowerCase()];
            if (!coordinates) {
              return null;
            }

            return {
              ...store,
              distance: distanceInKm(position.coords.latitude, position.coords.longitude, coordinates.lat, coordinates.lng),
            };
          })
          .filter((store): store is StoreSelectorItem & { distance: number } => store !== null)
          .sort((a, b) => a.distance - b.distance);

        const nearest = activeStoresWithCoordinates[0];
        if (!nearest || nearest.distance > MAX_NEARBY_DISTANCE_KM) {
          setFeedback('No stores nearby for your current location.');
          return;
        }

        onSelectStore(nearest.id);
        setFeedback(`Nearest store selected: ${nearest.name}`);
      },
      () => {
        setFeedback('Location access is blocked. You can still select using zip code search.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  };

  const handleZipSearch = () => {
    if (!zipQuery.trim()) {
      setAppliedZipFilter('');
      setFeedback('Enter a zip code to search stores.');
      return;
    }

    setAppliedZipFilter(zipQuery.trim());

    const match = stores.find((store) => store.zipCode.includes(zipQuery.trim()) && store.isActive);
    if (!match) {
      setFeedback('No active store found for this zip code yet.');
      return;
    }

    onSelectStore(match.id);
    setFeedback(`Store selected: ${match.name}`);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select store"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,#22342b_0%,#16211b_42%,#0f1712_100%)]/55 backdrop-blur-[1.5px]"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          />

          <motion.div
            initial={{ y: 34, opacity: 0, scale: 0.986 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.994 }}
            transition={{ type: 'spring', stiffness: 250, damping: 26, mass: 0.9 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-t-3xl border border-[#d8e2db] bg-[linear-gradient(180deg,#f6faf7_0%,#f1f6f2_100%)] shadow-[0_36px_84px_rgba(8,18,12,0.3)] sm:rounded-3xl"
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#7eb79a]/14 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-8 h-56 w-56 rounded-full bg-[#9bb9a8]/12 blur-3xl" />

            <div className="relative p-5 sm:p-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/90 text-foreground/60 transition-all hover:scale-105 hover:text-foreground"
                aria-label="Close store selector"
              >
                <X className="h-4 w-4" />
              </button>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.32 }}
                className="pr-10"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">Delivery Store</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">Select your nearest CULTIV store</h2>
                <p className="mt-1 text-sm text-foreground/65">Use your location or search with zip code. You can switch anytime before checkout.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.3 }}
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.35fr]"
              >
                <button
                  type="button"
                  onClick={handleUseLocation}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/22 bg-white/90 px-4 py-3 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <LocateFixed className="h-4 w-4 text-primary" />
                  Use My Location
                </button>

                <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/95 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <Search className="h-4 w-4 text-foreground/45" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={zipQuery}
                    onChange={(event) => setZipQuery(event.target.value.replace(/\D/g, ''))}
                    placeholder="Search by zip code"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/45"
                  />
                  <button
                    type="button"
                    onClick={handleZipSearch}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
                  >
                    Find
                  </button>
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                {feedback ? (
                  <motion.p
                    key={feedback}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 rounded-xl border border-black/8 bg-white/70 px-3 py-2 text-sm text-foreground/75"
                  >
                    {feedback}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3 }}
                className="mt-4 min-h-[208px] max-h-[46vh] space-y-2 overflow-y-auto pr-1"
              >
                {filteredStores.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/15 bg-white/80 px-4 py-5 text-sm text-foreground/65">
                    No stores found for this zip code.
                  </div>
                ) : (
                  filteredStores.map((store, index) => {
                    const isSelected = store.id === selectedStoreId;
                    return (
                      <motion.button
                        type="button"
                        key={store.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.028, duration: 0.24 }}
                        onClick={() => {
                          if (!store.isActive) return;
                          onSelectStore(store.id);
                        }}
                        disabled={!store.isActive}
                        className={`w-full text-left flex items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                          isSelected
                            ? 'border-primary/35 bg-[#eff5f0] shadow-[0_6px_16px_rgba(20,64,38,0.1)]'
                            : 'border-black/10 bg-white/92 hover:border-primary/22 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{store.name}</p>
                          <p className="mt-0.5 text-xs text-foreground/65">{store.city} · {store.zipCode}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                store.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {store.isActive ? 'Active' : 'Coming Soon'}
                            </span>
                          </div>
                        </div>

                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${isSelected ? 'bg-primary/14 text-primary' : 'bg-black/5 text-foreground/58'}`}>
                          {isSelected ? 'Current' : (store.isActive ? 'Tap to choose' : 'Unavailable')}
                        </span>
                      </motion.button>
                    );
                  })
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
