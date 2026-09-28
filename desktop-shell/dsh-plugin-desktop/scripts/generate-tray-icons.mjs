/** Generate native tray bitmaps from the repository-owned FutureStaff icon. */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')
const sourcePath = join(buildRoot, 'futurestaff-ai-icon.png')
const source = await sharp(sourcePath).metadata()
if (source.format !== 'png' || source.width !== 512 || source.height !== 512
  || source.channels !== 4 || source.hasAlpha !== true) {
  throw new Error('generate-tray-icons: FutureStaff source must be a transparent 512px PNG')
}

const variants = [
  ['tray-iconTemplate.png', true, 16],
  ['tray-iconTemplate@2x.png', true, 32],
  ['tray-icon-blue.png', false, 16],
  ['tray-icon-blue@1.25x.png', false, 20],
  ['tray-icon-blue@1.5x.png', false, 24],
  ['tray-icon-blue@2x.png', false, 32],
]

await Promise.all(variants.map(async ([filename, template, size]) => {
  const icon = sharp(sourcePath).resize({ width: size, height: size, fit: 'contain' })
  await (template ? icon.tint('#000000') : icon)
    .png({ compressionLevel: 9 })
    .toFile(join(buildRoot, filename))
}))
