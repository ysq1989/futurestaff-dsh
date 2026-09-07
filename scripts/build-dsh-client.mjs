import { build } from 'esbuild'
import path from 'node:path'

const [packageRootArg, packageId] = process.argv.slice(2)
if (packageRootArg === undefined || packageId === undefined) {
  throw new Error('usage: build-dsh-client.mjs <package-root> <package-id>')
}

const packageRoot = path.resolve(packageRootArg)
await build({
  entryPoints: [path.join(packageRoot, 'src', 'client', 'index.tsx')],
  outfile: path.join(packageRoot, 'lib', 'client.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  sourcemap: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-layout/client',
    '@deepseek-ai/dsh-client-ui-renderer/client',
    '@deepseek-ai/dsh-client-ui-settings/client',
    '@deepseek-ai/dsh-client-ui-sidebar/client',
    'react',
    'react/jsx-runtime',
  ],
  banner: {
    js: `window.__ModuleLoader__.load({id:${JSON.stringify(packageId)},factory:(require)=>{var module={exports:{}};var exports=module.exports;`,
  },
  footer: { js: 'return module.exports;}});' },
  logLevel: 'info',
})
