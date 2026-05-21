import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Receipt,
  Truck,
  Printer,
  ChefHat,
  Database,
  CloudDownload,
  Shield,
  Download,
  Upload,
  Save,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  LogOut,
  Award,
  Copy,
  Check,
  Key
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getRestaurantId, generateTestingKey } from '../services/licenseService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SECTIONS = [
  { id: 'profile', label: 'Restaurant Profile', icon: Building2, description: 'Basic information about your restaurant shown on receipts and reports' },
  { id: 'billing', label: 'Billing & Tax', icon: Receipt, description: 'Configure currency, tax rate, and how totals are calculated at checkout' },
  { id: 'delivery', label: 'Delivery', icon: Truck, description: 'Set delivery charges applied automatically to delivery orders' },
  { id: 'receipt', label: 'Receipt', icon: Printer, description: 'Customize what appears on the customer receipt when printed' },
  { id: 'kitchen', label: 'Kitchen & KOT', icon: ChefHat, description: 'Control how kitchen order tickets are printed and what they show' },
  { id: 'backup', label: 'Data & Backup', icon: Database, description: 'Export your data for safekeeping or import a previous backup to restore' },
  { id: 'account', label: 'Account & Security', icon: Shield, description: 'Manage your login credentials and session security' },
  { id: 'license', label: 'POS License', icon: Award, description: 'Manage your POS licenses, view status, activate offline keys' }
];

// Section Components
const SectionHeader = ({ label, icon: Icon, description }: { label: string, icon: any, description: string }) => (
  <div className="mb-8">
    <div className="flex items-center gap-4 mb-2">
      <div className="p-3 bg-accent rounded-xl shadow-lg shadow-accent/20">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h2 className="text-[17px] font-bold text-text-primary uppercase tracking-tight leading-none">{label}</h2>
    </div>
    <p className="text-text-muted text-[13px] font-medium ml-1">
      {description}
    </p>
    <div className="h-px bg-border-light w-full mt-6" />
  </div>
);

const SaveButton = ({ sectionId, label = "Save Settings", onSave, isSaved }: { sectionId: string, label?: string, onSave: (id: string) => void, isSaved: boolean }) => (
  <div className="flex justify-end pt-6 border-t border-border-light mt-8">
    <button
      onClick={() => onSave(sectionId)}
      className={cn(
        "px-8 py-3.5 rounded-lg flex items-center gap-3 font-bold uppercase text-[11px] tracking-widest transition-all active:scale-95 cursor-pointer relative z-30 pointer-events-auto",
        isSaved 
          ? "bg-success text-white shadow-lg shadow-success/20" 
          : "btn-primary"
      )}
    >
      {isSaved ? (
        <>
          <CheckCircle2 className="w-4 h-4" />
          Saved
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  </div>
);

const Toggle = ({ value, onChange, label }: { value: boolean, onChange: (v: boolean) => void, label: string }) => (
  <div className="flex items-center justify-between p-4 bg-bg-surface-2 rounded-lg border border-border-light transition-all hover:bg-bg-surface hover:shadow-sm">
    <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{label}</span>
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "w-10 h-5 rounded-full transition-all relative flex items-center p-1 cursor-pointer pointer-events-auto",
        value ? "bg-accent" : "bg-text-disabled"
      )}
    >
      <div className={cn(
        "w-3 h-3 bg-white rounded-full shadow-sm transition-all",
        value ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  </div>
);

const InputField = ({ label, type = "text", value, onChange, placeholder, unit, textarea, required }: { label: string, type?: string, value: any, onChange: (v: any) => void, placeholder?: string, unit?: string, textarea?: boolean, required?: boolean }) => (
  <div className="space-y-2">
    <label className="input-label">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <div className="relative group">
      {textarea ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="input-field min-h-[90px] py-4 resize-none pointer-events-auto relative z-10"
        />
      ) : (
        <>
          <input
            type={type}
            value={value === undefined || value === null ? '' : value}
            onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? 0 : parseFloat(e.target.value)) : e.target.value)}
            placeholder={placeholder}
            className={cn(
              "input-field pointer-events-auto relative z-10",
              unit && "pr-12"
            )}
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-placeholder uppercase tracking-widest pointer-events-none z-20">
              {unit}
            </span>
          )}
        </>
      )}
    </div>
  </div>
);

