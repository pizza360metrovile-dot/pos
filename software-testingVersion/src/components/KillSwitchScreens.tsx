import React, { useState } from 'react';
import { Lock, Wrench, RefreshCw, WifiOff } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';

export function ShutdownScreen() {
  const isOnline = useStore(state => state.isOnline);
  const globalShutdown = useStore(state => state.globalShutdown);
  const globalShutdownMessage = useStore(state => state.globalShutdownMessage);
  const restaurantShutdownMessage = useStore(state => state.restaurantShutdownMessage);
  const fetchLatestKillSwitchState = useStore(state => state.fetchLatestKillSwitchState);

  const [isChecking, setIsChecking] = useState(false);

  const shutdownMessage = globalShutdown ? globalShutdownMessage : restaurantShutdownMessage;
  const displayMessage = shutdownMessage.trim() !== '' 
    ? shutdownMessage 
    : 'This software has been suspended. Please contact your service provider to restore access.';

  const handleCheckConnection = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      await fetchLatestKillSwitchState();
      // After fetching, check if the state is still shut down
      const currentGlobalShutdown = useStore.getState().globalShutdown;
      const currentRestaurantShutdown = useStore.getState().restaurantShutdown;
      
      if (currentGlobalShutdown || currentRestaurantShutdown) {
        toast.error("Still suspended");
      } else {
        toast.success("Service restored");
      }
    } catch (err) {
      toast.error("Could not reach server. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-app flex flex-col items-center justify-center p-6 z-[9999] overflow-hidden select-none">
      <div className="w-full max-w-md bg-bg-surface border border-border-light rounded-2xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center space-y-8 animate-fade-in">
        {/* Lock Icon */}
        <div className="w-20 h-20 bg-danger/10 text-danger rounded-2xl flex items-center justify-center shadow-lg shadow-danger/15 animate-pulse">
          <Lock className="w-10 h-10" />
        </div>

        {/* Heading & Message */}
        <div className="space-y-3">
          <h1 className="text-[24px] font-extrabold text-text-primary tracking-tight uppercase">
            Service Suspended
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed font-medium">
            {displayMessage}
          </p>
        </div>

        {/* Dynamic Action Area */}
        <div className="w-full pt-4">
          {isOnline ? (
            <button
              onClick={handleCheckConnection}
              disabled={isChecking}
              className="w-full btn-primary py-4 px-6 rounded-xl text-[11px] font-bold tracking-widest uppercase shadow-lg shadow-accent/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Verifying...' : 'Check Connection'}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <WifiOff className="w-5 h-5 text-text-placeholder" />
              <p className="text-[11px] font-bold uppercase tracking-wider italic">
                Connect to internet to restore access
              </p>
            </div>
          )}
        </div>

        {/* Bottom Reference */}
        <div className="text-[10px] text-text-placeholder font-semibold tracking-widest uppercase pt-4 border-t border-border-light w-full">
          Saynz • 0347-1887181
        </div>
      </div>
    </div>
  );
}

export function MaintenanceScreen() {
  const fetchLatestKillSwitchState = useStore(state => state.fetchLatestKillSwitchState);
  const maintenanceMessage = useStore(state => state.maintenanceMessage);

  const [isRetrying, setIsRetrying] = useState(false);

  const displayMessage = maintenanceMessage.trim() !== '' 
    ? maintenanceMessage 
    : 'System is under maintenance. Please try again shortly.';

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await fetchLatestKillSwitchState();
      const currentMaintenance = useStore.getState().maintenanceMode;
      if (currentMaintenance) {
        toast.error("Still under maintenance");
      } else {
        toast.success("Maintenance complete");
      }
    } catch (err) {
      toast.error("Connection failed. Please check internet and retry.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-app flex flex-col items-center justify-center p-6 z-[9999] overflow-hidden select-none">
      <div className="w-full max-w-md bg-bg-surface border border-border-light rounded-2xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center space-y-8 animate-fade-in">
        {/* Wrench Icon */}
        <div className="w-20 h-20 bg-warning/10 text-warning rounded-2xl flex items-center justify-center shadow-lg shadow-warning/15">
          <Wrench className="w-10 h-10 animate-pulse" />
        </div>

        {/* Heading & Message */}
        <div className="space-y-3">
          <h1 className="text-[24px] font-extrabold text-text-primary tracking-tight uppercase">
            Under Maintenance
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed font-medium">
            {displayMessage}
          </p>
        </div>

        {/* Always Visible Retry Button */}
        <div className="w-full pt-4">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-4 px-6 rounded-xl text-[11px] font-bold tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking...' : 'Retry'}
          </button>
        </div>

        {/* Bottom Reference */}
        <div className="text-[10px] text-text-placeholder font-semibold tracking-widest uppercase pt-4 border-t border-border-light w-full">
          Saynz • 0347-1887181
        </div>
      </div>
    </div>
  );
}
