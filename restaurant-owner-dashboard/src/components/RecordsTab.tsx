import React, { useState } from "react";
import { useStore, calculateDateLimits, toJSDate } from "../store";
import DateRangeSelector from "./DateRangeSelector";
import { format } from "date-fns";
import { Search, Filter, ChevronDown, ChevronUp, User, ShoppingBag, Clock } from "lucide-react";
import { getRecordsDateRange } from "@/utils/businessDateCalculation";

export default function RecordsTab() {
  const {
    orders,
    orderItems,
    orderItemModifiers,
    recordsDateFilter,
    recordsCustomRange,
    recordsTypeFilter,
    recordsStatusFilter,
    recordsCashierFilter,
    recordsSearchQuery,
    setRecordsFilter,
    setRecordsTypeFilter,
    setRecordsStatusFilter,
    setRecordsCashierFilter,
    setRecordsSearchQuery,
    connectionStatus,
  } = useStore();

  // Track expanded row order IDs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // loading skeleton
  if (connectionStatus === "connecting") {
    return (
      <div className="space-y-[24px] animate-pulse">
        {/* Date Selector skeleton */}
        <div className="h-12 bg-white rounded-xl border border-[#E5E7EB]"></div>
        
        {/* Advanced Filters block skeleton */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] space-y-4">
          <div className="h-4 bg-gray-200 rounded w-40"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Row count skeleton */}
        <div className="h-4 bg-gray-200 rounded w-48"></div>
        
        {/* Table layout skeleton */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] h-96 flex flex-col p-5 justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg">
              <div className="h-3 bg-gray-300 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-28"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-300 rounded w-14"></div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="h-4 bg-gray-150 rounded w-32"></div>
                <div className="h-4 bg-gray-150 rounded w-12"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  // Setup date boundary using the business date calculation utility (04:00 AM cutoff)
  const { startDate, endDate } = getRecordsDateRange(recordsDateFilter, recordsCustomRange);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Dynamic Unique Cashiers List
  const uniqueCashiers = Array.from(
    new Set(orders.map((o) => (o?.cashier || "").trim()).filter(Boolean))
  );

  // Filter pipeline using businessDate with 04:00 AM cutoff
  const filteredOrders = orders.filter((o) => {
    // Standardize soft-delete and cancelled flags
    const oIsDeleted = !!(o?.deleted || o?.isDeleted);
    const oIsCancelled = !!(o?.cancelled || o?.isCancelled);

    // Standardize business date value to ms timestamp
    let oBusinessDateVal = o?.businessDate || o?.timestamp || o?.createdAt || new Date();
    let oBusinessDateMs = Date.now();
    if (oBusinessDateVal) {
      if (typeof oBusinessDateVal.toDate === 'function') {
        oBusinessDateMs = oBusinessDateVal.toDate().getTime();
      } else if (oBusinessDateVal.seconds !== undefined) {
        oBusinessDateMs = oBusinessDateVal.seconds * 1000;
      } else {
        const d = new Date(oBusinessDateVal);
        if (!isNaN(d.getTime())) {
          oBusinessDateMs = d.getTime();
        }
      }
    }

    // Business date boundary check
    if (oBusinessDateMs < startMs || oBusinessDateMs > endMs) return false;

    // Exclude soft-deleted and cancelled (audit logs belong in Tab 3!)
    if (oIsDeleted || oIsCancelled) return false;

    // 2. Type filter
    if (recordsTypeFilter !== "ALL" && o?.type !== recordsTypeFilter) return false;

    // 3. Status filter
    if (recordsStatusFilter !== "ALL" && o?.status !== recordsStatusFilter) return false;

    // 4. Cashier filter
    if (recordsCashierFilter !== "ALL" && (o?.cashier || "").trim() !== recordsCashierFilter) return false;

    // 5. Search query (Order number or ID)
    if (recordsSearchQuery.trim()) {
      const q = recordsSearchQuery.toLowerCase();
      const orderNoStr = (o?.orderNo || "").toLowerCase();
      const idStr = (o?.id || "").toLowerCase();
      if (!orderNoStr.includes(q) && !idStr.includes(q)) return false;
    }

    return true;
  });

  // STEP 6: Debug logs for Records Tab
  console.log('Orders for display:', filteredOrders);
  console.log('First order:', orders[0]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Quick helper to fetch and compile detailed items for an order
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
      {/* Date Frame Selector */}
      <DateRangeSelector
        idPrefix="rec"
        selectedFilter={recordsDateFilter}
        customRange={recordsCustomRange}
        onFilterChange={setRecordsFilter}
      />

      {/* Advanced Filter Criteria Hub */}
      <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#374151] uppercase tracking-wider pb-2 border-b border-[#E5E7EB]">
          <Filter className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Refine Record Ledger</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* SEARCH ORDER NO */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Search Order #</label>
            <div className="relative rounded-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <Search className="h-4 w-4" />
              </div>
              <input
                id="records-search-input"
                type="text"
                placeholder="Ex: #2041"
                value={recordsSearchQuery}
                onChange={(e) => setRecordsSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] placeholder-[#6B7280] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {/* ORDER TYPE */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Order Type</label>
            <select
              id="records-type-filter"
              value={recordsTypeFilter}
              onChange={(e: any) => setRecordsTypeFilter(e.target.value)}
              className="block w-full py-2.5 px-3 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="Dine-In">Dine-In</option>
              <option value="Takeaway">Takeaway</option>
              <option value="Delivery">Delivery</option>
            </select>
          </div>

          {/* ORDER STATUS */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Status</label>
            <select
              id="records-status-filter"
              value={recordsStatusFilter}
              onChange={(e: any) => setRecordsStatusFilter(e.target.value)}
              className="block w-full py-2.5 px-3 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="In-Progress">In-Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* OUTLET CASHIER */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Authorized Cashier</label>
            <select
              id="records-cashier-filter"
              value={recordsCashierFilter}
              onChange={(e) => setRecordsCashierFilter(e.target.value)}
              className="block w-full py-2.5 px-3 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            >
              <option value="ALL">ALL CASHIERS</option>
              {uniqueCashiers.map((cashier) => (
                <option key={cashier} value={cashier}>
                  {cashier}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row Counter Info */}
      <div className="text-xs text-[#6B7280] font-medium px-1 flex justify-between items-center">
        <span>Audited Ledger: <strong className="text-[#111827]">{filteredOrders.length} orders</strong></span>
        <span className="text-[10px] bg-[#1A1D23] text-white font-bold py-1 px-3 rounded-full uppercase tracking-wider">ACTIVE HISTORIES LEDGER</span>
      </div>

      {filteredOrders.length === 0 ? (
        <div id="records-empty-state" className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-3 animate-fade-in flex flex-col items-center justify-center min-h-[300px]">
          <div className="p-4 bg-gray-50 text-[#6B7280] rounded-full">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No data found for this period</span>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm">
              No registered orders match current search query or active filter settings. Try adjusting the filter range.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-inData">
          {/* 1. MOBILE RESPONSIVE CARDS VIEW (<768px rendered on mobile, table hidden) */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const isExpanded = expandedId === order.id;
              const manifest = getOrderManifest(order.id);
              const oTime = toJSDate(order.timestamp);
              
              return (
                <div 
                  id={`rec-mobile-card-${order.id}`}
                  key={order.id} 
                  className={`bg-white rounded-xl border transition-all overflow-hidden ${
                    isExpanded ? "border-[#3B82F6] ring-1 ring-[#3B82F6]/15 shadow-xs" : "border-[#E5E7EB]"
                  }`}
                >
                  <div 
                    onClick={() => toggleExpand(order.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F8FA]/50"
                  >
                    <div className="space-y-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#111827] text-xs">{order?.orderNo || "N/A"}</span>
                        <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-[6px] ${
                          order?.status === "Completed" ? "bg-[#16A34A] text-white" : "bg-[#D97706] text-white"
                        }`}>
                          {order?.status || "Incomplete"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] flex items-center space-x-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#6B7280]/70" />
                        <span>{format(oTime, "h:mm a")} • {order?.type || "Order"}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#111827] block">Rs. {order?.total || 0}</span>
                        <span className="text-[10px] text-[#6B7280] block font-medium">{(order?.cashier || "").trim()}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
                    </div>
                  </div>

                  {/* Expanded invoice detail on mobile */}
                  {isExpanded && (
                    <div className="bg-[#F7F8FA] p-4 border-t border-[#E5E7EB] text-xs text-[#374151] space-y-4">
                      <div className="border-b border-[#E5E7EB] pb-3 text-left">
                        <h4 className="font-bold text-[#111827] uppercase tracking-wider text-[10px] mb-3">Item Breakdown</h4>
                        <div className="space-y-2.5 bg-white p-3 rounded-lg border border-[#E5E7EB]">
                          {manifest.map((oi) => (
                            <div key={oi.id} className="space-y-1">
                              <div className="flex justify-between font-bold text-[#111827]">
                                <span>{oi.quantity}x {oi.name}</span>
                                <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                              </div>
                              {oi.modifiers.map((mod) => (
                                <div key={mod.id} className="flex justify-between text-[#6B7280] text-[10.5px] pl-4">
                                  <span>+ {mod.name}</span>
                                  <span className="font-mono">{mod.price > 0 ? `+Rs. ${mod.price}` : "Free"}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detail Invoice Summary block */}
                      <InvoiceSummary blockId={`rec-mobile-invoice-${order.id}`} order={order} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2. DESKTOP SYSTEM LEDGER VIEW (>=768px rendered, hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-5 select-none">Order #</th>
                  <th className="py-3.5 px-5 select-none animate-fade-in">Date/Time</th>
                  <th className="py-3.5 px-5 select-none">Type</th>
                  <th className="py-3.5 px-5 select-none">Items count</th>
                  <th className="py-3.5 px-5 text-right font-bold select-none">Total Invoice</th>
                  <th className="py-3.5 px-5 select-none">Handler Cashier</th>
                  <th className="py-3.5 px-5 text-center select-none">Status</th>
                  <th className="py-3.5 px-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#374151] bg-white">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const manifest = getOrderManifest(order.id);
                  const itemsCount = manifest.reduce((acc, current) => acc + current.quantity, 0);
                  const oTime = toJSDate(order.timestamp);

                  return (
                    <React.Fragment key={order.id}>
                      <tr 
                        id={`rec-row-${order.id}`}
                        onClick={() => toggleExpand(order.id)}
                        className={`hover:bg-[#F7F8FA]/35 cursor-pointer transition-colors ${
                          isExpanded ? "bg-[#3B82F6]/5" : ""
                        }`}
                      >
                        <td className="py-4 px-5 font-mono font-bold text-[#111827]">{order?.orderNo || "N/A"}</td>
                        <td className="py-4 px-5 font-mono text-[#6B7280]">{format(oTime, "yyyy-MM-dd HH:mm")}</td>
                        <td className="py-4 px-5 font-bold uppercase tracking-wider text-[11px] text-[#374151]">{order?.type || "Order"}</td>
                        <td className="py-4 px-5 font-mono">{itemsCount} units</td>
                        <td className="py-4 px-5 font-bold text-right text-[#111827] text-xs">Rs. {order?.total || 0}</td>
                        <td className="py-4 px-5 font-medium">{order?.cashier || "N/A"}</td>
                        <td className="py-4 px-5 text-center">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-[6px] ${
                            order?.status === "Completed" ? "bg-[#16A34A] text-white" : "bg-[#D97706] text-white"
                          }`}>
                            {order?.status || "Incomplete"}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-mono">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280] inline animate-fade-in" /> : <ChevronDown className="w-4 h-4 text-[#6B7280] inline animate-fade-in" />}
                        </td>
                      </tr>

                      {/* Expanded Row Ledger Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-[#F7F8FA]/60 p-5 border-y border-[#E5E7EB]">
                            <div className="grid grid-cols-2 gap-6 mx-4">
                              {/* Left box: Meals */}
                              <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs text-left animate-fade-in">
                                <h4 className="font-bold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-2 mb-3">
                                  Ordered Items
                                </h4>
                                <div className="space-y-3">
                                  {manifest.map((oi) => (
                                    <div key={oi.id} className="space-y-0.5">
                                      <div className="flex justify-between font-semibold text-[#111827] text-xs">
                                        <span>{oi.quantity}x {oi.name} <span className="text-[10px] text-[#6B7280] font-normal">(Rs. {oi.price} ea)</span></span>
                                        <span className="font-mono text-[#111827]">Rs. {(oi.price * oi.quantity).toFixed(2)}</span>
                                      </div>
                                      
                                      {/* Modifiers checklist */}
                                      {oi.modifiers.map((mod) => (
                                        <div key={mod.id} className="flex justify-between text-[#6B7280] text-[10.5px] pl-5 pb-0.5">
                                          <span>+ Modifier: {mod.name}</span>
                                          <span className="font-mono">{mod.price > 0 ? `+Rs. ${mod.price}` : "Free"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Right box: Invoice totals panel */}
                              <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4 text-left animate-fade-in">
                                <h4 className="font-bold text-[#111827] uppercase tracking-wider text-[11px] border-b border-[#E5E7EB] pb-2 mb-3">
                                  Order Audits & Invoicing Summary
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-2.5 text-xs text-[#6B7280] border-b border-[#E5E7EB] pb-2.5">
                                    <User className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                                    <span>Authorized Cashier Agent: <strong className="text-[#111827] font-bold">{order?.cashier || "N/A"}</strong></span>
                                  </div>
                                  
                                  <InvoiceSummary blockId={`rec-desktop-invoice-${order.id}`} order={order} />
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
      )}
    </div>
  );
}

// Invoice Summary layout component to avoid repeating Code
function InvoiceSummary({ blockId, order }: { blockId: string; order: any }) {
  const totalVal = order?.total || 0;
  const discountVal = order?.discount || 0;
  const taxVal = order?.tax || 0;
  const deliveryVal = order?.deliveryCharge || 0;
  // Subtotal = total - tax - delivery + discount
  const calculatedSubtotal = parseFloat((totalVal - taxVal - deliveryVal + discountVal).toFixed(2));

  return (
    <div id={blockId} className="space-y-2 text-xs text-[#374151]">
      <div className="flex justify-between text-[#6B7280]">
        <span className="uppercase tracking-wider text-[10px]">Cart Subtotal</span>
        <span className="font-mono font-medium">Rs. {calculatedSubtotal.toFixed(2)}</span>
      </div>
      
      {discountVal > 0 && (
        <div className="flex justify-between text-[#DC2626] font-medium">
          <span className="uppercase tracking-wider text-[10px]">Promo Discount</span>
          <span className="font-mono">-Rs. {discountVal.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between text-[#6B7280]">
        <span className="uppercase tracking-wider text-[10px]">Sales Tax (8%)</span>
        <span className="font-mono">Rs. {taxVal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-[#6B7280]">
        <span className="uppercase tracking-wider text-[10px]">Delivery Charge</span>
        <span className="font-mono">Rs. {deliveryVal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-[#111827] font-bold border-t border-[#E5E7EB] pt-2 text-xs mt-1">
        <span className="uppercase tracking-wider">Net Order Total</span>
        <span className="font-mono font-bold text-sm text-[#111827]">Rs. {totalVal}</span>
      </div>
    </div>
  );
}
