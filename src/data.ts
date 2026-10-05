import type { AppData } from './types';

const isoMonth = new Date().toISOString().slice(0, 7);
const [year, month] = isoMonth.split('-').map(Number);
const monthKey = (offset: number) => {
  const value = new Date(year, month - 1 + offset, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};
const dateInMonth = (offset: number, day: number) => `${monthKey(offset)}-${String(day).padStart(2, '0')}`;

export const EXPENSE_CATEGORIES = ['餐饮', '居住', '交通', '购物', '健康', '学习', '娱乐', '人情', '投资支出', '其他'];
export const INCOME_CATEGORIES = ['工资', '奖金', '投资收益', '副业', '其他收入'];
export const CATEGORY_COLORS: Record<string, string> = {
  '餐饮': '#e07a5f',
  '居住': '#3d6b5a',
  '交通': '#4d7c8a',
  '购物': '#d6a84b',
  '健康': '#c65f6a',
  '学习': '#6874a8',
  '娱乐': '#8a6f9e',
  '人情': '#b17a53',
  '投资支出': '#5f7fce',
  '其他': '#7b8580',
};

const transactions: AppData['transactions'] = [
  { id: 't01', date: dateInMonth(0, 5), type: 'income', amount: 18500, category: '工资', accountId: 'a1', merchant: '公司薪资', note: '' },
  { id: 't02', date: dateInMonth(0, 6), type: 'expense', amount: 4200, category: '居住', accountId: 'a1', merchant: '房租', note: '本月房租' },
  { id: 't03', date: dateInMonth(0, 7), type: 'expense', amount: 386, category: '餐饮', accountId: 'a2', merchant: '超市', note: '日常采购' },
  { id: 't04', date: dateInMonth(0, 9), type: 'expense', amount: 168, category: '交通', accountId: 'a2', merchant: '交通卡', note: '' },
  { id: 't05', date: dateInMonth(0, 12), type: 'expense', amount: 799, category: '购物', accountId: 'a2', merchant: '家居用品', note: '' },
  { id: 't06', date: dateInMonth(0, 15), type: 'expense', amount: 258, category: '学习', accountId: 'a2', merchant: '在线课程', note: '' },
  { id: 't07', date: dateInMonth(0, 18), type: 'expense', amount: 520, category: '娱乐', accountId: 'a2', merchant: '周末出游', note: '' },
  { id: 't08', date: dateInMonth(-1, 5), type: 'income', amount: 18500, category: '工资', accountId: 'a1', merchant: '公司薪资', note: '' },
  { id: 't09', date: dateInMonth(-1, 6), type: 'expense', amount: 4200, category: '居住', accountId: 'a1', merchant: '房租', note: '' },
  { id: 't10', date: dateInMonth(-1, 14), type: 'expense', amount: 1860, category: '餐饮', accountId: 'a2', merchant: '日常餐饮', note: '' },
  { id: 't11', date: dateInMonth(-1, 20), type: 'expense', amount: 980, category: '购物', accountId: 'a2', merchant: '换季服装', note: '' },
  { id: 't12', date: dateInMonth(-2, 5), type: 'income', amount: 18500, category: '工资', accountId: 'a1', merchant: '公司薪资', note: '' },
  { id: 't13', date: dateInMonth(-2, 6), type: 'expense', amount: 4200, category: '居住', accountId: 'a1', merchant: '房租', note: '' },
  { id: 't14', date: dateInMonth(-2, 22), type: 'expense', amount: 3600, category: '娱乐', accountId: 'a2', merchant: '旅行', note: '短途旅行' },
];

export const createDemoData = (): AppData => ({
  version: 1,
  profile: { name: '我的财务', currency: 'CNY', usdToCny: 7.2 },
  transactions,
  accounts: [
    { id: 'a1', name: '工资卡', kind: 'asset', balance: 42680, color: '#3d6b5a', currency: 'CNY', exchangeRateToCny: 1 },
    { id: 'a2', name: '日常账户', kind: 'asset', balance: 8640, color: '#d6a84b', currency: 'CNY', exchangeRateToCny: 1 },
    { id: 'a3', name: '现金', kind: 'asset', balance: 1200, color: '#4d7c8a', currency: 'CNY', exchangeRateToCny: 1 },
    { id: 'a4', name: '信用卡', kind: 'liability', balance: 3280, color: '#c65f6a', currency: 'CNY', exchangeRateToCny: 1 },
  ],
  budgets: EXPENSE_CATEGORIES.filter((category) => category !== '其他').map((category, index) => ({
    id: `b${index + 1}`,
    month: isoMonth,
    category,
    amount: [2200, 4500, 600, 1200, 500, 500, 1000, 600, 3000][index],
  })),
  investments: [
    { id: 'i1', name: '沪深300指数', symbol: '000300', type: 'fund', units: 6.8, averageCost: 4200, currentPrice: 4380, updatedAt: new Date().toISOString().slice(0, 10) },
    { id: 'i2', name: '中债综合指数', symbol: 'CBA00101', type: 'bond', units: 120, averageCost: 101.2, currentPrice: 103.1, updatedAt: new Date().toISOString().slice(0, 10) },
    { id: 'i3', name: '黄金ETF', symbol: '518880', type: 'fund', units: 1200, averageCost: 4.82, currentPrice: 5.16, updatedAt: new Date().toISOString().slice(0, 10) },
  ],
  snapshots: [-5, -4, -3, -2, -1].map((offset, index) => ({
    id: `s${index + 1}`,
    month: monthKey(offset),
    assets: [112000, 116500, 121800, 125200, 132400][index],
    liabilities: [5200, 4800, 4600, 4100, 3600][index],
    note: '',
  })),
});

export const createEmptyData = (): AppData => ({
  version: 1,
  profile: { name: '我的财务', currency: 'CNY', usdToCny: 7.2 },
  transactions: [],
  accounts: [],
  budgets: [],
  investments: [],
  snapshots: [],
});
