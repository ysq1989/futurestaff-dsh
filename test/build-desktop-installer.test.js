import assert from 'node:assert/strict'
import test from 'node:test'
import { installerArtifactNames } from '../scripts/build-desktop-installer.mjs'

test('selects only the unsigned FutureStaff x64 setup artifact', () => {
  assert.deepEqual(installerArtifactNames([
    'builder-debug.yml',
    'FutureStaff-Agent-2.0.5-x64-Portable.zip',
    'FutureStaff-Agent-2.0.5-x64-Setup.exe',
    'FutureStaff-Agent-2.0.6-x64-Setup.exe',
    'DSH-Desktop-2.0.5-x64-Setup.exe',
  ], '2.0.6'), ['FutureStaff-Agent-2.0.6-x64-Setup.exe'])
})
