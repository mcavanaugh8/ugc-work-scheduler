import React, {useEffect, useRef, useState} from 'react';
import {Check, Plus, X, ArrowUpRight} from 'lucide-react';
import WorkspaceTransfer from './WorkspaceTransfer.jsx';

export default function WorkspaceManager({workspaces, current, onOpen, onCreate, onRename, onImported, onClose}) {
  const dialog = useRef(null);
  const [mode, setMode] = useState('rename');
  const [name, setName] = useState(current.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'new') await onCreate(name);
      else await onRename(name);
      onClose();
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="modal workspace-modal" aria-labelledby="workspace-title" onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }}>
    <div className="modal-head">
      <div><span className="eyebrow">YOUR CREATOR SPACES</span><h2 id="workspace-title">Workspaces</h2></div>
      <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Close workspaces"><X/></button>
    </div>
    <div className="workspace-modal-body">
      <p className="workspace-explanation">Each workspace has its own deals, calendar, and income.</p>
      <div className="workspace-list" aria-label="Available workspaces">
        {workspaces.map(workspace => <button key={workspace.id} disabled={busy} className={workspace.id === current.id ? 'current' : ''} onClick={() => {
          onOpen(workspace.id);
          onClose();
        }}>
          <span className="avatar">{workspace.name.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-list-name">{workspace.name}<small>{workspace.id === current.id ? 'Current workspace' : 'Open workspace'}</small></span>
          {workspace.id === current.id ? <Check size={17}/> : <ArrowUpRight size={17}/>}
        </button>)}
      </div>
      <form onSubmit={submit}>
        <div className="segmented">
          <button type="button" disabled={busy} className={mode === 'rename' ? 'active' : ''} onClick={() => {setMode('rename'); setName(current.name); setError('');}}>Rename current</button>
          <button type="button" disabled={busy} className={mode === 'new' ? 'active' : ''} onClick={() => {setMode('new'); setName(''); setError('');}}>New workspace</button>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <label>Workspace name<input autoFocus required maxLength={80} disabled={busy} value={name} placeholder="e.g. My creator business" onChange={event => setName(event.target.value)}/></label>
        <div className="workspace-actions"><button className="primary" disabled={busy || !name.trim()} type="submit">{busy ? 'Saving…' : mode === 'new' ? 'Create workspace' : 'Save name'}{mode === 'new' ? <Plus size={16}/> : <Check size={16}/>}</button></div>
      </form>
      <WorkspaceTransfer current={current} busy={busy} setBusy={setBusy} onImported={workspace=>{onImported(workspace);onClose();}}/>
    </div>
  </dialog>;
}
