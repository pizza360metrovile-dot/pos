import React, { useState } from "react";
import { QuickFilterType } from "../types";
import { Calendar, Check } from "lucide-react";
import { format } from "date-fns";

interface DateRangeSelectorProps {
  idPrefix: string;
  selectedFilter: QuickFilterType;
  customRange: { startDate: Date | null; endDate: Date | null };
  onFilterChange: (filter: QuickFilterType, range?: { startDate: Date | null; endDate: Date | null }) => void;
}

export default function DateRangeSelector({
  idPrefix,
  selectedFilter,
  customRange,
  onFilterChange,
}: DateRangeSelectorProps) {
  const [isCustomMode, setIsCustomMode] = useState(selectedFilter === "ALL TIME" && customRange.startDate !== null);
  const [startVal, setStartVal] = useState(
    customRange.startDate ? format(customRange.startDate, "yyyy-MM-dd") : ""
  );
  const [endVal, setEndVal] = useState(
    customRange.endDate ? format(customRange.endDate, "yyyy-MM-dd") : ""
  );

  const quickFilters: { label: string; value: QuickFilterType }[] = [
    { label: "TODAY", value: "TODAY" },
    { label: "YESTERDAY", value: "YESTERDAY" },
    { label: "THIS WEEK", value: "THIS WEEK" },
    { label: "THIS MONTH", value: "THIS MONTH" },
    { label: "LAST MONTH", value: "LAST MONTH" },
    { label: "ALL TIME", value: "ALL TIME" },
  ];

  const handleQuickClick = (filter: QuickFilterType) => {
    setIsCustomMode(false);
    onFilterChange(filter, { startDate: null, endDate: null });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startVal) {
      const sDate = new Date(startVal);
      const eDate = endVal ? new Date(endVal) : sDate;
      onFilterChange("ALL TIME", { startDate: sDate, endDate: eDate });
    }
  };

  const getActiveFilterLabel = () => {
    if (customRange.startDate) {
      const s = format(customRange.startDate, "MMM dd, yyyy");
      const e = customRange.endDate ? format(customRange.endDate, "MMM dd, yyyy") : s;
      return `Custom: ${s} - ${e}`;
    }
    return selectedFilter;
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-xs space-y-4">
      {/* Upper descriptor and quick check */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-[#6B7280]" />
          <span className="text-xs font-semibold text-[#374151] uppercase tracking-wider">Date Period Filter</span>
        </div>
        <div className="text-xs text-[#3B82F6] font-semibold">
          Active: {getActiveFilterLabel()}
        </div>
      </div>

      {/* Button Row - Horizontal scrolling on mobile */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 no-scrollbar">
        <div className="flex items-center space-x-1.5 shrink-0">
          {quickFilters.map((q) => {
            const isActive = selectedFilter === q.value && !customRange.startDate;
            return (
              <button
                id={`${idPrefix}-filter-${q.value.toLowerCase()}`}
                key={q.value}
                type="button"
                onClick={() => handleQuickClick(q.value)}
                className={`py-2 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition-all uppercase ${
                  isActive
                    ? "bg-[#3B82F6] text-white shadow-sm"
                    : "bg-[#F7F8FA] text-[#374151] border border-[#E5E7EB] hover:bg-[#E5E7EB]/50"
                }`}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        {/* Custom trigger toggle */}
        <button
          id={`${idPrefix}-custom-toggle-btn`}
          onClick={() => setIsCustomMode(!isCustomMode)}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all uppercase ${
            isCustomMode || customRange.startDate
              ? "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30"
              : "bg-[#F7F8FA] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#E5E7EB]/50"
          }`}
        >
          Custom Picker...
        </button>
      </div>

      {/* Accordion custom date form if activated */}
      {isCustomMode && (
        <form onSubmit={handleCustomSubmit} className="pt-3 border-t border-dashed border-[#E5E7EB] flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">Start Date</label>
            <input
              id={`${idPrefix}-start-date-input`}
              type="date"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              className="px-3 py-2 border-[1.5px] border-[#E5E7EB] rounded-lg text-xs text-[#111827] bg-[#F7F8FA] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">End Date</label>
            <input
              id={`${idPrefix}-end-date-input`}
              type="date"
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
              className="px-3 py-2 border-[1.5px] border-[#E5E7EB] rounded-lg text-xs text-[#111827] bg-[#F7F8FA] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            />
          </div>
          <button
            id={`${idPrefix}-apply-custom-btn`}
            type="submit"
            className="bg-[#3B82F6] hover:opacity-90 text-white py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 transition-all flex items-center space-x-1.5 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </form>
      )}
    </div>
  );
}
