export const stages = ['In Discussion', 'Agreed', 'Signed', 'In Progress', 'Completed'];
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function dueDate(deal) {
  if (deal.deadlineType === 'fixed') return deal.fixedDueDate || null;
  if (!deal.receivedDate) return null;
  const date = new Date(deal.receivedDate + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + Number(deal.turnaroundDays));
  return date.toISOString().slice(0,10);
}
export function validateDeal(input) {
  const d = { ...input };
  for (const key of ['brand','title','notes','exchangeDescription']) { d[key] = String(d[key] || '').trim(); if (d[key].length > 10000) throw new Error('Text is too long.'); }
  if (!d.brand || !d.title) throw new Error('Brand and deliverable are required.');
  if (!stages.includes(d.stage)) throw new Error('Choose a valid stage.');
  if (!['Paid','Free','Exchange'].includes(d.compensationType)) throw new Error('Choose a valid compensation type.');
  d.amount = Number(d.amount || 0);
  if (!Number.isFinite(d.amount) || d.amount < 0 || d.amount > 100000000) throw new Error('Enter a valid compensation amount.');
  d.amount = d.compensationType === 'Paid' ? Math.round(d.amount * 100) / 100 : 0;
  if (!['fixed','relative'].includes(d.deadlineType)) throw new Error('Choose a deadline type.');
  for (const key of ['dealDate','fixedDueDate','receivedDate','paymentDueDate','paidDate','completedDate']) { d[key] = d[key] || ''; if (d[key] && !validDate(d[key])) throw new Error('Enter valid dates.'); }
  d.paymentDueDateSource = d.paymentDueDateSource === 'automatic' ? 'automatic' : d.paymentDueDate ? 'manual' : 'automatic';
  d.completedDateEstimated = d.completedDateEstimated === true;
  if (!d.dealDate) throw new Error('A deal date is required.');
  if (d.deadlineType === 'fixed' && !d.fixedDueDate) throw new Error('A fixed deadline is required.');
  d.turnaroundDays = Number(d.turnaroundDays ?? 7);
  if (!Number.isInteger(d.turnaroundDays) || d.turnaroundDays < 0 || d.turnaroundDays > 3650) throw new Error('Turnaround must be between 0 and 3,650 days.');
  if (d.compensationType !== 'Paid') { d.paymentDueDate = ''; d.paidDate = ''; }
  if (!Array.isArray(d.tasks) || d.tasks.length > 100) throw new Error('Invalid task list.');
  d.tasks = d.tasks.map(t => ({id:String(t.id),title:String(t.title || '').trim().slice(0,300),done:Boolean(t.done)})).filter(t => t.title);
  return Object.fromEntries(['brand','title','notes','exchangeDescription','stage','compensationType','amount','deadlineType','dealDate','fixedDueDate','receivedDate','paymentDueDate','paidDate','turnaroundDays','tasks','completedDate','completedDateEstimated','paymentDueDateSource'].map(k=>[k,d[k]]));
}
