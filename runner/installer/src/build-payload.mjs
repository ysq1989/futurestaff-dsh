import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { assertSecretFreePayload, dependencyManifest, renderServiceConfig, runnerBundleBanner, sha256 } from './package-contract.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const cacheRoot = path.join(repositoryRoot, 'work', 'installer-cache')
const outputRoot = path.join(repositoryRoot, 'dist', 'runner-windows')

async function downloadPinned(item) {
  await mkdir(cacheRoot, { recursive: true })
  const destination = path.join(cacheRoot, item.fileName)
  try {
    if (await sha256(destination) === item.sha256) return destination
  } catch { /* download below */ }
  const temporary = `${destination}.partial`
  const response = await fetch(item.url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) })
  if (!response.ok || !response.body) throw new Error(`download failed with status ${response.status}`)
  await writeFile(temporary, response.body)
  const actual = await sha256(temporary)
  if (actual !== item.sha256) {
    await rm(temporary, { force: true })
    throw new Error(`checksum mismatch for ${item.fileName}`)
  }
  await rename(temporary, destination)
  return destination
}

async function inspectTextPayload(root) {
  const found = []
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      else if (/\.(?:js|mjs|json|xml|iss|txt)$/i.test(entry.name)) {
        found.push({ path: path.relative(root, absolute), content: await readFile(absolute, 'utf8') })
      }
    }
  }
  await visit(root)
  return found
}

export async function buildPayload() {
  if (process.platform !== 'win32') throw new Error('Windows payload builds require Windows')
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(path.join(outputRoot, 'app'), { recursive: true })
  await mkdir(path.join(outputRoot, 'runtime'), { recursive: true })
  await mkdir(path.join(outputRoot, 'service'), { recursive: true })

  await build({
    entryPoints: [path.join(repositoryRoot, 'runner', 'client', 'src', 'cli.ts')],
    outfile: path.join(outputRoot, 'app', 'runner.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: runnerBundleBanner },
    sourcemap: true,
    minify: false,
  })

  const nodeArchive = await downloadPinned(dependencyManifest.node)
  const extracted = path.join(cacheRoot, `node-${dependencyManifest.node.version}`)
  await rm(extracted, { recursive: true, force: true })
  await mkdir(extracted, { recursive: true })
  const extraction = spawnSync('tar.exe', ['-xf', nodeArchive, '-C', extracted], { stdio: 'inherit' })
  if (extraction.status !== 0) throw new Error('failed to extract Node.js archive')
  const nodeExecutable = path.join(extracted, `node-v${dependencyManifest.node.version}-win-x64`, 'node.exe')
  await writeFile(path.join(outputRoot, 'runtime', 'node.exe'), await readFile(nodeExecutable))

  const winSw = await downloadPinned(dependencyManifest.winSw)
  await writeFile(path.join(outputRoot, 'service', 'FutureStaffRunner.exe'), await readFile(winSw))
  await writeFile(path.join(outputRoot, 'service', 'FutureStaffRunner.xml'), renderServiceConfig(), 'utf8')
  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify({
    packageVersion: '0.1.0', node: dependencyManifest.node.version, winSw: dependencyManifest.winSw.version,
  }, null, 2)}\n`, 'utf8')

  assertSecretFreePayload(await inspectTextPayload(outputRoot))
  process.stdout.write(`${JSON.stringify({ event: 'runner_payload_built', output: outputRoot })}\n`)
  return outputRoot
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPayload()
