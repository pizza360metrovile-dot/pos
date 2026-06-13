/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Printer, CheckCircle, User, CreditCard, Utensils, Send, RotateCcw, X, Clock, AlertCircle, Truck, ShieldCheck, Square, CheckSquare, Edit3, Flame } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useStore, showConfirmModal } from '../store/useStore';
import { db } from '../lib/db';
import { MenuItem, OrderType, Order, OrderItem, KotSnapshot, OrderItemModifier } from '../types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { KitchenTicket, CustomerReceipt, DeltaKitchenTicket } from '../components/PrintComponents';
import ModifierModal from '../components/ModifierModal';
import DealModal from '../components/DealModal';

export default function POS() {
  const { 
    menuItems, categories, settings, addOrder, updateOrder, deleteOrder, orders,
    cart, setCart, clearCart, addToCart, addDealToCart, updateQuantity, removeFromCart, updateCartItem,
    orderType, updateOrderType, customerName, setCustomerName, 
    tableNumber, setTableNumber, activeOrder, setActiveOrder,
    retrieveOrder: storeRetrieveOrder, cancelHeldOrder: storeCancelHeldOrder,
    kotSnapshots, addKotSnapshot, modifierGroups, dealItems,
    discountType, setDiscountType, discountValue, setDiscountValue,
    deliveryCharge, setDeliveryCharge,
    cashiers = [], activeCashierName, setActiveCashierName, cancelOrder
  } = useStore();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isHeldPanelOpen, setIsHeldPanelOpen] = useState(false);
  const [isInProgressPanelOpen, setIsInProgressPanelOpen] = useState(false);
  const [retrievalConfirmData, setRetrievalConfirmData] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellationReasonText, setCancellationReasonText] = useState('');
  const [unavailableItems, setUnavailableItems] = useState<string[]>([]);
  const [modifierModalData, setModifierModalData] = useState<{ 
    item: MenuItem; 
    editingId?: string; 
    initialModifiers?: OrderItemModifier[]; 
    initialNotes?: string;
  } | null>(null);
  const [dealModalData, setDealModalData] = useState<{
    dealItem: MenuItem;
    components: any[];
  } | null>(null);

  const [kotPrintOrder, setKotPrintOrder] = useState<Order | null>(null);
  const [requireKOT, setRequireKOT] = useState<boolean>(true);

  // ── KEYBOARD SHORTCUTS STATE & SERVICES ──
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [focusedZone, setFocusedZone] = useState<'menu' | 'cart' | 'panel-held' | 'panel-inprogress' | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [focusedCartItemIndex, setFocusedCartItemIndex] = useState<number | null>(null);
  const [focusedPanelOrderIndex, setFocusedPanelOrderIndex] = useState<number | null>(null);
  
  // Category cycling state
  const [lastLetterPressed, setLastLetterPressed] = useState<string>('');
  const [lastLetterPressIndex, setLastLetterPressIndex] = useState<number>(0);

  // Modal active focus tracking
  const [modalSectionIndex, setModalSectionIndex] = useState<number>(0);
  const [modalOptionIndex, setModalOptionIndex] = useState<number>(0);

  // Load keyboard setting and requireKOT on mount
  useEffect(() => {
    const loadKbSetting = async () => {
      try {
        const entry = await db.table('appMeta').get('_kb');
        if (entry) {
          setShortcutsEnabled(entry.value !== false);
        } else {
          setShortcutsEnabled(true);
        }
      } catch (err) {
        console.error(err);
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
    loadKbSetting();
    loadRequireKOT();
  }, []);

  // Reset modal navigation pointers when modifier modal toggled
  useEffect(() => {
    setModalSectionIndex(0);
    setModalOptionIndex(0);
    if (modifierModalData || dealModalData) {
      setTimeout(() => {
        const modalEl = document.querySelector('.fixed.z-\\[100\\], .fixed.inset-0.z-\\[100\\], [role="dialog"]') as HTMLElement;
        if (modalEl) {
          const firstBtn = modalEl.querySelector('.grid-cols-2 button:not([disabled]), button:not([disabled])') as HTMLElement;
          if (firstBtn) {
            firstBtn.classList.add('kb-focused');
            firstBtn.focus();
          }
        }
      }, 100);
    }
  }, [modifierModalData, dealModalData]);

  const [kotPrintNumber, setKotPrintNumber] = useState<number>(1);
  const [isPendingKOTPrint, setIsPendingKOTPrint] = useState(false);
  const [isFirstKOTPrint, setIsFirstKOTPrint] = useState(true);
  const [kotPrintPrevSentAt, setKotPrintPrevSentAt] = useState<number | undefined>(undefined);

  const receiptRef = useRef<HTMLDivElement>(null);
  const kotRef = useRef<HTMLDivElement>(null);
  const deltaKotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (kotPrintOrder && isPendingKOTPrint) {
      if (!kotPrintOrder.id) {
        toast.error("Order could not be saved. Please try again.");
        setIsPendingKOTPrint(false);
        return;
      }
      if (isFirstKOTPrint) {
        handleKOTPrint();
      } else {
        handleDeltaKOTPrint();
      }
      setIsPendingKOTPrint(false);
    }
  }, [kotPrintOrder, isPendingKOTPrint, isFirstKOTPrint]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const modifierPrice = (item.modifiers || []).reduce((sum, mod) => sum + mod.additionalPrice, 0);
      return acc + ((item.price + modifierPrice) * item.quantity);
    }, 0);
  }, [cart]);
  
  const parsedDiscountValue = useMemo(() => {
    return Math.max(0, Number(discountValue) || 0);
  }, [discountValue]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      const val = Math.min(100, parsedDiscountValue);
      return subtotal * (val / 100);
    } else if (discountType === 'flat') {
      return Math.min(subtotal, parsedDiscountValue);
    }
    return 0;
  }, [subtotal, discountType, parsedDiscountValue]);

  const afterDiscount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const effectiveDeliveryCharge = useMemo(() => {
    if (orderType !== OrderType.DELIVERY || !settings.deliveryChargeEnabled) return 0;
    return deliveryCharge !== null ? deliveryCharge : (settings?.deliveryChargeAmount ?? 0);
  }, [orderType, settings, deliveryCharge]);

  const taxAmount = useMemo(() => {
    const taxableAmount = settings.deliveryChargeTaxable 
      ? afterDiscount + effectiveDeliveryCharge 
      : afterDiscount;
    return (taxableAmount * settings.taxPercentage) / 100;
  }, [afterDiscount, effectiveDeliveryCharge, settings]);

  const total = afterDiscount + effectiveDeliveryCharge + taxAmount;

  const heldOrders = useMemo(() => orders.filter(o => o.status === 'held'), [orders]);
  const inProgressOrders = useMemo(() => orders.filter(o => o.status === 'in-progress'), [orders]);

  const handleAddToCart = (item: MenuItem) => {
    if (item.isDeal) {
      const dItems = dealItems
        .filter(di => String(di.dealMenuItemId) === String(item.id))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      
      const expandedComponents = [];
      for (const dItem of dItems) {
        const compMenuItem = menuItems.find(m => String(m.id) === String(dItem.componentMenuItemId));
        if (compMenuItem) {
          const groups = modifierGroups.filter(g => String(g.menuItemId) === String(compMenuItem.id));
          for (let u = 1; u <= dItem.quantity; u++) {
            expandedComponents.push({
              _tempId: crypto.randomUUID(),
              componentMenuItemId: compMenuItem.id,
              componentName: compMenuItem.name,
              unitIndex: u,
              totalUnits: dItem.quantity,
              applicableGroups: groups
            });
          }
        }
      }

      setDealModalData({
        dealItem: item,
        components: expandedComponents
      });
    } else {
      const hasModifiers = modifierGroups.some(g => String(g.menuItemId) === String(item.id));
      if (hasModifiers) {
        setModifierModalData({ item });
      } else {
        addToCart(item);
      }
    }
  };

  const handleEditModifiers = (item: OrderItem) => {
    const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
    if (menuItem) {
      setModifierModalData({
        item: menuItem,
        editingId: item.id,
        initialModifiers: item.modifiers,
        initialNotes: item.notes
      });
    }
  };

  const updateItemNote = (itemId: string, notes: string) => {
    setCart(cart.map(i => i.id === itemId ? { ...i, notes } : i));
  };

  const filteredItems = useMemo(() => {
    const baseItems = activeCategory === 'all' 
      ? menuItems
      : menuItems.filter(i => String(i.categoryId) === String(activeCategory));
    
    return baseItems.filter(item => {
      const category = categories.find(c => String(c.id) === String(item.categoryId));
      if (category?.type === 'prepared') {
        // Prepared items only hidden if manually disabled
        return item.isActive || item.disabledReason !== 'manual';
      }
      // Stocked items are always shown, but will be greyed out if inactive or out of stock
      return true;
    });
  }, [menuItems, categories, activeCategory]);

  const isSafeToFire = () => {
    if (!shortcutsEnabled) return false;
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return false;
      }
      if (activeEl.hasAttribute('contenteditable') || activeEl.getAttribute('contenteditable') === 'true') {
        return false;
      }
    }
    return true;
  };

  const handleLetterKeyPress = (key: string) => {
    const letter = key.toLowerCase();
    const matchingCategories = categories.filter(c => 
      c.name.toLowerCase().startsWith(letter)
    );
    
    if (matchingCategories.length === 0) return;
    
    let targetCat = matchingCategories[0];
    
    if (matchingCategories.length === 1) {
      setActiveCategory(String(targetCat.id));
      focusFirstValidItemForCategory(String(targetCat.id));
    } else {
      let nextIdx = 0;
      if (lastLetterPressed === letter) {
        nextIdx = (lastLetterPressIndex + 1) % matchingCategories.length;
      }
      setLastLetterPressed(letter);
      setLastLetterPressIndex(nextIdx);
      targetCat = matchingCategories[nextIdx];
      setActiveCategory(String(targetCat.id));
      focusFirstValidItemForCategory(String(targetCat.id));
      toast(`Category: ${targetCat.name}`, { duration: 1500 });
    }
  };

  const focusFirstValidItemForCategory = (catId: string) => {
    const baseItems = catId === 'all' 
      ? menuItems
      : menuItems.filter(i => String(i.categoryId) === String(catId));
    
    const visible = baseItems.filter(item => {
      const category = categories.find(c => String(c.id) === String(item.categoryId));
      if (category?.type === 'prepared') {
        return item.isActive || item.disabledReason !== 'manual';
      }
      return true;
    });

    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      const category = categories.find(c => String(c.id) === String(item.categoryId));
      const isStocked = category?.type === 'stocked';
      const isStockedDisabled = isStocked && (!item.isActive || item.directStock <= 0);
      const isManualDisabled = item.disabledReason === 'manual' || (!item.isActive && item.disabledReason !== 'out_of_stock');
      if (!(isStockedDisabled || isManualDisabled)) {
        setFocusedZone('menu');
        setFocusedItemIndex(i);
        return;
      }
    }
    setFocusedItemIndex(null);
  };

  const getGridCols = (): number => {
    const gridEl = document.getElementById('menu-grid');
    if (gridEl) {
      const gridWidth = gridEl.clientWidth;
      const firstCard = gridEl.firstElementChild as HTMLElement;
      const cardWidth = firstCard ? firstCard.clientWidth : 140;
      return Math.max(1, Math.floor(gridWidth / cardWidth));
    }
    return 4;
  };

  const isItemDisabled = (idx: number): boolean => {
    const item = filteredItems[idx];
    if (!item) return true;
    const category = categories.find(c => String(c.id) === String(item.categoryId));
    const isStocked = category?.type === 'stocked';
    const isStockedDisabled = isStocked && (!item.isActive || item.directStock <= 0);
    const isManualDisabled = item.disabledReason === 'manual' || (!item.isActive && item.disabledReason !== 'out_of_stock');
    return isStockedDisabled || isManualDisabled;
  };

  const getNextValidIndex = (
    startIndex: number,
    direction: 'left' | 'right' | 'up' | 'down',
    cols: number,
    totalItems: number
  ): number => {
    let current = startIndex;
    for (let attempt = 0; attempt < totalItems * 2; attempt++) {
      if (direction === 'right') {
        current = (current + 1) % totalItems;
      } else if (direction === 'left') {
        current = (current - 1 + totalItems) % totalItems;
      } else if (direction === 'down') {
        current = current + cols;
        if (current >= totalItems) {
          current = totalItems - 1;
        }
      } else if (direction === 'up') {
        current = current - cols;
        if (current < 0) {
          current = 0;
        }
      }

      if (!isItemDisabled(current)) {
        return current;
      }

      if (direction === 'down' && current === totalItems - 1 && isItemDisabled(current)) {
        let f = totalItems - 1;
        while (f >= 0 && isItemDisabled(f)) {
          f--;
        }
        return f >= 0 ? f : startIndex;
      }
      if (direction === 'up' && current === 0 && isItemDisabled(current)) {
        let f = 0;
        while (f < totalItems && isItemDisabled(f)) {
          f++;
        }
        return f < totalItems ? f : startIndex;
      }
    }
    return startIndex;
  };

  const handleMenuNavigation = (key: string) => {
    const cols = getGridCols();
    const total = filteredItems.length;
    if (total === 0) return;

    if (focusedItemIndex === null) {
      for (let i = 0; i < total; i++) {
        if (!isItemDisabled(i)) {
          setFocusedZone('menu');
          setFocusedItemIndex(i);
          return;
        }
      }
      return;
    }

    setFocusedZone('menu');

    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    if (key === 'ArrowRight') direction = 'right';
    else if (key === 'ArrowLeft') direction = 'left';
    else if (key === 'ArrowDown') direction = 'down';
    else if (key === 'ArrowUp') direction = 'up';

    if (direction) {
      const nextIdx = getNextValidIndex(focusedItemIndex, direction, cols, total);
      setFocusedItemIndex(nextIdx);
    }
  };

  const highlightModalElement = (sectionsList: any[], secIdx: number, optIdx: number) => {
    const modalEl = document.querySelector('.fixed.z-\\[100\\], .fixed.inset-0.z-\\[100\\], [role="dialog"]') as HTMLElement;
    if (!modalEl) return;
    
    modalEl.querySelectorAll('.kb-focused').forEach(el => el.classList.remove('kb-focused'));
    
    const section = sectionsList[secIdx];
    if (!section) return;
    
    let targetEl: HTMLElement | null = null;
    if (section.type === 'options') {
      const options = section.options || [];
      targetEl = options[optIdx] || options[0] || null;
    } else {
      targetEl = section.element;
    }
    
    if (targetEl) {
      targetEl.classList.add('kb-focused');
      targetEl.focus();
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleModalKeyDown = (event: KeyboardEvent) => {
    const modalEl = document.querySelector('.fixed.z-\\[100\\], .fixed.inset-0.z-\\[100\\], [role="dialog"]') as HTMLElement;
    if (!modalEl) return;

    const sections: {
      type: 'options' | 'input' | 'button';
      element: HTMLElement;
      options?: HTMLElement[];
    }[] = [];

    const grids = Array.from(modalEl.querySelectorAll('.grid-cols-2, [class*="grid-cols-"]'));
    const optionButtonsSet = new Set<HTMLElement>();

    grids.forEach(grid => {
      const buttons = Array.from(grid.querySelectorAll('button:not([disabled])')) as HTMLElement[];
      if (buttons.length > 0) {
        sections.push({
          type: 'options',
          element: grid as HTMLElement,
          options: buttons
        });
        buttons.forEach(btn => optionButtonsSet.add(btn));
      }
    });

    const inputs = Array.from(modalEl.querySelectorAll('textarea, input:not([type="hidden"])')) as HTMLElement[];
    inputs.forEach(input => {
      const rect = input.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sections.push({
          type: 'input',
          element: input
        });
      }
    });

    const buttons = Array.from(modalEl.querySelectorAll('button:not([disabled])')) as HTMLElement[];
    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !optionButtonsSet.has(btn) && !btn.querySelector('svg')) {
        sections.push({
          type: 'button',
          element: btn
        });
      }
    });

    if (sections.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab') {
      event.preventDefault();
      let nextSecIdx = modalSectionIndex;
      if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
        nextSecIdx = (modalSectionIndex + 1) % sections.length;
      } else {
        nextSecIdx = (modalSectionIndex - 1 + sections.length) % sections.length;
      }
      setModalSectionIndex(nextSecIdx);
      setModalOptionIndex(0);
      highlightModalElement(sections, nextSecIdx, 0);
    } 
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const section = sections[modalSectionIndex];
      if (section && section.type === 'options' && section.options) {
        let nextOptIdx = modalOptionIndex;
        if (event.key === 'ArrowRight') {
          nextOptIdx = (modalOptionIndex + 1) % section.options.length;
        } else {
          nextOptIdx = (modalOptionIndex - 1 + section.options.length) % section.options.length;
        }
        setModalOptionIndex(nextOptIdx);
        highlightModalElement(sections, modalSectionIndex, nextOptIdx);
      }
    } 
    else if (event.key === 'Enter') {
      event.preventDefault();
      const section = sections[modalSectionIndex];
      if (section) {
        if (section.type === 'options' && section.options) {
          const btn = section.options[modalOptionIndex];
          if (btn) btn.click();
        } else if (section.type === 'input') {
          section.element.focus();
        } else if (section.type === 'button') {
          section.element.click();
        }
      }
    } 
    else if (event.key === 'Escape') {
      event.preventDefault();
      const closeBtn = modalEl.querySelector('header button, .absolute.top-2.right-2 button, button .w-5') as HTMLElement;
      if (closeBtn) {
        closeBtn.click();
      } else {
        setModifierModalData(null);
        setDealModalData(null);
      }
    }
  };

  // Global keydown listeners routing
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!isSafeToFire()) return;

      if (modifierModalData || dealModalData) {
        handleModalKeyDown(event);
        return;
      }

      if (isHeldPanelOpen || isInProgressPanelOpen) {
        const activePanelZone = isHeldPanelOpen ? 'panel-held' : 'panel-inprogress';
        const ordersList = isHeldPanelOpen ? heldOrders : inProgressOrders;
        
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (ordersList.length === 0) return;
          
          let nextIdx = focusedPanelOrderIndex !== null ? focusedPanelOrderIndex : -1;
          if (event.key === 'ArrowDown') {
            nextIdx = Math.min(ordersList.length - 1, nextIdx + 1);
          } else {
            nextIdx = Math.max(0, nextIdx - 1);
          }
          
          setFocusedZone(activePanelZone);
          setFocusedPanelOrderIndex(nextIdx);
          
          setTimeout(() => {
            const items = document.querySelectorAll(`[data-kb-panel-order="${isHeldPanelOpen ? 'held' : 'inprogress'}"]`);
            const targetItem = items[nextIdx] as HTMLElement;
            if (targetItem) {
              targetItem.focus();
              targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 10);
        } 
        else if (event.key === 'Enter') {
          event.preventDefault();
          if (focusedPanelOrderIndex !== null && ordersList[focusedPanelOrderIndex]) {
            const order = ordersList[focusedPanelOrderIndex];
            retrieveOrder(order);
            setFocusedZone('menu');
            setFocusedItemIndex(0);
          }
        } 
        else if (event.key === 'Escape') {
          event.preventDefault();
          setIsHeldPanelOpen(false);
          setIsInProgressPanelOpen(false);
          setFocusedZone('menu');
          setFocusedItemIndex(0);
        }
        return;
      }

      if (focusedZone === 'cart' && focusedCartItemIndex !== null) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (cart.length === 0) return;
          
          let nextIdx = focusedCartItemIndex;
          if (event.key === 'ArrowDown') {
            nextIdx = Math.min(cart.length - 1, focusedCartItemIndex + 1);
          } else {
            nextIdx = Math.max(0, focusedCartItemIndex - 1);
          }
          setFocusedCartItemIndex(nextIdx);
          setTimeout(() => {
            const items = document.querySelectorAll('[data-kb-cart-item]');
            const targetItem = items[nextIdx] as HTMLElement;
            if (targetItem) {
              targetItem.focus();
              targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 10);
          return;
        }
        else if (event.key === 'Enter') {
          event.preventDefault();
          const item = cart[focusedCartItemIndex];
          if (item) {
            handleEditModifiers(item);
          }
          return;
        }
        else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          const item = cart[focusedCartItemIndex];
          if (item) {
            showConfirmModal({
              title: 'Remove Item',
              message: `Remove ${item.name} from cart?`,
              confirmLabel: 'Remove',
              cancelLabel: 'Cancel',
              isDanger: true
            }).then(confirmed => {
              if (confirmed) {
                removeFromCart(item.id);
                if (focusedCartItemIndex >= cart.length - 1) {
                  setFocusedCartItemIndex(Math.max(0, cart.length - 2));
                }
              }
            });
          }
          return;
        }
        else if (event.key === 'Escape') {
          event.preventDefault();
          setFocusedZone('menu');
          setFocusedItemIndex(0);
          return;
        }
      }

      if (event.key === ',' || event.key === '<') {
        event.preventDefault();
        if (cart.length === 0) {
          toast("No items to send");
          return;
        }
        sendToKitchen();
        return;
      }
      if (event.key === '.' || event.key === '>') {
        event.preventDefault();
        if (cart.length === 0) {
          toast("No items in order");
          return;
        }
        handlePrintReceiptReceiptCheck();
        return;
      }
      if (event.key === '/' || event.key === '?') {
        event.preventDefault();
        if (cart.length === 0) {
          toast("No items to complete");
          return;
        }
        completeOrder('completed');
        return;
      }
      if (event.key === ';' || event.key === ':') {
        event.preventDefault();
        if (inProgressOrders.length === 0) {
          toast("No in-progress orders");
          return;
        }
        setIsInProgressPanelOpen(true);
        setIsHeldPanelOpen(false);
        setFocusedZone('panel-inprogress');
        setFocusedPanelOrderIndex(0);
        setTimeout(() => {
          const item = document.querySelector('[data-kb-panel-order="inprogress"]') as HTMLElement;
          if (item) {
            item.focus();
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
        return;
      }
      if (event.key === "'" || event.key === '"') {
        event.preventDefault();
        if (heldOrders.length === 0) {
          toast("No held orders");
          return;
        }
        setIsHeldPanelOpen(true);
        setIsInProgressPanelOpen(false);
        setFocusedZone('panel-held');
        setFocusedPanelOrderIndex(0);
        setTimeout(() => {
          const item = document.querySelector('[data-kb-panel-order="held"]') as HTMLElement;
          if (item) {
            item.focus();
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        handleMenuNavigation(event.key);
        setTimeout(() => {
          const targetItem = document.querySelector('.kb-focused') as HTMLElement;
          if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 10);
        return;
      }

      if (event.key === 'Enter') {
        if (focusedZone === 'menu' && focusedItemIndex !== null) {
          event.preventDefault();
          const item = filteredItems[focusedItemIndex];
          if (item && !isItemDisabled(focusedItemIndex)) {
            handleAddToCart(item);
          }
        }
        return;
      }

      if (event.key.length === 1 && event.key.match(/[a-zA-Z]/)) {
        event.preventDefault();
        handleLetterKeyPress(event.key);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    shortcutsEnabled, focusedZone, focusedItemIndex, focusedCartItemIndex, focusedPanelOrderIndex,
    lastLetterPressed, lastLetterPressIndex, activeCategory, filteredItems, cart, inProgressOrders, heldOrders,
    modifierModalData, dealModalData, isHeldPanelOpen, isInProgressPanelOpen
  ]);

  const handleKOTPrint = useReactToPrint({
    contentRef: kotRef,
  });

  const handleDeltaKOTPrint = useReactToPrint({
    contentRef: deltaKotRef,
  });

  const handleReceiptPrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const currentSnapshots = useMemo(() => {
    if (!activeOrder) return [];
    return kotSnapshots.filter(s => s.orderId === activeOrder.id).sort((a, b) => a.sentAt - b.sentAt);
  }, [kotSnapshots, activeOrder]);

  const lastSnapshot = currentSnapshots[currentSnapshots.length - 1];

  const deltas = useMemo(() => {
    if (!lastSnapshot) return null;
    
    const added: OrderItem[] = [];
    const increased: { item: OrderItem; deltaQty: number }[] = [];
    const noteChanged: { item: OrderItem; oldNote: string; newNote: string }[] = [];
    const cancelled: OrderItem[] = [];

    // Check current cart against last items
    cart.forEach(currentItem => {
      const lastItem = lastSnapshot.items.find(li => li.menuItemId === currentItem.menuItemId);
      if (!lastItem) {
        added.push(currentItem);
      } else {
        if (currentItem.quantity > lastItem.quantity) {
          increased.push({ item: currentItem, deltaQty: currentItem.quantity - lastItem.quantity });
        }
        if (currentItem.notes !== lastItem.notes) {
          noteChanged.push({ item: currentItem, oldNote: lastItem.notes || '', newNote: currentItem.notes || '' });
        }
      }
    });

    // Check last items against current cart (cancelled)
    lastSnapshot.items.forEach(lastItem => {
      const currentItem = cart.find(ci => ci.menuItemId === lastItem.menuItemId);
      if (!currentItem) {
        cancelled.push(lastItem);
      }
    });

    if (added.length === 0 && increased.length === 0 && noteChanged.length === 0 && cancelled.length === 0) {
      return null;
    }

    return { added, increased, noteChanged, cancelled };
  }, [cart, lastSnapshot]);

  const sendToKitchen = async () => {
    try {
      if (cart.length === 0) {
        if (lastSnapshot) {
          const confirmed = await showConfirmModal({
            title: 'Cancel Order',
            message: 'All items removed. Send full cancellation to kitchen?',
            confirmLabel: 'Send Cancellation',
            cancelLabel: 'Keep',
            isDanger: true
          });
          if (!confirmed) {
            return;
          }
        } else {
          return;
        }
      }

      const isFirstKOT = !lastSnapshot;
      
      if (!isFirstKOT && !deltas) {
        toast.info('No new items to send to kitchen');
        return;
      }

      let orderToSync: Order;

      if (activeOrder) {
        orderToSync = {
          ...activeOrder,
          items: [...cart],
          subtotal,
          taxAmount,
          total,
          deliveryCharge: effectiveDeliveryCharge,
          deliveryChargeWaived: false,
          deliveryChargeWaivedReason: undefined,
          updatedAt: Date.now(),
          discountType: discountValue > 0 ? discountType : null,
          discountValue: discountValue > 0 ? parsedDiscountValue : 0,
          discountAmount,
          status: 'in-progress'
        };
        await updateOrder(orderToSync);
      } else {
        orderToSync = {
          id: crypto.randomUUID(),
          orderNumber: `${Date.now().toString().slice(-6)}`,
          items: [...cart],
          subtotal,
          taxAmount,
          total,
          type: orderType,
          deliveryCharge: effectiveDeliveryCharge,
          deliveryChargeWaived: false,
          deliveryChargeWaivedReason: undefined,
          customerName: customerName || undefined,
          tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
          status: 'in-progress',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          kotPrinted: true,
          discountType: discountValue > 0 ? discountType : null,
          discountValue: discountValue > 0 ? parsedDiscountValue : 0,
          discountAmount,
        };
        await addOrder(orderToSync);
      }

      const orderId = orderToSync?.id;
      if (!orderId) {
        toast.error("Order could not be saved. Please try again.");
        return;
      }

      let kotNumber: number;
      if (activeOrder && !isFirstKOT) {
        // Resend KOT (Update scenario)
        const lastKOT = await db.kotSnapshots
          .where('orderId').equals(orderId)
          .toArray()
          .then(arr => arr.sort((a, b) => a.kotNumber - b.kotNumber).pop());
        kotNumber = (lastKOT?.kotNumber || 0) + 1;
      } else {
        // Send to Kitchen / KOT NUMBER GENERATION
        const lastKOT = await db.kotSnapshots
          .orderBy('kotNumber')
          .last();
        const lastNumber = lastKOT?.kotNumber || 0;
        kotNumber = lastNumber + 1;
      }

      const prevSentAt = lastSnapshot ? lastSnapshot.sentAt : undefined;
      setKotPrintPrevSentAt(prevSentAt);

      await addKotSnapshot({
        orderId: orderId,
        kotNumber,
        sentAt: Date.now(),
        items: JSON.parse(JSON.stringify(cart)),
        notes: activeOrder?.notes || undefined
      });

      if (settings.autoPrintKOT) {
        setKotPrintOrder(orderToSync);
        setKotPrintNumber(kotNumber);
        setIsFirstKOTPrint(isFirstKOT);
        setIsPendingKOTPrint(true);
      }

      clearCart();
      toast.success(`Order #${orderToSync.orderNumber} sent to kitchen and moved to In-Progress`);
    } catch (error: any) {
      console.error('Error sending to kitchen:', error);
      toast.error(error.message || 'An error occurred while sending order to the kitchen. State reset.');
    }
  };

  const completeOrder = async (status: 'completed' | 'held' = 'completed') => {
    try {
      if (cart.length === 0) {
        if (status === 'held') {
          toast.error('Add items before holding an order');
        }
        return;
      }

      // Workflow Safety Guard:
      if (status === 'completed') {
        if (requireKOT && (!activeOrder || !lastSnapshot)) {
          toast.error('Please send order to the kitchen first.');
          return;
        }
      }

      const order: Order = {
        id: activeOrder?.id || crypto.randomUUID(),
        orderNumber: activeOrder?.orderNumber || `${Date.now().toString().slice(-6)}`,
        items: [...cart],
        subtotal,
        taxAmount,
        total,
        type: orderType,
        deliveryCharge: effectiveDeliveryCharge,
        deliveryChargeWaived: false,
        deliveryChargeWaivedReason: undefined,
        customerName: customerName || undefined,
        tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
        status: status,
        createdAt: activeOrder?.createdAt || Date.now(),
        updatedAt: Date.now(),
        discountType: discountValue > 0 ? discountType : null,
        discountValue: discountValue > 0 ? parsedDiscountValue : 0,
        discountAmount,
      };

      if (activeOrder) {
        await updateOrder(order);
      } else {
        await addOrder(order);
      }

      if (status === 'completed') {
        setLastOrder(order);
        if (settings.autoPrintReceipt) {
          setTimeout(() => handleReceiptPrint(), 100);
        }
        clearCart();
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
        toast.success(`Order #${order.orderNumber} completed`);
      } else {
        clearCart();
        toast.info(`Order #${order.orderNumber} is on hold`);
      }
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast.error(error.message || 'An error occurred while processing the order. System reset.');
    }
  };

  const handlePrintReceiptReceiptCheck = () => {
    if (cart.length === 0 && !lastOrder) {
      toast.error('Cannot print: Order incomplete.');
      return;
    }
    if (requireKOT && cart.length > 0 && (!activeOrder || !lastSnapshot)) {
      toast.error('Cannot print: Order incomplete.');
      return;
    }
    handleReceiptPrint();
  };

  const retrieveOrder = async (order: Order, force = false) => {
    if (cart.length > 0 && !force) {
      setRetrievalConfirmData(order);
      return;
    }

    const { unavailable } = storeRetrieveOrder(order, menuItems);
    setUnavailableItems(unavailable);
    setIsHeldPanelOpen(false);
    setIsInProgressPanelOpen(false);
    setRetrievalConfirmData(null);
  };

  const cancelHeldOrder = async (id: string, orderNumber: string) => {
    const confirmed = await showConfirmModal({
      title: 'Cancel Held Order',
      message: `Cancel this held order #${orderNumber}? This cannot be undone.`,
      confirmLabel: 'Cancel Order',
      cancelLabel: 'Keep',
      isDanger: true
    });
    if (confirmed) {
      await storeCancelHeldOrder(id);
      toast.success(`Order #${orderNumber} cancelled`);
    }
  };

  return (
    <div className="flex h-full animate-fade-in divide-x divide-border-light">
      {/* Menu Area */}
      <div className="flex-1 flex flex-col bg-bg-app overflow-hidden">
        <header className="h-16 bg-bg-surface border-b border-border-light px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-text-primary uppercase tracking-tight">
              {settings.name || 'LUX BISTRO'} 
              <span className="text-text-muted font-medium ml-2 text-xs tracking-wide inline-flex items-center gap-1.5 align-middle">
                <span>|</span>
                <select
                  value={activeCashierName || ''}
                  onChange={(e) => setActiveCashierName(e.target.value || null)}
                  className="bg-transparent text-text-muted font-semibold hover:text-text-primary px-1 py-0.5 rounded cursor-pointer outline-none border border-transparent focus:border-border-medium transition-all text-xs focus:bg-bg-surface-2 focus:ring-1 focus:ring-accent"
                >
                  <option value="" className="bg-bg-surface text-text-primary">Select Cashier</option>
                  {cashiers.filter(c => c.isActive || c.name === activeCashierName).map(c => (
                    <option key={c.id} value={c.name} className="bg-bg-surface text-text-primary font-medium">
                      {c.name}
                    </option>
                  ))}
                </select>
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsInProgressPanelOpen(true)}
              className="flex items-center gap-2 h-10 px-4 bg-bg-surface border-[1.5px] border-border-medium rounded-md text-xs font-semibold text-text-secondary hover:bg-bg-surface-2 hover:border-border-strong transition-all relative group shadow-sm active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="uppercase tracking-wide">In-Progress</span>
              {inProgressOrders.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md font-bold">
                  {inProgressOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsHeldPanelOpen(true)}
              className="flex items-center gap-2 h-10 px-4 bg-bg-surface border-[1.5px] border-border-medium rounded-md text-xs font-semibold text-text-secondary hover:bg-bg-surface-2 hover:border-border-strong transition-all relative group shadow-sm active:scale-95"
            >
              <Clock className="w-4 h-4 text-warning" />
              <span className="uppercase tracking-wide">Held Orders</span>
              {heldOrders.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-danger text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md font-bold">
                  {heldOrders.length}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="bg-bg-surface border-b border-border-light px-8 flex gap-8 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveCategory('all')}
            className={clsx(
              "py-4 text-[13px] font-medium uppercase tracking-wide transition-all border-b-2",
              activeCategory === 'all' 
                ? "text-accent border-accent font-bold" 
                : "text-text-muted border-transparent hover:text-text-secondary"
            )}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(String(cat.id))}
              className={clsx(
                "py-4 text-[13px] font-medium uppercase tracking-wide transition-all border-b-2 whitespace-nowrap",
                String(activeCategory) === String(cat.id) 
                  ? "text-accent border-accent font-bold" 
                  : "text-text-muted border-transparent hover:text-text-secondary"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
          <div id="menu-grid" className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 items-stretch">
            {filteredItems.map((item, index) => {
              const inCart = cart.find(i => i.menuItemId === item.id);
              const category = categories.find(c => String(c.id) === String(item.categoryId));
              const isStocked = category?.type === 'stocked';
              
              const isStockedDisabled = isStocked && (!item.isActive || item.directStock <= 0);
              const isManualDisabled = item.disabledReason === 'manual' || (!item.isActive && item.disabledReason !== 'out_of_stock');
              
              const isDisabled = isStockedDisabled || isManualDisabled;

              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && handleAddToCart(item)}
                  disabled={isDisabled}
                  className={clsx(
                    "group relative flex flex-col bg-bg-surface border-[1.5px] rounded-lg p-4 transition-all duration-150 text-left",
                    isDisabled ? "cursor-not-allowed opacity-40" : "hover:bg-accent-light hover:border-accent-border hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:translate-y-0",
                    inCart ? "border-accent ring-2 ring-accent/10 shadow-md" : "border-border-light shadow-sm",
                    index === focusedItemIndex && focusedZone === 'menu' && "kb-focused"
                  )}
                >
                  {/* Stock Badge */}
                  {isStocked && (item.directStock <= 10 || (item.minStock !== undefined && item.directStock <= item.minStock)) && (
                    <div className={clsx(
                      "absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight z-20 shadow-sm border",
                      item.directStock === 0 
                        ? "bg-danger-light text-danger border-danger-border" 
                        : "bg-warning-light text-warning border-warning-border"
                    )}>
                      {item.directStock === 0 ? "Out" : item.directStock <= 10 ? `${item.directStock} left` : item.directStock}
                    </div>
                  )}

                  <div className="flex flex-col h-full">
                    <h3 className="font-semibold text-text-primary text-sm leading-[1.3] line-clamp-2 mb-2 flex items-center gap-1.5 flex-wrap">
                      {item.isDeal && (
                        <span className="inline-flex items-center bg-accent/15 text-accent text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider border border-accent/25 select-none shrink-0 animate-pulse" title="Deal / Bundle">
                          DEAL
                        </span>
                      )}
                      <span>{item.name}</span>
                    </h3>
                    <p className="mt-auto font-bold text-accent text-base">
                      {settings.currency}{(item.price || 0).toFixed(2)}
                    </p>
                  </div>

                  {/* Disabled Overlay */}
                  {isDisabled && (
                    <div className="absolute inset-0 bg-white/85 flex items-center justify-center p-3 text-center z-10 rounded-lg">
                      <span className="text-text-muted text-xs font-bold uppercase tracking-wide">
                        {isManualDisabled ? "Unavailable" : "Out of Stock"}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-[360px] bg-bg-surface flex flex-col shrink-0 border-l border-border-light shadow-xl z-30">
        {/* TOP: Header & Input Section */}
        <div className="flex-none bg-bg-surface border-b border-border-light">
          <div className="px-5 py-4 flex justify-between items-center border-b border-border-light/50 bg-bg-app/30">
            <h2 className="text-[13px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-accent" />
              Current Order
              {cart.length > 0 && (
                <span className="bg-accent/10 text-accent px-2 py-0.5 rounded text-[10px]">
                  {cart.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button 
                onClick={() => clearCart()} 
                className="text-[10px] font-bold text-text-muted hover:text-danger uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            <div className="flex bg-bg-surface-2 rounded-lg p-1 border border-border-light">
              {[OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY].map(type => (
                <button
                  key={type}
                  onClick={() => updateOrderType(type)}
                  className={clsx(
                    "flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all",
                    orderType === type 
                      ? "bg-bg-surface text-accent shadow-sm border border-border-light" 
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Customer Name"
                  className="w-full bg-bg-surface-2 border border-border-light rounded-md py-2 pl-[42px] pr-3 text-xs text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-all"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
              </div>
              {orderType === OrderType.DINE_IN && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Table Number"
                    className="w-full bg-bg-surface-2 border border-border-light rounded-md py-2 pl-[42px] pr-3 text-xs text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-all"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  />
                  <Utensils className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE: Scrollable Item List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-app/10">
          {activeOrder?.status === 'in-progress' && (
            <div className="m-4 bg-warning/5 border border-warning/20 rounded-lg p-3 flex items-center gap-3 shrink-0">
               <Clock className="w-4 h-4 text-warning" />
               <div className="flex-1">
                 <span className="text-[10px] font-bold uppercase tracking-tight text-warning block">
                   Editing in-progress order #{activeOrder.orderNumber}
                 </span>
               </div>
               <button 
                 onClick={() => {
                   setActiveOrder(null);
                   setCart([]);
                   setCustomerName('');
                   setTableNumber('');
                   setUnavailableItems([]);
                 }}
                 className="text-warning hover:opacity-70 transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>
          )}
          
          {unavailableItems.length > 0 && (
            <div className="m-4 bg-danger/5 border border-danger/20 rounded-lg p-3 flex flex-col gap-1.5 shrink-0">
               <div className="flex items-center gap-2 text-danger">
                 <AlertCircle className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-bold uppercase tracking-wide">Stock Collision</span>
               </div>
               <p className="text-[10px] text-danger/80 leading-relaxed font-medium">
                 {unavailableItems.join(', ')} no longer in stock.
               </p>
               <button 
                 onClick={() => setUnavailableItems([])}
                 className="text-[9px] font-bold text-danger uppercase tracking-wide hover:underline text-left"
               >
                 Acknowledge
               </button>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-disabled/40 p-8 text-center">
              <div className="w-16 h-16 bg-bg-app rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1">Queue Empty</p>
              <p className="text-[10px] font-medium opacity-60">Select items from the catalog to begin</p>
            </div>
          ) : (
            <div className="divide-y divide-border-light border-t border-border-light">
              {cart.map((item, idx) => {
                const itemSnapshot = lastSnapshot?.items.find(si => si.menuItemId === item.menuItemId);
                const isNew = !itemSnapshot;
                const isIncreased = itemSnapshot && item.quantity > itemSnapshot.quantity;
                const isSent = !!itemSnapshot;
                const isActive = (isNew || isIncreased);

                return (
                  <div 
                    key={item.id} 
                    tabIndex={0}
                    data-kb-cart-item="true"
                    onFocus={() => {
                      setFocusedZone('cart');
                      setFocusedCartItemIndex(idx);
                    }}
                    onClick={() => {
                      setFocusedZone('cart');
                      setFocusedCartItemIndex(idx);
                    }}
                    className={clsx(
                      "min-h-[56px] px-4 py-3 transition-all relative flex flex-col gap-2 focus:outline-none",
                      isActive ? "bg-accent/[0.03]" : "bg-bg-surface",
                      focusedZone === 'cart' && focusedCartItemIndex === idx && "kb-focused"
                    )}
                  >
                    {isActive && <div className="absolute top-0 left-0 w-1 h-full bg-warning"></div>}
                    {isSent && !isNew && !isIncreased && <div className="absolute top-0 left-0 w-1 h-full bg-success/40"></div>}
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className={clsx(
                          "text-[14px] font-semibold flex-1 leading-snug",
                          unavailableItems.includes(item.name) ? "text-danger" : "text-text-primary"
                        )}>
                          {item.name}
                        </h4>
                        <div className="text-[13px] font-bold text-text-primary tabular-nums">
                          {settings.currency}{((item.price + (item.modifiers || []).reduce((s: number, m: any) => s + m.additionalPrice, 0)) * (item.quantity || 0)).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        {!item.isDeal && (item.modifiers || []).map((m: any, mIdx: number) => (
                          <span key={mIdx} className="text-[12px] text-text-muted leading-relaxed">
                            + {m.label}
                          </span>
                        ))}
                      </div>

                      {item.isDeal && item.dealComponents && (
                        <div className="mt-2 pl-3 border-l-2 border-accent/30 flex flex-col gap-2">
                          {item.dealComponents.map((comp, cIdx) => (
                            <div key={cIdx} className="flex flex-col gap-0.5">
                              <span className="text-[12px] font-bold text-accent leading-tight">
                                {comp.componentName} <span className="text-text-muted font-normal text-[10px]">(unit {comp.unitIndex})</span>
                              </span>
                              {comp.modifiers && comp.modifiers.length > 0 && (
                                <div className="flex flex-col pl-1.5 border-l border-dashed border-border-light">
                                  {comp.modifiers.map((mod: any, mIdx: number) => (
                                    <span key={mIdx} className="text-[11px] text-text-muted leading-relaxed">
                                      + {mod.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {comp.notes && (
                                <span className="text-[11px] italic text-text-placeholder leading-relaxed pl-1.5">
                                  "{comp.notes}"
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center bg-bg-surface-2 border border-border-light rounded-md overflow-hidden shadow-sm h-8">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-full flex items-center justify-center text-text-secondary hover:bg-bg-app transition-all"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-8 text-center text-xs font-bold text-text-primary tabular-nums">
                          {item.quantity}
                        </div>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-full flex items-center justify-center text-text-secondary hover:bg-bg-app transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {!item.isDeal && (
                          <>
                            <button 
                              onClick={() => handleEditModifiers(item)}
                              className="text-[10px] font-bold text-accent uppercase tracking-widest hover:text-accent-strong transition-colors"
                            >
                              Customize
                            </button>
                            <div className="w-px h-3 bg-border-light"></div>
                          </>
                        )}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeFromCart(item.id);
                          }}
                          className="relative z-10 text-text-placeholder hover:text-danger transition-colors cursor-pointer pointer-events-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {!item.isDeal && (
                      <div className="mt-1">
                        <textarea 
                          rows={1}
                          placeholder="Add preparation notes..."
                          value={item.notes || ''}
                          onChange={(e) => updateItemNote(item.id, e.target.value)}
                          className="w-full bg-bg-surface-2 border border-border-light rounded-md px-3 py-1.5 text-[11px] text-text-secondary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-all resize-none overflow-hidden min-h-[32px] max-h-[48px]"
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 48)}px`;
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM: Totals and Actions */}
        <div className="flex-none bg-bg-surface border-t border-border-light shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">


          {/* Pricing Totals */}
          <div className="px-5 py-3 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-medium text-text-secondary">
              <span className="uppercase tracking-tight opacity-70">Subtotal</span>
              <span className="tabular-nums font-bold font-mono">{settings.currency}{(subtotal || 0).toFixed(2)}</span>
            </div>

            {/* Compact Inline Discount Input Row */}
            <div className="flex justify-between items-center h-9 text-[11px] py-1 border-b border-dashed border-border-light/40">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-secondary uppercase tracking-tight">Disc.</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discountValue || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDiscountValue(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-[70px] h-6 px-1.5 text-center bg-bg-surface border border-border-light rounded text-[11px] font-bold focus:outline-none focus:border-accent text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  id="pos-discount-value-input"
                />
                <div id="pos-discount-type-toggle" className="flex rounded-md border border-border-light overflow-hidden bg-bg-surface p-0.5 h-6">
                  <button
                    type="button"
                    id="discount-type-percent-btn"
                    onClick={() => setDiscountType('percent')}
                    className={clsx(
                      "px-2 text-[9px] font-semibold rounded transition-colors",
                      discountType === 'percent' 
                        ? "bg-accent text-white" 
                        : "text-text-secondary hover:bg-bg-surface"
                    )}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    id="discount-type-flat-btn"
                    onClick={() => setDiscountType('flat')}
                    className={clsx(
                      "px-1.5 text-[9px] font-semibold rounded transition-colors",
                      discountType === 'flat' 
                        ? "bg-accent text-white" 
                        : "text-text-secondary hover:bg-bg-surface"
                    )}
                  >
                    Rs.
                  </button>
                </div>
              </div>
            </div>

            {/* Discount Display Line (Only when discountValue > 0) */}
            {discountValue > 0 && parsedDiscountValue > 0 && (
              <div className="flex justify-between items-center text-[11px] font-medium text-danger">
                <span className="uppercase tracking-tight">
                  Discount {discountType === 'percent' ? `(${discountValue}%)` : `(Rs. ${discountValue})`}
                </span>
                <span className="tabular-nums font-bold font-mono">
                  -{settings.currency}{(discountAmount || 0).toFixed(2)}
                </span>
              </div>
            )}

            {orderType === OrderType.DELIVERY && settings.deliveryChargeEnabled && (
              <div className="flex justify-between items-center text-[11px] font-medium text-text-secondary h-8">
                <span className="uppercase tracking-tight flex items-center gap-1 opacity-70">
                 
                  <span>{settings.deliveryChargeLabel || 'Delivery'}</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[10px] font-mono text-text-muted">{settings.currency}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={deliveryCharge === null ? (settings?.deliveryChargeAmount ?? '') : (deliveryCharge === 0 ? '' : deliveryCharge)}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setDeliveryCharge(0);
                      } else {
                        const val = parseFloat(e.target.value);
                        setDeliveryCharge(isNaN(val) ? 0 : Math.max(0, val));
                      }
                    }}
                    className="w-[80px] h-6 px-1.5 text-right bg-bg-surface border border-border-light rounded text-[11px] font-bold focus:outline-none focus:border-accent text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    id="pos-delivery-charge-input"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-[11px] font-medium text-text-secondary">
              <span className="uppercase tracking-tight opacity-70">{settings.taxLabel || 'Tax'} ({settings.taxPercentage}%)</span>
              <span className="tabular-nums font-bold font-mono">+{settings.currency}{(taxAmount || 0).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-border-light">
              <span className="text-sm font-extrabold text-text-primary uppercase tracking-wider">Total Amount</span>
              <span className="text-2xl font-black text-accent tabular-nums tracking-tighter">
                {settings.currency}{(total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Core Action Buttons */}
          <div className="px-5 pb-5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sendToKitchen()}
                disabled={cart.length === 0 && !lastSnapshot}
                className={clsx(
                  "h-[44px] rounded-lg font-bold flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest disabled:opacity-40 relative shadow-sm",
                  activeOrder ? "bg-warning text-white" : "bg-text-primary text-white hover:bg-black"
                )}
              >
                <Send className="w-4 h-4" />
                {activeOrder?.status === 'in-progress' ? 'Resend KOT' : activeOrder ? 'Resend' : 'Kitchen'}
                {lastSnapshot && (
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full border border-white font-black shadow-md">
                     {lastSnapshot.kotNumber}
                  </span>
                )}
              </button>
              <button
                onClick={() => handlePrintReceiptReceiptCheck()}
                disabled={
                  cart.length > 0 
                    ? (requireKOT ? (!activeOrder || !lastSnapshot) : false)
                    : !lastOrder
                }
                title={requireKOT && cart.length > 0 && (!activeOrder || !lastSnapshot) ? "Send to Kitchen first" : undefined}
                className="h-[44px] bg-bg-surface-2 border border-border-light hover:bg-bg-app rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase text-text-primary tracking-widest shadow-sm transition-colors disabled:opacity-40"
              >
                <Printer className="w-4 h-4" />
                Bill
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => completeOrder('held')}
                disabled={cart.length === 0}
                className="h-[44px] bg-white border border-border-medium hover:bg-bg-app text-warning rounded-lg font-bold uppercase text-[10px] tracking-widest disabled:opacity-40 shadow-sm transition-all"
              >
                Hold
              </button>
              <button
                onClick={() => completeOrder('completed')}
                disabled={cart.length === 0 || (requireKOT ? (!activeOrder || !lastSnapshot) : false)}
                title={requireKOT && cart.length > 0 && (!activeOrder || !lastSnapshot) ? "Send to Kitchen first" : undefined}
                className="h-[44px] bg-success hover:bg-success/90 text-white rounded-lg font-bold uppercase text-[10px] tracking-widest disabled:opacity-40 shadow-md transition-all"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Components for Printing */}
      <div className="hidden">
        <div ref={receiptRef}>
          {(lastOrder || (cart.length > 0 && activeOrder)) && (
            <CustomerReceipt 
              order={lastOrder || {
                id: activeOrder?.id || 'preview',
                orderNumber: activeOrder?.orderNumber || 'PREVIEW',
                items: cart,
                subtotal,
                taxAmount,
                total,
                type: orderType,
                customerName,
                tableNumber,
                deliveryCharge: effectiveDeliveryCharge,
                deliveryChargeWaived: false,
                deliveryChargeWaivedReason: undefined,
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }} 
              settings={settings} 
            />
          )}
        </div>
        <div ref={kotRef}>
          {kotPrintOrder && (
            <KitchenTicket 
              order={kotPrintOrder} 
              settings={settings}
              kotNumber={kotPrintNumber}
            />
          )}
        </div>
        <div ref={deltaKotRef}>
          {kotPrintOrder && !isFirstKOTPrint && (
            <DeltaKitchenTicket
               order={kotPrintOrder}
               settings={settings}
               kotNumber={kotPrintNumber}
               totalKots={kotPrintNumber}
               lastSentAt={kotPrintPrevSentAt}
               deltas={null}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {isSuccess && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-pos-success text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold uppercase tracking-widest text-xs">Order Completed Successfully</span>
        </div>
      )}

      {/* Held Orders Slide-over */}
      {isHeldPanelOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] animate-fade-in"
            onClick={() => setIsHeldPanelOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-[70] animate-in slide-in-from-right duration-300 border-l border-slate-100 flex flex-col">
            <header className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Held Orders</h2>
              </div>
              <button onClick={() => setIsHeldPanelOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {heldOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-20">
                  <Clock className="w-16 h-16 opacity-10" />
                  <p className="font-bold text-[10px] uppercase tracking-[0.2em] opacity-40">Queue is Clear</p>
                </div>
              ) : (
                heldOrders.map((order, idx) => {
                  const isOverdue = isAfter(subHours(new Date(), 2), new Date(order.createdAt));
                  return (
                    <div 
                      key={order.id} 
                      tabIndex={0}
                      data-kb-panel-order="held"
                      onFocus={() => {
                        setFocusedZone('panel-held');
                        setFocusedPanelOrderIndex(idx);
                      }}
                      className={clsx(
                        "bg-white border border-slate-100 rounded-[2rem] p-6 space-y-5 hover:border-blue-100 transition-all group shadow-sm hover:shadow-md focus:outline-none",
                        focusedZone === 'panel-held' && focusedPanelOrderIndex === idx && "kb-focused"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-black text-slate-900 uppercase font-mono tracking-tighter">#{order.orderNumber}</h4>
                             {isOverdue && (
                               <span className="bg-rose-50 text-rose-500 text-[8px] font-black px-2 py-0.5 rounded-full border border-rose-100 uppercase tracking-widest animate-pulse">Critical</span>
                             )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tight">
                            {order.customerName || 'Walk-in'} • {order.tableNumber ? `Node ${order.tableNumber}` : order.type}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 font-mono">{settings.currency}{(order.total || 0).toFixed(2)}</div>
                          <div className="text-[9px] text-amber-600 font-black uppercase tracking-tight mt-1">
                            {formatDistanceToNow(order.createdAt)} old
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200/50 pb-1.5 flex justify-between">
                          <span>Items Matrix</span>
                          <span>Σ {order.items.reduce((acc, i) => acc + i.quantity, 0)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 italic font-medium leading-relaxed">
                          {order.items.map(i => `${i.name} [x${i.quantity}]`).join(', ')}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => retrieveOrder(order)}
                          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                          Restore
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            cancelHeldOrder(order.id, order.orderNumber);
                          }}
                          className="relative z-10 px-5 py-3 bg-white border border-slate-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 rounded-2xl transition-all active:scale-95 cursor-pointer pointer-events-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* In-Progress Orders Slide-over */}
      {isInProgressPanelOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] animate-fade-in"
            onClick={() => setIsInProgressPanelOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-[70] animate-in slide-in-from-right duration-300 border-l border-slate-100 flex flex-col">
            <header className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider leading-tight">In-Progress Orders</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Orders sent to kitchen</p>
                </div>
              </div>
              <button onClick={() => setIsInProgressPanelOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {inProgressOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-20">
                  <Flame className="w-16 h-16 opacity-10" />
                  <p className="font-bold text-[10px] uppercase tracking-[0.2em] opacity-40">No orders in progress</p>
                </div>
              ) : (
                inProgressOrders.map((order, idx) => {
                  const orderSnapshots = kotSnapshots.filter(s => s.orderId === order.id).sort((a, b) => b.sentAt - a.sentAt);
                  const latestSnapshot = orderSnapshots[0];
                  const sentAt = latestSnapshot ? latestSnapshot.sentAt : order.createdAt;
                  const kotNumber = latestSnapshot ? latestSnapshot.kotNumber : 1;
                  const isOverdue = Date.now() - sentAt > 30 * 60 * 1000; // 30 mins

                  const itemsCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
                  const itemsSummary = `${itemsCount} item${itemsCount !== 1 ? 's' : ''} — ` + order.items.map(i => `${i.name} ×${i.quantity}`).join(', ');

                  return (
                    <div 
                      key={order.id} 
                      tabIndex={0}
                      data-kb-panel-order="inprogress"
                      onFocus={() => {
                        setFocusedZone('panel-inprogress');
                        setFocusedPanelOrderIndex(idx);
                      }}
                      className={clsx(
                        "bg-white border border-slate-100 rounded-[2rem] p-6 space-y-5 hover:border-amber-100 transition-all group shadow-sm hover:shadow-md focus:outline-none",
                        focusedZone === 'panel-inprogress' && focusedPanelOrderIndex === idx && "kb-focused"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-black text-slate-900 uppercase font-mono tracking-tighter">#{order.orderNumber}</h4>
                             {isOverdue && (
                               <span className="bg-rose-50 text-rose-500 text-[8px] font-black px-2 py-0.5 rounded-full border border-rose-100 uppercase tracking-widest animate-pulse">30+ min</span>
                             )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tight">
                            {order.customerName || 'Guest'} • {order.type === OrderType.DINE_IN && order.tableNumber ? `Table ${order.tableNumber}` : order.type}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 font-mono">{settings.currency}{(order.total || 0).toFixed(2)}</div>
                          <div className="text-[9px] text-amber-600 font-black uppercase tracking-tight mt-1">
                            {formatDistanceToNow(sentAt)} ago
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200/50 pb-1.5 flex justify-between">
                          <span>Items Matrix</span>
                          <span>KOT #{kotNumber}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 italic font-medium leading-relaxed">
                          {itemsSummary}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => retrieveOrder(order)}
                          className="flex-grow py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          Retrieve to Checkout
                        </button>
                        <button 
                          onClick={() => {
                            setCancellingOrder(order);
                            setCancellationReasonText('');
                          }}
                          className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] active:scale-95 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-slate-100 text-center shrink-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                To delete an in-progress order, go to Records page.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Retrieval Confirmation Modal */}
      {retrievalConfirmData && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white border border-slate-100 rounded-[3rem] p-12 max-w-md w-full shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100">
                <AlertCircle className="w-10 h-10 text-amber-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Active Buffer</h2>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  {retrievalConfirmData.status === 'in-progress' 
                    ? <>Your current cart has items. Hold current cart or discard it to retrieve this order <span className="text-slate-900 font-mono font-bold">#{retrievalConfirmData.orderNumber}</span>.</>
                    : <>Current cart contains uncommitted items. Preserve state by holding or discard to restore <span className="text-slate-900 font-mono font-bold">#{retrievalConfirmData.orderNumber}</span>.</>
                  }
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 pt-4">
                <button 
                  onClick={async () => {
                    await completeOrder('held');
                    retrieveOrder(retrievalConfirmData, true);
                  }}
                  className="w-full py-4 bg-slate-900 border border-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98]"
                >
                  {retrievalConfirmData.status === 'in-progress' ? 'Hold Current Cart' : 'Preserve Current Cart'}
                </button>
                <button 
                  onClick={() => {
                    clearCart();
                    retrieveOrder(retrievalConfirmData, true);
                  }}
                  className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-[0.98] shadow-sm"
                >
                  {retrievalConfirmData.status === 'in-progress' ? 'Discard Cart' : 'Discard Buffer'}
                </button>
                <button 
                  onClick={() => setRetrievalConfirmData(null)}
                  className="w-full py-4 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-[0.2em] transition-all"
                >
                  Abort Action
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Modifier Modal */}
      {modifierModalData && (
        <AnimatePresence>
          <ModifierModal
            item={modifierModalData.item}
            editingId={modifierModalData.editingId}
            initialModifiers={modifierModalData.initialModifiers}
            initialNotes={modifierModalData.initialNotes}
            onClose={() => setModifierModalData(null)}
            onConfirm={(modifiers, notes) => {
              if (modifierModalData.editingId) {
                updateCartItem(modifierModalData.editingId, modifiers, notes);
              } else {
                addToCart(modifierModalData.item, modifiers, notes);
              }
              setModifierModalData(null);
            }}
          />
        </AnimatePresence>
      )}

      {/* Deal Modal */}
      {dealModalData && (
        <AnimatePresence>
          <DealModal
            dealItem={dealModalData.dealItem}
            components={dealModalData.components}
            onClose={() => setDealModalData(null)}
            onConfirm={(finalComponents) => {
              addDealToCart(dealModalData.dealItem, finalComponents as any);
              setDealModalData(null);
              toast.success(`Bundle "${dealModalData.dealItem.name}" added to cart`);
            }}
          />
        </AnimatePresence>
      )}

      {/* Cancellation Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in text-black">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-12 max-w-md w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Cancel Order #{cancellingOrder.orderNumber}?
              </h2>
              <p className="text-slate-500 text-sm font-medium">
                Enter reason for cancellation:
              </p>
            </div>

            <div className="space-y-4">
              <textarea
                placeholder="e.g. Customer changed mind, Food waste - wrong order, Equipment failure..."
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-2xl p-4 text-xs focus:outline-none min-h-[100px] resize-none leading-relaxed transition-all font-medium text-slate-800"
                value={cancellationReasonText}
                onChange={(e) => setCancellationReasonText(e.target.value)}
              />

              <div className="space-y-1">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-red-600">Quick Examples:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["Customer changed mind", "Food waste - wrong order", "Equipment failure"].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setCancellationReasonText(ex)}
                      className="text-[9px] font-bold uppercase tracking-tight bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded-full transition-all cursor-pointer"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                type="button"
                onClick={() => {
                  setCancellingOrder(null);
                  setCancellationReasonText('');
                }}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-[0.98] cursor-pointer"
              >
                Back
              </button>
              <button 
                type="button"
                disabled={!cancellationReasonText.trim()}
                onClick={async () => {
                  const val = cancellationReasonText.trim();
                  if (!val) {
                    toast.error("Cancellation reason is required");
                    return;
                  }
                  await cancelOrder(cancellingOrder.id, val, activeCashierName);
                  setCancellingOrder(null);
                  setCancellationReasonText('');
                }}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-red-900/10 transition-all active:scale-[0.98] cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
