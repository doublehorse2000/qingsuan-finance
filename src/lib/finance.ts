import type { AppData, Currency, Investment, Transaction } from '../types';

export const currencySymbol = (currency: Currency = 'CNY') => currency === 'USD' ? '$' : '¥';

export const formatMoney = (value: number, compact = false, currency: Currency = 'CNY') => new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency,
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: compact ? 0 : 2,
  notation: compact ? 'compact' : 'standard',
}).format(Number.isFinite(value) ? value : 0);

export const getAccountCurrency = (account: { currency?: Currency } | undefined): Currency => account?.currency === 'USD' ? 'USD' : 'CNY';

export const getAccountExchangeRate = (account: { currency?: Currency; exchangeRateToCny?: number } | undefined) => {
  if (getAccountCurrency(account) === 'CNY') return 1;
  return account?.exchangeRateToCny && account.exchangeRateToCny > 0 ? account.exchangeRateToCny : 7.2;
};

export const getTransactionAmountInBase = (data: AppData, transaction: Pick<Transaction, 'amount' | 'accountId'>) => {
  const account = data.accounts.find((item) => item.id === transaction.accountId);
  return transaction.amount * getAccountExchangeRate(account);
};

export const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;

export const investmentValue = (item: Investment) => item.units * item.currentPrice;
export const investmentCost = (item: Investment) => item.units * item.averageCost;
export const investmentValueInCny = (item: Investment, usdToCny: number) => investmentValue(item) * (item.currency === 'USD' ? usdToCny : 1);
export const investmentCostInCny = (item: Investment, usdToCny: number) => investmentCost(item) * (item.currency === 'USD' ? usdToCny : 1);

export const getCurrentNetWorth = (data: AppData) => {
  const assets = data.accounts.filter((item) => item.kind === 'asset').reduce((sum, item) => sum + item.balance * getAccountExchangeRate(item), 0);
  const liabilities = data.accounts.filter((item) => item.kind === 'liability').reduce((sum, item) => sum + item.balance * getAccountExchangeRate(item), 0);
  const investments = data.investments.reduce((sum, item) => sum + investmentValueInCny(item, data.profile.usdToCny ?? 7.2), 0);
  return { assets: assets + investments, liabilities, netWorth: assets + investments - liabilities, investments };
};

export const getMonthTransactions = (transactions: Transaction[], month: string) =>
  transactions.filter((item) => item.date.startsWith(month));

/** Investment purchases reduce the linked account balance but are not consumption expenses. */
export const isInvestmentTransaction = (transaction: Pick<Transaction, 'category'>) => transaction.category === '投资支出';

export const getMonthSummary = (data: AppData, month: string) => {
  const transactions = getMonthTransactions(data.transactions, month);
  const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + getTransactionAmountInBase(data, item), 0);
  const expense = transactions.filter((item) => item.type === 'expense' && !isInvestmentTransaction(item)).reduce((sum, item) => sum + getTransactionAmountInBase(data, item), 0);
  return {
    transactions,
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
  };
};

export const getCategorySpending = (data: AppData, month: string) => {
  const totals = new Map<string, number>();
  getMonthTransactions(data.transactions, month)
    .filter((item) => item.type === 'expense' && !isInvestmentTransaction(item))
    .forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + getTransactionAmountInBase(data, item)));
  return Array.from(totals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export const getBudgetStatus = (data: AppData, month: string) => {
  const spending = new Map(getCategorySpending(data, month).map((item) => [item.name, item.value]));
  return data.budgets
    .filter((item) => item.month === month)
    .map((item) => ({ ...item, spent: spending.get(item.category) ?? 0, ratio: item.amount > 0 ? (spending.get(item.category) ?? 0) / item.amount : 0 }))
    .sort((a, b) => b.ratio - a.ratio);
};

export const getMonthlyTrend = (data: AppData, endMonth: string, count = 6) => {
  const [year, month] = endMonth.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - count + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const summary = getMonthSummary(data, key);
    return { month: `${date.getMonth() + 1}月`, key, income: summary.income, expense: summary.expense, balance: summary.balance };
  });
};

export const getNetWorthTrend = (data: AppData) => {
  const snapshots = [...data.snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({ month: `${Number(item.month.slice(5))}月`, key: item.month, netWorth: item.assets - item.liabilities }));
  const current = getCurrentNetWorth(data);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const withoutCurrent = snapshots.filter((item) => item.key !== currentMonth);
  return [...withoutCurrent, { month: `${new Date().getMonth() + 1}月`, key: currentMonth, netWorth: current.netWorth }].slice(-6);
};

export const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
