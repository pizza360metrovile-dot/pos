/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Tag, Utensils, X, Save, AlertCircle, 
  ChefHat, Package, LayoutGrid, ListChecks, GripVertical, Settings2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { useStore, showConfirmModal } from '../store/useStore';
import { MenuItem, Category, ModifierGroup, ModifierOption } from '../types';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export default function MenuManagement() {
  const { 
    menuItems, categories, settings, 
    addMenuItem, updateMenuItem, deleteMenuItem, 
    addCategory, deleteCategory, updateCategory,
    modifierGroups, modifierOptions, saveModifierGroup, deleteModifierGroup
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'modifiers'>('items');
  const [selectedModItemId, setSelectedModItemId] = useState<string>('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);

  useEffect(() => {
    if (isItemModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isItemModalOpen]);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingModifierGroup, setEditingModifierGroup] = useState<ModifierGroup | null>(null);

  // Category Form State
  const [catFormData, setCatFormData] = useState<{ name: string; type: 'prepared' | 'stocked' }>({
    name: '',
    type: 'prepared'
  });

  // Item Form State
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    price: 0,
    categoryId: categories[0]?.id || '',
    description: '',
    isActive: true,
    stock: 0,
    minStock: 0,
  });

  // Modifier Form State
  const [modGroupName, setModGroupName] = useState('');
  const [modGroupType, setModGroupType] = useState<'option' | 'addon'>('option');
  const [modGroupRequired, setModGroupRequired] = useState(true);
  const [modOptions, setModOptions] = useState<{ label: string; price: number }[]>([
    { label: '', price: 0 },
    { label: '', price: 0 }
  ]);

  const selectedCategory = categories.find(c => String(c.id) === String(formData.categoryId));
  const activeItemId = selectedModItemId || menuItems[0]?.id || '';
  const selectedItem = menuItems.find(item => String(item.id) === String(activeItemId));

  const handleOpenItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        price: 0,
        categoryId: categories[0]?.id || '',
        description: '',
        isActive: true,
        stock: 0,
        minStock: 0,
        directStock: 0
      });
    }
    setIsItemModalOpen(true);
  };

  const handleOpenCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCatFormData({ name: cat.name, type: cat.type });
    } else {
      setEditingCategory(null);
      setCatFormData({ name: '', type: 'prepared' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleOpenModifierModal = (group?: ModifierGroup) => {
    if (group) {
      setEditingModifierGroup(group);
      setModGroupName(group.name);
      setModGroupType(group.type);
      setModGroupRequired(group.isRequired);
      const options = modifierOptions
        .filter(o => o.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(o => ({ label: o.label, price: o.additionalPrice }));
      setModOptions(options.length > 0 ? options : [{ label: '', price: 0 }, { label: '', price: 0 }]);
    } else {
      setEditingModifierGroup(null);
      setModGroupName('');
      setModGroupType('option');
      setModGroupRequired(true);
      setModOptions([{ label: '', price: 0 }, { label: '', price: 0 }]);
    }
    setIsModifierModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData: Partial<MenuItem> = { 
      ...formData,
      categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
      disabledReason: formData.isActive ? null : 'manual'
    } as any;
    if (selectedCategory?.type === 'prepared') {
      finalData.stock = 0;
      finalData.minStock = 0;
      finalData.directStock = 0;
    } else if (!editingItem) {
      finalData.directStock = finalData.stock;
    }

    if (editingItem) {
      await updateMenuItem({ ...editingItem, ...finalData } as MenuItem);
    } else {
      const newItem: MenuItem = {
        ...finalData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      } as MenuItem;
      await addMenuItem(newItem);
    }
    setIsItemModalOpen(false);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.name.trim()) return;

    if (editingCategory) {
      if (editingCategory.type !== catFormData.type) {
        let warning = '';
        if (catFormData.type === 'prepared') {
          warning = "This will hide stock fields for all items in this category. Existing stock values will be saved but ignored. Continue?";
        } else {
          warning = "Items in this category will now track direct stock. Set stock quantities for each item after saving.";
        }
        const confirmed = await showConfirmModal({
          title: 'Change Category Type',
          message: warning,
          confirmLabel: 'Continue',
          cancelLabel: 'Cancel',
          isDanger: false
        });
        if (!confirmed) return;
      }
      await updateCategory({ ...editingCategory, ...catFormData });
    } else {
      await addCategory(catFormData as any);
    }
    setIsCategoryModalOpen(false);
  };

  const handleSaveModifierGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = modOptions.filter(o => o.label.trim() !== '');
    if (validOptions.length < 2) {
      toast.error('Minimum 2 options required');
      return;
    }

    const groupId = editingModifierGroup?.id || crypto.randomUUID();
    const group: ModifierGroup = {
      id: groupId,
      menuItemId: activeItemId,
      name: modGroupName,
      type: modGroupType,
      isRequired: modGroupType === 'option' ? modGroupRequired : false,
      sortOrder: editingModifierGroup?.sortOrder || (modifierGroups.filter(g => String(g.menuItemId) === String(activeItemId)).length + 1)
    };

    const options: ModifierOption[] = validOptions.map((opt, index) => ({
      id: crypto.randomUUID(),
      groupId: groupId,
      label: opt.label,
      additionalPrice: opt.price,
      sortOrder: index + 1
    }));

    await saveModifierGroup(group, options);
    setIsModifierModalOpen(false);
  };

  const handleDeleteItem = async (id: string | number) => {
    const confirmed = await showConfirmModal({
      title: 'Delete Menu Item',
      message: 'Are you sure you want to delete this menu item?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true
    });
    if (confirmed) {
      await deleteMenuItem(id);
    }
  };

  const handleDeleteCategory = async (id: string | number) => {
    const confirmed = await showConfirmModal({
      title: 'Delete Category',
      message: 'Deleting a category will NOT delete the items in it, but they will become uncategorized. Proceed?',
      confirmLabel: 'Delete Category',
      cancelLabel: 'Cancel',
      isDanger: true
    });
    if (confirmed) {
      await deleteCategory(id);
    }
  };

  const handleDeleteModGroup = async (group: ModifierGroup) => {
    const menuItemName = menuItems.find(mi => String(mi.id) === String(group.menuItemId))?.name || '';
    const confirmed = await showConfirmModal({
      title: 'Delete Modifier Group',
      message: `Delete ${group.name}? This modifier will no longer appear when ordering ${menuItemName ? `"${menuItemName}"` : 'this item'}.`,
      confirmLabel: 'Delete Modifier Group',
      cancelLabel: 'Cancel',
      isDanger: true
    });
    if (confirmed) {
      await deleteModifierGroup(group.id);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10 animate-fade-in font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-base font-bold text-text-primary uppercase tracking-tight leading-none">Catalog Core</h1>
          <p className="text-text-muted font-medium text-[13px] mt-2">Orchestrate your culinary assets and operational flow</p>
        </div>
        
        <div className="flex bg-bg-surface-2 p-1 rounded-lg border border-border-light">
           <button 
             onClick={() => setActiveTab('items')}
             className={clsx(
               "px-6 py-2 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2",
               activeTab === 'items' ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
             )}
           >
             <Utensils className="w-3.5 h-3.5" />
             Items
           </button>
           <button 
             onClick={() => setActiveTab('categories')}
             className={clsx(
               "px-6 py-2 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2",
               activeTab === 'categories' ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
             )}
           >
             <Tag className="w-3.5 h-3.5" />
             Categories
           </button>
           <button 
             onClick={() => setActiveTab('modifiers')}
             className={clsx(
               "px-6 py-2 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2",
               activeTab === 'modifiers' ? "bg-bg-surface text-accent shadow-sm border border-border-light" : "text-text-muted hover:text-text-secondary"
             )}
           >
             <Settings2 className="w-3.5 h-3.5" />
             Modifiers
           </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'items' && (
          <motion.div 
            key="items"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-end">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                  <div className="card-main p-6">
                    <div className="text-text-muted text-[11px] uppercase font-bold tracking-widest mb-1.5">Total Assets</div>
                    <div className="text-2xl font-extrabold text-text-primary font-mono tracking-tighter">{menuItems.length}</div>
                  </div>
                  <div className="card-main p-6">
                    <div className="text-text-muted text-[11px] uppercase font-bold tracking-widest mb-1.5">Live Units</div>
                    <div className="text-2xl font-extrabold text-success font-mono tracking-tighter">{menuItems.filter(i => i.isActive).length}</div>
                  </div>
                  <div className="card-main p-6">
                    <div className="text-text-muted text-[11px] uppercase font-bold tracking-widest mb-1.5">Out of Stock</div>
                    <div className="text-2xl font-extrabold text-danger font-mono tracking-tighter">{menuItems.filter(i => !i.isActive && i.disabledReason === 'out_of_stock').length}</div>
                  </div>
               </div>
               <button onClick={() => handleOpenItemModal()} className="btn-primary ml-6">
                <Plus className="w-5 h-5 mr-2" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="card-main overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="table-main">
                  <thead>
                    <tr>
                      <th className="px-8 py-5 text-center w-16">#</th>
                      <th className="px-8 py-5">Item Name</th>
                      <th className="px-8 py-5">Category</th>
                      <th className="px-8 py-5">Price</th>
                      <th className="px-8 py-5">Inventory</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {menuItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-bg-surface-2 transition-colors group">
                        <td className="px-8 py-6 text-[11px] font-bold text-text-placeholder font-mono">{index + 1}</td>
                        <td className="px-8 py-6">
                          <div>
                            <div className="font-bold text-sm text-text-primary uppercase tracking-tight">{item.name}</div>
                            <div className="text-text-muted text-[11px] font-medium line-clamp-1 max-w-[200px] mt-1">{item.description || 'No descriptor provided.'}</div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1.5">
                            <span className="badge sm font-bold">
                              {categories.find(c => String(c.id) === String(item.categoryId))?.name || 'Unset'}
                            </span>
                            {categories.find(c => String(c.id) === String(item.categoryId))?.type === 'stocked' ? (
                              <span className="text-[10px] uppercase font-bold text-success flex items-center gap-1.5">
                                <Package className="w-3 h-3" /> Stocked
                              </span>
                            ) : ( activeTab === 'items' && 
                              <span className="text-[10px] uppercase font-bold text-accent flex items-center gap-1.5">
                                <ChefHat className="w-3 h-3" /> Prepared
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 font-mono font-bold text-text-primary text-sm">
                          {settings.currency}{(item.price || 0).toFixed(2)}
                        </td>
                        <td className="px-8 py-6">
                          {categories.find(c => String(c.id) === String(item.categoryId))?.type === 'stocked' ? (
                            <div className="flex flex-col gap-1">
                              <span className={clsx(
                                "text-sm font-bold font-mono",
                                item.directStock <= item.minStock ? "text-danger" : "text-success"
                              )}>
                                {item.directStock} Units
                              </span>
                              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Floor: {item.minStock}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-disabled font-bold uppercase tracking-wider italic opacity-60">Workflow-based</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className={clsx(
                            "badge sm font-bold uppercase",
                            item.isActive ? "badge-success" : "bg-bg-surface-2 text-text-disabled border-border-light"
                          )}>
                            <div className={clsx("w-1.5 h-1.5 rounded-full mr-2", item.isActive ? "bg-success shadow-lg shadow-success/20" : "bg-text-disabled")} />
                            {item.isActive ? 'Online' : 'Offline'}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenItemModal(item)} className="p-2.5 bg-bg-surface border border-border-light rounded-md text-text-muted hover:text-text-primary transition-all shadow-sm active:scale-95">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} className="p-2.5 bg-danger-light border border-danger-border rounded-md text-danger hover:bg-danger transition-all shadow-sm active:scale-95">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'categories' && (
          <motion.div 
            key="categories"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center bg-bg-app border border-border-light p-10 rounded-xl shadow-md">
               <div className="max-w-md">
                 <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight">Classification Matrix</h2>
                 <p className="text-text-muted text-sm mt-2 font-medium">Manage hierarchy and operational logic for your groupings.</p>
               </div>
               <button onClick={() => handleOpenCategoryModal()} className="btn-primary">
                <Plus className="w-5 h-5 mr-2" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(cat => (
                <div key={cat.id} className="card-main p-8 group relative overflow-hidden transition-all">
                   <div className={clsx(
                     "absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-5 group-hover:scale-110 transition-transform",
                     cat.type === 'stocked' ? "bg-success" : "bg-accent"
                   )} />
                   
                   <div className="flex justify-between items-start relative z-10">
                      <div className={clsx(
                        "w-12 h-12 rounded-lg flex items-center justify-center border",
                        cat.type === 'stocked' ? "bg-success-light border-success-border text-success" : "bg-accent-light border-accent-border text-accent"
                      )}>
                        {cat.type === 'stocked' ? <Package className="w-6 h-6" /> : <ChefHat className="w-6 h-6" />}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenCategoryModal(cat)} className="p-2.5 bg-bg-surface border border-border-light rounded-md text-text-muted hover:text-text-primary transition-all shadow-sm active:scale-95">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-2.5 bg-danger-light border border-danger-border rounded-md text-danger hover:bg-danger transition-all shadow-sm active:scale-95">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                   </div>

                   <div className="mt-8 relative z-10">
                      <h3 className="text-lg font-bold text-text-primary uppercase tracking-tight leading-none">{cat.name}</h3>
                      <div className="flex items-center gap-2 mt-3">
                         <span className={clsx("w-1.5 h-1.5 rounded-full", cat.type === 'prepared' ? "bg-accent" : "bg-success")} />
                         <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{cat.type === 'prepared' ? 'Kitchen-Led' : 'Discrete Units'}</span>
                      </div>
                   </div>

                   <div className="mt-8 pt-8 border-t border-border-light flex justify-between items-center relative z-10">
                      <div className="text-[11px] font-bold text-text-placeholder uppercase tracking-widest">Assigned Items</div>
                      <div className="text-sm font-bold text-text-primary font-mono">{menuItems.filter(i => String(i.categoryId) === String(cat.id)).length}</div>
                   </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'modifiers' && (
          <motion.div 
            key="modifiers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-8 h-[calc(100vh-280px)]"
          >
            {/* Left Sidebar - Menu Item Selector List */}
            <div className="w-80 bg-bg-surface border border-border-light rounded-xl p-6 space-y-4 overflow-y-auto shadow-sm">
               <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-3 mb-4 leading-none">Catalog Structure</h3>
               <div className="space-y-3">
                 {categories.map(cat => {
                   const isCollapsed = collapsedCategories[cat.id];
                   const catItems = menuItems.filter(i => String(i.categoryId) === String(cat.id));
                   
                   return (
                     <div key={cat.id} className="space-y-1">
                       <button 
                         type="button"
                         onClick={() => {
                           setCollapsedCategories(prev => ({
                             ...prev,
                             [cat.id]: !prev[cat.id]
                           }));
                         }}
                         className="w-full flex items-center gap-1.5 p-2 hover:bg-bg-surface-2 rounded-lg text-left text-text-secondary transition-all"
                       >
                         <span className="text-text-muted shrink-0">
                           {isCollapsed ? (
                             <ChevronRight className="w-4 h-4" />
                           ) : (
                             <ChevronDown className="w-4 h-4" />
                           )}
                         </span>
                         <span className="font-extrabold text-[12px] tracking-wider uppercase text-text-secondary truncate">
                           {cat.name}
                         </span>
                       </button>

                       {!isCollapsed && (
                         <div className="pl-4 space-y-1 border-l border-border-light ml-3.5 pt-0.5 pb-1.5">
                           {catItems.length === 0 ? (
                             <span className="block text-[11px] text-text-placeholder italic pl-2.5 py-1">No items in this category</span>
                           ) : (
                             catItems.map(item => {
                               const groupCount = modifierGroups.filter(g => String(g.menuItemId) === String(item.id)).length;
                               const isAct = String(activeItemId) === String(item.id);
                               return (
                                 <button 
                                   type="button"
                                   key={item.id}
                                   onClick={() => setSelectedModItemId(String(item.id))}
                                   className={clsx(
                                     "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left",
                                     isAct ? "bg-bg-surface-2 border border-accent/40 shadow-sm text-accent font-bold" : "hover:bg-bg-surface-2/60 text-text-secondary"
                                   )}
                                 >
                                   <span className={clsx("font-semibold text-xs truncate max-w-[140px]", isAct ? "text-accent" : "text-text-secondary")}>
                                     {item.name}
                                   </span>
                                   <span className={clsx(
                                     "text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wider border",
                                     isAct ? "bg-accent-light text-accent border-accent-border/60" : "bg-bg-surface-2 text-text-muted border-border-light"
                                   )}>
                                     {groupCount}G
                                   </span>
                                 </button>
                               );
                             })
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>

            {/* Right Side - Modifier Groups */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-4 custom-scrollbar scroll-smooth">
               <div className="flex justify-between items-center card-main p-8 shadow-sm border-border-light sticky top-0 z-10 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">
                      {selectedItem ? `"${selectedItem.name}"` : 'Item'} Modifiers
                    </h2>
                    <p className="text-text-muted text-[13px] font-medium mt-1">Define complex choices and add-ons for this specific menu item.</p>
                  </div>
                  <button 
                    disabled={!selectedItem}
                    onClick={() => handleOpenModifierModal()}
                    className="btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    <span>Add Group</span>
                  </button>
               </div>

               {selectedItem && modifierGroups.filter(g => String(g.menuItemId) === String(activeItemId)).length > 0 ? (
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
                    {modifierGroups
                      .filter(g => String(g.menuItemId) === String(activeItemId))
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map(group => (
                        <div key={group.id} className="card-main p-8 group hover:shadow-md transition-all relative overflow-hidden animate-fade-in">
                           <div className="flex justify-between items-start mb-6 border-b border-border-light pb-6 relative z-10">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-bg-surface-2 border border-border-light rounded-lg text-text-placeholder cursor-move">
                                   <GripVertical className="w-5 h-5 text-text-muted" />
                                </div>
                                <div>
                                   <h3 className="font-bold text-[17px] text-text-primary uppercase tracking-tight leading-none">{group.name}</h3>
                                   <div className="flex gap-3 mt-3">
                                      <span className="badge sm font-bold uppercase">
                                        {group.type === 'option' ? 'Single Choice' : 'Multi Add-on'}
                                      </span>
                                      {group.isRequired && (
                                        <span className="badge sm badge-danger font-bold uppercase tracking-wider">Required</span>
                                      )}
                                   </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => handleOpenModifierModal(group)} className="p-2.5 bg-bg-surface border border-border-light text-text-muted hover:text-text-primary rounded-md transition-all shadow-sm active:scale-95">
                                    <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => handleDeleteModGroup(group)} className="p-2.5 bg-danger-light border border-danger-border text-danger hover:bg-danger transition-all rounded-md shadow-sm active:scale-95">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>

                           <div className="space-y-2 relative z-10">
                              {modifierOptions
                                .filter(o => o.groupId === group.id)
                                .sort((a, b) => a.sortOrder - b.sortOrder)
                                .map(opt => (
                                  <div key={opt.id} className="flex justify-between items-center p-4 bg-bg-surface-2/40 rounded-lg border border-border-light/50 group-hover:border-border-light transition-all">
                                     <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 bg-text-placeholder rounded-full" />
                                        <span className="text-sm font-medium text-text-secondary uppercase tracking-tight">{opt.label}</span>
                                     </div>
                                     <span className="text-xs font-bold font-mono text-text-primary">
                                        {opt.additionalPrice > 0 ? `+${settings.currency}${opt.additionalPrice.toFixed(2)}` : 'Included'}
                                     </span>
                                  </div>
                                ))}
                           </div>
                        </div>
                      ))}
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center card-main border-dashed p-12 py-32 animate-fade-in">
                    <div className="w-20 h-20 bg-bg-surface-2 rounded-full flex items-center justify-center mb-6">
                      <ListChecks className="w-8 h-8 text-text-disabled" />
                    </div>
                    <p className="text-[11px] font-bold text-text-disabled uppercase tracking-[0.3em] text-center max-w-xs leading-loose">
                      No modifiers yet for this item.<br/>
                      Add a group to start customizing orders.
                    </p>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Modal */}
      {isItemModalOpen && (activeTab === 'items') && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-gray-900/60 backdrop-blur-[2px] overflow-y-auto animate-fade-in">
          <div 
            className="bg-bg-surface border border-border-light rounded-xl shadow-modal overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" 
            style={{ width: 'min(860px, 92vw)', maxHeight: '90vh' }}
          >
            <div className="px-8 py-5 border-b border-border-light flex justify-between items-center bg-bg-surface shrink-0">
              <h2 className="font-bold text-[17px] tracking-tight uppercase text-text-primary">
                {editingItem ? 'Edit Item' : 'Add Item'}
              </h2>
              <button 
                type="button"
                onClick={() => setIsItemModalOpen(false)} 
                className="text-text-muted hover:text-text-primary p-2 bg-bg-surface-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                {/* Item Name - Large and Prominent spanning full width */}
                <div>
                  <label className="input-label font-bold uppercase text-[11px] tracking-wider text-text-muted select-none">Item Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field text-base font-medium py-3"
                    placeholder="E.g. Signature Truffle Fries"
                  />
                </div>

                {/* TWO COLUMNS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* LEFT COLUMN */}
                  <div className="space-y-5">
                    <div>
                      <label className="input-label font-bold uppercase text-[11px] tracking-wider text-text-muted select-none">Price ({settings.currency})</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.price || 0}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="input-field font-mono"
                      />
                    </div>

                    <div>
                      <label className="input-label font-bold uppercase text-[11px] tracking-wider text-text-muted select-none">Category</label>
                      <select
                        value={formData.categoryId || ''}
                        onChange={(e) => {
                          const catId = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                          const cat = categories.find(c => String(c.id) === String(catId));
                          const newData = { ...formData, categoryId: catId };
                          if (cat?.type === 'prepared') {
                            newData.stock = 0;
                            newData.minStock = 0;
                          }
                          setFormData(newData);
                        }}
                        className="input-field appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="input-label mb-2 block font-bold uppercase text-[11px] tracking-wider text-text-muted select-none">Active</label>
                      <div className="flex items-center justify-between p-3.5 bg-bg-surface-2/65 rounded-lg border border-border-light h-12">
                        <div className="flex items-center gap-3">
                          <div className={clsx("w-3 h-3 rounded-full", formData.isActive ? "bg-success" : "bg-text-disabled")} />
                          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary select-none">Active</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                          className={clsx(
                            "w-10 h-5.5 rounded-full p-1 transition-all flex items-center shrink-0",
                            formData.isActive ? "bg-success justify-end" : "bg-text-disabled justify-start"
                          )}
                        >
                          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-4 border-l-0 md:border-l md:border-border-light/40 md:pl-6">
                    {selectedCategory?.type === 'prepared' ? (
                      <div className="bg-bg-surface-2/40 rounded-lg p-4 border border-border-light flex items-start gap-2.5">
                        <ChefHat className="w-5 h-5 shrink-0 text-accent animate-pulse" />
                        <p className="text-[11px] text-accent font-black uppercase leading-relaxed tracking-wider">
                          Prepared workflow: Stock is calculated via sub-assemblies and raw inventory.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-bg-surface-2/40 rounded-lg p-4 border border-border-light space-y-3.5">
                        <div className="flex items-start gap-2.5">
                          <Package className="w-5 h-5 shrink-0 text-success" />
                          <p className="text-[11px] text-success font-bold uppercase leading-relaxed tracking-wider">
                            Track Stock (decrements on each sale)
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="input-label select-none font-bold uppercase text-[11px] tracking-wider text-text-muted">Min Stock Alert</label>
                            <input
                              required
                              type="number"
                              min="0"
                              value={formData.minStock ?? 0}
                              onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                              className="input-field font-mono"
                            />
                          </div>
                          <div>
                            <label className="input-label select-none font-bold uppercase text-[11px] tracking-wider text-text-muted">Initial Stock</label>
                            <input
                              required
                              type="number"
                              min="0"
                              value={formData.stock ?? 0}
                              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                              className="input-field font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="input-label font-bold uppercase text-[11px] tracking-wider text-text-muted select-none">Description</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input-field resize-none"
                        rows={3}
                        placeholder="Summarize ingredients or preparation style..."
                      />
                    </div>

                    {editingItem && (
                      <div className="pt-2 flex justify-start">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModItemId(editingItem.id);
                            setActiveTab('modifiers');
                            setIsItemModalOpen(false);
                          }}
                          className="text-xs font-bold text-accent hover:text-accent-strong flex items-center gap-1 uppercase tracking-wider"
                        >
                          Configure Modifiers for this item &rarr;
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Full Width Footer */}
              <div className="px-8 py-5 border-t border-border-light bg-bg-surface shrink-0 mt-auto">
                <button type="submit" className="btn-primary w-full py-4 text-sm tracking-widest uppercase font-black">
                  <Save className="w-5 h-5 mr-3" />
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-bg-surface border border-border-light w-full max-w-2xl rounded-xl shadow-modal overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-5 border-b border-border-light flex justify-between items-center bg-bg-surface">
              <h2 className="font-bold text-[17px] tracking-tight uppercase text-text-primary">{editingCategory ? 'Update Classification' : 'New Grouping'}</h2>
              <button 
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }} 
                className="text-text-muted hover:text-text-primary p-2 bg-bg-surface-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <form onSubmit={handleSaveCategory} className="space-y-8">
                <div>
                  <label className="input-label">Unique Identifier (Name)</label>
                  <input
                    required
                    type="text"
                    placeholder="E.g. Cellar Selection, From the Grill"
                    value={catFormData.name}
                    onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="space-y-4">
                  <label className="input-label">Operational Logic</label>
                  <div className="grid grid-cols-2 gap-6">
                    <button
                      type="button"
                      onClick={() => setCatFormData({ ...catFormData, type: 'prepared' })}
                      className={clsx(
                        "flex flex-col items-center text-center p-8 rounded-xl border-2 transition-all gap-5",
                        catFormData.type === 'prepared' 
                          ? "bg-accent-light border-accent shadow-sm" 
                          : "bg-bg-surface border-border-light opacity-60 hover:opacity-100"
                      )}
                    >
                      <ChefHat className={clsx("w-10 h-10", catFormData.type === 'prepared' ? "text-accent" : "text-text-disabled")} />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest mb-2 text-text-primary">Prepared</div>
                        <p className="text-[11px] text-text-muted leading-relaxed font-medium uppercase">Kitchen-led workflow.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCatFormData({ ...catFormData, type: 'stocked' })}
                      className={clsx(
                        "flex flex-col items-center text-center p-8 rounded-xl border-2 transition-all gap-5",
                        catFormData.type === 'stocked' 
                          ? "bg-success-light border-success shadow-sm" 
                          : "bg-bg-surface border-border-light opacity-60 hover:opacity-100"
                      )}
                    >
                      <Package className={clsx("w-10 h-10", catFormData.type === 'stocked' ? "text-success" : "text-text-disabled")} />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest mb-2 text-text-primary">Stocked</div>
                        <p className="text-[11px] text-text-muted leading-relaxed font-medium uppercase">Discrete unit tracking.</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="btn-primary w-full py-4 text-sm tracking-widest">
                    {editingCategory ? <Save className="w-5 h-5 mr-3" /> : <Plus className="w-5 h-5 mr-3" />}
                    <span>{editingCategory ? 'Update Classification' : 'Create Grouping'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Group Modal (Slide-over style panel) */}
      {isModifierModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-bg-surface h-full w-full max-w-xl shadow-modal overflow-y-auto flex flex-col"
          >
            <div className="px-8 py-5 border-b border-border-light flex justify-between items-center sticky top-0 bg-bg-surface/80 backdrop-blur-md z-10">
              <div>
                <h2 className="font-bold text-[17px] tracking-tight uppercase text-text-primary">{editingModifierGroup ? 'Refine Modifier Group' : 'Add Modifier Group'}</h2>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Classification: {selectedCategory?.name}</p>
              </div>
              <button 
                onClick={() => setIsModifierModalOpen(false)} 
                className="text-text-muted hover:text-text-primary p-2.5 bg-bg-surface-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveModifierGroup} className="p-10 space-y-12 flex-1">
              {/* Step 1: Group Setup */}
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-text-primary text-bg-surface flex items-center justify-center text-[10px] font-bold">01</div>
                   <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-widest">Group Configuration</h3>
                </div>

                <div>
                  <label className="input-label">Group Descriptor (Internal Name)</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Choose Flavour, Extra Toppings"
                    value={modGroupName}
                    onChange={(e) => setModGroupName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="space-y-4">
                  <label className="input-label">Logical Selection Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setModGroupType('option')}
                      className={clsx(
                        "flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all gap-4",
                        modGroupType === 'option' 
                          ? "bg-accent-light border-accent shadow-sm" 
                          : "bg-bg-surface border-border-light"
                      )}
                    >
                      <LayoutGrid className={clsx("w-8 h-8", modGroupType === 'option' ? "text-accent" : "text-text-disabled")} />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest mb-1 text-text-primary font-mono">Option Group</div>
                        <p className="text-[10px] text-text-muted leading-tight font-medium uppercase font-mono tracking-tight">Single Pick Only</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModGroupType('addon')}
                      className={clsx(
                        "flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all gap-4",
                        modGroupType === 'addon' 
                          ? "bg-purple-50 border-purple-500 shadow-sm" 
                          : "bg-bg-surface border-border-light"
                      )}
                    >
                      <ListChecks className={clsx("w-8 h-8", modGroupType === 'addon' ? "text-purple-500" : "text-text-disabled")} />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest mb-1 text-text-primary font-mono">Add-on Group</div>
                        <p className="text-[10px] text-text-muted leading-tight font-medium uppercase font-mono tracking-tight">Multiple Choices</p>
                      </div>
                    </button>
                  </div>
                </div>

                {modGroupType === 'option' && (
                  <div className="flex items-center justify-between p-4 bg-bg-surface-2 rounded-lg border border-border-light">
                    <div className="flex items-center gap-3">
                      <div className={clsx("w-3 h-3 rounded-full", modGroupRequired ? "bg-accent" : "bg-text-disabled")} />
                      <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary select-none cursor-pointer">Mandatory Selection required</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModGroupRequired(!modGroupRequired)}
                      className={clsx(
                        "w-10 h-5 rounded-full p-1 transition-all flex items-center",
                        modGroupRequired ? "bg-accent justify-end" : "bg-text-disabled justify-start"
                      )}
                    >
                      <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Add Options */}
              <div className="space-y-8 pt-8 border-t border-border-light">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-text-primary text-bg-surface flex items-center justify-center text-[10px] font-bold">02</div>
                    <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-widest">Available Options</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {modOptions.map((opt, index) => (
                    <div key={index} className="flex gap-4 items-center group/opt">
                       <div className="shrink-0 cursor-move opacity-20 group-hover/opt:opacity-100 transition-opacity">
                          <GripVertical className="w-4 h-4 text-text-muted" />
                       </div>
                       <div className="flex-1 grid grid-cols-[1fr,100px] gap-3">
                          <input
                            required
                            type="text"
                            placeholder="Option Label"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...modOptions];
                              newOpts[index].label = e.target.value;
                              setModOptions(newOpts);
                            }}
                            className="input-field"
                          />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder text-[11px] font-bold z-10 pointer-events-none">{settings.currency}</span>
                            <input
                              required
                              type="number"
                              step="0.01"
                              min="0"
                              value={opt.price}
                              onChange={(e) => {
                                const newOpts = [...modOptions];
                                newOpts[index].price = parseFloat(e.target.value) || 0;
                                setModOptions(newOpts);
                              }}
                              className="input-field pl-[42px] pr-4 font-mono"
                              placeholder="0"
                            />
                          </div>
                       </div>
                       <button
                         type="button"
                         onClick={() => {
                           if (modOptions.length > 2) {
                             setModOptions(modOptions.filter((_, i) => i !== index));
                           }
                         }}
                         className="p-3 text-text-placeholder hover:text-danger hover:bg-danger-light rounded-lg transition-all"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setModOptions([...modOptions, { label: '', price: 0 }])}
                    className="w-full py-4 border-2 border-dashed border-border-light rounded-xl text-text-placeholder hover:border-text-muted hover:text-text-muted transition-all font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-3"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add New Option</span>
                  </button>
                </div>
              </div>
            </form>

            <div className="p-8 bg-bg-surface-2 border-t border-border-light sticky bottom-0 z-10">
              <button 
                onClick={handleSaveModifierGroup}
                className="btn-primary w-full py-5 text-[13px] tracking-[0.2em]"
              >
                <Save className="w-5 h-5 mr-3" />
                <span>Save Modifier Group</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
