import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, workspaceName } from './store.js';

test('legacy deals survive migration, rename and database reopen', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'creator-workspaces-'));
  const filename = path.join(dir, 'legacy.sqlite');
  let store;
  try {
    const legacy = new DatabaseSync(filename);
    legacy.exec("CREATE TABLE deals (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    legacy.prepare('INSERT INTO deals (body) VALUES (?)').run(JSON.stringify({brand: 'Existing brand', amount: 125}));
    legacy.close();
    store = openStore(filename);
    assert.equal(store.deals(1).length, 1);
    assert.equal(JSON.parse(store.deals(1)[0].body).brand, 'Existing brand');
    store.renameWorkspace(1, '  My studio  ');
    const second = store.createWorkspace('Second studio');
    assert.equal(store.deals(second.id).length, 0);
    store.close();
    store = openStore(filename);
    assert.equal(store.workspace(1).name, 'My studio');
    assert.equal(store.workspaces().length, 2);
    assert.equal(store.deals(1).length, 1);
  } finally {
    store?.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('workspace scopes isolate deal reads, updates and deletes', () => {
  const store = openStore(':memory:');
  try {
    const other = store.createWorkspace('Other');
    const firstDeal = store.createDeal(1, {brand: 'Original', amount: 100});
    const otherDeal = store.createDeal(other.id, {brand: 'Other', amount: 500});
    assert.deepEqual(store.deals(1).map(d => d.id), [firstDeal.id]);
    assert.deepEqual(store.deals(other.id).map(d => d.id), [otherDeal.id]);
    assert.equal(store.deal(other.id, firstDeal.id), undefined);
    assert.equal(store.updateDeal(other.id, firstDeal.id, {brand: 'Wrong'}), null);
    assert.equal(store.deleteDeal(other.id, firstDeal.id), 0);
    assert.equal(JSON.parse(store.deal(1, firstDeal.id).body).brand, 'Original');
    assert.ok(store.updateDeal(other.id, otherDeal.id, {brand: 'Updated'}));
    assert.equal(store.deleteDeal(other.id, otherDeal.id), 1);
    assert.equal(store.deals(1).length, 1);
  } finally { store.close(); }
});

test('workspace names reject blank and excessively long input', () => {
  for (const value of ['', '   ', 'a'.repeat(81), null, 4]) assert.throws(() => workspaceName(value));
  assert.equal(workspaceName('  Creator studio  '), 'Creator studio');
});
