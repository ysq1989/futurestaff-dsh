import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('production topology excludes the Selection Center Mock and binds DSH to loopback', async () => {
  const compose = await read('docker/compose.prod.yml')
  assert.doesNotMatch(compose, /^\s{2}selection-center-mock:/m)
  assert.match(compose, /127\.0\.0\.1:\$\{DSH_PORT:-3080\}:3080/)
  assert.match(compose, /SELECTION_CENTER_BASE_URL: \$\{SELECTION_CENTER_BASE_URL:\?set SELECTION_CENTER_BASE_URL\}/)
})

test('development topology keeps the Mock internal and waits for its health check', async () => {
  const compose = await read('docker/compose.dev.yml')
  assert.match(compose, /^\s{2}selection-center-mock:/m)
  assert.doesNotMatch(compose, /3301:3301/)
  assert.match(compose, /condition: service_healthy/)
  assert.match(compose, /http:\/\/selection-center-mock:3301\//)
})

test('image pins DSH, runs unprivileged, and installs the Profile into persistent storage at startup', async () => {
  const [dockerfile, entrypoint] = await Promise.all([read('docker/Dockerfile'), read('docker/entrypoint.sh')])
  assert.match(dockerfile, /@deepseek-ai\/dsh@0\.1\.1-rc\.2/)
  assert.match(dockerfile, /ENV DSH_HOME=\/data\/dsh/)
  assert.match(dockerfile, /USER node/)
  assert.match(entrypoint, /npm run profile:install[\s\S]*exec dsh/)
})

test('image uses a configurable npm registry that is reachable from the target server', async () => {
  const dockerfile = await read('docker/Dockerfile')
  assert.match(dockerfile, /ARG NPM_REGISTRY=https:\/\/registry\.npmmirror\.com/)
  assert.match(dockerfile, /npm_config_registry=\$\{NPM_REGISTRY\}/)
  assert.match(dockerfile, /npm install --global[\s\S]*pnpm@11\.19\.0[\s\S]*@deepseek-ai\/dsh@0\.1\.1-rc\.2/)
})

test('production secrets file is excluded from Git and the container build context', async () => {
  const [gitignore, dockerignore] = await Promise.all([read('.gitignore'), read('.dockerignore')])
  assert.match(gitignore, /^\.env\.production$/m)
  assert.match(dockerignore, /^\.env\.production$/m)
})
