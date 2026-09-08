import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stageDesktopRelease } from './stage-desktop-release.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function installerArtifactNames(files, version) {
  const expected = `FutureStaff-Agent-${version}-x64-Setup.exe`
  return files.filter(name => name === expected)
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

export async function buildDesktopInstaller() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`FutureStaff Windows installer requires a native win32/x64 host; received ${process.platform}/${process.arch}`)
  }
  const staged = await stageDesktopRelease()
  const desktopRoot = path.join(staged.checkout, 'dsh-plugin-desktop')
  const command = process.env.ComSpec ?? 'cmd.exe'
  execFileSync(command, ['/d', '/s', '/c', 'corepack yarn dist:win'], {
    cwd: staged.checkout,
    stdio: 'inherit',
    env: process.env,
  })
  const desktopOutput = path.join(desktopRoot, 'dist')
  const desktopManifest = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'))
  const names = installerArtifactNames(await readdir(desktopOutput), desktopManifest.version)
  if (names.length !== 1) throw new Error(`expected one FutureStaff installer, found ${names.length}`)
  const source = path.join(desktopOutput, names[0])
  const info = await stat(source)
  if (!info.isFile() || info.size < 1024 * 1024) throw new Error('FutureStaff installer artifact is missing or unexpectedly small')
  const output = path.join(root, 'outputs')
  await mkdir(output, { recursive: true })
  const target = path.join(output, names[0])
  await copyFile(source, target)
  const digest = await sha256(target)
  await writeFile(`${target}.sha256`, `${digest}  ${names[0]}\n`)
  console.log(`Exported unsigned private Alpha installer: ${target}`)
  console.log(`SHA-256: ${digest}`)
  return { target, digest, size: info.size }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildDesktopInstaller()
}
