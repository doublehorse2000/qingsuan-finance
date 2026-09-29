import { Banknote, Building2, CircleDollarSign, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney, getAccountCurrency, getCurrentNetWorth, investmentCost, investmentValue } from '../lib/finance';
import type { Account, AppData, Investment } from '../types';

interface AssetsProps {
  data: AppData;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  onAddInvestment: () => void;
  onEditInvestment: (investment: Investment) => void;
  onDeleteInvestment: (investment: Investment) => void;
}

const allocationColors = ['#3d6b5a', '#d6a84b', '#4d7c8a', '#c65f6a', '#8a6f9e', '#7b8580'];

export function Assets({ data, onAddAccount, onEditAccount, onDeleteAccount, onAddInvestment, onEditInvestment, onDeleteInvestment }: AssetsProps) {
  const totals = getCurrentNetWorth(data);
  const investedCost = data.investments.reduce((sum, item) => sum + investmentCost(item), 0);
  const investmentGain = totals.investments - investedCost;
  const allocation = data.investments.map((item) => ({ name: item.name, value: investmentValue(item) })).filter((item) => item.value > 0);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">资产负债表</p><h1>账户与投资</h1><p>统一查看现金、负债和投资组合。</p></div>
        <div className="heading-actions">
          <button className="button secondary" type="button" onClick={onAddAccount}><Plus size={17} /> 添加账户</button>
          <button className="button primary" type="button" onClick={onAddInvestment}><TrendingUp size={17} /> 添加投资</button>
        </div>
      </div>

      <section className="strip-metrics">
        <div><span>净资产（人民币）</span><strong>{formatMoney(totals.netWorth)}</strong></div>
        <div><span>流动资产（人民币）</span><strong>{formatMoney(totals.assets - totals.investments)}</strong></div>
        <div><span>投资市值（人民币）</span><strong>{formatMoney(totals.investments)}</strong></div>
        <div><span>投资浮动收益</span><strong className={investmentGain >= 0 ? 'positive' : 'negative'}>{investmentGain >= 0 ? '+' : ''}{formatMoney(investmentGain)}</strong></div>
      </section>

      <div className="assets-layout">
        <section className="panel accounts-panel">
          <div className="panel-header"><div><h2>账户余额</h2><p>资产与负债分开统计</p></div><button className="icon-button" type="button" onClick={onAddAccount} aria-label="添加账户" title="添加账户"><Plus size={18} /></button></div>
          <div className="account-list">
            {data.accounts.map((account) => (
              <div className="account-item" key={account.id}>
                <span className="account-color" style={{ background: account.color }}>{account.kind === 'asset' ? <Wallet size={18} /> : <CircleDollarSign size={18} />}</span>
                <div><strong>{account.name}</strong><span>{account.kind === 'asset' ? '资产账户' : '负债账户'} · {getAccountCurrency(account)}</span></div>
                <strong className={account.kind === 'liability' ? 'negative' : ''}>{account.kind === 'liability' ? '-' : ''}{formatMoney(account.balance, false, getAccountCurrency(account))}</strong>
                <div className="row-actions">
                  <button className="icon-button small" type="button" onClick={() => onEditAccount(account)} aria-label="编辑账户" title="编辑"><Pencil size={15} /></button>
                  <button className="icon-button small danger" type="button" onClick={() => onDeleteAccount(account)} aria-label="删除账户" title="删除"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            {!data.accounts.length && <div className="empty-inline">添加一个银行卡或现金账户开始记录</div>}
          </div>
        </section>

        <section className="panel allocation-panel">
          <div className="panel-header"><div><h2>投资配置</h2><p>按当前市值计算</p></div></div>
          {allocation.length ? <>
            <div className="allocation-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} stroke="none" paddingAngle={2}>{allocation.map((item, index) => <Cell key={item.name} fill={allocationColors[index % allocationColors.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value))} /></PieChart></ResponsiveContainer><div><span>投资总额</span><strong>{formatMoney(totals.investments, true)}</strong></div></div>
            <div className="allocation-legend">{allocation.map((item, index) => <div key={item.name}><span><i className="dot" style={{ background: allocationColors[index % allocationColors.length] }} />{item.name}</span><strong>{totals.investments ? ((item.value / totals.investments) * 100).toFixed(1) : 0}%</strong></div>)}</div>
          </> : <div className="empty-inline">还没有投资持仓</div>}
        </section>
      </div>

      <section className="panel table-panel">
        <div className="panel-header"><div><h2>投资持仓</h2><p>手动更新现价即可刷新组合</p></div><button className="text-button" type="button" onClick={onAddInvestment}>添加持仓</button></div>
        {data.investments.length ? <div className="table-scroll"><table><thead><tr><th>资产</th><th>份额</th><th>成本价</th><th>现价</th><th className="amount-cell">市值</th><th className="amount-cell">收益</th><th aria-label="操作" /></tr></thead><tbody>
          {data.investments.map((item) => {
            const gain = investmentValue(item) - investmentCost(item);
            return <tr key={item.id}><td><div className="asset-name"><span>{item.type === 'bond' ? <Building2 size={17} /> : item.type === 'cash' ? <Banknote size={17} /> : <TrendingUp size={17} />}</span><div><strong>{item.name}</strong><small>{item.symbol || '未填写代码'} · {item.updatedAt}</small></div></div></td><td>{item.units}</td><td>{formatMoney(item.averageCost)}</td><td>{formatMoney(item.currentPrice)}</td><td className="amount-cell"><strong>{formatMoney(investmentValue(item))}</strong></td><td className={`amount-cell ${gain >= 0 ? 'positive' : 'negative'}`}><strong>{gain >= 0 ? '+' : ''}{formatMoney(gain)}</strong></td><td><div className="row-actions"><button className="icon-button small" type="button" onClick={() => onEditInvestment(item)} aria-label="编辑投资" title="编辑"><Pencil size={15} /></button><button className="icon-button small danger" type="button" onClick={() => onDeleteInvestment(item)} aria-label="删除投资" title="删除"><Trash2 size={15} /></button></div></td></tr>;
          })}
        </tbody></table></div> : <div className="empty-state"><TrendingUp size={26} /><strong>还没有投资持仓</strong><span>记录基金、股票、债券或其他理财资产。</span><button className="button secondary" type="button" onClick={onAddInvestment}>添加持仓</button></div>}
      </section>
    </div>
  );
}
