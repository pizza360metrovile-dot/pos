import React, { useEffect, useState } from "react";
import { useStore, isSessionValid } from "./store";
import { isDemoMode } from "./firebase";
import AuthScreen from "./components/AuthScreen";
import PerformanceTab from "./components/PerformanceTab";
import RecordsTab from "./components/RecordsTab";
import DeletedTab from "./components/DeletedTab";
import InventoryTab from "./components/InventoryTab";
import ExpensesTab from "./components/ExpensesTab";

import { 
  ChefHat, LogOut, RefreshCw, Layers, 
  ShoppingBag, Trash2, TrendingUp, DollarSign, HelpCircle, Activity 
} from "lucide-react";

export default function App() {
  const {
    isAuthenticated,
    sessionToken,
    connectionStatus,
    activeTab,
    setActiveTab,
    logout,
    updateActivity,
    initRealtimeSync,
    simulatePOSActivity,
    orders,
    ingredients,
    expenses,
    restaurantId,
    setRestaurantId,
    firestoreDiagnostics
  } = useStore();

  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // 1. Core listener to initialize database listeners OR simulator fallback
  useEffect(() => {
    if (isAuthenticated) {
      const cleanup = initRealtimeSync();
      return () => {
        cleanup();
      };
    }
  }, [isAuthenticated, initRealtimeSync, restaurantId]);

  // 2. Automated background live activity simulation (Demo Mode only)
  useEffect(() => {
    if (isAuthenticated && isDemoMode) {
      // Trigger background POS changes every 22 seconds to mimic continuous dining shifts
      const interval = setInterval(() => {
        simulatePOSActivity();
        setSimMessage("Simulated background POS activity completed!");
        setTimeout(() => setSimMessage(null), 3000);
      }, 22000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, simulatePOSActivity]);

  // .3 Session Inactivity Guard (Tracks click/key actions, checks 1-hour expiration)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleInactivityEvents = () => {
      updateActivity();
    };

    // List of active mouse/gesture indicators
    window.addEventListener("click", handleInactivityEvents);
    window.addEventListener("keydown", handleInactivityEvents);
    window.addEventListener("scroll", handleInactivityEvents);
    window.addEventListener("touchstart", handleInactivityEvents);

    // Periodic check every 15 seconds to ensure token expiration isn't silent
    const tokenCheckTimer = setInterval(() => {
      // Check if session token expired
      const token = localStorage.getItem("restaurant_owner_session_token");
      if (!isSessionValid(token)) {
        logout();
      };
    }, 15000);

    return () => {
      window.removeEventListener("click", handleInactivityEvents);
      window.removeEventListener("keydown", handleInactivityEvents);
      window.removeEventListener("scroll", handleInactivityEvents);
      window.removeEventListener("touchstart", handleInactivityEvents);
      clearInterval(tokenCheckTimer);
    };
  }, [isAuthenticated, updateActivity, logout]);

  // Trigger immediate manual simulated event for testing
  const triggerManualSimulation = () => {
    simulatePOSActivity();
    setSimMessage("⚡ Live POS simulation event triggered instantly! Check relevant tabs.");
    setTimeout(() => setSimMessage(null), 4000);
  };

  // Auth Gate check
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Navigation tab links mapping
  const tabs = [
    { id: "PERFORMANCE", label: "PERFORMANCE", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "RECORDS", label: "RECORDS", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: "DELETED", label: "DELETED RECORDS", icon: <Trash2 className="w-3.5 h-3.5" /> },
    { id: "INVENTORY", label: "INVENTORY", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "EXPENSES", label: "EXPENSES", icon: <DollarSign className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#111827] font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. STICKY TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-xs px-6 h-16 flex items-center">
        <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between">
          
          {/* Left: Restaurant name/logo - Font: 18px, 700, #111827 */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
              <ChefHat className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="text-[18px] font-bold text-[#111827] tracking-tight block">Pizza360 Metrovile</span>
            </div>
          </div>

          {/* Center: Dashboard title - Font: 16px, 600, #374151 */}
          <div className="text-center hidden md:block">
            <h1 className="text-[16px] font-semibold text-[#374151] tracking-wide">
              Owner Dashboard
            </h1>
          </div>

          {/* Right: Connection diagnostics & Logout */}
          <div className="flex items-center space-x-4">
            {/* Connection Status Indicator pill */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-[#F7F8FA] text-[#374151] border border-[#E5E7EB] rounded-full text-xs font-semibold">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                connectionStatus === "connected" 
                  ? "bg-[#16A34A] animate-pulse" 
                  : (connectionStatus === "connecting" ? "bg-[#D97706] animate-bounce" : "bg-[#DC2626]")
              }`}></div>
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider font-medium text-[#6B7280]">
                {connectionStatus === "connected" ? (isDemoMode ? "Live Demo Data" : "Synchronized") : (connectionStatus === "connecting" ? "Connecting..." : "Offline Cached")}
              </span>
              <span className="sm:hidden font-bold text-[10px]">
                {connectionStatus === "connected" ? "LIVE" : "OFF"}
              </span>
            </div>

            {/* Logout trigger (System logout icon) - Button: secondary style: #F7F8FA bg, #111827 text, 8px radius */}
            <button
              id="header-logout-btn"
              onClick={logout}
              title="Logout from administrator panel"
              className="px-3 py-2 rounded-[8px] bg-[#F7F8FA] text-[#111827] hover:opacity-90 active:scale-95 transition-all flex items-center space-x-2 cursor-pointer border border-[#E5E7EB] text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5 text-[#374151]" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </header>

      {/* 2. TAB NAVIGATION (Sticky beneath top header, scrollable on smartphones) */}
      <nav className="bg-white border-b border-[#E5E7EB] px-6 sticky top-16 z-30 overflow-x-auto no-scrollbar">
        <div className="max-w-[1400px] mx-auto flex items-center space-x-6 md:space-x-8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                id={`tab-nav-btn-${tab.id.toLowerCase()}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 text-[14px] font-medium relative shrink-0 transition-all flex items-center space-x-2 cursor-pointer focus:outline-none ${
                  isActive 
                    ? "text-[#3B82F6] font-semibold" 
                    : "text-[#6B7280] hover:text-[#374151]"
                }`}
              >
                {React.cloneElement(tab.icon, { 
                  className: `w-4 h-4 ${isActive ? "text-[#3B82F6]" : "text-[#6B7280]"}` 
                })}
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#3B82F6] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 2.5 REAL-TIME DB CONTEXT & DIAGNOSTICS CONTROL PANEL */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Active Restaurant Target Context:</span>
            <div className="flex items-center space-x-1.5 bg-[#F7F8FA] border border-[#E5E7EB] rounded-[8px] p-1.5 shadow-2xs">
              <input
                id="restaurant-uid-input"
                type="text"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="Enter Restaurant UID..."
                className="bg-white rounded-[6px] px-3 py-1 text-xs text-[#111827] w-56 font-mono font-semibold border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#3B82F6] transition-all"
                title="Input POS restaurant UID to sync metrics dynamically"
              />
              <span className="text-[10px] text-[#6B7280] font-mono font-semibold pr-2 hidden sm:inline border-l border-[#E5E7EB] pl-2">
                restaurants/{restaurantId}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0 self-end md:self-auto">
            <button
              id="toggle-diagnostics-btn"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-xs font-semibold text-[#3B82F6] bg-blue-50/65 hover:bg-blue-100/80 transition-colors border border-blue-200/50 rounded-[8px] px-3.5 py-2 flex items-center space-x-2 cursor-pointer shadow-2xs"
            >
              <Activity className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>{showDiagnostics ? "Hide Sync Diagnostics" : "Monitor Streams & Errors"}</span>
            </button>
          </div>
        </div>

        {/* Expandable status grid showing active collections stream diagnostic */}
        {showDiagnostics && (
          <div className="max-w-[1400px] mx-auto mt-3.5 p-4 border border-[#E5E7EB] rounded-xl bg-[#F7F8FA] animate-fade-in space-y-3.5 shadow-2xs text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E7EB] pb-2 gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#374151] flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse"></span>
                <span>Active Firestore Snapshot Subscriptions</span>
              </h3>
              <span className="text-[10px] font-mono text-[#6B7280] bg-white border border-[#E5E7EB] px-2 py-0.5 rounded-[4px]">
                restaurants/{restaurantId}/[collection]
              </span>
            </div>

            {isDemoMode ? (
              <p className="text-xs text-[#D97706] font-medium bg-amber-50 border border-amber-200/60 p-3 rounded-[8px]">
                ⚠️ Running in <strong>Local Simulated Mode</strong>. To sync with a live Firestore database, configure your environment with the correct <code>VITE_FIREBASE_...</code> keys in your secrets manager.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.values(firestoreDiagnostics).length === 0 ? (
                  <p className="text-xs text-[#6B7280] italic col-span-full py-2">Waiting for Firestore listeners to initialize...</p>
                ) : (
                  Object.values(firestoreDiagnostics).map((diag) => {
                    const statusColors = {
                      loading: 'bg-amber-50 text-amber-800 border-amber-200/60',
                      active: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
                      empty: 'bg-blue-50 text-blue-800 border-blue-200/60',
                      error: 'bg-rose-50 text-rose-800 border-rose-200/60'
                    };
                    return (
                      <div key={diag.collection} className="bg-white p-3 border border-[#E5E7EB] rounded-lg shadow-3xs flex flex-col justify-between space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[11px] font-bold text-[#111827]">{diag.collection}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-[4px] border ${statusColors[diag.status] || ''}`}>
                            {diag.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6B7280] space-y-1.5">
                          <div className="flex justify-between">
                            <span>Documents cached:</span>
                            <span className="font-mono font-bold text-[#111827]">{diag.docCount}</span>
                          </div>
                          {diag.lastUpdated && (
                            <div className="flex justify-between text-[9px] text-gray-400">
                              <span>Refreshed:</span>
                              <span className="font-mono">{diag.lastUpdated}</span>
                            </div>
                          )}
                          {diag.errorMsg && (
                            <div className="text-[9px] text-red-600 bg-red-50 border border-red-100 p-2 rounded-md mt-1.5 break-words font-mono">
                              <strong>Diagnostic Error:</strong> {diag.errorMsg}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SIMULATION DIAGNOSTIC CONTROLLER */}
      {isDemoMode && (
        <div className="bg-[#1A1D23] text-white py-2.5 px-6 border-b border-[#111827] text-center">
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#3B82F6] shrink-0" />
              <p className="font-mono text-gray-300">
                <span className="font-bold text-[#F7F8FA]">DEMO SIMULATION:</span> CONTINUOUS DINING SHIFTER ACTIVE. {simMessage && <span className="text-[#3B82F6] font-bold ml-1 transition-all">[{simMessage}]</span>}
              </p>
            </div>
            
            {/* Action button to immediately trigger a live purchase/deduction */}
            <button
              id="launcher-simulate-btn"
              onClick={triggerManualSimulation}
              className="bg-[#3B82F6] hover:opacity-90 active:scale-[0.98] transition-all text-white font-semibold px-3 py-1.5 rounded-[8px] text-xs cursor-pointer"
            >
              ⚡ Simulated Transaction
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN CONTENT CONTAINER (Padded sides, Desktop bounded) */}
      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6">
        
        {/* LAZY LOAD RENDERING TARGET SEGMENTS */}
        {activeTab === "PERFORMANCE" && <PerformanceTab />}
        {activeTab === "RECORDS" && <RecordsTab />}
        {activeTab === "DELETED" && <DeletedTab />}
        {activeTab === "INVENTORY" && <InventoryTab />}
        {activeTab === "EXPENSES" && <ExpensesTab />}

      </main>

      {/* FOOTER */}
      <footer className="py-8 bg-[#F7F8FA] border-t border-[#E5E7EB] text-center text-xs text-[#6B7280] space-y-1">
        <p className="font-semibold">© 2026 Restauranteur POS Panel. All Rights Reserved.</p>
        <p className="text-[11px] text-[#6B7280]/85 tracking-wide">SECURE ENCRYPTED POS DESK CONNECT SYSTEM</p>
      </footer>
    </div>
  );
}
