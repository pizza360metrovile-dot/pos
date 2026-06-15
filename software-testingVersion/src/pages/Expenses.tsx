/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Wallet, 
  Calendar, 
  Filter, 
  TrendingUp, 
  Hash, 
  Coins, 
  BarChart, 
  Settings, 
  ArrowLeftRight 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Expense, ExpenseCategory, RestaurantSettings } from '../types';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { getBusinessDate, getBusinessDayStart, getBusinessDayEnd, getBusinessDateRange } from '../utils/businessDayCalculation';

type DateShortcut = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'All' | 'Custom';

export default function Expenses() {
  const { 
    expenses, 
    expenseCategories, 
    settings,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    deleteExpenseCategory,
    updateExpenseCategory
  } = useStore();

  // Filters State
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | number>('All');
  const [search, setSearch] = useState('');

  // Add/Edit Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalCategoryId, setModalCategoryId] = useState<string | number>('');
  const [modalDate, setModalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [modalNotes, setModalNotes] = useState('');

  // Category Manager Slide-over State
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Delete Confirmation Modal State
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);

  // Currency Formatter
  const formatCurrency = (amount: number) => {
    const symbol = settings?.currency || 'Rs.';
    const formattedAmount = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (settings?.currencyPosition === 'after') {
      return `${formattedAmount} ${symbol}`;
    }
    return `${symbol} ${formattedAmount}`;
  };

  // 1. Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Search
      if (search) {
        const lowerSearch = search.toLowerCase();
        const titleMatch = expense.title.toLowerCase().includes(lowerSearch);
        const notesMatch = expense.notes?.toLowerCase().includes(lowerSearch);
        if (!titleMatch && !notesMatch) return false;
      }

      // Category
      if (selectedCategoryId !== 'All') {
        if (Number(expense.categoryId) !== Number(selectedCategoryId)) return false;
      }

      // Date Shortcut / Range using businessDate
      const expBizTime = expense.businessDate ? new Date(expense.businessDate).getTime() : getBusinessDate(expense.date).getTime();
      const now = new Date();
      const nowMs = now.getTime();

      if (dateShortcut === 'Today') {
        const bizToday = getBusinessDate(nowMs);
        return expBizTime === bizToday.getTime();
      } else if (dateShortcut === 'Yesterday') {
        const bizToday = getBusinessDate(nowMs);
        const yesterday = new Date(bizToday);
        yesterday.setDate(yesterday.getDate() - 1);
        return expBizTime === yesterday.getTime();
      } else if (dateShortcut === 'This Week') {
        const bizToday = getBusinessDate(nowMs);
        const currentDay = bizToday.getDay();
        const gap = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(bizToday);
        monday.setDate(bizToday.getDate() - gap);
        return expBizTime >= monday.getTime() && expBizTime <= bizToday.getTime();
      } else if (dateShortcut === 'This Month') {
        const bizToday = getBusinessDate(nowMs);
        const firstOfMonth = new Date(bizToday.getFullYear(), bizToday.getMonth(), 1);
        return expBizTime >= firstOfMonth.getTime() && expBizTime <= bizToday.getTime();
      } else if (dateShortcut === 'Custom') {
        if (customStartDate) {
          const sDate = new Date(`${customStartDate}T00:00:00`);
          if (expBizTime < sDate.getTime()) return false;
        }
        if (customEndDate) {
          const eDate = new Date(`${customEndDate}T00:00:00`);
          if (expBizTime > eDate.getTime()) return false;
        }
      }
      return true;
    });
  }, [expenses, search, selectedCategoryId, dateShortcut, customStartDate, customEndDate]);

  // 2. Statistics Bar Live Calculations
  const stats = useMemo(() => {
    if (filteredExpenses.length === 0) {
      return { total: 0, count: 0, highest: 0, average: 0 };
    }
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const count = filteredExpenses.length;
    const highest = Math.max(...filteredExpenses.map(e => e.amount));
    const average = total / count;
    return { total, count, highest, average };
  }, [filteredExpenses]);

  // Handle Add / Edit Submission
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    const amountVal = parseFloat(modalAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid amount greater than zero');
      return;
    }
    if (!modalCategoryId) {
      toast.error('Please select an expense category');
      return;
    }

    try {
      const expensePayload = {
        title: modalTitle.trim(),
        amount: amountVal,
        categoryId: Number(modalCategoryId),
        date: new Date(modalDate).getTime(),
        notes: modalNotes.trim() || undefined,
        createdAt: editingExpense ? editingExpense.createdAt : Date.now()
      };

      if (editingExpense) {
        await updateExpense({
          ...expensePayload,
          id: editingExpense.id
        });
        toast.success('Expense updated');
      } else {
        await addExpense(expensePayload);
        toast.success('Expense saved');
      }

      setIsExpenseModalOpen(false);
      resetModalFields();
    } catch (err) {
      toast.error('Failed to save expense');
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setModalTitle('');
    setModalAmount('');
    if (expenseCategories.length > 0) {
      setModalCategoryId(expenseCategories[0].id!);
    } else {
      setModalCategoryId('');
    }
    setModalDate(format(new Date(), 'yyyy-MM-dd'));
    setModalNotes('');
    setIsExpenseModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setModalTitle(expense.title);
    setModalAmount(expense.amount.toString());
    setModalCategoryId(expense.categoryId);
    setModalDate(format(new Date(expense.date), 'yyyy-MM-dd'));
    setModalNotes(expense.notes || '');
    setIsExpenseModalOpen(true);
  };

  const resetModalFields = () => {
    setEditingExpense(null);
    setModalTitle('');
    setModalAmount('');
    setModalCategoryId('');
    setModalDate(format(new Date(), 'yyyy-MM-dd'));
    setModalNotes('');
  };

  // Delete expense confirmation
  const triggerDeleteExpense = (id: number) => {
    setDeleteExpenseId(id);
  };

  const confirmDeleteExpense = async () => {
    if (deleteExpenseId !== null) {
      try {
        await deleteExpense(deleteExpenseId);
        toast.success('Expense deleted');
        setDeleteExpenseId(null);
      } catch (err) {
        toast.error('Failed to delete expense');
        console.error(err);
      }
    }
  };

  // Category manager handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    const duplicate = expenseCategories.some(
      c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    if (duplicate) {
      toast.error('Category with this name already exists');
      return;
    }

    try {
      await addExpenseCategory({ name: newCategoryName.trim() });
      toast.success('Expense category added');
      setNewCategoryName('');
    } catch (err) {
      toast.error('Failed to add category');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategoryName.trim()) return;

    const duplicate = expenseCategories.some(
      c => c.id !== editingCategory.id && c.name.toLowerCase() === editingCategoryName.trim().toLowerCase()
    );
    if (duplicate) {
      toast.error('Another category with this name already exists');
      return;
    }

    try {
      await updateExpenseCategory({
        id: editingCategory.id,
        name: editingCategoryName.trim()
      });
      toast.success('Category updated successfully');
      setEditingCategory(null);
      setEditingCategoryName('');
    } catch (err) {
      toast.error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    const assignedCount = expenses.filter(e => Number(e.categoryId) === Number(catId)).length;
    if (assignedCount > 0) {
      toast.error(`Cannot delete category. There are ${assignedCount} expenses assigned to it.`);
      return;
    }

    try {
      await deleteExpenseCategory(catId);
      toast.success('Category deleted');
      if (modalCategoryId === catId) {
        setModalCategoryId('');
      }
    } catch (err) {
      toast.error('Failed to delete category');
    }
  };

  // Deterministic light bagde styling based on name length
  const getCategoryBadgeStyle = (name: string) => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      { bg: 'bg-blue-50 text-blue-700 border-blue-200' },
      { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      { bg: 'bg-amber-50 text-amber-700 border-amber-200' },
      { bg: 'bg-rose-50 text-rose-700 border-rose-200' },
      { bg: 'bg-purple-50 text-purple-700 border-purple-200' },
      { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    ];
    return colors[hash % colors.length];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 id="expenses-header" className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-gray-700" />
            Expenses Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">Track restaurant operations, utilities, material acquisitions, and general expenditures.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Manage Categories
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Zone 1 — Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div id="stat-total" className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Expenses</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total)}</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div id="stat-entries" className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Entries Count</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.count}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg border border-slate-100">
            <Hash className="h-6 w-6" />
          </div>
        </div>

        <div id="stat-highest" className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Highest Entry</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.highest)}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        <div id="stat-average" className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Average Expense</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.average)}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <BarChart className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Zone 2 — Filters + Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm gap-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Query Search */}
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search title, parameters, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3 relative flex items-center">
            <Filter className="absolute left-3 text-gray-400 h-4 w-4 pointer-events-none" />
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent appearance-none transition-all cursor-pointer"
            >
              <option value="All">All Categories</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range shortcuts */}
          <div className="lg:col-span-5 flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            {(['All', 'Today', 'Yesterday', 'This Week', 'This Month', 'Custom'] as DateShortcut[]).map((sc) => (
              <button
                key={sc}
                onClick={() => setDateShortcut(sc)}
                className={clsx(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                  dateShortcut === sc
                    ? "bg-white text-gray-950 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                )}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range option expand block */}
        <AnimatePresence>
          {dateShortcut === 'Custom' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Filter Info Badge */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
          <div>
            Showing <strong className="text-gray-800">{filteredExpenses.length}</strong> matching expense recorded items.
          </div>
          {(search || selectedCategoryId !== 'All' || dateShortcut !== 'All') && (
            <button 
              onClick={() => {
                setSearch('');
                setSelectedCategoryId('All');
                setDateShortcut('All');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-gray-700 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Zone 3 — Expenses List Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center max-w-sm mx-auto space-y-3">
            <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto border border-gray-100 text-gray-400">
              <Wallet className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No Expenses Found</h3>
            <p className="text-xs text-gray-400 leading-relaxed">Adjust your active filter criteria or click the button above to record your first operational expense entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes/Details</th>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                  <th scope="col" className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {filteredExpenses.map((exp) => {
                  const cat = expenseCategories.find(c => Number(c.id) === Number(exp.categoryId));
                  const badgeStyle = getCategoryBadgeStyle(cat?.name || 'Other');
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
                        {format(new Date(exp.date), 'dd MMM yyyy, HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {exp.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle.bg}`}>
                          {cat?.name || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-y-0.5 text-xs text-gray-500 max-w-xs truncate" title={exp.notes}>
                        {exp.notes ? exp.notes : <span className="text-gray-300 italic">None</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => openEditModal(exp)}
                            className="text-gray-400 hover:text-gray-900 transition-colors"
                            title="Edit Expense"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => triggerDeleteExpense(exp.id!)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Centered Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black"
              onClick={() => setIsExpenseModalOpen(false)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-w-md w-full relative z-10 flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingExpense ? 'Edit Expense Entry' : 'Record New Expense'}
                </h3>
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Expense Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electricity Bill Jan, Tomatoes 10kg"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>

                {/* Amount & Date Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Amount ({settings?.currency || 'Rs.'}) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Expense Date *</label>
                    <input
                      type="date"
                      required
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </div>
                </div>

                {/* Category with Manage Link */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase">Expense Category *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExpenseModalOpen(false);
                        setIsCategoryManagerOpen(true);
                      }}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline"
                    >
                      + Manage Categories
                    </button>
                  </div>
                  <select
                    value={modalCategoryId}
                    onChange={(e) => setModalCategoryId(e.target.value)}
                    required
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
                  >
                    <option value="" disabled>Select category...</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id!}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Notes / Explanations (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Enter short details about this transaction..."
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                  />
                </div>

                {/* Actions Grid */}
                <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-850 text-white rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteExpenseId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black"
              onClick={() => setDeleteExpenseId(null)}
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-w-sm w-full relative z-10 p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-gray-900">Confirm Expense Deletion</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Are you sure you want to permanently delete this expense record? This action will sync across your database instantly and cannot be undone.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setDeleteExpenseId(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteExpense}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                >
                  Delete Expense
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Panel for Category Manager */}
      <AnimatePresence>
        {isCategoryManagerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryManagerOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Slide-over Main Area */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col h-full border-l border-gray-100"
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Manage Expense Categories</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Add, delete, and adjust expense grouping tags.</p>
                </div>
                <button
                  onClick={() => setIsCategoryManagerOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Section A: Create Category Form */}
                <form onSubmit={handleAddCategory} className="space-y-3 bg-gray-50 border border-gray-200 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Create New Category</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Raw Goods, Gas Supplies"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-xs flex-1 bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs rounded-lg"
                    >
                      Create
                    </button>
                  </div>
                </form>

                {/* Section B: Edit Category Form (Active edit item overlay) */}
                <AnimatePresence>
                  {editingCategory && (
                    <motion.form
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleUpdateCategory}
                      className="space-y-3 bg-indigo-50 border border-indigo-200 p-4 rounded-xl"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Edit Category Name</h4>
                        <button 
                          type="button" 
                          onClick={() => setEditingCategory(null)}
                          className="text-xs text-indigo-500 hover:text-indigo-800 font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="px-3 py-2 border border-indigo-300 rounded-lg text-xs flex-1 bg-white focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg"
                        >
                          Save
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Section C: Category list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Configured Categories</span>
                    <span className="text-[10px] font-medium text-gray-400 normal-case">{expenseCategories.length} items</span>
                  </h4>

                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {expenseCategories.map((cat) => {
                      const count = expenses.filter(e => Number(e.categoryId) === Number(cat.id)).length;
                      return (
                        <li key={cat.id} className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                          <div>
                            <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                            <span className="ml-2 text-[10px] text-gray-400 group-hover:text-gray-500 transition-colors">
                              {count} entries
                            </span>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setEditingCategoryName(cat.name);
                              }}
                              className="text-xs text-gray-600 hover:text-gray-900 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id!)}
                              className="text-xs text-red-600 hover:text-red-900 hover:underline font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
