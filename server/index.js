import express from 'express';
import { openStore } from './store.js';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dueDate, validateDeal, validDate } from './model.js';
import {exportWorkspace, validateBackup, exportCsv} from './transfer.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root,'data'), {recursive:true});
const store = openStore(process.env.DB_PATH || path.join(root,'data','creator-desk.sqlite'));
const app = express();
app.use('/api/workspaces/import', express.json({limit:'50mb'}));
app.use(express.json({limit:'256kb'}));
app.use('/api', (req,res,next) => { if (req.headers.origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)) return res.status(403).json({error:'Origin not allowed.'}); next(); });
const hydrate = row => { const d = {...JSON.parse(row.body),id:row.id,createdAt:row.created_at}; return {...d,dueDate:dueDate(d)}; };
app.get('/api/workspaces', (req, res) => res.json(store.workspaces()));
app.post('/api/workspaces/import', (req, res) => res.status(201).json(store.importWorkspace(validateBackup(req.body))));
app.get('/api/workspaces/:id/export', (req, res) => {
  if (!store.workspace(req.params.id)) return res.status(404).json({error:'Workspace not found.'});
  res.attachment(`creator-desk-workspace-${req.params.id}.json`).json(exportWorkspace(store, req.params.id));
});
app.get('/api/export.csv', (req, res) => {
  const scope = req.query.workspace === 'all' ? 'all' : Number(req.query.workspace);
  if (scope !== 'all' && (!Number.isSafeInteger(scope) || !store.workspace(scope))) return res.status(404).json({error:'Workspace not found.'});
  const kind = req.query.kind || 'deals';
  const today = req.query.today || new Date().toISOString().slice(0,10);
  if (!validDate(today)) return res.status(400).json({error:'Invalid report date.'});
  const output = exportCsv(store, scope, kind, today);
  res.attachment(`creator-desk-${kind}.csv`).type('text/csv; charset=utf-8').send(output);
});
app.post('/api/workspaces', (req, res) => res.status(201).json(store.createWorkspace(req.body.name)));
app.put('/api/workspaces/:id', (req, res) => {
  const workspace = store.renameWorkspace(req.params.id, req.body.name);
  if (!workspace) return res.status(404).json({error: 'Workspace not found.'});
  res.json(workspace);
});
app.use('/api/deals', (req, res, next) => {
  const id = Number(req.headers['x-workspace-id'] ?? 1);
  if (!Number.isSafeInteger(id) || id < 1 || !store.workspace(id)) {
    return res.status(404).json({error: 'Workspace not found. Reopen a workspace to continue.'});
  }
  req.workspaceId = id;
  next();
});
app.get('/api/deals', (req, res) => res.json(store.deals(req.workspaceId).map(hydrate)));
app.post('/api/deals', (req, res) => res.status(201).json(hydrate(store.createDeal(req.workspaceId, validateDeal(req.body)))));
app.put('/api/deals/:id', (req, res) => {
  const row = store.updateDeal(req.workspaceId, req.params.id, validateDeal(req.body));
  if (!row) return res.status(404).json({error: 'Deal not found.'});
  res.json(hydrate(row));
});
app.delete('/api/deals/:id', (req, res) => res.status(store.deleteDeal(req.workspaceId, req.params.id) ? 204 : 404).end());
app.use('/api', (req,res)=>res.status(404).json({error:'Not found.'}));
app.use((err,req,res,next)=>res.status(err.status === 413 ? 413 : 400).json({error:err.status === 413 ? 'File is too large. Workspace imports support up to 50 MB.' : err.message || 'Request failed.'}));
if(process.env.NODE_ENV==='production'){ app.use(express.static(path.join(root,'dist'))); app.get('/{*path}',(req,res)=>res.sendFile(path.join(root,'dist','index.html'))); }
const port = Number(process.env.PORT) || 3001;
app.listen(port,'127.0.0.1',()=>console.log(`Creator Desk server: http://127.0.0.1:${port}`)).on('error', error => { console.error(error.message); process.exit(1); });
