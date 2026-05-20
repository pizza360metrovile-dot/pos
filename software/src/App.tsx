/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Utensils, 
  History, 
  Settings, 
  Package,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Menu,
  ChevronLeft,
  X,
  Circle,
  Lock,
  Key,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast, Toaster } from 'sonner';
import { useStore } from './store/useStore';
import { format } from 'date-fns';
import { doc, getDocFromServer } from 'firebase/firestore';
import { fireStore } from './lib/firebase';
import { 
  loadLocalLicense, 
  clearLocalLicense, 
  saveLocalLicense, 
  getOrCreateDeviceId, 
  activateLicenseKey 
} from './utils/licenseManager';

// Pages
import POS from './pages/POS';
import MenuManagement from './pages/MenuManagement';
import Records from './pages/Records';
import SettingsPage from './pages/Settings';
import Inventory from './pages/Inventory';
import Login from './components/Login';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { id: 'pos', icon: LayoutDashboard, label: 'POS', path: '/' },
  { id: 'menu', icon: Utensils, label: 'Menu', path: '/menu' },
  { id: 'records', icon: History, label: 'Records', path: '/records' },
  { id: 'inventory', icon: Package, label: 'Inventory', path: '/inventory' },
  { id: 'settings', icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar = ({ 
  isOpen, 
  onClose, 
  sidebarState, 
  setSidebarState, 
  isMobileMode 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  sidebarState: 'expanded' | 'collapsed',
  setSidebarState: (s: 'expanded' | 'collapsed') => void,
  isMobileMode: boolean
}) => {
  const location = useLocation();
  const user = useStore(state => state.user);
  const logout = useStore(state => state.logout);
  const isOnline = useStore(state => state.isOnline);
  const settings = useStore(state => state.settings);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (isMobileMode && isOpen) {
      const focusableElements = sidebarRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0] as HTMLElement;
      const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

      const handleTab = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isMobileMode, isOpen]);

  // Swipe logic
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart !== null) {
      const touchEnd = e.changedTouches[0].clientX;
      if (touchStart - touchEnd > 50) onClose(); // Swiped left
      setTouchStart(null);
    }
  };

  const isExpanded = sidebarState === 'expanded' || (isMobileMode && isOpen);

  return (
    <aside
      ref={sidebarRef}
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={!isOpen && isMobileMode}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "fixed lg:static inset-y-0 left-0 bg-bg-sidebar flex flex-col no-print z-50 transition-transform lg:transition-none duration-280 ease-in-out",
        isMobileMode && !isOpen ? "-translate-x-full" : "translate-x-0",
        !isMobileMode && (sidebarState === 'expanded' ? "w-[220px]" : "w-[60px]"),
        isMobileMode && "w-[260px]"
      )}
      style={{
        transition: isMobileMode ? 'transform 280ms ease-in-out' : 'width 250ms ease-in-out, transform 280ms ease-in-out'
      }}
    >
      {/* Header */}
      <div className={cn("h-14 flex items-center shrink-0 border-b border-bg-sidebar-hover transition-all duration-200", isExpanded ? "px-5" : "px-0 justify-center")}>
        <div className={cn("w-8 h-8 rounded-lg bg-bg-sidebar-active flex items-center justify-center text-white font-black text-sm shadow-md shadow-black/20 shrink-0", !isExpanded && "scale-90")}>
          LB
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ delay: 0.15 }}
              className="ml-3 overflow-hidden"
            >
              <h1 className="font-bold text-xs tracking-tight text-white uppercase leading-none truncate w-32">
                {settings.name || 'LUX BISTRO'}
              </h1>
              <p className="text-[10px] text-text-sidebar font-medium tracking-wide mt-0.5 uppercase">POS System</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => isMobileMode && onClose()}
              className={cn(
                "group relative flex items-center rounded-xl transition-all h-10",
                isExpanded ? "px-3 gap-3" : "justify-center",
                isActive 
                  ? "bg-bg-sidebar-active text-text-inverse shadow-lg shadow-black/10 after:absolute after:left-0 after:w-[3px] after:h-5 after:bg-white after:rounded-r-full" 
                  : "text-text-sidebar hover:text-text-inverse hover:bg-bg-sidebar-hover"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-text-sidebar group-hover:text-text-inverse transition-colors")} />
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.15 }}
                    className="font-black uppercase text-[10px] tracking-widest truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {!isExpanded && !isMobileMode && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  {item.label}
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className={cn("mt-auto border-t border-bg-sidebar-hover flex flex-col transition-all duration-200", isExpanded ? "p-4 space-y-3" : "py-4 items-center space-y-4")}>
        {/* Status Indicators */}
        <div className={cn("flex flex-col gap-2", !isExpanded && "items-center")}>
          <div className="group relative flex items-center gap-3">
             <div className={cn("w-2 h-2 rounded-full shrink-0", isOnline ? "bg-success" : "bg-danger")} />
             {isExpanded && <span className="text-[9px] font-black text-text-sidebar uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>}
             
             {!isExpanded && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-bg-sidebar-hover text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  {isOnline ? 'Network Online' : 'Network Offline'}
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-bg-sidebar-hover rotate-45" />
                </div>
             )}
          </div>
        </div>

        {/* User Card */}
        {isExpanded ? (
          <div className="p-2 bg-bg-sidebar-hover border border-transparent rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg-sidebar-active flex items-center justify-center text-white font-black text-[10px] uppercase shrink-0 leading-none">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[10px] font-bold text-white truncate uppercase tracking-tight">{user?.email?.split('@')[0] || 'Operator'}</p>
                 <p className="text-[8px] text-text-sidebar opacity-50 font-mono font-bold uppercase tracking-widest leading-none mt-1">V.2.4.0-STABLE</p>
              </div>
            </div>
            <button 
              onClick={() => logout()}
              className="w-full h-8 flex items-center justify-center gap-2 bg-bg-sidebar border border-transparent rounded-lg text-danger hover:bg-danger hover:text-white transition-all group shadow-sm active:scale-95"
            >
              <LogOut className="w-3 h-3 group-hover:rotate-12 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] leading-none mt-0.5">Terminate</span>
            </button>
          </div>
        ) : (
          <button 
            onClick={() => logout()}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-sidebar hover:text-danger hover:bg-bg-sidebar-hover transition-all active:scale-90 group relative"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-bg-sidebar text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 z-[100] whitespace-nowrap">
              Log Out
              <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-bg-sidebar rotate-45" />
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};

const TopBar = ({ 
  isSidebarOpen, 
  onToggleSidebar, 
  isMobileMode,
  sidebarState
}: { 
  isSidebarOpen: boolean, 
  onToggleSidebar: () => void,
  isMobileMode: boolean,
  sidebarState: 'expanded' | 'collapsed'
}) => {
  const ingredients = useStore(state => state.ingredients);
  const isOnline = useStore(state => state.isOnline);
  const forceSync = useStore(state => state.forceSync);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const lowStockCount = ingredients.filter(i => i.currentStock <= i.reorderThreshold).length;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await forceSync();
    setIsSyncing(false);
  };

  const showCloseIcon = (isMobileMode && isSidebarOpen) || (!isMobileMode && sidebarState === 'expanded');

  return (
    <header className="h-14 bg-bg-surface border-b border-border-light flex items-center justify-between no-print shrink-0 shadow-sm z-40 relative">
      <div className="flex items-center gap-0">
        <button
          onClick={onToggleSidebar}
          aria-label={showCloseIcon ? "Close navigation" : "Open navigation"}
          className="h-14 w-14 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-all outline-none"
        >
          <motion.div
            key={showCloseIcon ? 'close' : 'menu'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {showCloseIcon ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </motion.div>
        </button>

        <div className="h-8 w-px bg-border-light mr-4" />
        
        <div className="flex items-center gap-6">
          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 text-[9px] font-bold text-text-muted uppercase tracking-widest hover:text-accent transition-colors group"
          >
            <RefreshCw className={cn("w-3 h-3 transition-transform duration-500", isSyncing && "animate-spin")} />
            <span className="hidden sm:inline">Sync Cloud</span>
          </button>
          
          <div className="hidden lg:flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-success" : "bg-danger")} />
            <span className={cn("text-[10px] font-bold uppercase tracking-tight", isOnline ? "text-success" : "text-danger")}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 px-6">
        {lowStockCount > 0 && (
          <Link 
            to="/inventory"
            className="flex items-center gap-2 px-3 py-1.5 bg-warning-light border border-warning-border rounded-full group hover:bg-warning/10 transition-all shadow-sm"
          >
            <AlertTriangle className="w-3 h-3 text-warning group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-warning uppercase tracking-widest hidden md:inline">{lowStockCount} Alerts</span>
          </Link>
        )}
        <div className="text-right flex flex-col md:flex-row md:gap-4 md:items-center">
          <p className="text-[10px] font-bold text-text-primary uppercase tracking-tight leading-none">{format(currentTime, 'EEE, MMM d')}</p>
          <p className="text-[10px] text-text-secondary font-medium tracking-wide leading-none mt-0.5 md:mt-0">{format(currentTime, 'HH:mm:ss')}</p>
        </div>
      </div>
    </header>
  );
};