export default function Settings() {
  const { 
    settings, 
    updateSettings, 
    exportData, 
    importData, 
    user, 
    changePassword,
    logout,
    subscription,
    activateLicense,
    syncLicenses
  } = useStore();

  const [formData, setFormData] = useState(settings);
  const [activeSection, setActiveSection] = useState('profile');
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});

  // Licensing Page States
  const [restaurantId, setRestaurantId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    getRestaurantId().then(setRestaurantId);
  }, [formData.name]);

  const handleCopyText = (text: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => {
      setCopiedState(false);
    }, 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError('');
    setIsActivating(true);
    try {
      await activateLicense(licenseKeyInput.trim());
      setLicenseKeyInput('');
    } catch (err: any) {
      setActivationError(err.message || 'Verification failure');
    } finally {
      setIsActivating(false);
    }
  };

  const handleManualSyncKey = async () => {
    setIsSyncing(true);
    await syncLicenses();
    setIsSyncing(false);
  };

  const handleGenerateKey = async () => {
    const key = await generateTestingKey(restaurantId, Date.now());
    setGeneratedKey(key);
  };
  
  // Backup state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: '-10% 0px -80% 0px' }
    );

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleSave = async (sectionId: string) => {
    await updateSettings(formData);
    setSavedStates(prev => ({ ...prev, [sectionId]: true }));
    setTimeout(() => {
      setSavedStates(prev => ({ ...prev, [sectionId]: false }));
    }, 2000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rms-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await importData(json);
        window.location.reload();
      } catch (err) {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(importFile);
  };

  const onPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('Passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    setPassStatus('loading');
    try {
      await changePassword(passwords.new);
      setPassStatus('success');
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setPassStatus('idle'), 3000);
    } catch (err) {
      setPassStatus('error');
    }
  };

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  return (
    <div className="flex flex-col md:flex-row h-full bg-bg-app animate-fade-in overflow-hidden relative z-0 pointer-events-auto">
      {/* LEFT PANEL — Navigation */}
      <nav className="w-full md:w-[260px] bg-bg-sidebar border-b md:border-b-0 md:border-r border-border-light flex-shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar py-2 md:py-8 px-4 gap-2 z-10 pointer-events-auto">
        <div className="hidden md:block px-6 mb-8">
          <h1 className="text-[12px] font-bold tracking-widest text-text-secondary uppercase">Architecture</h1>
          <p className="text-[10px] text-text-placeholder font-bold uppercase mt-1">System Control Center</p>
        </div>
        
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "flex items-center gap-3 px-5 py-3.5 rounded-lg transition-all whitespace-nowrap min-w-fit md:min-w-0 group",
                isActive 
                  ? "bg-accent text-white shadow-md shadow-accent/20" 
                  : "text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : "text-text-disabled group-hover:text-text-primary")} />
              <span className="text-[11px] font-bold uppercase tracking-widest">{section.label}</span>
              {isActive && <ChevronRight className="hidden md:block w-3 h-3 ml-auto opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* RIGHT PANEL — Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-12 relative z-10 pointer-events-auto"
      >
        {/* Section 1: RESTAURANT PROFILE */}
        <section id="profile" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 transition-all hover:shadow-md relative z-20 pointer-events-auto">
          <SectionHeader {...SECTIONS[0]} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InputField 
              label="Restaurant Name" 
              value={formData.name} 
              onChange={v => setFormData({...formData, name: v})} 
              placeholder="e.g. The Gourmet Kitchen"
              required
            />
            <InputField 
              label="Phone Number" 
              value={formData.phone} 
              onChange={v => setFormData({...formData, phone: v})} 
              placeholder="+1 (555) 000-0000"
            />
            <div className="md:col-span-2">
              <InputField 
                label="Email Address" 
                value={formData.email} 
                onChange={v => setFormData({...formData, email: v})} 
                placeholder="hello@restaurant.com"
              />
            </div>
            <div className="md:col-span-2">
              <InputField 
                label="Restaurant Address" 
                value={formData.address} 
                onChange={v => setFormData({...formData, address: v})} 
                placeholder="123 Foodie St, Culinary District"
                textarea
              />
            </div>
          </div>
          <SaveButton sectionId="profile" label="Save Profile" onSave={handleSave} isSaved={!!savedStates['profile']} />
        </section>

        {/* Section 2: BILLING & TAX */}
        <section id="billing" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[1]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <InputField 
                  label="Currency Symbol" 
                  value={formData.currency} 
                  onChange={v => setFormData({...formData, currency: v})} 
                  placeholder="$"
                />
                <div className="space-y-2">
                  <label className="input-label">Currency Position</label>
                  <div className="flex bg-bg-surface-2 p-1 rounded-lg border border-border-light">
                    <button 
                      onClick={() => setFormData({...formData, currencyPosition: 'before'})}
                      className={cn("flex-1 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all", formData.currencyPosition === 'before' ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted")}
                    >
                      {formData.currency}10
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, currencyPosition: 'after'})}
                      className={cn("flex-1 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all", formData.currencyPosition === 'after' ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted")}
                    >
                      10{formData.currency}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <InputField 
                  label="Tax Rate" 
                  type="number" 
                  value={formData.taxPercentage} 
                  onChange={v => setFormData({...formData, taxPercentage: v})} 
                  unit="%"
                />
                <InputField 
                  label="Tax Label" 
                  value={formData.taxLabel} 
                  onChange={v => setFormData({...formData, taxLabel: v})} 
                  placeholder="e.g. VAT, GST"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="input-label">Tax Inclusion Mode</label>
                   <div className="flex bg-bg-surface-2 p-1 rounded-lg border border-border-light">
                    <button 
                      onClick={() => setFormData({...formData, taxInclusion: 'exclusive'})}
                      className={cn("flex-1 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all", formData.taxInclusion === 'exclusive' ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted")}
                    >
                      Exclusive (Add)
                    </button>
                    <button 
                      onClick={() => setFormData({...formData, taxInclusion: 'inclusive'})}
                      className={cn("flex-1 py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all", formData.taxInclusion === 'inclusive' ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted")}
                    >
                      Inclusive (Incl)
                    </button>
                  </div>
                </div>
                <Toggle 
                  label="Show tax breakdown on receipt" 
                  value={formData.showTaxBreakdown} 
                  onChange={v => setFormData({...formData, showTaxBreakdown: v})}
                />
              </div>
            </div>

            {/* Live Preview Section 2 */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden group shadow-xl">
               <div className="absolute top-0 right-0 px-4 py-2 bg-white/5 rounded-bl-xl border-b border-l border-white/5 text-[10px] font-bold tracking-widest text-white/30 uppercase">
                 Live Simulator
               </div>
               <div className="space-y-6 pt-4">
                 <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    <span>Simulator Load</span>
                    <span className="text-accent underline decoration-accent/30 underline-offset-4">#CFG-001</span>
                 </div>
                 <div className="space-y-5 font-mono">
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-[11px] text-white/50 uppercase tracking-widest">Base Item</span>
                      <span className="text-xl font-extrabold">
                        {formData.currencyPosition === 'before' && formData.currency}
                        10.00
                        {formData.currencyPosition === 'after' && formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-[10px] uppercase tracking-widest">{formData.taxLabel || 'Tax'} ({formData.taxPercentage}%)</span>
                      <span className="text-[13px] font-bold">
                        {formData.currencyPosition === 'before' && formData.currency}
                        {(10 * (formData.taxPercentage || 0) / 100).toFixed(2)}
                        {formData.currencyPosition === 'after' && formData.currency}
                      </span>
                    </div>
                    <div className="pt-6 mt-4 border-t border-accent/20 flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-accent uppercase tracking-[0.2em]">Total Yield</span>
                        <span className="text-4xl font-extrabold tracking-tighter text-white leading-none">
                          {formData.currencyPosition === 'before' && formData.currency}
                          {(10 + (formData.taxInclusion === 'exclusive' ? (10 * (formData.taxPercentage || 0) / 100) : 0)).toFixed(2)}
                          {formData.currencyPosition === 'after' && formData.currency}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-tighter bg-white/10 px-3 py-1 rounded-md mb-1">
                        {formData.taxInclusion}
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>
          <SaveButton sectionId="billing" label="Save Billing Settings" onSave={handleSave} isSaved={!!savedStates['billing']} />
        </section>

        {/* Section 3: DELIVERY */}
        <section id="delivery" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[2]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <Toggle 
                label="Enable Automatic Delivery Charges" 
                value={formData.deliveryChargeEnabled} 
                onChange={v => setFormData({...formData, deliveryChargeEnabled: v})}
              />
              
              {formData.deliveryChargeEnabled && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                  <InputField 
                    label="Delivery Charge Amount" 
                    type="number" 
                    value={formData.deliveryChargeAmount} 
                    onChange={v => setFormData({...formData, deliveryChargeAmount: v})} 
                    unit={formData.currency}
                  />
                  <InputField 
                    label="Delivery Charge Label" 
                    value={formData.deliveryChargeLabel} 
                    onChange={v => setFormData({...formData, deliveryChargeLabel: v})} 
                    placeholder="Delivery Fee"
                  />
                  <Toggle 
                    label="Apply Tax on Delivery Charge" 
                    value={formData.deliveryChargeTaxable} 
                    onChange={v => setFormData({...formData, deliveryChargeTaxable: v})}
                  />
                </div>
              )}
            </div>

            {/* Delivery Preview */}
            <div className="bg-bg-surface-2 rounded-2xl p-8 relative overflow-hidden group border border-border-light shadow-sm">
               <Truck className="absolute -bottom-10 -right-10 w-48 h-48 text-text-disabled/20 rotate-12" />
               <div className="relative z-10 space-y-6">
                 <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Logistics Summary</h3>
                 <div className="space-y-5 font-mono text-text-secondary">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="uppercase tracking-widest opacity-60">Subtotal Matrix</span>
                      <span className="font-bold text-text-primary">{formData.currencyPosition === 'before' && formData.currency}25.00{formData.currencyPosition === 'after' && formData.currency}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="uppercase tracking-widest opacity-60">{formData.deliveryChargeLabel || 'Delivery Fee'}</span>
                      <span className={cn("font-bold", formData.deliveryChargeEnabled ? "text-danger" : "text-text-placeholder line-through")}>
                        {formData.currencyPosition === 'before' && formData.currency}
                        {(formData.deliveryChargeEnabled ? (formData.deliveryChargeAmount || 0) : 0).toFixed(2)}
                        {formData.currencyPosition === 'after' && formData.currency}
                      </span>
                    </div>
                    <div className="pt-6 border-t border-border-light flex justify-between items-center">
                      <span className="text-[12px] font-bold uppercase tracking-widest text-text-placeholder">Total Prediction</span>
                      <span className="text-3xl font-extrabold text-text-primary tracking-tighter">
                        {formData.currencyPosition === 'before' && formData.currency}
                        {(25 + (formData.deliveryChargeEnabled ? (formData.deliveryChargeAmount || 0) : 0)).toFixed(2)}
                        {formData.currencyPosition === 'after' && formData.currency}
                      </span>
                    </div>
                 </div>
               </div>
            </div>
          </div>
          <SaveButton sectionId="delivery" label="Save Delivery Settings" onSave={handleSave} isSaved={!!savedStates['delivery']} />
        </section>

        {/* Section 4: RECEIPT CUSTOMIZATION */}
        <section id="receipt" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[3]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <InputField 
                label="Receipt Header Text" 
                value={formData.receiptHeader} 
                onChange={v => setFormData({...formData, receiptHeader: v})} 
                placeholder="Welcome to our restaurant!"
                textarea
              />
              <InputField 
                label="Receipt Footer Text" 
                value={formData.receiptFooter} 
                onChange={v => setFormData({...formData, receiptFooter: v})} 
                placeholder="Thank you for visiting!"
                textarea
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <Toggle label="Show Order Type" value={formData.showOrderTypeOnReceipt} onChange={v => setFormData({...formData, showOrderTypeOnReceipt: v})} />
                <Toggle label="Show Customer Name" value={formData.showCustomerNameOnReceipt} onChange={v => setFormData({...formData, showCustomerNameOnReceipt: v})} />
                <Toggle label="Show Table Number" value={formData.showTableNumberOnReceipt} onChange={v => setFormData({...formData, showTableNumberOnReceipt: v})} />
                <Toggle label="Show Tax Line" value={formData.showTaxLine} onChange={v => setFormData({...formData, showTaxLine: v})} />
                <div className="sm:col-span-2">
                  <Toggle label="Auto-print receipt on completion" value={formData.autoPrintReceipt} onChange={v => setFormData({...formData, autoPrintReceipt: v})} />
                </div>
              </div>
            </div>

            {/* Receipt Mockup */}
            <div className="bg-bg-surface-2 border border-border-light rounded-xl p-8 flex flex-col items-center">
              <div className="w-full max-w-[280px] bg-white shadow-xl shadow-gray-200 p-8 font-mono text-[11px] space-y-5 rounded-sm border-t-8 border-gray-900 border-x border-b border-gray-100">
                <div className="text-center space-y-1.5">
                   <h4 className="font-extrabold text-[13px] uppercase tracking-tighter text-black">{formData.name || 'YOUR RESTAURANT'}</h4>
                   <p className="text-gray-400 break-words leading-tight">{formData.receiptHeader || 'Header Text Placeholder'}</p>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                   <div className="flex justify-between uppercase text-gray-400">
                     <span>#ORD-7329</span>
                     <span>{format(new Date(), 'HH:mm')}</span>
                   </div>
                   {formData.showOrderTypeOnReceipt && <div className="font-extrabold text-center border p-1 border-gray-100 text-black">DINE-IN</div>}
                   {formData.showCustomerNameOnReceipt && <div className="uppercase text-gray-400">Cust: John Doe</div>}
                </div>
                <div className="border-t border-b border-dashed border-gray-200 py-4 space-y-2.5">
                   <div className="flex justify-between text-black font-medium">
                     <span>1x Wagyu Sando</span>
                     <span>$24.00</span>
                   </div>
                   <div className="flex justify-between text-black font-medium">
                     <span>2x Matcha Latte</span>
                     <span>$12.00</span>
                   </div>
                </div>
                <div className="space-y-1.5">
                   <div className="flex justify-between font-bold text-black">
                     <span>SUBTOTAL</span>
                     <span>$36.00</span>
                   </div>
                   {formData.showTaxLine && (
                     <div className="flex justify-between text-gray-400">
                       <span>{formData.taxLabel || 'Tax'} ({formData.taxPercentage}%)</span>
                       <span>$2.88</span>
                     </div>
                   )}
                   <div className="flex justify-between text-[13px] font-extrabold pt-3 border-t border-gray-100 text-black">
                     <span>TOTAL</span>
                     <span>$38.88</span>
                   </div>
                </div>
                <div className="text-center pt-5 text-gray-400 italic leading-relaxed">
                   {formData.receiptFooter || 'Visit us again soon!'}
                </div>
                <div className="flex flex-col items-center gap-1 pt-3">
                  <div className="w-full h-3 bg-slate-100/50 rounded-sm" />
                  <div className="w-3/4 h-2 bg-slate-100/30 rounded-sm" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase text-text-placeholder tracking-[0.2em] mt-8">Simulated Physical Manifest</p>
            </div>
          </div>
          <SaveButton sectionId="receipt" label="Save Receipt Settings" onSave={handleSave} isSaved={!!savedStates['receipt']} />
        </section>

        {/* Section 5: KITCHEN & KOT */}
        <section id="kitchen" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[4]} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
              <Toggle label="Auto-print KOT on send to kitchen" value={formData.autoPrintKOT} onChange={v => setFormData({...formData, autoPrintKOT: v})} />
              <Toggle label="Show Customer Name on KOT" value={formData.showCustomerNameOnKOT} onChange={v => setFormData({...formData, showCustomerNameOnKOT: v})} />
              <Toggle label="Show Order Type on KOT" value={formData.showOrderTypeOnKOT} onChange={v => setFormData({...formData, showOrderTypeOnKOT: v})} />
              <Toggle label="Show Table Number on KOT" value={formData.showTableNumberOnKOT} onChange={v => setFormData({...formData, showTableNumberOnKOT: v})} />
              
              <div className="space-y-2">
                <label className="input-label">KOT Font Size</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-bg-surface-2 border border-border-light rounded-lg">
                  {['normal', 'large', 'extra-large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setFormData({...formData, kotFontSize: size as any})}
                      className={cn(
                        "py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all",
                        formData.kotFontSize === size ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted"
                      )}
                    >
                      {size.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-10 bg-gray-900 rounded-xl text-white relative overflow-hidden group shadow-xl">
               <ChefHat className="absolute -bottom-10 -right-10 w-48 h-48 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity" />
               <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                   <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">Kitchen Matrix Monitor</h3>
                 </div>
                 <div className={cn(
                   "bg-white p-8 font-mono border-t-8 border-accent text-black shadow-inner rounded-sm",
                   formData.kotFontSize === 'large' ? "text-[15px]" : formData.kotFontSize === 'extra-large' ? "text-xl" : "text-[12px]"
                 )}>
                   <div className="flex justify-between border-b border-gray-200 pb-5 mb-5">
                     <span className="font-extrabold uppercase">KOT #42</span>
                     <span className="text-gray-400">{format(new Date(), 'HH:mm:ss')}</span>
                   </div>
                   <div className="space-y-4">
                     <div className="flex items-start gap-4">
                        <span className="font-extrabold bg-black text-white px-2.5 py-0.5 rounded-sm">2</span>
                        <span className="uppercase font-extrabold">Spicy Miso Ramen</span>
                     </div>
                     <div className="flex items-start gap-4">
                        <span className="font-extrabold bg-black text-white px-2.5 py-0.5 rounded-sm">1</span>
                        <span className="uppercase font-extrabold">Truffle Fries</span>
                     </div>
                   </div>
                   <div className="mt-8 pt-5 border-t border-gray-100 space-y-1.5 text-[10px] uppercase font-bold text-gray-400">
                     {formData.showCustomerNameOnKOT && <div>Guest: Alice Smith</div>}
                     {formData.showOrderTypeOnKOT && <div>Mode: Delivery</div>}
                     {formData.showTableNumberOnKOT && <div>Grid: Table 04</div>}
                   </div>
                 </div>
               </div>
            </div>
          </div>
          <SaveButton sectionId="kitchen" label="Save Kitchen Settings" onSave={handleSave} isSaved={!!savedStates['kitchen']} />
        </section>

        {/* Section 6: DATA & BACKUP */}
        <section id="backup" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[5]} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Export Card */}
            <div className="bg-bg-surface-2 border border-border-light rounded-xl p-8 space-y-6 flex flex-col items-center text-center group transition-all hover:bg-bg-surface hover:shadow-md">
              <div className="w-16 h-16 bg-bg-surface border border-border-light rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <CloudDownload className="w-8 h-8 text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-[17px] font-bold text-text-primary tracking-tight uppercase">Export Core</h3>
                <p className="text-[12px] font-medium text-text-muted leading-relaxed uppercase tracking-tight">
                  Download all data as a JSON file. Store it safely as a periodic snapshot.
                </p>
              </div>
              <button 
                onClick={handleExport}
                className="mt-4 btn-primary w-full py-4 text-[11px] tracking-widest shadow-lg"
              >
                <Download className="w-4 h-4 mr-3" />
                Trigger Extraction
              </button>
            </div>

            {/* Import Card */}
            <div className="bg-bg-surface-2 border border-border-light rounded-xl p-8 space-y-6 flex flex-col items-center text-center group transition-all hover:bg-bg-surface hover:shadow-md">
              {!showImportConfirm ? (
                <>
                  <div className="w-16 h-16 bg-bg-surface border border-border-light rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Upload className="w-8 h-8 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[17px] font-bold text-text-primary tracking-tight uppercase">Inject Core</h3>
                    <p className="text-[12px] font-medium text-text-muted leading-relaxed uppercase tracking-tight">
                      Restore data from a previously exported backup file to rebuild matrix.
                    </p>
                  </div>
                  <div className="bg-danger/5 border border-danger/10 rounded-lg p-4 flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-danger font-bold uppercase leading-tight text-left italic tracking-tight">
                      Importing will replace ALL current data. This action is irreversible.
                    </p>
                  </div>
                  <div className="relative w-full mt-4">
                     <input 
                       type="file" 
                       accept=".json" 
                       onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                           setImportFile(file);
                           setShowImportConfirm(true);
                         }
                       }}
                       className="absolute inset-0 opacity-0 cursor-pointer"
                     />
                     <button className="btn-secondary w-full py-4 text-[11px] tracking-widest border-2">
                       Choose Backup File
                     </button>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fade-in py-4">
                   <div className="text-center">
                      <div className="text-[11px] font-bold uppercase text-accent tracking-widest mb-2">File Loaded</div>
                      <div className="text-[15px] font-bold text-text-primary font-mono tracking-tight">{importFile?.name}</div>
                   </div>
                   <div className="flex gap-4 w-full px-4">
                      <button 
                        onClick={() => { setShowImportConfirm(false); setImportFile(null); }}
                        className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-border-light"
                      >
                         Abort
                      </button>
                      <button 
                        onClick={handleImport}
                        className="flex-[2] py-4 bg-danger text-white rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-danger/90 shadow-xl shadow-danger/20"
                      >
                         Confirm & Sync
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 7: ACCOUNT & SECURITY */}
        <section id="account" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 pb-32">
          <SectionHeader {...SECTIONS[6]} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
               <div className="flex items-center gap-6 p-6 bg-bg-surface-2 border border-border-light rounded-xl">
                  <div className="w-16 h-16 bg-text-primary rounded-lg flex items-center justify-center text-xl font-extrabold text-bg-surface shadow-md">
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-text-placeholder">Authorized System User</span>
                    <h3 className="text-[17px] font-extrabold text-text-primary tracking-tight">{user?.email}</h3>
                    <div className="flex gap-2 mt-2">
                       <span className="px-2.5 py-1 rounded-md bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest">Administrator</span>
                       <span className="px-2.5 py-1 rounded-md bg-text-disabled/10 text-text-muted text-[10px] font-bold uppercase tracking-widest font-mono">UID: {user?.uid.substring(0,8)}</span>
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="input-label">Auto-logout Inactivity</label>
                    <div className="grid grid-cols-4 gap-2 p-1 bg-bg-surface-2 border border-border-light rounded-lg">
                      {['1', '4', '8', 'never'].map((timeout) => (
                        <button
                          key={timeout}
                          onClick={() => setFormData({...formData, autoLogoutTimeout: timeout as any})}
                          className={cn(
                            "py-3 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all",
                            formData.autoLogoutTimeout === timeout ? "bg-bg-surface text-text-primary shadow-sm border border-border-light" : "text-text-placeholder hover:text-text-muted"
                          )}
                        >
                          {timeout === 'never' ? 'Off' : `${timeout}H`}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

            <form onSubmit={onPasswordUpdate} className="bg-bg-surface-2 rounded-xl p-8 border border-border-light space-y-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 px-4 py-2 bg-accent/5 rounded-bl-xl border-b border-l border-accent/5 text-[10px] font-bold tracking-widest text-accent/40 uppercase">
                 Manifest Rotation
               </div>
               <InputField 
                 label="New Secure Phrase" 
                 type="password" 
                 value={passwords.new} 
                 onChange={v => setPasswords({...passwords, new: v})} 
                 placeholder="MIN_8_ENTROPY"
               />
               <InputField 
                 label="Confirm Security Manifest" 
                 type="password" 
                 value={passwords.confirm} 
                 onChange={v => setPasswords({...passwords, confirm: v})} 
                 placeholder="REF_CONSISTENCY"
               />
               
               <div className="pt-4 space-y-4">
                 <button 
                  type="submit"
                  disabled={passStatus === 'loading'}
                  className="btn-primary w-full py-4 text-[11px] tracking-widest shadow-lg disabled:opacity-50 pointer-events-auto cursor-pointer relative z-10"
                 >
                   {passStatus === 'loading' ? 'Encrypting...' : 'Update Matrix Key'}
                 </button>
                 {passStatus === 'success' && <div className="text-center text-[10px] font-bold text-success uppercase tracking-widest">Manifest Updated Successfully</div>}
               </div>
            </form>
          </div>

          <div className="mt-12 pt-12 border-t border-border-light flex flex-col items-center gap-6">
             <button 
              onClick={() => {
                if(window.confirm('Terminate local session and disconnect matrix?')) { logout(); }
              }}
              className="px-12 py-5 bg-danger-light text-danger border border-danger-border rounded-xl flex items-center gap-4 transition-all hover:bg-danger hover:text-white group font-bold pointer-events-auto cursor-pointer relative z-10"
             >
                <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                <span className="uppercase text-[12px] tracking-widest">Sign Out of Device</span>
             </button>
             <p className="text-[10px] font-bold text-text-placeholder uppercase tracking-[0.4em] text-center leading-relaxed">
               System Architecture v4.0.1 (Stable)<br/>
               Binary Encrypted Persistent Cache Active
             </p>
          </div>
        </section>

        {/* Section 8: POS LICENSE */}
        <section id="license" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 pb-32">
          <SectionHeader {...SECTIONS[7]} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Status Panel */}
            <div className="space-y-8">
              <div className="p-6 bg-bg-surface-2 border border-border-light rounded-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest leading-none">Subscription Status</span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-text-primary">Validity Level</h3>
                  </div>
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border",
                    !subscription || Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)) <= 0
                      ? "bg-danger/10 text-danger border-danger/20" 
                      : "bg-success/10 text-success border-success/20"
                  )}>
                    {!subscription || Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)) <= 0 ? 'Expired' : 'Active'}
                  </span>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-border-light">
                  <div className={cn(
                    "w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shrink-0 font-bold",
                    !subscription || Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)) <= 0 
                      ? "border-danger/30 text-danger" 
                      : "border-success/30 text-success"
                  )}>
                    <span className="text-2xl font-black leading-none">
                      {subscription ? Math.max(0, Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000))) : 0}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-tight mt-1">Days</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-text-primary uppercase tracking-tight">
                      {!subscription || Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)) <= 0 
                        ? 'Activation Required' 
                        : 'Premium Access Active'}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-1 uppercase tracking-tight leading-relaxed">
                      {!subscription || Math.ceil((subscription.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)) <= 0 
                        ? 'All POS capabilities will expire or restrict. Fill a valid cryptographic voucher key below to restore system lifespans.' 
                        : `Your subscription is valid until ${new Date(subscription.expiryDate).toLocaleDateString()}. Additional valid license keys will stack.`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light flex justify-between items-center group relative">
                  <div>
                    <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Registered POS ID</span>
                    <p className="text-[13px] font-mono font-bold text-text-primary uppercase tracking-tight mt-0.5">{restaurantId}</p>
                  </div>
                  <button
                    onClick={() => handleCopyText(restaurantId, setCopiedId)}
                    className="p-3 bg-bg-surface border border-border-light hover:bg-bg-surface-2 rounded-lg text-text-secondary hover:text-text-primary transition-all shadow-sm active:scale-95 cursor-pointer pointer-events-auto z-10"
                    title="Copy POS ID"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-success animate-scale-up" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Offline Actions & Manual Sync */}
              <div className="p-6 bg-accent/5 border border-accent/10 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[13px] text-accent uppercase tracking-tight">Offline Queue Sync</h4>
                  <p className="text-[10px] text-text-muted mt-1 uppercase tracking-tight">Synchronize offline-generated key activations with servers.</p>
                </div>
                <button
                  onClick={handleManualSyncKey}
                  disabled={isSyncing}
                  className="px-5 py-3 bg-accent text-white hover:bg-accent/90 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:shadow-lg disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer pointer-events-auto z-10"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Cloud'}
                </button>
              </div>
            </div>

            {/* Verification Form */}
            <div className="space-y-8">
              <form onSubmit={handleActivate} className="bg-bg-surface-2 rounded-xl p-8 border border-border-light space-y-6">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-accent animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary">License Voucher Activation</h3>
                </div>

                <div className="space-y-2">
                  <label className="input-label">Cryptographic License Key</label>
                  <textarea
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="Enter license key here..."
                    rows={4}
                    className="input-field py-4 resize-none font-mono text-[11px] pointer-events-auto relative z-10"
                    required
                  />
                </div>

                {activationError && (
                  <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-lg text-[11px] font-bold uppercase tracking-wider text-center animate-fade-in">
                    {activationError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isActivating || !licenseKeyInput.trim()}
                  className="btn-primary w-full py-4 text-[11px] tracking-widest hover:bg-accent/95 shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-50 pointer-events-auto relative z-10"
                >
                  {isActivating ? 'Verifying Cipher...' : 'Activate POS License'}
                </button>
              </form>

              {/* Developer Testing Vouchers */}
              {/* <div className="bg-bg-surface rounded-xl p-6 border-2 border-dashed border-border-light space-y-4">
                <div>
                  <h4 className="font-bold text-[12px] text-text-primary uppercase tracking-tight">Developer Testing Suite</h4>
                  <p className="text-[10px] text-text-muted uppercase tracking-tight">Generate a valid 180-day key for this specific customized POS ID instantly.</p>
                </div>

                {!generatedKey ? (
                  <button
                    onClick={handleGenerateKey}
                    className="w-full py-3 bg-bg-surface-2 hover:bg-border-light border border-border-light text-text-secondary rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer pointer-events-auto z-10"
                  >
                    Manufacture valid test key
                  </button>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    <div className="p-4 bg-bg-surface-2 border border-border-light rounded-lg font-mono text-[10px] select-all break-all whitespace-pre-wrap text-text-secondary shrink-0">
                      {generatedKey}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyText(generatedKey, setCopiedKey)}
                        className="flex-1 py-3 bg-success text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-success/90 transition-all text-center cursor-pointer pointer-events-auto z-10"
                      >
                        {copiedKey ? 'Voucher Copied!' : 'Copy Key'}
                      </button>
                      <button
                        onClick={() => { setGeneratedKey(''); setCopiedKey(false); }}
                        className="px-4 py-3 bg-bg-surface-2 hover:bg-border-light rounded-lg text-[10px] font-black uppercase text-text-placeholder cursor-pointer pointer-events-auto z-10"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div> */}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
