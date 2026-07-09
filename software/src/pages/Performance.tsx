/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Calendar, 
  ShoppingBag,
  DollarSign
} from 'lucide-react';
import { useStore, DEFAULT_SETTINGS } from '../store/useStore';
import { getRecordsDateRange } from '../utils/businessDayCalculation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

const COLORS = {
  'Dine-In': '#3B82F6',
  'Takeaway': '#F59E0B',
  'Delivery': '#10B981'
};

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981'];

export default function PerformanceTab() {
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const settingsObj = useLiveQuery(() => db.settings.where({ key: 'main' }).first());
  const settings = settingsObj?.value || DEFAULT_SETTINGS;

  // Filters State
  const [selectedRange, setSelectedRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'allTime' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  // Currency Formatter matching the application's configuration
  const formatCurrency = (amount: number) => {
    const symbol = settings?.currency || 'Rs.';
    const formattedAmount = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (settings?.currencyPosition === 'after') {
      return `${formattedAmount} ${symbol}`;
    }
    return `${symbol} ${formattedAmount}`;
  };

  // Compute startDate and endDate based on chosen range
  const dateBounds = useMemo(() => {
    if (selectedRange === 'custom') {
      if (appliedCustomRange) {
        return { startDate: appliedCustomRange.start, endDate: appliedCustomRange.end };
      }
      // Fallback if custom date range is not applied yet
      const start = new Date(customStart);
      start.setHours(4, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(27, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    
    // getRecordsDateRange expects standard period strings
    const period = selectedRange === 'allTime' ? 'all' : selectedRange;
    return getRecordsDateRange(period);
  }, [selectedRange, appliedCustomRange, customStart, customEnd]);

  // Filter orders according to date range and status
  const filteredOrders = useMemo(() => {
    const { startDate, endDate } = dateBounds;
    
    return orders.filter(order => {
      if (order.isCancelled || order.isDeleted) return false;
      if (order.status !== 'completed') return false;
      
      const orderTimestamp = order.completedAt || order.createdAt;
      if (!orderTimestamp) return false;
      
      // Calculate business day of order
      const orderDate = new Date(orderTimestamp);
      const cutoffTime = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate(),
        4, 0, 0, 0
      );
      
      let orderBusinessDayStart: number;
      if (orderTimestamp >= cutoffTime.getTime()) {
        orderBusinessDayStart = cutoffTime.getTime();
      } else {
        const prevDay = new Date(
          orderDate.getFullYear(),
          orderDate.getMonth(),
          orderDate.getDate() - 1,
          4, 0, 0, 0
        );
        orderBusinessDayStart = prevDay.getTime();
      }
      
      return orderBusinessDayStart >= startDate.getTime() && 
             orderBusinessDayStart <= endDate.getTime();
    });
  }, [orders, dateBounds]);

  // Metric: Total Revenue
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  }, [filteredOrders]);

  // Chart 1 Data: Daily Net Sales Revenue sorted chronologically
  const dailyRevenueData = useMemo(() => {
    const chronologicalMap: Map<string, { date: Date; revenue: number }> = new Map();
    
    filteredOrders.forEach(order => {
      const orderTimestamp = order.completedAt || order.createdAt;
      if (!orderTimestamp) return;
      
      const orderDate = new Date(orderTimestamp);
      const cutoffTime = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate(),
        4, 0, 0, 0
      );
      
      let businessDay: Date;
      if (orderTimestamp >= cutoffTime.getTime()) {
        businessDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 0, 0, 0, 0);
      } else {
        businessDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate() - 1, 0, 0, 0, 0);
      }
      
      const key = businessDay.getTime().toString();
      const existing = chronologicalMap.get(key);
      if (existing) {
        existing.revenue += (order.total || 0);
      } else {
        chronologicalMap.set(key, { date: businessDay, revenue: (order.total || 0) });
      }
    });
    
    return Array.from(chronologicalMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(item => {
        const day = item.date.getDate();
        const month = item.date.toLocaleString('default', { month: 'short' });
        return {
          date: `${day} ${month}`,
          revenue: Math.round(item.revenue * 100) / 100
        };
      });
  }, [filteredOrders]);

  // Chart 2 Data: Top 10 products by quantity sold
  const productQuantityData = useMemo(() => {
    const qtyMap: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      if (!order.items) return;
      order.items.forEach(item => {
        const name = item.name || 'Unknown Product';
        qtyMap[name] = (qtyMap[name] || 0) + (item.quantity || 0);
      });
    });
    
    return Object.keys(qtyMap)
      .map(name => ({
        name,
        quantity: qtyMap[name]
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [filteredOrders]);

  // Chart 3 Data: Percentage breakdown of order types
  const orderTypeRatioData = useMemo(() => {
    const counts: Record<string, number> = {
      'Dine-In': 0,
      'Takeaway': 0,
      'Delivery': 0
    };
    
    filteredOrders.forEach(order => {
      const type = order.type || 'takeaway';
      const formattedType = type.toLowerCase();
      if (formattedType.includes('dine')) {
        counts['Dine-In']++;
      } else if (formattedType.includes('deliver')) {
        counts['Delivery']++;
      } else {
        counts['Takeaway']++;
      }
    });
    
    const total = filteredOrders.length;
    
    return Object.keys(counts).map(name => {
      const val = counts[name];
      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
      return {
        name,
        value: val,
        percentage: pct
      };
    });
  }, [filteredOrders]);

  // Chart 4 Data: Top 10 products by revenue generated
  const productRevenueData = useMemo(() => {
    const revMap: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      if (!order.items) return;
      order.items.forEach(item => {
        const name = item.name || 'Unknown Product';
        const itemRevenue = (item.quantity || 0) * (item.price || 0);
        revMap[name] = (revMap[name] || 0) + itemRevenue;
      });
    });
    
    return Object.keys(revMap)
      .map(name => ({
        name,
        revenue: Math.round(revMap[name] * 100) / 100
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredOrders]);

  // Handle custom range application
  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(customStart);
    start.setHours(4, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(27, 59, 59, 999);
    setAppliedCustomRange({ start, end });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto bg-bg-app min-h-screen">
      {/* Header section with Title and Date Filtering */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-bg-surface p-4 md:p-6 rounded-2xl border border-border-light shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">Performance Analytics</h1>
          <p className="text-sm text-text-muted mt-1">Real-time sales, product performance, and channel breakdown</p>
        </div>
        
        {/* Filter buttons */}
        <div className="flex flex-col gap-3 w-full lg:w-auto">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 bg-bg-surface-2 p-1 rounded-xl border border-border-light overflow-x-auto max-w-full pb-2 sm:pb-1 select-none">
            {(['today', 'yesterday', 'week', 'month', 'allTime', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setSelectedRange(range);
                  if (range !== 'custom') {
                    setAppliedCustomRange(null);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${
                  selectedRange === range
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-surface-3'
                }`}
              >
                {range === 'allTime' ? 'All Time' : range}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {selectedRange === 'custom' && (
            <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-center gap-2 bg-bg-surface-2 p-3 rounded-xl border border-border-light">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">From</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-bg-surface border border-border-light text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">To</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-bg-surface border border-border-light text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                className="bg-accent hover:bg-accent-hover text-white text-xs font-bold uppercase px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Stats Section with Total Revenue Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0">
            <TrendingUp className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div>
            <span className="block text-xs font-bold text-text-muted uppercase tracking-wider">Total Revenue</span>
            <span className="block text-xl md:text-3xl font-black text-text-primary mt-1 tracking-tight">
              {formatCurrency(totalRevenue)}
            </span>
            <span className="block text-[10px] md:text-xs text-text-muted mt-0.5">
              From {filteredOrders.length} completed {filteredOrders.length === 1 ? 'order' : 'orders'}
            </span>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-success/10 rounded-xl flex items-center justify-center text-success shrink-0">
            <ShoppingBag className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div>
            <span className="block text-xs font-bold text-text-muted uppercase tracking-wider">Completed Orders</span>
            <span className="block text-xl md:text-3xl font-black text-text-primary mt-1 tracking-tight">
              {filteredOrders.length}
            </span>
            <span className="block text-[10px] md:text-xs text-text-muted mt-0.5">
              Across selected date range
            </span>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-warning/10 rounded-xl flex items-center justify-center text-warning shrink-0">
            <DollarSign className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div>
            <span className="block text-xs font-bold text-text-muted uppercase tracking-wider">Average Order Value</span>
            <span className="block text-xl md:text-3xl font-black text-text-primary mt-1 tracking-tight">
              {formatCurrency(filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0)}
            </span>
            <span className="block text-[10px] md:text-xs text-text-muted mt-0.5">
              Mean value per ticket
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1 - Daily Net Sales Revenue */}
        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">Daily Net Sales Revenue</h2>
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="h-[260px] md:h-[300px] w-full">
            {dailyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280" 
                    fontSize={11} 
                    fontFamily="Inter"
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    fontSize={11} 
                    fontFamily="Inter"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `Rs ${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px' }}
                    formatter={(value: any) => [`Rs ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3B82F6" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 1 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <span className="text-sm font-semibold">No data available</span>
                <span className="text-xs">Try selecting a different date range</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2 - Product Rankings by Qty Sold */}
        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">Product Rankings (Qty Sold)</h2>
            <BarChart3 className="w-5 h-5 text-success" />
          </div>
          <div className="h-[260px] md:h-[300px] w-full">
            {productQuantityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productQuantityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6B7280" 
                    fontSize={10} 
                    fontFamily="Inter"
                    tickLine={false}
                    tickFormatter={(val) => val.length > 12 ? `${val.slice(0, 10)}...` : val}
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    fontSize={11} 
                    fontFamily="Inter"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px' }}
                    formatter={(value: any) => [`${value} units`, 'Qty Sold']}
                  />
                  <Bar dataKey="quantity" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <span className="text-sm font-semibold">No data available</span>
                <span className="text-xs">Try selecting a different date range</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 3 - Order Type Distribution (Pie) */}
        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">Order Type Distribution</h2>
            <PieChartIcon className="w-5 h-5 text-warning" />
          </div>
          <div className="h-full min-h-[260px] md:min-h-[300px] w-full flex flex-col justify-center">
            {filteredOrders.length > 0 ? (
              <div className="h-full flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="w-40 h-40 md:w-48 md:h-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderTypeRatioData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {orderTypeRatioData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[entry.name as keyof typeof COLORS] || PIE_COLORS[index % PIE_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px' }}
                        formatter={(value: any, name: any, props: any) => [`${value} orders (${props.payload.percentage}%)`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Custom Legend for order type distribution */}
                <div className="space-y-3 shrink-0 grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-0">
                  {orderTypeRatioData.map((type, idx) => (
                    <div key={type.name} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full shrink-0" 
                        style={{ backgroundColor: COLORS[type.name as keyof typeof COLORS] || PIE_COLORS[idx % PIE_COLORS.length] }} 
                      />
                      <div>
                        <span className="block text-xs font-bold text-text-primary">{type.name}</span>
                        <span className="block text-[10px] md:text-[11px] text-text-muted">
                          {type.value} ({type.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted py-12">
                <span className="text-sm font-semibold">No data available</span>
                <span className="text-xs">Try selecting a different date range</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 4 - Top Products by Revenue */}
        <div className="bg-bg-surface border border-border-light rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <h2 className="text-base font-bold text-text-primary uppercase tracking-wider">Top Products by Revenue</h2>
            <BarChart3 className="w-5 h-5 text-warning" />
          </div>
          <div className="h-[260px] md:h-[300px] w-full">
            {productRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6B7280" 
                    fontSize={10} 
                    fontFamily="Inter"
                    tickLine={false}
                    tickFormatter={(val) => val.length > 12 ? `${val.slice(0, 10)}...` : val}
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    fontSize={11} 
                    fontFamily="Inter"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `Rs ${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px' }}
                    formatter={(value: any) => [`Rs ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#D97706" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <span className="text-sm font-semibold">No data available</span>
                <span className="text-xs">Try selecting a different date range</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
