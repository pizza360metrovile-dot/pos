/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
import { 
  Truck,
  Search, 
  Calendar, 
  Filter, 
  FileText, 
  ChevronRight, 
  Trash2, 
  Download,
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
  AlertCircle
} from 'lucide-react';
import { useStore, showConfirmModal } from '../store/useStore';
import { Order, OrderType, OrderItem } from '../types';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isAfter, subHours } from 'date-fns';

const ITEMS_PER_PAGE = 25;

export default function Records() {
  const { 
    orders, settings, deleteOrder, updateOrder, restoreOrder,
    cart, clearCart, menuItems, retrieveOrder: storeRetrieveOrder, 
    cancelHeldOrder: storeCancelHeldOrder, activeOrder, addOrder,
    kotSnapshots, orderType, customerName, tableNumber,
    deliveryChargeWaived, deliveryChargeWaivedReason, user
  } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<OrderType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'held' | 'in-progress' | 'all' | 'deleted'>('completed');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Order>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [retrievalConfirmData, setRetrievalConfirmData] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Date range filter states
  const [selectedRange, setSelectedRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

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

  // Compute calculated date boundaries based on choice
  const dateBounds = useMemo(() => {
    const now = new Date();
    
    if (selectedRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (selectedRange === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (selectedRange === 'week') {
      const currentDay = now.getDay();
      const gap = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - gap);
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (selectedRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (selectedRange === 'last-month') {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: firstOfLastMonth, end: lastOfLastMonth };
    }
    if (selectedRange === 'custom') {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
      return { start, end };
    }
    
    return { start: null, end: null };
  }, [selectedRange, customStart, customEnd]);

  // Keep date-filtered NON-deleted orders for calculations
  const rangeOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.isDeleted) return false;
      const orderDate = order.createdAt;
      if (dateBounds.start && orderDate < dateBounds.start.getTime()) return false;
      if (dateBounds.end && orderDate > dateBounds.end.getTime()) return false;
      return true;
    });
  }, [orders, dateBounds]);

  // Keep date-filtered deleted orders for calculations
  const deletedRangeOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order.isDeleted) return false;
      const orderDate = order.createdAt;
      if (dateBounds.start && orderDate < dateBounds.start.getTime()) return false;
      if (dateBounds.end && orderDate > dateBounds.end.getTime()) return false;
      return true;
    });
  }, [orders, dateBounds]);

  const deletedCount = useMemo(() => {
    return orders.filter(o => o.isDeleted).length;
  }, [orders]);

  const totalValueDeleted = useMemo(() => {
    return orders.filter(o => o.isDeleted).reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders]);

  // Calculations derived dynamically from selected range
  const rangeStats = useMemo(() => {
    const totalOrders = rangeOrders.length;
    const totalRevenue = rangeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalTax = rangeOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const totalDeliveryCharges = rangeOrders.reduce((sum, o) => sum + (o.deliveryCharge || 0), 0);

    const totalDiscounts = rangeOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);

    // Top selling item by quantity sold
    const itemQuantities: { [name: string]: number } = {};
    rangeOrders.forEach(order => {
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

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = order.createdAt;
      if (dateBounds.start && orderDate < dateBounds.start.getTime()) return false;
      if (dateBounds.end && orderDate > dateBounds.end.getTime()) return false;

      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || order.type === selectedType;
      
      if (selectedStatus === 'deleted') {
        return order.isDeleted && matchesSearch && matchesType;
      } else {
        if (order.isDeleted) return false;
        const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
        return matchesSearch && matchesType && matchesStatus;
      }
    });
  }, [orders, searchTerm, selectedType, selectedStatus, dateBounds]);

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
      <div className="flex-1 flex flex-col p-8 lg:p-12 overflow-y-auto custom-scrollbar">
        <header className="mb-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-base font-bold text-text-primary uppercase tracking-tight leading-none">Journal Audit</h1>
              <p className="text-text-muted text-[13px] font-medium mt-2">Historical ledger and operational trace documentation</p>
            </div>
            <div className="flex gap-4">
              <button className="px-5 py-2.5 bg-bg-surface border border-border-light text-text-primary rounded-md hover:bg-bg-surface-2 transition-all flex items-center gap-3 shadow-sm">
                <Download className="w-4 h-4 text-text-muted" />
                <span className="text-[11px] uppercase font-bold tracking-widest leading-none">Generate Export</span>
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

          {/* Recalculating Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
            {/* Total Revenue */}
            <div className="card-main p-6 border-l-4 border-l-success">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Revenue</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Total Orders */}
            <div className="card-main p-6 border-l-4 border-l-accent">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className="w-4 h-4 text-accent" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Orders</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {rangeStats.totalOrders}
              </div>
            </div>

            {/* Average Order Value */}
            <div className="card-main p-6 border-l-4 border-l-warning">
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpRight className="w-4 h-4 text-warning" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">AOV (Mean)</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.averageOrderValue.toFixed(2)}
              </div>
            </div>

            {/* Total Tax Collected */}
            <div className="card-main p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-4 h-4 text-purple-500" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Tax Collected</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{rangeStats.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Total Delivery Charges (only if > 0) */}
            {rangeStats.totalDeliveryCharges > 0 && (
              <div className="card-main p-6 border-l-4 border-l-orange-500">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="w-4 h-4 text-orange-500" />
                  <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Delivery Charges</span>
                </div>
                <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                  {settings.currency}{rangeStats.totalDeliveryCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Total Discounts Given (only if > 0) */}
            {rangeStats.totalDiscounts > 0 && (
              <div className="card-main p-6 border-l-4 border-l-danger">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-4 h-4 text-danger" />
                  <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Total Discounts Given</span>
                </div>
                <div className="text-2xl font-extrabold text-danger font-mono tracking-tighter">
                  {settings.currency}{rangeStats.totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Top Selling Item */}
            <div className="card-main p-6 border-l-4 border-l-teal-500">
              <div className="flex items-center gap-3 mb-2">
                <Check className="w-4 h-4 text-teal-500" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Top Selling Item</span>
              </div>
              {rangeStats.topItem ? (
                <div>
                  <div className="text-base font-extrabold text-text-primary uppercase truncate" title={rangeStats.topItem.name}>
                    {rangeStats.topItem.name}
                  </div>
                  <div className="text-[11px] font-mono text-text-muted font-bold uppercase tracking-wider mt-0.5">
                    Sold: {rangeStats.topItem.quantity} units
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-extrabold text-text-muted font-mono tracking-tighter">—</div>
              )}
            </div>
          </div>

          {/* Showing Record Count */}
          <div className="flex items-center mb-4 px-1">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
              Showing {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ledger by order ID or subject..."
                className="input-field pl-[42px] font-mono uppercase tracking-tight"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-bg-surface-2 rounded-lg p-1 border border-border-light shadow-sm shrink-0">
              {['all', 'in-progress', 'completed', 'held', 'deleted'].map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status as any)}
                  className={clsx(
                    "px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer",
                    selectedStatus === status ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  <span>{status}</span>
                  {status === 'deleted' && deletedCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-danger text-white rounded-full leading-none">
                      {deletedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="w-full min-h-[60vh] max-w-none p-[20px_24px] bg-bg-surface rounded-lg shadow-sm flex flex-col no-print">
          {selectedStatus === 'deleted' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div className="bg-danger/5 border border-danger/10 p-5 rounded-xl shadow-sm space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest block">Total Deleted Orders</span>
                <div className="text-xl font-extrabold text-danger font-mono tracking-tight">{deletedCount}</div>
              </div>
              <div className="bg-danger/5 border border-danger/10 p-5 rounded-xl shadow-sm space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest block">Total Value Deleted</span>
                <div className="text-xl font-extrabold text-danger font-mono tracking-tight">
                  {settings.currency}{totalValueDeleted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-danger/5 border border-danger/10 p-5 rounded-xl shadow-sm space-y-1">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest block">This Period Deletions</span>
                <div className="text-xl font-extrabold text-danger font-mono tracking-tight">{deletedRangeOrders.length}</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
              {selectedStatus === 'deleted' ? (
                <thead>
                  <tr>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '120px', minWidth: '120px' }}>Order #</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '120px', minWidth: '120px' }}>Original Date</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Type</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '60px', minWidth: '60px' }}>Items</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Original Total</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '140px', minWidth: '140px' }}>Deleted At</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left">Reason</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '150px', minWidth: '150px' }}>Deleted By</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-right" style={{ width: '80px', minWidth: '80px' }}>Restore</th>
                  </tr>
                </thead>
              ) : (
                <thead>
                  <tr>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '80px', minWidth: '80px' }}>Order #</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '150px', minWidth: '150px' }}>Date/Time</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '140px', minWidth: '140px' }}>Customer</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Type</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '60px', minWidth: '60px' }}>Items</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '100px', minWidth: '100px' }}>Total</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-left" style={{ width: '110px', minWidth: '110px' }}>Status</th>
                    <th className="text-[12px] font-bold text-text-muted uppercase tracking-[0.05em] p-[12px_16px] bg-bg-surface-2 whitespace-nowrap text-right" style={{ width: '100px', minWidth: '100px' }}>Actions</th>
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-border-light">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={selectedStatus === 'deleted' ? 9 : 8} className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 py-12">
                        <AlertCircle className="w-8 h-8 text-text-placeholder" />
                        <span className="text-text-muted text-xs font-extrabold uppercase tracking-widest">
                          {selectedStatus === 'deleted' ? 'No deleted orders in this period' : 'No orders in this period'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : selectedStatus === 'deleted' ? (
                  paginatedOrders.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
                      className={clsx(
                        "hover:bg-bg-surface-2 cursor-pointer transition-colors group h-[56px] min-h-[56px] border-b border-border-light text-text-muted opacity-85",
                        selectedOrder?.id === order.id && "bg-bg-surface-2"
                      )}
                    >
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-mono font-bold" style={{ width: '120px', minWidth: '120px' }}>
                        <div className="flex items-center gap-1.5">
                          <span>{order.orderNumber}</span>
                          <span className="px-1 py-0.5 text-[8px] bg-danger text-white rounded font-sans uppercase font-black tracking-wider leading-none shrink-0">
                            DELETED
                          </span>
                        </div>
                      </td>
                      <td className="p-[14px_16px] text-[14px]" style={{ width: '120px', minWidth: '120px' }}>
                        <div className="flex flex-col">
                          <span className="font-bold text-text-primary">{format(order.createdAt, 'HH:mm')}</span>
                          <span className="text-[10px] text-text-muted font-mono uppercase font-bold tracking-widest mt-0.5">{format(order.createdAt, 'dd MMM yy')}</span>
                        </div>
                      </td>
                      <td className="p-[14px_16px] text-[14px]" style={{ width: '100px', minWidth: '100px' }}>
                        <span className="badge sm font-bold uppercase tracking-widest">
                          {order.type}
                        </span>
                      </td>
                      <td className="p-[14px_16px] text-[14px] font-mono font-bold text-text-primary" style={{ width: '60px', minWidth: '60px' }}>
                        {order.items.reduce((acc, it) => acc + (it.quantity || 0), 0)}
                      </td>
                      <td className="p-[14px_16px] text-[14px] font-mono font-bold tracking-tight text-text-primary" style={{ width: '100px', minWidth: '100px' }}>
                        {settings.currency}{(order.total || 0).toFixed(2)}
                      </td>
                      <td className="p-[14px_16px] text-[14px]" style={{ width: '140px', minWidth: '140px' }}>
                        {order.deletedAt ? (
                          <div className="flex flex-col text-danger">
                            <span className="font-bold">{format(order.deletedAt, 'HH:mm')}</span>
                            <span className="text-[10px] uppercase font-bold tracking-widest mt-0.5">{format(order.deletedAt, 'dd MMM yy')}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-[14px_16px] text-xs truncate max-w-[200px]" title={order.deletedReason || ''}>
                        {order.deletedReason || '—'}
                      </td>
                      <td className="p-[14px_16px] text-xs truncate max-w-[150px]" title={order.deletedBy || ''}>
                        {order.deletedBy || '—'}
                      </td>
                      <td className="p-[14px_16px] text-right" style={{ width: '80px', minWidth: '80px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreRecord(order);
                            }}
                            className="p-2 bg-success-light border border-success-border rounded-lg text-success hover:bg-success hover:text-white transition-all shadow-sm cursor-pointer pointer-events-auto"
                            title="Restore order"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  paginatedOrders.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => { setSelectedOrder(order); setIsEditing(false); }}
                      className={clsx(
                        "hover:bg-bg-surface-2 cursor-pointer transition-colors group h-[56px] min-h-[56px] border-b border-border-light",
                        selectedOrder?.id === order.id && "bg-bg-surface-2"
                      )}
                    >
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-mono font-bold" style={{ width: '80px', minWidth: '80px' }}>
                        {order.orderNumber}
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary" style={{ width: '150px', minWidth: '150px' }}>
                        <div className="flex flex-col">
                          <span className="font-bold">{format(order.createdAt, 'HH:mm')}</span>
                          <span className="text-[10px] text-text-muted font-mono uppercase font-bold tracking-widest mt-0.5">{format(order.createdAt, 'dd MMM yy')}</span>
                        </div>
                      </td>
                      <td className="p-[14px_16px] text-[14px] text-text-primary font-bold uppercase tracking-tight truncate max-w-[140px]" style={{ width: '140px', minWidth: '140px' }} title={order.customerName || ''}>
                        {order.customerName || '—'}
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
                  ))
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
                            {selectedOrder.deletedAt ? format(selectedOrder.deletedAt, 'dd MMM yyyy HH:mm:ss') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-text-muted uppercase font-bold tracking-tight">Deleted By</span>
                          <span className="font-semibold text-text-primary">{selectedOrder.deletedBy || '—'}</span>
                        </div>
                      </div>
                      <div className="text-[11px] pt-1">
                        <span className="block text-text-muted uppercase font-bold tracking-tight mb-0.5">Reason for Deletion</span>
                        <p className="text-text-primary bg-bg-surface border border-border-light rounded px-2.5 py-2 italic leading-relaxed mt-1">
                          "{selectedOrder.deletedReason || 'No reason provided'}"
                        </p>
                      </div>
                    </div>
                  )}
                  <section className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-surface-2 p-4 rounded-xl border border-border-light shadow-sm">
                      <div className="text-[12px] text-text-muted uppercase tracking-wider font-bold mb-1">Sync Phase</div>
                      <div className="font-mono text-sm font-bold text-text-primary">{format(selectedOrder.createdAt, 'HH:mm:ss')}</div>
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
                            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-surface border-b border-border-light">
                              <span className="badge badge-success sm font-bold tracking-widest uppercase text-[10px]">KOT #{snap.kotNumber}</span>
                              <span className="text-[10px] text-text-placeholder font-mono uppercase font-bold tracking-widest">{format(snap.sentAt, 'dd MMM HH:mm')}</span>
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
    </div>
  );
}
