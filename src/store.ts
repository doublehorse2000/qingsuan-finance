import { useEffect, useState } from 'react';
import { createDemoData, createEmptyData } from './data';
import { storage } from './lib/storage';
import type { AppData, Currency } from './types';

const STORAGE_KEY = 'qingsuan.finance.v1';
const DEMO_KEY = 'qingsuan.finance.isDemo';

export const normalizeAppData = (data: AppData): AppData => ({
  ...data,
  accounts: data.accounts.map((account) => ({
    ...account,
    currency: (account.currency === 'USD' ? 'USD' : 'CNY') as Currency,
    exchangeRateToCny: account.currency === 'USD'
      ? (account.exchangeRateToCny && account.exchangeRateToCny > 0 ? account.exchangeRateToCny : 7.2)
      : 1,
  })),
});

const isAppData = (value: unknown): value is AppData => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<AppData>;
  return data.version === 1
    && Array.isArray(data.transactions)
    && Array.isArray(data.accounts)
    && Array.isArray(data.budgets)
    && Array.isArray(data.investments)
    && Array.isArray(data.snapshots);
};

const loadData = () => {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isAppData(parsed)) return normalizeAppData(parsed);
    }
  } catch {
    // Invalid local data falls back to a known-good demo dataset.
  }
  const demo = createDemoData();
  storage.setItem(STORAGE_KEY, JSON.stringify(demo));
  storage.setItem(DEMO_KEY, 'true');
  return demo;
};

export const useFinanceData = () => {
  const [data, setData] = useState<AppData>(loadData);
  const [isDemo, setIsDemo] = useState(() => storage.getItem(DEMO_KEY) !== 'false');

  useEffect(() => {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const replaceData = (next: AppData, demo = false) => {
    setData(next);
    setIsDemo(demo);
    storage.setItem(DEMO_KEY, String(demo));
  };

  return {
    data,
    setData,
    isDemo,
    replaceData,
    resetEmpty: () => replaceData(createEmptyData(), false),
    resetDemo: () => replaceData(createDemoData(), true),
  };
};