export default function App() {
  const init = useStore(state => state.init);
  const isLoading = useStore(state => state.isLoading);
  const user = useStore(state => state.user);
  const sidebarState = useStore(state => state.sidebarState);
  const setSidebarStateResult = useStore(state => state.setSidebarState);
  
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);

  // Licensing Integration State Machine
  const [licenseState, setLicenseState] = useState<'checking' | 'active' | 'warning' | 'expired' | 'missing' | 'offline_expired'>('checking');
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [licenseWarningDismissed, setLicenseWarningDismissed] = useState(false);

  // Activation Page Forms Local State
  const [activationKey, setActivationKey] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const checkLicense = async () => {
    try {
      setLicenseState('checking');
      const info = await loadLocalLicense();
      
      if (!info) {
        setLicenseState('missing');
        return;
      }
      
      setLicenseInfo(info);
      const now = Date.now();
      
      if (info.expiresAt <= now) {
        setLicenseState('expired');
        return;
      }

      const msLeft = info.expiresAt - now;
      const calculatedDaysLeft = Math.ceil(msLeft / 86400000);
      setDaysLeft(calculatedDaysLeft);

      const online = navigator.onLine;

      if (online && fireStore) {
        try {
          const docSnap = await getDocFromServer(doc(fireStore, 'licenseKeys', info.keyId));
          if (!docSnap.exists()) {
            await clearLocalLicense();
            setLicenseInfo(null);
            setLicenseState('missing');
            return;
          }
          const data = docSnap.data();
          if (data.isUsed === false || data.usedByDeviceId !== info.deviceId) {
            await clearLocalLicense();
            setLicenseInfo(null);
            setLicenseState('missing');
            return;
          }

          const updated = await saveLocalLicense(
            info.keyId,
            info.restaurantId,
            info.expiresAt,
            true,
            info.deviceId,
            Date.now()
          );
          setLicenseInfo(updated);
        } catch (e) {
          console.error("Online license fetch failed, falling back to offline check:", e);
          runOfflineValidation(info, now);
          return;
        }
      } else {
        runOfflineValidation(info, now);
        return;
      }

      if (calculatedDaysLeft <= 10) {
        setLicenseState('warning');
      } else {
        setLicenseState('active');
      }
    } catch (err) {
      console.error("License check crashed:", err);
      setLicenseState('missing');
    }
  };

  const runOfflineValidation = (info: any, now: number) => {
    const daysSinceLastValidation = (now - info.lastValidatedAt) / 86400000;
    if (daysSinceLastValidation > 14) {
      setLicenseState('offline_expired');
    } else {
      const msLeft = info.expiresAt - now;
      const dLeft = Math.ceil(msLeft / 86450000);
      if (dLeft <= 10) {
        setLicenseState('warning');
      } else {
        setLicenseState('active');
      }
    }
  };

  useEffect(() => {
    checkLicense();
    window.addEventListener('license-updated', checkLicense);
    return () => window.removeEventListener('license-updated', checkLicense);
  }, []);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 5 === 0) {
        formatted += '-';
      }
      formatted += value[i];
    }
    setActivationKey(formatted.slice(0, 29));
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError(null);
    setActivationSuccess(null);

    if (!activationKey.trim()) {
      setActivationError("Please enter a license key.");
      return;
    }

    setIsActivating(true);
    try {
      const res = await activateLicenseKey(activationKey);
      if (res.success) {
        setActivationSuccess("License activated successfully! Relax while we load the system...");
        setActivationKey('');
        await checkLicense();
      } else {
        if (res.reason && (res.reason.includes("Invalid license signature") || res.reason.includes("parsing payload") || res.reason.includes("signature verification") || res.reason.includes("Invalid license key"))) {
          setActivationError("Invalid license key. Please check and try again.");
        } else if (res.reason && res.reason.includes("already been used on another device")) {
          setActivationError("This key is already used on another device.");
        } else {
          setActivationError(res.reason || "Invalid license key. Please check and try again.");
        }
      }
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setIsActivating(false);
    }
  };

  useEffect(() => {
    init();
    
    // Check initial screen size
    const checkSize = () => {
      setIsMobileMode(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsOverlayOpen(false);
      }
    };
    
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [init]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOverlayOpen(false);
        if (!isMobileMode && sidebarState === 'expanded') {
          setSidebarStateResult('collapsed');
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileMode, sidebarState, setSidebarStateResult]);

  const toggleSidebar = () => {
    if (isMobileMode) {
      setIsOverlayOpen(!isOverlayOpen);
    } else {
      setSidebarStateResult(sidebarState === 'expanded' ? 'collapsed' : 'expanded');
    }
  };

  const handleSwipeRight = () => {
    if (isMobileMode) setIsOverlayOpen(true);
  };

  useEffect(() => {
    let startX: number;
    const handleTs = (e: TouchEvent) => startX = e.touches[0].clientX;
    const handleTe = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      if (startX < 30 && endX - startX > 80) handleSwipeRight();
    };
    window.addEventListener('touchstart', handleTs);
    window.addEventListener('touchend', handleTe);
    return () => {
      window.removeEventListener('touchstart', handleTs);
      window.removeEventListener('touchend', handleTe);
    };
  }, [isMobileMode]);

  if (isLoading || licenseState === 'checking') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-app">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center text-white font-black text-xl shadow-xl shadow-accent/20 animate-bounce">
            LB
          </div>
          <div className="text-text-primary font-mono text-[10px] tracking-[0.5em] animate-pulse uppercase">
            Initializing System...
          </div>
        </div>
      </div>
    );
  }

  if (licenseState === 'missing') {
    const activeDeviceId = getOrCreateDeviceId();
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-app overflow-y-auto p-4 select-none">
        <div className="w-full max-w-xl bg-bg-surface border border-border-light rounded-2xl p-8 md:p-12 shadow-xl space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-accent/20">
              LB
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-text-primary">License Key Required</h2>
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mt-1">Activate POS Station to Continue</p>
            </div>
          </div>

          <form onSubmit={handleActivate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider block text-center">
                Enter Activation License Key
              </label>
              <input
                type="text"
                value={activationKey}
                onChange={handleKeyChange}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                className="w-full h-14 bg-bg-surface-2 border-2 border-border-light rounded-xl px-5 text-xl font-mono font-bold tracking-widest text-text-primary focus:border-accent outline-none placeholder:text-text-placeholder text-center uppercase"
                disabled={isActivating}
                required
              />
            </div>

            {activationError && (
              <div className="p-4 bg-danger-light border border-danger-border rounded-xl text-danger font-bold text-xs leading-relaxed uppercase tracking-wide text-center">
                ⚠️ {activationError}
              </div>
            )}

            {activationSuccess && (
              <div className="p-4 bg-success-light border border-success-border rounded-xl text-success font-bold text-xs leading-relaxed uppercase tracking-wide text-center">
                ✅ {activationSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={isActivating}
              className="w-full btn-primary h-14 text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              {isActivating ? 'Verifying Activation...' : 'Activate Station'}
            </button>
          </form>

          <div className="border-t border-border-light pt-6 space-y-4">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold text-text-placeholder uppercase tracking-widest mb-1">Station Device Identification</span>
              <div className="flex items-center gap-2 max-w-full">
                <div className="font-mono text-[10px] font-bold text-text-secondary px-3 py-1.5 bg-bg-surface-2 border border-border-light rounded-md truncate max-w-full font-bold">
                  {activeDeviceId}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeDeviceId);
                    toast.success("Device ID copied to clipboard!");
                  }}
                  className="p-1.5 border border-border-light bg-bg-surface-2 text-text-muted hover:text-text-primary rounded-md transition-all active:scale-95"
                  title="Copy Device ID"
                  type="button"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (licenseState === 'expired' || licenseState === 'offline_expired') {
    const activeDeviceId = getOrCreateDeviceId();
    const isOfflineExp = licenseState === 'offline_expired';
    
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-app p-4 select-none">
        <div className="w-full max-w-xl bg-bg-surface border-2 border-danger-border rounded-2xl p-8 md:p-12 shadow-2xl space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center border border-danger shadow-lg shadow-danger/10 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text-primary">
                {isOfflineExp ? 'Security Audit Halt' : 'License Terminated'}
              </h2>
              <p className="text-danger font-bold text-xs uppercase tracking-widest mt-1">
                {isOfflineExp ? 'Connection Sync Required' : 'Access Suspended'}
              </p>
            </div>
          </div>

          <div className="bg-bg-surface-2 border border-border-light rounded-xl p-6 space-y-4 text-center">
            {isOfflineExp ? (
              <p className="text-text-secondary font-bold text-xs uppercase tracking-wide leading-relaxed">
                Cannot verify license authenticity. Please connect this device to the internet to authorize systems and continue.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-text-secondary font-bold text-xs uppercase tracking-wide leading-relaxed">
                  Your system license has expired. Please contact your software provider to renew and reinstate POS operations.
                </p>
                {licenseInfo && (
                  <p className="text-text-placeholder font-mono text-[10px] uppercase font-bold">
                    Expiration Date: {format(new Date(licenseInfo.expiresAt), 'dd MMM yyyy HH:mm')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border-light pt-6 flex flex-col items-center space-y-4">
            <div className="grid grid-cols-2 gap-4 w-full text-center">
              <div>
                <span className="text-[9px] font-black text-text-placeholder uppercase tracking-widest block mb-1">Restaurant ID</span>
                <span className="font-mono text-xs font-bold text-text-primary">{licenseInfo?.restaurantId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-text-placeholder uppercase tracking-widest block mb-1">State Code</span>
                <span className="font-mono text-xs font-bold text-text-primary">{licenseState.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col items-center w-full">
              <span className="text-[9px] font-bold text-text-placeholder uppercase tracking-widest mb-1">Device ID Code</span>
              <div className="flex items-center gap-2 max-w-full">
                <div className="font-mono text-[10px] font-bold text-text-secondary px-3 py-1.5 bg-bg-surface-2 border border-border-light rounded-md truncate max-w-full">
                  {activeDeviceId}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeDeviceId);
                    toast.success("Device ID copied to clipboard!");
                  }}
                  className="p-1.5 border border-border-light bg-bg-surface-2 text-text-muted hover:text-text-primary rounded-md transition-all active:scale-95"
                  title="Copy Device ID"
                  type="button"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {isOfflineExp && (
              <button
                onClick={checkLicense}
                className="w-full btn-primary h-12 text-xs font-bold uppercase tracking-widest shadow-md flex items-center justify-center gap-2 active:scale-95 mt-4"
                type="button"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Validation Sync
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-bg-app overflow-hidden">
        <Login />
        <Toaster position="top-right" theme="light" richColors />
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-bg-app relative animate-fade-in">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {isMobileMode && isOverlayOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsOverlayOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[45]"
            />
          )}
        </AnimatePresence>

        <Sidebar 
          isOpen={isOverlayOpen} 
          onClose={() => setIsOverlayOpen(false)} 
          sidebarState={sidebarState}
          setSidebarState={setSidebarStateResult}
          isMobileMode={isMobileMode}
        />

        <div 
          className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-250 ease-in-out"
          style={{ width: '100%' }}
        >
          {/* Expiring Warning Banner */}
          {!licenseWarningDismissed && licenseState === 'warning' && (
            <div className="bg-warning text-text-primary px-6 py-3 flex items-center justify-between shadow-md border-b border-warning-border/40 shrink-0 select-none animate-slide-down">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-text-primary shrink-0 animate-bounce" />
                <span className="text-[11px] font-extrabold uppercase tracking-wide">
                  ⚠️ License expires in {daysLeft} days. Go to <Link to="/settings" className="underline hover:text-text-secondary transition-colors font-black">Settings → License</Link> to renew.
                </span>
              </div>
              <button 
                onClick={() => setLicenseWarningDismissed(true)}
                className="text-text-primary/70 hover:text-text-primary p-1 hover:bg-black/5 rounded-full transition-all active:scale-95"
                title="Dismiss warning"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <TopBar 
            isSidebarOpen={isOverlayOpen} 
            onToggleSidebar={toggleSidebar} 
            isMobileMode={isMobileMode}
            sidebarState={sidebarState}
          />
          <main className="flex-1 overflow-auto relative custom-scrollbar">
            <Routes>
              <Route path="/" element={<POS />} />
              <Route path="/menu" element={<MenuManagement />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/records" element={<Records />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster position="top-right" theme="light" richColors />
    </Router>
  );
}
