import { AlertTriangle, CheckCircle2, Copy, Plus, Target } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '../data';
import { formatMoney, formatPercent, getBudgetStatus, getMonthSummary, makeId } from '../lib/finance';
import type { AppData, Budget } from '../types';

interface BudgetsProps {
  data: AppData;
  month: string;
  onChange: (budgets: Budget[]) => void;
}

export function Budgets({ data, month, onChange }: BudgetsProps) {
  const budgets = getBudgetStatus(data, month);
  const summary = getMonthSummary(data, month);
  const total = budgets.reduce((sum, item) => sum + item.amount, 0);
  const remaining = total - summary.expense;
  const overCount = budgets.filter((item) => item.ratio > 1).length;

  const updateBudget = (id: string, amount: number) => onChange(data.budgets.map((item) => item.id === id ? { ...item, amount: Math.max(0, amount) } : item));
  const addCategory = () => {
    const existing = new Set(budgets.map((item) => item.category));
    const category = EXPENSE_CATEGORIES.find((item) => !existing.has(item));
    if (!category) return;
    onChange([...data.budgets, { id: makeId(), month, category, amount: 500 }]);
  };
  const copyPrevious = () => {
    const [year, value] = month.split('-').map(Number);
    const date = new Date(year, value - 2, 1);
    const previousMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const previous = data.budgets.filter((item) => item.month === previousMonth);
    const source = previous.length ? previous : data.budgets.filter((item) => item.month !== month).slice(-EXPENSE_CATEGORIES.length);
    if (!source.length) return;
    const withoutCurrent = data.budgets.filter((item) => item.month !== month);
    onChange([...withoutCurrent, ...source.map((item) => ({ ...item, id: makeId(), month }))]);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">花钱有计划</p><h1>分类预算</h1><p>给每一类支出设定边界，并及时处理超支。</p></div>
        <div className="heading-actions">
          <button className="button secondary" type="button" onClick={copyPrevious}><Copy size={17} /> 复制上月</button>
          <button className="button primary" type="button" onClick={addCategory} disabled={budgets.length >= EXPENSE_CATEGORIES.length}><Plus size={17} /> 添加分类</button>
        </div>
      </div>

      <section className="strip-metrics budget-strip">
        <div><span>本月总预算</span><strong>{formatMoney(total)}</strong></div>
        <div><span>已经支出</span><strong>{formatMoney(summary.expense)}</strong></div>
        <div><span>剩余额度</span><strong className={remaining >= 0 ? 'positive' : 'negative'}>{formatMoney(remaining)}</strong></div>
        <div><span>超支分类</span><strong className={overCount ? 'negative' : 'positive'}>{overCount} 个</strong></div>
      </section>

      {budgets.length ? <section className="budget-cards">
        {budgets.map((item) => {
          const state = item.ratio > 1 ? 'over' : item.ratio > .8 ? 'warning' : 'healthy';
          return (
            <article className="budget-card" key={item.id}>
              <div className="budget-card-head">
                <div className={`budget-icon ${state}`}>{state === 'over' ? <AlertTriangle size={19} /> : state === 'healthy' ? <CheckCircle2 size={19} /> : <Target size={19} />}</div>
                <div><h2>{item.category}</h2><span>{state === 'over' ? '已超出预算' : state === 'warning' ? '接近预算上限' : '支出正常'}</span></div>
                <strong>{formatPercent(item.ratio * 100)}</strong>
              </div>
              <div className="progress large"><i className={state} style={{ width: `${Math.min(item.ratio * 100, 100)}%` }} /></div>
              <div className="budget-values"><span>已用 <strong>{formatMoney(item.spent)}</strong></span><span>剩余 <strong className={item.amount - item.spent < 0 ? 'negative' : ''}>{formatMoney(item.amount - item.spent)}</strong></span></div>
              <label className="budget-input"><span>预算额度</span><div><span>¥</span><input type="number" min="0" step="100" value={item.amount} onChange={(event) => updateBudget(item.id, Number(event.target.value))} /></div></label>
            </article>
          );
        })}
      </section> : <section className="panel empty-state tall"><Target size={28} /><strong>本月还没有预算</strong><span>可以复制历史预算，或从第一个分类开始设置。</span><button className="button primary" type="button" onClick={addCategory}>设置预算</button></section>}
    </div>
  );
}
