import React, {useState} from 'react';
import {Download, Upload} from 'lucide-react';

const date = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
async function responseError(response) {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || 'Unable to complete the transfer. Please try again.');
}

export default function WorkspaceTransfer({current, busy, setBusy, onImported}) {
  const [scope, setScope] = useState('current');
  const [kind, setKind] = useState('deals');
  const [backup, setBackup] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function download(url, filename) {
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch(url);
      if (!response.ok) await responseError(response);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setStatus('Export ready. Check your browser’s downloads.');
    } catch(error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackup(null); setBusy(true); setError(''); setStatus('');
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a workspace backup smaller than 50 MB.');
      let parsed;
      try { parsed = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON. Choose a Creator Desk workspace backup.'); }
      if (parsed?.format !== 'creator-desk-workspace' || parsed.version !== 1 || typeof parsed.workspace?.name !== 'string' || !Array.isArray(parsed.deals)) throw new Error('Choose a Creator Desk workspace backup (version 1). CSV files cannot be imported.');
      setBackup(parsed);
    } catch(error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function importBackup() {
    setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/workspaces/import', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(backup)});
      if (!response.ok) await responseError(response);
      onImported(await response.json());
    } catch(error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const filename = current.name.replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,60) || 'workspace';
  return <section className="workspace-transfer" aria-labelledby="transfer-title">
    <h3 id="transfer-title">Export & import</h3>
    <p>Move this workspace to another machine with a complete backup.</p>
    <div className="transfer-buttons">
      <button className="secondary" disabled={busy} onClick={() => download(`/api/workspaces/${current.id}/export`,`${filename}-${date()}.json`)}><Download size={16}/> Export workspace</button>
      <label className={'secondary file-button '+(busy?'disabled':'')}><Upload size={16}/> Choose backup<input aria-label="Choose workspace backup" type="file" accept=".json,application/json" disabled={busy} onChange={chooseFile}/></label>
    </div>
    {backup && <div className="import-preview">
      <strong>{backup.workspace.name}</strong><span>{backup.deals.length} deals · Includes payments, notes, and to-dos.</span>
      <p>Imports as a new workspace. Existing workspaces stay unchanged.</p>
      <div className="transfer-buttons"><button className="primary" disabled={busy} onClick={importBackup}>Import & open</button><button className="secondary" disabled={busy} onClick={()=>setBackup(null)}>Cancel import</button></div>
    </div>}
    <h3>Export to CSV</h3>
    <p>Deals include payment amounts and dates, notes, and the full checklist. Income summaries match your dashboard periods.</p>
    <div className="form-grid">
      <label>Workspaces<select value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="current">Current workspace</option><option value="all">All workspaces</option></select></label>
      <label>Report<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}><option value="deals">All deal details</option><option value="tasks">To-do checklist items</option><option value="income">Income summaries</option></select></label>
    </div>
    <button className="secondary csv-download" disabled={busy} onClick={()=>download(`/api/export.csv?workspace=${scope==='all'?'all':current.id}&kind=${kind}&today=${date()}`,`${scope==='all'?'all-workspaces':filename}-${kind}-${date()}.csv`)}><Download size={16}/> Export CSV</button>
    <p className="transfer-status" role="status">{busy?'Preparing transfer…':status}</p>
    {error && <div className="error" role="alert">{error}</div>}
  </section>;
}
