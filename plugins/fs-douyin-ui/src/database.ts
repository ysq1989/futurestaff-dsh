import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { WorkspaceStore } from '@futurestaff/douyin-dm-mcp/lead-workspace'

/** Local schema, independent of the Platform PostgreSQL schema and migrations. */
export class LeadDatabase {
  private db: DatabaseSync
  private locks = new Set<string>()
  constructor(filename: string) {
    if (filename !== ':memory:') {
      if (!path.isAbsolute(filename)) throw new Error('DATABASE_PATH_REQUIRED')
      mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
    }
    this.db = new DatabaseSync(filename, { timeout: 5000 })
    try {
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;')
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version)
      if (version > 1) throw new Error('DATABASE_VERSION_UNSUPPORTED')
      if (version === 0) this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE lead_state (owner TEXT NOT NULL, namespace TEXT NOT NULL, payload TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner, namespace)) STRICT;
        PRAGMA user_version=1; COMMIT;`)
    } catch (error) { this.db.close(); throw error }
  }
  // Optimistic revisions detect another Host writing the same principal's state.
  store(owner: string, namespace: string): WorkspaceStore {
    if (!/^[a-f0-9]{64}$/.test(owner) || !/^[a-z-]{1,40}$/.test(namespace)) throw new Error('DATABASE_SCOPE_INVALID')
    const lock = `${owner}:${namespace}`
    if (this.locks.has(lock)) throw new Error('DATABASE_STORE_ALREADY_OPEN')
    this.locks.add(lock)
    let revision = -1
    return {
      load: async () => {
        const row = this.db.prepare('SELECT payload, revision FROM lead_state WHERE owner=? AND namespace=?').get(owner, namespace)
        revision = row ? Number(row.revision) : -1
        return row ? JSON.parse(String(row.payload)) as unknown : null
      },
      save: async value => {
        const payload = JSON.stringify(value)
        this.db.exec('BEGIN IMMEDIATE')
        try {
          const row = this.db.prepare('SELECT revision FROM lead_state WHERE owner=? AND namespace=?').get(owner, namespace)
          if ((row ? Number(row.revision) : -1) !== revision) throw new Error('DATABASE_CONCURRENT_WRITE')
          this.db.prepare(`INSERT INTO lead_state(owner,namespace,payload,revision) VALUES(?,?,?,?)
            ON CONFLICT(owner,namespace) DO UPDATE SET payload=excluded.payload, revision=excluded.revision`).run(owner, namespace, payload, revision + 1)
          this.db.exec('COMMIT'); revision++
        } catch (error) { this.db.exec('ROLLBACK'); throw error }
      },
    }
  }
  close() { this.db.close() }
}
