import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('production topology excludes the Selection Center Mock and binds DSH to loopback', async () => {
  const compose = await read('docker/compose.prod.yml')
  assert.doesNotMatch(compose, /^\s{2}selection-center-mock:/m)
  assert.match(compose, /127\.0\.0\.1:\$\{DSH_PORT:-3080\}:3080/)
  assert.match(compose, /PRODUCT_HUB_MCP_URL: \$\{PRODUCT_HUB_MCP_URL:\?set PRODUCT_HUB_MCP_URL\}/)
  assert.match(compose, /FUTURESTAFF_IDENTITY_MODE: \$\{FUTURESTAFF_IDENTITY_MODE:\?set FUTURESTAFF_IDENTITY_MODE to single-subject\}/)
  assert.match(compose, /SELECTION_CENTER_BASE_URL: \$\{SELECTION_CENTER_BASE_URL:-\}/)
})

test('Alpha declares a fail-closed single-subject identity boundary', async () => {
  const [profile, development, production, envExample] = await Promise.all([
    read('profile/futurestaff-alpha/cordis.patch.yml'),
    read('docker/compose.dev.yml'),
    read('docker/compose.prod.yml'),
    read('.env.example'),
  ])
  assert.match(profile, /identityMode: !!js process\.env\.FUTURESTAFF_IDENTITY_MODE/)
  assert.match(development, /FUTURESTAFF_IDENTITY_MODE: \$\{FUTURESTAFF_IDENTITY_MODE:-single-subject\}/)
  assert.match(production, /FUTURESTAFF_IDENTITY_MODE: \$\{FUTURESTAFF_IDENTITY_MODE:\?set FUTURESTAFF_IDENTITY_MODE to single-subject\}/)
  assert.match(envExample, /^FUTURESTAFF_IDENTITY_MODE=single-subject$/m)
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
  assert.match(dockerfile, /COPY runner \.\/runner/)
  assert.doesNotMatch(dockerfile, /COPY test \.\/test/)
  assert.match(packageJson, /"check:workspaces"/)
})

test('production secrets file is excluded from Git and the container build context', async () => {
  const [gitignore, dockerignore] = await Promise.all([read('.gitignore'), read('.dockerignore')])
  assert.match(gitignore, /^\.env\.production$/m)
  assert.match(dockerignore, /^\.env\.production$/m)
})

test('Runner gateway is opt-in, loopback-only, and uses a read-only binding file', async () => {
  const [development, production, nginx] = await Promise.all([
    read('docker/compose.dev.yml'), read('docker/compose.prod.yml'), read('docker/nginx/futurestaff.conf.example'),
  ])
  for (const compose of [development, production]) {
    assert.match(compose, /^\s{2}runner-gateway:/m)
    assert.match(compose, /profiles: \["runner"\]/)
    assert.match(compose, /127\.0\.0\.1:\$\{RUNNER_GATEWAY_PORT:-3090\}:3090/)
    assert.match(compose, /runner-bindings\.json:ro/)
  }
  assert.doesNotMatch(nginx, /runner\/v1\/connect/)
})

test('Runner workspaces declare clean-build dependency order', async () => {
  const [client, gateway, router] = await Promise.all([
    read('runner/client/package.json'), read('runner/gateway/package.json'), read('runner/router/package.json'),
  ])
  assert.match(client, /build -w @futurestaff\/local-runner-protocol/)
  assert.match(gateway, /build -w @futurestaff\/local-runner-protocol[\s\S]*build -w @futurestaff\/local-runner-router/)
  assert.match(router, /build -w @futurestaff\/local-runner-protocol/)
})

test('Runner Nginx snippet bypasses Basic Auth only for the exact authenticated gateway route', async () => {
  const snippet = await read('docker/nginx/runner-location.conf.example')
  assert.match(snippet, /location = \/runner\/v1\/connect/)
  assert.match(snippet, /auth_basic off/)
  assert.match(snippet, /proxy_pass http:\/\/127\.0\.0\.1:3090/)
  assert.match(snippet, /proxy_set_header Authorization \$http_authorization/)
})

test('Profile mounts only the fixed Local Runner MCP contract when private dispatch is configured', async () => {
  const [profile, development] = await Promise.all([
    read('profile/futurestaff-alpha/cordis.patch.yml'), read('docker/compose.dev.yml'),
  ])
  assert.match(profile, /id: mcp-local-runner/)
  assert.match(profile, /args: \['mcp\/local-runner\/lib\/stdio\.js'\]/)
  assert.match(profile, /RUNNER_GATEWAY_INTERNAL_URL/)
  assert.match(profile, /RUNNER_DISPATCH_TOKEN/)
  assert.match(development, /RUNNER_DISPATCH_TOKEN: \$\{RUNNER_DISPATCH_TOKEN:-\}/)
  assert.match(development, /RUNNER_ID: \$\{RUNNER_ID:-\}/)
})
