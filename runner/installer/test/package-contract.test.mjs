import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  assertSecretFreePayload,
  dependencyManifest,
  renderServiceConfig,
  runnerBundleBanner,
} from '../src/package-contract.mjs'

test('pins every downloaded runtime dependency with a SHA-256 digest', () => {
  assert.match(dependencyManifest.node.version, /^22\.\d+\.\d+$/)
  assert.match(dependencyManifest.node.url, /^https:\/\/nodejs\.org\/dist\//)
  assert.match(dependencyManifest.node.sha256, /^[a-f0-9]{64}$/)
  assert.match(dependencyManifest.winSw.version, /^2\.\d+\.\d+$/)
  assert.match(dependencyManifest.winSw.url, /^https:\/\/github\.com\/winsw\/winsw\/releases\/download\//)
  assert.match(dependencyManifest.winSw.sha256, /^[a-f0-9]{64}$/)
})

test('bundled ESM runner can load CommonJS Node built-ins', () => {
  assert.match(runnerBundleBanner, /createRequire/)
  assert.match(runnerBundleBanner, /import\.meta\.url/)
})

test('rejects credentials and identity from a staged installer payload', () => {
  assert.doesNotThrow(() => assertSecretFreePayload([
    { path: 'app/runner.mjs', content: 'connectRunner(config)' },
    { path: 'service/FutureStaffRunner.xml', content: '<service />' },
  ]))
  for (const secret of [
    'RUNNER_DEVICE_TOKEN=top-secret-value',
    'RUNNER_TENANT_ID=tenant-a',
    'RUNNER_USER_ID=user-a',
    'RUNNER_ENROLLMENT_CODE=one-time-code',
    'DEEPSEEK_API_KEY=secret',
  ]) {
    assert.throws(
      () => assertSecretFreePayload([{ path: 'payload/config.env', content: secret }]),
      /payload contains forbidden configuration/i,
    )
  }
})

test('renders an automatic, restricted and restartable service contract', () => {
  const xml = renderServiceConfig()
  assert.match(xml, /<id>FutureStaffLocalRunner<\/id>/)
  assert.match(xml, /<executable>%BASE%\\\.\.\\runtime\\node\.exe<\/executable>/)
  assert.match(xml, /<arguments>--enable-source-maps &quot;%BASE%\\\.\.\\app\\runner\.mjs&quot;<\/arguments>/)
  assert.match(xml, /<workingdirectory>%BASE%\\\.\.<\/workingdirectory>/)
  assert.match(xml, /<serviceaccount>\s*<username>NT AUTHORITY\\LocalService<\/username>/)
  assert.match(xml, /<startmode>Automatic<\/startmode>/)
  assert.match(xml, /<onfailure action="restart" delay="10 sec"\/>/)
  assert.match(xml, /<log mode="roll-by-size">/)
  assert.doesNotMatch(xml, /token|tenant|userId|enrollment/i)
})

test('installer collects enrollment without exposing it on a process command line', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const script = await readFile(path.join(root, 'windows', 'FutureStaffLocalRunner.iss'), 'utf8')
  assert.match(script, /PrivilegesRequired=admin/)
  assert.match(script, /CreateInputQueryPage/)
  assert.match(script, /Add\('一次性绑定码:', True\)/)
  assert.match(script, /bootstrap\.json/)
  assert.match(script, /icacls\.exe/)
  assert.match(script, /FutureStaffRunner\.exe"; Parameters: "install"/)
  assert.match(script, /FutureStaffRunner\.exe"; Parameters: "start"/)
  assert.doesNotMatch(script, /Parameters:.*EnrollmentPage\.Values/i)
})
