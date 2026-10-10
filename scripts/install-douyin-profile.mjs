import { cp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Isolate conversation storage as well as the Profile. Do not replace an existing setup.
const home = path.join(root, '.dsh', 'douyin-private-home')
const target = path.join(home, 'profiles', 'douyin-private')
await mkdir(path.dirname(target), { recursive: true })
await mkdir(target) // EEXIST protects an operator's configured Profile.
const source = path.join(root, 'profile', 'douyin-private')
for (const entry of await readdir(source)) {
  await cp(path.join(source, entry), path.join(target, entry), { recursive: true, force: false, errorOnExist: true })
}
const plugin = path.join(root, 'plugins', 'fs-core')
const filename = path.join(target, 'package.json')
const manifest = JSON.parse(await readFile(filename, 'utf8'))
manifest.dependencies['@futurestaff/fs-core'] = `file:${plugin.replaceAll('\\', '/')}`
await writeFile(filename, JSON.stringify(manifest, null, 2) + '\n')
await mkdir(path.join(target, 'node_modules', '@futurestaff'), { recursive: true })
await symlink(plugin, path.join(target, 'node_modules', '@futurestaff', 'fs-core'), process.platform === 'win32' ? 'junction' : 'dir')
console.log(`Isolated DSH_HOME: ${home}`)
console.log(`MCP entry: ${path.join(root, 'mcp', 'douyin-dm', 'lib', 'stdio.js')}`)
console.log('No browser or DSH process started. Set the private config and trusted single-subject identifiers before launching.')
