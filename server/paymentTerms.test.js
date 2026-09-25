import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {completionTerms} from '../shared/paymentTerms.js';
import {openStore} from './store.js';
import {validateDeal} from './model.js';
import {validateBackup,exportWorkspace} from './transfer.js';
const base={brand:'Studio',title:'Video',compensationType:'Paid',amount:500,stage:'Completed',dealDate:'2026-08-01',deadlineType:'fixed',fixedDueDate:'2026-08-30',paymentDueDate:'',tasks:[]};
test('completion defaults to today plus 30 calendar days, stable across subsequent edits',()=>{
 const completed=completionTerms(base,{today:'2026-09-25'});
 assert.equal(completed.completedDate,'2026-09-25');assert.equal(completed.paymentDueDate,'2026-10-25');assert.equal(completed.paymentDueDateSource,'automatic');assert.equal(completed.completedDateEstimated,false);
 assert.equal(completionTerms({...completed,notes:'Updated'},{today:'2026-10-02'}).paymentDueDate,'2026-10-25');
 for(const [completion,due] of [['2024-02-01','2024-03-02'],['2026-12-15','2027-01-14'],['2026-03-01','2026-03-31']])assert.equal(completionTerms({...base,completedDate:completion}).paymentDueDate,due);
});
test('explicit dates survive completion and completion-date corrections',()=>{
 const manual=completionTerms({...base,paymentDueDate:'2026-12-01'},{today:'2026-09-25'});
 assert.equal(manual.paymentDueDate,'2026-12-01');assert.equal(manual.paymentDueDateSource,'manual');
 assert.equal(completionTerms({...manual,completedDate:'2026-08-01'}).paymentDueDate,'2026-12-01');
 const automatic=completionTerms(base,{today:'2026-09-25'});
 assert.equal(completionTerms({...automatic,completedDate:'2026-08-01'}).paymentDueDate,'2026-08-31');
});
test('reopening clears only automatic deadlines; non-paid deals never get payment deadlines',()=>{
 const automatic=completionTerms(base,{today:'2026-09-25'});
 const reopened=completionTerms({...automatic,stage:'In Progress'});
 assert.equal(reopened.paymentDueDate,'');assert.equal(reopened.completedDate,'');
 assert.equal(completionTerms({...reopened,stage:'Completed'},{today:'2026-10-03'}).paymentDueDate,'2026-11-02');
 assert.equal(completionTerms({...automatic,stage:'In Progress',paymentDueDateSource:'manual'}).paymentDueDate,'2026-10-25');
 for(const compensationType of ['Free','Exchange'])assert.equal(completionTerms({...base,compensationType}).paymentDueDate,'');
});
test('legacy completed deals are upgraded retroactively and migration is idempotent',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'creator-net30-'));const filename=path.join(dir,'db.sqlite');let store;
 try{
 const db=new DatabaseSync(filename);db.exec('CREATE TABLE deals(id INTEGER PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 const add=db.prepare('INSERT INTO deals(body) VALUES (?)');
 add.run(JSON.stringify({...base,completedDate:'2026-08-01'}));add.run(JSON.stringify({...base,paymentDueDate:'2026-12-01'}));add.run(JSON.stringify(base));db.close();
 store=openStore(filename);
 assert.equal(JSON.parse(store.deal(1,1).body).paymentDueDate,'2026-08-31');
 assert.equal(JSON.parse(store.deal(1,2).body).paymentDueDate,'2026-12-01');
 const estimated=JSON.parse(store.deal(1,3).body);assert.equal(estimated.completedDateEstimated,true);assert.ok(estimated.paymentDueDate);
 const before=store.deals(1);store.close();store=openStore(filename);assert.deepEqual(store.deals(1),before);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('completion dates and automatic terms persist through saves and workspace transfers',()=>{
 const store=openStore(':memory:');
 try{
 const row=store.createDeal(1,validateDeal({...base,completedDate:'2026-08-01'}));
 const d=JSON.parse(row.body);assert.equal(d.paymentDueDate,'2026-08-31');
 const edited=store.updateDeal(1,row.id,validateDeal({...d,notes:'New notes'}));assert.equal(JSON.parse(edited.body).paymentDueDate,'2026-08-31');
 const backup=exportWorkspace(store,1);const imported=store.importWorkspace(validateBackup(backup));assert.deepEqual(exportWorkspace(store,imported.id).deals,backup.deals);
 assert.throws(()=>validateDeal({...base,completedDate:'2026-02-30'}));
 }finally{store.close();}
});
