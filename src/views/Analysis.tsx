import { BrainCircuit, Check, Clipboard, Download, FileJson, Lightbulb, LockKeyhole, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildAnalysisPrompt, exportAnalysisJson, exportAnalysisMarkdown } from '../lib/export';
import { formatMoney, formatPercent, getBudgetStatus, getCategorySpending, getMonthSummary } from '../lib/finance';
import type { AppData } from '../types';

interface AnalysisProps { data: AppData; month: string }

export function Analysis({ data, month }: AnalysisProps) {
  const [includeTransactions, setIncludeTransactions] = useState(false);
  const [copied, setCopied] = useState(false);
  const summary = getMonthSummary(data, month);
  const categories = getCategorySpending(data, month);
  const budgets = getBudgetStatus(data, month);
  const topCategory = categories[0];
  const overspent = budgets.filter((item) => item.ratio > 1);
  const prompt = useMemo(() => buildAnalysisPrompt(data, month, includeTransactions), [data, month, includeTransactions]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">可控的 AI 工作流</p><h1>财务分析导出</h1><p>先在本地汇总，再把结构化数据交给你选择的 AI。</p></div>
        <div className="privacy-badge"><LockKeyhole size={17} /><span><strong>默认不上传</strong>数据只在当前设备处理</span></div>
      </div>

      <section className="insight-grid">
        <article className="insight-card">
          <span className="insight-icon green"><ShieldCheck size={19} /></span>
          <div><span>本月储蓄率</span><strong>{formatPercent(summary.savingsRate)}</strong><p>{summary.savingsRate >= 30 ? '现金流留存较充足，可以继续保持。' : summary.savingsRate >= 10 ? '处于可改善区间，建议检查弹性支出。' : '储蓄率偏低，优先确认固定支出和异常消费。'}</p></div>
        </article>
        <article className="insight-card">
          <span className="insight-icon amber"><Lightbulb size={19} /></span>
          <div><span>最大支出类别</span><strong>{topCategory?.name ?? '暂无数据'} {topCategory ? formatMoney(topCategory.value, true) : ''}</strong><p>{topCategory ? `占本月支出的 ${summary.expense ? ((topCategory.value / summary.expense) * 100).toFixed(1) : 0}%，适合优先复盘。` : '记录支出后会自动识别主要去向。'}</p></div>
        </article>
        <article className="insight-card">
          <span className="insight-icon red"><TriangleAlert size={19} /></span>
          <div><span>预算风险</span><strong>{overspent.length} 个分类超支</strong><p>{overspent.length ? `${overspent.map((item) => item.category).join('、')} 已超过设定额度。` : '当前预算都在额度内。'}</p></div>
        </article>
      </section>

      <div className="analysis-layout">
        <section className="panel export-panel">
          <div className="panel-header"><div><h2>生成分析包</h2><p>可直接粘贴到 ChatGPT、Codex 或其他模型</p></div><BrainCircuit size={23} /></div>
          <div className="export-preview">
            <div><span>目标月份</span><strong>{month}</strong></div>
            <div><span>汇总字段</span><strong>收支、预算、资产、投资、趋势</strong></div>
            <div><span>流水明细</span><strong>{includeTransactions ? `${summary.transactions.length} 笔` : '不包含'}</strong></div>
            <div><span>个人身份信息</span><strong>不包含</strong></div>
          </div>
          <label className="switch-row">
            <span><strong>附带本月流水明细</strong><small>会包含交易对象与备注，分享前请检查敏感信息。</small></span>
            <input type="checkbox" checked={includeTransactions} onChange={(event) => setIncludeTransactions(event.target.checked)} />
          </label>
          <div className="export-actions">
            <button className="button primary" type="button" onClick={copyPrompt}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? '已复制' : '复制分析提示词'}</button>
            <button className="button secondary" type="button" onClick={() => exportAnalysisMarkdown(data, month, includeTransactions)}><Download size={17} /> Markdown</button>
            <button className="button secondary" type="button" onClick={() => exportAnalysisJson(data, month, includeTransactions)}><FileJson size={17} /> JSON</button>
          </div>
        </section>

        <aside className="panel prompt-panel">
          <div className="panel-header"><div><h2>分析指令预览</h2><p>导出的内容可以自行修改</p></div></div>
          <pre>{prompt}</pre>
        </aside>
      </div>
    </div>
  );
}
