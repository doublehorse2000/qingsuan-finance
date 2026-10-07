import type { AppData } from '../types';
import { getBudgetStatus, getCategorySpending, getCurrentNetWorth, getMonthSummary, getMonthlyTrend, getAccountExchangeRate, getAccountCurrency, investmentCost, investmentCostInCny, investmentValue, investmentValueInCny } from './finance';

declare global {
  interface Window {
    qingsuanDesktop?: {
      saveFile: (request: { filename: string; content: string; mimeType: string }) => Promise<{ saved: boolean; path?: string }>;
      convertPdf: (request: { provider: 'ollama' | 'openai'; url: string; apiKey: string; model: string; timeout: number }) => Promise<{ csv: string; filename: string }>;
    };
  }
}

const download = async (filename: string, content: string, type: string) => {
  if (window.qingsuanDesktop) {
    await window.qingsuanDesktop.saveFile({ filename, content, mimeType: type });
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export const exportTransactionsCsv = async (data: AppData) => {
  const rows = [
    ['日期', '类型', '金额', '货币', '分类', '账户', '交易对象', '备注'],
    ...[...data.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => {
        const account = data.accounts.find((candidate) => candidate.id === item.accountId);
        return [item.date, item.type === 'income' ? '收入' : '支出', item.amount, account?.currency ?? 'CNY', item.category, account?.name ?? '', item.merchant, item.note];
      }),
  ];
  await download(`qingsuan-transactions-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`, 'text/csv;charset=utf-8');
};

export const exportBackup = async (data: AppData) => {
  await download(`qingsuan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
};

export const buildAnalysisPackage = (data: AppData, month: string, includeTransactions: boolean) => {
  const summary = getMonthSummary(data, month);
  const netWorth = getCurrentNetWorth(data);
  const budgets = getBudgetStatus(data, month);
  const payload = {
    schema: 'qingsuan.finance.analysis.v1',
    generatedAt: new Date().toISOString(),
    currency: data.profile.currency,
    targetMonth: month,
    summary: {
      income: summary.income,
      expense: summary.expense,
      cashFlow: summary.balance,
      savingsRatePercent: Number(summary.savingsRate.toFixed(2)),
      assets: netWorth.assets,
      liabilities: netWorth.liabilities,
      netWorth: netWorth.netWorth,
    },
    categorySpending: getCategorySpending(data, month),
    budgets: budgets.map((item) => ({ category: item.category, budget: item.amount, spent: item.spent, usagePercent: Number((item.ratio * 100).toFixed(1)) })),
    monthlyTrend: getMonthlyTrend(data, month, 6),
    accounts: data.accounts.map((item) => ({ name: item.name, kind: item.kind, balance: item.balance, currency: getAccountCurrency(item), exchangeRateToCny: getAccountExchangeRate(item), balanceInCny: Number((item.balance * getAccountExchangeRate(item)).toFixed(2)) })),
    investments: data.investments.map((item) => ({
      name: item.name,
      symbol: item.symbol || undefined,
      type: item.type,
      currency: item.currency ?? 'CNY',
      units: item.units,
      averageCost: item.averageCost,
      currentPrice: item.currentPrice,
      updatedAt: item.updatedAt,
      marketValue: investmentValue(item),
      marketValueInCny: investmentValueInCny(item, data.profile.usdToCny ?? 7.2),
      cost: investmentCost(item),
      costInCny: investmentCostInCny(item, data.profile.usdToCny ?? 7.2),
      gain: investmentValue(item) - investmentCost(item),
      gainPercent: investmentCost(item) > 0 ? Number((((investmentValue(item) - investmentCost(item)) / investmentCost(item)) * 100).toFixed(2)) : null,
      allocationPercent: netWorth.investments > 0 ? Number(((investmentValueInCny(item, data.profile.usdToCny ?? 7.2) / netWorth.investments) * 100).toFixed(2)) : 0,
    })),
    transactions: includeTransactions ? summary.transactions.map(({ id: _id, accountId, ...item }) => ({
      ...item,
      currency: data.accounts.find((account) => account.id === accountId)?.currency ?? 'CNY',
    })) : undefined,
  };
  return payload;
};

export const buildAnalysisPrompt = (data: AppData, month: string, includeTransactions: boolean) => {
  const payload = buildAnalysisPackage(data, month, includeTransactions);
  return `你是一名审慎、非推销导向的个人财务分析助手。请基于下面的数据完成月度复盘：\n\n1. 用 5 句话总结本月财务健康度。\n2. 找出最多 3 个值得关注的变化或风险，并引用具体数字。\n3. 给出下月可执行的预算调整，按优先级排序。\n4. 评价储蓄率、应急资金、负债水平，以及账户余额与投资市值的流动性结构；信息不足时明确说明，不要猜测。\n5. 单独分析投资持仓：按资产类型和单项持仓说明市值占比、集中度、成本与浮动收益率，指出需要补充的数据。只讨论配置、集中度和成本，不预测涨跌，不做具体买卖指令。\n\n财务数据（汇总金额按人民币，账户和持仓同时保留原币种及人民币折算）：\n${JSON.stringify(payload, null, 2)}`;
};

export const exportAnalysisJson = async (data: AppData, month: string, includeTransactions: boolean) => {
  await download(`qingsuan-ai-${month}.json`, JSON.stringify(buildAnalysisPackage(data, month, includeTransactions), null, 2), 'application/json');
};

export const exportAnalysisMarkdown = async (data: AppData, month: string, includeTransactions: boolean) => {
  await download(`qingsuan-ai-${month}.md`, buildAnalysisPrompt(data, month, includeTransactions), 'text/markdown;charset=utf-8');
};

export const exportAnalysisText = async (data: AppData, month: string, includeTransactions: boolean) => {
  await download(`qingsuan-ai-${month}.txt`, buildAnalysisPrompt(data, month, includeTransactions), 'text/plain;charset=utf-8');
};
