// Header — premium global navigation with section links, store selector, profile menu, and cart access.

import { Logo } from "./Logo";
import { useAuth } from "../contexts/AuthContext";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Download, MapPin, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownSlide } from "../core/motion/cultivMotion";
import type { HomeScrollLocationState } from '../types/navigation';
import { StoreSelectorModal, type StoreSelectorItem } from './StoreSelectorModal';
import { AppWaitlistModal } from './AppWaitlistModal';
import {
  getSelectedStore,
  loadSelectedStoreId,
  loadStores,
  setSelectedStoreId,
  subscribeOpenStoreSelector,
  subscribeSelectedStore,
} from '../data/storeLocator';
import { requestOpenAppWaitlist, subscribeOpenAppWaitlist } from '../data/appLaunch';

interface HeaderProps {
  onOrderClick?: () => void;
}

export function Header({ onOrderClick: _onOrderClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeHomeTab, setActiveHomeTab] = useState<'home' | 'journal' | 'about'>('home');
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [showAppWaitlist, setShowAppWaitlist] = useState(false);
  const [stores, setStores] = useState<StoreSelectorItem[]>(() => loadStores() as StoreSelectorItem[]);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => loadSelectedStoreId(loadStores()));
  const menuRef = useRef<HTMLDivElement>(null);
  const HEADER_SCROLL_OFFSET = 128;

  const activeStore = getSelectedStore(stores);

  useEffect(() => {
    const loadedStores = loadStores() as StoreSelectorItem[];
    setStores(loadedStores);
    setSelectedStoreIdState(loadSelectedStoreId(loadedStores));

    const unsubscribeSelection = subscribeSelectedStore((nextStoreId) => {
      const refreshedStores = loadStores() as StoreSelectorItem[];
      setStores(refreshedStores);
      setSelectedStoreIdState(nextStoreId);
    });

    const unsubscribeOpen = subscribeOpenStoreSelector(() => {
      const refreshedStores = loadStores() as StoreSelectorItem[];
      setStores(refreshedStores);
      setSelectedStoreIdState(loadSelectedStoreId(refreshedStores));
      setShowStoreSelector(true);
    });

    const unsubscribeWaitlist = subscribeOpenAppWaitlist(() => {
      setShowAppWaitlist(true);
    });

    return () => {
      unsubscribeSelection();
      unsubscribeOpen();
      unsubscribeWaitlist();
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveHomeTab('home');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') {
      return;
    }

    const updateActiveTabByScroll = () => {
      const journalSection = document.getElementById('journal');
      const aboutSection = document.getElementById('about');
      const probeY = window.scrollY + HEADER_SCROLL_OFFSET + 40;

      if (aboutSection && probeY >= aboutSection.offsetTop - 20) {
        setActiveHomeTab('about');
        return;
      }

      if (journalSection && probeY >= journalSection.offsetTop - 20) {
        setActiveHomeTab('journal');
        return;
      }

      setActiveHomeTab('home');
    };

    updateActiveTabByScroll();
    window.addEventListener('scroll', updateActiveTabByScroll, { passive: true });
    window.addEventListener('resize', updateActiveTabByScroll);

    return () => {
      window.removeEventListener('scroll', updateActiveTabByScroll);
      window.removeEventListener('resize', updateActiveTabByScroll);
    };
  }, [HEADER_SCROLL_OFFSET, location.pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const navClassName = ({ isActive }: { isActive: boolean }) =>
    `relative text-sm transition-colors ${isActive ? "text-foreground" : "text-foreground/70 hover:text-foreground"}`;

  const scrollToElementWithOffset = (element: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    const targetY = element.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, targetY), behavior });
  };

  const jumpToHomeSection = (sectionId: string) => {
    if (sectionId === 'journal') {
      setActiveHomeTab('journal');
    } else if (sectionId === 'about') {
      setActiveHomeTab('about');
    }

    if (location.pathname === '/') {
      const section = document.getElementById(sectionId);
      if (section) {
        scrollToElementWithOffset(section);
      }
      setShowUserMenu(false);
      return;
    }

    const nextState: HomeScrollLocationState = { scrollTo: sectionId, scrollOffset: HEADER_SCROLL_OFFSET };
    navigate('/', { state: nextState });
    setShowUserMenu(false);
  };

  const handleNavTopScroll = (event: React.MouseEvent<HTMLAnchorElement>, route: '/' | '/menu' | '/order') => {
    if (location.pathname !== route) {
      if (route === '/') {
        setActiveHomeTab('home');
      }
      return;
    }

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (route === '/') {
      setActiveHomeTab('home');
    }
    setShowUserMenu(false);
  };

  const rightUtilityClassName = "hidden xl:inline-flex w-[190px] items-center justify-between gap-2 rounded-2xl border border-primary/12 bg-white/88 px-3.5 py-2.5 text-sm font-medium text-foreground/72 transition-colors hover:border-primary/22 hover:text-foreground";

  const handleSelectStore = (storeId: string) => {
    if (setSelectedStoreId(storeId, stores)) {
      setSelectedStoreIdState(storeId);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] bg-[#f8f7f2]/95">
      <div className="container mx-auto px-6 py-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-full border border-primary/10 bg-white/92 px-4 py-3 shadow-md">
        <Link to="/" onClick={(event) => handleNavTopScroll(event, '/')} className="justify-self-start">
          <Logo variant="wordmark" size="md" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7 justify-self-center">
          <NavLink to="/" className={navClassName} onClick={(event) => handleNavTopScroll(event, '/')}>
            {({ isActive }) => (
              <span className="relative inline-flex items-center gap-2 pb-1">
                Home
                {isActive && activeHomeTab === 'home' ? (
                  <motion.span 
                    layoutId="nav-underline"
                    className="absolute inset-x-0 -bottom-1 h-px bg-primary" 
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </span>
            )}
          </NavLink>
          <NavLink to="/menu" className={navClassName} onClick={(event) => handleNavTopScroll(event, '/menu')}>
            {({ isActive }) => (
              <span className="relative inline-flex items-center gap-2 pb-1">
                Menu
                {isActive ? (
                  <motion.span 
                    layoutId="nav-underline"
                    className="absolute inset-x-0 -bottom-1 h-px bg-primary" 
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </span>
            )}
          </NavLink>
          <NavLink to="/order" className={navClassName} onClick={(event) => handleNavTopScroll(event, '/order')}>
            {({ isActive }) => (
              <span className="relative inline-flex items-center gap-2 pb-1">
                Order
                {isActive ? (
                  <motion.span 
                    layoutId="nav-underline"
                    className="absolute inset-x-0 -bottom-1 h-px bg-primary" 
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </span>
            )}
          </NavLink>
          <button type="button" onClick={() => jumpToHomeSection('journal')} className="text-sm text-foreground/72 transition-colors hover:text-foreground">
            <span className="relative inline-flex items-center gap-2 pb-1">
              Journal
              {location.pathname === '/' && activeHomeTab === 'journal' ? (
                <motion.span 
                  layoutId="nav-underline"
                  className="absolute inset-x-0 -bottom-1 h-px bg-primary" 
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
            </span>
          </button>
          <button type="button" onClick={() => jumpToHomeSection('about')} className="text-sm text-foreground/72 transition-colors hover:text-foreground">
            <span className="relative inline-flex items-center gap-2 pb-1">
              About
              {location.pathname === '/' && activeHomeTab === 'about' ? (
                <motion.span 
                  layoutId="nav-underline"
                  className="absolute inset-x-0 -bottom-1 h-px bg-primary" 
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
            </span>
          </button>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <button type="button" onClick={() => setShowStoreSelector(true)} className={rightUtilityClassName}>
            <MapPin className="h-4 w-4 text-primary" />
            <span className="hidden 2xl:inline flex-1 truncate text-left">{activeStore?.name ?? 'Select Store'}</span>
            <span className="2xl:hidden">Store</span>
            <ChevronDown className="h-4 w-4 text-foreground/45" />
          </button>

          <button
            type="button"
            onClick={() => requestOpenAppWaitlist()}
            className="hidden xl:inline-flex items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/64 px-3.5 py-2.5 text-sm font-medium text-foreground/62 transition-colors hover:bg-white/82 hover:text-foreground/78"
          >
            <Download className="h-4 w-4 text-foreground/55" />
            <span className="hidden 2xl:inline">Get App Early</span>
            <span className="2xl:hidden">App Soon</span>
          </button>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-white/78 px-3 py-2 text-sm font-medium text-foreground/78 transition-colors hover:text-primary"
              >
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="hidden sm:block">{user.fullName.split(' ')[0]}</span>
                <motion.span 
                  animate={{ rotate: showUserMenu ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="hidden sm:block h-4 w-4 text-foreground/40"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={DropdownSlide}
                    className="absolute right-0 top-full mt-3 w-56 rounded-2xl bg-card shadow-lg border border-border py-2 z-50"
                  >
                    <Link
                      to="/profile"
                      className="block px-4 py-2.5 text-sm hover:bg-background/50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/orders"
                      className="block px-4 py-2.5 text-sm hover:bg-background/50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Order History
                    </Link>
                    <Link
                      to="/rewards"
                      className="block px-4 py-2.5 text-sm hover:bg-background/50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Rewards
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-white/78 px-3 py-2 text-sm font-medium text-foreground/78 transition-colors hover:text-primary">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="hidden sm:block">Profile</span>
            </Link>
          )}
        </div>
        </div>
      </div>

      <StoreSelectorModal
        isOpen={showStoreSelector}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onClose={() => setShowStoreSelector(false)}
        onSelectStore={(storeId) => {
          handleSelectStore(storeId);
        }}
      />

      <AppWaitlistModal
        isOpen={showAppWaitlist}
        defaultEmail={user?.email}
        onClose={() => setShowAppWaitlist(false)}
      />
    </header>
  );
}