import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('production topology excludes the Selection Center Mock and binds DSH to loopback', async () => {
  const compose = await read('docker/compose.prod.yml')
  assert.doesNotMatch(compose, /^\s{2}selection-center-mock:/m)
  assert.match(compose, /127\.0\.0\.1:\$\{DSH_PORT:-3080\}:3080/)
  assert.match(compose, /PRODUCT_HUB_MCP_URL: \$\{PRODUCT_HUB_MCP_URL:\?set PRODUCT_HUB_MCP_URL\}/)
  assert.match(compose, /SELECTION_CENTER_BASE_URL: \$\{SELECTION_CENTER_BASE_URL:-\}/)
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

test('container forwards the configured public domain to the DSH trusted-host fence', async () => {
  const [entrypoint, development, production, envExample] = await Promise.all([
    read('docker/entrypoint.sh'),
    read('docker/compose.dev.yml'),
    read('docker/compose.prod.yml'),
    read('.env.example'),
  ])

  assert.match(entrypoint, /DSH_TRUSTED_HOST/)
  assert.match(entrypoint, /--trusted-host/)
  assert.match(development, /DSH_TRUSTED_HOST: \$\{DSH_TRUSTED_HOST:-dsh\.fsstory\.net\}/)
  assert.match(production, /DSH_TRUSTED_HOST: \$\{DSH_TRUSTED_HOST:\?set DSH_TRUSTED_HOST\}/)
  assert.match(envExample, /^DSH_TRUSTED_HOST=dsh\.fsstory\.net$/m)
})

test('Alpha Profile prefers the authenticated Product Hub Streamable HTTP MCP', async () => {
  const [profile, development, production, envExample] = await Promise.all([
    read('profile/futurestaff-alpha/cordis.patch.yml'),
    read('docker/compose.dev.yml'),
    read('docker/compose.prod.yml'),
    read('.env.example'),
  ])

  assert.match(profile, /id: mcp-product-hub/)
  assert.match(profile, /serverName: product-hub/)
  assert.match(profile, /transport: streamable-http/)
  assert.match(profile, /PRODUCT_HUB_MCP_URL/)
  assert.match(profile, /PRODUCT_HUB_AGENT_KEY/)
  assert.match(development, /PRODUCT_HUB_MCP_URL/)
  assert.match(production, /PRODUCT_HUB_MCP_URL: \$\{PRODUCT_HUB_MCP_URL:\?set PRODUCT_HUB_MCP_URL\}/)
  assert.match(envExample, /^PRODUCT_HUB_MCP_URL=$/m)
  assert.match(envExample, /^PRODUCT_HUB_AGENT_KEY=$/m)
})

test('image uses a configurable npm registry that is reachable from the target server', async () => {
  const dockerfile = await read('docker/Dockerfile')
  assert.match(dockerfile, /ARG NPM_REGISTRY=https:\/\/registry\.npmmirror\.com/)
  assert.match(dockerfile, /npm_config_registry=\$\{NPM_REGISTRY\}/)
  assert.match(dockerfile, /npm install --global[\s\S]*pnpm@11\.19\.0[\s\S]*@deepseek-ai\/dsh@0\.1\.1-rc\.2/)
})

test('image builds workspace declarations before running checks in a clean context', async () => {
  const [dockerfile, packageJson] = await Promise.all([read('docker/Dockerfile'), read('package.json')])
  assert.match(dockerfile, /RUN npm ci[\s\S]*&& npm run build[\s\S]*&& npm run check/)
  assert.match(dockerfile, /npm run check:workspaces/)
  assert.doesNotMatch(dockerfile, /COPY test \.\/test/)
  assert.match(packageJson, /"check:workspaces"/)
})

test('production secrets file is excluded from Git and the container build context', async () => {
  const [gitignore, dockerignore] = await Promise.all([read('.gitignore'), read('.dockerignore')])
  assert.match(gitignore, /^\.env\.production$/m)
  assert.match(dockerignore, /^\.env\.production$/m)
})
