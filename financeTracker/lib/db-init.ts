import { db } from './db';
import fs from 'fs';
import path from 'path';

export function initializeDatabase() {
  // Create version tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Check current version
  const versionRow = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
  const currentVersion = versionRow ? parseInt(versionRow.value) : 0;

  console.log(`Database schema version: ${currentVersion}`);

  if (currentVersion < 8) {
    console.log('Running migration 008_add_account_mask.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '008_add_account_mask.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      db.exec(migration);

      // Update version
      const newVersion = 8;
      const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
      if (versionRowAfter) {
        db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
      } else {
        db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
      }
      console.log('Migration 008 complete. Schema version: 8');
    }
  }

  // Run migrations if needed
  if (currentVersion < 1) {
    console.log('Running migration 001_core_schema.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '001_core_schema.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    // Update version
    if (versionRow) {
      db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run('1', 'schema_version');
    } else {
      db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', '1');
    }
    console.log('Migration 001 complete. Schema version: 1');
  }

  if (currentVersion < 2) {
    console.log('Running migration 002_add_processing_status.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '002_add_processing_status.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    // Update version
    const newVersion = 2;
    const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    if (versionRowAfter) {
      db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
    } else {
      db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
    }
    console.log('Migration 002 complete. Schema version: 2');
  }

  if (currentVersion < 3) {
    console.log('Running migration 003_plaid_integration.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '003_plaid_integration.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    // Update version
    const newVersion = 3;
    const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    if (versionRowAfter) {
      db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
    } else {
      db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
    }
    console.log('Migration 003 complete. Schema version: 3');
  }

  if (currentVersion < 4) {
    console.log('Running migration 004_receipt_items.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '004_receipt_items.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    // Update version
    const newVersion = 4;
    const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    if (versionRowAfter) {
      db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
    } else {
      db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
    }
    console.log('Migration 004 complete. Schema version: 4');
  }

  if (currentVersion < 5) {
    console.log('Running migration 005_add_receipt_payment_method.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '005_add_receipt_payment_method.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      db.exec(migration);

      // Update version
      const newVersion = 5;
      const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
      if (versionRowAfter) {
        db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
      } else {
        db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
      }
      console.log('Migration 005 complete. Schema version: 5');
    }
  }

  if (currentVersion < 6) {
    console.log('Running migration 006_add_plaid_cursor.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '006_add_plaid_cursor.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      db.exec(migration);

      // Update version
      const newVersion = 6;
      const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
      if (versionRowAfter) {
        db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
      } else {
        db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
      }
      console.log('Migration 006 complete. Schema version: 6');
    }
  }

  if (currentVersion < 7) {
    console.log('Running migration 007_add_plaid_transaction_id.sql...');
    const migrationPath = path.join(process.cwd(), 'lib', 'migrations', '007_add_plaid_transaction_id.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      db.exec(migration);

      // Update version
      const newVersion = 7;
      const versionRowAfter = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
      if (versionRowAfter) {
        db.prepare('UPDATE _meta SET value = ? WHERE key = ?').run(newVersion.toString(), 'schema_version');
      } else {
        db.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)').run('schema_version', newVersion.toString());
      }
      console.log('Migration 007 complete. Schema version: 7');
    }
  }

  // Get final version after migrations
  const finalVersionRow = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
  const finalVersion = finalVersionRow ? parseInt(finalVersionRow.value) : 0;
  return finalVersion;
}
