/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
import { 
  Truck,
  Search, 
  Calendar, 
  Filter, 
  FileText, 
  ChevronRight, 
  Trash2, 
  ArrowUpRight,
  ShoppingBag,
  TrendingUp,
  Clock,
  Printer,
  Edit2,
  X,
  Check,
  ChevronLeft,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Lock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Package
} from 'lucide-react';
import { useStore, showConfirmModal, DEFAULT_SETTINGS } from '../store/useStore';
import { Order, OrderType, OrderItem, MenuItem } from '../types';
import { PROTECTION_PASSWORD } from '../constants';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { formatTime12Hour, formatDateTime12Hour } from '../utils/timeFormat';
import { getBusinessDate, getBusinessDayStart, getBusinessDayEnd, getBusinessDayRange, convertCustomDateRange, getCachedCutoff, getBusinessDateDisplay } from '../utils/businessDayCalculation';
import { db } from '../lib/db';

const ITEMS_PER_PAGE = 25;

import { useLiveQuery } from 'dexie-react-hooks';

export default function Records() {
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const menuItems = useLiveQuery(() => db.menuItems.toArray()) || [];
  const settingsObj = useLiveQuery(() => db.settings.where({ key: 'main' }).first());
  const settings = settingsObj?.value || DEFAULT_SETTINGS;
  const kotSnapshots = useLiveQuery(() => db.kotSnapshots.toArray()) || [];
  const cashiers = useLiveQuery(() => db.cashiers.toArray()) || [];

  const { 
    deleteOrder, updateOrder, restoreOrder,
    cart, clearCart, retrieveOrder: storeRetrieveOrder, 
    cancelHeldOrder: storeCancelHeldOrder, activeOrder, addOrder,
    orderType, customerName, tableNumber,
    deliveryChargeWaived, deliveryChargeWaivedReason, user
  } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<OrderType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'held' | 'in-progress' | 'all'>('completed');
  const [selectedCashier, setSelectedCashier] = useState<string | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Order>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string>('all');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // Close dropdown on clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = document.getElementById('item-filter-dropdown-container');
      if (container && !container.contains(event.target as Node)) {
        setIsItemDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedItem = useMemo(() => {
    if (selectedItemId === 'all') return null;
    return menuItems.find(item => String(item.id) === String(selectedItemId)) || null;
  }, [selectedItemId, menuItems]);

  const dropdownItems = useMemo(() => {
    const active = menuItems.filter(item => item.isActive || item.isDeal);
    return [...active].sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems]);
  const [retrievalConfirmData, setRetrievalConfirmData] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  
  // Audit Log states
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [shakeModal, setShakeModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  const handlePasswordModalConfirm = () => {
    if (passwordValue === PROTECTION_PASSWORD) {
      setPasswordError('');
      setOpenPasswordModal(false);
      setPasswordValue('');
      setShowPassword(false);
      setShowAuditLog(true);
    } else {
      setPasswordError('Incorrect password. Action not allowed.');
      setPasswordValue('');
      setShakeModal(true);
    }
  };

  const handlePasswordModalCancel = () => {
    setOpenPasswordModal(false);
    setPasswordValue('');
    setShowPassword(false);
    setPasswordError('');
  };

  // Date range filter states
  const [selectedRange, setSelectedRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Audit Log Independent States (persisted via localStorage)
  const [auditSelectedRange, setAuditSelectedRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>(() => {
    const saved = localStorage.getItem('auditSelectedRange');
    return (saved as any) || 'today';
  });
  const [auditCustomStart, setAuditCustomStart] = useState<Date | null>(() => {
    const saved = localStorage.getItem('auditCustomStart');
    return saved ? new Date(saved) : null;
  });
  const [auditCustomEnd, setAuditCustomEnd] = useState<Date | null>(() => {
    const saved = localStorage.getItem('auditCustomEnd');
    return saved ? new Date(saved) : null;
  });

  // Sync Audit Log states to localStorage
  useEffect(() => {
    localStorage.setItem('auditSelectedRange', auditSelectedRange);
  }, [auditSelectedRange]);

  useEffect(() => {
    if (auditCustomStart) {
      localStorage.setItem('auditCustomStart', auditCustomStart.toISOString());
    } else {
      localStorage.removeItem('auditCustomStart');
    }
  }, [auditCustomStart]);

  useEffect(() => {
    if (auditCustomEnd) {
      localStorage.setItem('auditCustomEnd', auditCustomEnd.toISOString());
    } else {
      localStorage.removeItem('auditCustomEnd');
    }
  }, [auditCustomEnd]);

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomStart(e.target.value);
    setSelectedRange('custom');
    setCurrentPage(1);
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomEnd(e.target.value);
    setSelectedRange('custom');
    setCurrentPage(1);
  };

  const selectQuickRange = (range: 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'all') => {
    setSelectedRange(range);
    setCurrentPage(1);
  };

  // Compute calculated date boundaries for display
  const dateBounds = useMemo(() => {
    const cutoff = getCachedCutoff();
    if (selectedRange === 'all') {
      return { start: null, end: null };
    }
    if (selectedRange === 'custom') {
      if (!customStart || !customEnd) {
        return { start: null, end: null };
      }
      const { startDate, endDate } = convertCustomDateRange(customStart, customEnd, cutoff);
      return { start: startDate, end: endDate };
    }
    const { startDate, endDate } = getBusinessDayRange(selectedRange, cutoff);
    return { start: startDate, end: endDate };
  }, [selectedRange, customStart, customEnd]);

  // Compute calculated date boundaries for Audit Log display
  const auditDateBounds = useMemo(() => {
    const cutoff = getCachedCutoff();
    if (auditSelectedRange === 'all') {
      return { start: null, end: null };
    }
    if (auditSelectedRange === 'custom') {
      if (!auditCustomStart || !auditCustomEnd) {
        return { start: null, end: null };
      }
      const { startDate, endDate } = convertCustomDateRange(auditCustomStart, auditCustomEnd, cutoff);
      return { start: startDate, end: endDate };
    }
    const { startDate, endDate } = getBusinessDayRange(auditSelectedRange as any, cutoff);
    return { start: startDate, end: endDate };
  }, [auditSelectedRange, auditCustomStart, auditCustomEnd]);

  const [queriedOrders, setQueriedOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      let cutoff = '04:00';
      try {
        const entry = await db.settings.where({ key: 'businessDayCutoff' }).first();
        if (entry && entry.value) {
          cutoff = entry.value;
        }
      } catch (err) {
        console.warn('Failed to read businessDayCutoff from settings:', err);
      }
      const [cutoffHour, cutoffMinute] = cutoff.split(':').map(Number);
      
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      if (selectedRange === 'custom') {
        if (customStart && customEnd) {
          const range = convertCustomDateRange(customStart, customEnd, cutoff);
          startDate = range.startDate;
          endDate = range.endDate;
        }
      } else if (selectedRange !== 'all') {
        const range = getBusinessDayRange(selectedRange, cutoff);
        startDate = range.startDate;
        endDate = range.endDate;
      }
      
      let rawOrders: Order[] = [];
      try {
        rawOrders = await db.orders.toArray();
      } catch (err) {
        console.error('Failed to query orders from Dexie:', err);
        rawOrders = [...orders];
      }
      
      let filtered = rawOrders;
      if (startDate && endDate) {
        filtered = rawOrders.filter(order => {
          // Get the actual timestamp when order was completed
          const orderTimestamp = order.completedAt || order.createdAt || Date.now();
          
          // Which business day does this timestamp belong to?
          const orderDate = new Date(orderTimestamp);
          const cutoffTime = new Date(
            orderDate.getFullYear(),
            orderDate.getMonth(),
            orderDate.getDate(),
            cutoffHour,
            cutoffMinute,
            0,
            0
          );
          
          // Determine which business day this order belongs to
          let orderBusinessDayStart: number;
          
          if (orderTimestamp >= cutoffTime.getTime()) {
            // Order is after cutoff = this calendar day's business day
            orderBusinessDayStart = cutoffTime.getTime();
          } else {
            // Order is before cutoff = previous calendar day's business day
            const prevDay = new Date(
              orderDate.getFullYear(),
              orderDate.getMonth(),
              orderDate.getDate() - 1,
              cutoffHour,
              cutoffMinute,
              0,
              0
            );
            orderBusinessDayStart = prevDay.getTime();
          }
          
          // Now compare: is this order's business day start within the range?
          return orderBusinessDayStart >= startDate!.getTime() && 
                 orderBusinessDayStart <= endDate!.getTime();
        });
        
        console.log('Filter:', selectedRange);
        console.log('Cutoff:', cutoff);
        console.log('Start:', startDate);
        console.log('End:', endDate);
        console.log('Results:', filtered.length);
      } else {
        console.log('Filter:', selectedRange);
        console.log('Cutoff:', cutoff);
        console.log('Start:', 'All Time');
        console.log('End:', 'All Time');
        console.log('Results:', filtered.length);
      }
      
      // Sort by completedAt or createdAt reverse
      filtered.sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
      
      setQueriedOrders(filtered);
    };
    
    fetchOrders();
  }, [orders, selectedRange, customStart, customEnd]);

  const orderContainsSelectedItem = (order: Order, selItem: MenuItem) => {
    return order.items.some(item => {
      const isIdMatch = String(item.menuItemId) === String(selItem.id);
      if (selItem.isDeal) {
        return isIdMatch && !!item.isDeal;
      } else {
        return isIdMatch && !item.isDeal;
      }
    });
  };

  // Keep overall completed range orders for overall total revenue (used for item % contribution)
  const overallCompletedRangeOrders = useMemo(() => {
    return queriedOrders.filter(o => o.status === 'completed' && !o.isDeleted && !o.isCancelled);
  }, [queriedOrders]);

  const overallTotalRevenue = useMemo(() => {
    return overallCompletedRangeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [overallCompletedRangeOrders]);

  // Keep date-filtered NON-deleted orders for calculations (filtered by item if selected)
  const rangeOrders = useMemo(() => {
    const nonDeleted = queriedOrders.filter(order => !order.isDeleted);
    if (selectedItem) {
      return nonDeleted.filter(order => orderContainsSelectedItem(order, selectedItem));
    }
    return nonDeleted;
  }, [queriedOrders, selectedItem]);

  // Keep date-filtered deleted orders for calculations (filtered by item if selected)
  const deletedRangeOrders = useMemo(() => {
    const deleted = queriedOrders.filter(order => order.isDeleted);
    if (selectedItem) {
      return deleted.filter(order => orderContainsSelectedItem(order, selectedItem));
    }
    return deleted;
  }, [queriedOrders, selectedItem]);

  const deletedCount = useMemo(() => {
    return deletedRangeOrders.length;
  }, [deletedRangeOrders]);

  const totalValueDeleted = useMemo(() => {
    return deletedRangeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [deletedRangeOrders]);

  // Item-wise stats calculation for the selected item (if any) using unfiltered completed range orders
  const itemStats = useMemo(() => {
    if (!selectedItem) return null;
    
    let quantitySold = 0;
    let itemRevenue = 0;
    
    overallCompletedRangeOrders.forEach(order => {
      order.items.forEach(orderItem => {
        const isIdMatch = String(orderItem.menuItemId) === String(selectedItem.id);
        const isTypeMatch = selectedItem.isDeal ? !!orderItem.isDeal : !orderItem.isDeal;
        
        if (isIdMatch && isTypeMatch) {
          const modifierPrice = (orderItem.modifiers || []).reduce((sum, mod) => sum + mod.additionalPrice, 0);
          quantitySold += orderItem.quantity || 0;
          itemRevenue += (orderItem.price + modifierPrice) * (orderItem.quantity || 0);
        }
      });
    });
    
    const percentageOfTotal = overallTotalRevenue > 0 ? (itemRevenue / overallTotalRevenue) * 100 : 0;
    
    return {
      quantitySold,
      itemRevenue,
      percentageOfTotal
    };
  }, [overallCompletedRangeOrders, selectedItem, overallTotalRevenue]);

  // Calculations derived dynamically from selected range
  const rangeStats = useMemo(() => {
    const completedOrders = rangeOrders.filter(o => o.status === 'completed' && !o.isDeleted && !o.isCancelled);
    const totalOrders = completedOrders.length;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalTax = completedOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const totalDeliveryCharges = completedOrders.reduce((sum, o) => sum + (o.deliveryCharge || 0), 0);
    const totalDiscounts = completedOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);

    // Top selling item by quantity sold
    const itemQuantities: { [name: string]: number } = {};
    completedOrders.forEach(order => {
      order.items.forEach(it => {
        const name = it.name;
        itemQuantities[name] = (itemQuantities[name] || 0) + (it.quantity || 0);
      });
    });

    let topItemName = '';
    let topItemQty = 0;
    Object.entries(itemQuantities).forEach(([name, qty]) => {
      if (qty > topItemQty) {
        topItemQty = qty;
        topItemName = name;
      }
    });

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      totalTax,
      totalDeliveryCharges,
      totalDiscounts,
      topItem: topItemQty > 0 ? { name: topItemName, quantity: topItemQty } : null
    };
  }, [rangeOrders]);

  // Helper to determine business day start time for any order timestamp based on 4 AM cutoff
  const getOrderBusinessDayStart = (timestamp: number) => {
    const orderDate = new Date(timestamp);
    const cutoffTime = new Date(
      orderDate.getFullYear(),
      orderDate.getMonth(),
      orderDate.getDate(),
      4, 0, 0, 0
    );
    
    if (timestamp >= cutoffTime.getTime()) {
      return cutoffTime.getTime();
    } else {
      const prevDay = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate() - 1,
        4, 0, 0, 0
      );
      return prevDay.getTime();
    }
  };

  const deletedOrders = useMemo(() => {
    return orders.filter(order => order.isDeleted);
  }, [orders]);

  const cancelledKots = useMemo(() => {
    return orders.filter(order => order.isCancelled);
  }, [orders]);

  const auditFilteredDeletedOrders = useMemo(() => {
    if (!auditDateBounds.start || !auditDateBounds.end) {
      return deletedOrders;
    }
    const startMs = auditDateBounds.start.getTime();
    const endMs = auditDateBounds.end.getTime();
    return deletedOrders.filter(order => {
      const orderTimestamp = order.completedAt || order.createdAt || Date.now();
      const orderBusinessDayStart = getOrderBusinessDayStart(orderTimestamp);
      return orderBusinessDayStart >= startMs && orderBusinessDayStart <= endMs;
    });
  }, [deletedOrders, auditDateBounds]);

  const auditFilteredCancelledKots = useMemo(() => {
    if (!auditDateBounds.start || !auditDateBounds.end) {
      return cancelledKots;
    }
    const startMs = auditDateBounds.start.getTime();
    const endMs = auditDateBounds.end.getTime();
    return cancelledKots.filter(kot => {
      const kotTimestamp = kot.cancelledAt || kot.createdAt || Date.now();
      const kotBusinessDayStart = getOrderBusinessDayStart(kotTimestamp);
      return kotBusinessDayStart >= startMs && kotBusinessDayStart <= endMs;
    });
  }, [cancelledKots, auditDateBounds]);

  const auditFilteredNormalCompletedOrders = useMemo(() => {
    const normalCompleted = orders.filter(order => !order.isDeleted && !order.isCancelled && order.status === 'completed');
    if (!auditDateBounds.start || !auditDateBounds.end) {
      return normalCompleted;
    }
    const startMs = auditDateBounds.start.getTime();
    const endMs = auditDateBounds.end.getTime();
    return normalCompleted.filter(order => {
      const orderTimestamp = order.completedAt || order.createdAt || Date.now();
      const orderBusinessDayStart = getOrderBusinessDayStart(orderTimestamp);
      return orderBusinessDayStart >= startMs && orderBusinessDayStart <= endMs;
    });
  }, [orders, auditDateBounds]);

  const auditLogStats = useMemo(() => {
    const cancelledInPeriod = auditFilteredCancelledKots;
    const deletedInPeriod = auditFilteredDeletedOrders;
    const normalCompletedInPeriodCount = auditFilteredNormalCompletedOrders.length;

    const cancelledCount = cancelledInPeriod.length;
    const cancelledTotalValue = cancelledInPeriod.reduce((sum, o) => sum + (o.total || 0), 0);
    
    const deletedCount = deletedInPeriod.length;
    const deletedTotalValue = deletedInPeriod.reduce((sum, o) => sum + (o.total || 0), 0);

    const cancelledRate = normalCompletedInPeriodCount > 0 ? (cancelledCount / normalCompletedInPeriodCount) * 100 : 0;
    const deletedRate = normalCompletedInPeriodCount > 0 ? (deletedCount / normalCompletedInPeriodCount) * 100 : 0;

    return {
      cancelledInPeriod,
      deletedInPeriod,
      cancelledCount,
      cancelledTotalValue,
      deletedCount,
      deletedTotalValue,
      normalCompletedCount: normalCompletedInPeriodCount,
      cancelledRate,
      deletedRate
    };
  }, [auditFilteredCancelledKots, auditFilteredDeletedOrders, auditFilteredNormalCompletedOrders]);

  const toggleRowExpanded = (orderId: string) => {
    setExpandedRowIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const filteredOrders = useMemo(() => {
    return queriedOrders.filter(order => {
      if (order.isCancelled) return false;
      if (order.isDeleted) return false;

      if (selectedItem && !orderContainsSelectedItem(order, selectedItem)) {
        return false;
      }

      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cashierName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || order.type === selectedType;
      
      const matchesCashier = selectedCashier === 'all' || 
        (selectedCashier === 'none' && !order.cashierName) ||
        (order.cashierName === selectedCashier);

      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus && matchesCashier;
    });
  }, [queriedOrders, searchTerm, selectedType, selectedStatus, selectedCashier, selectedItem]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleDeleteRecord = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingOrder(order);
    setDeleteReason('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingOrder) return;
    if (deleteReason.trim().length < 5) {
      toast.error('Reason for deletion must be at least 5 characters.');
      return;
    }

    const loggedInEmail = user?.email || 'operator@restaurant.com';
    await deleteOrder(deletingOrder.id, deleteReason.trim(), loggedInEmail);

    if (selectedOrder?.id === deletingOrder.id) {
      setSelectedOrder(null);
    }

    setDeletingOrder(null);
    setDeleteReason('');
  };

  const handleRestoreRecord = async (order: Order) => {
    const confirmed = await showConfirmModal({
      title: `Restore Order #${order.orderNumber}?`,
      message: `It will return to its original status (${order.status.toUpperCase()}).`,
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      isDanger: false
    });
    if (confirmed) {
      await restoreOrder(order.id);
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({
          ...order,
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
          deletedBy: null
        });
      }
    }
  };

  const handleStartEdit = () => {
    if (!selectedOrder) return;
    setEditValues({
      customerName: selectedOrder.customerName || '',
      tableNumber: selectedOrder.tableNumber || '',
      notes: selectedOrder.notes || '',
      type: selectedOrder.type,
      status: selectedOrder.status,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    const updatedOrder: Order = {
      ...selectedOrder,
      ...editValues as any,
      updatedAt: Date.now(),
    };
    await updateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setIsEditing(false);
    toast.success('Order updated successfully');
  };

  const handleRetrieveOrder = async (order: Order, force = false) => {
    if (cart.length > 0 && !force) {
      setRetrievalConfirmData(order);
      return;
    }

    storeRetrieveOrder(order, menuItems);
    navigate('/');
    toast.info(`Retrieved order #${order.orderNumber}`);
  };

  const handleCancelHeldOrder = async (id: string, orderNumber: string) => {
    const confirmed = await showConfirmModal({
      title: 'Cancel Held Order',
      message: `Cancel this held order #${orderNumber}? This cannot be undone.`,
      confirmLabel: 'Cancel Order',
      cancelLabel: 'Keep',
      isDanger: true
    });
    if (confirmed) {
      await storeCancelHeldOrder(id);
      if (selectedOrder?.id === id) setSelectedOrder(null);
      toast.success(`Order #${orderNumber} cancelled`);
    }
  };

  const holdAndRetrieve = async (toRetrieve: Order) => {
    // Hold current cart
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    
    let effectiveDeliveryCharge = 0;
    if (orderType === OrderType.DELIVERY && settings.deliveryChargeEnabled && !deliveryChargeWaived) {
      effectiveDeliveryCharge = settings.deliveryChargeAmount;
    }

    const taxableAmount = settings.deliveryChargeTaxable 
      ? subtotal + effectiveDeliveryCharge 
      : subtotal;
    const taxAmount = (taxableAmount * settings.taxPercentage) / 100;
    const total = subtotal + effectiveDeliveryCharge + taxAmount;

    const order: Order = {
      id: activeOrder?.id || crypto.randomUUID(),
      orderNumber: activeOrder?.orderNumber || `${Date.now().toString().slice(-6)}`,
      items: [...cart],
      subtotal,
      taxAmount,
      total,
      deliveryCharge: effectiveDeliveryCharge,
      deliveryChargeWaived,
      deliveryChargeWaivedReason: deliveryChargeWaived ? deliveryChargeWaivedReason : undefined,
      type: orderType,
      customerName: customerName || undefined,
      tableNumber: tableNumber || undefined,
      status: 'held',
      createdAt: activeOrder?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (activeOrder) {
      await updateOrder(order);
    } else {
      await addOrder(order);
    }
    
    handleRetrieveOrder(toRetrieve, true);
  };

  const orderSnapshots = useMemo(() => {
    if (!selectedOrder) return [];
    return kotSnapshots.filter(s => s.orderId === selectedOrder.id).sort((a, b) => a.sentAt - b.sentAt);
  }, [kotSnapshots, selectedOrder]);

  return (
    <div className="flex h-full animate-fade-in divide-x divide-border-light bg-bg-app">
      <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 overflow-y-auto custom-scrollbar">
        <header className="mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-base font-bold text-text-primary uppercase tracking-tight leading-none">Journal Audit</h1>
              <p className="text-text-muted text-[13px] font-medium mt-2">Historical ledger and operational trace documentation</p>
            </div>
            <div className="flex gap-4 animate-fade-in">
              <button 
                onClick={() => {
                  setPasswordValue('');
                  setPasswordError('');
                  setOpenPasswordModal(true);
                }}
                title="View deletion history (password protected)"
                className="px-5 py-2.5 bg-bg-surface border border-red-200 text-text-primary rounded-md hover:bg-red-50/45 transition-all flex items-center gap-3 shadow-sm cursor-pointer"
              >
                <Lock className="w-4 h-4 text-red-550" />
                <span className="text-[11px] uppercase font-bold tracking-widest leading-none text-red-600">Audit Log</span>
              </button>
            </div>
          </div>

          {/* Date Range Filter Bar */}
          <div className="bg-bg-surface border border-border-light rounded-xl p-4 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
            {/* Quick Range Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest mr-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Period:
              </span>
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'last-month', label: 'Last Month' },
                { id: 'all', label: 'All Time' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => selectQuickRange(pill.id as any)}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border",
                    selectedRange === pill.id
                      ? "bg-accent border-accent text-white shadow-sm font-black"
                      : "bg-bg-surface-2 border-border-light text-text-muted hover:text-text-secondary hover:bg-bg-surface-2/80"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Custom Range Date Pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={clsx(
                "text-[11px] font-bold uppercase tracking-widest transition-colors",
                selectedRange === 'custom' ? "text-accent" : "text-text-muted"
              )}>
                Custom:
              </span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="date"
                    value={customStart}
                    onChange={handleCustomStartChange}
                    className={clsx(
                      "px-3 py-1.5 text-[11px] font-mono font-bold bg-bg-surface-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all pointer-events-auto cursor-pointer",
                      selectedRange === 'custom' ? "border-accent/50 text-text-primary" : "border-border-light text-text-muted"
                    )}
                  />
                </div>
                <span className="text-text-muted text-xs font-bold uppercase tracking-widest">to</span>
                <div className="relative">
                  <input
                    type="date"
                    value={customEnd}
                    onChange={handleCustomEndChange}
                    className={clsx(
                      "px-3 py-1.5 text-[11px] font-mono font-bold bg-bg-surface-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all pointer-events-auto cursor-pointer",
                      selectedRange === 'custom' ? "border-accent/50 text-text-primary" : "border-border-light text-text-muted"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {selectedItem && (
            <div className="mb-8 bg-accent/5 border border-accent/20 p-5 rounded-xl shadow-sm">
              <div className="text-[11px] font-bold text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Item-wise Financial Performance: {selectedItem.name} {selectedItem.isDeal ? '(Deal)' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Quantity Sold */}
                <div className="card-main p-6 border-l-4 border-l-accent bg-bg-surface">
                  <div className="flex items-center gap-3 mb-2">
                    <Package className="w-4 h-4 text-accent" />
                    <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Quantity Sold</span>
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                    {itemStats ? itemStats.quantitySold : 0} UNITS
                  </div>
                </div>

                {/* Card 2: Item Revenue */}
                <div className="card-main p-6 border-l-4 border-l-success bg-bg-surface">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">
                      Revenue from {selectedItem.name}
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                    {settings.currency}{itemStats ? itemStats.itemRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                </div>

                {/* Card 3: % of Total Revenue */}
                <div className="card-main p-6 border-l-4 border-l-purple-500 bg-bg-surface">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-purple-500 text-sm font-black font-mono leading-none">%</span>
                    <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">% of Total Revenue</span>
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                    {itemStats ? itemStats.percentageOfTotal.toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recalculating Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-6 mb-10">
            {/* Total Revenue */}
            <div className="card-main p-4 md:p-6 border-l-4 border-l-success">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Revenue</span>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Total Orders */}
            <div className="card-main p-4 md:p-6 border-l-4 border-l-accent">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className="w-4 h-4 text-accent" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Orders</span>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {rangeStats.totalOrders}
              </div>
            </div>

            {/* Average Order Value */}
            <div className="card-main p-4 md:p-6 border-l-4 border-l-warning">
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpRight className="w-4 h-4 text-warning" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">AOV (Mean)</span>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.averageOrderValue.toFixed(2)}
              </div>
            </div>

            {/* Total Tax Collected */}
            <div className="card-main p-4 md:p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-purple-500" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Tax Collected</span>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Total Delivery Charges (only if > 0) */}
            {rangeStats.totalDeliveryCharges > 0 && (
              <div className="card-main p-4 md:p-6 border-l-4 border-l-orange-500">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="w-4 h-4 text-orange-500" />
                  <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Delivery Charges</span>
                </div>
                <div className="text-xl md:text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                  {settings.currency}{rangeStats.totalDeliveryCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Total Discounts Given (only if > 0) */}
            {rangeStats.totalDiscounts > 0 && (
              <div className="card-main p-4 md:p-6 border-l-4 border-l-danger">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-4 h-4 text-danger" />
                  <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Discounts Given</span>
                </div>
                <div className="text-xl md:text-2xl font-extrabold text-danger font-mono tracking-tighter">
                  {settings.currency}{rangeStats.totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Top Selling Item */}
            <div className="card-main p-4 md:p-6 border-l-4 border-l-teal-500">
              <div className="flex items-center gap-3 mb-2">
                <Check className="w-4 h-4 text-teal-500" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Top Selling Item</span>
              </div>
              {rangeStats.topItem ? (
                <div>
                  <div className="text-sm md:text-base font-extrabold text-text-primary uppercase truncate" title={rangeStats.topItem.name}>
                    {rangeStats.topItem.name}
                  </div>
                  <div className="text-[10px] md:text-[11px] font-mono text-text-muted font-bold uppercase tracking-wider mt-0.5">
                    Sold: {rangeStats.topItem.quantity} units
                  </div>
                </div>
              ) : (
                <div className="text-xl md:text-2xl font-extrabold text-text-muted font-mono tracking-tighter">—</div>
              )}
            </div>
          </div>

          {/* Showing Record Count */}
          <div className="flex items-center mb-4 px-1">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
              {selectedItem ? (
                <>
                  Showing {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} containing{' '}
                  <span className="text-accent underline decoration-dotted font-black">{selectedItem.name}</span>
                </>
              ) : (
                `Showing ${filteredOrders.length} ${filteredOrders.length === 1 ? 'order' : 'orders'}`
              )}
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ledger by order ID, customer or cashier..."
                className="input-field pl-[42px] font-mono uppercase tracking-tight"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Type</span>
                <select
                  value={selectedType}
                  onChange={(e) => { setSelectedType(e.target.value as any); setCurrentPage(1); }}
                  className="bg-bg-surface-2 border border-border-light text-text-primary px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider outline-none focus:border-accent cursor-pointer min-w-[120px]"
                >
                  <option value="all">All Types</option>
                  <option value="dine-in">Dine In</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>

              {/* Cashier Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Cashier</span>
                <select
                  value={selectedCashier}
                  onChange={(e) => { setSelectedCashier(e.target.value); setCurrentPage(1); }}
                  className="bg-bg-surface-2 border border-border-light text-text-primary px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider outline-none focus:border-accent cursor-pointer min-w-[140px]"
                >
                  <option value="all">All Cashiers</option>
                  <option value="none">No Cashier</option>
                  {/* Dynamic set of completed/held cashiers */}
                  {Array.from(new Set(orders.map(o => o.cashierName).filter(Boolean))).map(name => (
                    <option key={name} value={name!}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Item Filter Dropdown with Search */}
              <div className="flex items-center gap-2 relative" id="item-filter-dropdown-container">
                <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Item</span>
                <div className="relative min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => setIsItemDropdownOpen(prev => !prev)}
                    className="bg-bg-surface-2 border border-border-light text-text-primary px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider outline-none focus:border-accent cursor-pointer w-full flex items-center justify-between gap-2"
                  >
                    <span className="truncate max-w-[150px] text-left">
                      {selectedItem ? (selectedItem.isDeal ? `${selectedItem.name} (Deal)` : selectedItem.name) : 'All Items'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                  </button>
                  
                  {isItemDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-bg-surface border border-border-light rounded-lg shadow-xl z-[50] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="p-2 border-b border-border-light bg-bg-surface-2">
                        <input
                          type="text"
                          placeholder="Search items..."
                          className="w-full px-2 py-1.5 text-[11px] bg-bg-surface border border-border-light rounded focus:outline-none focus:border-accent font-bold uppercase placeholder-text-placeholder text-text-primary"
                          value={itemSearchTerm}
                          onChange={(e) => setItemSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                        <button
                          type="button"
                          className={clsx(
                            "w-full text-left px-3 py-2 text-[11px] uppercase font-bold tracking-wider hover:bg-bg-surface-2 transition-colors cursor-pointer flex items-center justify-between",
                            selectedItemId === 'all' ? "text-accent bg-accent/5 font-extrabold" : "text-text-primary"
                          )}
                          onClick={() => {
                            setSelectedItemId('all');
                            setIsItemDropdownOpen(false);
                            setItemSearchTerm('');
                            setCurrentPage(1);
                          }}
                        >
                          <span>All Items</span>
                          {selectedItemId === 'all' && <Check className="w-3.5 h-3.5" />}
                        </button>
                        
                        {dropdownItems
                          .filter(item => item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                          .map(item => {
                            const isSelected = String(item.id) === String(selectedItemId);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={clsx(
                                  "w-full text-left px-3 py-2 text-[11px] uppercase font-bold tracking-wider hover:bg-bg-surface-2 transition-colors cursor-pointer flex items-center justify-between whitespace-normal break-words",
                                  isSelected ? "text-accent bg-accent/5 font-extrabold" : "text-text-primary"
                                )}
                                onClick={() => {
                                  setSelectedItemId(String(item.id));
                                  setIsItemDropdownOpen(false);
                                  setItemSearchTerm('');
                                  setCurrentPage(1);
                                }}
                              >
                                <span className="pr-2 leading-tight text-left">
                                  {item.name} {item.isDeal ? '(Deal)' : ''}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-auto" />}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex bg-bg-surface-2 rounded-lg p-1 border border-border-light shadow-sm shrink-0">
              {['all', 'in-progress', 'completed', 'held'].map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status as any)}
                  className={clsx(
                    "px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer",
                    selectedStatus === status ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  <span>{status}</span>
                </button>
              ))}
            </div>
          </div>
        </header>        <div className="w-full min-h-[60vh] max-w-none p-4 md:p-6 bg-bg-surface rounded-lg shadow-sm flex flex-col no-print">
          
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3 mb-4">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center bg-bg-surface rounded-lg border border-border-light flex flex-col items-center justify-center space-y-3">
                <AlertCircle className="w-8 h-8 text-text-placeholder" />
                <span className="text-text-muted text-xs font-extrabold uppercase tracking-widest max-w-[400px]">
                  {selectedItem ? (
                    `No orders found containing ${selectedItem.name} in this period`
                  ) : (
                    "No orders in this period"
                  )}
                </span>
              </div>
            ) : (
              paginatedOrders.map(order => {
                const hasItem = selectedItem && orderContainsSelectedItem(order, selectedItem);
                const { time, businessDate } = getBusinessDateDisplay(order.completedAt || order.createdAt || Date.now(), getCachedCutoff());
                const day = businessDate.getDate();
                const month = businessDate.toLocaleString('default', { month: 'short' });
                const year = businessDate.getFullYear().toString().slice(-2);
                
                return (
                  <div
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
                    className={clsx(
                      "p-4 border border-border-light rounded-xl bg-bg-surface flex flex-col gap-3 hover:bg-bg-surface-2 transition-all cursor-pointer relative",
                      selectedOrder?.id === order.id ? "bg-bg-surface-2 ring-1 ring-accent" : hasItem ? "bg-accent/[0.03] border-l-4 border-l-accent" : ""
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold font-mono text-text-primary">#{order.orderNumber}</span>
                        <span className="text-[10px] text-text-muted font-mono uppercase font-bold tracking-widest mt-0.5">{time} | {day} {month} {year}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx(
                          "w-1.5 h-1.5 rounded-full inline-block",
                          order.status === 'completed' && "bg-success",
                          order.status === 'in-progress' && "bg-warning",
                          order.status === 'held' && "bg-accent"
                        )} />
                        <span className={clsx(
                          "badge sm font-bold uppercase tracking-wider text-[9px]",
                          order.status === 'completed' && "badge-success",
                          order.status === 'in-progress' && "badge-warning",
                          order.status === 'held' && "badge-accent"
                        )}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border-light/50">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-text-placeholder tracking-wider">Customer</span>
                        <div className="font-semibold text-text-primary truncate">{order.customerName || '—'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-text-placeholder tracking-wider">Cashier</span>
                        <div className="font-semibold text-text-primary truncate">{order.cashierName || '—'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-text-placeholder tracking-wider">Type / Items</span>
                        <div className="font-semibold text-text-primary uppercase tracking-tight text-[11px]">
                          {order.type} ({order.items.reduce((acc, it) => acc + (it.quantity || 0), 0)})
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-text-placeholder tracking-wider">Total Amount</span>
                        <div className="font-bold text-accent font-mono">{settings.currency}{(order.total || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end items-center gap-2 pt-2 border-t border-border-light/50">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteRecord(order, e);
                        }}
                        className="p-1.5 bg-danger-light border border-danger-border rounded-lg text-danger hover:bg-danger hover:text-white transition-all cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[9px] uppercase font-black tracking-widest px-0.5">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block flex-1 overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
              <thead>
                <tr>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '80px', minWidth: '80px' }}>Order #</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '150px', minWidth: '150px' }}>Date/Time</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '140px', minWidth: '140px' }}>Customer</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '120px', minWidth: '120px' }}>Cashier</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Type</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '60px', minWidth: '60px' }}>Items</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Total</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '110px', minWidth: '110px' }}>Status</th>
                  <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-right" style={{ width: '100px', minWidth: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 py-12">
                        <AlertCircle className="w-8 h-8 text-text-placeholder" />
                        <span className="text-text-muted text-xs font-extrabold uppercase tracking-widest max-w-[400px]">
                          {selectedItem ? (
                            `No orders found containing ${selectedItem.name} in this period`
                          ) : (
                            "No orders in this period"
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map(order => {
                    const hasItem = selectedItem && orderContainsSelectedItem(order, selectedItem);
                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
                        className={clsx(
                          "hover:bg-bg-surface-2 cursor-pointer transition-all group h-[56px] min-h-[56px] border-b border-border-light",
                          selectedOrder?.id === order.id ? "bg-bg-surface-2" : hasItem ? "bg-accent/[0.03] border-l-2 border-l-accent" : ""
                        )}
                      >
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-mono font-bold" style={{ width: '80px', minWidth: '80px' }}>
                        {order.orderNumber}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary" style={{ width: '150px', minWidth: '150px' }}>
                        {(() => {
                          const { time, businessDate } = getBusinessDateDisplay(order.completedAt || order.createdAt || Date.now(), getCachedCutoff());
                          const day = businessDate.getDate();
                          const month = businessDate.toLocaleString('default', { month: 'short' });
                          const year = businessDate.getFullYear().toString().slice(-2);
                          return (
                            <div className="flex flex-col">
                              <span className="font-bold">{time}</span>
                              <span className="text-[10px] text-text-muted font-mono uppercase font-bold tracking-widest mt-0.5">{day} {month} {year}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-bold uppercase tracking-tight truncate max-w-[140px]" style={{ width: '140px', minWidth: '140px' }} title={order.customerName || ''}>
                        {order.customerName || '—'}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-bold uppercase tracking-tight truncate max-w-[120px]" style={{ width: '120px', minWidth: '120px' }} title={order.cashierName || ''}>
                        {order.cashierName || '—'}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary" style={{ width: '100px', minWidth: '100px' }}>
                        <span className="badge sm font-bold uppercase tracking-widest">
                          {order.type}
                        </span>
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-mono font-bold" style={{ width: '60px', minWidth: '60px' }}>
                        {order.items.reduce((acc, it) => acc + (it.quantity || 0), 0)}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-accent font-mono font-bold tracking-tight" style={{ width: '100px', minWidth: '100px' }}>
                        {settings.currency}{(order.total || 0).toFixed(2)}
                      </td>
                      <td className="p-[14px_16px] text-[14px]" style={{ width: '110px', minWidth: '110px' }}>
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            "w-2 h-2 rounded-full inline-block shadow-sm",
                            order.status === 'completed' && "bg-success shadow-success/20",
                            order.status === 'in-progress' && "bg-warning shadow-warning/20",
                            order.status === 'held' && "bg-accent shadow-accent/20"
                          )} />
                          <span className={clsx(
                            "badge sm font-bold uppercase tracking-wider",
                            order.status === 'completed' && "badge-success",
                            order.status === 'in-progress' && "badge-warning",
                            order.status === 'held' && "badge-accent"
                          )}>
                            {order.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-[14px_16px] text-right" style={{ width: '100px', minWidth: '100px' }}>
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDeleteRecord(order, e);
                            }} 
                            className="relative z-10 p-2 bg-danger-light border border-danger-border rounded-lg text-danger hover:bg-danger hover:text-white transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-sm cursor-pointer pointer-events-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className={clsx("w-4 h-4 text-text-disabled transition-all", selectedOrder?.id === order.id ? "rotate-90 text-accent" : "group-hover:translate-x-0.5")} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-8 py-5 border-t border-border-light bg-bg-surface-2/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
              Showing {paginatedOrders.length} <span className="text-text-placeholder">of</span> {filteredOrders.length}
            </span>
            <div className="flex items-center gap-3">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 rounded-lg border border-border-light bg-bg-surface text-text-muted hover:text-text-primary hover:border-text-muted disabled:opacity-20 transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-text-primary px-3 py-1 bg-bg-surface border border-border-light rounded-md shadow-sm">
                {currentPage} <span className="text-text-placeholder">/</span> {Math.max(1, totalPages)}
              </span>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 rounded-lg border border-border-light bg-bg-surface text-text-muted hover:text-text-primary hover:border-text-muted disabled:opacity-20 transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>      {/* Detail Panel Modal Overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-fade-in no-print">
          <div 
            className="bg-bg-surface border border-border-light flex flex-col text-text-primary animate-in zoom-in-95 duration-300 relative shadow-modal"
            style={{
              width: 'min(90vw, 640px)',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: 'var(--radius-xl, 16px)',
              boxShadow: 'var(--shadow-modal, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04))'
            }}
          >
            <header className="pb-6 border-b border-border-light flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-text-muted mb-1">Audit Manifest</h2>
                <div className="text-2xl font-extrabold font-mono text-text-primary tracking-tighter leading-none">{selectedOrder.orderNumber}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-bg-surface-2 hover:bg-border-light border border-border-light rounded-lg text-text-muted hover:text-text-primary transition-all">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 py-6 space-y-8">
              {isEditing ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-4 bg-bg-surface-2 border border-border-light p-6 rounded-xl shadow-sm">
                    <div>
                      <label className="text-[12px] text-text-muted font-bold uppercase tracking-wider mb-2 block">Label Subject</label>
                      <input 
                        type="text" 
                        className="input-field"
                        value={editValues.customerName}
                        onChange={(e) => setEditValues({ ...editValues, customerName: e.target.value })}
                        placeholder="Enter customer label..."
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-text-muted font-bold uppercase tracking-wider mb-2 block">Positional Index (Table)</label>
                      <input 
                        type="text" 
                        className="input-field font-mono"
                        value={editValues.tableNumber}
                        onChange={(e) => setEditValues({ ...editValues, tableNumber: e.target.value })}
                        placeholder="Table ID..."
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-text-muted font-bold uppercase tracking-wider mb-2 block">Operational State</label>
                      <select 
                        className="input-field appearance-none uppercase tracking-widest cursor-pointer"
                        value={editValues.status}
                        onChange={(e) => setEditValues({ ...editValues, status: e.target.value as any })}
                      >
                        <option value="in-progress">IN PROGRESS</option>
                        <option value="completed">COMPLETED</option>
                        <option value="held">HELD</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] text-text-muted font-bold uppercase tracking-wider mb-2 block">Protocol Notes</label>
                      <textarea 
                        className="input-field min-h-[100px] italic leading-relaxed"
                        value={editValues.notes}
                        onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                        placeholder="Add operational notes here..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 border border-border-light bg-bg-surface rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-bg-surface-2 transition-all text-text-muted shadow-sm"
                    >
                      Abort Change
                    </button>
                    <button 
                      onClick={handleSaveEdit}
                      className="btn-primary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest font-bold shadow-xl"
                    >
                      <Check className="w-4 h-4 mr-2 inline-block -mt-0.5" /> Commit Manifest
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedOrder.isDeleted && (
                    <div className="bg-danger/5 border-l-4 border-l-danger p-4 rounded-r-xl border border-danger/10 mb-6 space-y-2">
                      <div className="flex items-center gap-2 text-danger font-bold text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        <span>Deleted Record Audit Trail</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mt-2 pt-2 border-t border-danger/10">
                        <div>
                          <span className="block text-text-muted uppercase font-bold tracking-tight">Deleted At</span>
                          <span className="font-mono font-bold text-text-primary">
                            {selectedOrder.deletedAt ? format(selectedOrder.deletedAt, 'dd MMM yyyy hh:mm:ss a') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-text-muted uppercase font-bold tracking-tight">Deleted By</span>
                          <span className="font-semibold text-text-primary">{selectedOrder.deletedBy || '—'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <section className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-surface-2 p-4 rounded-xl border border-border-light shadow-sm">
                      <div className="text-[12px] text-text-muted uppercase tracking-wider font-bold mb-1">Sync Phase</div>
                      <div className="font-mono text-sm font-bold text-text-primary">{format(selectedOrder.createdAt, 'hh:mm:ss a')}</div>
                    </div>
                    <div className="bg-bg-surface-2 p-4 rounded-xl border border-border-light shadow-sm">
                      <div className="text-[12px] text-text-muted uppercase tracking-wider font-bold mb-1">Type Vector</div>
                      <div className="text-xs font-bold uppercase text-text-primary tracking-widest">{selectedOrder.type}</div>
                    </div>
                    {selectedOrder.tableNumber && (
                      <div className="col-span-2 bg-bg-surface-2 p-4 rounded-xl border border-border-light shadow-sm flex justify-between items-center px-6 text-sm">
                         <span className="text-[12px] text-text-muted uppercase tracking-wider font-bold">Positional ID</span>
                         <span className="badge outline accent font-mono text-lg font-bold px-3 py-0.5">{selectedOrder.tableNumber}</span>
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="flex justify-between items-end mb-3">
                      <h3 className="text-[12px] text-text-muted uppercase tracking-wider font-bold">Payload Discrete</h3>
                      <div className="text-[10px] font-bold font-mono text-text-muted border border-border-light px-2 py-0.5 rounded uppercase">{selectedOrder.items.length} units indexed</div>
                    </div>
                    <div className="divide-y divide-border-light">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col py-2.5 text-[14px] text-text-primary">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3">
                              <span className="font-mono text-xs font-bold bg-bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded">x{item.quantity}</span>
                              <div>
                                <div className="font-bold">{item.name}</div>
                                {item.notes && (
                                  <div className="text-[12px] text-text-muted font-medium mt-1">
                                    Notes: {item.notes}
                                  </div>
                                )}
                                {item.isDeal && item.dealComponents && (
                                  <div className="mt-2 pl-3 border-l-2 border-accent/20 flex flex-col gap-1.5">
                                    {item.dealComponents.map((comp, cIdx) => (
                                      <div key={cIdx} className="flex flex-col text-xs text-text-secondary">
                                        <span className="font-semibold text-accent leading-none">
                                          • {comp.componentName} <span className="text-text-muted font-normal text-[10px]">(unit {comp.unitIndex})</span>
                                        </span>
                                        {comp.modifiers && comp.modifiers.length > 0 && (
                                          <div className="pl-3 flex flex-col border-l border-dashed border-border-light mt-0.5">
                                            {comp.modifiers.map((mod: any, mIdx: number) => (
                                              <span key={mIdx} className="text-[11px] text-text-muted leading-relaxed">+ {mod.label}</span>
                                            ))}
                                          </div>
                                        )}
                                        {comp.notes && (
                                          <span className="pl-3 text-[11px] italic text-text-placeholder mt-0.5">Note: "{comp.notes}"</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="font-mono font-bold text-text-primary">
                              {settings.currency}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {orderSnapshots.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-2">
                         <Printer className="w-4 h-4 text-accent/65" />
                         <h3 className="text-[12px] text-text-muted uppercase tracking-wider font-bold">KOT Trace Log</h3>
                      </div>
                      <div className="space-y-3">
                        {orderSnapshots.map(snap => (
                          <div key={snap.id} className="bg-bg-surface-2/50 border border-border-light rounded-xl overflow-hidden shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 py-2.5 bg-bg-surface border-b border-border-light">
                              <div className="flex items-center gap-2">
                                <span className="badge badge-success sm font-bold tracking-widest uppercase text-[10px]">KOT #{snap.kotNumber}</span>
                                <span className="text-[9px] text-text-placeholder font-medium uppercase tracking-wider">(resets daily)</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-placeholder font-mono uppercase font-bold tracking-widest">
                                <span>Date: {format(snap.sentAt, 'dd MMMM yyyy')}</span>
                                <span>Time: {format(snap.sentAt, 'hh:mm a')}</span>
                              </div>
                            </div>
                            <div className="p-3 flex flex-wrap gap-2">
                              {snap.items.map((it, idx) => (
                                <div key={idx} className="badge sm font-bold bg-bg-surface border border-border-light">
                                   <span className="text-text-primary uppercase tracking-tight">{it.name}</span>
                                   <span className="text-text-placeholder font-mono font-bold border-l border-border-light ml-2 pl-2">x{it.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="pt-6 border-t border-border-light space-y-3">
                    <div className="flex justify-between text-[12px] text-text-muted uppercase tracking-wider font-bold">
                      <span>Subtotal</span>
                      <span className="font-mono text-text-primary">{settings.currency}{(selectedOrder.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {selectedOrder.discountAmount !== undefined && selectedOrder.discountAmount > 0 && (
                      <>
                        <div className="flex justify-between text-[12px] text-text-muted uppercase tracking-wider font-bold">
                          <span>Discount</span>
                          <span className="font-semibold text-text-primary">
                            {selectedOrder.discountType === 'percent'
                              ? `${selectedOrder.discountValue ?? 0}%`
                              : `Rs. ${selectedOrder.discountValue ?? 0}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-[12px] text-danger uppercase tracking-wider font-bold">
                          <span>Discount Amount</span>
                          <span className="font-mono font-bold">-{settings.currency}{(selectedOrder.discountAmount || 0).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-[12px] text-text-muted uppercase tracking-wider font-bold">
                      <span>Taxation Weight</span>
                      <span className="font-mono text-text-primary">{settings.currency}{(selectedOrder.taxAmount || 0).toFixed(2)}</span>
                    </div>
                    {selectedOrder.type === OrderType.DELIVERY && (
                      <div className="flex justify-between text-[12px] text-text-muted uppercase tracking-wider font-bold">
                        <span>{settings.deliveryChargeLabel}</span>
                        <span className={clsx("font-mono", selectedOrder.deliveryChargeWaived ? "text-danger/40 line-through" : "text-text-primary bg-bg-surface-2 px-2 py-0.5 rounded border border-border-light")}>
                          {settings.currency}{(selectedOrder.deliveryCharge || 0).toFixed(2)}
                          {selectedOrder.deliveryChargeWaived && <span className="ml-2 text-[10px] no-underline font-bold uppercase tracking-tight text-danger">Exempted</span>}
                        </span>
                      </div>
                    )}
                    {selectedOrder.deliveryChargeWaivedReason && (
                      <div className="text-[11px] text-text-placeholder italic px-1 leading-relaxed font-medium">
                        Exemption Reason: {selectedOrder.deliveryChargeWaivedReason}
                      </div>
                    )}
                    <div className="flex justify-between items-center py-4 border-t border-dashed border-border-light">
                      <span className="text-[12px] text-text-muted uppercase tracking-wider font-bold">Composite Total</span>
                      <span className="font-bold text-[15px] font-mono text-text-primary">{settings.currency}{(selectedOrder.total || 0).toFixed(2)}</span>
                    </div>
                  </section>

                  <div className="pt-4 flex gap-4 animate-in fade-in duration-200">
                    {selectedOrder.isDeleted ? (
                      <>
                        <button 
                          onClick={() => handleRestoreRecord(selectedOrder)}
                          className="btn-primary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore Order
                        </button>
                        <button 
                          className="w-12 py-3 bg-bg-surface border border-border-light hover:bg-bg-surface-2 text-text-muted hover:text-text-primary rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedOrder.status === 'held' && (
                          <button 
                            onClick={() => handleRetrieveOrder(selectedOrder)}
                            className="btn-primary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest shadow-xl transition-all group cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-700 inline-block -mt-0.5" />
                            Restore Session
                          </button>
                        )}
                        {selectedOrder.status === 'held' && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleCancelHeldOrder(selectedOrder.id, selectedOrder.orderNumber);
                            }}
                            className="relative z-10 w-12 py-3 bg-danger-light border border-danger-border text-danger hover:bg-danger hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer pointer-events-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {selectedOrder.status !== 'held' && (
                          <button 
                            onClick={handleStartEdit}
                            className="btn-secondary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest shadow-sm group transition-all cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4 mr-2 text-text-muted group-hover:text-accent transition-colors inline-block -mt-0.5" />
                            Refine Entry
                          </button>
                        )}
                        <button 
                          className="w-12 py-3 bg-bg-surface border border-border-light hover:bg-bg-surface-2 text-text-muted hover:text-text-primary rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Retrieval Confirmation Modal */}
      {retrievalConfirmData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-8 animate-fade-in no-print">
           <div className="bg-bg-surface border border-border-light rounded-xl p-12 max-w-xl w-full shadow-modal text-center space-y-10 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-warning-light rounded-full flex items-center justify-center mx-auto border border-warning-border shadow-sm">
                <AlertCircle className="w-12 h-12 text-warning" />
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-extrabold text-text-primary uppercase tracking-tight">Active Matrix Detected</h2>
                <p className="text-text-muted text-base leading-relaxed font-medium">
                  The POS environment contains unsaved state. Hold the current matrix or discard to restore sequence <span className="text-text-primary font-mono font-extrabold border-b-2 border-border-light">#{retrievalConfirmData.orderNumber}</span>.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-6">
                <button 
                  onClick={() => holdAndRetrieve(retrievalConfirmData)}
                  className="btn-primary w-full py-5 text-[13px] tracking-[0.2em] shadow-xl active:scale-[0.98]"
                >
                  Hold Current Sequence
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      clearCart();
                      handleRetrieveOrder(retrievalConfirmData, true);
                    }}
                    className="w-full py-4 bg-danger-light hover:bg-danger text-danger hover:text-white border border-danger-border rounded-lg font-bold uppercase text-[11px] tracking-widest transition-all active:scale-[0.98]"
                  >
                    Wipe State
                  </button>
                  <button 
                    onClick={() => setRetrievalConfirmData(null)}
                    className="w-full py-4 text-text-muted hover:text-text-primary font-bold uppercase text-[11px] tracking-widest transition-all bg-bg-surface-2 rounded-lg border border-border-light active:scale-[0.98]"
                  >
                    Abort
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Custom Soft Delete Confirmation Modal */}
      {deletingOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px] z-[110] flex items-center justify-center p-4 animate-fade-in no-print bg-black/40">
          <div 
            className="bg-bg-surface border border-border-light flex flex-col text-text-primary animate-in zoom-in-95 duration-300 relative shadow-modal"
            style={{
              width: 'min(90vw, 480px)',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <header className="pb-4 border-b border-border-light flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-danger">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]">Delete Order #{deletingOrder.orderNumber}?</h2>
              </div>
              <button 
                onClick={() => { setDeletingOrder(null); setDeleteReason(''); }} 
                className="p-1.5 bg-bg-surface-2 hover:bg-border-light border border-border-light rounded-md text-text-muted hover:text-text-primary transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="py-6 space-y-4">
              

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                  Reason for deletion <span className="text-danger">*</span> (required, min 5 chars)
                </label>
                <textarea
                  placeholder="e.g. Customer cancelled, Wrong order entered, Test order..."
                  className="w-full bg-bg-surface-2 border border-border-light focus:border-accent rounded-lg p-3 text-xs focus:outline-none min-h-[90px] resize-none leading-relaxed transition-all"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border-light flex gap-3">
              <button
                onClick={() => { setDeletingOrder(null); setDeleteReason(''); }}
                className="flex-1 py-2.5 border border-border-light bg-bg-surface-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-border-light transition-all text-text-muted cursor-pointer font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteReason.trim().length < 5}
                className={clsx(
                  "flex-1 py-2.5 rounded-lg text-[10px] uppercase tracking-widest transition-all font-bold",
                  deleteReason.trim().length < 5
                    ? "bg-danger/20 border border-danger/20 text-danger/50 cursor-not-allowed"
                    : "bg-danger text-white hover:bg-danger-dark cursor-pointer shadow-lg shadow-danger/20"
                )}
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Protection Modal */}
      {openPasswordModal && (
        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print">
          <motion.div
            animate={shakeModal ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
            onAnimationComplete={() => setShakeModal(false)}
            className="w-full max-w-md bg-bg-surface border border-border-light rounded-2xl shadow-2xl p-8 space-y-6 text-text-primary"
          >
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className="p-4 bg-red-100 rounded-full">
                <Lock className="w-8 h-8 text-red-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[17px] font-extrabold text-text-primary uppercase tracking-tight leading-none">Security Verification</h3>
                <p className="text-text-muted text-[13px] font-medium leading-relaxed">
                  Enter password to access operational audit journals
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  autoFocus
                  type={showPassword ? 'text' : 'password'}
                  value={passwordValue}
                  onChange={(e) => {
                    setPasswordValue(e.target.value);
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {passwordError && (
                <p className="text-danger text-xs font-bold uppercase tracking-tight text-center px-1">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex gap-4 pt-4 border-t border-border-light">
              <button
                onClick={handlePasswordModalCancel}
                className="flex-1 py-4 bg-bg-surface-2 text-text-placeholder rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-border-light transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordModalConfirm}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest transition-all cursor-pointer shadow-lg shadow-red-600/20"
              >
                Verify
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Operations Audit Log Full-Screen View */}
      {showAuditLog && (
        <div className="fixed inset-0 z-[200] bg-bg-app flex flex-col overflow-y-auto p-8 lg:p-12 custom-scrollbar animate-fade-in no-print text-text-primary">
          {/* Header */}
          <header className="mb-8 flex justify-between items-start border-b border-border-light pb-6 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-100 rounded-lg text-red-650">
                  <ShieldAlert className="w-5 h-5 text-red-600 animate-pulse" />
                </span>
                <div>
                  <h1 className="text-lg font-black text-text-primary uppercase tracking-tight leading-none flex items-center gap-2">
                    Operations Audit Journal
                  </h1>
                  <p className="text-text-muted text-[13px] font-medium mt-1.5 leading-none">
                    Administrative log tracing deletions and mid-flow order cancellations for inspection
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowAuditLog(false)}
              className="px-5 py-2.5 bg-bg-surface-2 hover:bg-border-light border border-border-light text-text-primary rounded-xl transition-all flex items-center gap-2.5 font-bold uppercase text-[10px] tracking-widest shadow-sm cursor-pointer"
            >
              <X className="w-4 h-4" />
              Exit Audit View
            </button>
          </header>

          {/* Secure Information Banner */}
          <div className="bg-red-500/5 border border-red-200/50 rounded-2xl p-4 mb-8 flex items-start gap-4">
            <span className="p-2 bg-red-100 rounded-xl text-red-600 mt-0.5">
              <AlertCircle className="w-4 h-4 animate-bounce" />
            </span>
            <div className="space-y-1 text-xs leading-relaxed text-red-800">
              <div className="font-extrabold uppercase tracking-wide">Administrative Warning & Context Logging</div>
              <p className="text-text-muted">
                Audit results represent order records matching administrative filter range bounds: 
                <span className="font-bold text-text-primary font-mono ml-1 px-1.5 py-0.5 rounded bg-bg-surface border border-border-light">
                  {auditDateBounds.start ? format(auditDateBounds.start, 'dd MMM yyyy') : 'Beginning of records'} — {auditDateBounds.end ? format(auditDateBounds.end, 'dd MMM yyyy') : 'Present'}
                </span>
              </p>
            </div>
          </div>

          {/* Audit Log Date Range Filter */}
          <div className="bg-bg-surface border border-border-light rounded-2xl p-5 md:p-6 mb-4 md:mb-6 shadow-sm">
            <h3 className="text-xs font-black uppercase text-text-primary tracking-widest mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              Filter Operations Audit by Date Range
            </h3>
            
            {/* Quick Select Buttons */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6 pb-5 border-b border-border-light">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mr-1.5">
                Quick Select:
              </span>
              {(
                ['today', 'yesterday', 'week', 'month', 'custom'] as const
              ).map(range => {
                let label = '';
                if (range === 'today') label = 'Today';
                else if (range === 'yesterday') label = 'Yesterday';
                else if (range === 'week') label = 'This Week';
                else if (range === 'month') label = 'This Month';
                else if (range === 'custom') label = 'Custom Range';

                return (
                  <button
                    key={range}
                    onClick={() => {
                      setAuditSelectedRange(range);
                      setAuditCustomStart(null);
                      setAuditCustomEnd(null);
                    }}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border",
                      auditSelectedRange === range
                        ? "bg-accent border-accent text-white shadow-sm font-black"
                        : "bg-bg-surface-2 border-border-light text-text-muted hover:text-text-secondary hover:bg-bg-surface-2/80"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            
            {/* Custom Date Range */}
            {auditSelectedRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 animate-fade-in">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-text-muted mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={auditCustomStart 
                      ? auditCustomStart.toISOString().split('T')[0] 
                      : ''}
                    onChange={(e) => 
                      setAuditCustomStart(
                        e.target.value 
                          ? new Date(e.target.value + 'T00:00:00') 
                          : null
                      )
                    }
                    className="w-full px-3 py-1.5 text-[11px] font-mono font-bold bg-bg-surface-2 border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30 pointer-events-auto cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-wider text-text-muted mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={auditCustomEnd 
                      ? auditCustomEnd.toISOString().split('T')[0] 
                      : ''}
                    onChange={(e) => 
                      setAuditCustomEnd(
                        e.target.value 
                          ? new Date(e.target.value + 'T00:00:00') 
                          : null
                      )
                    }
                    className="w-full px-3 py-1.5 text-[11px] font-mono font-bold bg-bg-surface-2 border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30 pointer-events-auto cursor-pointer"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      if (auditCustomStart && auditCustomEnd) {
                        // Filter already applied via useMemo
                      }
                    }}
                    className="w-full px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all shadow-sm cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
            
            {/* Display current range */}
            {auditDateBounds.start && auditDateBounds.end && (
              <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Showing records from{' '}
                <span className="text-text-primary font-bold">{format(auditDateBounds.start, 'dd MMM yyyy')}</span>{' '}
                to{' '}
                <span className="text-text-primary font-bold">{format(auditDateBounds.end, 'dd MMM yyyy')}</span>
              </div>
            )}
          </div>

          {/* Stat Boxes - After Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            
            {/* Cancellations (KOT) Stat Box */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                    Cancellations (KOT)
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">
                    {auditFilteredCancelledKots.length}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 mt-2">
                    Total Value: Rs {
                      auditFilteredCancelledKots.reduce(
                        (sum, kot) => sum + (kot.totalValue || kot.total || 0), 
                        0
                      ).toLocaleString()
                    }
                  </p>
                </div>
                <div className="bg-orange-100 rounded-lg p-2 md:p-3">
                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                </div>
              </div>
            </div>
            
            {/* Completed Deletions Stat Box */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                    Completed Deletions
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">
                    {auditFilteredDeletedOrders.length}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 mt-2">
                    Total Value: Rs {
                      auditFilteredDeletedOrders.reduce(
                        (sum, order) => sum + (order.total || 0), 
                        0
                      ).toLocaleString()
                    }
                  </p>
                </div>
                <div className="bg-red-100 rounded-lg p-2 md:p-3">
                  <Trash2 className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                </div>
              </div>
            </div>
            
          </div>

          {/* Section 4: Data Tables Stacked Vertically */}
          <div className="space-y-6">
            
            {/* Column 1: Cancelled Orders */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-bg-surface p-4 border border-border-light rounded-2xl shadow-xs">
                <div>
                  <h2 className="text-xs font-black uppercase text-text-primary tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Cancelled Orders (KOTs)
                  </h2>
                  <p className="text-[10px] text-text-muted mt-1">Interrupted in-progress active preparation</p>
                </div>
                <span className="badge outline accent font-mono text-xs font-bold px-2 py-0.5 bg-red-500/10 text-red-600 border border-red-200/30">
                  {auditLogStats.cancelledCount}
                </span>
              </div>

              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 select-none custom-scrollbar">
                {auditLogStats.cancelledInPeriod.length === 0 ? (
                  <div className="bg-bg-surface-2 border border-border-light border-dashed rounded-2xl p-10 text-center text-text-placeholder text-xs uppercase font-extrabold tracking-widest py-16">
                    No cancellations recorded
                  </div>
                ) : (
                  auditLogStats.cancelledInPeriod.map(order => {
                    const isExpanded = !!expandedRowIds[order.id];
                    return (
                      <div 
                        key={order.id}
                        className="bg-bg-surface border border-border-light rounded-xl hover:border-red-300 transition-all shadow-xs overflow-hidden"
                      >
                        {/* Summary Header */}
                        <div 
                          onClick={() => toggleRowExpanded(order.id)}
                          className="p-4 flex justify-between items-start gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-text-primary font-mono">
                                #{order.orderNumber}
                              </span>
                              <span className="px-1.5 py-0.5 text-[8px] bg-red-100 text-red-650 rounded uppercase font-black tracking-wider leading-none">
                                Cancelled
                              </span>
                              <span className="badge sm font-bold uppercase tracking-widest">
                                {order.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider">
                              <span>{order.createdAt ? format(order.createdAt, 'dd MMM hh:mm a') : '—'}</span>
                              <span>•</span>
                              <span>By: {order.cashierName || '—'}</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex items-center gap-3">
                            <div className="space-y-1.5">
                              <div className="text-xs font-bold font-mono tracking-tight text-text-primary">
                                {settings.currency}{(order.total || 0).toFixed(2)}
                              </div>
                              <div className="text-[8px] text-text-muted leading-none uppercase tracking-widest font-extrabold">
                                Total Original
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-text-placeholder" /> : <ChevronDown className="w-4 h-4 text-text-placeholder" />}
                          </div>
                        </div>

                        {/* Expandable Panel */}
                        {isExpanded && (
                          <div className="bg-red-50/20 border-t border-red-100/55 p-4 space-y-3 text-xs animate-fade-in text-text-primary">
                            <div className="space-y-1 bg-white border border-red-100 rounded-lg p-3">
                              <span className="block text-[8px] text-red-650 font-black uppercase tracking-widest">
                                Cancellation Reason
                              </span>
                              <span className="block font-medium text-text-primary italic">
                                "{order.cancellationReason || 'No reason provided'}"
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                              <div className="bg-white border border-border-light rounded-lg p-2.5">
                                <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Cancelled At</span>
                                <span className="font-mono font-bold text-text-primary">
                                  {order.cancelledAt ? format(order.cancelledAt, 'dd MMM yyyy hh:mm:ss a') : '—'}
                                </span>
                              </div>
                              <div className="bg-white border border-border-light rounded-lg p-2.5">
                                <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Authorizing User</span>
                                <span className="font-bold text-text-primary">
                                  {order.cancelledBy || 'System/Cashier'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: Deleted Orders */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-bg-surface p-4 border border-border-light rounded-2xl shadow-xs">
                <div>
                  <h2 className="text-xs font-black uppercase text-text-primary tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    Deleted Orders (Completed)
                  </h2>
                  <p className="text-[10px] text-text-muted mt-1">Settled orders purged from database</p>
                </div>
                <span className="badge outline accent font-mono text-xs font-bold px-2 py-0.5 bg-red-650/10 text-red-650 border border-red-200/30">
                  {auditLogStats.deletedCount}
                </span>
              </div>

              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 select-none custom-scrollbar">
                {auditLogStats.deletedInPeriod.length === 0 ? (
                  <div className="bg-bg-surface-2 border border-border-light border-dashed rounded-2xl p-10 text-center text-text-placeholder text-xs uppercase font-extrabold tracking-widest py-16">
                    No deletions recorded
                  </div>
                ) : (
                  auditLogStats.deletedInPeriod.map(order => {
                    const isExpanded = !!expandedRowIds[order.id];
                    return (
                      <div 
                        key={order.id}
                        className="bg-bg-surface border border-border-light rounded-xl hover:border-red-300 transition-all shadow-xs overflow-hidden"
                      >
                        {/* Summary Header */}
                        <div 
                          onClick={() => toggleRowExpanded(order.id)}
                          className="p-4 flex justify-between items-start gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-text-primary font-mono">
                                #{order.orderNumber}
                              </span>
                              <span className="px-1.5 py-0.5 text-[8px] bg-red-100 text-red-650 rounded uppercase font-black tracking-wider leading-none">
                                Deleted
                              </span>
                              <span className="badge sm font-bold uppercase tracking-widest">
                                {order.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider">
                              <span>{order.createdAt ? format(order.createdAt, 'dd MMM hh:mm a') : '—'}</span>
                              <span>•</span>
                              <span>By: {order.cashierName || '—'}</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex items-center gap-3">
                            <div className="space-y-1.5">
                              <div className="text-xs font-bold font-mono tracking-tight text-text-primary">
                                {settings.currency}{(order.total || 0).toFixed(2)}
                              </div>
                              <div className="text-[8px] text-text-muted leading-none uppercase tracking-widest font-extrabold">
                                Total Original
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-text-placeholder" /> : <ChevronDown className="w-4 h-4 text-text-placeholder" />}
                          </div>
                        </div>

                        {/* Expandable Panel */}
                        {isExpanded && (
                          <div className="bg-red-50/20 border-t border-red-100/55 p-4 space-y-3 text-xs animate-fade-in text-text-primary">
                            <div className="space-y-1 bg-white border border-red-100 rounded-lg p-3">
                              <span className="block text-[8px] text-red-650 font-black uppercase tracking-widest">
                                Reason for Deletion
                              </span>
                              <span className="block font-medium text-text-primary italic">
                                "{order.deletedReason || 'No reason provided'}"
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                              <div className="bg-white border border-border-light rounded-lg p-2.5">
                                <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Deleted At</span>
                                <span className="font-mono font-bold text-text-primary">
                                  {order.deletedAt ? format(order.deletedAt, 'dd MMM yyyy hh:mm:ss a') : '—'}
                                </span>
                              </div>
                              <div className="bg-white border border-border-light rounded-lg p-2.5">
                                <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Deleted By</span>
                                <span className="font-bold text-text-primary">
                                  {order.deletedBy || 'System/Cashier'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
