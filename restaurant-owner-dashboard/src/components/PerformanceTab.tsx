import React, { useState } from "react";
import { useStore, calculateDateLimits, toJSDate } from "../store";
import DateRangeSelector from "./DateRangeSelector";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";
import { format, isSameDay, subDays } from "date-fns";
import { TrendingUp, ShoppingBag, DollarSign, Award, Percent, Receipt, PieChartIcon, Inbox } from "lucide-react";

export default function PerformanceTab() {
  const { 
    orders, 
    orderItems, 
    expenses,
    performanceDateFilter, 
    performanceCustomRange, 
    setPerformanceFilter,
    connectionStatus
  } = useStore();

  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // loading skeleton
  if (connectionStatus === "connecting") {
    return (
      <div className="space-y-[24px] animate-pulse">
        {/* Header Skeleton */}
        <div className="pb-5 border-b border-[#E5E7EB] flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div className="space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded"></div>
            <div className="h-6 w-48 bg-gray-300 rounded"></div>
            <div className="h-3 w-56 bg-gray-200 rounded"></div>
          </div>
        </div>
        
        {/* Filter bar */}
        <div className="h-12 bg-white rounded-xl border border-[#E5E7EB]"></div>
        
        {/* KPI boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-[#E5E7EB] min-h-[114px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                  <div className="h-6 w-28 bg-gray-300 rounded"></div>
                </div>
                <div className="w-10 h-10 bg-gray-150 rounded-xl"></div>
              </div>
              <div className="h-3 w-36 bg-gray-200 rounded mt-2"></div>
            </div>
          ))}
        </div>
        
        {/* Graphs layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-[#E5E7EB] h-80 space-y-4">
              <div className="h-4 bg-gray-300 rounded w-1/3"></div>
              <div className="h-56 bg-gray-100 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Parse Date Limits
  const limits = calculateDateLimits(performanceDateFilter, performanceCustomRange);

  // Filter completed, non-canceled, non-deleted orders in date range
  const activeOrders = orders.filter(o => {
    if (o.deleted || o.cancelled) return false;
    const oDate = toJSDate(o.timestamp);
    if (limits.start && oDate < limits.start) return false;
    if (limits.end && oDate > limits.end) return false;
    return true;
  });

  const completedOrders = activeOrders.filter(o => o.status === "Completed");

  // Expenses in date range
  const activeExpenses = expenses.filter(e => {
    const eDate = toJSDate(e.date);
    if (limits.start && eDate < limits.start) return false;
    if (limits.end && eDate > limits.end) return false;
    return true;
  });

  // Calculate stats
  const totalOrders = completedOrders.length;
  const totalRevenue = parseFloat(completedOrders.reduce((acc, o) => acc + o.total, 0).toFixed(2));
  const avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0;
  
  const totalDiscountsOfCompleted = completedOrders.reduce((acc, o) => acc + (o.discount || 0), 0);
  const totalExpensesOfPeriod = activeExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Compute Top Selling Item of completed orders
  const completedOrderIds = new Set(completedOrders.map(o => o.id));
  const activeItems = orderItems.filter(oi => completedOrderIds.has(oi.orderId));
  
  const salesQtyMap: { [name: string]: number } = {};
  activeItems.forEach(item => {
    salesQtyMap[item.name] = (salesQtyMap[item.name] || 0) + item.quantity;
  });

  let topItemName = "N/A";
  let topItemQty = 0;
  Object.entries(salesQtyMap).forEach(([name, qty]) => {
    if (qty > topItemQty) {
      topItemName = name;
      topItemQty = qty;
    }
  });

  // Check if any completions logged in overall database, to check if really empty
  const hasOrdersInSystem = orders.length > 0;

  // Build a timeline of days based on limits (clamped to relative 7 days if unbounded)
  const daysInChart: Date[] = [];
  if (limits.start && limits.end) {
    const diffDays = Math.ceil(Math.abs(limits.end.getTime() - limits.start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 31) {
      const curr = new Date(limits.start);
      while (curr <= limits.end) {
        daysInChart.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // Clamped fallback to last 7 days
      for (let i = 6; i >= 0; i--) {
        daysInChart.push(subDays(new Date(), i));
      }
    }
  } else {
    // Default to last 7 days
    for (let i = 6; i >= 0; i--) {
      daysInChart.push(subDays(new Date(), i));
    }
  }

  const histogramData = daysInChart.map(day => {
    const dOrders = completedOrders.filter(o => isSameDay(toJSDate(o.timestamp), day));
    const revenue = parseFloat(dOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2));
    const volume = dOrders.length;
    return {
      date: format(day, "MMM dd"),
      revenue,
      orders: volume,
    };
  });

  // ORDER MODE PIE CHART (Dine-In, Takeaway, Delivery)
  // POS Exact Color tokens: Primary blue, Warning amber, Success green
  const types = ["Dine-In", "Takeaway", "Delivery"] as const;
  const pieColors = ["#3B82F6", "#F59E0B", "#10B981"];
  const typeRevenueMap = types.map((type, idx) => {
    const rev = parseFloat(completedOrders.filter(o => o.type === type).reduce((sum, o) => sum + o.total, 0).toFixed(2));
    return {
      name: type,
      value: rev,
      color: pieColors[idx],
    };
  }).filter(t => t.value > 0);

  const totalTypeRevenueSum = typeRevenueMap.reduce((sum, current) => sum + current.value, 0);

  // TOP 5 ITEMS BAR CHART DATA
  const top5ItemsData = Object.entries(salesQtyMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const top5Colors = ["#3B82F6", "#16A34A", "#D97706", "#DC2626", "#8B5CF6"];

  return (
    <div className="space-y-[24px]">
      {/* Header Info Banner */}
      <div className="pb-5 border-b border-[#E5E7EB] flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Business Analytics Terminal</span>
          <h2 className="text-xl md:text-2xl font-bold text-[#111827] mt-0.5">
            Performance & Insights
          </h2>
          <p className="text-[#6B7280] text-xs mt-1">
            Monitoring active operations for: <strong className="font-semibold text-[#111827]">The Downtown Bistro (Terminal A)</strong>
          </p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <DateRangeSelector
        idPrefix="perf"
        selectedFilter={performanceDateFilter}
        customRange={performanceCustomRange}
        onFilterChange={setPerformanceFilter}
      />

      {completedOrders.length === 0 && activeExpenses.length === 0 ? (
        /* Unified beautiful empty state */
        <div id="performance-empty-state" className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-4 animate-fade-in flex flex-col items-center justify-center min-h-[340px]">
          <div className="p-4.5 bg-blue-50 text-blue-500 rounded-full">
            <Inbox className="w-8 h-8" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No data found for this period</span>
            <p className="text-xs text-[#6B7280] max-w-sm mt-1 leading-relaxed">
              No registered POS activities, expenses, or kitchen transactions match the selected date limits. Try adjusting your date filter range.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-[24px] animate-fade-in">
          {/* KPI Overview Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Revenue */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Total Revenue</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {totalRevenue.toLocaleString()}</span>
                </div>
                <div className="p-2.5 bg-blue-50 text-[#3B82F6] rounded-xl shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-[#16A34A] font-bold block mt-2 uppercase tracking-wide">✓ Net Completed POS Sales</span>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Completed Orders</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">{totalOrders} tickets</span>
                </div>
                <div className="p-2.5 bg-green-50 text-[#16A34A] rounded-xl shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-[#6B7280] block mt-2 uppercase">Kitchen tickets dispatched</span>
            </div>

            {/* Average Ticket */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Avg Order Value</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {avgOrderValue}</span>
                </div>
                <div className="p-2.5 bg-amber-50 text-[#D97706] rounded-xl shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-[#6B7280] block mt-2 uppercase">Revenue per Client Guest</span>
            </div>

            {/* Top selling item */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Top Selling Item</span>
                  <span className="text-sm sm:text-base lg:text-lg font-bold text-[#111827] block mt-1.5 truncate" title={topItemName}>
                    {topItemName}
                  </span>
                </div>
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block mt-2">
                ★ {topItemQty} physical units sold
              </span>
            </div>

            {/* Total Discounts */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Discounts Applied</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {totalDiscountsOfCompleted}</span>
                </div>
                <div className="p-2.5 bg-rose-50 text-[#DC2626] rounded-xl shrink-0">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-[#6B7280] block mt-2 uppercase">Promotional price reductions</span>
            </div>

            {/* Total Expenses */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between space-x-3.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Operating Expenses</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {totalExpensesOfPeriod.toLocaleString()}</span>
                </div>
                <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[10px] text-[#6B7280] block mt-2 uppercase">Supplies & ingredient costs</span>
            </div>
          </div>

          {/* Main Graphs Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. SALES REVENUE HISTOGRAM */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
              <div className="flex justify-between items-baseline border-b border-[#E5E7EB] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Daily Net Sales Revenue</h3>
                <span className="text-[10px] text-[#6B7280] font-mono">CHRONOLOGICAL VALUE</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }} />
                    <Tooltip 
                      formatter={(value: any) => [`Rs. ${value}`, "Revenue"]}
                      contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#FFFFFF', fontSize: '12px' }}
                    />
                    <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. ORDERS PER DAY HISTOGRAM */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
              <div className="flex justify-between items-baseline border-b border-[#E5E7EB] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Daily Guest Tickets Logged</h3>
                <span className="text-[10px] text-[#6B7280] font-mono">TICKET DENSITY</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value} tickets`, "Volume"]}
                      contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#FFFFFF', fontSize: '12px' }}
                    />
                    <Bar dataKey="orders" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. CATEGORY DISTRIBUTION PIE */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Dining Mode Breakdown</h3>
                  <p className="text-[11px] text-[#6B7280]">Dine-In, Takeaway, and Delivery ratios</p>
                </div>
                <PieChartIcon className="w-4 h-4 text-[#3B82F6] shrink-0" />
              </div>
              
              {typeRevenueMap.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-[#6B7280] italic">
                  No active revenue records for dining modes
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="h-52 flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeRevenueMap}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                          onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                          onMouseLeave={() => setActivePieIndex(null)}
                        >
                          {typeRevenueMap.map((entry, index) => {
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                opacity={activePieIndex !== null && activePieIndex !== index ? 0.61 : 1}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip formatter={(val: any) => `Rs. ${val}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie Legends */}
                  <div className="space-y-2">
                    {typeRevenueMap.map((entry, idx) => {
                      const pct = totalTypeRevenueSum > 0 ? ((entry.value / totalTypeRevenueSum) * 100).toFixed(1) : "0";
                      return (
                        <div 
                          key={entry.name}
                          onMouseEnter={() => setActivePieIndex(idx)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          className={`p-2 rounded-lg border transition-all ${
                            activePieIndex === idx 
                              ? "bg-[#F7F8FA] border-[#E5E7EB]" 
                              : "border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                              <span className="text-xs font-semibold text-[#111827] uppercase tracking-wide">{entry.name}</span>
                            </div>
                            <span className="text-xs font-bold text-[#111827]">Rs. {entry.value.toLocaleString()}</span>
                          </div>
                          <div className="text-right text-[10px] text-[#6B7280] font-mono mt-0.5">
                            {pct}% of net operations
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 4. TOP 5 BEST SELLING ITEMS */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
              <div className="border-b border-[#E5E7EB] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Culinary Product Rankings</h3>
                <p className="text-[11px] text-[#6B7280]">Most frequent menu requests</p>
              </div>

              {top5ItemsData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-[#6B7280] italic">
                  No orders logged to rank kitchen output
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {top5ItemsData.map((item, index) => {
                    const maxQty = top5ItemsData[0].qty;
                    const widthPercent = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#111827]">{index + 1}. {item.name}</span>
                          <span className="font-semibold text-[#374151] bg-[#F7F8FA] px-2.5 py-0.5 rounded-full border border-[#E5E7EB] text-[10px]">
                            {item.qty} items sold
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F7F8FA] rounded-full overflow-hidden border border-[#E5E7EB]">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ 
                              width: `${widthPercent}%`,
                              backgroundColor: top5Colors[index % top5Colors.length]
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
