import { spawnSync } from 'node:child_process'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const script = path.join(packageRoot, 'windows', 'FutureStaffLocalRunner.iss')
const candidates = [
  path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env['ProgramFiles(x86)'] ?? '', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles ?? '', 'Inno Setup 6', 'ISCC.exe'),
]

let compiler
for (const candidate of candidates) {
  try {
    await access(candidate)
    compiler = candidate
    break
  } catch { /* try next known install scope */ }
}
if (!compiler) throw new Error('Inno Setup 6 compiler was not found')

await mkdir(path.join(repositoryRoot, 'outputs'), { recursive: true })
const compiled = spawnSync(compiler, [script], { cwd: packageRoot, stdio: 'inherit' })
if (compiled.status !== 0) throw new Error(`Inno Setup failed with exit code ${compiled.status ?? 'unknown'}`)
process.stdout.write(`${JSON.stringify({
  event: 'runner_installer_compiled',
  output: path.join(repositoryRoot, 'outputs', 'FutureStaff-Local-Runner-Alpha-Setup.exe'),
})}\n`)
