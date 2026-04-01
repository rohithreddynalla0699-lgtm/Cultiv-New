// App — root component with routing, auth provider, and global floating bag state.

import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { Suspense, lazy, useEffect, useState } from 'react';
import { ShoppingBag, ChevronUp, ChevronRight } from 'lucide-react';
import { HomeQuickActions } from './components/HomeQuickActions';
import { HomeTimeSuggestions } from './components/HomeTimeSuggestions';
import { HomeRewardsSnapshot } from './components/HomeRewardsSnapshot';
import { HomeFeaturedCategories } from './components/HomeFeaturedCategories';
import { HomeHowItWorks } from './components/HomeHowItWorks';
import { HomeStoreSection } from './components/HomeStoreSection';
import { About } from './components/About';
import { loadDraftCart, subscribeDraftCart } from './data/cartDraft';
import { MENU_CATEGORIES } from './data/menuData';
import { resolveCategorySlugFromLabel } from './utils/categoryRouting';
import type { HomeOrderLaunchState, HomeScrollLocationState } from './types/navigation';

const Menu = lazy(() => import('./components/Menu').then((module) => ({ default: module.Menu })));
const OrderPage = lazy(() => import('./components/OrderPage').then((module) => ({ default: module.OrderPage })));
const LoginScreen = lazy(() => import('./components/LoginScreen').then((module) => ({ default: module.LoginScreen })));
const SignupScreen = lazy(() => import('./components/SignupScreen').then((module) => ({ default: module.SignupScreen })));
const ProfileScreen = lazy(() => import('./components/ProfileScreen').then((module) => ({ default: module.ProfileScreen })));
const OrderHistoryScreen = lazy(() => import('./components/OrderHistoryScreen').then((module) => ({ default: module.OrderHistoryScreen })));
const RewardsScreen = lazy(() => import('./components/RewardsScreen').then((module) => ({ default: module.RewardsScreen })));
const ForgotPasswordScreen = lazy(() => import('./components/ForgotPasswordScreen').then((module) => ({ default: module.ForgotPasswordScreen })));
const ResetPasswordScreen = lazy(() => import('./components/ResetPasswordScreen').then((module) => ({ default: module.ResetPasswordScreen })));
const OrderDetailScreen = lazy(() => import('./components/OrderDetailScreen').then((module) => ({ default: module.OrderDetailScreen })));
const AdminDashboardLayout = lazy(() => import('./components/admin/AdminDashboardLayout').then((module) => ({ default: module.AdminDashboardLayout })));
const AdminSummaryScreen = lazy(() => import('./components/admin/AdminSummaryScreen').then((module) => ({ default: module.AdminSummaryScreen })));
const OrdersBoardScreen = lazy(() => import('./components/admin/OrdersBoardScreen').then((module) => ({ default: module.OrdersBoardScreen })));
const CounterBillingScreen = lazy(() => import('./components/admin/CounterBillingScreen').then((module) => ({ default: module.CounterBillingScreen })));
const InventoryScreen = lazy(() => import('./components/admin/InventoryScreen').then((module) => ({ default: module.InventoryScreen })));
const EmployeesScreen = lazy(() => import('./components/admin/EmployeesScreen').then((module) => ({ default: module.EmployeesScreen })));
const StoresScreen = lazy(() => import('./components/admin/StoresScreen').then((module) => ({ default: module.StoresScreen })));
const AdminDashboardProvider = lazy(() => import('./contexts/AdminDashboardContext').then((module) => ({ default: module.AdminDashboardProvider })));

function MenuCategoryRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !MENU_CATEGORIES.some((category) => category.slug === slug)) {
    return <Navigate to="/menu" replace />;
  }
  const nextState: HomeOrderLaunchState = { categorySlug: slug };
  return <Navigate to="/order" replace state={nextState} />;
}

