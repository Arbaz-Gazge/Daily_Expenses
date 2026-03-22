import { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
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

interface Bank {
  id: string;
  name: string;
  balance: number;
}

interface BankTransaction {
  id: string;
  bankId: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  date: string;
  time: string;
}

interface AutoPay {
  id: string;
  name: string;
  amount: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  frequencyValue: number;
  frequencyUnit: 'Minute' | 'Hour' | 'Day' | 'Month' | 'Year';
  category: string;
  time: string;
  startDate: string;
  bankId: string;
  lastExecutedDate?: string;
  status: 'Active' | 'Paused';
}

interface Settings {
  theme: 'light' | 'dark';
  timeFormat: '12h' | '24h';
}

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [viewingTrx, setViewingTrx] = useState<BankTransaction | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [remark, setRemark] = useState('');

  const renderTransactionDetailModal = () => {
    if (!viewingTrx) return null;
    const bank = banks.find(b => b.id === viewingTrx.bankId);

    return (
      <div className="full-detail-page anim-fade-in" style={{ zIndex: 6000 }}>
        <div className="full-page-header">
          <button className="back-btn" onClick={() => setViewingTrx(null)}>←</button>
          <h2>Transaction Details</h2>
          <div style={{ width: 44 }}></div> 
        </div>

        <div className="full-page-content">
          <div className="detail-hero-section">
            <span className={`hero-type-tag ${viewingTrx.type}`}>{viewingTrx.type === 'in' ? 'Cash In' : 'Cash Out'}</span>
            <div className={`hero-amount-text ${viewingTrx.type}`}>
              {viewingTrx.type === 'in' ? '+' : '-'}₹{viewingTrx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="hero-time-meta">
              {new Date(viewingTrx.date).toLocaleDateString('default', { day: '2-digit', month: 'long', year: 'numeric' })} • {formatTime(viewingTrx.time)}
            </div>
          </div>

          <div className="detail-data-section">
            <div className="detail-data-card">
              <label>DESCRIPTION</label>
              <div className="data-value large">{viewingTrx.description}</div>
            </div>

            <div className="detail-data-grid">
              <div className="detail-data-card">
                <label>CATEGORY</label>
                <div className="data-value">{viewingTrx.category || 'General'}</div>
              </div>
              <div className="detail-data-card">
                <label>LINKED ACCOUNT</label>
                <div className="data-value">{bank?.name || 'Unknown'}</div>
              </div>
            </div>

            <div className="detail-data-card">
              <label>PAYMENT TYPE</label>
              <div className="data-value">{viewingTrx.type === 'in' ? 'Deposit / Credit' : 'Expense / Debit'}</div>
            </div>
          </div>

          <div className="full-page-footer">
            <button className="full-action-btn edit" onClick={() => { startEditDeposit(viewingTrx); setViewingTrx(null); }}>✎ Edit This Entry</button>
            <button className="full-action-btn delete" onClick={() => { deleteBankTransaction(viewingTrx); setViewingTrx(null); }}>✕ Delete This Entry</button>
          </div>
        </div>
      </div>
    );
  };

  // Sidebar and View State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('Add Expense');

  // Custom Alert / Confirm states
  const [dialog, setDialog] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'alert' });

  const showAlert = (message: string) => setDialog({ show: true, message, type: 'alert' });
  const showConfirm = (message: string, onConfirm: () => void) => setDialog({ show: true, message, type: 'confirm', onConfirm });
  const closeDialog = () => setDialog({ ...dialog, show: false });

  // Filters state
  const [categoryFilters, setCategoryFilters] = useState<string[]>(['All']);
  const [dateFilter, setDateFilter] = useState('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string[]>(['All']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickerMode, setPickerMode] = useState<'single' | 'range'>('range');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeSelectionMode, setTimeSelectionMode] = useState<'hour' | 'minute'>('hour');
  const [isDraggingClock, setIsDraggingClock] = useState(false);
  const clockFaceRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date()); // Month currently viewed in calendar

  // Settings
  const [settings, setSettings] = useState<Settings>({
    theme: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
    timeFormat: '12h'
  });

  // Backup & Restore
  // edit mode
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bank States
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankName, setBankName] = useState('');
  const [bankBalance, setBankBalance] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDescription, setDepositDescription] = useState('');
  const [depositCategory, setDepositCategory] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [editingBankTransactionId, setEditingBankTransactionId] = useState<string | null>(null);

  // Auto Pay States
  const [autoPays, setAutoPays] = useState<AutoPay[]>([]);
  const [autoPayName, setAutoPayName] = useState('');
  const [autoPayAmount, setAutoPayAmount] = useState('');
  const [autoPayFreqValue, setAutoPayFreqValue] = useState('1');
  const [autoPayFreqUnit, setAutoPayFreqUnit] = useState<'Minute' | 'Hour' | 'Day' | 'Month' | 'Year'>('Month');
  const [autoPayCat, setAutoPayCat] = useState('');
  const [autoPayTime, setAutoPayTime] = useState('00:00');
  const [autoPayStartDate, setAutoPayStartDate] = useState('');
  const [autoPayBankId, setAutoPayBankId] = useState('');
  const [editingAutoPayId, setEditingAutoPayId] = useState<string | null>(null);

  // Bank Statement Filter States
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState<'All' | 'in' | 'out'>('All');
  const [bankDateFilter, setBankDateFilter] = useState('All');
  const [bankStartDate, setBankStartDate] = useState('');
  const [bankEndDate, setBankEndDate] = useState('');
  const [triggerCheck, setTriggerCheck] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStart = useRef(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const defaultDepositCategories = ["Salary", "Investment", "Gift", "Refund", "Bank Transfer", "Opening Balance", "Other"];
  const [depositCategories, setDepositCategories] = useState<string[]>([]);
  const [isDepositCategoryModalOpen, setIsDepositCategoryModalOpen] = useState(false);
  const [editingDepositCategoryIdx, setEditingDepositCategoryIdx] = useState<number | null>(null);
  const [newDepositCategory, setNewDepositCategory] = useState('');
  const [viewingBankId, setViewingBankId] = useState<string | null>(null);

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

  const getLocalDateStr = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const getLocalTimeStr = (d: Date) => d.toTimeString().split(' ')[0].substring(0, 5);

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
      const savedBanks = await Preferences.get({ key: 'banks' });
      if (savedBanks.value) setBanks(JSON.parse(savedBanks.value));

      const savedBankTrx = await Preferences.get({ key: 'bankTransactions' });
      if (savedBankTrx.value) setBankTransactions(JSON.parse(savedBankTrx.value));

      const savedAutoPays = await Preferences.get({ key: 'autoPays' });
      if (savedAutoPays.value) setAutoPays(JSON.parse(savedAutoPays.value));

      const savedDepositCats = await Preferences.get({ key: 'depositCategories' });
      if (savedDepositCats.value) {
        setDepositCategories(JSON.parse(savedDepositCats.value));
      } else {
        setDepositCategories(defaultDepositCategories);
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
    if (dataLoaded) {
      Preferences.set({ key: 'banks', value: JSON.stringify(banks) });
    }
  }, [banks, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) {
      Preferences.set({ key: 'bankTransactions', value: JSON.stringify(bankTransactions) });
    }
  }, [bankTransactions, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) {
      Preferences.set({ key: 'autoPays', value: JSON.stringify(autoPays) });
    }
  }, [autoPays, dataLoaded]);

  useEffect(() => {
    if (dataLoaded && autoPays.length > 0) {
      checkAndExecuteAutoPays();
    }
    if (dataLoaded && Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }
  }, [dataLoaded, triggerCheck, autoPays, banks]); // Added banks to dependencies for latest data

  const checkAndExecuteAutoPays = () => {
    let newExpenses: Expense[] = [];
    let newTrxList: BankTransaction[] = [];
    let executedAPs: string[] = [];
    let nextAPs: AutoPay[] = [];
    let changed = false;

    // Use current state since we're called within an effect watching autoPays
    nextAPs = autoPays.map(ap => {
      if (ap.status === 'Paused') return ap;

      const lastExecFull = ap.lastExecutedDate;
      const todayStr = getLocalDateStr(new Date());
      const now = new Date();
      const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

      if (todayStr >= ap.startDate) {
        let shouldExecute = !lastExecFull;

        if (lastExecFull) {
          // If it has a T, it's a full ISO string (granular). Otherwise just a date string.
          const lastDateObj = new Date(lastExecFull.includes('T') ? lastExecFull : (lastExecFull + 'T' + ap.time));
          const diffMs = now.getTime() - lastDateObj.getTime();

          if (ap.frequencyUnit === 'Minute' && diffMs >= (ap.frequencyValue || 1) * 60000) shouldExecute = true;
          else if (ap.frequencyUnit === 'Hour' && diffMs >= (ap.frequencyValue || 1) * 3600000) shouldExecute = true;
          else if (ap.frequencyUnit === 'Day') {
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffDays >= (ap.frequencyValue || 1) && currentHHMM >= ap.time) shouldExecute = true;
          }
          else if (ap.frequencyUnit === 'Month') {
            const monthsDiff = (now.getFullYear() - lastDateObj.getFullYear()) * 12 + (now.getMonth() - lastDateObj.getMonth());
            if (monthsDiff >= (ap.frequencyValue || 1) && now.getDate() >= lastDateObj.getDate() && currentHHMM >= ap.time) shouldExecute = true;
            else if (monthsDiff > (ap.frequencyValue || 1)) shouldExecute = true;
          }
          else if (ap.frequencyUnit === 'Year') {
            const yearsDiff = now.getFullYear() - lastDateObj.getFullYear();
            if (yearsDiff >= (ap.frequencyValue || 1)) {
              if (now.getMonth() > lastDateObj.getMonth() || (now.getMonth() === lastDateObj.getMonth() && now.getDate() >= lastDateObj.getDate() && currentHHMM >= ap.time)) {
                shouldExecute = true;
              }
            }
          }
        } else {
          // First time execution: only if current time >= target time
          if (currentHHMM < ap.time) shouldExecute = false;
        }

        if (shouldExecute) {
          changed = true;
          const expenseId = Date.now().toString() + Math.random().toString(36).substring(7);
          const linkedBank = banks.find(b => b.id === ap.bankId);

          newExpenses.push({
            id: expenseId,
            amount: ap.amount,
            description: ap.name + ' (Auto Pay)',
            date: todayStr,
            time: currentHHMM,
            category: ap.category,
            paymentMode: linkedBank?.name || 'Auto Pay'
          });

          newTrxList.push({
            id: 'tr-' + expenseId,
            bankId: ap.bankId,
            amount: ap.amount,
            type: 'out',
            description: ap.name + ' (Auto Pay)',
            category: ap.category,
            date: todayStr,
            time: currentHHMM
          });

          executedAPs.push(ap.name + ': ₹' + ap.amount);
          // Store full string for granular units to track minutes/seconds
          const execFullStr = (ap.frequencyUnit === 'Minute' || ap.frequencyUnit === 'Hour') ? now.toISOString() : todayStr;
          return { ...ap, lastExecutedDate: execFullStr };
        }
      }
      return ap;
    });

    if (changed) {
      setAutoPays(nextAPs);
      setExpenses(prev => [...prev, ...newExpenses]);
      setBankTransactions(prev => [...prev, ...newTrxList]);
      setBanks(prevBanks => prevBanks.map(b => {
        const trxsForThisBank = newTrxList.filter(t => t.bankId === b.id);
        const totalDeduction = trxsForThisBank.reduce((acc, t) => acc + t.amount, 0);
        return totalDeduction > 0 ? { ...b, balance: b.balance - totalDeduction } : b;
      }));

      if (Capacitor.isNativePlatform() && executedAPs.length > 0) {
        LocalNotifications.schedule({
          notifications: [
            {
              title: 'Auto Pay Success',
              body: `Executed: ${executedAPs.join(', ')}`,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 500) },
              sound: 'default'
            }
          ]
        }).catch(err => console.error('Notification error', err));
      }
    }
  };

  useEffect(() => {
    if (dataLoaded && depositCategories.length > 0) {
      Preferences.set({ key: 'depositCategories', value: JSON.stringify(depositCategories) });
    }
  }, [depositCategories, dataLoaded]);

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Explicitly check for Auto Pays
    checkAndExecuteAutoPays();
    // Simulate some sync time
    setTimeout(() => {
      setIsRefreshing(false);
      setPullY(0);
      setTriggerCheck(prev => prev + 1);
    }, 1000);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only detect pull-to-refresh if we're at the top of the scroll
    const container = e.currentTarget;
    if (container.scrollTop === 0) {
      touchStart.current = e.touches[0].clientY;
    } else {
      touchStart.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === 0 || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const pullDistance = Math.max(0, currentY - touchStart.current);

    // Max pull height 220px
    if (pullDistance < 220) {
      setPullY(pullDistance);
    }
  };

  const handleTouchEnd = () => {
    // Increase threshold to 180 for "long" pull
    if (pullY > 180) {
      handleRefresh();
    } else {
      setPullY(0);
    }
    touchStart.current = 0;
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date || !time) return;

    // Evaluate math in amount if any
    const finalAmount = evaluateExpression(amount);
    const amountNum = parseFloat(finalAmount);

    if (editExpenseId) {
      setExpenses(expenses.map(exp =>
        exp.id === editExpenseId
          ? {
            ...exp,
            amount: amountNum,
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
        amount: amountNum,
        description,
        category: category || 'Uncategorized',
        date,
        time,
        paymentMode: paymentMode || 'Not Specified',
        remark,
      };

      // Handle bank balance deduction
      const sourceBank = banks.find(b => b.name === (paymentMode || 'Not Specified'));
      if (sourceBank) {
        setBanks(prev => prev.map(b =>
          b.id === sourceBank.id
            ? { ...b, balance: b.balance - amountNum }
            : b
        ));

        // Create transaction record
        const now = new Date();
        const trx: BankTransaction = {
          id: Date.now().toString() + '_out',
          bankId: sourceBank.id,
          amount: amountNum,
          type: 'out',
          description,
          category: category || 'Uncategorized',
          date: date || now.toISOString().split('T')[0],
          time: time || now.toTimeString().split(' ')[0].substring(0, 5)
        };
        setBankTransactions(prev => [trx, ...prev]);
      }

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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const bulkDeleteExpenses = () => {
    if (selectedIds.length === 0) return;
    showConfirm(`Are you sure you want to delete ${selectedIds.length} entries?`, () => {
      const newExpenses = expenses.filter(exp => !selectedIds.includes(exp.id));
      setExpenses(newExpenses);
      setSelectedIds([]);
      Preferences.set({ key: 'expenses', value: JSON.stringify(newExpenses) });
      showAlert('Entries deleted successfully.');
    });
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

  const addBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName) return;
    const now = new Date();
    const bankId = now.getTime().toString();
    const amountNum = parseFloat(bankBalance) || 0;

    if (amountNum > 0) {
      const trx: BankTransaction = {
        id: bankId + '_initial',
        bankId: bankId,
        amount: amountNum,
        type: 'in',
        description: 'Opening Balance',
        category: 'Opening Balance',
        date: getLocalDateStr(now),
        time: getLocalTimeStr(now)
      };
      setBankTransactions(prev => [trx, ...prev]);
    }

    const newBank: Bank = {
      id: bankId,
      name: bankName,
      balance: amountNum
    };
    setBanks(prev => [...prev, newBank]);
    setBankName('');
    setBankBalance('');
    setShowBankModal(false);
  };

  const startEditDeposit = (tx: BankTransaction) => {
    setEditingBankTransactionId(tx.id);
    setDepositAmount(tx.amount.toString());
    setDepositDescription(tx.description);
    setDepositCategory(tx.category);
    setShowDepositModal(true);
    setSelectedBankId(tx.bankId);
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId || !depositAmount) return;
    const amountNum = parseFloat(depositAmount);

    if (editingBankTransactionId) {
      // Handle Update
      const oldTrx = bankTransactions.find(t => t.id === editingBankTransactionId);
      if (oldTrx) {
        const diff = amountNum - oldTrx.amount;
        setBanks(prev => prev.map(b => b.id === selectedBankId ? { ...b, balance: b.balance + diff } : b));
        setBankTransactions(prev => prev.map(t =>
          t.id === editingBankTransactionId
            ? { ...t, amount: amountNum, description: depositDescription, category: depositCategory }
            : t
        ));
      }
    } else {
      // Handle New
      setBanks(prev => prev.map(b =>
        b.id === selectedBankId
          ? { ...b, balance: b.balance + amountNum }
          : b
      ));

      const now = new Date();
      const trx: BankTransaction = {
        id: now.getTime().toString() + '_in',
        bankId: selectedBankId,
        amount: amountNum,
        type: 'in',
        description: depositDescription || 'Deposit',
        category: depositCategory || 'Cash In',
        date: getLocalDateStr(now),
        time: getLocalTimeStr(now)
      };
      setBankTransactions(prev => [trx, ...prev]);
    }

    setDepositAmount('');
    setDepositDescription('');
    setDepositCategory('');
    setShowDepositModal(false);
    setSelectedBankId(null);
    setEditingBankTransactionId(null);
  };

  const deleteBank = (id: string) => {
    showConfirm('Are you sure you want to delete this bank?', () => {
      setBanks(banks.filter(b => b.id !== id));
    });
  };

  const deleteBankTransaction = (tx: BankTransaction) => {
    showConfirm('Delete this transaction? This will also revert the bank balance.', () => {
      if (tx.type === 'in') {
        setBanks(prev => prev.map(b => b.id === tx.bankId ? { ...b, balance: b.balance - tx.amount } : b));
      } else {
        setBanks(prev => prev.map(b => b.id === tx.bankId ? { ...b, balance: b.balance + tx.amount } : b));
      }
      setBankTransactions(prev => prev.filter(t => t.id !== tx.id));
    });
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

  const deleteAutoPay = (id: string) => {
    showConfirm('Are you sure you want to stop this Auto Pay?', () => {
      setAutoPays(prev => prev.filter(ap => ap.id !== id));
    });
  };

  const startEditAutoPay = (ap: AutoPay) => {
    setAutoPayName(ap.name);
    setAutoPayAmount(ap.amount.toString());
    setAutoPayFreqValue((ap.frequencyValue || 1).toString());
    setAutoPayFreqUnit(ap.frequencyUnit || 'Month');
    setAutoPayCat(ap.category);
    setAutoPayTime(ap.time);
    setAutoPayStartDate(ap.startDate);
    setAutoPayBankId(ap.bankId);
    setEditingAutoPayId(ap.id);
    setCurrentView('Auto Pay Setup');
  };

  const addAutoPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoPayName.trim() || !autoPayAmount.trim() || !autoPayBankId) {
      showAlert('Please fill all required fields');
      return;
    }
    const newAP: AutoPay = {
      id: editingAutoPayId || Date.now().toString(),
      name: autoPayName.trim(),
      amount: parseFloat(autoPayAmount),
      frequency: 'Monthly', // Legacy field, keeping for schema safety
      frequencyValue: parseInt(autoPayFreqValue) || 1,
      frequencyUnit: autoPayFreqUnit,
      category: autoPayCat || 'General',
      time: autoPayTime,
      startDate: autoPayStartDate || getLocalDateStr(new Date()),
      bankId: autoPayBankId,
      status: 'Active'
    };
    if (editingAutoPayId) {
      setAutoPays(prev => prev.map(ap => ap.id === editingAutoPayId ? newAP : ap));
    } else {
      setAutoPays(prev => [...prev, newAP]);
    }
    setCurrentView('Auto Pay');
    resetAutoPayForm();
    setTriggerCheck(prev => prev + 1);
  };

  const resetAutoPayForm = () => {
    setAutoPayName('');
    setAutoPayAmount('');
    setAutoPayFreqValue('1');
    setAutoPayFreqUnit('Month');
    setAutoPayCat('');
    setAutoPayTime('00:00');
    setAutoPayStartDate('');
    setAutoPayBankId('');
    setEditingAutoPayId(null);
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
  }; const toggleCategoryFilter = (cat: string) => {
    if (cat === 'All') {
      setCategoryFilters(['All']);
    } else {
      const newFilters = categoryFilters.filter(f => f !== 'All');
      if (newFilters.includes(cat)) {
        const after = newFilters.filter(f => f !== cat);
        setCategoryFilters(after.length === 0 ? ['All'] : after);
      } else {
        setCategoryFilters([...newFilters, cat]);
      }
    }
  };

  const togglePaymentModeFilter = (mode: string) => {
    if (mode === 'All') {
      setPaymentModeFilter(['All']);
    } else {
      const newFilters = paymentModeFilter.filter(f => f !== 'All');
      if (newFilters.includes(mode)) {
        const after = newFilters.filter(f => f !== mode);
        setPaymentModeFilter(after.length === 0 ? ['All'] : after);
      } else {
        setPaymentModeFilter([...newFilters, mode]);
      }
    }
  };

  const deleteCategory = (catToDelete: string) => {
    showConfirm(`Are you sure you want to delete "${catToDelete}" category?`, () => {
      setCategories(categories.filter(cat => cat !== catToDelete));
      if (categoryFilters.includes(catToDelete)) {
        setCategoryFilters(prev => {
          const next = prev.filter(c => c !== catToDelete);
          return next.length === 0 ? ['All'] : next;
        });
      }
      if (category === catToDelete) setCategory('');
    });
  };

  const startEditCategory = (index: number) => {
    setEditingCategoryIdx(index);
    setNewCategory(categories[index]);
  };

  const startEditDepositCategory = (idx: number) => {
    setEditingDepositCategoryIdx(idx);
    setNewDepositCategory(depositCategories[idx]);
  };

  const addDepositCategory = () => {
    if (newDepositCategory.trim()) {
      const trimmedName = newDepositCategory.trim();
      if (editingDepositCategoryIdx !== null) {
        const oldName = depositCategories[editingDepositCategoryIdx];
        const updated = [...depositCategories];
        updated[editingDepositCategoryIdx] = trimmedName;
        setDepositCategories(updated);

        // Update existing transactions
        setBankTransactions(prev => prev.map(t =>
          t.type === 'in' && t.category === oldName ? { ...t, category: trimmedName } : t
        ));

        if (depositCategory === oldName) setDepositCategory(trimmedName);
        setEditingDepositCategoryIdx(null);
      } else {
        if (!depositCategories.includes(trimmedName)) {
          setDepositCategories([...depositCategories, trimmedName]);
        }
      }
      setNewDepositCategory('');
    }
  };

  const deleteDepositCategory = (cat: string) => {
    showConfirm(`Are you sure you want to delete "${cat}" category?`, () => {
      setDepositCategories(depositCategories.filter(c => c !== cat));
      if (depositCategory === cat) setDepositCategory('');
    });
  };

  const filteredExpenses = expenses.filter(expense => {
    if (!categoryFilters.includes('All')) {
      if (!categoryFilters.includes(expense.category || 'Uncategorized')) return false;
    }
    if (!paymentModeFilter.includes('All')) {
      if (!paymentModeFilter.includes(expense.paymentMode || 'Not Specified')) return false;
    }

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

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.getFullYear() + '-' + String(sevenDaysAgo.getMonth() + 1).padStart(2, '0') + '-' + String(sevenDaysAgo.getDate()).padStart(2, '0');

    const firstOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const fpmStr = firstOfPrevMonth.getFullYear() + '-' + String(firstOfPrevMonth.getMonth() + 1).padStart(2, '0') + '-' + String(firstOfPrevMonth.getDate()).padStart(2, '0');
    const lpmStr = lastOfPrevMonth.getFullYear() + '-' + String(lastOfPrevMonth.getMonth() + 1).padStart(2, '0') + '-' + String(lastOfPrevMonth.getDate()).padStart(2, '0');

    if (dateFilter === 'Today' && expense.date !== todayStr) return false;
    if (dateFilter === 'Yesterday' && expense.date !== yesterdayStr) return false;
    if (dateFilter === 'Tomorrow' && expense.date !== tomorrowStr) return false;
    if (dateFilter === 'Last 7 Days' && (expense.date < sevenDaysAgoStr || expense.date > todayStr)) return false;
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

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (!isDraggingClock || !clockFaceRef.current) return;

      const rect = clockFaceRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const x = e.clientX - rect.left - centerX;
      const y = e.clientY - rect.top - centerY;

      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      const [h, m] = time.split(':');
      if (timeSelectionMode === 'hour') {
        let hour = Math.round(angle / 30);
        if (hour === 0) hour = 12;
        const isPM = parseInt(h) >= 12;
        const finalH = hour === 12 ? (isPM ? 12 : 0) : (isPM ? hour + 12 : hour);
        setTime(`${String(finalH).padStart(2, '0')}:${m}`);
      } else {
        let minute = Math.round(angle / 6);
        if (minute === 60) minute = 0;
        setTime(`${h}:${String(minute).padStart(2, '0')}`);
      }
    };

    const handleGlobalUp = () => {
      if (isDraggingClock) {
        setIsDraggingClock(false);
        if (timeSelectionMode === 'hour') {
          setTimeout(() => setTimeSelectionMode('minute'), 200);
        }
      }
    };

    if (isDraggingClock) {
      window.addEventListener('pointermove', handleGlobalMove);
      window.addEventListener('pointerup', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [isDraggingClock, timeSelectionMode, time]);

  const handleDateClick = (dateStr: string) => {
    if (pickerMode === 'single') {
      setDate(dateStr);
      setShowCalendar(false);
      return;
    }

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
    const dataStr = JSON.stringify({ expenses, categories, settings, banks, bankTransactions, depositCategories }, null, 2);
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
        showAlert('Failed to generate backup file for sharing');
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
        if (data.banks) setBanks(data.banks);
        if (data.bankTransactions) setBankTransactions(data.bankTransactions);
        if (data.depositCategories) setDepositCategories(data.depositCategories);
        showAlert('Data restored successfully!');
      } catch (err) {
        showAlert('Invalid backup file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={`app-container ${settings.theme}`}>
      {/* App Loading Splash Screen */}
      {!dataLoaded && (
        <div className="app-loading-screen">
          <div className="splash-logo">Expense Tracker</div>
          <div className="spinner-glow"></div>
          <div className="loading-bar-container">
            <div className="loading-bar-fill"></div>
          </div>
          <p>Loading your financial workspace...</p>
        </div>
      )}
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
          <li className={currentView === 'Banks' ? 'active' : ''} onClick={() => { handleViewSwitch('Banks'); setIsSidebarOpen(false); }}>
            Banks
          </li>
          <li className={currentView === 'Auto Pay' ? 'active' : ''} onClick={() => { handleViewSwitch('Auto Pay'); setIsSidebarOpen(false); }}>
            Auto Pay
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
                    <div
                      className="custom-select-trigger"
                      onClick={() => {
                        setCalendarMonth(new Date(date || new Date()));
                        setShowCalendar(true);
                        setPickerMode('single'); // Need to handle this
                      }}
                      style={{
                        background: 'var(--input-bg)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '1rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {date ? date.split('-').reverse().join('/') : 'Select Date'}
                      <span style={{ fontSize: '1.1rem' }}>📅</span>
                    </div>
                  </div>
                  <div className="form-group half">
                    <label>Time</label>
                    <div
                      className="custom-select-trigger"
                      onClick={() => setShowTimePicker(true)}
                      style={{
                        background: 'var(--input-bg)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '1rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {time ? formatTime(time) : 'Select Time'}
                      <span style={{ fontSize: '1.1rem' }}>🕒</span>
                    </div>
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
                          {banks.length > 0 && <div className="popup-header" style={{ borderTop: '1px solid var(--border-color)', borderRadius: 0, padding: '0.75rem 1.25rem', fontSize: '0.9rem', background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>Bank Accounts</div>}
                          {banks.map(bank => (
                            <li key={bank.id} onClick={() => { setPaymentMode(bank.name); setActiveDropdown(null); }}>{bank.name}</li>
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
              <div
                className="refresh-container anim-fade-in"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className={`pull-to-refresh ${(pullY > 0 || isRefreshing) ? 'showing' : ''}`}
                  style={{ transform: isRefreshing ? 'translateY(70px)' : `translateY(${Math.min(pullY, 70)}px)` }}>
                  <div className="refresh-icon"></div>
                  <div className="refresh-text">
                    {isRefreshing ? 'Refreshing...' : (pullY < 180 ? 'Pull more...' : 'Ready to refresh!')}
                  </div>
                </div>

                <div className="dashboard-content" style={{ padding: '0 0.5rem' }}>
                  {selectedIds.length > 0 && (
                    <div className="selection-toolbar anim-slide-up" style={{
                      position: 'sticky', top: 0, zIndex: 110, background: 'var(--accent-color)',
                      color: 'white', padding: '0.75rem 1rem', borderRadius: '12px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '1rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}>
                      <div style={{ fontWeight: 600 }}>{selectedIds.length} Selected</div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => setSelectedIds([])} style={{ background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600 }}>Cancel</button>
                        <button onClick={bulkDeleteExpenses} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600 }}>Delete</button>
                      </div>
                    </div>
                  )}
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
                              {paymentModeFilter.includes('All')
                                ? 'All Modes'
                                : paymentModeFilter.length === 1
                                  ? paymentModeFilter[0]
                                  : `${paymentModeFilter.length} Modes`}
                            </div>
                            {activeDropdown === 'payFilter' && (
                              <div className="popup-dropdown-container">
                                <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                                <ul className="custom-dropdown popup multi-select">
                                  <div className="popup-header">Filter by Payment Mode</div>
                                  {['All', 'Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Other', 'Not Specified', ...banks.map(b => b.name)].map(mode => (
                                    <li
                                      key={mode}
                                      className={paymentModeFilter.includes(mode) ? 'selected' : ''}
                                      onClick={() => togglePaymentModeFilter(mode)}
                                    >
                                      <span className="checkbox">{paymentModeFilter.includes(mode) ? '✓' : ''}</span>
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
                              onClick={() => {
                                setActiveDropdown('dateFilter');
                                setPickerMode('range');
                              }}
                            >
                              {dateFilter === 'All' ? 'All Dates' : dateFilter}
                            </div>
                            {activeDropdown === 'dateFilter' && (
                              <div className="popup-dropdown-container">
                                <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                                <ul className="custom-dropdown popup">
                                  <div className="popup-header">Filter by Date</div>
                                  {['All', 'Today', 'Yesterday', 'Tomorrow', 'Last 7 Days', 'Last 30 Days', 'Last Month', 'Date Range'].map(range => (
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

                      {((categoryFilters.length > 0 && !categoryFilters.includes('All')) || (paymentModeFilter.length > 0 && !paymentModeFilter.includes('All')) || dateFilter !== 'All' || searchQuery !== '') && (
                        <button
                          type="button"
                          className="clear-filters-btn"
                          onClick={() => {
                            setCategoryFilters(['All']);
                            setPaymentModeFilter(['All']);
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
                        <div key={expense.id} className={`expense-card ${selectedIds.includes(expense.id) ? 'selected' : ''}`} onClick={() => {
                          // If we are already in selection mode, clicking the card toggles it
                          if (selectedIds.length > 0) {
                            toggleSelection(expense.id);
                          }
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                            <div
                              className={`selection-checkbox ${selectedIds.includes(expense.id) ? 'checked' : ''}`}
                              onClick={(e) => { e.stopPropagation(); toggleSelection(expense.id); }}
                            >
                              {selectedIds.includes(expense.id) && '✓'}
                            </div>

                            <div className="expense-info" style={{ flex: 1 }}>
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
                                {!selectedIds.length && (
                                  <>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(expense); }} style={{ background: '#cbd5e0', color: '#2d3748', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(expense.id); }} style={{ background: '#fc8181', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
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
            {currentView === 'Banks' && (
              <div
                className="refresh-container anim-fade-in"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className={`pull-to-refresh ${(pullY > 0 || isRefreshing) ? 'showing' : ''}`}
                  style={{ transform: isRefreshing ? 'translateY(70px)' : `translateY(${Math.min(pullY, 70)}px)` }}>
                  <div className="refresh-icon"></div>
                  <div className="refresh-text">
                    {isRefreshing ? 'Refreshing...' : (pullY < 180 ? 'Pull more...' : 'Ready to refresh!')}
                  </div>
                </div>

                <div className="banks-container" style={{ padding: '0 0.5rem' }}>
                  <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>Banks & Accounts</h2>
                    <button className="add-bank-btn" onClick={() => setShowBankModal(true)}>+ Add Bank</button>
                  </div>

                  {banks.length > 0 && (
                    <div className="total-bank-card anim-slide-up" style={{
                      background: 'var(--accent-color)',
                      padding: '1.25rem',
                      borderRadius: '16px',
                      marginBottom: '1.5rem',
                      color: 'white',
                      boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
                    }}>
                      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Available Balance</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        ₹{banks.reduce((sum, b) => sum + b.balance, 0).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {banks.length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>No bank accounts added yet.</p>
                      <button className="add-bank-btn" style={{ marginTop: '1rem' }} onClick={() => setShowBankModal(true)}>Create Your First Account</button>
                    </div>
                  ) : (
                    <div className="banks-list">
                      {banks.map(bank => (
                        <div key={bank.id} className="bank-list-item shadow-sm" onClick={() => { setViewingBankId(bank.id); setCurrentView('Bank Detail'); }}>
                          <div className="bank-info">
                            <h3>{bank.name}</h3>
                            <span className="bank-id-tag">Account ID: {bank.id.substring(0, 8)}</span>
                          </div>
                          <div className="bank-item-balance">
                            <div className="label">Balance</div>
                            <div className="amount" style={{ color: '#10b981', fontWeight: 700 }}>₹{bank.balance.toFixed(2)}</div>
                          </div>
                          <div className="bank-chevron">›</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentView === 'Bank Detail' && viewingBankId && (
              <div className="bank-detail-view anim-fade-in">
                {(() => {
                  const bank = banks.find(b => b.id === viewingBankId);
                  if (!bank) return null;
                  return (
                    <>
                      <div className="detail-header">
                        <button className="back-btn-simple" onClick={() => setCurrentView('Banks')}>← Back to List</button>
                        <button className="delete-btn-bank" onClick={() => { deleteBank(bank.id); setCurrentView('Banks'); }}>✕ Delete Bank</button>
                      </div>

                      <div className="bank-hero-card">
                        <div className="hero-content">
                          <h1>{bank.name}</h1>
                          <div className="hero-balance">
                            <span className="label">Current Balance</span>
                            <div className="amount">₹{bank.balance.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="hero-actions">
                          <button
                            className="cash-in-btn large"
                            onClick={() => {
                              setSelectedBankId(bank.id);
                              setShowDepositModal(true);
                            }}
                          >
                            + Add Money (Cash In)
                          </button>
                        </div>
                      </div>

                      <div className="detail-statement-section">
                        <div className="statement-header-group">
                          <h2 className="section-title">Account Statement</h2>
                          <div className="statement-controls">
                            <div className="statement-search">
                              <input
                                type="text"
                                placeholder="Search here..."
                                value={bankSearchQuery}
                                onChange={e => setBankSearchQuery(e.target.value)}
                              />
                            </div>
                            <div className="statement-filters-row">
                              <div className="custom-select-wrapper" style={{ flex: 1 }}>
                                <div
                                  className={`custom-select-trigger ${activeDropdown === 'bankTypeFilter' ? 'open' : ''}`}
                                  onClick={() => setActiveDropdown('bankTypeFilter')}
                                >
                                  {bankTypeFilter === 'All' ? 'All Types' : bankTypeFilter === 'in' ? 'Cash In' : 'Cash Out'}
                                </div>
                                {activeDropdown === 'bankTypeFilter' && (
                                  <div className="popup-dropdown-container">
                                    <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                                    <ul className="custom-dropdown popup">
                                      <div className="popup-header">Filter by Type</div>
                                      <li className={bankTypeFilter === 'All' ? 'selected' : ''} onClick={() => { setBankTypeFilter('All'); setActiveDropdown(null); }}>All Types</li>
                                      <li className={bankTypeFilter === 'in' ? 'selected' : ''} onClick={() => { setBankTypeFilter('in'); setActiveDropdown(null); }}>Cash In</li>
                                      <li className={bankTypeFilter === 'out' ? 'selected' : ''} onClick={() => { setBankTypeFilter('out'); setActiveDropdown(null); }}>Cash Out</li>
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="custom-select-wrapper" style={{ flex: 1 }}>
                                <div
                                  className={`custom-select-trigger ${activeDropdown === 'bankDateFilter' ? 'open' : ''}`}
                                  onClick={() => setActiveDropdown('bankDateFilter')}
                                >
                                  {bankDateFilter === 'All' ? 'All Time' : bankDateFilter}
                                </div>
                                {activeDropdown === 'bankDateFilter' && (
                                  <div className="popup-dropdown-container">
                                    <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                                    <ul className="custom-dropdown popup">
                                      <div className="popup-header">Filter by Date</div>
                                      <li className={bankDateFilter === 'All' ? 'selected' : ''} onClick={() => { setBankDateFilter('All'); setActiveDropdown(null); }}>All Time</li>
                                      <li className={bankDateFilter === 'Today' ? 'selected' : ''} onClick={() => { setBankDateFilter('Today'); setActiveDropdown(null); }}>Today</li>
                                      <li className={bankDateFilter === 'Yesterday' ? 'selected' : ''} onClick={() => { setBankDateFilter('Yesterday'); setActiveDropdown(null); }}>Yesterday</li>
                                      <li className={bankDateFilter === 'Last 7 Days' ? 'selected' : ''} onClick={() => { setBankDateFilter('Last 7 Days'); setActiveDropdown(null); }}>Last 7 Days</li>
                                      <li className={bankDateFilter === 'Last 30 Days' ? 'selected' : ''} onClick={() => { setBankDateFilter('Last 30 Days'); setActiveDropdown(null); }}>Last 30 Days</li>
                                      <li className={bankDateFilter === 'Custom' ? 'selected' : ''} onClick={() => { setBankDateFilter('Custom'); setActiveDropdown(null); }}>Custom Range</li>
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                            {bankDateFilter === 'Custom' && (
                              <div className="statement-filters-row anim-fade-in" style={{ marginTop: '0.5rem' }}>
                                <input
                                  type="date"
                                  className="modal-input"
                                  value={bankStartDate}
                                  onChange={e => setBankStartDate(e.target.value)}
                                  style={{ flex: 1, padding: '0.5rem' }}
                                />
                                <input
                                  type="date"
                                  className="modal-input"
                                  value={bankEndDate}
                                  onChange={e => setBankEndDate(e.target.value)}
                                  style={{ flex: 1, padding: '0.5rem' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="statement-full-list">
                          {(() => {
                            let filteredList = bankTransactions.filter(t => t.bankId === bank.id);

                            // Type Filter
                            if (bankTypeFilter !== 'All') {
                              filteredList = filteredList.filter(t => t.type === bankTypeFilter);
                            }

                            // Search Filter
                            if (bankSearchQuery.trim() !== '') {
                              const q = bankSearchQuery.toLowerCase();
                              filteredList = filteredList.filter(t =>
                                t.description.toLowerCase().includes(q) ||
                                t.category?.toLowerCase().includes(q)
                              );
                            }

                            // Date Filter
                            if (bankDateFilter !== 'All') {
                              const today = new Date();
                              const todayStr = getLocalDateStr(today);
                              const yesterday = new Date(today);
                              yesterday.setDate(yesterday.getDate() - 1);
                              const yesterdayStr = getLocalDateStr(yesterday);
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                              const thirtyDaysAgo = new Date(today);
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                              filteredList = filteredList.filter(t => {
                                if (bankDateFilter === 'Today') return t.date === todayStr;
                                if (bankDateFilter === 'Yesterday') return t.date === yesterdayStr;
                                if (bankDateFilter === 'Last 7 Days') return t.date >= getLocalDateStr(sevenDaysAgo);
                                if (bankDateFilter === 'Last 30 Days') return t.date >= getLocalDateStr(thirtyDaysAgo);
                                if (bankDateFilter === 'Custom') {
                                  if (bankStartDate && t.date < bankStartDate) return false;
                                  if (bankEndDate && t.date > bankEndDate) return false;
                                  return true;
                                }
                                return true;
                              });
                            }

                            if (filteredList.length === 0) {
                              return (
                                <div className="empty-statement">
                                  <p>No transactions match your filters.</p>
                                </div>
                              );
                            }

                             return filteredList.map(trx => (
                              <div key={trx.id} className={`statement-list-row ${trx.type}`} onClick={() => setViewingTrx(trx)}>
                                <div className="date-column">
                                  <span className="d">{trx.date.split('-')[2]}</span>
                                  <span className="m">{new Date(trx.date).toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div className="info-column-liquid">
                                  <div className="trx-title-row">
                                    <span className="title-text">{trx.description}</span>
                                    <div className="vertical-sep"></div>
                                    <span className="trx-category-chip">{trx.category || 'General'}</span>
                                    <div className="vertical-sep"></div>
                                    <span className="trx-time-label">{formatTime(trx.time)}</span>
                                  </div>
                                </div>
                                <div className={`amount-column-fixed ${trx.type}`}>
                                  {trx.type === 'in' ? '+' : '-'}₹{trx.amount.toFixed(2)}
                                </div>
                                <div className="actions-column">
                                  <button className="mini-btn edit" onClick={(e) => { e.stopPropagation(); startEditDeposit(trx); }}>✎</button>
                                  <button className="mini-btn delete" onClick={(e) => { e.stopPropagation(); deleteBankTransaction(trx); }}>✕</button>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {currentView === 'Auto Pay' && (
              <div className="autopay-view anim-fade-in">
                <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Auto Pay (SIP)</h2>
                  <button className="add-bank-btn" onClick={() => { resetAutoPayForm(); setCurrentView('Auto Pay Setup'); }}>+ Set Auto Pay</button>
                </div>

                {autoPays.length === 0 ? (
                  <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px dashed var(--border-color)' }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>No automated payments scheduled.</p>
                    <button className="add-bank-btn" style={{ marginTop: '1rem' }} onClick={() => { resetAutoPayForm(); setCurrentView('Auto Pay Setup'); }}>Create Your First Auto Pay</button>
                  </div>
                ) : (
                  <div className="autopay-list">
                    {autoPays.map(ap => {
                      const bank = banks.find(b => b.id === ap.bankId);
                      return (
                        <div key={ap.id} className="autopay-card shadow-sm">
                          <div className="card-top">
                            <div className="card-info">
                              <h3>{ap.name}</h3>
                              <p className="ap-meta">
                                {ap.frequencyValue} per {ap.frequencyUnit?.toLowerCase()} • {ap.time} • {ap.category}
                              </p>
                            </div>
                            <div className="card-amount">₹{ap.amount.toFixed(2)}</div>
                          </div>
                          <div className="card-bottom">
                            <span className="linked-bank">From: {bank ? bank.name : 'Unknown Bank'}</span>
                            <div className="card-actions">
                              <button className="row-btn edit" onClick={() => startEditAutoPay(ap)}>✎</button>
                              <button className="row-btn delete" onClick={() => deleteAutoPay(ap.id)}>✕</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {currentView === 'Auto Pay Setup' && (
              <div className="autopay-setup-view anim-slide-up">
                <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <button className="back-btn" onClick={() => setCurrentView('Auto Pay')}>←</button>
                  <h2 style={{ margin: 0 }}>{editingAutoPayId ? 'Edit Auto Pay' : 'Set Auto Pay'}</h2>
                </div>

                <form className="modal-form" onSubmit={addAutoPay}>
                  <div className="ap-setup-section">
                    <div className="modal-section-title">General Details</div>
                    <div className="form-group">
                      <label>📝 Auto Pay Name</label>
                      <input
                        type="text"
                        className="modal-input"
                        placeholder="e.g. House Rent, Monthly Gym"
                        value={autoPayName}
                        onChange={e => setAutoPayName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>💰 Amount</label>
                        <div className="modal-input-container">
                          <input
                            type="number"
                            className="modal-input"
                            placeholder="0.00"
                            value={autoPayAmount}
                            onChange={e => setAutoPayAmount(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ flex: 1.2 }}>
                        <label>🔄 Frequency</label>
                        <div className="combined-freq-input">
                          <input
                            type="number"
                            className="freq-number-input"
                            value={autoPayFreqValue}
                            onChange={e => setAutoPayFreqValue(e.target.value)}
                            min="1"
                            required
                          />
                          <div className={`custom-select-trigger freq-unit-selector ${activeDropdown === 'apFreqUnit' ? 'open' : ''}`} onClick={() => setActiveDropdown('apFreqUnit')}>
                            per {autoPayFreqUnit?.toLowerCase()}
                          </div>
                        </div>
                        {activeDropdown === 'apFreqUnit' && (
                          <div className="popup-dropdown-container">
                            <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                            <ul className="custom-dropdown popup">
                              <li onClick={() => { setAutoPayFreqUnit('Minute'); setActiveDropdown(null); }}>per minute</li>
                              <li onClick={() => { setAutoPayFreqUnit('Hour'); setActiveDropdown(null); }}>per hour</li>
                              <li onClick={() => { setAutoPayFreqUnit('Day'); setActiveDropdown(null); }}>per day</li>
                              <li onClick={() => { setAutoPayFreqUnit('Month'); setActiveDropdown(null); }}>per month</li>
                              <li onClick={() => { setAutoPayFreqUnit('Year'); setActiveDropdown(null); }}>per year</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ap-setup-section">
                    <div className="modal-section-title">Schedule & Account</div>
                    <div className="form-group">
                      <label>📂 Category</label>
                      <div className="custom-select-wrapper">
                        <div className={`custom-select-trigger ${activeDropdown === 'apCat' ? 'open' : ''}`} onClick={() => setActiveDropdown('apCat')}>
                          {autoPayCat || 'Select Category'}
                        </div>
                        {activeDropdown === 'apCat' && (
                          <div className="popup-dropdown-container">
                            <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                            <ul className="custom-dropdown popup">
                              <div className="popup-header">Select Category</div>
                              {categories.map(cat => (
                                <li key={cat} onClick={() => { setAutoPayCat(cat); setActiveDropdown(null); }}>{cat}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>⏰ Time</label>
                        <input
                          type="time"
                          className="modal-input"
                          value={autoPayTime}
                          onChange={e => setAutoPayTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>📅 Start Date</label>
                        <input
                          type="date"
                          className="modal-input"
                          value={autoPayStartDate}
                          onChange={e => setAutoPayStartDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>🏦 Link Bank/Account</label>
                      <div className="custom-select-wrapper">
                        <div className={`custom-select-trigger ${activeDropdown === 'apBank' ? 'open' : ''}`} onClick={() => setActiveDropdown('apBank')}>
                          {banks.find(b => b.id === autoPayBankId)?.name || 'Select Account'}
                        </div>
                        {activeDropdown === 'apBank' && (
                          <div className="popup-dropdown-container">
                            <div className="popup-overlay" onClick={() => setActiveDropdown(null)}></div>
                            <ul className="custom-dropdown popup">
                              <div className="popup-header">Link Account</div>
                              {banks.map(bank => (
                                <li key={bank.id} onClick={() => { setAutoPayBankId(bank.id); setActiveDropdown(null); }}>
                                  {bank.name} (₹{bank.balance.toFixed(2)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" style={{ padding: '1.25rem' }}>{editingAutoPayId ? 'Update' : 'Schedule'} Auto Pay</button>
                </form>
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
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
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

            <div className="category-list">
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

      {/* Deposit Category Manager Modal */}
      {isDepositCategoryModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal category-modal">
            <div className="modal-header">
              <h3>Manage Deposit Categories</h3>
              <button
                className="close-btn"
                style={{ position: 'static', color: 'var(--text-primary)' }}
                onClick={() => {
                  setIsDepositCategoryModalOpen(false);
                  setEditingDepositCategoryIdx(null);
                  setNewDepositCategory('');
                }}
              >
                &times;
              </button>
            </div>

            <div className="category-input-group">
              <input
                type="text"
                value={newDepositCategory}
                onChange={e => setNewDepositCategory(e.target.value)}
                placeholder={editingDepositCategoryIdx !== null ? "Edit category name" : "New category name"}
                className="category-modal-input"
              />
              <button type="button" onClick={addDepositCategory} className="modal-action-btn primary">
                {editingDepositCategoryIdx !== null ? 'Update' : 'Add'}
              </button>
              {editingDepositCategoryIdx !== null && (
                <button type="button" onClick={() => { setEditingDepositCategoryIdx(null); setNewDepositCategory(''); }} className="modal-action-btn secondary">Cancel</button>
              )}
            </div>

            <div className="category-list">
              {depositCategories.map((cat, idx) => (
                <div key={cat} className="category-list-item">
                  <span className="cat-name">{cat}</span>
                  <div className="cat-actions">
                    <button type="button" className="cat-btn edit" onClick={() => startEditDepositCategory(idx)}>Edit</button>
                    <button type="button" className="cat-btn delete" onClick={() => deleteDepositCategory(cat)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {renderTransactionDetailModal()}
      {/* Bank Manager Modals */}
      {showBankModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Bank</h3>
              <button className="close-btn" style={{ position: 'static', color: 'var(--text-primary)' }} onClick={() => setShowBankModal(false)}>&times;</button>
            </div>
            <form onSubmit={addBank}>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                <label>Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="modal-input"
                  required
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                <label>Initial Balance (₹)</label>
                <input
                  type="number"
                  value={bankBalance}
                  onChange={e => setBankBalance(e.target.value)}
                  placeholder="0.00"
                  className="modal-input"
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="modal-btn cancel" onClick={() => setShowBankModal(false)}>Cancel</button>
                <button type="submit" className="modal-btn primary">Save Bank</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDepositModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Cash In (Deposit)</h3>
              <button className="close-btn" style={{ position: 'static', color: 'var(--text-primary)' }} onClick={() => setShowDepositModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleDeposit}>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                <label>Deposit Amount (₹)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="modal-input"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                <label>Description (Optional)</label>
                <input
                  type="text"
                  value={depositDescription}
                  onChange={e => setDepositDescription(e.target.value)}
                  placeholder="e.g. Salary, Gift"
                  className="modal-input"
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Category</label>
                  <button type="button" onClick={() => setIsDepositCategoryModalOpen(true)} className="manage-btn-small">Manage</button>
                </div>
                <input
                  type="text"
                  value={depositCategory}
                  onChange={(e) => {
                    setDepositCategory(e.target.value);
                    setActiveDropdown('depositCat');
                  }}
                  onFocus={() => setActiveDropdown('depositCat')}
                  onBlur={() => {
                    setTimeout(() => setActiveDropdown(null), 200);
                  }}
                  placeholder="Select or type a category"
                  className="modal-input"
                />
                {activeDropdown === 'depositCat' && (
                  <ul className="custom-dropdown" style={{ top: '100%', left: 0, width: '100%', zIndex: 100 }}>
                    {depositCategories
                      .filter(cat => cat.toLowerCase().includes(depositCategory.toLowerCase()))
                      .map(cat => (
                        <li
                          key={cat}
                          onClick={() => {
                            setDepositCategory(cat);
                            setActiveDropdown(null);
                          }}
                        >
                          {cat}
                        </li>
                      ))}
                    {depositCategories.filter(cat => cat.toLowerCase().includes(depositCategory.toLowerCase())).length === 0 && (
                      <li style={{ color: 'var(--text-tertiary)', padding: '0.75rem 1rem', fontStyle: 'italic', cursor: 'default' }}>No match found</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="modal-btn cancel" onClick={() => setShowDepositModal(false)}>Cancel</button>
                <button type="submit" className="modal-btn primary">Deposit</button>
              </div>
            </form>
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
                  const isStart = pickerMode === 'range' ? dateStr === startDate : dateStr === date;
                  const isEnd = pickerMode === 'range' ? dateStr === endDate : false;
                  const hasSelection = pickerMode === 'range' ? !!(startDate && endDate) : !!date;
                  const isInRange = pickerMode === 'range' ? (startDate && endDate && dateStr > startDate && dateStr < endDate) : false;

                  const todayObj = new Date();
                  const todayStr = formatCalDate(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
                  const isToday = dateStr === todayStr;

                  cells.push(
                    <div
                      key={d}
                      className={`calendar-day ${isStart ? 'range-start' : ''} ${isEnd ? 'range-end' : ''} ${(isStart || isEnd) ? 'selected' : ''} ${isInRange ? 'in-range' : ''} ${hasSelection ? 'has-range' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => handleDateClick(dateStr)}
                    >
                      {d}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>

            {pickerMode === 'range' && (
              <div className="calendar-footer">
                <button type="button" className="cancel-btn" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
                <button type="button" className="apply-btn" onClick={() => setShowCalendar(false)}>Apply</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Material Clock Time Picker Modal */}
      {showTimePicker && (
        <div className="modal-overlay" onClick={() => setShowTimePicker(false)}>
          <div className="clock-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="clock-header">
              <div className="clock-time-display">
                <div
                  className={`clock-large-text ${timeSelectionMode === 'hour' ? 'active' : ''}`}
                  onClick={() => setTimeSelectionMode('hour')}
                >
                  {(() => {
                    const [h] = time.split(':');
                    const hour = parseInt(h);
                    return String(hour % 12 || 12);
                  })()}
                </div>
                <span className="clock-separator">:</span>
                <div
                  className={`clock-large-text ${timeSelectionMode === 'minute' ? 'active' : ''}`}
                  onClick={() => setTimeSelectionMode('minute')}
                >
                  {time.split(':')[1] || '00'}
                </div>
              </div>
              <div className="clock-ampm-toggle">
                <div
                  className={`ampm-btn ${parseInt(time.split(':')[0]) < 12 ? 'active' : ''}`}
                  onClick={() => {
                    const [h, m] = time.split(':');
                    const hour = parseInt(h);
                    if (hour >= 12) setTime(`${String(hour - 12).padStart(2, '0')}:${m}`);
                  }}
                >
                  AM
                </div>
                <div
                  className={`ampm-btn ${parseInt(time.split(':')[0]) >= 12 ? 'active' : ''}`}
                  onClick={() => {
                    const [h, m] = time.split(':');
                    const hour = parseInt(h);
                    if (hour < 12) setTime(`${String(hour + 12).padStart(2, '0')}:${m}`);
                  }}
                >
                  PM
                </div>
              </div>
            </div>

            <div className="clock-face-container">
              <div
                ref={clockFaceRef}
                className="clock-face"
                onPointerDown={(e) => {
                  setIsDraggingClock(true);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.width / 2;
                  const centerY = rect.height / 2;
                  const x = e.clientX - rect.left - centerX;
                  const y = e.clientY - rect.top - centerY;

                  let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
                  if (angle < 0) angle += 360;

                  const [h, m] = time.split(':');
                  if (timeSelectionMode === 'hour') {
                    let hour = Math.round(angle / 30);
                    if (hour === 0) hour = 12;
                    const isPM = parseInt(h) >= 12;
                    const finalH = hour === 12 ? (isPM ? 12 : 0) : (isPM ? hour + 12 : hour);
                    setTime(`${String(finalH).padStart(2, '0')}:${m}`);
                  } else {
                    let minute = Math.round(angle / 6);
                    if (minute === 60) minute = 0;
                    setTime(`${h}:${String(minute).padStart(2, '0')}`);
                  }
                }}
                style={{ touchAction: 'none' }}
              >
                <div className="clock-center-dot"></div>
                {/* Needle */}
                <div
                  className="clock-needle"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${(() => {
                      const [h, m] = time.split(':');
                      if (timeSelectionMode === 'hour') {
                        return (parseInt(h) % 12) * 30;
                      } else {
                        return parseInt(m) * 6;
                      }
                    })()}deg)`
                  }}
                >
                  <div className="needle-head"></div>
                </div>
                {/* Numbers */}
                {timeSelectionMode === 'hour' ? (
                  Array.from({ length: 12 }, (_, i) => {
                    const val = i + 1;
                    const angle = (val * 30) - 90;
                    const rad = (angle * Math.PI) / 180;
                    const x = 50 + 38 * Math.cos(rad);
                    const y = 50 + 38 * Math.sin(rad);
                    const [h] = time.split(':');
                    const currentH12 = parseInt(h) % 12 || 12;
                    return (
                      <div
                        key={val}
                        className={`clock-number ${val === currentH12 ? 'selected' : ''}`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        {val}
                      </div>
                    );
                  })
                ) : (
                  [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(val => {
                    const angle = (val * 6) - 90;
                    const rad = (angle * Math.PI) / 180;
                    const x = 50 + 38 * Math.cos(rad);
                    const y = 50 + 38 * Math.sin(rad);
                    const [_, m] = time.split(':');
                    const currentM = parseInt(m);
                    return (
                      <div
                        key={val}
                        className={`clock-number ${val === currentM ? 'selected' : ''}`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        {val}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="clock-footer">
              <button className="clock-btn flat" onClick={() => setShowTimePicker(false)}>CANCEL</button>
              <button className="clock-btn flat colored" onClick={() => setShowTimePicker(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Confirm Dialog */}
      {dialog.show && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="custom-dialog anim-pop-in">
            <div className="dialog-content">
              <p>{dialog.message}</p>
            </div>
            <div className="dialog-actions">
              {dialog.type === 'confirm' && (
                <button className="dialog-btn secondary" onClick={closeDialog}>Cancel</button>
              )}
              <button
                className="dialog-btn primary"
                onClick={() => {
                  if (dialog.type === 'confirm' && dialog.onConfirm) {
                    dialog.onConfirm();
                  }
                  closeDialog();
                }}
              >
                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default App;
