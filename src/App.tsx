import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
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

  // Backup & Restore
  const [backupData, setBackupData] = useState('');

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
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

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
    };
    loadData();

    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
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

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date || !time) return;

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
    setAmount('');
    setDescription('');
    setCategory('');
    setPaymentMode('');

    // Automatically switch to dashboard after adding
    setCurrentView('Dashboard');
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const deleteCategory = (catToDelete: string) => {
    setCategories(categories.filter(cat => cat !== catToDelete));
  };

  const filteredExpenses = expenses.filter(expense => {
    if (categoryFilter !== 'All' && expense.category !== categoryFilter) return false;
    if (paymentModeFilter !== 'All' && expense.paymentMode !== paymentModeFilter) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateFilter === 'Today' && expense.date !== today.toISOString().split('T')[0]) return false;
    if (dateFilter === 'Yesterday' && expense.date !== yesterday.toISOString().split('T')[0]) return false;
    if (dateFilter === 'Tomorrow' && expense.date !== tomorrow.toISOString().split('T')[0]) return false;

    if (dateFilter === 'Custom' && customDateFilter && !expense.date.startsWith(customDateFilter)) return false;

    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateB.getTime() - dateA.getTime();
  });

  const totalExpense = sortedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleBackup = () => {
    setBackupData(JSON.stringify({ expenses, categories }));
  };

  const handleRestore = () => {
    try {
      if (!backupData.trim()) return;
      const data = JSON.parse(backupData);
      if (data.expenses) setExpenses(data.expenses);
      if (data.categories) setCategories(data.categories);
      alert('Data restored successfully!');
      setBackupData('');
    } catch (e) {
      alert('Invalid backup data format.');
    }
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
          <li className={currentView === 'Add Expense' ? 'active' : ''} onClick={() => { setCurrentView('Add Expense'); setIsSidebarOpen(false); }}>
            Add Expense
          </li>
          <li className={currentView === 'Dashboard' ? 'active' : ''} onClick={() => { setCurrentView('Dashboard'); setIsSidebarOpen(false); }}>
            Dashboard
          </li>
          <li className={currentView === 'Backup & Restore' ? 'active' : ''} onClick={() => { setCurrentView('Backup & Restore'); setIsSidebarOpen(false); }}>
            Backup & Restore
          </li>
          <li className={currentView === 'About Us' ? 'active' : ''} onClick={() => { setCurrentView('About Us'); setIsSidebarOpen(false); }}>
            About Us
          </li>
        </ul>
      </div>

      <header className="header" style={{ position: 'relative' }}>
        <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
        <h1>{currentView}</h1>
      </header>

      <main className="main-content">
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
                  {categories.map(cat => (
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
                </ul>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsManagingCategories(!isManagingCategories)}
                  style={{ background: 'none', border: 'none', color: '#11998e', fontSize: '0.85rem', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                >
                  {isManagingCategories ? 'Close Category Manager' : 'Manage Categories'}
                </button>
              </div>
              {isManagingCategories && (
                <div className="category-manager" style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      placeholder="New category name"
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                    />
                    <button type="button" onClick={addCategory} style={{ background: '#11998e', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Add</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {categories.map(cat => (
                      <span key={cat} style={{ background: '#e2e8f0', color: '#4a5568', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                        {cat}
                        <button type="button" onClick={() => deleteCategory(cat)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 0.5 }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="custom-select"
              >
                <option value="">Select Mode</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="UPI">UPI</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button type="submit" className="submit-btn">+ Add Expense</button>
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
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="custom-select filter-select">
                      <option value="All">All Categories</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="Uncategorized">Uncategorized</option>
                    </select>
                  </div>

                  <div className="filter-item">
                    <label>Payment Mode</label>
                    <select value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)} className="custom-select filter-select">
                      <option value="All">All Modes</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Other">Other</option>
                      <option value="Not Specified">Not Specified</option>
                    </select>
                  </div>

                  <div className="filter-item">
                    <label>Date</label>
                    <select value={dateFilter} onChange={(e) => {
                      setDateFilter(e.target.value);
                      if (e.target.value !== 'Custom') setCustomDateFilter('');
                    }} className="custom-select filter-select">
                      <option value="All">All Dates</option>
                      <option value="Today">Today</option>
                      <option value="Yesterday">Yesterday</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="Custom">Custom / Month</option>
                    </select>
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
                    <div className="expense-action">
                      <span className="expense-amount">₹{expense.amount.toFixed(2)}</span>
                      <button type="button" onClick={() => deleteExpense(expense.id)} className="delete-btn">×</button>
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
            <p>Save a copy of your expenses and categories, or restore them here.</p>

            <button className="submit-btn" onClick={handleBackup} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              Create Backup Code
            </button>

            <div className="form-group">
              <label>Backup Data string</label>
              <textarea
                value={backupData}
                onChange={e => setBackupData(e.target.value)}
                placeholder="Paste backup code here to restore, or click 'Create Backup Code' to generate your backup text."
                style={{ width: '100%', height: '150px', padding: '1rem', borderRadius: '12px', border: '1px solid #edf2f7', fontFamily: 'monospace' }}
              />
            </div>

            <button className="submit-btn" onClick={handleRestore} style={{ background: 'linear-gradient(135deg, #0cebeb 0%, #20e3b2 100%)', color: '#0b3d3d' }}>
              Restore from Backup Code
            </button>
          </div>
        )}

        {currentView === 'About Us' && (
          <div className="about-container">
            <h2>About Expense Tracker</h2>
            <br />
            <p style={{ lineHeight: '1.6', color: '#4a5568' }}>
              This Expense Tracker was beautifully built to assist you in tracking your financial footprint across multiple accounts, cash payments, and days.
              Always keep track of where your money goes.
            </p>
            <br />
            <p style={{ lineHeight: '1.6', color: '#4a5568' }}>
              Designed with a modern interface, prioritizing ease of access and quick navigation.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
