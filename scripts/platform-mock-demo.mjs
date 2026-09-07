import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { apply as applyPlatformAccessPlugin } from '../plugins/fs-platform-access/lib/index.js'

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
})

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FutureStaff Agent · Mock</title><style>
:root{font:16px/1.5 system-ui;color:#172033;background:#f5f7fb}body{margin:0;display:grid;min-height:100vh;place-items:center}main{width:min(680px,calc(100% - 32px))}section{background:white;border:1px solid #dbe2ef;border-radius:16px;padding:24px;box-shadow:0 18px 50px #26355418}header{display:flex;align-items:flex-start;gap:8px}header div{flex:1}h2,h3{margin:0 0 12px}p{color:#596579}button,select{font:inherit;border:1px solid #bcc7d8;border-radius:9px;background:white;padding:8px 12px}button{cursor:pointer}label{display:grid;gap:6px;margin:20px 0}ul{display:grid;gap:10px;padding:0;list-style:none}li{display:flex;justify-content:space-between;gap:12px;border:1px solid #e3e8f1;border-radius:10px;padding:12px}li span{color:#687489;font-size:.875rem}[data-mock=true]{color:#9a5b00;font-size:.875rem}[data-state=error],[data-state=expired]{border-color:#e6a7a7}
</style></head><body><main id="platform-access"></main><script type="module">
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
