import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = path.resolve(root, process.env.DSH_HOME || '.dsh')
const source = path.join(root, 'profile', 'futurestaff-alpha')
const target = path.join(dshHome, 'profiles', 'futurestaff-alpha')
const plugin = path.join(root, 'plugins', 'fs-core').replaceAll('\\', '/')

await mkdir(path.dirname(target), { recursive: true })
await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })

const manifestPath = path.join(target, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.dependencies['@futurestaff/fs-core'] = `file:${plugin}`
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
execFileSync(npmCommand, ['install', '--ignore-scripts'], { cwd: target, stdio: 'inherit' })
console.log(`Installed futurestaff-alpha at ${target}`)
