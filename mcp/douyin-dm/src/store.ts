import { mkdir, open, readFile, rename, rm, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
import type { Store } from './engine.js'

export class FileStore implements Store {
  private lock: FileHandle | undefined
  constructor(private filename: string) {}
  async acquire() {
    await mkdir(path.dirname(this.filename), { recursive: true })
    this.lock = await open(`${this.filename}.lock`, 'wx', 0o600)
    await this.lock.writeFile(String(process.pid))
  }
  async load() {
    try { return JSON.parse(await readFile(this.filename, 'utf8')) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error('STATE_INVALID') }
  }
  async save(state: unknown) {
    if (!this.lock) throw new Error('STATE_NOT_LOCKED')
    const temporary = `${this.filename}.tmp`
    const handle = await open(temporary, 'w', 0o600)
    try { await handle.writeFile(JSON.stringify(state)); await handle.sync() } finally { await handle.close() }
    await rename(temporary, this.filename)
  }
  async close() {
    if (!this.lock) return
    await this.lock.close(); this.lock = undefined
    await rm(`${this.filename}.lock`)
  }
}
