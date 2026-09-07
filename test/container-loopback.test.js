import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import test from 'node:test'

import { createLoopbackForwarder } from '../scripts/container-loopback-forwarder.mjs'

test('container forwarder exposes only the loopback-bound DSH target', async () => {
  const target = net.createServer(socket => socket.pipe(socket))
  await new Promise((resolve, reject) => {
    target.once('error', reject)
    target.listen(0, '127.0.0.1', resolve)
  })

  const targetAddress = target.address()
  assert.equal(typeof targetAddress, 'object')
  const forwarder = createLoopbackForwarder({
    targetHost: '127.0.0.1',
    targetPort: targetAddress.port,
  })
  await new Promise((resolve, reject) => {
    forwarder.once('error', reject)
    forwarder.listen(0, '127.0.0.1', resolve)
  })

  try {
    const address = forwarder.address()
    assert.equal(typeof address, 'object')
    const response = await new Promise((resolve, reject) => {
      const socket = net.connect(address.port, '127.0.0.1')
      socket.setEncoding('utf8')
      socket.once('error', reject)
      socket.once('connect', () => socket.write('futurestaff-ready'))
      socket.once('data', data => {
        socket.end()
        resolve(data)
      })
    })
    assert.equal(response, 'futurestaff-ready')
  } finally {
    await Promise.all([
      new Promise(resolve => forwarder.close(resolve)),
      new Promise(resolve => target.close(resolve)),
    ])
  }
})

test('container runs DSH on loopback behind the dedicated forwarder', async () => {
  const [dockerfile, entrypoint] = await Promise.all([
    readFile(new URL('../docker/Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../docker/entrypoint.sh', import.meta.url), 'utf8'),
  ])

  assert.match(dockerfile, /--host", "127\.0\.0\.1", "--port", "3081"/)
  assert.match(entrypoint, /container-loopback-forwarder\.mjs/)
  assert.doesNotMatch(dockerfile, /--host", "0\.0\.0\.0"/)
})
