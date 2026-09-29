import { CheckCircle2, FileDown, FileUp, Info, LoaderCircle, Play, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQingsuanCsv, type ImportedTransaction } from '../lib/csv';
import type { Account } from '../types';

interface PdfImportProps {
  accounts: Account[];
  onImport: (rows: ImportedTransaction[], targetAccountId: string) => { imported: number; skipped: number };
}

interface LlmSettings {
  provider: 'ollama' | 'openai';
  url: string;
  apiKey: string;
  model: string;
  timeout: number;
}

const SETTINGS_KEY = 'qingsuan.pdf-import.llm';
const defaults: LlmSettings = {
  provider: 'openai',
  url: 'http://127.0.0.1:8080/v1/chat/completions',
  apiKey: '',
  model: 'local-llama',
  timeout: 300,
};

const loadSettings = (): LlmSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '') as Partial<LlmSettings>;
    return { ...defaults, ...saved, provider: saved.provider === 'ollama' ? 'ollama' : 'openai' };
  } catch {
    return defaults;
  }
};

export function PdfImport({ accounts, onImport }: PdfImportProps) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<LlmSettings>(loadSettings);
  const [rows, setRows] = useState<ImportedTransaction[]>([]);
  const [source, setSource] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const currencies = useMemo(() => [...new Set(rows.map((row) => row.currency))], [rows]);
  const currency = currencies.length > 1 ? currencies.join(' / ') : (rows[0]?.currency ?? 'CNY');
  const singleCurrency = currencies.length === 1 ? currencies[0] : undefined;
  const matchingAccounts = useMemo(() => accounts.filter((account) => account.kind === 'asset' && account.currency === singleCurrency), [accounts, singleCurrency]);

  const acceptCsv = (text: string, name: string) => {
    try {
      const next = parseQingsuanCsv(text);
      setRows(next);
      setSource(name);
      setTargetAccountId('');
      setError('');
      setMessage(`已读取 ${next.length} 笔流水，请确认账户后导入。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取 CSV');
      setRows([]);
    }
  };

  const readCsv = async (file?: File) => {
    if (!file) return;
    acceptCsv(await file.text(), file.name);
    if (csvRef.current) csvRef.current.value = '';
  };

  const convertPdf = async () => {
    const desktop = window.qingsuanDesktop;
    if (!desktop || typeof desktop.convertPdf !== 'function') {
      setError('网页开发版不能直接运行 Python PDF 解析器，请使用清算桌面版，或先在 tool 目录生成 CSV 后选择“读取 CSV”。');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('正在调用 PDF 解析器和 AI 分类，请稍候……');
    try {
      const result = await desktop.convertPdf({
        provider: settings.provider,
        url: settings.url.trim(),
        apiKey: settings.apiKey,
        model: settings.model.trim(),
        timeout: Math.max(10, Number(settings.timeout) || 300),
      });
      acceptCsv(result.csv, result.filename);
      setMessage(`PDF 已转换为 CSV，共 ${parseQingsuanCsv(result.csv).length} 笔流水。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const choosePdf = () => {
    // Electron opens its native chooser in the main process. Opening the
    // hidden input first would show a second chooser when IPC starts parsing.
    if (window.qingsuanDesktop) {
      void convertPdf();
      return;
    }
    pdfRef.current?.click();
  };

  const importRows = () => {
    if (!rows.length) return;
    const result = onImport(rows, targetAccountId);
    setMessage(`已导入 ${result.imported} 笔流水${result.skipped ? `，跳过 ${result.skipped} 笔重复记录` : ''}。`);
    setRows([]);
    setSource('');
  };

  return (
    <div className="page-stack import-page">
      <div className="page-heading">
        <div><p className="eyebrow">PDF → 流水</p><h1>导入银行流水</h1><p>选择招商银行 PDF，调用本地或兼容 OpenAI 的 AI 完成分类，然后直接写入清算。</p></div>
        <span className="privacy-badge"><ShieldCheck size={18} /><span><strong>本机处理</strong><small>密钥仅保存在此浏览器</small></span></span>
      </div>

      {error && <div className="notice import-error"><Info size={17} />{error}</div>}
      {message && <div className="notice"><CheckCircle2 size={17} />{message}</div>}

      <div className="import-layout">
        <section className="panel import-panel">
          <div className="panel-header"><div><h2>选择文件</h2><p>桌面版可直接选择 PDF；网页端可读取解析器生成的 CSV。</p></div></div>
          <div className="import-actions">
            <button className="button primary" type="button" disabled={busy} onClick={choosePdf}>{busy ? <LoaderCircle className="spin" size={17} /> : <FileUp size={17} />}选择 PDF 并转换</button>
            <button className="button secondary" type="button" onClick={() => csvRef.current?.click()}><FileDown size={17} />读取已有 CSV</button>
            <input ref={pdfRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={() => {
              if (pdfRef.current) pdfRef.current.value = '';
              setError('网页开发版不能直接运行 PDF 解析器，请使用清算桌面版，或先生成 CSV 后选择“读取已有 CSV”。');
            }} />
            <input ref={csvRef} className="visually-hidden" type="file" accept="text/csv,.csv" onChange={(event) => readCsv(event.target.files?.[0])} />
          </div>
          <div className="import-help"><Info size={15} /><span>PDF 需要是招商银行文本型流水。分类规则会优先识别基金销售、基金申购等投资交易。</span></div>
        </section>

        <section className="panel import-panel">
          <div className="panel-header"><div><h2>AI 接口</h2><p>设置会自动保存在本机，下次打开仍可使用。</p></div></div>
          <div className="form-grid import-form">
            <label className="field"><span>接口类型</span><select value={settings.provider} onChange={(event) => setSettings((current) => ({ ...current, provider: event.target.value as LlmSettings['provider'], url: event.target.value === 'ollama' ? 'http://127.0.0.1:11434/api/chat' : 'http://127.0.0.1:8080/v1/chat/completions' }))}><option value="openai">OpenAI 兼容（llama.cpp / OpenAI）</option><option value="ollama">Ollama</option></select></label>
            <label className="field"><span>模型名称</span><input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} placeholder="local-llama" /></label>
            <label className="field full"><span>API 地址</span><input value={settings.url} onChange={(event) => setSettings((current) => ({ ...current, url: event.target.value }))} placeholder="http://127.0.0.1:8080/v1/chat/completions" /></label>
            <label className="field"><span>API 密钥（可选）</span><input type="password" value={settings.apiKey} onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder="本地服务通常留空" /></label>
            <label className="field"><span>单批超时（秒）</span><input type="number" min="10" step="10" value={settings.timeout} onChange={(event) => setSettings((current) => ({ ...current, timeout: Number(event.target.value) }))} /></label>
          </div>
        </section>
      </div>

      {rows.length > 0 && <section className="panel import-preview">
        <div className="panel-header"><div><h2>导入预览</h2><p>{source} · 共 {rows.length} 笔 · 币种 {currency}</p></div><div className="heading-actions"><label className="field inline-field"><span>写入账户</span><select value={targetAccountId} disabled={!singleCurrency} onChange={(event) => setTargetAccountId(event.target.value)}><option value="">{singleCurrency ? '按 PDF 账户自动匹配 / 创建' : '检测到多币种，按币种自动匹配 / 创建'}</option>{matchingAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}（{account.currency ?? 'CNY'}）</option>)}</select></label><button className="button primary" type="button" onClick={importRows}><Play size={16} />导入清算</button></div></div>
        <div className="table-scroll"><table className="preview-table"><thead><tr><th>日期</th><th>类型</th><th>交易对象</th><th>分类</th><th>金额</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={`${row.date}-${index}`}><td>{row.date}</td><td>{row.type === 'income' ? '收入' : '支出'}</td><td>{row.merchant}</td><td><span className="category-chip">{row.category}</span></td><td className={row.type === 'income' ? 'positive' : ''}>{row.type === 'income' ? '+' : '-'}{row.amount.toFixed(2)}</td></tr>)}</tbody></table></div>
        {rows.length > 8 && <p className="preview-more">仅显示前 8 笔，导入时会写入全部 {rows.length} 笔。</p>}
      </section>}
    </div>
  );
}
