import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { exportInstallerArtifact, installerArtifactNames } from '../scripts/build-desktop-installer.mjs'

test('selects only the unsigned FutureStaff x64 setup artifact', () => {
  assert.deepEqual(installerArtifactNames([
    'builder-debug.yml',
    'FutureStaff-Agent-2.0.5-x64-Portable.zip',
    'FutureStaff-Agent-2.0.5-x64-Setup.exe',
    'FutureStaff-Agent-2.0.6-x64-Setup.exe',
    'DSH-Desktop-2.0.5-x64-Setup.exe',
  ], '2.0.6'), ['FutureStaff-Agent-2.0.6-x64-Setup.exe'])
})

test('refuses to overwrite an existing installer artifact', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'futurestaff-installer-'))
  const source = path.join(directory, 'source.exe')
  const target = path.join(directory, 'target.exe')

  try {
    await writeFile(source, 'new candidate')
    await writeFile(target, 'historical candidate')

    await assert.rejects(exportInstallerArtifact(source, target), { code: 'EEXIST' })
    assert.equal(await readFile(target, 'utf8'), 'historical candidate')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
