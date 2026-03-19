import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import './App.css';

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  time: string;
  category?: string;
  paymentMode?: string;
  remark?: string;
}

interface Settings {
  theme: 'light' | 'dark';
  timeFormat: '12h' | '24h';
}

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [remark, setRemark] = useState('');

  // Sidebar and View State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('Add Expense');

  // Filters state
  const [categoryFilters, setCategoryFilters] = useState<string[]>(['All']);
  const [dateFilter, setDateFilter] = useState('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date()); // Month currently viewed in calendar

  // Settings
  const [settings, setSettings] = useState<Settings>({ theme: 'light', timeFormat: '12h' });

  // Backup & Restore
  // edit mode
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const defaultCategories = [
    "Food & Dining",
    "Transportation",
    "Shopping",
    "Entertainment",
    "Bills & Utilities",
    "Health",
    "Travel",
    "Other",
  ];
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [showNumPad, setShowNumPad] = useState(false);

  const evaluateExpression = (expr: string) => {
    try {
      // Remove any trailing operators before calculating
      const cleanExpr = expr.replace(/[+\-*/]$/, '');
      if (!cleanExpr) return '0';
      
      // Simple evaluator using Function constructor for basic math
      // Safe here because we control the input (only numbers and operators)
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${cleanExpr}`)();
      if (isNaN(result) || !isFinite(result)) return '0';
      
      // Format to 2 decimal places if needed
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    } catch (e) {
      return expr;
    }
  };

  const handleNumPadPress = (value: string) => {
    if (value === 'back') {
      setAmount(amount.slice(0, -1));
    } else if (value === '=') {
      setAmount(evaluateExpression(amount));
    } else if (['+', '-', '*', '/'].includes(value)) {
      // Don't add operator if expression is empty or last char is already an operator
      if (amount !== '' && !['+', '-', '*', '/'].includes(amount.slice(-1))) {
        setAmount(amount + value);
      }
    } else if (value === '.') {
      // Only allow decimal in the current segment of the expression
      const parts = amount.split(/[+\-*/]/);
      const lastPart = parts[parts.length - 1];
      if (!lastPart.includes('.')) {
        setAmount(amount === '' ? '0.' : amount + '.');
      }
    } else {
      // Numeric entry
      // If we just clicked an operator, we can start a new number
      // We don't need strict 2-decimal validation FOR THE EXPRESSION, 
      // the evaluateExpression will handle it at the end.
      setAmount(amount === '0' ? value : amount + value);
    }
  };

  // Centralized dropdown state for "Popup Mode"
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const savedExpenses = await Preferences.get({ key: 'expenses' });
      if (savedExpenses.value) {
        setExpenses(JSON.parse(savedExpenses.value));
      }
      const savedCategories = await Preferences.get({ key: 'categories' });
      if (savedCategories.value) {
        setCategories(JSON.parse(savedCategories.value));
      } else {
        setCategories(defaultCategories);
      }
      const savedSettings = await Preferences.get({ key: 'settings' });
      if (savedSettings.value) {
        const settingsData = JSON.parse(savedSettings.value);
        setSettings(settingsData);
        // Apply theme immediately on load
        if (settingsData.theme === 'dark') {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      }
      const savedFilters = await Preferences.get({ key: 'filters' });
      if (savedFilters.value) {
        const filtersData = JSON.parse(savedFilters.value);
         if (filtersData.categoryFilters) setCategoryFilters(filtersData.categoryFilters);
         else if (filtersData.categoryFilter) setCategoryFilters([filtersData.categoryFilter]);
        if (filtersData.dateFilter) setDateFilter(filtersData.dateFilter);
        if (filtersData.paymentModeFilter) setPaymentModeFilter(filtersData.paymentModeFilter);
        if (filtersData.startDate) setStartDate(filtersData.startDate);
        if (filtersData.endDate) setEndDate(filtersData.endDate);
      }

      setDataLoaded(true);
    };
    loadData();

    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    setDate(localDate);
    setTime(today.toTimeString().split(' ')[0].substring(0, 5));
  }, []);

  useEffect(() => {
    Preferences.set({ key: 'expenses', value: JSON.stringify(expenses) });
  }, [expenses]);

  useEffect(() => {
    if (categories.length > 0) {
      Preferences.set({ key: 'categories', value: JSON.stringify(categories) });
    }
  }, [categories]);

  useEffect(() => {
    if (!dataLoaded) return; // Prevent overwriting storage with defaults on first mount

    Preferences.set({ key: 'settings', value: JSON.stringify(settings) });
    if (settings.theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [settings, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;
    const filters = { categoryFilters, dateFilter, paymentModeFilter, startDate, endDate };
    Preferences.set({ key: 'filters', value: JSON.stringify(filters) });
  }, [categoryFilters, dateFilter, paymentModeFilter, startDate, endDate, dataLoaded]);

  useEffect(() => {
    if (activeDropdown !== 'catFilter') {
      setCatSearch('');
    }
  }, [activeDropdown]);

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date || !time) return;

    if (editExpenseId) {
      setExpenses(expenses.map(exp =>
        exp.id === editExpenseId
          ? {
            ...exp,
            amount: parseFloat(amount),
            description,
            category: category || 'Uncategorized',
            date,
            time,
            paymentMode: paymentMode || 'Not Specified',
            remark,
          }
          : exp
      ));
      setEditExpenseId(null);
    } else {
      const newExpense: Expense = {
        id: Date.now().toString(),
        amount: parseFloat(amount),
        description,
        category: category || 'Uncategorized',
        date,
        time,
        paymentMode: paymentMode || 'Not Specified',
        remark,
      };
      setExpenses([...expenses, newExpense]);
    }

    setAmount('');
    setDescription('');
    setCategory('');
    setPaymentMode('');
    setRemark('');

    // Automatically switch to dashboard after adding
    handleViewSwitch('Dashboard');
  };

  const openQuickAdd = () => {
    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const localTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    
    setAmount('');
    setDescription('');
    setCategory('');
    setPaymentMode('Cash');
    setRemark('');
    setDate(localDate);
    setTime(localTime);
    setEditExpenseId(null);
    setIsQuickAddMode(true);
    setShowNumPad(true);
  };

  const handleViewSwitch = (view: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView(view);
      setIsLoading(false);
    }, 450); // Shorter but noticeable loading time
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
    setDeleteId(null);
  };

  const handleEdit = (expense: Expense) => {
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setCategory(expense.category || '');
    setDate(expense.date);
    setTime(expense.time);
    setPaymentMode(expense.paymentMode || '');
    setRemark(expense.remark || '');
    setEditExpenseId(expense.id);
    handleViewSwitch('Add Expense');
  };

  const addCategory = () => {
    if (newCategory.trim()) {
      const trimmedName = newCategory.trim();
      if (editingCategoryIdx !== null) {
        // Edit existing
        const oldName = categories[editingCategoryIdx];
        if (oldName === trimmedName) {
          setEditingCategoryIdx(null);
          setNewCategory('');
          return;
        }

        const updatedCategories = [...categories];
        updatedCategories[editingCategoryIdx] = trimmedName;
        setCategories(updatedCategories);

        // Update all expenses with this category
        setExpenses(expenses.map(exp =>
          exp.category === oldName ? { ...exp, category: trimmedName } : exp
        ));

         // Update filter if active
         if (categoryFilters.includes(oldName)) {
           setCategoryFilters(prev => prev.map(c => c === oldName ? trimmedName : c));
         }
         if (category === oldName) setCategory(trimmedName);

        setEditingCategoryIdx(null);
      } else {
        // Add new
        if (!categories.includes(trimmedName)) {
          setCategories([...categories, trimmedName]);
        }
      }
      setNewCategory('');
    }
  };

  const toggleCategoryFilter = (cat: string) => {
    if (cat === 'All') {
      setCategoryFilters(['All']);
      return;
    }
    
    setCategoryFilters(prev => {
      const withoutAll = prev.filter(c => c !== 'All');
      if (withoutAll.includes(cat)) {
        const next = withoutAll.filter(c => c !== cat);
        return next.length === 0 ? ['All'] : next;
      } else {
        return [...withoutAll, cat];
      }
    });
  };

   const deleteCategory = (catToDelete: string) => {
    setCategories(categories.filter(cat => cat !== catToDelete));
    if (categoryFilters.includes(catToDelete)) {
      setCategoryFilters(prev => {
        const next = prev.filter(c => c !== catToDelete);
        return next.length === 0 ? ['All'] : next;
      });
    }
    if (category === catToDelete) setCategory('');
  };

  const startEditCategory = (index: number) => {
    setEditingCategoryIdx(index);
    setNewCategory(categories[index]);
  };

  const filteredExpenses = expenses.filter(expense => {
    if (!categoryFilters.includes('All')) {
      if (!categoryFilters.includes(expense.category || 'Uncategorized')) return false;
    }
    if (paymentModeFilter !== 'All' && expense.paymentMode !== paymentModeFilter) return false;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const inDesc = expense.description.toLowerCase().includes(query);
      const inRemark = expense.remark?.toLowerCase().includes(query);
      const inCategory = expense.category?.toLowerCase().includes(query);
      if (!inDesc && !inRemark && !inCategory) return false;
    }

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.getFullYear() + '-' + String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0') + '-' + String(thirtyDaysAgo.getDate()).padStart(2, '0');

    const firstOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const fpmStr = firstOfPrevMonth.getFullYear() + '-' + String(firstOfPrevMonth.getMonth() + 1).padStart(2, '0') + '-' + String(firstOfPrevMonth.getDate()).padStart(2, '0');
    const lpmStr = lastOfPrevMonth.getFullYear() + '-' + String(lastOfPrevMonth.getMonth() + 1).padStart(2, '0') + '-' + String(lastOfPrevMonth.getDate()).padStart(2, '0');

    if (dateFilter === 'Today' && expense.date !== todayStr) return false;
    if (dateFilter === 'Yesterday' && expense.date !== yesterdayStr) return false;
    if (dateFilter === 'Tomorrow' && expense.date !== tomorrowStr) return false;
    if (dateFilter === 'Last 30 Days' && (expense.date < thirtyDaysAgoStr || expense.date > todayStr)) return false;
    if (dateFilter === 'Last Month' && (expense.date < fpmStr || expense.date > lpmStr)) return false;

    if (dateFilter === 'Date Range') {
      if (startDate && expense.date < startDate) return false;
      if (endDate && expense.date > endDate) return false;
    }

    return true;
  });

  // Calendar Helpers
  const getDaysInMonth = (month: Date) => {
    const year = month.getFullYear();
    const mon = month.getMonth();
    const firstDay = new Date(year, mon, 1).getDay();
    const days = new Date(year, mon + 1, 0).getDate();
    return { firstDay, days };
  };

  const handleDateClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate('');
    } else if (startDate && !endDate) {
      if (dateStr < startDate) {
        setEndDate(startDate);
        setStartDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  const formatCalDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Calendar Helpers
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (settings.timeFormat === '24h') return timeStr;
    const [hour, minute] = timeStr.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
  };

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateB.getTime() - dateA.getTime();
  });

  const totalExpense = sortedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleBackup = async () => {
    const dataStr = JSON.stringify({ expenses, categories, settings }, null, 2);
    const fileName = `expense_backup_${new Date().toISOString().split('T')[0]}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: 'Expense Tracker Backup',
          text: 'Your expense tracker backup data',
          url: result.uri,
        });
      } catch (err) {
        console.error('Error sharing backup file', err);
        alert('Failed to generate backup file for sharing');
      }
    } else {
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (data.expenses) setExpenses(data.expenses);
        if (data.categories) setCategories(data.categories);
        if (data.settings) setSettings(data.settings);
        alert('Data restored successfully!');
      } catch (err) {
        alert('Invalid backup file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="container">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <ul className="sidebar-nav">
          <li className={currentView === 'Add Expense' ? 'active' : ''} onClick={() => { handleViewSwitch('Add Expense'); setIsSidebarOpen(false); }}>
            {editExpenseId ? 'Edit Expense' : 'Add Expense'}
          </li>
          <li className={currentView === 'Dashboard' ? 'active' : ''} onClick={() => { handleViewSwitch('Dashboard'); setIsSidebarOpen(false); }}>
            Dashboard
          </li>
          <li className={currentView === 'Backup & Restore' ? 'active' : ''} onClick={() => { handleViewSwitch('Backup & Restore'); setIsSidebarOpen(false); }}>
            Backup & Restore
          </li>
          <li className={currentView === 'About Us' ? 'active' : ''} onClick={() => { handleViewSwitch('About Us'); setIsSidebarOpen(false); }}>
            About Us
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="theme-toggle" style={{ marginBottom: '1rem' }}>
            <span>Time Format (24h)</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.timeFormat === '24h'}
                onChange={() => setSettings({ ...settings, timeFormat: settings.timeFormat === '12h' ? '24h' : '12h' })}
              />
              <span className="slider round"></span>
            </label>
          </div>
          <div className="theme-toggle">
            <span>Dark Mode</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.theme === 'dark'}
                onChange={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>

      <header className="header" style={{ position: 'relative' }}>
        <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
        <h1>{currentView}</h1>
      </header>

      <main className="main-content">
        {isLoading ? (
          <div className="loading-view">
            <div className="spinner"></div>
            <p>Loading {currentView}...</p>
          </div>
        ) : (
          <>
            {currentView === 'Add Expense' && (
              <form className="expense-form" onSubmit={addExpense}>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="text"
                    inputMode="none"
                    value={amount}
                    onFocus={(e) => {
                      e.target.blur();
                      setIsQuickAddMode(false);
                      setShowNumPad(true);
                    }}
                    onClick={() => {
                      setIsQuickAddMode(false);
                      setShowNumPad(true);
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Groceries"
                    required
                  />
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsCategoryDropdownOpen(false), 200);
                    }}
                    placeholder="Select or type a category"
                  />
                  {isCategoryDropdownOpen && (
                    <ul className="custom-dropdown">
                      {categories
                        .filter(cat => cat.toLowerCase().includes(category.toLowerCase()))
                        .map(cat => (
                          <li
                            key={cat}
                            onClick={() => {
                              setCategory(cat);
                              setIsCategoryDropdownOpen(false);
                            }}
                          >
                            {cat}
                          </li>
                        ))}
                      {categories.filter(cat => cat.toLowerCase().includes(category.toLowerCase())).length === 0 && (
                        <li style={{ color: '#a0aec0', padding: '0.75rem 1rem', fontStyle: 'italic', cursor: 'default' }}>No match found</li>
                      )}
                    </ul>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      style={{ background: 'none', border: 'none', color: '#11998e', fontSize: '0.85rem', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                    >
                      Manage Categories
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group half">
                    <label>Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Payment Mode (Optional)</label>
                  <div className="custom-select-wrapper">
                    <div
                      className={`custom-select-trigger ${activeDropdown === 'paymentMode' ? 'open' : ''}`}
                      onClick={() => setActiveDropdown('paymentMode')}
                    >
                      {paymentMode || 'Select Mode'}
                    </div>
                    {activeDropdown === 'paymentMode' && (
                      <div className="popup-dropdown-container">
                        <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                        <ul className="custom-dropdown popup">
                          <div className="popup-header">Payment Mode</div>
                          {['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Other'].map(mode => (
                            <li key={mode} onClick={() => { setPaymentMode(mode); setActiveDropdown(null); }}>{mode}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Note / Remark (Optional)</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Add a note or remark..."
                    rows={2}
                    className="custom-textarea"
                  ></textarea>
                </div>

                <button type="submit" className="submit-btn">{editExpenseId ? 'Update Expense' : '+ Add Expense'}</button>
              </form>
            )}

            {currentView === 'Dashboard' && (
              <>
                <button
                  type="button"
                  className="dashboard-add-btn"
                  onClick={openQuickAdd}
                >
                  + Quick Add Entry
                </button>

                <div className="total-expense-card">
                  <h2>Total Expense</h2>
                  <div className="amount">₹{totalExpense.toFixed(2)}</div>
                </div>

                <div className="expenses-list">
                  <div className="filters-container">
                    <div className="filters-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 className="filters-title" style={{ margin: 0 }}>Filters</h3>
                      <button
                        type="button"
                        className={`search-toggle-btn ${showSearch ? 'active' : ''}`}
                        onClick={() => {
                          setShowSearch(!showSearch);
                          if (showSearch) setSearchQuery('');
                        }}
                      >
                        {showSearch ? '✕ Close' : '🔍 Search'}
                      </button>
                    </div>

                    {showSearch && (
                      <div className="search-bar-container anim-fade-in">
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search expenses..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                    <div className="filters-grid">
                          <div className="filter-item">
                            <label>Categories</label>
                            <div className="custom-select-wrapper">
                              <div
                                className={`custom-select-trigger filter-select ${activeDropdown === 'catFilter' ? 'open' : ''}`}
                                onClick={() => setActiveDropdown('catFilter')}
                              >
                                {categoryFilters.includes('All') 
                                  ? 'All Categories' 
                                  : categoryFilters.length === 1 
                                    ? categoryFilters[0] 
                                    : `${categoryFilters.length} Categories`}
                              </div>
                              {activeDropdown === 'catFilter' && (
                                <div className="popup-dropdown-container">
                                  <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                                  <ul className="custom-dropdown popup multi-select">
                                    <div className="popup-header">Filter by Category</div>
                                    <div className="popup-search-box" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                                      <input 
                                        type="text" 
                                        placeholder="Search categories..." 
                                        value={catSearch}
                                        onChange={(e) => setCatSearch(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <li 
                                      className={categoryFilters.includes('All') ? 'selected' : ''} 
                                      onClick={() => toggleCategoryFilter('All')}
                                    >
                                      <span className="checkbox">{categoryFilters.includes('All') ? '✓' : ''}</span>
                                      All Categories
                                    </li>
                                    {categories.filter(cat => cat.toLowerCase().includes(catSearch.toLowerCase())).map(cat => (
                                      <li 
                                        key={cat} 
                                        className={categoryFilters.includes(cat) ? 'selected' : ''} 
                                        onClick={() => toggleCategoryFilter(cat)}
                                      >
                                        <span className="checkbox">{categoryFilters.includes(cat) ? '✓' : ''}</span>
                                        {cat}
                                      </li>
                                    ))}
                                    {(catSearch === '' || 'uncategorized'.includes(catSearch.toLowerCase())) && (
                                      <li 
                                        className={categoryFilters.includes('Uncategorized') ? 'selected' : ''} 
                                        onClick={() => toggleCategoryFilter('Uncategorized')}
                                      >
                                        <span className="checkbox">{categoryFilters.includes('Uncategorized') ? '✓' : ''}</span>
                                        Uncategorized
                                      </li>
                                    )}
                                    {categories.filter(cat => cat.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && catSearch !== '' && !'uncategorized'.includes(catSearch.toLowerCase()) && (
                                      <li style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center', pointerEvents: 'none' }}>No match found</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                      <div className="filter-item">
                        <label>Payment Mode</label>
                        <div className="custom-select-wrapper">
                          <div
                            className={`custom-select-trigger filter-select ${activeDropdown === 'payFilter' ? 'open' : ''}`}
                            onClick={() => setActiveDropdown('payFilter')}
                          >
                            {paymentModeFilter === 'All' ? 'All Modes' : paymentModeFilter}
                          </div>
                          {activeDropdown === 'payFilter' && (
                            <div className="popup-dropdown-container">
                              <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                              <ul className="custom-dropdown popup">
                                <div className="popup-header">Filter by Payment Mode</div>
                                {['All', 'Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Other', 'Not Specified'].map(mode => (
                                  <li key={mode} onClick={() => { setPaymentModeFilter(mode); setActiveDropdown(null); }}>
                                    {mode === 'All' ? 'All Modes' : mode}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="filter-item">
                        <label>Date Range</label>
                        <div className="custom-select-wrapper">
                          <div
                            className={`custom-select-trigger filter-select ${activeDropdown === 'dateFilter' ? 'open' : ''}`}
                            onClick={() => setActiveDropdown('dateFilter')}
                          >
                            {dateFilter === 'All' ? 'All Dates' : dateFilter}
                          </div>
                          {activeDropdown === 'dateFilter' && (
                            <div className="popup-dropdown-container">
                              <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                              <ul className="custom-dropdown popup">
                                <div className="popup-header">Filter by Date</div>
                                {['All', 'Today', 'Yesterday', 'Tomorrow', 'Last 30 Days', 'Last Month', 'Date Range'].map(range => (
                                  <li key={range} onClick={() => {
                                    setDateFilter(range);
                                    setActiveDropdown(null);
                                  }}>
                                    {range === 'All' ? 'All Dates' : range}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>


                      {dateFilter === 'Date Range' && (
                        <div className="filter-item full-width">
                          <label>Select Range</label>
                          <div className="custom-calendar-trigger" onClick={() => setShowCalendar(true)}>
                            <div className="trigger-val">
                              {startDate ? new Date(startDate).toLocaleDateString() : 'Start'} 
                              <span className="trigger-sep">→</span> 
                              {endDate ? new Date(endDate).toLocaleDateString() : 'End'}
                            </div>
                            <span className="cal-icon">📅</span>
                          </div>
                        </div>
                      )}
                    </div>

                     {((categoryFilters.length > 0 && !categoryFilters.includes('All')) || paymentModeFilter !== 'All' || dateFilter !== 'All' || searchQuery !== '') && (
                      <button
                        type="button"
                        className="clear-filters-btn"
                        onClick={() => {
                          setCategoryFilters(['All']);
                          setPaymentModeFilter('All');
                          setDateFilter('All');
                          setSearchQuery('');
                          setStartDate('');
                          setEndDate('');
                        }}
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>

                  <h2>Filtered Expenses</h2>
                  {sortedExpenses.length === 0 ? (
                    <p className="no-expenses">No expenses found.</p>
                  ) : (
                    sortedExpenses.map(expense => (
                      <div key={expense.id} className="expense-card">
                        <div className="expense-info">
                          <h3 className="expense-desc">{expense.description}</h3>
                          <span className="expense-datetime">
                            {expense.category && <span className="expense-category-badge">{expense.category}</span>}
                            {expense.paymentMode && expense.paymentMode !== 'Not Specified' && (
                              <span className="expense-payment-badge">{expense.paymentMode}</span>
                            )}
                            <div style={{ width: '100%', height: '4px' }}></div>
                            {new Date(expense.date).toLocaleDateString('en-US', { weekday: 'long' })}, {expense.date.split('-').reverse().join('/')} • {formatTime(expense.time)}
                            {expense.remark && (
                              <div className="expense-remark">
                                <span className="remark-icon">📝</span> {expense.remark}
                              </div>
                            )}
                          </span>
                        </div>
                        <div className="expense-action" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <span className="expense-amount">₹{expense.amount.toFixed(2)}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => handleEdit(expense)} style={{ background: '#cbd5e0', color: '#2d3748', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                            <button type="button" onClick={() => setDeleteId(expense.id)} style={{ background: '#fc8181', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {currentView === 'Backup & Restore' && (
              <div className="backup-container">
                <h2>Backup & Restore</h2>
                <p>Download a backup file of your expenses and categories, or restore from an existing file.</p>

                <button className="submit-btn" onClick={handleBackup} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  Download Backup File
                </button>

                <div className="form-group">
                  <label>Restore from File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFile}
                    className="custom-file-input"
                  />
                </div>
              </div>
            )}

            {currentView === 'About Us' && (
              <div className="about-container">
                <h2>About Expense Tracker</h2>
                <br />
                <p className="about-text">
                  This Expense Tracker was beautifully built to assist you in tracking your financial footprint across multiple accounts, cash payments, and days.
                  Always keep track of where your money goes.
                </p>
                <br />
                <p className="about-text">
                  Designed with a modern interface, prioritizing ease of access and quick navigation.
                </p>

                <div className="about-footer">
                  <p className="developed-by">Developed By</p>
                  <h3 className="developer-name">Arbaz Gazge</h3>
                  <a
                    href="https://www.instagram.com/arbaz_gazge"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#E1306C', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem', marginTop: '0.5rem' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    @arbaz_gazge
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this expense entry? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="modal-btn delete" onClick={() => deleteExpense(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal category-modal">
            <div className="modal-header">
              <h3>Manage Categories</h3>
              <button className="close-btn" style={{ position: 'static', color: 'var(--text-primary)' }} onClick={() => { setIsCategoryModalOpen(false); setEditingCategoryIdx(null); setNewCategory(''); }}>&times;</button>
            </div>

            <div className="category-input-group">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder={editingCategoryIdx !== null ? "Edit category name" : "New category name"}
                className="category-modal-input"
              />
              <button type="button" onClick={addCategory} className="modal-action-btn primary">
                {editingCategoryIdx !== null ? 'Update' : 'Add'}
              </button>
              {editingCategoryIdx !== null && (
                <button type="button" onClick={() => { setEditingCategoryIdx(null); setNewCategory(''); }} className="modal-action-btn secondary">Cancel</button>
              )}
            </div>

            <div className="category-list-scroll">
              {categories.map((cat, idx) => (
                <div key={cat} className="category-list-item">
                  <span className="cat-name">{cat}</span>
                  <div className="cat-actions">
                    <button type="button" className="cat-btn edit" onClick={() => startEditCategory(idx)}>Edit</button>
                    <button type="button" className="cat-btn delete" onClick={() => deleteCategory(cat)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Numerical Keyboard / Quick Add Widget */}
      {showNumPad && (
        <>
          <div className="num-pad-overlay" onClick={() => setShowNumPad(false)}></div>
          <div className="num-pad-sheet quick-add-sheet">
            <div className="quick-add-header">
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => { setShowNumPad(false); setIsQuickAddMode(false); }} 
                style={{ position: 'static', color: 'var(--text-secondary)' }}
              >
                &times;
              </button>
              <div className="quick-add-amount-display">₹ {amount || '0.00'}</div>
            </div>

            {isQuickAddMode && (
              <div className="quick-add-input-group">
                <input 
                  type="text" 
                  className="quick-add-input" 
                  placeholder="What for? (Description)" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
                
                <div className="quick-add-category-selector">
                  <div 
                    className={`quick-add-category-item ${category === '' ? 'selected' : ''}`}
                    onClick={() => setCategory('')}
                  >
                    Other
                  </div>
                  {categories.map(cat => (
                    <div 
                      key={cat} 
                      className={`quick-add-category-item ${category === cat ? 'selected' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="num-pad-grid">
              {['1', '2', '3', '+', '4', '5', '6', '-', '7', '8', '9', '*', '.', '0', '=', '/', 'back'].map(key => (
                <button
                  key={key}
                  type="button"
                  className={`num-pad-key ${key === 'back' ? 'delete' : (['+', '-', '*', '/', '='].includes(key) ? 'operator' : (key === '.' ? 'special' : ''))}`}
                  onClick={() => handleNumPadPress(key)}
                >
                  {key === 'back' ? '⌫' : key}
                </button>
              ))}
              {isQuickAddMode ? (
                <button 
                  type="button" 
                  className="quick-add-save-btn" 
                  onClick={(e) => {
                    const finalAmount = evaluateExpression(amount);
                    if (finalAmount === '0' || isNaN(parseFloat(finalAmount))) {
                      alert('Please enter a valid amount');
                      return;
                    }
                    // Temporarily set evaluated amount to ensure addExpense uses it
                    setAmount(finalAmount);
                    setTimeout(() => {
                      addExpense(e as any);
                      setShowNumPad(false);
                      setIsQuickAddMode(false);
                    }, 0);
                  }}
                >
                  Save Entry
                </button>
              ) : (
                <button 
                  type="button" 
                  className="num-pad-key done" 
                  onClick={() => {
                    setAmount(evaluateExpression(amount));
                    setShowNumPad(false);
                    setIsQuickAddMode(false);
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {/* Custom Calendar Modal */}
      {showCalendar && (
        <div className="modal-overlay" onClick={() => setShowCalendar(false)}>
          <div className="calendar-modal-content" onClick={e => e.stopPropagation()}>
            <div className="calendar-header">
              <button 
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              >
                &lt;
              </button>
              <h3>{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <button 
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              >
                &gt;
              </button>
            </div>
            
            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
              {(() => {
                const { firstDay, days } = getDaysInMonth(calendarMonth);
                const cells = [];
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
                }
                for (let d = 1; d <= days; d++) {
                  const dateStr = formatCalDate(calendarMonth.getFullYear(), calendarMonth.getMonth(), d);
                  const isStart = dateStr === startDate;
                  const isEnd = dateStr === endDate;
                  const hasSelection = !!(startDate && endDate);
                  const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;

                  cells.push(
                    <div 
                      key={d} 
                      className={`calendar-day ${isStart ? 'range-start' : ''} ${isEnd ? 'range-end' : ''} ${(isStart || isEnd) ? 'selected' : ''} ${isInRange ? 'in-range' : ''} ${hasSelection ? 'has-range' : ''}`}
                      onClick={() => handleDateClick(dateStr)}
                    >
                      {d}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>

            <div className="calendar-footer">
              <button type="button" className="cancel-btn" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
              <button type="button" className="apply-btn" onClick={() => setShowCalendar(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
