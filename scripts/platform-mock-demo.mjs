import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { apply as applyPlatformAccessPlugin } from '../plugins/fs-platform-access/lib/index.js'
import { platformAccessPanelCss } from '../plugins/fs-platform-access/lib/client/index.js'

const host = '127.0.0.1'
const port = 43822
const libraryRoot = join(import.meta.dirname, '..', 'plugins', 'fs-platform-access', 'lib')
const bridgeRoutes = new Map()
applyPlatformAccessPlugin({
  effect: register => { register() },
  webServer: {
    register: route => {
      bridgeRoutes.set(route.path, route.handler)
      return () => { bridgeRoutes.delete(route.path) }
    },
  },
}, { embeddedMock: true })

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FutureStaff Agent · Mock</title><style>
:root{font:16px/1.5 system-ui;color:#172033;background:#f5f7fb}body{margin:0;min-height:100vh;padding:48px 24px}main{width:min(880px,100%);margin:auto}${platformAccessPanelCss}
</style></head><body><main id="platform-access" class="futurestaff-access"></main><script type="module">
import { InMemoryTenantResources, PlatformAccessController, PlatformMockApi, mountPlatformAccessPanel } from '/lib/index.js'
const sameOriginMockFetch = (input, init) => fetch('/mock' + new URL(input).pathname, init)
const controller = new PlatformAccessController(new PlatformMockApi(sameOriginMockFetch), new InMemoryTenantResources())
mountPlatformAccessPanel(document.querySelector('#platform-access'), controller)
</script></body></html>`

async function serveModule(response, path) {
  const relative = normalize(path.slice('/lib/'.length))
  if (relative.startsWith('..') || extname(relative) !== '.js') {
    response.writeHead(404).end()
    return
  }
  try {
    const source = await readFile(join(libraryRoot, relative))
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
    response.end(source)
  } catch {
    response.writeHead(404).end()
  }
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://${host}:${port}`).pathname
  if (request.method === 'GET' && path === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(html)
    return
  }
  if (request.method === 'GET' && path.startsWith('/lib/')) {
    void serveModule(response, path)
    return
  }
  if (path.startsWith('/mock/')) {
    const handler = bridgeRoutes.get(`/_futurestaff/platform-mock${path.slice('/mock'.length)}`)
    if (handler !== undefined) void handler(request, response)
    else response.writeHead(404).end()
    return
  }
  response.writeHead(404).end()
})

server.listen(port, host, () => {
  console.log(`FutureStaff Agent Mock panel: http://${host}:${port}`)
})
