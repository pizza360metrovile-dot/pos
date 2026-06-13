/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MenuItem, ModifierGroup, ModifierOption, OrderItemModifier, DealOrderComponent } from '../types';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface DealModalProps {
  dealItem: MenuItem;
  components: {
    _tempId: string;
    componentMenuItemId: string;
    componentName: string;
    unitIndex: number;
    totalUnits: number;
    applicableGroups: ModifierGroup[];
  }[];
  onClose: () => void;
  onConfirm: (finalComponents: Omit<DealOrderComponent, 'orderItemId'>[]) => void;
}

interface FocusableItem {
  id: string; // e.g. comp-${compIdx}-group-${group.id}-opt-${option.id}
  type: 'option' | 'addon' | 'notes' | 'confirm' | 'close' | 'cancel';
  element: HTMLElement | null;
  compIdx?: number;
  group?: ModifierGroup;
  option?: ModifierOption;
}

export default function DealModal({
  dealItem,
  components,
  onClose,
  onConfirm
}: DealModalProps) {
  const { modifierOptions, settings } = useStore();
  const [configuredComponents, setConfiguredComponents] = useState(() =>
    components.map(comp => ({
      ...comp,
      modifiers: [] as OrderItemModifier[],
      notes: ''
    }))
  );
  const [activeFocusId, setActiveFocusId] = useState<string>('');

  const focusableElements = useRef<FocusableItem[]>([]);
  const focusIndex = useRef<number>(0);

  // Clear elements list on render so child refs rebuild it in visually sequential order
  focusableElements.current = [];

  const getOptions = (groupId: string | number) =>
    modifierOptions
      .filter(o => String(o.groupId) === String(groupId))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleSelectModifier = (compIndex: number, group: ModifierGroup, option: ModifierOption) => {
    setConfiguredComponents(prev => prev.map((c, idx) => {
      if (idx !== compIndex) return c;
      const currentModifiers = c.modifiers;
      if (group.type === 'option') {
        // radio logic
        const otherGroups = currentModifiers.filter(m => {
          const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
          return opt && String(opt.groupId) !== String(group.id);
        });
        return {
          ...c,
          modifiers: [...otherGroups, {
            modifierGroupId: group.id,
            modifierOptionId: option.id,
            label: option.label,
            additionalPrice: 0 // modifiers inside deals are included/free
          }]
        };
      } else {
        // checkbox logic
        const existingIdx = currentModifiers.findIndex(m => String(m.modifierOptionId) === String(option.id));
        const newModifiers = existingIdx > -1
          ? currentModifiers.filter(m => String(m.modifierOptionId) !== String(option.id))
          : [...currentModifiers, {
              modifierGroupId: group.id,
              modifierOptionId: option.id,
              label: option.label,
              additionalPrice: 0
            }];
        return {
          ...c,
          modifiers: newModifiers
        };
      }
    }));
  };

  const handleNotesChange = (compIndex: number, text: string) => {
    setConfiguredComponents(prev => prev.map((c, idx) => {
      if (idx !== compIndex) return c;
      return { ...c, notes: text };
    }));
  };

  const isOptionSelected = (compIndex: number, optionId: string | number) =>
    configuredComponents[compIndex].modifiers.some(m => String(m.modifierOptionId) === String(optionId));

  const canConfirm = configuredComponents.every(comp => {
    return comp.applicableGroups.every(g => {
      if (g.isRequired && g.type === 'option') {
        return comp.modifiers.some(m => {
          const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
          return opt && String(opt.groupId) === String(g.id);
        });
      }
      return true;
    });
  });

  const handleAddClick = () => {
    const finalComponents: Omit<DealOrderComponent, 'orderItemId'>[] = configuredComponents.map(c => ({
      componentMenuItemId: c.componentMenuItemId,
      componentName: c.componentName,
      unitIndex: c.unitIndex,
      quantity: 1,
      notes: c.notes,
      modifiers: c.modifiers
    }));
    onConfirm(finalComponents);
  };

  // Rebuild ordering sequentially matching precise spec layout:
  // Component 1 modifiers + notes, then Component 2 modifiers + notes... then Footer actions, etc.
  const rebuildOrderedList = (): FocusableItem[] => {
    const result: FocusableItem[] = [];

    configuredComponents.forEach((comp, compIdx) => {
      // Modifiers in order
      comp.applicableGroups.forEach(group => {
        getOptions(group.id).forEach(option => {
          const id = `comp-${compIdx}-group-${group.id}-opt-${option.id}`;
          const match = focusableElements.current.find(x => x.id === id);
          if (match) {
            result.push(match);
          }
        });
      });

      // Notes input of this component
      const notesId = `comp-${compIdx}-notes`;
      const notesMatch = focusableElements.current.find(x => x.id === notesId);
      if (notesMatch) result.push(notesMatch);
    });

    // Add to Cart
    const confirmMatch = focusableElements.current.find(x => x.id === 'confirm');
    if (confirmMatch) result.push(confirmMatch);

    // Cancel buttons (footer first)
    const cancelMatch = focusableElements.current.find(x => x.id === 'cancel');
    if (cancelMatch) result.push(cancelMatch);

    // Close header button
    const closeMatch = focusableElements.current.find(x => x.id === 'close');
    if (closeMatch) result.push(closeMatch);

    return result;
  };

  const updateFocus = (newIndex: number, ordered = rebuildOrderedList()) => {
    if (ordered.length === 0) return;

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
      target.element.classList.add('kb-focused');
      target.element.focus();
      setActiveFocusId(target.id);
      
      // Auto scroll to keep focused elements visible inside scrollable container
      target.element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  };

  const handleConfirmClick = () => {
    if (canConfirm) {
      handleAddClick();
    } else {
      let firstUnfilledCompIdx = -1;
      let firstUnfilledGroup: ModifierGroup | null = null;

      for (let cIdx = 0; cIdx < configuredComponents.length; cIdx++) {
        const comp = configuredComponents[cIdx];
        const unfilled = comp.applicableGroups.find(g => {
          if (g.isRequired && g.type === 'option') {
            const hasSelection = comp.modifiers.some(m => {
              const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
              return opt && String(opt.groupId) === String(g.id);
            });
            return !hasSelection;
          }
          return false;
        });
        if (unfilled) {
          firstUnfilledCompIdx = cIdx;
          firstUnfilledGroup = unfilled;
          break;
        }
      }

      if (firstUnfilledGroup && firstUnfilledCompIdx > -1) {
        toast.error(`Please select option for ${firstUnfilledGroup.name} in component "${configuredComponents[firstUnfilledCompIdx].componentName}"`);
        
        const ordered = rebuildOrderedList();
        const targetIdPrefix = `comp-${firstUnfilledCompIdx}-group-${firstUnfilledGroup.id}`;
        const targetItem = ordered.find(item => item.id.startsWith(targetIdPrefix));
        if (targetItem) {
          const targetIdx = ordered.findIndex(item => item.id === targetItem.id);
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
      const isNotesInput = document.activeElement?.tagName === 'INPUT' && document.activeElement?.getAttribute('placeholder')?.includes('Notes');
      if (!isNotesInput) {
        e.preventDefault();
      }
    }

    const ordered = rebuildOrderedList();
    if (ordered.length === 0) return;

    if (e.key === 'Escape') {
      onClose();
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
          item.type === 'option' && 
          item.compIdx === currentItem.compIdx && 
          String(item.group?.id) === String(currentItem.group?.id)
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
        if (currentItem.type === 'close' || currentItem.type === 'cancel') {
          onClose();
          setTimeout(() => {
            const targetCard = document.querySelector('.kb-focused') as HTMLElement;
            if (targetCard) targetCard.focus();
          }, 50);
        } else if (currentItem.type === 'option') {
          handleSelectModifier(currentItem.compIdx!, currentItem.group!, currentItem.option!);
          const nextIdx = (focusIndex.current + 1) % ordered.length;
          setTimeout(() => {
            updateFocus(nextIdx, ordered);
          }, 10);
        } else if (currentItem.type === 'addon') {
          handleSelectModifier(currentItem.compIdx!, currentItem.group!, currentItem.option!);
        } else if (currentItem.type === 'confirm') {
          handleConfirmClick();
        }
      }
    }
  };

  // Capturing window-level listener to override other keys
  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };
    window.addEventListener('keydown', handleWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, { capture: true });
    };
  }, [configuredComponents, activeFocusId]);

  // Autofocus according to priorities on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const ordered = rebuildOrderedList();
      if (ordered.length === 0) return;

      // 1. First radio option in first required Option Group across any component card
      let initialIdx = ordered.findIndex(item => 
        item.type === 'option' && item.group?.isRequired
      );

      // 2. First checkbox in first Add-on Group (if no option group at all in the modal)
      if (initialIdx === -1) {
        const hasOptionGroup = ordered.some(item => item.type === 'option');
        if (!hasOptionGroup) {
          initialIdx = ordered.findIndex(item => item.type === 'addon');
        }
      }

      // 3. Notes text input of the first component
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
        className="bg-bg-surface w-full max-w-3xl border border-border-light rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border-light flex justify-between items-start shrink-0 bg-bg-surface">
          <div>
            <h2 className="text-[17px] font-bold text-text-primary leading-tight">
              Customize Deal: {dealItem.name}
            </h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              Specify selections for each included component. Fixed price: {settings.currency}{dealItem.price.toFixed(2)}
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

        {/* Scrollable Contents representing component stack */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-bg-surface">
          {configuredComponents.map((comp, compIdx) => (
            <div key={comp._tempId} className="p-5 bg-bg-surface border border-border-light rounded-lg space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-dashed border-border-light pb-3">
                <h4 className="text-[14px] font-bold text-accent">
                  {comp.componentName} <span className="text-text-muted font-normal text-xs ml-1">(unit {comp.unitIndex} of {comp.totalUnits})</span>
                </h4>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider font-mono">
                  COMPONENT UNIT {compIdx + 1}
                </div>
              </div>

              {comp.applicableGroups.map(group => {
                const options = getOptions(group.id);
                if (options.length === 0) return null;

                const isGroupValid = !group.isRequired || comp.modifiers.some(m => {
                  const opt = modifierOptions.find(o => String(o.id) === String(m.modifierOptionId));
                  return opt && String(opt.groupId) === String(group.id);
                });

                return (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary leading-none">{group.name}</span>
                        {group.isRequired && (
                          <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            isGroupValid
                              ? "bg-success-light text-success border-success-border"
                              : "bg-danger-light text-danger border-danger-border animate-pulse"
                          )}>
                            {isGroupValid ? "Completed" : "Required"}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted uppercase font-mono">
                        {group.type === 'option' ? 'Pick One' : 'Add Multiple'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {options.map(option => {
                        const selected = isOptionSelected(compIdx, option.id);
                        const itemId = `comp-${compIdx}-group-${group.id}-opt-${option.id}`;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            ref={el => {
                              if (el && !focusableElements.current.some(x => x.id === itemId)) {
                                focusableElements.current.push({
                                  id: itemId,
                                  type: group.type,
                                  element: el,
                                  compIdx,
                                  group,
                                  option
                                });
                              }
                            }}
                            onClick={() => handleSelectModifier(compIdx, group, option)}
                            className={clsx(
                              "flex items-center justify-between p-3 rounded-md border text-left transition-all cursor-pointer",
                              selected
                                ? "bg-accent-light border-accent text-accent font-semibold"
                                : "bg-white border-border-light hover:border-border-strong hover:bg-bg-surface-2 text-text-primary",
                              activeFocusId === itemId && 'kb-focused'
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={clsx(
                                "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                selected ? "bg-accent border-accent" : "border-border-medium bg-white"
                              )}>
                                {selected && <Check className="w-2 h-2 text-white stroke-[4]" />}
                              </div>
                              <span className="text-xs leading-tight tracking-tight">{option.label}</span>
                            </div>
                            <span className="text-[10px] font-bold text-text-disabled">INCLUDED</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider font-mono">Component Notes</label>
                <input
                  type="text"
                  ref={el => {
                    const notesId = `comp-${compIdx}-notes`;
                    if (el && !focusableElements.current.some(x => x.id === notesId)) {
                      focusableElements.current.push({
                        id: notesId,
                        type: 'notes',
                        element: el,
                        compIdx
                      });
                    }
                  }}
                  value={comp.notes}
                  onChange={(e) => handleNotesChange(compIdx, e.target.value)}
                  placeholder="Notes (e.g. no onions, sauce on side...)"
                  className={clsx(
                    "input-field text-xs h-9",
                    activeFocusId === `comp-${compIdx}-notes` && 'kb-focused'
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg-surface-2 border-t border-border-light flex items-center justify-between shrink-0 rounded-b-xl">
          <button
            type="button"
            ref={el => {
              if (el && !focusableElements.current.some(x => x.id === 'cancel')) {
                focusableElements.current.push({
                  id: 'cancel',
                  type: 'cancel',
                  element: el
                });
              }
            }}
            onClick={onClose}
            className={clsx(
              "px-6 h-10 border-[1.5px] border-border-medium rounded-md text-xs font-semibold text-text-secondary hover:bg-white hover:border-border-strong transition-all cursor-pointer",
              activeFocusId === 'cancel' && 'kb-focused'
            )}
          >
            Cancel
          </button>
          <button
            type="button"
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
              "px-8 h-10 rounded-md text-xs font-bold transition-all shadow-md cursor-pointer",
              !canConfirm && "opacity-60 cursor-not-allowed shadow-none",
              canConfirm && "bg-accent text-white hover:bg-accent/90",
              activeFocusId === 'confirm' && 'kb-focused brightness-110'
            )}
          >
            Add Deal to Cart
          </button>
        </div>
      </motion.div>
    </div>
  );
}
