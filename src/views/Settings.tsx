import { ArchiveRestore, Database, Download, FileSpreadsheet, Info, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { exportBackup, exportTransactionsCsv } from '../lib/export';
import type { AppData } from '../types';

interface SettingsProps {
  data: AppData;
  isDemo: boolean;
  onImport: (data: AppData) => void;
  onResetEmpty: () => void;
  onResetDemo: () => void;
}

export function Settings({ data, isDemo, onImport, onResetEmpty, onResetDemo }: SettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppData>;
      if (parsed.version !== 1 || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.budgets) || !Array.isArray(parsed.investments) || !Array.isArray(parsed.snapshots)) {
        throw new Error('bad format');
      }
      onImport(parsed as AppData);
      setMessage('备份已恢复，所有页面已更新。');
    } catch {
      setMessage('无法导入：请选择由清算导出的 JSON 备份。');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="page-stack settings-page">
      <div className="page-heading">
        <div><p className="eyebrow">数据所有权</p><h1>数据与设置</h1><p>备份、恢复或迁移你的财务数据。</p></div>
        <span className={`status-chip ${isDemo ? 'demo' : ''}`}>{isDemo ? '当前为演示数据' : '当前为个人数据'}</span>
      </div>

      {message && <div className="notice" role="status"><Info size={17} />{message}</div>}

      <section className="settings-section">
        <div className="settings-intro"><span className="settings-icon"><Database size={20} /></span><div><h2>备份与迁移</h2><p>JSON 备份包含完整数据；CSV 适合在表格软件中继续处理。</p></div></div>
        <div className="settings-actions-grid">
          <button className="settings-action" type="button" onClick={() => exportBackup(data)}><span><Download size={20} /></span><div><strong>导出完整备份</strong><small>账户、流水、预算、投资和快照</small></div></button>
          <button className="settings-action" type="button" onClick={() => fileRef.current?.click()}><span><Upload size={20} /></span><div><strong>恢复 JSON 备份</strong><small>导入后覆盖当前浏览器中的数据</small></div></button>
          <button className="settings-action" type="button" onClick={() => exportTransactionsCsv(data)}><span><FileSpreadsheet size={20} /></span><div><strong>导出流水 CSV</strong><small>使用 Excel、Numbers 或其他工具打开</small></div></button>
          <input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-intro"><span className="settings-icon"><ArchiveRestore size={20} /></span><div><h2>初始化数据</h2><p>以下操作会替换当前数据，操作前建议先导出完整备份。</p></div></div>
        <div className="danger-zone">
          <div><strong>载入演示数据</strong><span>恢复一组完整的示例账户与图表数据。</span></div>
          <button className="button secondary" type="button" onClick={() => window.confirm('用演示数据替换当前数据？') && onResetDemo()}><RotateCcw size={17} /> 载入演示</button>
        </div>
        <div className="danger-zone">
          <div><strong>清空并开始记账</strong><span>移除当前所有账户、流水、预算、投资和快照。</span></div>
          <button className="button danger-button" type="button" onClick={() => window.confirm('确定清空全部数据？此操作无法撤销。') && onResetEmpty()}><Trash2 size={17} /> 清空数据</button>
        </div>
      </section>

      <section className="local-note"><Info size={18} /><div><strong>你的数据保存在哪里？</strong><p>当前版本使用浏览器本地存储，不会主动上传。清理浏览器网站数据可能会删除记录，因此建议每月导出一次 JSON 备份。</p></div></section>
    </div>
  );
}