function HomePage({ onOrderClick, onCategorySelect }: { onOrderClick: () => void; onCategorySelect: (category: string) => void }) {
  const navigate = useNavigate();

  return (
    <>
      <Hero onOrderClick={onOrderClick} onExploreMenu={() => navigate('/menu')} />
      <HomeFeaturedCategories onCategorySelect={onCategorySelect} />
      <HomeQuickActions
        onCategorySelect={onCategorySelect}
        onReorderLast={() => navigate('/orders')}
      />
      <HomeHowItWorks onOrderClick={onOrderClick} />
      <HomeTimeSuggestions onCategorySelect={onCategorySelect} />
      <About />
      <HomeRewardsSnapshot />
      <HomeStoreSection onOrderClick={onOrderClick} />
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pendingGuestOrderClaims, claimPendingGuestOrders, rejectPendingGuestOrderClaims } = useAuth();
  const [isCartPanelOpen, setIsCartPanelOpen] = useState(false);
  const [draftCartLines, setDraftCartLines] = useState(() => loadDraftCart());

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const state = location.state as HomeOrderLaunchState | null;
    if (state?.openOrder) {
      const nextState: HomeOrderLaunchState = {
        categorySlug: state.categorySlug,
        reorderCartLines: state.reorderCartLines,
        reorderSourceOrderId: state.reorderSourceOrderId,
      };
      navigate('/order', {
        state: nextState,
      });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const state = location.state as HomeScrollLocationState | null;
    if (location.pathname !== '/' || !state?.scrollTo) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(state.scrollTo as string);
      if (element) {
        const offset = state.scrollOffset ?? 128;
        const targetY = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
      navigate(location.pathname, { replace: true, state: null });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setIsCartPanelOpen(false);
  }, [location.pathname]);

  useEffect(() => subscribeDraftCart(() => setDraftCartLines(loadDraftCart())), []);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const hideGlobalShell = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/forgot-password' || location.pathname === '/reset-password' || isAdminRoute;
  const hideFloatingCartOnRoute = location.pathname === '/order' || isAdminRoute;

  const floatingCartItems = draftCartLines.reduce((sum, line) => sum + line.quantity, 0);
  const floatingCartTotal = draftCartLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const showFloatingCart = !hideGlobalShell && !hideFloatingCartOnRoute;

  const openCartPrimaryAction = () => {
    if (floatingCartItems === 0) {
      navigate('/order');
      return;
    }
    setIsCartPanelOpen((value) => !value);
  };

  const openBagDetails = () => {
    if (floatingCartItems === 0) {
      navigate('/order');
      return;
    }
    navigate('/order');
  };

  const openCategoryWorkspace = (categoryLabel: string) => {
    const slug = resolveCategorySlugFromLabel(categoryLabel);
    if (!slug) {
      navigate('/menu');
      return;
    }
    const nextState: HomeOrderLaunchState = { categorySlug: slug };
    navigate('/order', { state: nextState });
  };

  return (
    <div className="size-full">
      {!hideGlobalShell ? <Header onOrderClick={() => navigate('/order')} /> : null}
      <main>
        <Suspense fallback={<div className="min-h-[35vh]" />}>
          <Routes>
            <Route
              path="/"
              element={<HomePage onOrderClick={() => navigate('/order')} onCategorySelect={openCategoryWorkspace} />}
            />
            <Route path="/menu" element={<Menu />} />
            <Route path="/menu/:slug" element={<MenuCategoryRedirect />} />
            <Route path="/order" element={<OrderPage />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/orders" element={<OrderHistoryScreen />} />
            <Route path="/orders/:orderId" element={<OrderDetailScreen />} />
            <Route path="/rewards" element={<RewardsScreen />} />
            <Route path="/admin" element={<AdminDashboardProvider><AdminDashboardLayout /></AdminDashboardProvider>}>
              <Route index element={<Navigate to="summary" replace />} />
              <Route path="summary" element={<AdminSummaryScreen />} />
              <Route path="orders" element={<OrdersBoardScreen />} />
              <Route path="counter-billing" element={<CounterBillingScreen />} />
              <Route path="inventory" element={<InventoryScreen />} />
              <Route path="employees" element={<EmployeesScreen />} />
              <Route path="stores" element={<StoresScreen />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!hideGlobalShell ? <Footer /> : null}
      {showFloatingCart ? (
        <>
          {isCartPanelOpen && draftCartLines.length > 0 ? (
            <div className="fixed bottom-24 right-6 sm:bottom-28 sm:right-8 z-40 w-[min(92vw,360px)] rounded-[26px] border border-primary/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,246,233,0.92))] p-4 shadow-[0_24px_58px_rgba(20,35,10,0.24)] backdrop-blur-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">Current bag</p>
                  <p className="mt-1 text-base font-semibold text-foreground">Central Order</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartPanelOpen(false)}
                  className="rounded-full border border-primary/16 bg-white px-2.5 py-1 text-xs font-medium text-foreground/70 hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {draftCartLines.map((line) => (
                  <div key={line.key} className="rounded-2xl border border-primary/10 bg-white/86 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground leading-snug">{line.title}</p>
                    <p className="mt-1 text-xs text-foreground/58">{line.quantity} x ₹{line.unitPrice}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-primary/12 bg-white/88 px-3 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground/62">Total</span>
                  <span className="font-semibold text-foreground">₹{floatingCartTotal}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartPanelOpen(false);
                    navigate('/menu');
                  }}
                  className="rounded-full border border-primary/18 bg-white py-2.5 text-sm font-medium text-foreground/75 hover:text-foreground"
                >
                  Add More
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartPanelOpen(false);
                    openBagDetails();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  View Bag
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={openCartPrimaryAction}
            className="fixed bottom-7 right-6 sm:bottom-9 sm:right-8 z-40 inline-flex items-center gap-3 rounded-full border border-primary/16 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(242,247,235,0.96))] px-4 py-3 text-left shadow-[0_16px_40px_rgba(20,35,10,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(20,35,10,0.24)]"
            aria-label="Open cart"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/46">Bag</p>
              {floatingCartItems > 0 ? (
                <p className="text-sm font-semibold text-foreground">{floatingCartItems} item{floatingCartItems > 1 ? 's' : ''} · ₹{floatingCartTotal}</p>
              ) : (
                <p className="text-sm font-semibold text-foreground">Start your bowl</p>
              )}
            </div>
            {draftCartLines.length > 0 ? <ChevronUp className={`h-4 w-4 text-foreground/45 transition-transform ${isCartPanelOpen ? 'rotate-180' : ''}`} /> : null}
          </button>
        </>
      ) : null}

      {pendingGuestOrderClaims.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-foreground/18 backdrop-blur-[2px]" aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-[28px] bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(241,246,236,0.96))] p-6 shadow-[0_24px_64px_rgba(20,35,10,0.18)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">Previous Orders Found</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              We found {pendingGuestOrderClaims.length} previous order{pendingGuestOrderClaims.length > 1 ? 's' : ''} placed with your details.
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/68">
              {pendingGuestOrderClaims.length === 1 ? 'This order was' : 'These orders were'} placed as a guest using your phone or email.
              Do you want to link {pendingGuestOrderClaims.length === 1 ? 'it' : 'them'} to your account?
            </p>
            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
              {pendingGuestOrderClaims.map((order) => (
                <div key={order.id} className="rounded-xl border border-primary/12 bg-white/75 px-3 py-2 text-sm">
                  <p className="font-medium">Order #{order.id.slice(-6)}</p>
                  <p className="mt-0.5 text-xs text-foreground/60">
                    {new Date(order.createdAt).toLocaleDateString()} · ₹{order.total}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={claimPendingGuestOrders}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Yes, link my orders
              </button>
              <button
                type="button"
                onClick={rejectPendingGuestOrderClaims}
                className="flex-1 rounded-full border border-primary/16 py-3 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                No, this wasn't me
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}