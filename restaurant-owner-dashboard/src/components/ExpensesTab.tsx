import React, { useState } from "react";
import { useStore, calculateDateLimits, toJSDate } from "../store";
import DateRangeSelector from "./DateRangeSelector";
import { format } from "date-fns";
import { Search, Filter, DollarSign, ListOrdered, Calculator, TrendingUp, ChevronDown, ChevronUp, Calendar, BookOpen } from "lucide-react";

export default function ExpensesTab() {
  const {
    expenses,
    expenseCategories,
    expensesDateFilter,
    expensesCustomRange,
    expensesCategoryFilter,
    expensesSearchQuery,
    setExpensesFilter,
    setExpensesCategoryFilter,
    setExpensesSearchQuery,
    connectionStatus
  } = useStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // loading skeleton
  if (connectionStatus === "connecting") {
    return (
      <div className="space-y-[24px] animate-pulse font-sans">
        {/* Date Selector skeleton */}
        <div className="h-12 bg-white rounded-xl border border-[#E5E7EB]"></div>

        {/* Filter Row skeleton */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] space-y-4">
          <div className="h-4 bg-gray-200 rounded w-40"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-10 bg-gray-100 rounded-lg"></div>
            <div className="h-10 bg-gray-100 rounded-lg"></div>
          </div>
        </div>

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

        {/* Category Breakdown skeleton */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] h-48"></div>
      </div>
    );
  }

  const limits = calculateDateLimits(expensesDateFilter, expensesCustomRange);

  // Filter Pipeline
  const filteredExpenses = expenses.filter((e) => {
    // 1. Date filters
    const eDate = toJSDate(e.date);
    if (limits.start && eDate < limits.start) return false;
    if (limits.end && eDate > limits.end) return false;

    // 2. Category filter
    if (expensesCategoryFilter !== "ALL" && e.category !== expensesCategoryFilter) return false;

    // 3. Search query
    if (expensesSearchQuery.trim()) {
      const q = expensesSearchQuery.toLowerCase();
      if (!e.description.toLowerCase().includes(q)) return false;
    }

    return true;
  });

  // Sort by date descending (newest first)
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    return toJSDate(b.date).getTime() - toJSDate(a.date).getTime();
  });

  // Compute stats
  const totalAmount = parseFloat(filteredExpenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2));
  const expenseCount = filteredExpenses.length;
  const avgExpense = expenseCount > 0 ? parseFloat((totalAmount / expenseCount).toFixed(2)) : 0;

  // Highest single expense finder
  let highestAmount = 0;
  let highestDescription = "None";
  filteredExpenses.forEach((e) => {
    if (e.amount > highestAmount) {
      highestAmount = e.amount;
      highestDescription = e.description;
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Compile Category breakdown
  const categorySummaryMap: { [cat: string]: number } = {};
  filteredExpenses.forEach((e) => {
    categorySummaryMap[e.category] = (categorySummaryMap[e.category] || 0) + e.amount;
  });

  // Sort categories descending by expense amount
  const sortedCategoriesBreakdown = Object.entries(categorySummaryMap)
    .map(([catName, amt]) => ({
      name: catName,
      amount: parseFloat(amt.toFixed(2)),
      percentage: totalAmount > 0 ? parseFloat(((amt / totalAmount) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-[24px] animate-fade-in font-sans">
      {/* Upper Date selector */}
      <DateRangeSelector
        idPrefix="exp"
        selectedFilter={expensesDateFilter}
        customRange={expensesCustomRange}
        onFilterChange={setExpensesFilter}
      />

      {/* Filter Row */}
      <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#374151] uppercase tracking-wider pb-2 border-b border-[#E5E7EB]">
          <Filter className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Expense Audit Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SEARCH BY DESCRIPTION */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Search Description</label>
            <div className="relative rounded-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <Search className="h-4 w-4" />
              </div>
              <input
                id="expenses-description-search"
                type="text"
                placeholder="Ex: repair, electricity..."
                value={expensesSearchQuery}
                onChange={(e) => setExpensesSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] placeholder-[#6B7280] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {/* FILTER BY CATEGORY */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block">Category Segment</label>
            <select
              id="expenses-category-dropdown"
              value={expensesCategoryFilter}
              onChange={(e) => setExpensesCategoryFilter(e.target.value)}
              className="block w-full py-2.5 px-3 border-[1.5px] border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-xs font-medium text-[#111827] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            >
              <option value="ALL">ALL CATEGORIES</option>
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
          <div className="flex items-start justify-between space-x-3.5">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Total Expenses</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {totalAmount.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-blue-50 text-[#3B82F6] rounded-xl shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[10px] text-[#6B7280] font-mono block mt-2 uppercase tracking-wide">Aggregate outflows</span>
        </div>

        {/* Count */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
          <div className="flex items-start justify-between space-x-3.5">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Expense Invoices</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">{expenseCount} receipts</span>
            </div>
            <div className="p-2.5 bg-green-50 text-[#16A34A] rounded-xl shrink-0">
              <ListOrdered className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2 uppercase">Voucher registers filed</span>
        </div>

        {/* Average */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
          <div className="flex items-start justify-between space-x-3.5">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Avg Expense Size</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {avgExpense}</span>
            </div>
            <div className="p-2.5 bg-amber-50 text-[#D97706] rounded-xl shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[10px] text-[#6B7280] block mt-2 uppercase font-mono">Mean unit cost</span>
        </div>

        {/* Highest Single */}
        <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs col-span-2 lg:col-span-1 flex flex-col justify-between min-h-[114px] h-auto hover:border-[#3B82F6]/50 transition-all duration-300 animate-fade-in text-left">
          <div className="flex items-start justify-between space-x-3.5">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#6B7280] block uppercase tracking-wider">Highest Expense</span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight block mt-1.5 break-all">Rs. {highestAmount.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-rose-50 text-[#DC2626] rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[10px] text-[#6B7280] truncate block font-medium mt-2" title={highestDescription}>
            Peak: {highestDescription}
          </span>
        </div>
      </div>

      {sortedExpenses.length === 0 ? (
        <div id="expenses-empty-state" className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-3 flex flex-col items-center justify-center min-h-[300px] animate-fade-in">
          <div className="p-4 bg-[#F7F8FA] text-gray-400 rounded-full">
            <BookOpen className="w-8 h-8 text-[#DC2626]/70" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No expenses registered in this period</span>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm">Try adjusting category filters or descriptors.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          
          {/* CATEGORY BREAKDOWN LIST COMPONENT */}
          <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs space-y-4 text-left">
            <div>
              <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">Financial Breakdown by Category</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">Distribution of outflows among operating account lines</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {sortedCategoriesBreakdown.map((item, idx) => {
                const colors = ["bg-[#3B82F6]", "bg-[#16A34A]", "bg-[#D97706]", "bg-[#DC2626]", "bg-purple-500", "bg-slate-500"];
                const colorClass = colors[idx % colors.length];
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs text-[#374151]">
                      <span className="font-semibold text-[#111827] uppercase text-[11px] tracking-wide">{item.name}</span>
                      <div className="space-x-1.5 font-mono text-[11px]">
                        <span className="font-bold text-[#111827]">Rs. {item.amount.toLocaleString()}</span>
                        <span className="text-[#6B7280]">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Tiny Progress bar */}
                    <div className="w-full h-2.5 bg-[#F7F8FA] border border-[#E5E7EB] rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABLE LOGS ACCORDIONS */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider px-1 block text-left">Detailed Invoices Ledger</span>
            
            {/* MOBILE COLLAPSIBILITY (<768) */}
            <div className="md:hidden space-y-2">
              {sortedExpenses.map((exp) => {
                const isExpanded = expandedId === exp.id;
                const eDate = toJSDate(exp.date);
                return (
                  <div 
                    id={`exp-mobile-${exp.id}`}
                    key={exp.id}
                    className={`bg-white rounded-xl border overflow-hidden transition-all text-left ${
                      isExpanded ? "border-[#3B82F6] ring-1 ring-[#3B82F6]/15 shadow-xs" : "border-[#E5E7EB]"
                    }`}
                  >
                    <div 
                      onClick={() => toggleExpand(exp.id)}
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#F7F8FA]/55"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <span className="font-semibold text-[#111827] text-xs block truncate">{exp.description}</span>
                        <div className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wider">
                          {format(eDate, "MMM dd")} • <span className="font-bold text-[#3B82F6]">{exp.category}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-bold text-[#111827]">Rs. {exp.amount}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-[#F7F8FA] p-4 border-t border-[#E5E7EB] text-xs text-[#374151] space-y-2.5">
                        <p className="leading-relaxed"><strong className="text-[#111827] font-semibold block mb-0.5 uppercase text-[9px] tracking-wide">Full Description note:</strong> {exp.description}</p>
                        <p className="text-[11px]"><strong className="text-[#111827] font-semibold uppercase text-[9px] tracking-wide">Timeline:</strong> {format(eDate, "yyyy-MM-dd HH:mm:ss")}</p>
                        <p className="text-[11px]"><strong className="text-[#111827] font-semibold uppercase text-[9px] tracking-wide">Category Segment:</strong> {exp.category}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP ACCORDION TABLE (>= 768) */}
            <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-5">Timeline Log</th>
                    <th className="py-3 px-5 w-1/2">Description Memo</th>
                    <th className="py-3 px-3">Expense Category</th>
                    <th className="py-3 px-5 text-right font-bold">Outflow Amount</th>
                    <th className="py-3 px-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#374151] bg-white text-left">
                  {sortedExpenses.map((exp) => {
                    const isExpanded = expandedId === exp.id;
                    const eDate = toJSDate(exp.date);
                    return (
                      <React.Fragment key={exp.id}>
                        <tr 
                          id={`exp-row-${exp.id}`}
                          onClick={() => toggleExpand(exp.id)}
                          className={`hover:bg-[#F7F8FA]/35 cursor-pointer transition-colors ${
                            isExpanded ? "bg-[#3B82F6]/5" : ""
                          }`}
                        >
                          <td className="py-3.5 px-5 font-mono text-[#6B7280]">{format(eDate, "yyyy-MM-dd HH:mm")}</td>
                          <td className="py-3.5 px-5 font-semibold text-[#111827] max-w-sm truncate text-xs" title={exp.description}>
                            {exp.description}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-semibold text-[#374151] bg-[#F7F8FA] border border-[#E5E7EB] px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-[#111827] text-sm">Rs. {exp.amount.toLocaleString()}</td>
                          <td className="py-3.5 px-5 text-right">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280] inline animate-fade-in" /> : <ChevronDown className="w-4 h-4 text-[#6B7280] inline animate-fade-in" />}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-[#F7F8FA]/60 p-4 border-y border-[#E5E7EB]">
                              <div className="bg-white p-5 border border-[#E5E7EB] rounded-xl text-xs shadow-xs max-w-2xl space-y-3 mx-2 text-left animate-fade-in">
                                <div className="flex items-center space-x-1.5 font-bold uppercase text-[9px] text-[#6B7280] tracking-wider border-b border-[#E5E7EB] pb-2">
                                  <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
                                  <span>Voucher Dispatch Details</span>
                                </div>
                                <p className="font-semibold text-[#111827] text-sm leading-relaxed">
                                  {exp.description}
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-xs text-[#374151] pt-2 border-t border-[#E5E7EB]">
                                  <p><strong className="text-[#6B7280] text-[10px] uppercase font-bold block mb-0.5">Category:</strong> <span className="font-semibold text-[#111827]">{exp.category}</span></p>
                                  <p><strong className="text-[#6B7280] text-[10px] uppercase font-bold block mb-0.5">Filing Timestamp:</strong> <span className="font-semibold text-[#111827] font-mono">{format(eDate, "yyyy-MM-dd HH:mm:ss")}</span></p>
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

        </div>
      )}
    </div>
  );
}
