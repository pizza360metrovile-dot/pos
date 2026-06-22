import React, { useState } from "react";
import { useStore, calculateDateLimits, toJSDate } from "../store";
import DateRangeSelector from "./DateRangeSelector";
import { format } from "date-fns";
import { Trash2, AlertTriangle, ChevronDown, ChevronUp, BookOpen, ShieldAlert, Inbox } from "lucide-react";

export default function DeletedTab() {
  const {
    orders,
    orderItems,
    orderItemModifiers,
    deletedDateFilter,
    deletedCustomRange,
    deletedSubTab,
    setDeletedFilter,
    setDeletedSubTab,
    connectionStatus
  } = useStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // loading skeleton
  if (connectionStatus === "connecting") {
    return (
      <div className="space-y-[24px] animate-pulse">
        {/* Date Filter selector skeleton */}
        <div className="h-12 bg-white rounded-xl border border-[#E5E7EB]"></div>

        {/* KPI boxes skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-[#E5E7EB] min-h-[114px] flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-7 w-24 bg-gray-300 rounded"></div>
              </div>
              <div className="h-3 w-28 bg-gray-150 rounded mt-2"></div>
            </div>
          ))}
        </div>

        {/* Sub-Tabs selector skeleton */}
        <div className="h-11 bg-gray-100 rounded-xl border border-[#E5E7EB]"></div>

        {/* Main List skeleton */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] h-80 flex flex-col p-5 justify-between">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-150 rounded w-40"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="h-4 bg-gray-200 rounded w-28"></div>
        </div>
      </div>
    );
  }

  const limits = calculateDateLimits(deletedDateFilter, deletedCustomRange);

  // Filter cancelled orders (Cancelled KOTs)
  const allCancelled = orders.filter((o) => o.cancelled === true);
  const filteredCancelled = allCancelled.filter((o) => {
    const oDate = toJSDate(o.timestamp);
    if (limits.start && oDate < limits.start) return false;
    if (limits.end && oDate > limits.end) return false;
    return true;
  });

  // Filter soft-deleted completed orders
  const allDeletedCompleted = orders.filter((o) => o.deleted === true);
  const filteredDeletedCompleted = allDeletedCompleted.filter((o) => {
    const oDate = toJSDate(o.timestamp);
    if (limits.start && oDate < limits.start) return false;
    if (limits.end && oDate > limits.end) return false;
    return true;
  });

  // Overall Statistics for Summary Cards (based on active date range)
  const totalCancelledCount = filteredCancelled.length;
  const totalCancelledSum = parseFloat(filteredCancelled.reduce((acc, o) => acc + o.total, 0).toFixed(2));
  const totalDeletedCount = filteredDeletedCompleted.length;
  const totalDeletedSum = parseFloat(filteredDeletedCompleted.reduce((acc, o) => acc + o.total, 0).toFixed(2));

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getOrderManifest = (orderId: string) => {
    let items = orderItems.filter((oi) => {
      const oId = oi.orderId || (oi as any).orderID || (oi as any).order_id;
      return oId === orderId;
    });

    if (items.length === 0) {
      const matchingOrder = orders.find((o) => o.id === orderId);
      const embedded = (matchingOrder as any)?.items || (matchingOrder as any)?.orderItems || (matchingOrder as any)?.products || [];
      if (Array.isArray(embedded)) {
        items = embedded.map((item: any, idx: number) => ({
          id: item.id || `${orderId}-item-${idx}`,
          orderId,
          name: item.name || item.itemName || item.title || "Unknown Item",
          quantity: Number(item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 1)),
          price: Number(item.price !== undefined ? item.price : (item.cost !== undefined ? item.cost : 0)),
          category: item.category || ""
        }));
      }
    }

    return items.map((item) => {
      const modifiers = orderItemModifiers.filter((mod) => {
        const oiId = mod.orderItemId || (mod as any).orderItem_id || (mod as any).orderitem_id;
        return oiId === item.id;
      });
      return { ...item, modifiers };
    });
  };

  return (
    <div className="space-y-[24px] animate-fade-in">
      {/* Date filter selector */}
      <DateRangeSelector
        idPrefix="del"
        selectedFilter={deletedDateFilter}
        customRange={deletedCustomRange}
        onFilterChange={setDeletedFilter}
      />

      {/* Audit Summary Statistics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cancelled Count */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs hover:border-[#DC2626]/50 transition-all duration-300 animate-fade-in flex flex-col justify-between min-h-[114px] h-auto text-left">
          <div>
            <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Cancelled KOTs</span>
            <span className="text-xl sm:text-2xl lg:text-2xl font-bold text-[#111827] mt-1.5 block break-all">{totalCancelledCount} tickets</span>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2">Kitchen prep cancellations</span>
        </div>

        {/* Cancelled Value */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs hover:border-[#DC2626]/50 transition-all duration-300 animate-fade-in flex flex-col justify-between min-h-[114px] h-auto text-left">
          <div>
            <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Cancellation Value</span>
            <span className="text-xl sm:text-2xl lg:text-2xl font-bold text-[#DC2626] mt-1.5 block break-all">Rs. {totalCancelledSum.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2">Wasted food & materials</span>
        </div>

        {/* Deleted Count */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs hover:border-[#D97706]/50 transition-all duration-300 animate-fade-in flex flex-col justify-between min-h-[114px] h-auto text-left">
          <div>
            <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Deleted Completed</span>
            <span className="text-xl sm:text-2xl lg:text-2xl font-bold text-[#111827] mt-1.5 block break-all">{totalDeletedCount} tickets</span>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2">Closed invoice voidings</span>
        </div>

        {/* Deleted Value */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs hover:border-[#D97706]/50 transition-all duration-300 animate-fade-in flex flex-col justify-between min-h-[114px] h-auto text-left">
          <div>
            <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Refunded Voids Value</span>
            <span className="text-xl sm:text-2xl lg:text-2xl font-bold text-[#D97706] mt-1.5 block break-all">Rs. {totalDeletedSum.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2">Voided sales registry sum</span>
        </div>
      </div>

      {/* Audit Sub-Tabs Toggle Row */}
      <div className="flex bg-[#F7F8FA] p-1 rounded-xl border border-[#E5E7EB] gap-1">
        <button
          id="deleted-subtab-kot-btn"
          onClick={() => {
            setDeletedSubTab("CANCELLED_KOT");
            setExpandedId(null);
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide cursor-pointer transition-all flex items-center justify-center space-x-2 uppercase outline-none ${
            deletedSubTab === "CANCELLED_KOT"
              ? "bg-white text-[#3B82F6] border border-[#E5E7EB] shadow-xs"
              : "text-[#6B7280] hover:text-[#374151]"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
          <span>Cancelled KOTs ({filteredCancelled.length})</span>
        </button>

        <button
          id="deleted-subtab-completed-btn"
          onClick={() => {
            setDeletedSubTab("DELETED_COMPLETED");
            setExpandedId(null);
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide cursor-pointer transition-all flex items-center justify-center space-x-2 uppercase outline-none ${
            deletedSubTab === "DELETED_COMPLETED"
              ? "bg-white text-[#3B82F6] border border-[#E5E7EB] shadow-xs"
              : "text-[#6B7280] hover:text-[#374151]"
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Deleted Completed ({filteredDeletedCompleted.length})</span>
        </button>
      </div>

      {/* Main Lists Container */}
      <div className="animate-fade-in font-sans">
        {deletedSubTab === "CANCELLED_KOT" ? (
          /* SUB-TAB 1: CANCELLED KOTs */
          filteredCancelled.length === 0 ? (
            <div id="cancelled-empty-state" className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-3 flex flex-col items-center justify-center min-h-[300px] animate-fade-in">
              <div className="p-4 bg-gray-50 text-[#6B7280] rounded-full">
                <AlertTriangle className="w-8 h-8 text-[#DC2626]/70" />
              </div>
              <div>
                <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No cancelled kitchen tickets in this period</span>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm">Zero tickets were cancelled during prep chef phases.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile cards view (<768px for mobiles, hides table) */}
              <div className="md:hidden space-y-3">
                {filteredCancelled.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const manifest = getOrderManifest(order.id);
                  const cxTime = toJSDate(order.cancelledAt || order.timestamp);

                  return (
                    <div 
                      id={`cx-kot-mobile-card-${order.id}`}
                      key={order.id}
                      className={`bg-white rounded-xl border overflow-hidden transition-all duration-250 text-left ${
                        isExpanded ? "border-[#DC2626] ring-1 ring-[#DC2626]/12 shadow-xs" : "border-[#E5E7EB]"
                      }`}
                    >
                      <div 
                        onClick={() => toggleExpand(order.id)}
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#F7F8FA]/50"
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-[#111827] text-xs">{order.orderNo}</span>
                            <span className="bg-red-50 border border-red-100 text-[#DC2626] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">KILLED KOT</span>
                          </div>
                          <p className="text-xs text-[#6B7280] truncate italic">
                            Reason: {order.cancelledReason}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-[#111827] block">Rs. {order.total}</span>
                            <span className="text-[10px] text-[#6B7280] block font-mono">{format(cxTime, "MMM dd HH:mm")}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#F7F8FA] p-4 border-t border-[#E5E7EB] space-y-4 text-xs text-[#374151]">
                          <div className="space-y-1.5 bg-white p-3.5 border border-[#E5E7EB] rounded-lg">
                            <div className="flex items-center space-x-1.5 font-bold text-[#111827] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
                              <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
                              <span>Audit Cancellation Details</span>
                            </div>
                            <p className="mt-2"><strong className="text-[#111827] font-semibold text-[10px] uppercase block mb-0.5">Reason:</strong> {order.cancelledReason}</p>
                            <p className="text-xs"><strong className="text-[#374151]">Cancelled By:</strong> {order.cancelledBy || "N/A"}</p>
                            <p className="font-mono text-xs"><strong className="text-[#374151] font-sans">Killed At:</strong> {format(cxTime, "yyyy-MM-dd HH:mm:ss")}</p>
                          </div>

                          <div className="space-y-2 bg-white p-3 border border-[#E5E7EB] rounded-lg">
                            <h4 className="font-semibold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-1.5">Meals Sent To Kitchen</h4>
                            {manifest.map((oi) => (
                              <div key={oi.id} className="flex justify-between font-medium py-0.5 text-xs">
                                <span>{oi.quantity}x {oi.name}</span>
                                <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tablet/Desktop Master Table (>=768px) */}
              <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-5">Order #</th>
                      <th className="py-3 px-5">Created At</th>
                      <th className="py-3 px-4">Items Count</th>
                      <th className="py-3 px-5 text-right font-bold">Original Total</th>
                      <th className="py-3 px-5">Cancelled At</th>
                      <th className="py-3 px-5">Voided By</th>
                      <th className="py-3 px-5">Reason</th>
                      <th className="py-3 px-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#374151] bg-white">
                    {filteredCancelled.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const manifest = getOrderManifest(order.id);
                      const itemsCount = manifest.reduce((acc, curr) => acc + curr.quantity, 0);
                      const createTime = toJSDate(order.timestamp);
                      const cxTime = toJSDate(order.cancelledAt || order.timestamp);

                      return (
                        <React.Fragment key={order.id}>
                          <tr 
                            id={`cx-row-${order.id}`}
                            onClick={() => toggleExpand(order.id)}
                            className={`hover:bg-[#F7F8FA]/35 cursor-pointer transition-colors ${
                              isExpanded ? "bg-[#DC2626]/5" : ""
                            }`}
                          >
                            <td className="py-3.5 px-5 font-mono font-bold text-[#111827]">{order.orderNo}</td>
                            <td className="py-3.5 px-5 font-mono text-[#6B7280]">{format(createTime, "yyyy-MM-dd HH:mm")}</td>
                            <td className="py-3.5 px-4 font-mono">{itemsCount} pieces</td>
                            <td className="py-3.5 px-5 font-bold text-right text-[#111827]">Rs. {order.total}</td>
                            <td className="py-3.5 px-5 font-mono text-[#6B7280]">{format(cxTime, "yyyy-MM-dd HH:mm")}</td>
                            <td className="py-3.5 px-5 font-semibold text-[#111827]">{order.cancelledBy || "Cashier"}</td>
                            <td className="py-3.5 px-5 max-w-xs truncate text-[11px] text-[#6B7280] italic" title={order.cancelledReason}>
                              {order.cancelledReason}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280] inline" /> : <ChevronDown className="w-4 h-4 text-[#6B7280] inline" />}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-[#F7F8FA]/60 p-5 border-y border-[#E5E7EB]">
                                <div className="grid grid-cols-2 gap-6 text-xs text-[#374151] mx-4">
                                  {/* Left: cancellation logs */}
                                  <div className="space-y-2 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs text-left">
                                    <div className="flex items-center space-x-2 text-[#111827] font-bold uppercase tracking-wider text-[10px] border-b border-[#E5E7EB] pb-2">
                                      <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
                                      <span>Security Audit Record</span>
                                    </div>
                                    <p className="mt-2 text-[#374151]"><strong className="text-[#111827] font-semibold block uppercase text-[10px] tracking-wide mb-0.5">Detailed Reason:</strong> {order.cancelledReason}</p>
                                    <p className="text-xs"><strong className="text-[#111827]">Authorized Action By:</strong> {order.cancelledBy}</p>
                                    <p className="text-xs"><strong className="text-[#111827]">Cashier Node:</strong> {order.cashier}</p>
                                  </div>

                                  {/* Right: components */}
                                  <div className="space-y-2 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs text-left">
                                    <h5 className="font-semibold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-2">
                                      Items sent to kitchen (Killed Ticket)
                                    </h5>
                                    <div className="space-y-3 pt-1">
                                      {manifest.map((oi) => (
                                        <div key={oi.id} className="space-y-0.5">
                                          <div className="flex justify-between font-bold text-[#111827]">
                                            <span>{oi.quantity}x {oi.name}</span>
                                            <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                                          </div>
                                          {oi.modifiers.map((m) => (
                                            <div key={m.id} className="flex justify-between text-[10.5px] text-[#6B7280] pl-4">
                                              <span>+ Modifier: {m.name}</span>
                                              <span>{m.price > 0 ? `+Rs. ${m.price}` : "Free"}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* SUB-TAB 2: DELETED COMPLETED */
          filteredDeletedCompleted.length === 0 ? (
            <div id="deleted-empty-state" className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-3 flex flex-col items-center justify-center min-h-[300px] animate-fade-in">
              <div className="p-4 bg-gray-50 text-[#6B7280] rounded-full">
                <Trash2 className="w-8 h-8 text-[#D97706]/70" />
              </div>
              <div>
                <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No deleted completed transactions in this period</span>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm">Zero soft-deleted void transactions found.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile cards view (<768px) */}
              <div className="md:hidden space-y-3">
                {filteredDeletedCompleted.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const manifest = getOrderManifest(order.id);
                  const delTime = toJSDate(order.deletedAt || order.timestamp);

                  return (
                    <div 
                      id={`del-completed-mobile-card-${order.id}`}
                      key={order.id}
                      className={`bg-white rounded-xl border overflow-hidden transition-all duration-250 text-left ${
                        isExpanded ? "border-[#D97706] ring-1 ring-[#D97706]/12 shadow-xs" : "border-[#E5E7EB]"
                      }`}
                    >
                      <div 
                        onClick={() => toggleExpand(order.id)}
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#F7F8FA]/50"
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-[#111827] text-xs">{order.orderNo}</span>
                            <span className="bg-amber-50 border border-amber-100 text-[#D97706] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">TICKET VOIDED</span>
                          </div>
                          <p className="text-xs text-[#6B7280] truncate italic">
                            Void Reason: {order.deletedReason}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-[#111827] block">Rs. {order.total}</span>
                            <span className="text-[10px] text-[#6B7280] block font-mono">{format(delTime, "MMM dd HH:mm")}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#F7F8FA] p-4 border-t border-[#E5E7EB] space-y-4 text-xs text-[#374151]">
                          <div className="space-y-1.5 bg-white p-3.5 border border-[#E5E7EB] rounded-lg">
                            <div className="flex items-center space-x-1.5 font-bold text-[#111827] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
                              <ShieldAlert className="w-4 h-4 text-[#D97706]" />
                              <span>Audit Transaction Deletion</span>
                            </div>
                            <p className="mt-2"><strong className="text-[#111827] font-semibold text-[10px] uppercase block mb-0.5">Reason:</strong> {order.deletedReason}</p>
                            <p className="text-xs"><strong className="text-[#374151]">Deleted By:</strong> {order.deletedBy || "Manager"}</p>
                            <p className="font-mono text-xs"><strong className="text-[#374151] font-sans">Killed At:</strong> {format(delTime, "yyyy-MM-dd HH:mm:ss")}</p>
                          </div>

                          <div className="space-y-2 bg-white p-3 border border-[#E5E7EB] rounded-lg">
                            <h4 className="font-semibold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-1.5">Voided Items and Prices</h4>
                            {manifest.map((oi) => (
                              <div key={oi.id} className="flex justify-between font-medium py-0.5 text-xs">
                                <span>{oi.quantity}x {oi.name}</span>
                                <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table view (>=768px for laptop tables) */}
              <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-5">Order #</th>
                      <th className="py-3 px-5">Date/Time Created</th>
                      <th className="py-3 px-5 text-right font-bold">Total Value Voided</th>
                      <th className="py-3 px-5">Deleted At</th>
                      <th className="py-3 px-5">Deleted By</th>
                      <th className="py-3 px-5">Authorized Reason</th>
                      <th className="py-3 px-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#374151] bg-white">
                    {filteredDeletedCompleted.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const manifest = getOrderManifest(order.id);
                      const createTime = toJSDate(order.timestamp);
                      const delTime = toJSDate(order.deletedAt || order.timestamp);

                      return (
                        <React.Fragment key={order.id}>
                          <tr 
                            id={`del-row-${order.id}`}
                            onClick={() => toggleExpand(order.id)}
                            className={`hover:bg-[#F7F8FA]/35 cursor-pointer transition-colors ${
                              isExpanded ? "bg-[#D97706]/5" : ""
                            }`}
                          >
                            <td className="py-3.5 px-5 font-mono font-bold text-[#111827]">{order.orderNo}</td>
                            <td className="py-3.5 px-5 font-mono text-[#6B7280]">{format(createTime, "yyyy-MM-dd HH:mm")}</td>
                            <td className="py-3.5 px-5 font-bold text-[#111827] text-right pr-8">${order.total}</td>
                            <td className="py-3.5 px-5 font-mono text-[#6B7280]">{format(delTime, "yyyy-MM-dd HH:mm")}</td>
                            <td className="py-3.5 px-5 font-semibold text-[#111827]">{order.deletedBy || "Supervisor"}</td>
                            <td className="py-3.5 px-5 max-w-xs truncate text-[11px] text-[#6B7280] italic" title={order.deletedReason}>
                              {order.deletedReason}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280] inline" /> : <ChevronDown className="w-4 h-4 text-[#6B7280] inline" />}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-[#F7F8FA]/60 p-5 border-y border-[#E5E7EB]">
                                <div className="grid grid-cols-2 gap-6 text-xs text-[#374151] mx-4">
                                  {/* Left details */}
                                  <div className="space-y-2 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs text-left">
                                    <div className="flex items-center space-x-2 text-[#111827] font-bold uppercase tracking-wider text-[10px] border-b border-[#E5E7EB] pb-2">
                                      <ShieldAlert className="w-4 h-4 text-[#D97706]" />
                                      <span>Void Authorization Record</span>
                                    </div>
                                    <p className="mt-2 text-[#374151]"><strong className="text-[#111827] font-semibold block uppercase tracking-wider text-[10px] mb-0.5">Reason for Voiding:</strong> {order.deletedReason}</p>
                                    <p className="text-xs"><strong className="text-[#111827]">Supervisor Voiding Ticket:</strong> {order.deletedBy}</p>
                                    <p className="text-xs"><strong className="text-[#111827]">Filing Cashier:</strong> {order.cashier}</p>
                                  </div>

                                  {/* Right details */}
                                  <div className="space-y-2 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs text-left">
                                    <h5 className="font-semibold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-2">
                                      Voided Items and Invoice Totals
                                    </h5>
                                    <div className="space-y-3 pt-1">
                                      {manifest.map((oi) => (
                                        <div key={oi.id} className="space-y-0.5">
                                          <div className="flex justify-between font-bold text-[#111827]">
                                            <span>{oi.quantity}x {oi.name}</span>
                                            <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                                          </div>
                                          {oi.modifiers.map((m) => (
                                            <div key={m.id} className="flex justify-between text-[10.5px] text-[#6B7280] pl-4">
                                              <span>+ Modifier: {m.name}</span>
                                              <span>{m.price > 0 ? `+Rs. ${m.price}` : "Free"}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                      
                                      {/* Tiny Invoice block */}
                                      <div className="border-t border-[#E5E7EB] pt-2 space-y-1 text-xs text-[#6B7280]">
                                        <div className="flex justify-between text-[11px]">
                                          <span className="uppercase tracking-wider">Tax (8%)</span>
                                          <span className="font-mono font-medium">Rs. {order.tax}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-[#111827] border-t border-[#E5E7EB] pt-1.5 mt-1 text-xs">
                                          <span className="uppercase tracking-wider">Voided Sum Total</span>
                                          <span className="font-mono font-bold text-[#111827]">Rs. {order.total}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
