export type TransactionType = 'income' | 'expense';
export type AccountKind = 'asset' | 'liability';
export type Currency = 'CNY' | 'USD';
export type InvestmentType = 'fund' | 'stock' | 'bond' | 'cash' | 'other';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  accountId: string;
  merchant: string;
  note: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  color: string;
  /** Currency used for the account balance and its transactions. Old backups omit this and default to CNY. */
  currency?: Currency;
  /** Conversion rate from one unit of the account currency to CNY. */
  exchangeRateToCny?: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  amount: number;
}

export interface Investment {
  id: string;
  name: string;
  symbol: string;
  type: InvestmentType;
  units: number;
  averageCost: number;
  currentPrice: number;
  updatedAt: string;
}

export interface MonthlySnapshot {
  id: string;
  month: string;
  assets: number;
  liabilities: number;
  note: string;
}

export interface AppData {
  version: 1;
  profile: {
    name: string;
    currency: 'CNY';
  };
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  investments: Investment[];
  snapshots: MonthlySnapshot[];
}

export type ViewId = 'dashboard' | 'transactions' | 'import' | 'budgets' | 'assets' | 'analysis' | 'settings';
