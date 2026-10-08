/** Export the canonical vector mark into NSIS's required opaque 24-bit bitmaps. */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
const build = fileURLToPath(new URL('../build/', import.meta.url))
const logo = await readFile(path.join(build, 'brand/website-logo.svg'), 'utf8')
async function bitmap(file, width, height, size) {
  const mark = logo.replace('<svg ', `<svg x="${(width-size)/2}" y="${height > 100 ? 36 : (height-size)/2}" width="${size}" height="${size}" `)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#eff6ff"/>${mark}</svg>`
  const rgb = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer()
  const stride = (width * 3 + 3) & ~3
  const output = Buffer.alloc(54 + stride * height)
  output.write('BM'); output.writeUInt32LE(output.length, 2); output.writeUInt32LE(54, 10)
  output.writeUInt32LE(40, 14); output.writeInt32LE(width, 18); output.writeInt32LE(height, 22)
  output.writeUInt16LE(1, 26); output.writeUInt16LE(24, 28); output.writeUInt32LE(stride * height, 34)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = (y * width + x) * 3, to = 54 + (height - 1 - y) * stride + x * 3
    output[to] = rgb[from + 2]; output[to + 1] = rgb[from + 1]; output[to + 2] = rgb[from]
  }
  await writeFile(path.join(build, file), output)
}
await bitmap('installerHeader.bmp', 150, 57, 42)
await bitmap('installerSidebar.bmp', 164, 314, 96)
