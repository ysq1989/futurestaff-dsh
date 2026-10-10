import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const executable = fileURLToPath(new URL('../../../desktop-shell/dsh-plugin-desktop/node_modules/electron/dist/electron.exe', import.meta.url))
test('the embedded desktop Electron Node runtime can use native SQLite', { skip: !existsSync(executable) }, () => {
  const result = spawnSync(executable, ['-e', "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE probe(value TEXT) STRICT');db.prepare('INSERT INTO probe VALUES (?)').run('fixture');if(db.prepare('SELECT value FROM probe').get().value!=='fixture')process.exit(1);db.close();console.log('SQLITE_RUNTIME_OK')"],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, 'desktop SQLite runtime probe must complete successfully')
  assert.match(result.stdout, /SQLITE_RUNTIME_OK/)
})
