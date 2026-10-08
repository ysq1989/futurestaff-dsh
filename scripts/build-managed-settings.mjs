import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../plugins/fs-platform-access/', import.meta.url))
// Ship the same pinned file provider inside the product extension; no new install-time dependencies.
await build({ entryPoints: [path.join(root, 'src/managed-settings.ts')], outfile: path.join(root, 'lib/managed-settings.js'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: true,
  external: ['@deepseek-ai/cordis'], banner: { js: "import { createRequire as __fsCreateRequire } from 'node:module'; const require = __fsCreateRequire(import.meta.url);" } })
