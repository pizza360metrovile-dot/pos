import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Key,
  Keyboard,
  Lock,
  Eye,
  EyeOff,
  Users,
  Trash2
} from 'lucide-react';
import { useStore, showConfirmModal } from '../store/useStore';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { PROTECTION_PASSWORD } from '../constants';
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
  { id: 'cashiers', label: 'Cashiers', icon: Users, description: 'Add staff names who operate this terminal' },
  { id: 'backup', label: 'Data & Backup', icon: Database, description: 'Export your data for safekeeping or import a previous backup to restore' },
  { id: 'account', label: 'Account & Security', icon: Shield, description: 'Manage your login credentials and session security' },
  { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard, description: 'Configure keyboard shortcuts and navigation for the POS interface' },
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
  const navigate = useNavigate();
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
    syncLicenses,
    cloudSync,
    setCloudSync,
    deleteAllAppData,
    cashiers = [],
    addCashier,
    toggleCashierActive,
    deleteCashier
  } = useStore();

  const [newCashierName, setNewCashierName] = useState('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  const calculateDaysRemaining = async () => {
    try {
      const record = await db.table('appMeta').get('_xe');
      if (record && record.value !== undefined) {
        const expiresAt = Number(record.value);
        const now = Date.now();
        const diffMs = expiresAt - now;
        const calcDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        setDaysLeft(calcDaysLeft);
      } else {
        setDaysLeft(0);
      }
    } catch (err) {
      setDaysLeft(0);
    }
  };

  useEffect(() => {
    calculateDaysRemaining();
  }, [subscription?.expiryDate]);

  const currentDaysLeft = daysLeft !== null ? daysLeft : (subscription ? Math.ceil((subscription.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)) : 0);
  
  let badgeText = '';
  let badgeColorClass = '';
  let circleColorClass = '';

  if (currentDaysLeft > 0) {
    badgeText = `${currentDaysLeft} days remaining`;
    if (currentDaysLeft > 30) {
      badgeColorClass = "bg-success/10 text-success border-success/20";
      circleColorClass = "border-success/30 text-success";
    } else if (currentDaysLeft > 10) {
      badgeColorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20";
      circleColorClass = "border-amber-500/30 text-amber-500";
    } else {
      badgeColorClass = "bg-danger/10 text-danger border-danger/20";
      circleColorClass = "border-danger/30 text-danger";
    }
  } else {
    badgeText = "Expired";
    badgeColorClass = "bg-danger/10 text-danger border-danger/20";
    circleColorClass = "border-danger/30 text-danger";
  }

  const [formData, setFormData] = useState(settings);
  const [businessDayCutoff, setBusinessDayCutoff] = useState('04:00');

  useEffect(() => {
    import('../utils/businessDayCalculation').then(({ getCachedCutoff }) => {
      setBusinessDayCutoff(getCachedCutoff());
    });
  }, []);

  const [activeSection, setActiveSection] = useState('profile');
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});

  // Deletion and Backup states
  const [deleteModalStep, setDeleteModalStep] = useState<0 | 1 | 2>(0);
  const [keepMenuItems, setKeepMenuItems] = useState(true);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Password Protection Modal States
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalType, setPasswordModalType] = useState<'delete' | 'sync_disable' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [shakeModal, setShakeModal] = useState(false);

  const handlePasswordModalConfirm = async () => {
    if (passwordInput === PROTECTION_PASSWORD) {
      setPasswordError('');
      setPasswordModalOpen(false);
      setPasswordInput('');
      setShowPassword(false);
      
      if (passwordModalType === 'delete') {
        setDeleteModalStep(1);
        setKeepMenuItems(true);
        setDeleteConfirmInput('');
      } else if (passwordModalType === 'sync_disable') {
        await setCloudSync(false);
      }
      setPasswordModalType(null);
    } else {
      setPasswordError('Incorrect password. Action not allowed.');
      setPasswordInput('');
      setShakeModal(true);
    }
  };

  const handlePasswordModalCancel = () => {
    setPasswordModalOpen(false);
    setPasswordInput('');
    setShowPassword(false);
    setPasswordError('');
    setPasswordModalType(null);
  };

  // Licensing Page States
  const [restaurantId, setRestaurantId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);
  const [requireKOT, setRequireKOT] = useState(true);

  useEffect(() => {
    const loadKb = async () => {
      try {
        const entry = await db.table('appMeta').get('_kb');
        if (entry) {
          setKeyboardShortcutsEnabled(entry.value !== false);
        }
      } catch (err) {
        console.error('Failed to load keyboard settings:', err);
      }
    };
    const loadRequireKOT = async () => {
      try {
        const entry = await db.settings.where({ key: 'requireKOT' }).first();
        if (entry) {
          setRequireKOT(entry.value !== false);
        } else {
          setRequireKOT(true);
        }
      } catch (err) {
        console.error('Failed to load requireKOT setting:', err);
      }
    };
    loadKb();
    loadRequireKOT();
  }, []);

  const handleToggleKeyboardShortcuts = async (value: boolean) => {
    setKeyboardShortcutsEnabled(value);
    try {
      await db.table('appMeta').put({ key: '_kb', value });
      toast.success(value ? 'Keyboard shortcuts enabled' : 'Keyboard shortcuts disabled');
    } catch (err) {
      console.error('Failed to save keyboard settings:', err);
    }
  };

  const handleToggleRequireKOT = async (value: boolean) => {
    setRequireKOT(value);
    try {
      const existing = await db.settings.where({ key: 'requireKOT' }).first();
      if (existing) {
        await db.settings.update(existing.id!, { value });
      } else {
        await db.settings.add({ key: 'requireKOT', value });
      }
      toast.success(value ? 'KOT requirement enabled' : 'KOT requirement disabled');
    } catch (err) {
      console.error('Failed to save requireKOT setting:', err);
      toast.error('Failed to save setting');
    }
  };

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
  const [parsedBackup, setParsedBackup] = useState<any>(null);
  const [restoreStep, setRestoreStep] = useState<0 | 1 | 2>(0);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');

  // Menu Seed Import state
  const [showMenuImportModal, setShowMenuImportModal] = useState(false);
  const [menuImportConfirmInput, setMenuImportConfirmInput] = useState('');
  const [fetchedMenuSeedData, setFetchedMenuSeedData] = useState<any>(null);
  const [isMenuImporting, setIsMenuImporting] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollPosition = container.scrollTop;
      const maxScroll = container.scrollHeight - container.clientHeight;

      // If we are scrolled all the way/almost to the bottom, active section should be the last one
      if (maxScroll > 0 && scrollPosition >= maxScroll - 60) {
        setActiveSection(SECTIONS[SECTIONS.length - 1].id);
        return;
      }

      let active = SECTIONS[0].id;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = SECTIONS[i];
        const el = document.getElementById(section.id);
        if (el) {
          // Adjust threshold margin to account for padding/headers
          if (scrollPosition >= el.offsetTop - 140) {
            active = section.id;
            break;
          }
        }
      }
      setActiveSection(active);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      // Run once initially to set the correct active state based on current scroll
      handleScroll();
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleSave = async (sectionId: string) => {
    if (sectionId === 'profile') {
      const { updateBusinessDayCutoff } = await import('../utils/businessDayCalculation');
      await updateBusinessDayCutoff(businessDayCutoff);
    }
    await updateSettings(formData);
    setSavedStates(prev => ({ ...prev, [sectionId]: true }));
    setTimeout(() => {
      setSavedStates(prev => ({ ...prev, [sectionId]: false }));
    }, 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddCashier = async () => {
    if (!newCashierName.trim()) {
      toast.error('Cashier name cannot be empty');
      return;
    }
    await addCashier(newCashierName);
    setNewCashierName('');
  };

  const handleDeleteCashier = async (cashierId: number, name: string) => {
    const confirmed = await showConfirmModal({
      title: "Remove Cashier",
      message: `Remove ${name}? Past orders will keep their cashier name on record.`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      isDanger: true
    });
    if (confirmed) {
      await deleteCashier(cashierId);
    }
  };

  const handleExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rms-backup-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parsedBackup) return;
    try {
      await importData(parsedBackup);
      
      const backupDate = parsedBackup.exportedAt ? format(new Date(parsedBackup.exportedAt), 'yyyy-MM-dd hh:mm a') : 'Unknown Date';
      toast.success(`Backup restored successfully. App restored to ${backupDate}`);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import data. Please check the file format.');
    }
  };

  const handleFinalDelete = async () => {
    try {
      await deleteAllAppData(keepMenuItems);
      setDeleteModalStep(0);
      setDeleteConfirmInput('');
      if (keepMenuItems) {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMenuImportTrigger = async () => {
    try {
      const response = await fetch('/menuSeed.json');
      if (!response.ok) {
        toast.error('Could not load menu file. Ensure menuSeed.json exists in public/ folder.');
        return;
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        toast.error('Menu file format is invalid.');
        return;
      }
      setFetchedMenuSeedData(data);
      setMenuImportConfirmInput('');
      setShowMenuImportModal(true);
    } catch (err) {
      toast.error('Could not load menu file. Ensure menuSeed.json exists in public/ folder.');
    }
  };

  const executeMenuImport = async () => {
    if (!fetchedMenuSeedData) return;
    setIsMenuImporting(true);
    const { user, cloudSync, syncToFirebase } = useStore.getState();
    const syncActive = !!(user && cloudSync);

    try {
      // Step 1: Query and delete existing from firebase if sync active
      if (syncActive) {
        const oldCats = await db.categories.toArray();
        for (const item of oldCats) {
          await syncToFirebase('categories', item.id, null);
        }
        const oldItems = await db.menuItems.toArray();
        for (const item of oldItems) {
          await syncToFirebase('menuItems', item.id, null);
        }
        const oldGroups = await db.modifierGroups.toArray();
        for (const item of oldGroups) {
          await syncToFirebase('modifierGroups', item.id, null);
        }
        const oldOptions = await db.modifierOptions.toArray();
        for (const item of oldOptions) {
          await syncToFirebase('modifierOptions', item.id, null);
        }
        const oldDeals = await db.dealItems.toArray();
        for (const item of oldDeals) {
          await syncToFirebase('dealItems', item.id, null);
        }
      }

      // Clear existing menu data
      await db.modifierOptions.clear();
      await db.modifierGroups.clear();
      await db.dealItems.clear();
      await db.menuItems.clear();
      await db.categories.clear();
    } catch (err: any) {
      setIsMenuImporting(false);
      toast.error(`Clear failed: ${err.message || err}`);
      return;
    }

    try {
      const categoryIdMap: Record<string, string | number> = {};
      const menuItemIdMap: Record<string, string | number> = {};
      const groupIdMap: Record<string, string | number> = {};

      // Step 2: Insert categories
      if (fetchedMenuSeedData.categories && Array.isArray(fetchedMenuSeedData.categories)) {
        for (const category of fetchedMenuSeedData.categories) {
          const catId = await db.categories.add({
            name: category.name,
            type: category.type
          } as any);
          categoryIdMap[category.seedId] = catId;
          if (syncActive) {
            const inserted = await db.categories.get(catId);
            if (inserted) {
              await syncToFirebase('categories', catId, inserted);
            }
          }
        }
      }

      // Step 3: Insert menu items
      if (fetchedMenuSeedData.menuItems && Array.isArray(fetchedMenuSeedData.menuItems)) {
        for (const item of fetchedMenuSeedData.menuItems) {
          const itemId = await db.menuItems.add({
            name: item.name,
            price: item.price,
            categoryId: categoryIdMap[item.categorySeedId],
            isActive: item.isActive,
            isDeal: item.isDeal,
            directStock: 0,
            description: item.description || '',
            stock: item.stock || 0,
            minStock: item.minStock || 0,
            createdAt: Date.now()
          } as any);
          menuItemIdMap[item.seedId] = itemId;
          if (syncActive) {
            const inserted = await db.menuItems.get(itemId);
            if (inserted) {
              await syncToFirebase('menuItems', itemId, inserted);
            }
          }
        }
      }

      // Step 4: Insert modifier groups
      if (fetchedMenuSeedData.modifierGroups && Array.isArray(fetchedMenuSeedData.modifierGroups)) {
        for (const group of fetchedMenuSeedData.modifierGroups) {
          const groupId = await db.modifierGroups.add({
            menuItemId: menuItemIdMap[group.menuItemSeedId],
            name: group.name,
            type: group.type,
            isRequired: group.isRequired,
            sortOrder: 0
          } as any);
          groupIdMap[group.seedId] = groupId;
          if (syncActive) {
            const inserted = await db.modifierGroups.get(groupId);
            if (inserted) {
              await syncToFirebase('modifierGroups', groupId, inserted);
            }
          }
        }
      }

      // Step 5: Insert modifier options
      if (fetchedMenuSeedData.modifierOptions && Array.isArray(fetchedMenuSeedData.modifierOptions)) {
        for (const option of fetchedMenuSeedData.modifierOptions) {
          const optId = await db.modifierOptions.add({
            groupId: groupIdMap[option.groupSeedId],
            label: option.label,
            additionalPrice: option.additionalPrice,
            sortOrder: 0
          } as any);
          if (syncActive) {
            const inserted = await db.modifierOptions.get(optId);
            if (inserted) {
              await syncToFirebase('modifierOptions', optId, inserted);
            }
          }
        }
      }

      // Step 6: Insert deals
      if (fetchedMenuSeedData.deals && Array.isArray(fetchedMenuSeedData.deals)) {
        for (const deal of fetchedMenuSeedData.deals) {
          const dealItemId = await db.menuItems.add({
            name: deal.name,
            price: deal.price,
            categoryId: categoryIdMap[deal.categorySeedId],
            isActive: deal.isActive,
            isDeal: true,
            directStock: 0,
            description: deal.description || '',
            stock: deal.stock || 0,
            minStock: deal.minStock || 0,
            createdAt: Date.now()
          } as any);
          if (syncActive) {
            const inserted = await db.menuItems.get(dealItemId);
            if (inserted) {
              await syncToFirebase('menuItems', dealItemId, inserted);
            }
          }
          if (deal.components && Array.isArray(deal.components)) {
            for (const component of deal.components) {
              const compIdStr = menuItemIdMap[component.componentSeedId].toString();
              const dealItemIdVal = await db.dealItems.add({
                dealMenuItemId: dealItemId.toString(),
                componentMenuItemId: compIdStr,
                quantity: component.quantity,
                sortOrder: 0
              });
              if (syncActive) {
                const inserted = await db.dealItems.get(dealItemIdVal);
                if (inserted) {
                  await syncToFirebase('dealItems', dealItemIdVal, inserted);
                }
              }
            }
          }
        }
      }

      // Step 7: Hydrate Zustand Store
      const freshCategories = await db.categories.toArray();
      const freshMenuItems = await db.menuItems.toArray();
      const freshModifierGroups = await db.modifierGroups.toArray();
      const freshModifierOptions = await db.modifierOptions.toArray();
      const freshDealItems = await db.dealItems.toArray();

      useStore.setState({
        categories: freshCategories,
        menuItems: freshMenuItems,
        modifierGroups: freshModifierGroups,
        modifierOptions: freshModifierOptions,
        dealItems: freshDealItems
      });

      // Step 8: Success State
      toast.success('Menu imported successfully from seed file');
      setShowMenuImportModal(false);
    } catch (err: any) {
      // Rollback logic: Clear database state entirely of menu categories and items so we don't leave partial state
      try {
        await db.modifierOptions.clear();
        await db.modifierGroups.clear();
        await db.dealItems.clear();
        await db.menuItems.clear();
        await db.categories.clear();

        useStore.setState({
          categories: [],
          menuItems: [],
          modifierGroups: [],
          modifierOptions: [],
          dealItems: []
        });
      } catch (rollbackErr) {
        console.error('Critical rollback failure:', rollbackErr);
      }
      toast.error(`Import failed: ${err.message || err}`);
    } finally {
      setIsMenuImporting(false);
    }
  };

  const onPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters');
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
            <div className="md:col-span-2 border-t border-border-light/50 pt-6 mt-2 space-y-4">
              <div className="max-w-md">
                <InputField 
                  label="Business Day Cutoff" 
                  type="time"
                  value={businessDayCutoff} 
                  onChange={v => setBusinessDayCutoff(v)} 
                />
                <p className="text-[11px] text-text-muted leading-relaxed mt-2">
                  Time when the business day resets. Orders after this time are counted as the next day.
                </p>
                <div className="mt-3 space-y-1 bg-bg-surface-2 p-3 rounded-lg border border-border-light text-[11px] text-text-secondary">
                  <div className="font-semibold text-text-primary uppercase tracking-wider text-[9px] mb-1">Examples:</div>
                  <p><strong>04:00</strong> for shops open till early morning (Default)</p>
                  <p><strong>00:00</strong> for standard midnight cutoff</p>
                  <p><strong>23:00</strong> for late-night venues</p>
                </div>
              </div>
            </div>

            {/* Restaurant Logo configuration */}
            <div className="md:col-span-2 border-t border-border-light/50 pt-8 mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-text-primary">Restaurant Logo</h3>
                <p className="text-[11px] text-text-muted mt-1">
                  Upload your logo to display on printed customer receipts. Max size: 1MB. Recommended format: PNG, WEBP, or JPG.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  {/* Logo Preview box */}
                  <div className="border border-border-light bg-bg-surface-2 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] text-center relative overflow-hidden group">
                    {formData.logoDataURL ? (
                      <div className="space-y-3 flex flex-col items-center">
                        <img 
                          src={formData.logoDataURL} 
                          alt="Restaurant Logo Preview" 
                          className="object-contain max-w-[150px] bg-white p-2 rounded-lg border border-border-light shadow-xs"
                          style={{ height: `${formData.logoHeightReceipt || 20}mm` }}
                        />
                        <div className="text-[10px] text-text-secondary font-mono">
                          Size: {Math.round((formData.logoDataURL.length * 3 / 4) / 1024)} KB
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, logoDataURL: '' }));
                            toast.success('Logo removed');
                          }}
                          className="flex items-center gap-1 text-[10px] text-danger font-bold uppercase tracking-wider bg-danger/10 hover:bg-danger/25 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Logo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 py-4">
                        <Upload className="w-8 h-8 text-text-placeholder mx-auto" />
                        <span className="text-[11px] text-text-placeholder font-bold uppercase tracking-widest block font-sans">No logo uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* File selector input */}
                  <div className="flex items-center gap-3">
                    <label className="flex-1 bg-bg-surface border border-dashed border-border-light hover:border-accent rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-accent font-sans">
                        <Upload className="w-4 h-4" />
                        Upload Logo File
                      </div>
                      <span className="text-[10px] text-text-placeholder mt-1 font-medium font-sans">JPEG, PNG, WEBP, or SVG</span>
                      <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
                          if (!validTypes.includes(file.type)) {
                            toast.error('Unsupported file format. Please upload JPG, PNG, WEBP, or SVG.');
                            return;
                          }

                          if (file.size > 4 * 1024 * 1024) {
                            toast.error('File too large (Max 4MB original size before upload).');
                            return;
                          }

                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const originalBase64 = event.target?.result as string;

                            if (file.type === 'image/svg+xml') {
                              if (originalBase64.length > 400 * 1024) {
                                toast.error('Logo file too large. Maximum 400KB recommended.');
                                return;
                              }
                              setFormData(prev => ({
                                ...prev,
                                logoDataURL: originalBase64
                              }));
                              toast.success('Logo uploaded');
                              return;
                            }

                            const img = new Image();
                            img.onload = () => {
                              if (img.width < 100) {
                                toast.error('Logo width must be at least 100px.');
                                return;
                              }
                              const ratio = img.width / img.height;
                              if (ratio < 0.15 || ratio > 6.0) {
                                toast.error('Extreme aspect ratio. Please use a reasonable logo aspect ratio.');
                                return;
                              }

                              const maxWidth = 500;
                              if (img.width > maxWidth || file.size > 200 * 1024) {
                                const scale = Math.min(1, maxWidth / img.width);
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  canvas.width = img.width * scale;
                                  canvas.height = img.height * scale;
                                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                  const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

                                  if (compressedBase64.length > 410 * 1024) { // 400KB limit
                                    toast.error('Logo file too large after compression. Maximum 400KB recommended.');
                                    return;
                                  }

                                  setFormData(prev => ({
                                    ...prev,
                                    logoDataURL: compressedBase64
                                  }));
                                  toast.success('Logo uploaded and compressed');
                                } else {
                                  if (originalBase64.length > 410 * 1024) {
                                    toast.error('Logo file too large. Maximum 400KB recommended.');
                                    return;
                                  }
                                  setFormData(prev => ({
                                    ...prev,
                                    logoDataURL: originalBase64
                                  }));
                                  toast.success('Logo uploaded');
                                }
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  logoDataURL: originalBase64
                                }));
                                toast.success('Logo uploaded');
                              }
                            };
                            img.onerror = () => {
                              toast.error('Failed to load image file.');
                            };
                            img.src = originalBase64;
                          };
                          reader.onerror = () => {
                            toast.error('Failed to read file.');
                          };
                          reader.readAsDataURL(file);
                        }} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Sizing Sliders block */}
                <div className="space-y-6 bg-bg-surface-2 p-6 rounded-xl border border-border-light">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-text-primary font-sans">Logo Sizing</h4>
                    <p className="text-[10px] text-text-muted mt-1 leading-relaxed font-sans">
                      Adjust printed logo heights separately for KOT tickets and Customer Bills.
                    </p>
                  </div>

                  {/* SLIDER 1 — KOT Logo Height */}
                  <div className="space-y-4 pt-4 border-t border-border-light/40">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary font-sans">Logo Height on KOT Slip</span>
                      <span className="text-xs font-mono font-extrabold text-accent">{formData.logoHeightKOT || 15} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-text-placeholder font-sans">8mm</span>
                      <input 
                        type="range" 
                        min="8" 
                        max="30" 
                        value={formData.logoHeightKOT || 15}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 15);
                          setFormData(prev => ({ ...prev, logoHeightKOT: val }));
                        }}
                        className="flex-1 accent-accent h-1.5 bg-border-light rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-text-placeholder font-sans">30mm</span>
                    </div>

                    {/* KOT Preview */}
                    <div className="p-3 bg-bg-surface border border-border-light rounded-lg">
                      <div className="text-[9px] font-bold text-text-placeholder uppercase tracking-wider mb-2 font-mono">KOT Preview</div>
                      <div className="flex gap-4 items-center">
                        <div className="border border-dashed border-border-light rounded p-2 flex items-center justify-center bg-white" style={{ height: '40px', width: '80px' }}>
                          {formData.logoDataURL ? (
                            <img 
                              src={formData.logoDataURL} 
                              alt="KOT scale" 
                              className="object-contain" 
                              style={{ height: `${(formData.logoHeightKOT || 15) / 2.5}px`, transition: 'height 150ms ease-in-out' }}
                            />
                          ) : (
                            <span className="text-[8px] text-text-placeholder uppercase tracking-widest font-bold font-sans">No logo</span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted leading-tight font-sans">
                          This is how it will look on KOT.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SLIDER 2 — Receipt Logo Height */}
                  <div className="space-y-4 pt-4 border-t border-border-light/40">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary font-sans">Logo Height on Receipt/Bill</span>
                      <span className="text-xs font-mono font-extrabold text-accent">{formData.logoHeightReceipt || 20} mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-text-placeholder font-sans">10mm</span>
                      <input 
                        type="range" 
                        min="10" 
                        max="40" 
                        value={formData.logoHeightReceipt || 20}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setFormData(prev => ({ ...prev, logoHeightReceipt: val }));
                        }}
                        className="flex-1 accent-accent h-1.5 bg-border-light rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-text-placeholder font-sans">40mm</span>
                    </div>

                    {/* Receipt Preview */}
                    <div className="p-3 bg-bg-surface border border-border-light rounded-lg">
                      <div className="text-[9px] font-bold text-text-placeholder uppercase tracking-wider mb-2 font-mono">Receipt Preview</div>
                      <div className="flex gap-4 items-center">
                        <div className="border border-dashed border-border-light rounded p-2 flex items-center justify-center bg-white" style={{ height: '50px', width: '80px' }}>
                          {formData.logoDataURL ? (
                            <img 
                              src={formData.logoDataURL} 
                              alt="Receipt scale" 
                              className="object-contain" 
                              style={{ height: `${(formData.logoHeightReceipt || 20) / 2.5}px`, transition: 'height 150ms ease-in-out' }}
                            />
                          ) : (
                            <span className="text-[8px] text-text-placeholder uppercase tracking-widest font-bold font-sans">No logo</span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted leading-tight font-sans">
                          This is how it will look on Bill.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  <div className="space-y-1">
                    <InputField 
                      label="Default Delivery Charge" 
                      type="number" 
                      value={formData.deliveryChargeAmount} 
                      onChange={v => setFormData({...formData, deliveryChargeAmount: v})} 
                      unit={formData.currency}
                    />
                    <p className="text-[11px] text-text-secondary opacity-80 pl-1">
                      This is the default value. You can change it per order in POS.
                    </p>
                  </div>
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
                      <span className="uppercase tracking-widest opacity-60">Default Delivery Charge</span>
                      <span className={cn("font-bold", formData.deliveryChargeEnabled ? "text-text-primary" : "text-text-placeholder line-through")}>
                        {formData.currencyPosition === 'before' && formData.currency}
                        {(formData.deliveryChargeEnabled ? (formData.deliveryChargeAmount || 0) : 0).toFixed(2)}
                        {formData.currencyPosition === 'after' && formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="uppercase tracking-widest opacity-60">Tax on Delivery</span>
                      <span className="font-bold text-text-primary">
                        {formData.deliveryChargeEnabled && formData.deliveryChargeTaxable ? (
                          <>
                            {formData.currencyPosition === 'before' && formData.currency}
                            {((formData.deliveryChargeAmount || 0) * (formData.taxPercentage || 0) / 100).toFixed(2)}
                            {formData.currencyPosition === 'after' && formData.currency}
                          </>
                        ) : (
                          "None"
                        )}
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
                     <span>{format(new Date(), 'hh:mm a')}</span>
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
              <div className="space-y-2">
                <Toggle 
                  label="Require KOT before completing order" 
                  value={requireKOT} 
                  onChange={handleToggleRequireKOT} 
                />
                <p className="text-[10px] text-text-placeholder font-bold uppercase leading-relaxed tracking-tight px-2">
                  When enabled, Kitchen button must be pressed first. Order moves to In-Progress before it can be completed or billed. When disabled, operator can complete or print bill directly.
                </p>
              </div>
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
                     <span className="text-gray-400">{format(new Date(), 'hh:mm:ss a')}</span>
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

        {/* Section: CASHIERS */}
        <section id="cashiers" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 transition-all hover:shadow-md relative z-20 pointer-events-auto">
          <SectionHeader {...SECTIONS[5]} />
          <div className="space-y-8">
            {/* Add Cashier Inline Form */}
            <div className="bg-bg-surface-2 p-6 rounded-lg border border-border-light">
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-secondary mb-4">Add New Operator</h3>
              <div className="flex gap-4 max-w-lg">
                <input
                  type="text"
                  value={newCashierName}
                  onChange={(e) => setNewCashierName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="flex-1 px-4 py-3 bg-bg-surface border border-border-light rounded-lg text-[13px] font-bold text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleAddCashier}
                  className="btn-primary px-6 py-3 text-[11px] font-bold uppercase tracking-widest cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Cashiers list */}
            <div className="space-y-4">
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-secondary">Current Operators</h3>
              {cashiers.length === 0 ? (
                <div className="text-[12px] font-medium text-text-placeholder uppercase tracking-wider py-4 italic">No cashiers configured. Add an operator to get started.</div>
              ) : (
                <div className="border border-border-light rounded-lg overflow-hidden divide-y divide-border-light">
                  {cashiers.map((cashier) => (
                    <div key={cashier.id} className="flex items-center justify-between p-4 bg-bg-surface-2 transition-all hover:bg-bg-surface">
                      <div className="flex items-center gap-3">
                        <Users className={cn("w-4 h-4", cashier.isActive ? "text-accent" : "text-text-placeholder")} />
                        <span className={cn("text-[13px] font-bold uppercase tracking-tight", cashier.isActive ? "text-text-primary" : "text-text-placeholder line-through")}>
                          {cashier.name}
                        </span>
                        {!cashier.isActive && (
                          <span className="text-[9px] font-extrabold uppercase tracking-widest bg-border-light text-text-placeholder px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Toggle Active Switch */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-placeholder">Active</span>
                          <button
                            onClick={() => toggleCashierActive(cashier.id!)}
                            className={cn(
                              "w-10 h-6 rounded-full p-1 transition-all flex items-center cursor-pointer",
                              cashier.isActive ? "bg-accent justify-end" : "bg-border-light justify-start"
                            )}
                          >
                            <span className={cn("w-4 h-4 bg-white rounded-full shadow-md transition-all", cashier.isActive ? "translate-x-4" : "translate-x-0")} />
                          </button>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteCashier(cashier.id!, cashier.name)}
                          className="p-2 text-text-placeholder hover:text-danger rounded-lg transition-colors cursor-pointer"
                          title="Remove Cashier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 6: DATA & BACKUP */}
        <section id="backup" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8">
          <SectionHeader {...SECTIONS[6]} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                           const reader = new FileReader();
                           reader.onload = (event) => {
                             try {
                               const content = event.target?.result as string;
                               const parsed = JSON.parse(content);
                               
                               if (!parsed || typeof parsed !== 'object') {
                                 toast.error('Invalid backup file');
                                 return;
                               }
                               if (!parsed.data || typeof parsed.data !== 'object') {
                                 toast.error('Corrupted backup file');
                                 return;
                               }
                               
                               setImportFile(file);
                               setParsedBackup(parsed);
                               setRestoreStep(1);
                               setShowImportConfirm(true);
                             } catch (parseErr) {
                               toast.error('Invalid backup file');
                             }
                           };
                           reader.readAsText(file);
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
                <div className="h-full flex flex-col items-center justify-center space-y-6 animate-fade-in py-4 w-full">
                  {restoreStep === 1 ? (
                    <>
                      <div className="text-center space-y-2">
                        <div className="text-[11px] font-bold uppercase text-accent tracking-widest">Backup Verified</div>
                        <div className="text-[15px] font-bold text-text-primary font-mono tracking-tight">{importFile?.name}</div>
                        <div className="text-[12px] text-text-muted mt-2 font-medium tracking-tight">
                          Backup created: <span className="font-bold text-text-primary">{parsedBackup?.exportedAt ? format(new Date(parsedBackup.exportedAt), 'yyyy-MM-dd hh:mm a') : 'Unknown Date'}</span>
                        </div>
                        <p className="text-[11px] text-danger font-bold uppercase tracking-tight leading-normal max-w-xs mx-auto mt-4">
                          This will replace ALL current app data with data from this backup file.
                        </p>
                      </div>
                      <div className="flex gap-4 w-full px-4 mt-4">
                        <button 
                          onClick={() => { 
                            setShowImportConfirm(false); 
                            setImportFile(null); 
                            setParsedBackup(null);
                            setRestoreStep(0);
                            setRestoreConfirmInput('');
                          }}
                          className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-border-light"
                        >
                          Abort
                        </button>
                        <button 
                          onClick={() => setRestoreStep(2)}
                          className="flex-[2] py-4 bg-danger text-white rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-danger/90 shadow-xl shadow-danger/20"
                        >
                          Restore This Backup
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center space-y-4 w-full px-4">
                        <div className="text-[11px] font-bold uppercase text-danger tracking-widest leading-loose">
                          Type "RESTORE" to confirm
                        </div>
                        <input
                          type="text"
                          value={restoreConfirmInput}
                          onChange={(e) => setRestoreConfirmInput(e.target.value)}
                          placeholder='Type "RESTORE"'
                          className="w-full text-center tracking-widest font-black uppercase p-3 bg-bg-surface border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-danger"
                        />
                      </div>
                      <div className="flex gap-4 w-full px-4 mt-6">
                        <button 
                          onClick={() => {
                            setRestoreStep(1);
                            setRestoreConfirmInput('');
                          }}
                          className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-border-light"
                        >
                          Back
                        </button>
                        <button 
                          disabled={restoreConfirmInput !== 'RESTORE'}
                          onClick={handleImport}
                          className="flex-[2] py-4 bg-danger text-white rounded-lg font-bold uppercase text-[11px] tracking-widest hover:bg-danger/90 shadow-xl shadow-danger/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Confirm Restore
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Menu Import Card */}
            <div className="bg-bg-surface-2 border border-border-light rounded-xl p-8 space-y-6 flex flex-col items-center text-center group transition-all hover:bg-bg-surface hover:shadow-md">
              <div className="w-16 h-16 bg-bg-surface border border-border-light rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Database className="w-8 h-8 text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-[17px] font-bold text-text-primary tracking-tight uppercase">Menu Import</h3>
                <p className="text-[12px] font-medium text-text-muted leading-relaxed uppercase tracking-tight">
                  Load menu items, categories and modifiers from the menu seed file. Existing menu data will be replaced.
                </p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-500 font-bold uppercase leading-tight text-left italic tracking-tight">
                  This will replace all existing categories, menu items and modifiers. Orders and records will not be affected.
                </p>
              </div>
              <button 
                onClick={handleMenuImportTrigger}
                className="mt-4 btn-primary w-full py-4 text-[11px] tracking-widest shadow-lg"
              >
                Import Menu from menuSeed.json
              </button>
            </div>
          </div>

          {/* Cloud Sync & Delete All App Data */}
          <div className="mt-10 pt-10 border-t border-border-light space-y-8 animate-fade-in">
             {/* Cloud Sync Toggle */}
             <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-bg-surface-2 rounded-xl border border-border-light gap-4 transition-all hover:bg-bg-surface hover:shadow-md">
               <div className="space-y-1">
                 <div className="flex items-center gap-3">
                   <h4 className="text-[14px] font-bold text-text-primary uppercase tracking-tight">Cloud Sync</h4>
                   <span className={cn(
                     "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                     cloudSync ? "bg-success/10 text-success" : "bg-text-disabled/15 text-text-muted"
                   )}>
                     {cloudSync ? 'Sync Enabled' : 'Sync Disabled'}
                   </span>
                 </div>
                 <p className="text-[12px] font-medium text-text-muted leading-relaxed uppercase tracking-tight text-left">
                   When disabled, app works fully offline and does not connect to Cloud
                 </p>
               </div>
               <button
                 onClick={() => {
                   if (cloudSync) {
                     setPasswordModalType('sync_disable');
                     setPasswordModalOpen(true);
                   } else {
                     setCloudSync(true);
                   }
                 }}
                 className={cn(
                   "w-12 h-6 rounded-full transition-all relative flex items-center p-1 cursor-pointer shrink-0",
                   cloudSync ? "bg-accent" : "bg-text-disabled"
                 )}
               >
                 <div className={cn(
                   "w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                   cloudSync ? "translate-x-6" : "translate-x-0"
                 )} />
               </button>
             </div>

             {/* Delete All App Data */}
             <div className="p-6 bg-danger/5 rounded-xl border border-danger/10 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between transition-all hover:bg-danger/[0.08]">
               <div className="space-y-1 text-left">
                 <h4 className="text-[14px] font-bold text-danger uppercase tracking-tight">Delete All App Data</h4>
                 <p className="text-[12px] font-medium text-text-muted leading-relaxed uppercase tracking-tight">
                   Permanently deletes all orders, records, inventory and settings. Cannot be undone.
                 </p>
               </div>
               <button
                 onClick={() => {
                   setPasswordModalType('delete');
                   setPasswordModalOpen(true);
                 }}
                 className="btn-danger w-full md:w-auto px-6 py-3.5 text-[11px] tracking-widest shadow-lg shadow-danger/10 shrink-0 font-bold uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto"
               >
                 Delete All App Data
               </button>
             </div>
          </div>

          {/* Delete Data Modal Step 1 */}
          {deleteModalStep === 1 && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-lg bg-bg-surface border border-border-light rounded-2xl shadow-2xl p-8 space-y-6 animate-scale-in">
                <div className="space-y-2 text-left">
                  <h3 className="text-[17px] font-extrabold text-text-primary uppercase tracking-tight leading-none text-left">Delete App Data</h3>
                  <p className="text-text-muted text-[13px] font-medium text-left">Configure deletion scope and settings</p>
                </div>

                {/* Warning Banner */}
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-5 flex items-start gap-4">
                  <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-[12px] font-bold text-danger uppercase tracking-wide leading-snug">
                      This will permanently delete all app data. This cannot be undone.
                    </p>
                  </div>
                </div>

                {/* Scope Checkbox Card */}
                <label className="flex items-start gap-4 p-5 bg-bg-surface-2 border border-border-light rounded-xl hover:bg-bg-surface transition-colors cursor-pointer group text-left">
                  <input
                    type="checkbox"
                    checked={keepMenuItems}
                    onChange={(e) => setKeepMenuItems(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-border-light text-accent focus:ring-accent accent-accent shrink-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <span className="text-[12px] font-black text-text-primary uppercase tracking-tight select-none">
                      Keep menu items and categories
                    </span>
                    <p className="text-[11px] font-medium text-text-muted leading-relaxed uppercase tracking-tight select-none">
                      Your food items and categories will be preserved so you don't need to re-enter them
                    </p>
                  </div>
                </label>

                {/* Footer Actions */}
                <div className="flex gap-4 pt-4 border-t border-border-light">
                  <button
                    onClick={() => setDeleteModalStep(0)}
                    className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-border-light transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteModalStep(2)}
                    className="flex-1 py-4 bg-accent text-white rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-accent/90 shadow-lg shadow-accent/20 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Data Modal Step 2 */}
          {deleteModalStep === 2 && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-lg bg-bg-surface border border-border-light rounded-2xl shadow-2xl p-8 space-y-6 animate-scale-in">
                <div className="space-y-2 text-left">
                  <h3 className="text-[17px] font-extrabold text-text-primary uppercase tracking-tight leading-none text-left">Are you absolutely sure?</h3>
                  <p className="text-text-muted text-[13px] font-medium leading-relaxed text-left">
                    This is the final checkpoint. Proceeding will wipe out database records.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="input-label text-danger font-black">Type DELETE to confirm</label>
                    <input
                      type="text"
                      value={deleteConfirmInput}
                      onChange={(e) => setDeleteConfirmInput(e.target.value)}
                      placeholder="DELETE"
                      className="w-full p-4 rounded-xl bg-bg-surface-2 border border-border-light text-text-primary font-bold placeholder-text-placeholder tracking-widest focus:border-accent uppercase text-center focus:ring-1 focus:ring-accent focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 border-t border-border-light">
                  <button
                    onClick={() => setDeleteModalStep(1)}
                    className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-border-light transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalDelete}
                    disabled={deleteConfirmInput !== 'DELETE'}
                    className={cn(
                      "flex-1 py-4 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest transition-all",
                      deleteConfirmInput === 'DELETE'
                        ? "bg-danger hover:bg-danger/90 shadow-lg shadow-danger/20 cursor-pointer"
                        : "bg-text-disabled cursor-not-allowed opacity-50"
                    )}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Menu Import Confirmation Modal */}
          {showMenuImportModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-lg bg-bg-surface border border-border-light rounded-2xl shadow-2xl p-8 space-y-6 animate-scale-in">
                <div className="space-y-2 text-left">
                  <h3 className="text-[17px] font-extrabold text-text-primary uppercase tracking-tight leading-none text-left">Import Menu from File?</h3>
                  <p className="text-text-muted text-[13px] font-medium leading-relaxed text-left">
                    All existing menu items, categories, modifiers and deals will be replaced.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex items-start gap-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-[12px] font-bold text-amber-500 uppercase tracking-wide leading-snug">
                      This action will wipe and replace existing categories, menu items, modifier groups, options and deals. Orders and records are safe.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="input-label text-amber-500 font-black font-mono">Type IMPORT to confirm</label>
                    <input
                      type="text"
                      value={menuImportConfirmInput}
                      onChange={(e) => setMenuImportConfirmInput(e.target.value)}
                      placeholder='Type "IMPORT"'
                      disabled={isMenuImporting}
                      className="w-full p-4 rounded-xl bg-bg-surface-2 border border-border-light text-text-primary font-bold placeholder-text-placeholder tracking-widest focus:border-accent uppercase text-center focus:ring-1 focus:ring-accent focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 border-t border-border-light">
                  <button
                    onClick={() => {
                      if (!isMenuImporting) {
                        setShowMenuImportModal(false);
                        setMenuImportConfirmInput('');
                      }
                    }}
                    disabled={isMenuImporting}
                    className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-border-light transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeMenuImport}
                    disabled={menuImportConfirmInput !== 'IMPORT' || isMenuImporting}
                    className={cn(
                      "flex-[2] py-4 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest transition-all relative flex justify-center items-center gap-2",
                      (menuImportConfirmInput === 'IMPORT' && !isMenuImporting)
                        ? "bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 cursor-pointer"
                        : "bg-text-disabled cursor-not-allowed opacity-50"
                    )}
                  >
                    {isMenuImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Confirm Import'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 7: ACCOUNT & SECURITY */}
        <section id="account" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 pb-32">
          <SectionHeader {...SECTIONS[7]} />
          
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
              onClick={async () => {
                const confirmed = await showConfirmModal({
                  title: 'Terminate Session',
                  message: 'Terminate local session and disconnect matrix?',
                  confirmLabel: 'Sign Out',
                  cancelLabel: 'Cancel',
                  isDanger: true
                });
                if (confirmed) { logout(); }
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

        {/* Section 8: KEYBOARD SHORTCUTS */}
        <section id="keyboard" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 pb-12">
          <SectionHeader {...SECTIONS[8]} />
          
          <div className="space-y-6">
            <Toggle 
              value={keyboardShortcutsEnabled} 
              onChange={handleToggleKeyboardShortcuts} 
              label="Enable Keyboard Shortcuts" 
            />

            <div className="bg-bg-surface-2 border border-border-light rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-border-light pb-4">
                <Keyboard className="w-5 h-5 text-accent animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary">Keyboard Shortcut Reference</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[12px]">
                <div>
                  <h4 className="font-extrabold uppercase tracking-widest text-[10px] text-accent mb-4">Navigation</h4>
                  <table className="w-full text-left">
                    <tbody>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">Arrow Keys</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Move focus pointer</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">Enter</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Select focused item</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">Escape</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Close modal or panel</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">Tab</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Next field in modal</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="font-extrabold uppercase tracking-widest text-[10px] text-accent mb-4">Categories</h4>
                  <table className="w-full text-left">
                    <tbody>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">A - Z</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Jump / cycle category</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 className="font-extrabold uppercase tracking-widest text-[10px] text-accent mt-6 mb-4">POS Actions</h4>
                  <table className="w-full text-left font-sans">
                    <tbody>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">, or &lt;</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Send to Kitchen (KOT)</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">. or &gt;</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Print Bill</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">/ or ?</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Complete Order</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">; or :</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Open In-Progress panel</td>
                      </tr>
                      <tr className="border-b border-border-light/40 py-2.5 flex justify-between items-center h-10">
                        <td className="font-bold text-text-secondary uppercase">' or "</td>
                        <td className="font-mono bg-bg-surface border border-border-light px-2 py-0.5 rounded text-text-primary text-[11px] font-black">Open Held Orders panel</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: POS LICENSE */}
        <section id="license" className="bg-bg-surface rounded-xl border border-border-light p-8 md:p-12 shadow-sm scroll-mt-8 pb-32">
          <SectionHeader {...SECTIONS[9]} />
          
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
                    badgeColorClass
                  )}>
                    {badgeText}
                  </span>
                </div>

                <div className="flex items-center gap-6 pt-4 border-t border-border-light">
                  <div className={cn(
                    "w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shrink-0 font-bold",
                    circleColorClass
                  )}>
                    <span className="text-2xl font-black leading-none">
                      {Math.max(0, currentDaysLeft)}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-tight mt-1">Days</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-text-primary uppercase tracking-tight">
                      {currentDaysLeft <= 0 
                        ? 'Activation Required' 
                        : 'Premium Access Active'}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-1 uppercase tracking-tight leading-relaxed">
                      {currentDaysLeft <= 0 
                        ? 'All POS capabilities will expire or restrict. Fill a valid cryptographic voucher key below to restore system lifespans.' 
                        : `Your subscription is valid until ${new Date(subscription ? subscription.expiryDate : 0).toLocaleDateString()}. Additional valid license keys will stack.`}
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

          {/* Password Protection Modal */}
          {passwordModalOpen && (
            <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
              <motion.div
                animate={shakeModal ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                onAnimationComplete={() => setShakeModal(false)}
                className="w-full max-w-md bg-bg-surface border border-border-light rounded-2xl shadow-2xl p-8 space-y-6"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-danger/10 rounded-full">
                    <Lock className="w-8 h-8 text-danger" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[17px] font-extrabold text-text-primary uppercase tracking-tight leading-none">Protected Action</h3>
                    <p className="text-text-muted text-[13px] font-medium leading-relaxed">
                      {passwordModalType === 'delete' 
                        ? 'Enter password to delete all app data' 
                        : 'Enter password to disable cloud sync'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      autoFocus
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePasswordModalConfirm();
                        }
                      }}
                      placeholder="Enter password"
                      className="w-full p-4 pr-12 rounded-xl bg-bg-surface-2 border border-border-light text-text-primary font-bold placeholder-text-placeholder focus:border-accent focus:ring-1 focus:ring-accent focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-primary transition-colors focus:outline-hidden"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {passwordError && (
                    <p className="text-danger-light text-xs font-bold uppercase tracking-tight text-center px-1">
                      {passwordError}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-4 pt-4 border-t border-border-light">
                  <button
                    onClick={handlePasswordModalCancel}
                    className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-border-light transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordModalConfirm}
                    className="flex-1 py-4 bg-danger text-white rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-danger/90 shadow-lg shadow-danger/20 transition-all cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
