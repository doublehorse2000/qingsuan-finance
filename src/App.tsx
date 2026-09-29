import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, BrainCircuit, FileUp, Landmark, LayoutDashboard, Menu, Monitor, Moon, Plus, ReceiptText, Settings, Sun, Target, WalletCards, X } from 'lucide-react';
import { Modal } from './components/Modal';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './data';
import { exportTransactionsCsv } from './lib/export';
import type { ImportedTransaction } from './lib/csv';
import { currencySymbol, getCurrentNetWorth, makeId } from './lib/finance';
import { normalizeAppData, useFinanceData } from './store';
import { storage } from './lib/storage';
import type { Account, AppData, Currency, Investment, InvestmentType, Transaction, TransactionType, ViewId } from './types';
import { Analysis } from './views/Analysis';
import { Assets } from './views/Assets';
import { Budgets } from './views/Budgets';
import { Dashboard } from './views/Dashboard';
import { Settings as SettingsView } from './views/Settings';
import { Transactions } from './views/Transactions';
import { PdfImport } from './views/PdfImport';

const navItems: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'transactions', label: '流水', icon: ReceiptText },
  { id: 'import', label: '导入流水', icon: FileUp },
  { id: 'budgets', label: '预算', icon: Target },
  { id: 'assets', label: '资产', icon: Landmark },
  { id: 'analysis', label: 'AI 分析', icon: BrainCircuit },
  { id: 'settings', label: '数据设置', icon: Settings },
];

const viewNames: Record<ViewId, string> = {
  dashboard: '总览', transactions: '收支流水', import: '导入银行流水', budgets: '分类预算', assets: '账户与投资', analysis: 'AI 分析', settings: '数据设置',
};

const transactionDelta = (transaction: Pick<Transaction, 'type' | 'amount'>) => transaction.type === 'income' ? transaction.amount : -transaction.amount;
type ThemeMode = 'light' | 'dark' | 'system';

const getInitialThemeMode = (): ThemeMode => {
  const savedMode = storage.getItem('qingsuan.theme.mode');
  if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') return savedMode;
  const legacy = storage.getItem('qingsuan.theme');
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'system';
};

