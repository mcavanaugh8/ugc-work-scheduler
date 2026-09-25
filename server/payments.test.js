import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentStatus} from '../shared/payments.js';
import {openStore} from './store.js';
import {exportCsv} from './transfer.js';
import {validateDeal} from './model.js';
const base={brand:'Late brand',title:'Video',compensationType:'Paid',amount:500,stage:'Signed',paymentDueDate:'2026-09-20',paidDate:''};
test('overdue begins the day after due date and clears when paid',()=>{
  assert.deepEqual(paymentStatus(base,'2026-09-25'),{label:'Overdue',daysLate:5,overdue:true});
  assert.equal(paymentStatus(base,'2026-09-20').label,'Due today');
  assert.equal(paymentStatus(base,'2026-09-19').label,'Upcoming');
  assert.equal(paymentStatus({...base,paidDate:'2026-09-25'},'2026-09-25').label,'Paid');
});
test('completed unpaid deals stay overdue; discussions, exchange, free and zero amounts do not',()=>{
  assert.equal(paymentStatus({...base,stage:'Completed'},'2026-09-25').overdue,true);
  for(const patch of [{stage:'In Discussion'},{compensationType:'Free'},{compensationType:'Exchange'},{amount:0},{paymentDueDate:''}]) assert.equal(paymentStatus({...base,...patch},'2026-09-25').overdue,false);
  assert.equal(paymentStatus({...base,paymentDueDate:''},'2026-09-25').label,'Due 30 days after completion');
});
test('days late use calendar dates across daylight saving, leap days and year boundaries',()=>{
  for(const [due,today,days] of [['2026-03-07','2026-03-09',2],['2024-02-28','2024-03-01',2],['2025-12-31','2026-01-01',1]]) assert.equal(paymentStatus({...base,paymentDueDate:due},today).daysLate,days);
});
test('CSV reports include matching overdue status, days and income total',()=>{
  const store=openStore(':memory:');
  try{
    store.createDeal(1,validateDeal({...base,dealDate:'2026-09-01',deadlineType:'fixed',fixedDueDate:'2026-09-15',tasks:[]}));
    const details=exportCsv(store,1,'deals','2026-09-25');
    assert.ok(details.includes('"Overdue"'));assert.ok(details.includes('"Days payment overdue"'));assert.ok(details.includes(',"5","500",'));
    const income=exportCsv(store,1,'income','2026-09-25');
    assert.ok(income.includes('"Overdue payment (all time)"'));assert.ok(income.includes('"USD","500","0","500","500"'));
  }finally{store.close();}
});
