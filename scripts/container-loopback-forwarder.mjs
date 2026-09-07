import { spawn } from 'node:child_process'
import net from 'node:net'
import { pathToFileURL } from 'node:url'

export function createLoopbackForwarder({ targetHost, targetPort }) {
  return net.createServer(inbound => {
    const outbound = net.connect(targetPort, targetHost)
    inbound.on('error', () => outbound.destroy())
    outbound.on('error', () => inbound.destroy())
    inbound.pipe(outbound)
    outbound.pipe(inbound)
  })
}

function configuredPort(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a valid TCP port`)
  }
  return value
}

async function main() {
  const listenPort = configuredPort('FUTURESTAFF_PROXY_PORT', 3080)
  const targetPort = configuredPort('FUTURESTAFF_DSH_LOOPBACK_PORT', 3081)
  const forwarder = createLoopbackForwarder({
    targetHost: '127.0.0.1',
    targetPort,
  })

  await new Promise((resolve, reject) => {
    forwarder.once('error', reject)
    forwarder.listen(listenPort, '0.0.0.0', resolve)
  })
  console.log(JSON.stringify({ event: 'container_loopback_forwarder_started', listenPort, targetPort }))

  const child = spawn('dsh', process.argv.slice(2), { stdio: 'inherit' })
  const forwardSignal = signal => {
    if (!child.killed) child.kill(signal)
  }
  process.once('SIGINT', () => forwardSignal('SIGINT'))
  process.once('SIGTERM', () => forwardSignal('SIGTERM'))

  child.once('error', error => {
    console.error(`failed to start dsh: ${error.message}`)
    forwarder.close()
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    forwarder.close()
    forwarder.closeAllConnections?.()
    process.exitCode = code ?? (signal === null ? 0 : 1)
  })
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch(error => {
    console.error(`container loopback forwarder failed: ${error.message}`)
    process.exitCode = 1
  })
}