export default function App() {
  const { data, setData, isDemo, replaceData, resetEmpty, resetDemo } = useFinanceData();
  const [view, setView] = useState<ViewId>('dashboard');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [transactionAccountId, setTransactionAccountId] = useState('');
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<Currency>('CNY');
  const [investmentModal, setInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [snapshotModal, setSnapshotModal] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  const theme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.setItem('qingsuan.theme.mode', themeMode);
    storage.setItem('qingsuan.theme', theme);
  }, [theme, themeMode]);

  const navigate = (next: ViewId) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openTransaction = (transaction?: Transaction) => {
    setEditingTransaction(transaction ?? null);
    setTransactionType(transaction?.type ?? 'expense');
    setTransactionAccountId(transaction?.accountId ?? '');
    setTransactionModal(true);
  };

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Transaction = {
      id: editingTransaction?.id ?? makeId(),
      date: String(form.get('date')),
      type: String(form.get('type')) as TransactionType,
      amount: Math.max(0, Number(form.get('amount'))),
      category: String(form.get('category')),
      accountId: String(form.get('accountId')),
      merchant: String(form.get('merchant')).trim(),
      note: String(form.get('note')).trim(),
    };
    setData((current) => {
      let accounts = current.accounts;
      if (editingTransaction?.accountId) {
        accounts = accounts.map((account) => account.id === editingTransaction.accountId ? { ...account, balance: account.balance - transactionDelta(editingTransaction) } : account);
      }
      if (next.accountId) {
        accounts = accounts.map((account) => account.id === next.accountId ? { ...account, balance: account.balance + transactionDelta(next) } : account);
      }
      return {
        ...current,
        accounts,
        transactions: editingTransaction
          ? current.transactions.map((item) => item.id === editingTransaction.id ? next : item)
          : [next, ...current.transactions],
      };
    });
    setTransactionModal(false);
  };

  const deleteTransaction = (transaction: Transaction) => {
    if (!window.confirm(`删除“${transaction.merchant || transaction.category}”这笔流水？`)) return;
    setData((current) => ({
      ...current,
      accounts: transaction.accountId ? current.accounts.map((account) => account.id === transaction.accountId ? { ...account, balance: account.balance - transactionDelta(transaction) } : account) : current.accounts,
      transactions: current.transactions.filter((item) => item.id !== transaction.id),
    }));
  };

  const importTransactions = (rows: ImportedTransaction[], targetAccountId: string) => {
    let imported = 0;
    let skipped = 0;
    const accounts = [...data.accounts];
    const transactions = [...data.transactions];
    const accountIds = new Map<string, string>();
    const colors = ['#3d6b5a', '#d6a84b', '#4d7c8a', '#c65f6a', '#6874a8'];
    const getAccountId = (row: ImportedTransaction) => {
      if (targetAccountId) return targetAccountId;
      const key = `${row.accountName}|${row.currency}`;
      const existing = accountIds.get(key) ?? accounts.find((account) => account.name === row.accountName && (account.currency ?? 'CNY') === row.currency)?.id;
      if (existing) {
        accountIds.set(key, existing);
        return existing;
      }
      const account = { id: makeId(), name: row.accountName, kind: 'asset' as const, balance: row.onlineBalance ?? 0, color: colors[accounts.length % colors.length], currency: row.currency, exchangeRateToCny: row.currency === 'USD' ? 7.2 : 1 };
      accounts.push(account);
      accountIds.set(key, account.id);
      return account.id;
    };
    for (const row of rows) {
      const accountId = getAccountId(row);
      const fingerprint = [row.date, row.type, row.amount.toFixed(2), row.category, row.merchant, accountId].join('|');
      const duplicate = transactions.some((item) => [item.date, item.type, item.amount.toFixed(2), item.category, item.merchant, item.accountId].join('|') === fingerprint);
      if (duplicate) {
        skipped += 1;
        continue;
      }
      transactions.unshift({ id: makeId(), date: row.date, type: row.type, amount: row.amount, category: row.category, accountId, merchant: row.merchant, note: row.note });
      imported += 1;
    }
    for (const account of accounts) {
      const relevant = rows.filter((row) => getAccountId(row) === account.id && row.onlineBalance !== undefined);
      const lastBalance = relevant.at(-1)?.onlineBalance;
      if (lastBalance !== undefined) account.balance = lastBalance;
    }
    setData({ ...data, accounts, transactions });
    return { imported, skipped };
  };

  const openAccount = (account?: Account) => {
    setEditingAccount(account ?? null);
    setAccountCurrency(account?.currency === 'USD' ? 'USD' : 'CNY');
    setAccountModal(true);
  };

  const saveAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Account = {
      id: editingAccount?.id ?? makeId(),
      name: String(form.get('name')).trim(),
      kind: String(form.get('kind')) as Account['kind'],
      balance: Math.max(0, Number(form.get('balance'))),
      color: String(form.get('color')),
      currency: String(form.get('currency')) as Currency,
      exchangeRateToCny: String(form.get('currency')) === 'USD' ? Math.max(0.0001, Number(form.get('exchangeRateToCny')) || 7.2) : 1,
    };
    setData((current) => ({ ...current, accounts: editingAccount ? current.accounts.map((item) => item.id === editingAccount.id ? next : item) : [...current.accounts, next] }));
    setAccountModal(false);
  };

  const deleteAccount = (account: Account) => {
    if (!window.confirm(`删除账户“${account.name}”？相关流水会保留为未指定账户。`)) return;
    setData((current) => ({
      ...current,
      accounts: current.accounts.filter((item) => item.id !== account.id),
      transactions: current.transactions.map((item) => item.accountId === account.id ? { ...item, accountId: '' } : item),
    }));
  };

  const openInvestment = (investment?: Investment) => {
    setEditingInvestment(investment ?? null);
    setInvestmentModal(true);
  };

  const saveInvestment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Investment = {
      id: editingInvestment?.id ?? makeId(),
      name: String(form.get('name')).trim(),
      symbol: String(form.get('symbol')).trim(),
      type: String(form.get('type')) as InvestmentType,
      units: Math.max(0, Number(form.get('units'))),
      averageCost: Math.max(0, Number(form.get('averageCost'))),
      currentPrice: Math.max(0, Number(form.get('currentPrice'))),
      updatedAt: String(form.get('updatedAt')),
    };
    setData((current) => ({ ...current, investments: editingInvestment ? current.investments.map((item) => item.id === editingInvestment.id ? next : item) : [...current.investments, next] }));
    setInvestmentModal(false);
  };

  const deleteInvestment = (investment: Investment) => {
    if (!window.confirm(`删除持仓“${investment.name}”？`)) return;
    setData((current) => ({ ...current, investments: current.investments.filter((item) => item.id !== investment.id) }));
  };

  const saveSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const snapshot = {
      id: data.snapshots.find((item) => item.month === month)?.id ?? makeId(),
      month,
      assets: Math.max(0, Number(form.get('assets'))),
      liabilities: Math.max(0, Number(form.get('liabilities'))),
      note: String(form.get('note')).trim(),
    };
    setData((current) => ({
      ...current,
      snapshots: current.snapshots.some((item) => item.month === month)
        ? current.snapshots.map((item) => item.month === month ? snapshot : item)
        : [...current.snapshots, snapshot],
    }));
    setSnapshotModal(false);
  };

  const currentSnapshot = data.snapshots.find((item) => item.month === month);
  const totals = getCurrentNetWorth(data);
  const transactionDate = `${month}-${String(Math.min(new Date().getDate(), 28)).padStart(2, '0')}`;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span><WalletCards size={22} /></span><div><strong>清算</strong><small>个人财务管家</small></div></div>
        <button className="sidebar-close icon-button" type="button" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={19} /></button>
        <nav>
          <p>工作台</p>
          {navItems.slice(0, 6).map(({ id, label, icon: Icon }) => <button type="button" className={view === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={18} /><span>{label}</span></button>)}
          <p>管理</p>
          {navItems.slice(6).map(({ id, label, icon: Icon }) => <button type="button" className={view === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={18} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-foot"><span><span className="status-light" />仅存于本机</span><small>建议每月备份一次数据</small></div>
      </aside>
      {mobileNav && <button className="nav-scrim" type="button" onClick={() => setMobileNav(false)} aria-label="关闭导航遮罩" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" type="button" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={20} /></button><span>{viewNames[view]}</span></div>
          <div className="topbar-actions">
            <label className="month-picker"><BarChart3 size={17} /><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="选择月份" /></label>
            <div className="theme-control">
              <button className="theme-toggle icon-button" type="button" onClick={() => setThemeMenuOpen((open) => !open)} aria-label="选择主题模式" aria-expanded={themeMenuOpen} title="选择主题模式">
                {themeMode === 'system' ? <Monitor size={18} /> : theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
              </button>
              {themeMenuOpen && <div className="theme-menu" role="menu" aria-label="主题模式">
                <button type="button" className={themeMode === 'light' ? 'active' : ''} onClick={() => { setThemeMode('light'); setThemeMenuOpen(false); }}><Sun size={16} /><span>浅色</span><small>白天</small></button>
                <button type="button" className={themeMode === 'dark' ? 'active' : ''} onClick={() => { setThemeMode('dark'); setThemeMenuOpen(false); }}><Moon size={16} /><span>深色</span><small>夜晚</small></button>
                <button type="button" className={themeMode === 'system' ? 'active' : ''} onClick={() => { setThemeMode('system'); setThemeMenuOpen(false); }}><Monitor size={16} /><span>跟随系统</span><small>{systemDark ? '当前深色' : '当前浅色'}</small></button>
              </div>}
            </div>
            <button className="quick-add icon-button" type="button" onClick={() => openTransaction()} aria-label="记一笔" title="记一笔"><Plus size={20} /></button>
          </div>
        </header>
        {isDemo && view !== 'settings' && <div className="demo-banner"><span>当前显示演示数据，可以放心体验所有功能。</span><button type="button" onClick={() => navigate('settings')}>开始使用自己的数据</button></div>}
        <div className="content-area">
          {view === 'dashboard' && <Dashboard data={data} month={month} onAddTransaction={() => openTransaction()} onSnapshot={() => setSnapshotModal(true)} onNavigate={navigate} />}
          {view === 'transactions' && <Transactions data={data} month={month} onAdd={() => openTransaction()} onEdit={openTransaction} onDelete={deleteTransaction} onExport={() => exportTransactionsCsv(data)} />}
          {view === 'import' && <PdfImport accounts={data.accounts} onImport={importTransactions} />}
          {view === 'budgets' && <Budgets data={data} month={month} onChange={(budgets) => setData((current) => ({ ...current, budgets }))} />}
          {view === 'assets' && <Assets data={data} onAddAccount={() => openAccount()} onEditAccount={openAccount} onDeleteAccount={deleteAccount} onAddInvestment={() => openInvestment()} onEditInvestment={openInvestment} onDeleteInvestment={deleteInvestment} />}
          {view === 'analysis' && <Analysis data={data} month={month} />}
          {view === 'settings' && <SettingsView data={data} isDemo={isDemo} onImport={(next: AppData) => replaceData(normalizeAppData(next), false)} onResetEmpty={resetEmpty} onResetDemo={resetDemo} />}
        </div>
      </main>

      <Modal key={`transaction-${editingTransaction?.id ?? 'new'}-${transactionType}`} open={transactionModal} title={editingTransaction ? '编辑流水' : '记录一笔'} description="保存后会同步调整所选资产账户余额。" submitLabel={editingTransaction ? '保存修改' : '添加流水'} onClose={() => setTransactionModal(false)} onSubmit={saveTransaction}>
        <div className="segmented form-segmented"><button type="button" className={transactionType === 'expense' ? 'active' : ''} onClick={() => setTransactionType('expense')}>支出</button><button type="button" className={transactionType === 'income' ? 'active' : ''} onClick={() => setTransactionType('income')}>收入</button></div>
        <input type="hidden" name="type" value={transactionType} />
        <div className="form-grid">
          <label className="field full"><span>金额</span><div className="money-input"><span>{currencySymbol(data.accounts.find((item) => item.id === transactionAccountId)?.currency)}</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue={editingTransaction?.amount ?? ''} placeholder="0.00" autoFocus required /></div></label>
          <label className="field"><span>日期</span><input name="date" type="date" defaultValue={editingTransaction?.date ?? transactionDate} required /></label>
          <label className="field"><span>分类</span><select name="category" defaultValue={editingTransaction?.category ?? (transactionType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])}>{(transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>交易对象</span><input name="merchant" defaultValue={editingTransaction?.merchant ?? ''} placeholder={transactionType === 'income' ? '例如：公司薪资' : '例如：超市、房东'} required /></label>
          <label className="field"><span>账户</span><select name="accountId" value={transactionAccountId} onChange={(event) => setTransactionAccountId(event.target.value)}><option value="">未指定账户</option>{data.accounts.filter((item) => item.kind === 'asset').map((item) => <option value={item.id} key={item.id}>{item.name}（{item.currency === 'USD' ? '美元' : '人民币'}）</option>)}</select></label>
          <label className="field full"><span>备注（可选）</span><input name="note" defaultValue={editingTransaction?.note ?? ''} placeholder="补充说明" /></label>
        </div>
      </Modal>

      <Modal key={`account-${editingAccount?.id ?? 'new'}`} open={accountModal} title={editingAccount ? '编辑账户' : '添加账户'} description="余额按账户原币种保存，汇总时统一换算为人民币。" submitLabel={editingAccount ? '保存修改' : '添加账户'} onClose={() => setAccountModal(false)} onSubmit={saveAccount}>
        <div className="form-grid">
          <label className="field full"><span>账户名称</span><input name="name" defaultValue={editingAccount?.name ?? ''} placeholder="例如：工资卡" autoFocus required /></label>
          <label className="field"><span>账户类型</span><select name="kind" defaultValue={editingAccount?.kind ?? 'asset'}><option value="asset">资产账户</option><option value="liability">负债账户</option></select></label>
          <label className="field"><span>当前余额</span><input name="balance" type="number" min="0" step="0.01" defaultValue={editingAccount?.balance ?? ''} placeholder="0.00" required /></label>
          <label className="field"><span>账户货币</span><select name="currency" value={accountCurrency} onChange={(event) => setAccountCurrency(event.target.value as Currency)}><option value="CNY">人民币（CNY）</option><option value="USD">美元（USD）</option></select></label>
          {accountCurrency === 'USD' && <label className="field"><span>美元兑人民币</span><input name="exchangeRateToCny" type="number" min="0.0001" step="0.0001" defaultValue={editingAccount?.currency === 'USD' ? editingAccount.exchangeRateToCny ?? 7.2 : 7.2} required /><small>1 美元 = 多少人民币</small></label>}
          <label className="field full color-field"><span>标记颜色</span><input name="color" type="color" defaultValue={editingAccount?.color ?? '#3d6b5a'} /></label>
        </div>
      </Modal>

      <Modal key={`investment-${editingInvestment?.id ?? 'new'}`} open={investmentModal} title={editingInvestment ? '编辑投资持仓' : '添加投资持仓'} description="市值和收益会根据份额、成本价与现价自动计算。" submitLabel={editingInvestment ? '保存修改' : '添加持仓'} onClose={() => setInvestmentModal(false)} onSubmit={saveInvestment}>
        <div className="form-grid">
          <label className="field"><span>资产名称</span><input name="name" defaultValue={editingInvestment?.name ?? ''} placeholder="例如：沪深300指数" autoFocus required /></label>
          <label className="field"><span>代码（可选）</span><input name="symbol" defaultValue={editingInvestment?.symbol ?? ''} placeholder="000300" /></label>
          <label className="field"><span>资产类型</span><select name="type" defaultValue={editingInvestment?.type ?? 'fund'}><option value="fund">基金 / ETF</option><option value="stock">股票</option><option value="bond">债券</option><option value="cash">现金理财</option><option value="other">其他</option></select></label>
          <label className="field"><span>份额</span><input name="units" type="number" min="0" step="0.0001" defaultValue={editingInvestment?.units ?? ''} required /></label>
          <label className="field"><span>平均成本价</span><input name="averageCost" type="number" min="0" step="0.0001" defaultValue={editingInvestment?.averageCost ?? ''} required /></label>
          <label className="field"><span>当前价格</span><input name="currentPrice" type="number" min="0" step="0.0001" defaultValue={editingInvestment?.currentPrice ?? ''} required /></label>
          <label className="field full"><span>价格更新日期</span><input name="updatedAt" type="date" defaultValue={editingInvestment?.updatedAt ?? new Date().toISOString().slice(0, 10)} required /></label>
        </div>
      </Modal>

      <Modal key={`snapshot-${month}`} open={snapshotModal} title="更新月度快照" description="记录月末资产和负债，用于追踪长期净资产变化。" submitLabel="保存月报" onClose={() => setSnapshotModal(false)} onSubmit={saveSnapshot}>
        <div className="snapshot-month"><span>复盘月份</span><strong>{month}</strong></div>
        <div className="form-grid">
          <label className="field"><span>总资产</span><input name="assets" type="number" min="0" step="0.01" defaultValue={currentSnapshot?.assets ?? totals.assets} required /></label>
          <label className="field"><span>总负债</span><input name="liabilities" type="number" min="0" step="0.01" defaultValue={currentSnapshot?.liabilities ?? totals.liabilities} required /></label>
          <label className="field full"><span>本月备注（可选）</span><textarea name="note" defaultValue={currentSnapshot?.note ?? ''} placeholder="例如：奖金到账、旅行支出较高、调整了投资配置" rows={3} /></label>
        </div>
      </Modal>
    </div>
  );
}
