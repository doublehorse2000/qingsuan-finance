import { ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, Plus, Scale, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY_COLORS } from '../data';
import { formatMoney, formatPercent, getBudgetStatus, getCategorySpending, getCurrentNetWorth, getMonthSummary, getMonthlyTrend, getNetWorthTrend } from '../lib/finance';
import type { AppData } from '../types';

interface DashboardProps {
  data: AppData;
  month: string;
  onAddTransaction: () => void;
  onSnapshot: () => void;
  onNavigate: (view: 'transactions' | 'budgets') => void;
}

const moneyTick = (value: number) => `${Math.round(value / 1000)}k`;

export function Dashboard({ data, month, onAddTransaction, onSnapshot, onNavigate }: DashboardProps) {
  const summary = getMonthSummary(data, month);
  const netWorth = getCurrentNetWorth(data);
  const spending = getCategorySpending(data, month);
  const budgets = getBudgetStatus(data, month);
  const trend = getMonthlyTrend(data, month);
  const netWorthTrend = getNetWorthTrend(data);
  const recent = [...summary.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const previous = trend.at(-2);
  const expenseChange = previous?.expense ? ((summary.expense - previous.expense) / previous.expense) * 100 : 0;
  const totalBudget = budgets.reduce((sum, item) => sum + item.amount, 0);
  const budgetUsage = totalBudget > 0 ? (summary.expense / totalBudget) * 100 : 0;

  return (
    <div className="page-stack">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">月度总览</p>
          <h1>财务仪表盘</h1>
          <p>掌握现金流、预算执行和资产变化。</p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" type="button" onClick={onSnapshot}><Scale size={17} /> 更新月报</button>
          <button className="button primary" type="button" onClick={onAddTransaction}><Plus size={17} /> 记一笔</button>
        </div>
      </div>

      <section className="metrics-grid" aria-label="关键财务指标">
        <article className="metric-card featured">
          <div className="metric-top"><span>当前净资产</span><span className="metric-icon"><Landmark size={18} /></span></div>
          <strong>{formatMoney(netWorth.netWorth)}</strong>
          <small>总资产 {formatMoney(netWorth.assets, true)} · 负债 {formatMoney(netWorth.liabilities, true)}</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>本月收入</span><span className="metric-icon income"><ArrowUpRight size={18} /></span></div>
          <strong>{formatMoney(summary.income)}</strong>
          <small>共 {summary.transactions.filter((item) => item.type === 'income').length} 笔收入</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>本月支出</span><span className="metric-icon expense"><ArrowDownRight size={18} /></span></div>
          <strong>{formatMoney(summary.expense)}</strong>
          <small className={expenseChange > 0 ? 'negative' : 'positive'}>较上月 {expenseChange >= 0 ? '+' : ''}{formatPercent(expenseChange)}</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>储蓄率</span><span className="metric-icon saving"><PiggyBank size={18} /></span></div>
          <strong>{formatPercent(summary.savingsRate)}</strong>
          <small>本月结余 {formatMoney(summary.balance, true)}</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel chart-panel wide-panel">
          <div className="panel-header">
            <div><h2>现金流趋势</h2><p>近 6 个月收入与支出</p></div>
            <div className="legend-inline"><span><i className="dot income-dot" />收入</span><span><i className="dot expense-dot" />支出</span></div>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 12, right: 6, bottom: 0, left: -18 }} barGap={7}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#69736d', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={moneyTick} tick={{ fill: '#8a928e', fontSize: 11 }} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 6, border: '1px solid var(--line)', backgroundColor: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 8px 24px rgba(18, 30, 23, .08)' }} />
                <Bar dataKey="income" name="收入" fill="#3d6b5a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill="#d6a84b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-header"><div><h2>支出去向</h2><p>本月分类占比</p></div></div>
          {spending.length ? (
            <>
              <div className="donut-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spending} dataKey="value" nameKey="name" innerRadius={57} outerRadius={83} paddingAngle={2} stroke="none">
                      {spending.map((item) => <Cell key={item.name} fill={CATEGORY_COLORS[item.name] ?? '#7b8580'} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><span>总支出</span><strong>{formatMoney(summary.expense, true)}</strong></div>
              </div>
              <div className="category-legend">
                {spending.slice(0, 4).map((item) => (
                  <div key={item.name}><span><i className="dot" style={{ background: CATEGORY_COLORS[item.name] ?? '#7b8580' }} />{item.name}</span><strong>{formatMoney(item.value, true)}</strong></div>
                ))}
              </div>
            </>
          ) : <div className="empty-inline">本月还没有支出记录</div>}
        </section>

        <section className="panel chart-panel wide-panel">
          <div className="panel-header"><div><h2>净资产变化</h2><p>月末资产减去负债</p></div><span className="status-chip">本地记录</span></div>
          <div className="chart-frame short">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorthTrend} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#69736d', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={moneyTick} tick={{ fill: '#8a928e', fontSize: 11 }} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line type="monotone" dataKey="netWorth" name="净资产" stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel budget-panel">
          <div className="panel-header"><div><h2>预算执行</h2><p>{formatPercent(budgetUsage)} 已使用</p></div><button className="text-button" type="button" onClick={() => onNavigate('budgets')}>查看全部</button></div>
          <div className="budget-summary"><strong>{formatMoney(summary.expense, true)}</strong><span>/ {formatMoney(totalBudget, true)}</span></div>
          <div className="budget-list compact">
            {budgets.slice(0, 4).map((item) => (
              <div className="budget-row" key={item.id}>
                <div className="budget-row-head"><span>{item.category}</span><span>{formatPercent(item.ratio * 100)}</span></div>
                <div className="progress"><i className={item.ratio > 1 ? 'over' : item.ratio > .8 ? 'warning' : ''} style={{ width: `${Math.min(item.ratio * 100, 100)}%` }} /></div>
              </div>
            ))}
            {!budgets.length && <div className="empty-inline">还没有为本月设置预算</div>}
          </div>
        </section>
      </div>

      <section className="panel transactions-preview">
        <div className="panel-header"><div><h2>最近流水</h2><p>本月最新记录</p></div><button className="text-button" type="button" onClick={() => onNavigate('transactions')}>全部流水</button></div>
        {recent.length ? <div className="transaction-list">
          {recent.map((item) => (
            <div className="transaction-item" key={item.id}>
              <span className={`transaction-symbol ${item.type}`}><WalletCards size={18} /></span>
              <div className="transaction-main"><strong>{item.merchant || item.category}</strong><span>{item.category} · {item.date.slice(5).replace('-', '月')}日</span></div>
              <strong className={item.type === 'income' ? 'positive' : ''}>{item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}</strong>
            </div>
          ))}
        </div> : <div className="empty-state"><WalletCards size={24} /><strong>本月还没有流水</strong><button className="button secondary" type="button" onClick={onAddTransaction}>记录第一笔</button></div>}
      </section>
    </div>
  );
}
