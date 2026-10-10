import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../plugins/fs-douyin-ui/', import.meta.url))
// Bundle the business core and Zod; release Profiles need no extra npm install.
await build({ entryPoints: [root + 'src/index.ts'], outfile: root + 'lib/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', sourcemap: true })
