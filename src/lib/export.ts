import type { AppData } from '../types';
import { getBudgetStatus, getCategorySpending, getCurrentNetWorth, getMonthSummary, getMonthlyTrend, investmentCost, investmentValue } from './finance';

declare global {
  interface Window {
    qingsuanDesktop?: {
      saveFile: (request: { filename: string; content: string; mimeType: string }) => Promise<{ saved: boolean; path?: string }>;
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
    ['日期', '类型', '金额', '分类', '账户', '交易对象', '备注'],
    ...[...data.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => [item.date, item.type === 'income' ? '收入' : '支出', item.amount, item.category, data.accounts.find((account) => account.id === item.accountId)?.name ?? '', item.merchant, item.note]),
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
    accounts: data.accounts.map((item) => ({ name: item.name, kind: item.kind, balance: item.balance })),
    investments: data.investments.map((item) => ({
      name: item.name,
      symbol: item.symbol,
      type: item.type,
      marketValue: investmentValue(item),
      cost: investmentCost(item),
      gain: investmentValue(item) - investmentCost(item),
    })),
    transactions: includeTransactions ? summary.transactions.map(({ id: _id, accountId: _accountId, ...item }) => item) : undefined,
  };
  return payload;
};

export const buildAnalysisPrompt = (data: AppData, month: string, includeTransactions: boolean) => {
  const payload = buildAnalysisPackage(data, month, includeTransactions);
  return `你是一名审慎、非推销导向的个人财务分析助手。请基于下面的数据完成月度复盘：\n\n1. 用 5 句话总结本月财务健康度。\n2. 找出最多 3 个值得关注的变化或风险，并引用具体数字。\n3. 给出下月可执行的预算调整，按优先级排序。\n4. 评价储蓄率、应急资金和负债水平；信息不足时明确说明，不要猜测。\n5. 投资部分只讨论配置、集中度和成本，不预测涨跌，不做具体买卖指令。\n\n财务数据（人民币）：\n${JSON.stringify(payload, null, 2)}`;
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
