/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  History, 
  Database, 
  Edit3, 
  Trash2, 
  ChevronRight,
  TrendingUp,
  PackageCheck,
  PackageOpen,
  ArrowRightLeft,
  X,
  PlusCircle,
  MinusCircle,
  Save,
  ChevronLeft,
  ChefHat
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Ingredient, RecipeItem, MenuItem, StockLog } from '../types';
import { format } from 'date-fns';
import clsx from 'clsx';

type Tab = 'ingredients' | 'direct-stock' | 'recipes' | 'logs';

export default function Inventory() {
  const { 
    ingredients, 
    recipes, 
    recipeItems, 
    stockLogs, 
    menuItems,
    categories,
    addIngredient, 
    updateIngredient, 
    deleteIngredient,
    restockIngredient,
    restockMenuItem,
    saveRecipe
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Ingredient Modals
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  
  // Restock Ingredient Modal
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<Ingredient | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(0);

  // Restock MenuItem Modal
  const [isDirectRestockModalOpen, setIsDirectRestockModalOpen] = useState(false);
  const [directRestockItem, setDirectRestockItem] = useState<MenuItem | null>(null);
  const [directRestockAmount, setDirectRestockAmount] = useState<number>(0);
  const [restockNote, setRestockNote] = useState('');

  // Recipe Modal
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [tempRecipeItems, setTempRecipeItems] = useState<Omit<RecipeItem, 'id' | 'recipeId'>[]>([]);

  // Logs Pagination
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 15;

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [ingredients, searchTerm]);

  const negativeIngredients = useMemo(() => {
    return ingredients.filter(i => i.currentStock < 0);
  }, [ingredients]);

  const stockedItems = useMemo(() => {
    return menuItems.filter(item => {
      const isStocked = categories.find(c => Number(c.id) === Number(item.categoryId))?.type === 'stocked';
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return isStocked && matchesSearch;
    });
  }, [menuItems, categories, searchTerm]);

  const filteredLogs = useMemo(() => {
    return stockLogs.filter(log => {
      if (log.ingredientId) {
        const ingredient = ingredients.find(i => i.id === log.ingredientId);
        return ingredient?.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      if (log.menuItemId) {
        const item = menuItems.find(i => i.id === log.menuItemId);
        return item?.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    });
  }, [stockLogs, ingredients, menuItems, searchTerm]);

  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logsPerPage;
    return filteredLogs.slice(start, start + logsPerPage);
  }, [filteredLogs, logPage]);

  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);

  const stats = useMemo(() => {
    const low = ingredients.filter(i => i.currentStock > 0 && i.currentStock <= i.reorderThreshold).length;
    const out = ingredients.filter(i => i.currentStock <= 0).length;
    const totalValue = ingredients.reduce((acc, i) => acc + (i.currentStock * i.costPerUnit), 0);
    return { low, out, totalValue };
  }, [ingredients]);

  const handleSaveIngredient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as Ingredient['unit'],
      currentStock: Number(formData.get('currentStock')),
      reorderThreshold: Number(formData.get('reorderThreshold')),
      costPerUnit: Number(formData.get('costPerUnit')),
    };

    if (editingIngredient) {
      await updateIngredient({ ...editingIngredient, ...data });
    } else {
      await addIngredient(data);
    }
    setIsIngredientModalOpen(false);
    setEditingIngredient(null);
  };

  const handleRestock = async () => {
    if (!restockItem || restockAmount === 0) return;
    await restockIngredient(restockItem.id!, restockAmount);
    setIsRestockModalOpen(false);
    setRestockItem(null);
    setRestockAmount(0);
  };

  const handleDirectRestock = async () => {
    if (!directRestockItem || directRestockAmount === 0) return;
    await restockMenuItem(directRestockItem.id, directRestockAmount, restockNote);
    setIsDirectRestockModalOpen(false);
    setDirectRestockItem(null);
    setDirectRestockAmount(0);
    setRestockNote('');
  };

  const handleOpenRecipeEditor = (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem);
    const recipe = recipes.find(r => r.menuItemId === menuItem.id);
    if (recipe) {
      const items = recipeItems.filter(ri => ri.recipeId === recipe.id);
      setTempRecipeItems(items.map(({ id, recipeId, ...rest }) => rest));
    } else {
      setTempRecipeItems([]);
    }
    setIsRecipeModalOpen(true);
  };

  const handleAddRecipeItem = (ingredientId: number) => {
    if (tempRecipeItems.find(i => i.ingredientId === ingredientId)) return;
    setTempRecipeItems([...tempRecipeItems, { ingredientId, quantityUsed: 0 }]);
  };

  const handleRemoveRecipeItem = (ingredientId: number) => {
    setTempRecipeItems(tempRecipeItems.filter(i => i.ingredientId !== ingredientId));
  };

  const handleSaveRecipe = async () => {
    if (!selectedMenuItem) return;
    await saveRecipe(selectedMenuItem.id, tempRecipeItems);
    setIsRecipeModalOpen(false);
    setSelectedMenuItem(null);
  };

  return (
    <div className="h-full flex flex-col bg-bg-app overflow-y-auto custom-scrollbar">
      <header className="p-8 pb-4 shrink-0">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-base font-bold text-text-primary uppercase tracking-tight">Logistics Core</h1>
            <p className="text-text-muted text-[13px] font-medium mt-1">Inventory management, dynamic yields, and audit logs</p>
          </div>
          <div className="flex gap-4">
             <div className="flex bg-bg-surface-2 rounded-lg p-1 border border-border-light">
                {(['ingredients', 'direct-stock', 'recipes', 'logs'] as Tab[]).map(tab => (
                   <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSearchTerm(''); }}
                    className={clsx(
                      "px-6 py-2 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all",
                      activeTab === tab ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
                    )}
                  >
                    {tab.replace('-', ' ')}
                  </button>
                ))}
             </div>
             {activeTab === 'ingredients' && (
               <button 
                onClick={() => { setEditingIngredient(null); setIsIngredientModalOpen(true); }}
                className="btn-primary"
               >
                 <Plus className="w-5 h-5 mr-2" /> Add Material
               </button>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card-main p-6 flex items-center gap-5">
             <div className="w-12 h-12 rounded-lg bg-accent-light flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
             </div>
             <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Asset Evaluation</div>
                <div className="text-xl font-extrabold text-text-primary font-mono tracking-tight">${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
             </div>
          </div>
          <div className="card-main p-6 flex items-center gap-5">
             <div className="w-12 h-12 rounded-lg bg-info-light flex items-center justify-center">
                <PackageCheck className="w-6 h-6 text-info" />
             </div>
             <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Total Registry</div>
                <div className="text-xl font-extrabold text-text-primary font-mono tracking-tight">{ingredients.length}</div>
             </div>
          </div>
          <div className="card-main p-6 flex items-center gap-5 border-l-4 border-l-warning">
             <div className="w-12 h-12 rounded-lg bg-warning-light flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
             </div>
             <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Floor Alerts</div>
                <div className="text-xl font-extrabold text-text-primary font-mono tracking-tight">{stats.low}</div>
             </div>
          </div>
          <div className="card-main p-6 flex items-center gap-5 border-l-4 border-l-danger">
             <div className="w-12 h-12 rounded-lg bg-danger-light flex items-center justify-center">
                <PackageOpen className="w-6 h-6 text-danger" />
             </div>
             <div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Critical Zero</div>
                <div className="text-xl font-extrabold text-text-primary font-mono tracking-tight">{stats.out}</div>
             </div>
          </div>
        </div>

        {negativeIngredients.length > 0 && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in text-text-primary">
            <div className="flex gap-4">
              <div className="p-3 bg-danger-light rounded-lg text-danger mt-1 md:mt-0 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-danger uppercase tracking-tight">Negative Stock Deficit Report</h3>
                <p className="text-[13px] text-text-secondary mt-1 max-w-3xl">
                  The following ingredients have negative levels. They have been sold below zero stock to avoid blocking sales:
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {negativeIngredients.map(item => (
                    <span key={item.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-md text-[11px] font-bold font-mono border border-rose-500/20">
                      {item.name}: {item.currentStock.toFixed(2)} {item.unit}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
          <input
            type="text"
            placeholder={activeTab === 'logs' ? "Filter historical events..." : "Lookup from registry..."}
            className="input-field pl-[42px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 pb-8 custom-scrollbar">
        <div className="card-main overflow-hidden shadow-md">
          {activeTab === 'ingredients' && (
            <table className="table-main">
              <thead>
                <tr>
                  <th className="px-8 py-5">Nomenclature</th>
                  <th className="px-8 py-5">Scale Status</th>
                  <th className="px-8 py-5">Floor Ratio</th>
                  <th className="px-8 py-5">Internal Cost</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredIngredients.map(i => {
                  const status = i.currentStock < 0 ? 'Negative' : i.currentStock === 0 ? 'Out' : i.currentStock <= i.reorderThreshold ? 'Low' : 'OK';
                  return (
                    <tr key={i.id} className="hover:bg-bg-surface-2 group transition-colors">
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-text-primary uppercase tracking-tight">{i.name}</div>
                        <div className="text-[11px] text-text-muted font-medium uppercase mt-1 tracking-wider">{i.unit} Base Scale</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className={clsx(
                            "badge sm",
                            status === 'OK' && "badge-success",
                            status === 'Low' && "badge-warning",
                            status === 'Negative' && "bg-rose-500/10 text-rose-500 border border-rose-500/35",
                            status === 'Out' && "badge-danger"
                          )}>
                            {status === 'OK' ? 'Sufficient' : status === 'Low' ? 'Restock Soon' : status === 'Negative' ? 'Negative Deficit' : 'Depleted'}
                          </span>
                          <div className={clsx(
                            "font-mono text-sm font-bold",
                            i.currentStock < 0 ? "text-rose-500" : "text-text-primary"
                          )}>
                            {i.currentStock} {i.unit}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-2">
                           Minimum: <span className="text-text-primary font-mono">{i.reorderThreshold}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="text-sm font-mono text-accent font-bold">${(i.costPerUnit || 0).toFixed(2)}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                            onClick={() => { setRestockItem(i); setIsRestockModalOpen(true); }}
                            className="p-2.5 bg-bg-surface border border-border-light rounded-md text-success hover:bg-success-light hover:border-success-border transition-all shadow-sm active:scale-95"
                           >
                              <ArrowRightLeft className="w-4 h-4" />
                           </button>
                           <button 
                            onClick={() => { setEditingIngredient(i); setIsIngredientModalOpen(true); }}
                            className="p-2.5 bg-bg-surface border border-border-light rounded-md text-text-muted hover:text-text-primary transition-all shadow-sm active:scale-95"
                           >
                              <Edit3 className="w-4 h-4" />
                           </button>
                           <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              deleteIngredient(i.id);
                            }}
                            className="relative z-10 p-2.5 bg-danger-light border border-danger-border rounded-md text-danger hover:bg-danger transition-all shadow-sm active:scale-95 cursor-pointer pointer-events-auto"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'direct-stock' && (
            <table className="table-main">
              <thead>
                <tr>
                  <th className="px-8 py-5">Packaged Asset</th>
                  <th className="px-8 py-5">Classification</th>
                  <th className="px-8 py-5">Volume State</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {stockedItems.map(item => {
                  const status = item.directStock <= 0 ? 'Out' : item.directStock <= item.minStock ? 'Low' : 'OK';
                  const category = categories.find(c => Number(c.id) === Number(item.categoryId));
                  return (
                    <tr key={item.id} className="hover:bg-bg-surface-2 group transition-colors">
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-text-primary uppercase tracking-tight">{item.name}</div>
                      </td>
                      <td className="px-8 py-6">
                         <span className="badge sm font-bold">{category?.name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className={clsx(
                             "badge sm",
                             status === 'OK' ? "badge-success" :
                             status === 'Low' ? "badge-warning" :
                             "badge-danger"
                           )}>
                             {status === 'OK' ? 'Available' : status}
                           </span>
                           <div className="font-mono text-sm font-bold text-text-primary">
                             {item.directStock} units <span className="text-[10px] text-text-muted ml-1">/ floor: {item.minStock}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => { setDirectRestockItem(item); setIsDirectRestockModalOpen(true); }}
                          className="btn-secondary py-2"
                        >
                           <ArrowRightLeft className="w-4 h-4 mr-2" /> REPLENISH
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'recipes' && (
            <div className="divide-y divide-border-light">
               {menuItems
                 .filter(item => categories.find(c => Number(c.id) === Number(item.categoryId))?.type === 'prepared')
                 .map(item => {
                   const recipe = recipes.find(r => r.menuItemId === item.id);
                 const hasRecipe = !!recipe;
                 return (
                   <div key={item.id} className="flex items-center justify-between p-10 hover:bg-bg-surface-2 transition-all group">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-bg-surface-2 rounded-xl border border-border-light flex items-center justify-center">
                            <ChefHat className="w-8 h-8 text-accent" />
                         </div>
                         <div>
                            <div className="text-base font-bold text-text-primary uppercase tracking-tight">{item.name}</div>
                            <div className={clsx(
                              "text-[11px] font-bold uppercase tracking-wider mt-2 flex items-center gap-2",
                              hasRecipe ? "text-success" : "text-text-disabled"
                            )}>
                              {hasRecipe ? (
                                <><div className="w-1.5 h-1.5 rounded-full bg-success" />Formula Ready</>
                              ) : (
                                <><div className="w-1.5 h-1.5 rounded-full bg-text-disabled" />Undefined Workflow</>
                              )}
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-8">
                         {!hasRecipe && (
                           <div className="text-[10px] text-warning font-bold uppercase tracking-wider italic max-w-[200px] text-right leading-relaxed">
                             CRITICAL: Inventory will not decrement without a defined formula.
                           </div>
                         )}
                         <button 
                          onClick={() => handleOpenRecipeEditor(item)}
                          className="btn-secondary py-3"
                         >
                            <Edit3 className="w-4 h-4 mr-2" /> Architect Formula
                         </button>
                      </div>
                   </div>
                 )
               })}
            </div>
          )}

          {activeTab === 'logs' && (
            <>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Event Cycle</th>
                  <th className="px-8 py-5">Subject</th>
                  <th className="px-8 py-5">Adjustment Delta</th>
                  <th className="px-8 py-5">Operator Context</th>
                  <th className="px-8 py-5 text-right">Post-Operation State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedLogs.map(log => {
                  const ingredient = ingredients.find(i => i.id === log.ingredientId);
                  const menuItem = menuItems.find(m => m.id === log.menuItemId);
                  const itemName = ingredient?.name || menuItem?.name || 'Undefined Entity';
                  const unit = ingredient?.unit || 'units';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-mono text-[10px] font-black text-slate-900 border border-slate-100 bg-slate-50 px-2 py-1 rounded w-fit uppercase">
                          {format(log.createdAt, 'dd.MM HH:mm:ss')}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <span className={clsx(
                             "text-[8px] uppercase px-2 py-0.5 rounded-full font-black border",
                             log.ingredientId ? "bg-blue-50 border-blue-100 text-blue-500" : "bg-emerald-50 border-emerald-100 text-emerald-500"
                           )}>
                             {log.ingredientId ? 'Raw' : 'Discrete'}
                           </span>
                           <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{itemName}</div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={clsx(
                          "font-mono font-black text-sm",
                          log.changeAmount > 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {log.changeAmount > 0 ? '↑' : '↓'} {Math.abs(log.changeAmount)} {unit}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-white border border-slate-100 rounded-lg text-slate-400">
                          {log.reason}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-mono text-sm font-black text-slate-900">{log.remainingAfter} <span className="text-[10px] text-slate-400">{unit}</span></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                {filteredLogs.length} Historical records indexed
              </span>
              <div className="flex items-center gap-3">
                <button 
                  disabled={logPage === 1}
                  onClick={() => setLogPage(p => p - 1)}
                  className="p-2 rounded-xl border border-slate-100 bg-white text-slate-300 hover:text-slate-900 hover:border-slate-300 disabled:opacity-20 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-mono font-black text-slate-900 px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">
                  {logPage} <span className="text-slate-300">/</span> {Math.max(1, totalLogPages)}
                </span>
                <button 
                  disabled={logPage >= totalLogPages}
                  onClick={() => setLogPage(p => p + 1)}
                  className="p-2 rounded-xl border border-slate-100 bg-white text-slate-300 hover:text-slate-900 hover:border-slate-300 disabled:opacity-20 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Ingredient Modal */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-bg-surface border border-border-light rounded-xl w-full max-w-xl overflow-hidden shadow-modal animate-in zoom-in-95 duration-300 flex flex-col">
            <header className="px-8 py-5 border-b border-border-light flex justify-between items-center bg-bg-surface">
              <h2 className="text-[17px] font-bold uppercase tracking-tight text-text-primary">
                {editingIngredient ? 'Refine Material' : 'Asset Registration'}
              </h2>
              <button onClick={() => setIsIngredientModalOpen(false)} className="text-text-muted hover:text-text-primary p-2 bg-bg-surface-2 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </header>
            <form onSubmit={handleSaveIngredient} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="input-label">Label Identity</label>
                  <input required name="name" defaultValue={editingIngredient?.name} className="input-field" placeholder="E.g. Extra Virgin Olive Oil" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Scale Unit</label>
                    <select name="unit" defaultValue={editingIngredient?.unit || 'kg'} className="input-field appearance-none">
                      <option value="kg">KILOGRAMS (KG)</option>
                      <option value="g">GRAMS (G)</option>
                      <option value="L">LITERS (L)</option>
                      <option value="ml">MILLILITERS (ML)</option>
                      <option value="pcs">PIECES (PCS)</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Initial Quantity</label>
                    <input required type="number" step="0.01" name="currentStock" defaultValue={editingIngredient?.currentStock || 0} className="input-field font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Safety Floor</label>
                    <input required type="number" step="0.01" name="reorderThreshold" defaultValue={editingIngredient?.reorderThreshold || 5} className="input-field font-mono" />
                  </div>
                  <div>
                    <label className="input-label">Unit Valuation</label>
                    <input required type="number" step="0.01" name="costPerUnit" defaultValue={editingIngredient?.costPerUnit || 0} className="input-field font-mono" />
                  </div>
                </div>
              </div>
              <button className="btn-primary w-full py-4 text-sm tracking-widest">
                {editingIngredient ? 'Commit Manifest Update' : 'Initialize Asset In Registry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockModalOpen && restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-bg-surface border border-border-light rounded-xl w-full max-w-sm overflow-hidden shadow-modal animate-in zoom-in-95 duration-200">
            <header className="px-6 py-4 border-b border-border-light flex justify-between items-center bg-bg-surface-2">
               <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary leading-none">Adjustment Event</h2>
                  <p className="text-[11px] text-text-muted font-bold uppercase mt-1.5 tracking-wider">{restockItem.name}</p>
               </div>
               <button onClick={() => setIsRestockModalOpen(false)} className="p-1.5 bg-bg-surface border border-border-light rounded-full text-text-muted hover:text-text-primary transition-all">
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="input-label">Delta Increment (+/-)</label>
                <div className="relative">
                   <ArrowRightLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
                   <input 
                    type="number" 
                    step="0.01"
                    className="input-field pl-[42px] py-5 text-xl font-bold font-mono" 
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(Number(e.target.value))}
                    autoFocus
                   />
                </div>
                <div className="p-3 bg-bg-surface-2 border border-border-light rounded-md text-center">
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Projected Post-State</p>
                  <p className="text-sm font-bold text-text-primary font-mono mt-0.5">{restockItem.currentStock + restockAmount} {restockItem.unit}</p>
                </div>
              </div>
              <button 
                onClick={handleRestock}
                className="btn-success w-full py-4 text-sm"
              >
                Index Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Restock Modal */}
      {isDirectRestockModalOpen && directRestockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-bg-surface border border-border-light rounded-xl w-full max-w-sm overflow-hidden shadow-modal animate-in zoom-in-95 duration-200">
            <header className="px-6 py-4 border-b border-border-light flex justify-between items-center bg-bg-surface-2">
               <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary leading-none">Yield Replenishment</h2>
                  <p className="text-[11px] text-text-muted font-bold uppercase mt-1.5 tracking-wider">{directRestockItem.name}</p>
               </div>
               <button onClick={() => setIsDirectRestockModalOpen(false)} className="p-1.5 bg-bg-surface border border-border-light rounded-full text-text-muted hover:text-text-primary transition-all">
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="input-label">Unit Increment</label>
                  <div className="relative">
                    <PlusCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
                    <input 
                      type="number" 
                      className="input-field pl-[42px] py-5 text-xl font-bold font-mono" 
                      value={directRestockAmount}
                      onChange={(e) => setDirectRestockAmount(Number(e.target.value))}
                      autoFocus
                    />
                  </div>
                  <div className="p-3 bg-bg-surface-2 border border-border-light rounded-md text-center">
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Composite Total</p>
                    <p className="text-sm font-bold text-text-primary font-mono mt-0.5">{directRestockItem.directStock + directRestockAmount} units</p>
                  </div>
                </div>
                
                <div>
                  <label className="input-label">Operational Note</label>
                  <input 
                    type="text"
                    placeholder="E.g. Freight replenishment"
                    className="input-field font-mono text-xs italic" 
                    value={restockNote}
                    onChange={(e) => setRestockNote(e.target.value)}
                  />
                </div>
              </div>

              <button 
                onClick={handleDirectRestock}
                className="btn-success w-full py-4 text-sm"
              >
                Inject Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Editor Modal */}
      {isRecipeModalOpen && selectedMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
           <div className="bg-bg-surface border border-border-light rounded-xl w-full max-w-5xl overflow-hidden shadow-modal animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col">
              <header className="px-8 py-5 border-b border-border-light flex justify-between items-center shrink-0">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted leading-none">Workflow Architecture</h2>
                    <h1 className="text-lg font-bold text-text-primary mt-2 uppercase tracking-tight">{selectedMenuItem.name}</h1>
                  </div>
                  <button onClick={() => setIsRecipeModalOpen(false)} className="p-2.5 bg-bg-surface-2 rounded-full text-text-muted hover:text-text-primary transition-all border border-border-light">
                    <X className="w-6 h-6" />
                  </button>
              </header>
              <div className="flex-1 flex overflow-hidden">
                 {/* Left: Ingredients List */}
                 <div className="w-[35%] border-r border-border-light flex flex-col bg-bg-surface-2/30">
                    <div className="p-6">
                       <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-placeholder z-10 pointer-events-none" />
                         <input 
                          placeholder="SEARCH REGISTRY..."
                          className="input-field pl-[42px]"
                          onChange={(e) => setSearchTerm(e.target.value)}
                         />
                       </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar px-3 pb-6">
                       {ingredients
                        .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(i => (
                          <button 
                            key={i.id}
                            disabled={!!tempRecipeItems.find(tri => tri.ingredientId === i.id)}
                            onClick={() => handleAddRecipeItem(i.id)}
                            className="w-full p-4 text-left border-b border-border-light/50 hover:bg-bg-surface rounded-md transition-all flex items-center justify-between group disabled:opacity-30 mb-1"
                          >
                            <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary uppercase tracking-tight">{i.name}</span>
                            <PlusCircle className="w-5 h-5 text-text-disabled group-hover:text-accent transition-all" />
                          </button>
                        ))}
                    </div>
                 </div>
                 {/* Right: Selected Recipe Items */}
                 <div className="flex-1 flex flex-col bg-bg-surface">
                    <div className="flex-1 overflow-auto p-8 space-y-4 custom-scrollbar">
                       {tempRecipeItems.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-6">
                            <Database className="w-20 h-20 text-text-disabled" />
                            <p className="font-extrabold text-sm uppercase tracking-widest text-text-muted">Blueprint Empty</p>
                         </div>
                       ) : (
                         tempRecipeItems.map((tri, idx) => {
                           const ingredient = ingredients.find(i => i.id === tri.ingredientId);
                           return (
                             <div key={idx} className="flex items-center gap-6 bg-bg-surface-2 border border-border-light p-5 rounded-lg group">
                                <div className="flex-1">
                                   <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">{ingredient?.name}</div>
                                   <div className="flex items-center gap-4">
                                      <input 
                                        type="number"
                                        step="0.001"
                                        className="input-field w-32 py-2 px-4 shadow-sm"
                                        value={tri.quantityUsed}
                                        onChange={(e) => {
                                          const newItems = [...tempRecipeItems];
                                          newItems[idx].quantityUsed = Number(e.target.value);
                                          setTempRecipeItems(newItems);
                                        }}
                                      />
                                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{ingredient?.unit} <span className="text-text-placeholder mx-1">/</span> Yield Unit</span>
                                   </div>
                                </div>
                                <button 
                                  onClick={() => handleRemoveRecipeItem(tri.ingredientId)}
                                  className="p-3 text-text-disabled hover:text-danger hover:bg-danger-light hover:border-danger-border transition-all bg-bg-surface rounded-md border border-border-light shadow-sm"
                                >
                                   <MinusCircle className="w-5 h-5" />
                                </button>
                             </div>
                           )
                         })
                       )}
                    </div>
                    <div className="p-8 border-t border-border-light bg-bg-surface-2/30 shrink-0">
                       <button 
                        onClick={handleSaveRecipe}
                        disabled={tempRecipeItems.length === 0}
                        className="btn-success w-full py-4 text-sm"
                       >
                          <Save className="w-5 h-5 mr-3" /> Commit Yield Formula
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
