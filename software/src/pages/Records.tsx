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
import { useStore } from '../store/useStore';
import { Order, OrderType, OrderItem } from '../types';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isAfter, subHours } from 'date-fns';

const ITEMS_PER_PAGE = 25;

export default function Records() {
  const { 
    orders, settings, deleteOrder, updateOrder, 
    cart, clearCart, menuItems, retrieveOrder: storeRetrieveOrder, 
    cancelHeldOrder: storeCancelHeldOrder, activeOrder, addOrder,
    kotSnapshots, orderType, customerName, tableNumber,
    deliveryChargeWaived, deliveryChargeWaivedReason
  } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<OrderType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'held' | 'refunded' | 'in-progress' | 'all'>('completed');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Order>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [retrievalConfirmData, setRetrievalConfirmData] = useState<Order | null>(null);

  const todayStats = useMemo(() => {
    const todayOrders = orders.filter(o => isToday(new Date(o.createdAt)) && o.status === 'completed');
    const revenue = todayOrders.reduce((acc, o) => acc + o.total, 0);
    const deliveryFees = todayOrders.reduce((acc, o) => acc + (o.deliveryCharge || 0), 0);
    const count = todayOrders.length;
    const avg = count > 0 ? revenue / count : 0;
    return { revenue, count, avg, deliveryFees };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || order.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [orders, searchTerm, selectedType, selectedStatus]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this record? This action will be logged.')) {
      await deleteOrder(id);
      if (selectedOrder?.id === id) setSelectedOrder(null);
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
    if (window.confirm(`Cancel this held order #${orderNumber}? This cannot be undone.`)) {
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
      <div className="flex-1 flex flex-col p-8 lg:p-12 overflow-hidden">
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

          {/* Today's Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="card-main p-6 border-l-4 border-l-success">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">System Yield</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{todayStats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card-main p-6 border-l-4 border-l-accent">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className="w-4 h-4 text-accent" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Load Count</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">{todayStats.count}</div>
            </div>
            <div className="card-main p-6 border-l-4 border-l-warning">
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpRight className="w-4 h-4 text-warning" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Mean Transaction</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{(todayStats?.avg || 0).toFixed(2)}
              </div>
            </div>
            <div className="card-main p-6 border-l-4 border-l-orange-500">
              <div className="flex items-center gap-3 mb-2">
                <Truck className="w-4 h-4 text-orange-500" />
                <span className="text-text-muted text-[11px] font-bold uppercase tracking-widest">Logistics Fees</span>
              </div>
              <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">
                {settings.currency}{(todayStats?.deliveryFees || 0).toFixed(2)}
              </div>
            </div>
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
              {['all', 'in-progress', 'completed', 'held', 'refunded'].map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status as any)}
                  className={clsx(
                    "px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                    selectedStatus === status ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="w-full min-h-[60vh] max-w-none p-[20px_24px] bg-bg-surface rounded-lg shadow-sm flex flex-col no-print">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
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
              <tbody className="divide-y divide-border-light">
                {paginatedOrders.map(order => (
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
                          order.status === 'held' && "bg-accent shadow-accent/20",
                          order.status === 'refunded' && "bg-danger shadow-danger/20"
                        )} />
                        <span className={clsx(
                          "badge sm font-bold uppercase tracking-wider",
                          order.status === 'completed' && "badge-success",
                          order.status === 'in-progress' && "badge-warning",
                          order.status === 'held' && "badge-accent",
                          order.status === 'refunded' && "badge-danger"
                        )}>
                          {order.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-[14px_16px] text-right" style={{ width: '100px', minWidth: '100px' }}>
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={(e) => handleDeleteRecord(order.id, e)} 
                          className="p-2 bg-danger-light border border-danger-border rounded-lg text-danger hover:bg-danger hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={clsx("w-4 h-4 text-text-disabled transition-all", selectedOrder?.id === order.id ? "rotate-90 text-accent" : "group-hover:translate-x-0.5")} />
                      </div>
                    </td>
                  </tr>
                ))}
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
                        <option value="refunded">REFUNDED</option>
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

                  <div className="pt-4 flex gap-4">
                    {selectedOrder.status === 'held' && (
                      <button 
                        onClick={() => handleRetrieveOrder(selectedOrder)}
                        className="btn-primary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest shadow-xl transition-all group"
                      >
                        <RotateCcw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-700 inline-block -mt-0.5" />
                        Restore Session
                      </button>
                    )}
                    {selectedOrder.status === 'held' && (
                      <button 
                        onClick={() => handleCancelHeldOrder(selectedOrder.id, selectedOrder.orderNumber)}
                        className="w-12 py-3 bg-danger-light border border-danger-border text-danger hover:bg-danger hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {selectedOrder.status !== 'held' && (
                      <button 
                        onClick={handleStartEdit}
                        className="btn-secondary flex-1 py-3 text-[11px] font-bold uppercase tracking-widest shadow-sm group transition-all"
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
    </div>
  );
}
