import type { TransactionType } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data';

export interface ImportedTransaction {
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  merchant: string;
  note: string;
  currency: 'CNY' | 'USD';
  accountName: string;
  onlineBalance?: number;
}

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
};

const value = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key].trim();
  }
  return '';
};

export const parseQingsuanCsv = (text: string): ImportedTransaction[] => {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('CSV 没有可导入的流水');
  const headers = rows[0].map((header) => header.trim());
  const parsed: ImportedTransaction[] = [];
  for (const cells of rows.slice(1)) {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])) as Record<string, string>;
    const date = value(record, '日期');
    const rawType = value(record, '类型');
    const rawAmount = value(record, '金额', '原始交易金额');
    const amount = Math.abs(Number(rawAmount.replaceAll(',', '')));
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    const type: TransactionType = rawType === '收入' || rawType === 'income' ? 'income' : 'expense';
    const rawCurrency = value(record, '币种', '货币').toUpperCase();
    const currency = rawCurrency === 'USD' || rawCurrency.includes('美元') ? 'USD' : 'CNY';
    const onlineBalance = Number(value(record, '联机余额').replaceAll(',', ''));
    const rawCategory = value(record, '分类');
    const allowedCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    parsed.push({
      date,
      type,
      amount,
      category: allowedCategories.includes(rawCategory) ? rawCategory : (type === 'income' ? '其他收入' : '其他'),
      merchant: value(record, '交易对象', '对手信息') || '未命名交易',
      note: value(record, '备注', '交易摘要'),
      currency,
      accountName: value(record, '账户') || '导入账户',
      onlineBalance: Number.isFinite(onlineBalance) ? onlineBalance : undefined,
    });
  }
  if (!parsed.length) throw new Error('CSV 中没有有效流水，请确认列包含日期和金额');
  return parsed;
};
