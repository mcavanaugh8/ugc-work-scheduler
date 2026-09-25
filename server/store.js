import { DatabaseSync } from 'node:sqlite';
import {completionTerms} from '../shared/paymentTerms.js';

export function workspaceName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    throw new Error('Workspace name must be between 1 and 80 characters.');
  }
  return value.trim();
}

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    INSERT OR IGNORE INTO workspaces (id, name) VALUES (1, 'Your workspace');
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      workspace_id INTEGER NOT NULL DEFAULT 1 REFERENCES workspaces(id)
    );
  `);
  // Keep existing deals in the original workspace when upgrading an older database.
  if (!db.prepare('PRAGMA table_info(deals)').all().some(column => column.name === 'workspace_id')) {
    db.exec('ALTER TABLE deals ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1 REFERENCES workspaces(id)');
  }
  db.exec('CREATE INDEX IF NOT EXISTS deals_workspace ON deals(workspace_id); PRAGMA foreign_keys = ON;');
  // Upgrade every workspace atomically; existing explicit due dates stay intact.
  db.exec('BEGIN IMMEDIATE');
  try {
    const update = db.prepare('UPDATE deals SET body = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, body FROM deals').all()) {
      const previous = JSON.parse(row.body);
      const normalized = completionTerms(previous, {legacy:true});
      if (JSON.stringify(previous) !== JSON.stringify(normalized)) update.run(JSON.stringify(normalized), row.id);
    }
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); db.close(); throw error; }
  return {
    close: () => db.close(),
    workspaces: () => db.prepare('SELECT * FROM workspaces ORDER BY id').all(),
    workspace: id => db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id),
    createWorkspace(name) {
      const result = db.prepare('INSERT INTO workspaces (name) VALUES (?)').run(workspaceName(name));
      return this.workspace(result.lastInsertRowid);
    },
    importWorkspace({name, deals}) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const names = new Set(this.workspaces().map(w => w.name));
        let candidate = name;
        let copy = 1;
        while (names.has(candidate)) {
          const suffix = copy === 1 ? ' (imported)' : ` (imported ${copy})`;
          candidate = name.slice(0, 80 - suffix.length) + suffix;
          copy++;
        }
        const workspace = this.createWorkspace(candidate);
        const insert = db.prepare('INSERT INTO deals (workspace_id, body, created_at) VALUES (?, ?, ?)');
        for (const deal of [...deals].reverse()) insert.run(workspace.id, JSON.stringify(completionTerms(deal.body, {legacy:true})), deal.createdAt);
        db.exec('COMMIT');
        return workspace;
      } catch(error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    renameWorkspace(id, name) {
      const result = db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(workspaceName(name), id);
      return result.changes ? this.workspace(id) : null;
    },
    deals: workspaceId => db.prepare('SELECT * FROM deals WHERE workspace_id = ? ORDER BY id DESC').all(workspaceId),
    deal: (workspaceId, id) => db.prepare('SELECT * FROM deals WHERE workspace_id = ? AND id = ?').get(workspaceId, id),
    createDeal(workspaceId, body) {
      const result = db.prepare('INSERT INTO deals (workspace_id, body) VALUES (?, ?)').run(workspaceId, JSON.stringify(completionTerms(body)));
      return this.deal(workspaceId, result.lastInsertRowid);
    },
    updateDeal(workspaceId, id, body) {
      const result = db.prepare('UPDATE deals SET body = ? WHERE workspace_id = ? AND id = ?').run(JSON.stringify(completionTerms(body)), workspaceId, id);
      return result.changes ? this.deal(workspaceId, id) : null;
    },
    deleteDeal: (workspaceId, id) => db.prepare('DELETE FROM deals WHERE workspace_id = ? AND id = ?').run(workspaceId, id).changes,
  };
}
