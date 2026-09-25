import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './store.js';
import {validateDeal} from './model.js';
import {exportWorkspace, validateBackup, exportCsv, csv} from './transfer.js';

const deal = validateDeal({brand:'Café, "Studio"', title:'Five videos', stage:'Signed', compensationType:'Paid', amount:125.55, deadlineType:'relative', dealDate:'2026-09-01', receivedDate:'2026-09-20', turnaroundDays:7, paymentDueDate:'2026-09-30', paidDate:'2026-09-25', notes:'Line one\nLine two', tasks:[{id:'one',title:'Video 1',done:true},{id:'two',title:'Video 2',done:false}]});
function fixture() { const store=openStore(':memory:'); store.renameWorkspace(1,'Creator studio');store.createDeal(1,deal);return store; }

test('backup moves every stored field to a new machine and uses fresh deal IDs', () => {
  const source=fixture(), destination=fixture();
  try {
    const backup=exportWorkspace(source,1);
    const imported=destination.importWorkspace(validateBackup(JSON.parse(JSON.stringify(backup))));
    assert.equal(imported.name,'Creator studio (imported)');
    assert.notEqual(destination.deals(imported.id)[0].id,source.deals(1)[0].id);
    const restored=exportWorkspace(destination,imported.id);
    assert.deepEqual(restored.deals,backup.deals);
    assert.equal(destination.deals(1).length,1);
    assert.equal(destination.importWorkspace(validateBackup(backup)).name,'Creator studio (imported 2)');
  } finally {source.close();destination.close();}
});

test('invalid backups fail before import, and database failures roll back the entire import', () => {
  const store=fixture();
  try {
    const backup=exportWorkspace(store,1);
    for(const corrupt of [null,{}, {...backup,version:2},{...backup,deals:[...backup.deals,{...backup.deals[0],stage:'Invalid'}]}, {...backup,deals:[{...backup.deals[0],createdAt:'invalid'}]}, {...backup,deals:[{...backup.deals[0],tasks:[{id:'a',title:'A',done:'false'}]}]}]) assert.throws(()=>validateBackup(corrupt));
    const valid=validateBackup(backup);
    assert.throws(()=>store.importWorkspace({...valid,deals:[valid.deals[0],{body:deal,createdAt:null},valid.deals[0]]}));
    assert.equal(store.workspaces().length,1);
    assert.equal(store.deals(1).length,1);
  } finally {store.close();}
});

test('CSV handles unicode, commas, quotes, newlines, and formula-like text', () => {
  assert.equal(csv([['Café, "hello"','line\nnext','=1+1',' \t@SUM(A1)',12.55]]),'\uFEFF"Café, ""hello""","line\nnext","\'=1+1","\' \t@SUM(A1)","12.55"\r\n');
});

test('CSV scope and checklist export include all data without duplicating income', () => {
  const store=fixture();
  try {
    const other=store.createWorkspace('Other');store.createDeal(other.id,{...deal,brand:'Other brand'});
    const result=exportCsv(store,1);
    assert.ok(result.includes('Café, ""Studio""'));
    assert.ok(result.includes('"Line one\nLine two"'));
    assert.ok(result.includes('"2026-09-27"'));
    assert.ok(result.includes('"125.55"'));
    assert.ok(result.includes('Video 2'));
    assert.ok(!result.includes('Other brand'));
    assert.ok(exportCsv(store,'all').includes('Other brand'));
    assert.equal(exportCsv(store,1,'tasks').split('\r\n').length,4);
    const empty=store.createWorkspace('Empty');
    assert.equal(exportCsv(store,empty.id).split('\r\n').length,2);
  } finally {store.close();}
});

test('income summaries follow payment dates, deal dates and dashboard rules', () => {
  const store=fixture();
  try {
    store.createDeal(1,{...deal,amount:20,paidDate:'',stage:'In Discussion'});
    store.createDeal(1,{...deal,amount:30,paidDate:'',dealDate:'2025-01-01'});
    store.createDeal(1,{...deal,amount:0,compensationType:'Exchange',paidDate:''});
    const result=exportCsv(store,1,'income','2026-09-25');
    assert.ok(result.includes('"This month","2026-09-01","2026-09-25","USD","145.55","125.55","30"'));
    assert.ok(result.includes('"Last 30 days","2026-08-27"'));
    assert.throws(()=>exportCsv(store,999));
  } finally {store.close();}
});
