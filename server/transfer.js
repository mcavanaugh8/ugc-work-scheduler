import {dueDate, validateDeal} from './model.js';
import {workspaceName} from './store.js';
import {paymentStatus} from '../shared/payments.js';

export const BACKUP_FORMAT = 'creator-desk-workspace';
export function exportWorkspace(store, id) {
  const workspace = store.workspace(id);
  if (!workspace) throw new Error('Workspace not found.');
  return {format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), workspace: {name: workspace.name},
    deals: store.deals(id).map(row => ({...JSON.parse(row.body), createdAt: row.created_at}))};
}
export function validateBackup(input) {
  if (!input || input.format !== BACKUP_FORMAT || input.version !== 1) throw new Error('Choose a Creator Desk workspace backup (version 1).');
  const name = workspaceName(input.workspace?.name);
  if (!Array.isArray(input.deals) || input.deals.length > 20000) throw new Error('Backup must contain a deal list with no more than 20,000 deals.');
  const deals = input.deals.map((raw, index) => {
    try {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid deal.');
      const body = validateDeal(raw);
      if (raw.tasks.length !== body.tasks.length || raw.tasks.some(t => typeof t.title !== 'string' || !t.title.trim() || t.title.length > 300 || typeof t.done !== 'boolean' || typeof t.id !== 'string' || !t.id) || new Set(body.tasks.map(t => t.id)).size !== body.tasks.length) throw new Error('Invalid checklist.');
      if (typeof raw.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{3}Z)?$/.test(raw.createdAt) || Number.isNaN(Date.parse(raw.createdAt))) throw new Error('Invalid creation date.');
      return {body, createdAt: raw.createdAt};
    } catch(error) { throw new Error(`Deal ${index + 1}: ${error.message}`); }
  });
  return {name, deals};
}

// Quote every field and neutralize spreadsheet formula prefixes in user-entered text.
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n') + '\r\n';
}
export function exportCsv(store, workspaceId, kind = 'deals', today = new Date().toISOString().slice(0,10)) {
  const workspaces = workspaceId === 'all' ? store.workspaces() : [store.workspace(workspaceId)];
  if (workspaces.some(w => !w)) throw new Error('Workspace not found.');
  const entries = workspaces.flatMap(w => store.deals(w.id).map(row => ({workspace: w, deal: {...JSON.parse(row.body), id: row.id, createdAt: row.created_at}})));
  if (kind === 'deals') return csv([
    ['Workspace','Deal ID','Brand','Deliverable','Stage','Compensation type','Currency','Amount','Received amount','Awaiting payment amount','Payment status','Deal date','Payment due date','Payment received date','Deadline type','Fixed due date','Product received date','Turnaround days','Calculated due date','Exchange details','Notes','Tasks total','Tasks completed','Checklist (JSON)','Created at','Days payment overdue','Overdue amount','Completed on','Completion date estimated','Payment due date source'],
    ...entries.map(({workspace: w, deal: d}) => [w.name,d.id,d.brand,d.title,d.stage,d.compensationType,'USD',d.amount,d.paidDate?d.amount:0,!d.paidDate&&d.stage!=='In Discussion'?d.amount:0,paymentStatus(d,today).label,d.dealDate,d.paymentDueDate,d.paidDate,d.deadlineType,d.fixedDueDate,d.receivedDate,d.turnaroundDays,dueDate(d),d.exchangeDescription,d.notes,d.tasks.length,d.tasks.filter(t=>t.done).length,JSON.stringify(d.tasks),d.createdAt,paymentStatus(d,today).daysLate,paymentStatus(d,today).overdue?d.amount:0,d.completedDate,d.completedDateEstimated?'Yes':'No',d.paymentDueDateSource])
  ]);
  if (kind === 'tasks') return csv([
    ['Workspace','Deal ID','Brand','Deliverable','Task ID','To-do','Completed'],
    ...entries.flatMap(({workspace: w, deal: d})=>d.tasks.map(t=>[w.name,d.id,d.brand,d.title,t.id,t.title,t.done?'Yes':'No']))
  ]);
  if (kind === 'income') {
    const start30 = new Date(today+'T12:00:00Z'); start30.setUTCDate(start30.getUTCDate()-29);
    const periods = [['This month',today.slice(0,7)+'-01'],['This year',today.slice(0,4)+'-01-01'],['Last 30 days',start30.toISOString().slice(0,10)]];
    const total = (deals, predicate) => deals.filter(predicate).reduce((sum,d)=>sum+Math.round(d.amount*100),0)/100;
    return csv([
      ['Workspace','Period','Start date','End date','Currency','Booked compensation','Payments received','Awaiting payment (all time)','Overdue payment (all time)'],
      ...workspaces.flatMap(w => {
        const paid = entries.filter(e=>e.workspace.id===w.id && e.deal.compensationType==='Paid').map(e=>e.deal);
        return periods.map(([label,start]) => [w.name,label,start,today,'USD',total(paid,d=>d.dealDate>=start&&d.dealDate<=today),total(paid,d=>d.paidDate&&d.paidDate>=start&&d.paidDate<=today),total(paid,d=>!d.paidDate&&d.stage!=='In Discussion'),total(paid,d=>paymentStatus(d,today).overdue)]);
      })
    ]);
  }
  throw new Error('Choose deals, tasks, or income for CSV export.');
}
