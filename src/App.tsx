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
}

interface Settings {
  theme: 'light' | 'dark';
}

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [paymentMode, setPaymentMode] = useState('');

  // Sidebar and View State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('Add Expense');

  // Filters state
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [customDateFilter, setCustomDateFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('All');

  // Settings
  const [settings, setSettings] = useState<Settings>({ theme: 'light' });

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
      };
      setExpenses([...expenses, newExpense]);
    }

    setAmount('');
    setDescription('');
    setCategory('');
    setPaymentMode('');

    // Automatically switch to dashboard after adding
    handleViewSwitch('Dashboard');
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
        if (categoryFilter === oldName) setCategoryFilter(trimmedName);
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

  const deleteCategory = (catToDelete: string) => {
    setCategories(categories.filter(cat => cat !== catToDelete));
    if (categoryFilter === catToDelete) setCategoryFilter('All');
    if (category === catToDelete) setCategory('');
  };

  const startEditCategory = (index: number) => {
    setEditingCategoryIdx(index);
    setNewCategory(categories[index]);
  };

  const filteredExpenses = expenses.filter(expense => {
    if (categoryFilter !== 'All' && expense.category !== categoryFilter) return false;
    if (paymentModeFilter !== 'All' && expense.paymentMode !== paymentModeFilter) return false;

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

    if (dateFilter === 'Today' && expense.date !== todayStr) return false;
    if (dateFilter === 'Yesterday' && expense.date !== yesterdayStr) return false;
    if (dateFilter === 'Tomorrow' && expense.date !== tomorrowStr) return false;

    if (dateFilter === 'Custom' && customDateFilter && !expense.date.startsWith(customDateFilter)) return false;

    return true;
  });

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
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
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

            <button type="submit" className="submit-btn">{editExpenseId ? 'Update Expense' : '+ Add Expense'}</button>
          </form>
        )}

        {currentView === 'Dashboard' && (
          <>
            <div className="total-expense-card">
              <h2>Total Expense</h2>
              <div className="amount">₹{totalExpense.toFixed(2)}</div>
            </div>

            <div className="expenses-list">
              <div className="filters-container">
                <h3 className="filters-title">Filters</h3>
                <div className="filters-grid">
                  <div className="filter-item">
                    <label>Category</label>
                    <div className="custom-select-wrapper">
                      <div 
                        className={`custom-select-trigger filter-select ${activeDropdown === 'catFilter' ? 'open' : ''}`}
                        onClick={() => setActiveDropdown('catFilter')}
                      >
                        {categoryFilter === 'All' ? 'All Categories' : categoryFilter}
                      </div>
                      {activeDropdown === 'catFilter' && (
                        <div className="popup-dropdown-container">
                          <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                          <ul className="custom-dropdown popup">
                            <div className="popup-header">Filter by Category</div>
                            <li onClick={() => { setCategoryFilter('All'); setActiveDropdown(null); }}>All Categories</li>
                            {categories.map(cat => (
                              <li key={cat} onClick={() => { setCategoryFilter(cat); setActiveDropdown(null); }}>{cat}</li>
                            ))}
                            <li onClick={() => { setCategoryFilter('Uncategorized'); setActiveDropdown(null); }}>Uncategorized</li>
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
                        {dateFilter === 'All' ? 'All Dates' : dateFilter === 'Custom' ? 'Custom / Month' : dateFilter}
                      </div>
                      {activeDropdown === 'dateFilter' && (
                        <div className="popup-dropdown-container">
                          <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                          <ul className="custom-dropdown popup">
                            <div className="popup-header">Filter by Date</div>
                            {['All', 'Today', 'Yesterday', 'Tomorrow', 'Custom'].map(range => (
                              <li key={range} onClick={() => { 
                                setDateFilter(range); 
                                if (range !== 'Custom') setCustomDateFilter('');
                                setActiveDropdown(null); 
                              }}>
                                {range === 'All' ? 'All Dates' : range === 'Custom' ? 'Custom / Month' : range}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {dateFilter === 'Custom' && (
                    <div className="filter-item">
                      <label>Select Month/Date</label>
                      <input
                        type="month"
                        value={customDateFilter}
                        onChange={(e) => setCustomDateFilter(e.target.value)}
                        className="filter-input"
                      />
                      <span style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem', display: 'block' }}>
                        Or type YYYY-MM-DD for specific day
                      </span>
                    </div>
                  )}
                </div>

                {(categoryFilter !== 'All' || paymentModeFilter !== 'All' || dateFilter !== 'All') && (
                  <button
                    type="button"
                    className="clear-filters-btn"
                    onClick={() => {
                      setCategoryFilter('All');
                      setPaymentModeFilter('All');
                      setDateFilter('All');
                      setCustomDateFilter('');
                    }}
                  >
                    Clear Filters
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
                        {expense.date} • {expense.time}
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
    </div>
  );
}

export default App;
