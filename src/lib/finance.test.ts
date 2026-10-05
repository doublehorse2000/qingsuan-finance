import { describe, expect, it } from 'vitest';
import type { AppData } from '../types';
import { getBudgetStatus, getCurrentNetWorth, getMonthSummary, getTransactionAmountInBase, investmentValue } from './finance';

const data: AppData = {
  version: 1,
  profile: { name: '测试', currency: 'CNY' },
  accounts: [
    { id: 'cash', name: '现金', kind: 'asset', balance: 10000, color: '#000000' },
    { id: 'card', name: '信用卡', kind: 'liability', balance: 2000, color: '#000000' },
  ],
  transactions: [
    { id: '1', date: '2026-09-01', type: 'income', amount: 8000, category: '工资', accountId: 'cash', merchant: '工资', note: '' },
    { id: '2', date: '2026-09-02', type: 'expense', amount: 2000, category: '餐饮', accountId: 'cash', merchant: '餐饮', note: '' },
    { id: '3', date: '2026-08-02', type: 'expense', amount: 999, category: '餐饮', accountId: 'cash', merchant: '历史', note: '' },
  ],
  budgets: [{ id: 'b1', month: '2026-09', category: '餐饮', amount: 1500 }],
  investments: [{ id: 'i1', name: '指数基金', symbol: 'TEST', type: 'fund', units: 10, averageCost: 90, currentPrice: 100, updatedAt: '2026-09-01' }],
  snapshots: [],
};

describe('finance calculations', () => {
  it('summarizes only the selected month', () => {
    expect(getMonthSummary(data, '2026-09')).toMatchObject({
      income: 8000,
      expense: 2000,
      balance: 6000,
      savingsRate: 75,
    });
  });

  it('calculates net worth with investments and liabilities', () => {
    expect(investmentValue(data.investments[0])).toBe(1000);
    expect(getCurrentNetWorth(data)).toEqual({
      assets: 11000,
      liabilities: 2000,
      netWorth: 9000,
      investments: 1000,
    });
  });

  it('excludes investment purchases from monthly expenses while retaining them as transactions', () => {
    const withInvestmentPurchase: AppData = {
      ...data,
      transactions: [...data.transactions, { id: 'investment', date: '2026-09-03', type: 'expense', amount: 3000, category: '投资支出', accountId: 'cash', merchant: '基金申购', note: '' }],
    };
    const summary = getMonthSummary(withInvestmentPurchase, '2026-09');
    expect(summary.expense).toBe(2000);
    expect(summary.transactions).toHaveLength(3);
  });

  it('flags budget usage above 100 percent', () => {
    expect(getBudgetStatus(data, '2026-09')[0]).toMatchObject({
      category: '餐饮',
      spent: 2000,
      ratio: 2000 / 1500,
    });
  });

  it('converts foreign account amounts to the base currency for summaries', () => {
    const mixedData: AppData = {
      ...data,
      accounts: [...data.accounts, { id: 'usd', name: '美元账户', kind: 'asset', balance: 100, color: '#000000', currency: 'USD', exchangeRateToCny: 7.2 }],
      transactions: [...data.transactions, { id: 'usd-income', date: '2026-09-03', type: 'income', amount: 10, category: '副业', accountId: 'usd', merchant: '美元收入', note: '' }],
    };
    expect(getTransactionAmountInBase(mixedData, mixedData.transactions.at(-1)!)).toBe(72);
    expect(getMonthSummary(mixedData, '2026-09').income).toBe(8072);
    expect(getCurrentNetWorth(mixedData).assets).toBe(11720);
  });
});
