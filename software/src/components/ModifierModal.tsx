import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Info, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MenuItem, ModifierGroup, ModifierOption, OrderItemModifier } from '../types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface ModifierModalProps {
  item: MenuItem;
  editingId?: string;
  initialModifiers?: OrderItemModifier[];
  initialNotes?: string;
  onClose: () => void;
  onConfirm: (modifiers: OrderItemModifier[], notes: string) => void;
}

export default function ModifierModal({ 
  item, 
  editingId, 
  initialModifiers = [], 
  initialNotes = '', 
  onClose, 
  onConfirm 
}: ModifierModalProps) {
  const { modifierGroups, modifierOptions, settings } = useStore();
  const [selectedModifiers, setSelectedModifiers] = useState<OrderItemModifier[]>(initialModifiers);
  const [notes, setNotes] = useState(initialNotes);

  const groups = modifierGroups
    .filter(g => String(g.categoryId) === String(item.categoryId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const getOptions = (groupId: string | number) => 
    modifierOptions
      .filter(o => String(o.groupId) === String(groupId))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleSelectOption = (group: ModifierGroup, option: ModifierOption) => {
    if (group.type === 'option') {
      // Radio logic: remove other options from this group
      const otherGroups = selectedModifiers.filter(m => {
        const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
        return opt && String(opt.groupId) !== String(group.id);
      });
      setSelectedModifiers([...otherGroups, {
        modifierGroupId: group.id,
        modifierOptionId: option.id,
        label: option.label,
        additionalPrice: option.additionalPrice
      }]);
    } else {
      // Add-on logic: toggle
      const existingIdx = selectedModifiers.findIndex(m => String(m.modifierOptionId) === String(option.id));
      if (existingIdx > -1) {
        setSelectedModifiers(selectedModifiers.filter(m => String(m.modifierOptionId) !== String(option.id)));
      } else {
        setSelectedModifiers([...selectedModifiers, {
          modifierGroupId: group.id,
          modifierOptionId: option.id,
          label: option.label,
          additionalPrice: option.additionalPrice
        }]);
      }
    }
  };

  const isOptionSelected = (optionId: string | number) => 
    selectedModifiers.some(m => String(m.modifierOptionId) === String(optionId));

  const modifierTotal = selectedModifiers.reduce((sum, m) => sum + m.additionalPrice, 0);
  const itemTotal = item.price + modifierTotal;

  const canConfirm = groups.every(g => {
    if (g.isRequired && g.type === 'option') {
      return selectedModifiers.some(m => {
        const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
        return opt && String(opt.groupId) === String(g.id);
      });
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-bg-surface w-full max-w-2xl border border-border-light rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4.5 border-b border-border-light flex justify-between items-start shrink-0 bg-bg-surface">
          <div>
            <h2 className="text-[17px] font-bold text-text-primary leading-tight">{item.name}</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Customize your selection</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-surface-2 rounded-full text-text-muted hover:text-text-primary transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-bg-surface">
          {groups.length === 0 ? (
            <div className="py-20 text-center space-y-4">
               <Info className="w-12 h-12 text-text-disabled mx-auto" />
               <p className="text-sm font-semibold text-text-muted">No customizations available</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.id} className="space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <h3 className="text-[15px] font-bold text-text-primary">{group.name}</h3>
                      {group.isRequired && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 bg-danger-light text-danger rounded-full border border-danger-border">Required</span>
                      )}
                   </div>
                   <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                     {group.type === 'option' ? 'Pick One' : 'Add Multiple'}
                   </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   {getOptions(group.id).map(option => {
                     const selected = isOptionSelected(option.id);
                     return (
                       <button
                         key={option.id}
                         onClick={() => handleSelectOption(group, option)}
                         className={clsx(
                           "flex items-center justify-between p-4 rounded-md border-[1.5px] transition-all text-left group/opt",
                           selected 
                             ? "bg-accent-light border-accent text-accent font-semibold" 
                             : "bg-white border-border-light hover:border-border-strong hover:bg-bg-surface-2 text-text-primary"
                         )}
                       >
                         <div className="flex items-center gap-3">
                            <div className={clsx(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                              selected ? "bg-accent border-accent" : "border-border-medium bg-white"
                            )}>
                              {selected && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                            </div>
                            <span className="text-sm tracking-tight">{option.label}</span>
                         </div>
                         <span className={clsx(
                           "text-[12px] font-bold font-mono",
                           selected ? "text-accent" : "text-success"
                         )}>
                           {option.additionalPrice > 0 ? `+${settings.currency}${option.additionalPrice.toFixed(2)}` : 'FREE'}
                         </span>
                       </button>
                     );
                   })}
                </div>
              </div>
            ))
          )}

          <div className="space-y-2 pt-2">
             <label className="input-label">Special Preparations</label>
             <textarea
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Allergy info, extra spicy, sauce on side..."
               className="input-field h-24 resize-none"
             />
          </div>
        </div>

        <div className="px-6 py-4 bg-bg-surface-2 border-t border-border-light flex items-center justify-between shrink-0 rounded-b-xl">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">Total Adjustment</span>
            <div className="text-lg font-extrabold text-accent font-mono leading-none">
              {settings.currency}{itemTotal.toFixed(2)}
            </div>
          </div>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedModifiers, notes)}
            className="btn-primary px-8"
          >
            {editingId ? 'Update Item' : 'Add to Order'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
