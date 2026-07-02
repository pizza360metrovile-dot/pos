/**
 * Tab Visibility Configuration
 * 
 * Change boolean values to enable/disable tabs.
 * Disabled tabs are hidden from navigation and not loaded.
 * Changes require app rebuild to take effect.
 * 
 * This is local per device — no Firebase sync.
 */

export const TAB_VISIBILITY = {
  // Point of Sale — Main POS operations
  pos: false,

  // Menu Management — Manage items and categories
  menu: false,
  
  // Records & Reports — View completed orders
  records: true,
  
  // Performance Analytics — Revenue charts and metrics
  performance: true,
  
  // Inventory Management — Stock tracking
  inventory: true,
  
  // Expenses Tracking — Operating costs
  expenses: true,
  
  // Settings — App configuration
  settings: false,
} as const;

/**
 * Tab Metadata
 * Used to configure visible tabs dynamically
 */
export const TAB_CONFIG = {
  pos: {
    id: 'pos',
    label: 'POS',
    icon: 'LayoutDashboard',
    visible: TAB_VISIBILITY.pos,
  },
  menu: {
    id: 'menu',
    label: 'Menu',
    icon: 'Utensils',
    visible: TAB_VISIBILITY.menu,
  },
  records: {
    id: 'records',
    label: 'Records',
    icon: 'History',
    visible: TAB_VISIBILITY.records,
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    icon: 'TrendingUp',
    visible: TAB_VISIBILITY.performance,
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    icon: 'Package',
    visible: TAB_VISIBILITY.inventory,
  },
  expenses: {
    id: 'expenses',
    label: 'Expenses',
    icon: 'Wallet',
    visible: TAB_VISIBILITY.expenses,
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    visible: TAB_VISIBILITY.settings,
  },
} as const;

/**
 * Get list of visible tabs
 * @returns Array of visible tab IDs
 */
export function getVisibleTabs(): Array<keyof typeof TAB_CONFIG> {
  return (Object.keys(TAB_CONFIG) as Array<keyof typeof TAB_CONFIG>)
    .filter(tabId => TAB_CONFIG[tabId].visible);
}

/**
 * Check if specific tab is visible
 * @param tabId - Tab identifier
 * @returns true if tab should be visible
 */
export function isTabVisible(tabId: keyof typeof TAB_CONFIG): boolean {
  return TAB_CONFIG[tabId]?.visible ?? false;
}

/**
 * Get first visible tab
 * Useful for redirecting after hiding current tab
 * @returns First visible tab ID or 'pos' as fallback
 */
export function getFirstVisibleTab(): keyof typeof TAB_CONFIG {
  const visible = getVisibleTabs();
  return visible.length > 0 ? visible[0] : 'pos';
}

/**
 * Get path of specific tab
 * @param tabId - Tab identifier
 * @returns Path string
 */
export function getTabPath(tabId: keyof typeof TAB_CONFIG): string {
  switch (tabId) {
    case 'pos': return '/';
    case 'menu': return '/menu';
    case 'records': return '/records';
    case 'performance': return '/performance';
    case 'inventory': return '/inventory';
    case 'expenses': return '/expenses';
    case 'settings': return '/settings';
    default: return '/';
  }
}
