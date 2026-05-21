/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Printer, CheckCircle, User, CreditCard, Utensils, Send, RotateCcw, X, Clock, AlertCircle, Truck, ShieldCheck, Square, CheckSquare, Edit3 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useStore, showConfirmModal } from '../store/useStore';
import { MenuItem, OrderType, Order, OrderItem, KotSnapshot, OrderItemModifier } from '../types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { KitchenTicket, CustomerReceipt, DeltaKitchenTicket } from '../components/PrintComponents';
import ModifierModal from '../components/ModifierModal';

export default function POS() {
  const { 
    menuItems, categories, settings, addOrder, updateOrder, deleteOrder, orders,
    cart, setCart, clearCart, addToCart, updateQuantity, removeFromCart, updateCartItem,
    orderType, updateOrderType, customerName, setCustomerName, 
    tableNumber, setTableNumber, activeOrder, setActiveOrder,
    deliveryChargeWaived, setDeliveryChargeWaived,
    deliveryChargeWaivedReason, setDeliveryChargeWaivedReason,
    retrieveOrder: storeRetrieveOrder, cancelHeldOrder: storeCancelHeldOrder,
    kotSnapshots, addKotSnapshot, modifierGroups
  } = useStore();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isHeldPanelOpen, setIsHeldPanelOpen] = useState(false);
  const [retrievalConfirmData, setRetrievalConfirmData] = useState<Order | null>(null);
  const [unavailableItems, setUnavailableItems] = useState<string[]>([]);
  const [modifierModalData, setModifierModalData] = useState<{ 
    item: MenuItem; 
    editingId?: string; 
    initialModifiers?: OrderItemModifier[]; 
    initialNotes?: string;
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const kotRef = useRef<HTMLDivElement>(null);
  const deltaKotRef = useRef<HTMLDivElement>(null);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const modifierPrice = (item.modifiers || []).reduce((sum, mod) => sum + mod.additionalPrice, 0);
      return acc + ((item.price + modifierPrice) * item.quantity);
    }, 0);
  }, [cart]);
  
  const effectiveDeliveryCharge = useMemo(() => {
    if (orderType !== OrderType.DELIVERY || !settings.deliveryChargeEnabled) return 0;
    if (deliveryChargeWaived) return 0;
    return settings.deliveryChargeAmount;
  }, [orderType, settings, deliveryChargeWaived]);

  const taxAmount = useMemo(() => {
    const taxableAmount = settings.deliveryChargeTaxable 
      ? subtotal + effectiveDeliveryCharge 
      : subtotal;
    return (taxableAmount * settings.taxPercentage) / 100;
  }, [subtotal, effectiveDeliveryCharge, settings]);

  const total = subtotal + effectiveDeliveryCharge + taxAmount;

  const heldOrders = useMemo(() => orders.filter(o => o.status === 'held'), [orders]);

  const handleAddToCart = (item: MenuItem) => {
    const hasModifiers = modifierGroups.some(g => String(g.menuItemId) === String(item.id));
    if (hasModifiers) {
      setModifierModalData({ item });
    } else {
      addToCart(item);
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
          deliveryChargeWaived,
          deliveryChargeWaivedReason: deliveryChargeWaived ? deliveryChargeWaivedReason : undefined,
          updatedAt: Date.now(),
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
          deliveryChargeWaived,
          deliveryChargeWaivedReason: deliveryChargeWaived ? deliveryChargeWaivedReason : undefined,
          customerName: customerName || undefined,
          tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
          status: 'in-progress',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          kotPrinted: true,
        };
        await addOrder(orderToSync);
        setActiveOrder(orderToSync);
      }

      if (settings.autoPrintKOT) {
        if (isFirstKOT) {
          handleKOTPrint();
        } else {
          handleDeltaKOTPrint();
        }
      }

      // Save snapshot AFTER printing to ensure print component has the correct deltas
      const kotNumber = (lastSnapshot?.kotNumber || 0) + 1;
      await addKotSnapshot({
        orderId: orderToSync.id,
        kotNumber,
        sentAt: Date.now(),
        items: JSON.parse(JSON.stringify(cart))
      });

      toast.success(isFirstKOT ? 'Order sent to kitchen' : 'Kitchen update sent');
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
        if (!activeOrder || !lastSnapshot) {
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
        deliveryChargeWaived,
        deliveryChargeWaivedReason: deliveryChargeWaived ? deliveryChargeWaivedReason : undefined,
        customerName: customerName || undefined,
        tableNumber: orderType === OrderType.DINE_IN ? tableNumber : undefined,
        status: status,
        createdAt: activeOrder?.createdAt || Date.now(),
        updatedAt: Date.now(),
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
    if (cart.length > 0 && (!activeOrder || !lastSnapshot)) {
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
              <span className="text-text-muted font-medium ml-2 text-xs tracking-wide">| Terminal 01</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 items-stretch">
            {filteredItems.map(item => {
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
                    inCart ? "border-accent ring-2 ring-accent/10 shadow-md" : "border-border-light shadow-sm"
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
                    <h3 className="font-semibold text-text-primary text-sm leading-[1.3] line-clamp-2 mb-2">
                      {item.name}
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
                   Resuming Order #{activeOrder.orderNumber}
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
              {cart.map(item => {
                const itemSnapshot = lastSnapshot?.items.find(si => si.menuItemId === item.menuItemId);
                const isNew = !itemSnapshot;
                const isIncreased = itemSnapshot && item.quantity > itemSnapshot.quantity;
                const isSent = !!itemSnapshot;
                const isActive = (isNew || isIncreased);

                return (
                  <div key={item.id} className={clsx(
                    "min-h-[56px] px-4 py-3 transition-all relative flex flex-col gap-2",
                    isActive ? "bg-accent/[0.03]" : "bg-bg-surface"
                  )}>
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
                        {(item.modifiers || []).map((m: any, mIdx: number) => (
                          <span key={mIdx} className="text-[12px] text-text-muted leading-relaxed">
                            + {m.label}
                          </span>
                        ))}
                      </div>
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
                        <button 
                          onClick={() => handleEditModifiers(item)}
                          className="text-[10px] font-bold text-accent uppercase tracking-widest hover:text-accent-strong transition-colors"
                        >
                          Customize
                        </button>
                        <div className="w-px h-3 bg-border-light"></div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-text-placeholder hover:text-danger transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM: Totals and Actions */}
        <div className="flex-none bg-bg-surface border-t border-border-light shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Delivery Configuration Row */}
          {orderType === OrderType.DELIVERY && settings.deliveryChargeEnabled && (
            <div className="px-5 py-3 bg-bg-app/30 border-b border-border-light">
               <div className="flex items-center justify-between gap-4">
                 <button 
                  onClick={() => setDeliveryChargeWaived(!deliveryChargeWaived)}
                  className="flex items-center gap-2 group outline-none"
                 >
                  <div className={clsx(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    deliveryChargeWaived ? "bg-accent border-accent" : "bg-white border-border-medium group-hover:border-border-strong"
                  )}>
                    {deliveryChargeWaived && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">Waive Service Fee</span>
                 </button>
                 
                 <div className="flex items-center gap-2">
                   <Truck className="w-3.5 h-3.5 text-text-placeholder" />
                   <span className={clsx(
                     "text-xs font-bold tabular-nums",
                     deliveryChargeWaived ? "text-text-disabled line-through" : "text-text-primary"
                   )}>
                    {settings.currency}{(settings?.deliveryChargeAmount || 0).toFixed(2)}
                   </span>
                 </div>
               </div>

               {deliveryChargeWaived && (
                 <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Reason for waiver..."
                      className="w-full bg-bg-surface border border-border-light rounded px-2 py-1 text-[10px] text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent"
                      value={deliveryChargeWaivedReason}
                      onChange={(e) => setDeliveryChargeWaivedReason(e.target.value)}
                    />
                 </div>
               )}
            </div>
          )}

          {/* Pricing Totals */}
          <div className="px-5 py-3 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-medium text-text-secondary">
              <span className="uppercase tracking-tight opacity-70">Subtotal</span>
              <span className="tabular-nums font-bold font-mono">{settings.currency}{(subtotal || 0).toFixed(2)}</span>
            </div>
            {orderType === OrderType.DELIVERY && settings.deliveryChargeEnabled && !deliveryChargeWaived && (
              <div className="flex justify-between items-center text-[10px] font-medium text-text-muted italic">
                <span className="uppercase tracking-tight">{settings.deliveryChargeLabel}</span>
                <span className="tabular-nums font-bold">+{settings.currency}{(settings?.deliveryChargeAmount || 0).toFixed(2)}</span>
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
                {activeOrder ? 'Resend' : 'Kitchen'}
                {lastSnapshot && (
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full border border-white font-black shadow-md">
                     {lastSnapshot.kotNumber}
                  </span>
                )}
              </button>
              <button
                onClick={() => handlePrintReceiptReceiptCheck()}
                className="h-[44px] bg-bg-surface-2 border border-border-light hover:bg-bg-app rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase text-text-primary tracking-widest shadow-sm transition-colors"
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
                disabled={cart.length === 0}
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
                deliveryChargeWaived,
                deliveryChargeWaivedReason: deliveryChargeWaived ? deliveryChargeWaivedReason : undefined,
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }} 
              settings={settings} 
            />
          )}
        </div>
        <div ref={kotRef}>
          {(activeOrder || cart.length > 0) && (
            <KitchenTicket 
              order={activeOrder || {
                id: 'preview',
                orderNumber: 'PREVIEW',
                items: cart,
                subtotal,
                taxAmount,
                total,
                type: orderType,
                customerName,
                tableNumber,
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }} 
              settings={settings}
              kotNumber={lastSnapshot?.kotNumber || 1}
            />
          )}
        </div>
        <div ref={deltaKotRef}>
          {activeOrder && deltas && (
            <DeltaKitchenTicket
               order={activeOrder}
               settings={settings}
               kotNumber={lastSnapshot ? lastSnapshot.kotNumber + 1 : 1}
               totalKots={lastSnapshot ? lastSnapshot.kotNumber + 1 : 1}
               lastSentAt={lastSnapshot?.sentAt}
               deltas={deltas}
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
                heldOrders.map(order => {
                  const isOverdue = isAfter(subHours(new Date(), 2), new Date(order.createdAt));
                  return (
                    <div key={order.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-5 hover:border-blue-200 transition-all group shadow-sm hover:shadow-md">
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
                          onClick={() => cancelHeldOrder(order.id, order.orderNumber)}
                          className="px-5 py-3 bg-white border border-slate-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 rounded-2xl transition-all active:scale-95"
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
                  Current cart contains uncommitted items. Preserve state by holding or discard to restore <span className="text-slate-900 font-mono font-bold">#{retrievalConfirmData.orderNumber}</span>.
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
                  Preserve Current Cart
                </button>
                <button 
                  onClick={() => {
                    clearCart();
                    retrieveOrder(retrievalConfirmData, true);
                  }}
                  className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-[0.98] shadow-sm"
                >
                  Discard Buffer
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
    </div>
  );
}
