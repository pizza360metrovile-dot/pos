import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Info, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MenuItem, ModifierGroup, ModifierOption, OrderItemModifier } from '../types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ModifierModalProps {
  item: MenuItem;
  editingId?: string;
  initialModifiers?: OrderItemModifier[];
  initialNotes?: string;
  onClose: () => void;
  onConfirm: (modifiers: OrderItemModifier[], notes: string) => void;
  titleOverride?: string;
  subtitleOverride?: string;
}

interface FocusableItem {
  id: string;
  type: 'option' | 'addon' | 'notes' | 'confirm' | 'close';
  element: HTMLElement | null;
  group?: ModifierGroup;
  option?: ModifierOption;
}

export default function ModifierModal({ 
  item, 
  editingId, 
  initialModifiers = [], 
  initialNotes = '', 
  onClose, 
  onConfirm,
  titleOverride,
  subtitleOverride
}: ModifierModalProps) {
  const { modifierGroups, modifierOptions, settings } = useStore();
  const [selectedModifiers, setSelectedModifiers] = useState<OrderItemModifier[]>(initialModifiers);
  const [notes, setNotes] = useState(initialNotes);
  const [activeFocusId, setActiveFocusId] = useState<string>('');

  const focusableElements = useRef<FocusableItem[]>([]);
  const focusIndex = useRef<number>(0);

  // Clear elements list on render so child refs rebuild it in visually sequential order
  focusableElements.current = [];

  const groups = modifierGroups
    .filter(g => String(g.menuItemId) === String(item.id))
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

  // Flat ordered list builder matching exact requested specs:
  // modifier groups -> notes textarea -> add to cart button -> cancel close X button
  const rebuildOrderedList = (): FocusableItem[] => {
    const result: FocusableItem[] = [];
    
    // 1. Modifier buttons in order
    groups.forEach(group => {
      getOptions(group.id).forEach(option => {
        const match = focusableElements.current.find(x => x.id === `option-${option.id}`);
        if (match) {
          result.push(match);
        }
      });
    });

    // 2. Notes textarea
    const notesMatch = focusableElements.current.find(x => x.id === 'notes');
    if (notesMatch) result.push(notesMatch);

    // 3. Confirm button
    const confirmMatch = focusableElements.current.find(x => x.id === 'confirm');
    if (confirmMatch) result.push(confirmMatch);

    // 4. Cancel close X button
    const closeMatch = focusableElements.current.find(x => x.id === 'close');
    if (closeMatch) result.push(closeMatch);

    return result;
  };

  const updateFocus = (newIndex: number, ordered = rebuildOrderedList()) => {
    if (ordered.length === 0) return;

    // Remove active styles from other elements in the list
    ordered.forEach(item => {
      if (item.element) {
        item.element.classList.remove('kb-focused');
      }
    });

    const len = ordered.length;
    const wrappedIndex = (newIndex + len) % len;
    focusIndex.current = wrappedIndex;

    const target = ordered[wrappedIndex];
    if (target && target.element) {
      console.log('Adding kb-focused to:', target.element.className);
      target.element.classList.add('kb-focused');
      console.log('Classes now:', target.element.className);
      target.element.focus();
      setActiveFocusId(target.id);
      
      // Smooth scroll inside container
      target.element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };

  const handleConfirmClick = () => {
    if (canConfirm) {
      onConfirm(selectedModifiers, notes);
    } else {
      const firstUnfilled = groups.find(g => {
        if (g.isRequired && g.type === 'option') {
          const hasSelection = selectedModifiers.some(m => {
            const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
            return opt && String(opt.groupId) === String(g.id);
          });
          return !hasSelection;
        }
        return false;
      });
      if (firstUnfilled) {
        toast.error(`Please make a selection for ${firstUnfilled.name}`);
        
        // Find exact ordered items
        const ordered = rebuildOrderedList();
        const firstUnfilledItem = ordered.find(item => 
          item.type === 'option' && String(item.group?.id) === String(firstUnfilled.id)
        );
        if (firstUnfilledItem) {
          const targetIdx = ordered.findIndex(item => item.id === firstUnfilledItem.id);
          if (targetIdx > -1) {
            updateFocus(targetIdx, ordered);
          }
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement> | KeyboardEvent) => {
    e.stopPropagation();

    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(e.key);
    if (isArrow) {
      const isNotesTextarea = document.activeElement?.tagName === 'TEXTAREA';
      if (!(e.key === 'Enter' && isNotesTextarea)) {
        e.preventDefault();
      }
    }

    const ordered = rebuildOrderedList();
    if (ordered.length === 0) return;

    if (e.key === 'Escape') {
      onClose();
      // Ensure focus returns to source card in POS
      setTimeout(() => {
        const targetCard = document.querySelector('.card-main.kb-focused, button.kb-focused, .kb-focused') as HTMLElement;
        if (targetCard) {
          targetCard.focus();
        }
      }, 50);
      return;
    }

    const currentItem = ordered[focusIndex.current];

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      const nextIdx = (focusIndex.current + 1) % ordered.length;
      updateFocus(nextIdx, ordered);
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      const prevIdx = (focusIndex.current - 1 + ordered.length) % ordered.length;
      updateFocus(prevIdx, ordered);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (currentItem && currentItem.type === 'option') {
        const sameGroupItems = ordered.filter(item => 
          item.type === 'option' && String(item.group?.id) === String(currentItem.group?.id)
        );
        if (sameGroupItems.length > 0) {
          const currentSubIdx = sameGroupItems.findIndex(item => item.id === currentItem.id);
          let targetItem = currentItem;
          if (e.key === 'ArrowRight') {
            const nextSubIdx = (currentSubIdx + 1) % sameGroupItems.length;
            targetItem = sameGroupItems[nextSubIdx];
          } else {
            const prevSubIdx = (currentSubIdx - 1 + sameGroupItems.length) % sameGroupItems.length;
            targetItem = sameGroupItems[prevSubIdx];
          }
          const targetGlobalIdx = ordered.findIndex(item => item.id === targetItem.id);
          if (targetGlobalIdx > -1) {
            updateFocus(targetGlobalIdx, ordered);
          }
        }
      }
    } else if (e.key === 'Enter') {
      if (currentItem) {
        if (currentItem.type === 'close') {
          onClose();
          setTimeout(() => {
            const targetCard = document.querySelector('.kb-focused') as HTMLElement;
            if (targetCard) targetCard.focus();
          }, 50);
        } else if (currentItem.type === 'option') {
          handleSelectOption(currentItem.group!, currentItem.option!);
          const nextIdx = (focusIndex.current + 1) % ordered.length;
          setTimeout(() => {
            updateFocus(nextIdx, ordered);
          }, 10);
        } else if (currentItem.type === 'addon') {
          handleSelectOption(currentItem.group!, currentItem.option!);
        } else if (currentItem.type === 'confirm') {
          handleConfirmClick();
        }
      }
    }
  };

  // Capture keys at window level to intercept before general POS listeners
  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };
    window.addEventListener('keydown', handleWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, { capture: true });
    };
  }, [selectedModifiers, notes, activeFocusId]);

  // Autofocus the prioritized first element inside modal
  useEffect(() => {
    const timer = setTimeout(() => {
      const ordered = rebuildOrderedList();
      if (ordered.length === 0) return;

      // 1. First radio option in first required Option Group
      let initialIdx = ordered.findIndex(item => 
        item.type === 'option' && item.group?.isRequired
      );

      // 2. First checkbox in first Add-on Group (if no option group)
      if (initialIdx === -1) {
        const hasOptionGroup = ordered.some(item => item.type === 'option');
        if (!hasOptionGroup) {
          initialIdx = ordered.findIndex(item => item.type === 'addon');
        }
      }

      // 3. Notes textarea (if no modifiers)
      if (initialIdx === -1) {
        initialIdx = ordered.findIndex(item => item.type === 'notes');
      }

      if (initialIdx === -1) {
        initialIdx = 0;
      }

      updateFocus(initialIdx, ordered);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-[2px] animate-fade-in"
    >
      <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         className="bg-bg-surface w-full max-w-2xl border border-border-light rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh] modifier-modal-content"
      >
        <div className="px-6 py-4.5 border-b border-border-light flex justify-between items-start shrink-0 bg-bg-surface">
          <div>
            <h2 className="text-[17px] font-bold text-text-primary leading-tight">
              {titleOverride || item.name}
            </h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              {subtitleOverride || "Customize your selection"}
            </p>
          </div>
          <button 
            ref={el => {
              if (el && !focusableElements.current.some(x => x.id === 'close')) {
                focusableElements.current.push({
                  id: 'close',
                  type: 'close',
                  element: el
                });
              }
            }}
            onClick={onClose} 
            className={clsx(
              "p-2 hover:bg-bg-surface-2 rounded-full text-text-muted hover:text-text-primary transition-all cursor-pointer",
              activeFocusId === 'close' && 'kb-focused'
            )}
          >
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
              <div key={group.id} className="space-y-4 modifier-group">
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
                     const optionId = `option-${option.id}`;
                     return (
                       <button
                         key={option.id}
                         ref={el => {
                           if (el && !focusableElements.current.some(x => x.id === optionId)) {
                             focusableElements.current.push({
                               id: optionId,
                               type: group.type,
                               element: el,
                               group,
                               option
                             });
                           }
                         }}
                         onClick={() => handleSelectOption(group, option)}
                         className={clsx(
                           "flex items-center justify-between p-4 rounded-md border-[1.5px] transition-all text-left group/opt cursor-pointer modifier-option-row",
                           selected 
                             ? "bg-accent-light border-accent text-accent font-semibold" 
                             : "bg-white border-border-light hover:border-border-strong hover:bg-bg-surface-2 text-text-primary",
                           activeFocusId === optionId && 'kb-focused'
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
               ref={el => {
                 if (el && !focusableElements.current.some(x => x.id === 'notes')) {
                   focusableElements.current.push({
                     id: 'notes',
                     type: 'notes',
                     element: el
                   });
                 }
               }}
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="Allergy info, extra spicy, sauce on side..."
               className={clsx(
                 "input-field h-24 resize-none",
                 activeFocusId === 'notes' && 'kb-focused'
               )}
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
            ref={el => {
              if (el && !focusableElements.current.some(x => x.id === 'confirm')) {
                focusableElements.current.push({
                  id: 'confirm',
                  type: 'confirm',
                  element: el
                });
              }
            }}
            onClick={handleConfirmClick}
            className={clsx(
              "btn-primary px-8 cursor-pointer font-bold uppercase text-[11px] tracking-widest",
              !canConfirm && "opacity-60 cursor-not-allowed",
              activeFocusId === 'confirm' && 'kb-focused bg-accent/90 brightness-110'
            )}
          >
            {editingId ? 'Update Item' : 'Add to Order'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
