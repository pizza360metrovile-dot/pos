import React, { useState } from "react";
import { useStore } from "../store";
import { Ingredient } from "../types";
import { AlertCircle, CheckCircle, Search, Package, Layers } from "lucide-react";

// Status type
type StockStatusType = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

// Status priority map for sorting
const STATUS_PRIORITY: Record<StockStatusType, number> = {
  OUT_OF_STOCK: 1,
  LOW_STOCK: 2,
  IN_STOCK: 3,
};

function getStockStatus(qty: number, threshold: number): StockStatusType {
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= threshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export default function InventoryTab() {
  const { ingredients, connectionStatus } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  // loading skeleton
  if (connectionStatus === "connecting") {
    return (
      <div className="space-y-[24px] animate-pulse">
        {/* Banner Alert skeleton */}
        <div className="h-16 bg-gray-100 rounded-xl border border-[#E5E7EB]"></div>
        
        {/* Search row skeleton */}
        <div className="h-14 bg-white rounded-xl border border-[#E5E7EB]"></div>
        
        {/* Section 1 Direct Stock skeleton */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
          <div className="flex space-x-3 items-center">
            <div className="h-6 w-16 bg-gray-100 rounded-lg"></div>
            <div className="h-4 bg-gray-200 rounded w-40"></div>
          </div>
          <div className="h-32 bg-gray-50 rounded-lg"></div>
        </div>

        {/* Section 2 Raw Prepared skeleton */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
          <div className="flex space-x-3 items-center">
            <div className="h-6 w-16 bg-gray-100 rounded-lg"></div>
            <div className="h-4 bg-gray-200 rounded w-40"></div>
          </div>
          <div className="h-32 bg-gray-50 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Official empty state if the ingredients list is completely empty
  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="space-y-[24px] animate-fade-in text-center font-sans">
        <div className="bg-white rounded-xl p-16 border border-[#E5E7EB] text-center space-y-4 flex flex-col items-center justify-center min-h-[300px]">
          <div className="p-4 bg-[#F7F8FA] text-gray-500 rounded-full">
            <Package className="w-8 h-8 text-[#3B82F6]" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#111827] uppercase tracking-wide block">No data found for this period</span>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm">No ingredient details or direct product records have been registered in the database inventory registry.</p>
          </div>
        </div>
      </div>
    );
  }

  // Helpers for Sectioning
  const stockedItems = ingredients.filter(ing => ing.directStock === true);
  const ingredientStock = ingredients.filter(ing => ing.directStock === false);

  // Status computation for alerts
  const outOfStockItems = ingredients.filter(ing => getStockStatus(ing.currentQty, ing.lowStockThreshold) === "OUT_OF_STOCK");
  const lowStockItems = ingredients.filter(ing => getStockStatus(ing.currentQty, ing.lowStockThreshold) === "LOW_STOCK");

  // Filtering & Sorting function compliant with "Sort by: Status, Item Name"
  const processInventoryList = (list: Ingredient[]) => {
    let processed = [...list];
    
    // Apply search filter if typed
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      processed = processed.filter(
        item => item.name.toLowerCase().includes(q) || (item.category && item.category.toLowerCase().includes(q))
      );
    }

    // Sort by status priority, then alphabetically by name
    return processed.sort((a, b) => {
      const sA = getStockStatus(a.currentQty, a.lowStockThreshold);
      const sB = getStockStatus(b.currentQty, b.lowStockThreshold);
      
      const pA = STATUS_PRIORITY[sA];
      const pB = STATUS_PRIORITY[sB];

      if (pA !== pB) {
        return pA - pB;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const filteredStocked = processInventoryList(stockedItems);
  const filteredIngredients = processInventoryList(ingredientStock);

  // STEP 6: Debug logs for Inventory Tab
  console.log('All ingredients:', ingredients);
  console.log('Ingredients count:', ingredients.length);

  return (
    <div className="space-y-[24px] animate-fade-in">
      {/* 1. TOP URGENT ALERTS BANNER */}
      {outOfStockItems.length > 0 || lowStockItems.length > 0 ? (
        <div id="inventory-alerts-panel" className="bg-red-50 text-red-950 rounded-xl p-5 border border-red-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-[#DC2626] text-left">
            <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
            <h3 className="font-semibold text-sm uppercase tracking-wide">Critical Inventory Alert Notice</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {outOfStockItems.length > 0 && (
              <div className="bg-white text-[#111827] p-4 rounded-lg border border-red-100 flex items-start space-x-2.5 text-left">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] mt-1 shrink-0 animate-pulse"></span>
                <div>
                  <strong className="font-bold text-xs text-[#DC2626] uppercase tracking-wide block mb-1">
                    {outOfStockItems.length} Material Voids Logged:
                  </strong>
                  <p className="text-xs text-[#374151] leading-relaxed">
                    {outOfStockItems.map(i => i.name).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div className="bg-white text-[#111827] p-4 rounded-lg border border-yellow-250 flex items-start space-x-2.5 text-left">
                <span className="w-2 h-2 rounded-full bg-[#D97706] mt-1 shrink-0"></span>
                <div>
                  <strong className="font-bold text-xs text-[#D97706] uppercase tracking-wide block mb-1">
                    Low stock thresholds reached ({lowStockItems.length}):
                  </strong>
                  <p className="text-xs text-[#374151] leading-relaxed">
                    {lowStockItems.map(i => i.name).join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-center space-x-3 text-green-900 shadow-xs text-left animate-fade-in">
          <CheckCircle className="w-5 h-5 text-[#16A34A] shrink-0" />
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-[#16A34A]">All Inventory Balanced & Stable</h4>
            <p className="text-xs text-[#374151] mt-0.5">All tracked direct products and ingredients exceed their low warning thresholds.</p>
          </div>
        </div>
      )}

      {/* SEARCH AND CONTROL ROW */}
      <div className="bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between gap-3 animate-fade-in">
        <div className="relative rounded-lg w-full max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
            <Search className="h-4 w-4" />
          </div>
          <input
            id="inventory-search-input"
            type="text"
            placeholder="Search items or ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border-[1.5px] border-[#E5E7EB] rounded-lg text-xs text-[#111827] bg-[#F7F8FA] placeholder-[#6B7280] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
          />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] shrink-0 hidden sm:block">
          Tracked stock count: <span className="text-[#111827]">{ingredients.length}</span>
        </div>
      </div>

      {/* SECTION 1: STOCKED ITEMS (directStock === true) */}
      <CardOrTableSection
        id="section-direct-stock"
        title="Direct Stock Items"
        description="Items pre-packaged, bottled, or sold directly to customers as configured in menu"
        subTitle="Section 1"
        icon={<Package className="w-4 h-4 text-[#3B82F6]" />}
        data={filteredStocked}
        searchQuery={searchQuery}
        isDirectStockSec={true}
      />

      {/* SECTION 2: INGREDIENT STOCK (directStock === false) */}
      <CardOrTableSection
        id="section-ingredient-stock"
        title="Raw Prepared Ingredients"
        description="Core kitchen inventory ingredients used in prepared culinary meals and menu modifiers"
        subTitle="Section 2"
        icon={<Layers className="w-4 h-4 text-[#3B82F6]" />}
        data={filteredIngredients}
        searchQuery={searchQuery}
        isDirectStockSec={false}
      />
    </div>
  );
}

// Sub-component wrapper for Section 1 and Section 2
interface CardOrTableSectionProps {
  id: string;
  title: string;
  description: string;
  subTitle: string;
  icon: React.ReactNode;
  data: Ingredient[];
  searchQuery: string;
  isDirectStockSec: boolean;
}

function CardOrTableSection({
  id,
  title,
  description,
  subTitle,
  icon,
  data,
  searchQuery,
  isDirectStockSec,
}: CardOrTableSectionProps) {
  return (
    <div id={id} className="space-y-4 bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm text-left animate-fade-in">
      {/* Section info */}
      <div className="flex items-start space-x-3 pb-3 border-b border-[#E5E7EB]">
        <div className="p-1 px-2 bg-[#F7F8FA] text-[10px] font-semibold text-[#111827] uppercase rounded-[6px] shrink-0 border border-[#E5E7EB]">
          {subTitle}
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <h3 className="font-semibold text-sm text-[#111827]">{title}</h3>
            {icon}
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5 leading-tight">{description}</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-12 border border-[#E5E7EB] rounded-lg bg-gray-50/50 text-center text-xs text-[#6B7280] flex flex-col items-center justify-center space-y-1">
          <Package className="w-5 h-5 text-gray-300" />
          <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-400">Section Isolated</span>
          <p className="text-[10.5px] max-w-xs px-4">
            {searchQuery ? "No matching records found for active search constraints." : "No inventory entries currently allocated."}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE LIST CARDS VIEW */}
          <div className="md:hidden space-y-2">
            {data.map((item) => {
              const status = getStockStatus(item.currentQty, item.lowStockThreshold);
              return (
                <div 
                  id={`inv-card-${item.id}`}
                  key={item.id} 
                  className="bg-[#F7F8FA] p-3.5 rounded-lg border border-[#E5E7EB] flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 max-w-[65%] text-left">
                    <span className="font-semibold text-[#111827] block truncate">{item.name}</span>
                    <div className="text-[10px] text-[#6B7280]">
                      {isDirectStockSec ? `Category: ${item.category}` : `Low Alert Level: ${item.lowStockThreshold} ${item.unit}`}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 text-right shrink-0">
                    <div>
                      <span className="font-bold text-[#111827]">{item.currentQty}</span>
                      <span className="text-[10px] text-[#6B7280] ml-1">{item.unit}</span>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABLE VIEW FOR DESKTOP */}
          <div className="hidden md:block overflow-hidden border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#E5E7EB] text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Item / Ingredient Name</th>
                  {isDirectStockSec ? (
                    <th className="py-3 px-4">Category</th>
                  ) : (
                    <th className="py-3 px-4 text-right pr-6">Threshold Warning Target</th>
                  )}
                  <th className="py-3 px-4 text-right pr-8">Current Stock Quantity</th>
                  <th className="py-3 px-4">Unit Measure</th>
                  <th className="py-3 px-4 text-center">Status Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-[#374151] font-medium bg-white">
                {data.map((item) => {
                  const status = getStockStatus(item.currentQty, item.lowStockThreshold);
                  return (
                    <tr id={`inv-tr-${item.id}`} key={item.id} className="hover:bg-[#F7F8FA]/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#111827] text-xs">{item.name}</td>
                      {isDirectStockSec ? (
                        <td className="py-3 px-4 text-[#374151] text-xs">{item.category || "Beverage"}</td>
                      ) : (
                        <td className="py-3 px-4 font-mono text-right text-[#374151] pr-6 text-xs">{item.lowStockThreshold} {item.unit}</td>
                      )}
                      <td className="py-3 px-4 font-bold text-right text-[#111827] pr-8 text-xs">{item.currentQty}</td>
                      <td className="py-3 px-4 text-[#6B7280] text-xs">{item.unit}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Renders the correct standard badge status using exact POS spec colors:
// Success: #16A34A bg, white text
// Warning: #D97706 bg, white text
// Danger: #DC2626 bg, white text
function StatusBadge({ status }: { status: StockStatusType }) {
  switch (status) {
    case "OUT_OF_STOCK":
      return (
        <span className="inline-block text-[10px] font-bold bg-[#DC2626] text-white px-2.5 py-1 rounded-[6px] w-[100px] text-center select-none">
          ✕ Out of Stock
        </span>
      );
    case "LOW_STOCK":
      return (
        <span className="inline-block text-[10px] font-bold bg-[#D97706] text-white px-2.5 py-1 rounded-[6px] w-[100px] text-center select-none">
          ⚠ Low Stock
        </span>
      );
    default:
      return (
        <span className="inline-block text-[10px] font-bold bg-[#16A34A] text-white px-2.5 py-1 rounded-[6px] w-[100px] text-center select-none">
          ✓ In Stock
        </span>
      );
  }
}
