import { describe, expect, it } from 'vitest';
import type { AppData } from '../types';
import { getBudgetStatus, getCurrentNetWorth, getMonthSummary, investmentValue } from './finance';

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

  it('flags budget usage above 100 percent', () => {
    expect(getBudgetStatus(data, '2026-09')[0]).toMatchObject({
      category: '餐饮',
      spent: 2000,
      ratio: 2000 / 1500,
    });
  });
});
