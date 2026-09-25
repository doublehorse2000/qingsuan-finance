import { Download, Pencil, Plus, Search, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney, getMonthSummary } from '../lib/finance';
import type { AppData, Transaction } from '../types';

interface TransactionsProps {
  data: AppData;
  month: string;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onExport: () => void;
}

export function Transactions({ data, month, onAdd, onEdit, onDelete, onExport }: TransactionsProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [category, setCategory] = useState('all');
  const [monthFilter, setMonthFilter] = useState(month);
  useEffect(() => {
    if (monthFilter !== 'all') setMonthFilter(month);
  }, [month]);

  const availableMonths = useMemo(() => [...new Set([month, ...data.transactions.map((item) => item.date.slice(0, 7))])].sort((a, b) => b.localeCompare(a)), [data.transactions, month]);
  const visibleTransactions = useMemo(() => monthFilter === 'all'
    ? data.transactions
    : getMonthSummary(data, monthFilter).transactions, [data, monthFilter]);
  const visibleSummary = useMemo(() => {
    const income = visibleTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expense = visibleTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    return { income, expense, balance: income - expense };
  }, [visibleTransactions]);
  const categories = [...new Set(visibleTransactions.map((item) => item.category))];
  const filtered = useMemo(() => visibleTransactions
    .filter((item) => type === 'all' || item.type === type)
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => `${item.merchant} ${item.note} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [visibleTransactions, type, category, query]);
  const scopeLabel = monthFilter === 'all' ? '全部月份' : monthFilter;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">日常记账</p><h1>收支流水</h1><p>查找、核对并维护每一笔资金变化，历史记录也可以一次性检索。</p></div>
        <div className="heading-actions">
          <button className="button secondary" type="button" onClick={onExport}><Download size={17} /> 导出 CSV</button>
          <button className="button primary" type="button" onClick={onAdd}><Plus size={17} /> 记一笔</button>
        </div>
      </div>

      <section className="strip-metrics">
        <div><span>{monthFilter === 'all' ? '累计收入' : '本月收入'}</span><strong className="positive">{formatMoney(visibleSummary.income)}</strong></div>
        <div><span>{monthFilter === 'all' ? '累计支出' : '本月支出'}</span><strong>{formatMoney(visibleSummary.expense)}</strong></div>
        <div><span>{monthFilter === 'all' ? '累计结余' : '现金结余'}</span><strong className={visibleSummary.balance >= 0 ? 'positive' : 'negative'}>{formatMoney(visibleSummary.balance)}</strong></div>
        <div><span>{scopeLabel}流水</span><strong>{visibleTransactions.length} 笔</strong></div>
      </section>

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索交易对象、备注或分类" /></label>
          <div className="filter-row">
            <select className="month-filter" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} aria-label="筛选月份">
              <option value="all">全部月份</option>
              {availableMonths.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="segmented" aria-label="交易类型">
              {(['all', 'expense', 'income'] as const).map((value) => <button type="button" className={type === value ? 'active' : ''} onClick={() => setType(value)} key={value}>{value === 'all' ? '全部' : value === 'expense' ? '支出' : '收入'}</button>)}
            </div>
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="筛选分类">
              <option value="all">全部分类</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>日期</th><th>交易对象</th><th>分类</th><th>账户</th><th className="amount-cell">金额</th><th aria-label="操作" /></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="muted-cell">{item.date}</td>
                    <td><div className="table-title"><strong>{item.merchant || item.category}</strong>{item.note && <span>{item.note}</span>}</div></td>
                    <td><span className="category-chip">{item.category}</span></td>
                    <td className="muted-cell">{data.accounts.find((account) => account.id === item.accountId)?.name ?? '未指定'}</td>
                    <td className={`amount-cell ${item.type === 'income' ? 'positive' : ''}`}><strong>{item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}</strong></td>
                    <td><div className="row-actions">
                      <button className="icon-button small" type="button" onClick={() => onEdit(item)} aria-label="编辑流水" title="编辑"><Pencil size={16} /></button>
                      <button className="icon-button small danger" type="button" onClick={() => onDelete(item)} aria-label="删除流水" title="删除"><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><WalletCards size={26} /><strong>没有符合条件的流水</strong><span>更换月份或筛选条件，或记录一笔新交易。</span><button className="button secondary" type="button" onClick={onAdd}>新增流水</button></div>}
      </section>
    </div>
  );
}
