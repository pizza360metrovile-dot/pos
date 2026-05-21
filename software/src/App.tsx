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
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster } from 'sonner';
import { useStore } from './store/useStore';
import { format } from 'date-fns';

// Pages
import POS from './pages/POS';
import MenuManagement from './pages/MenuManagement';
import Records from './pages/Records';
import SettingsPage from './pages/Settings';
import Inventory from './pages/Inventory';
import Login from './components/Login';
import LicenseLockScreen from './components/LicenseLockScreen';

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
  const settings = useStore(state => state.settings);
  const sidebarState = useStore(state => state.sidebarState);
  const setSidebarStateResult = useStore(state => state.setSidebarState);
  
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);

  const [licenseStatus, setLicenseStatus] = useState<'active' | 'locked'>('locked');
  const [licenseDaysLeft, setLicenseDaysLeft] = useState<number>(0);

  const checkLicenseStatus = (settings: any) => {
    // If no expiry is found, treat as EXPIRED (Locked)
    if (!settings?.licenseExpiry) {
        setLicenseStatus('locked');
        setLicenseDaysLeft(0);
        return;
    }

    const expiry = new Date(settings.licenseExpiry);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft > 0) {
        setLicenseStatus('active');
        setLicenseDaysLeft(daysLeft);
    } else {
        setLicenseStatus('locked'); // App is now locked
        setLicenseDaysLeft(0);
    }
  };

  useEffect(() => {
    checkLicenseStatus(settings);
  }, [settings?.licenseExpiry]);

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

  if (isLoading) {
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

  if (!user) {
    return (
      <div className="h-screen w-screen bg-bg-app overflow-hidden">
        <Login />
        <Toaster position="top-right" theme="light" richColors />
      </div>
    );
  }

  if (licenseStatus === 'locked') {
    return (
      <div className="h-screen w-screen bg-bg-app overflow-hidden">
        <LicenseLockScreen />
        <Toaster position="top-right" theme="light" richColors />
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-bg-app relative">
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
