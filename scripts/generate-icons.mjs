import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const sourcePath = join(root, 'src/renderer/src/assets/receipt-fold-logo.svg')
const buildDirectory = join(root, 'build')
const iconsetDirectory = join(buildDirectory, 'ReceiptFold.iconset')
const svg = await readFile(sourcePath)
const png = await sharp(svg).resize(1024, 1024).png().toBuffer()

await mkdir(buildDirectory, { recursive: true })
await mkdir(join(root, 'resources'), { recursive: true })
await writeFile(join(buildDirectory, 'icon.png'), png)
await writeFile(join(root, 'resources/icon.png'), png)

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoImages = await Promise.all(icoSizes.map(async (size) => ({
  size,
  bytes: await sharp(png).resize(size, size).png().toBuffer()
})))
const header = Buffer.alloc(6 + icoImages.length * 16)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoImages.length, 4)
let offset = header.length
icoImages.forEach(({ size, bytes }, index) => {
  const entryOffset = 6 + index * 16
  header.writeUInt8(size === 256 ? 0 : size, entryOffset)
  header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1)
  header.writeUInt8(0, entryOffset + 2)
  header.writeUInt8(0, entryOffset + 3)
  header.writeUInt16LE(1, entryOffset + 4)
  header.writeUInt16LE(32, entryOffset + 6)
  header.writeUInt32LE(bytes.length, entryOffset + 8)
  header.writeUInt32LE(offset, entryOffset + 12)
  offset += bytes.length
})
await writeFile(join(buildDirectory, 'icon.ico'), Buffer.concat([header, ...icoImages.map(({ bytes }) => bytes)]))

if (process.platform === 'darwin') {
  await rm(iconsetDirectory, { recursive: true, force: true })
  await mkdir(iconsetDirectory, { recursive: true })
  const iconSizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]
  await Promise.all(iconSizes.map(async ([name, size]) => {
    const bytes = await sharp(png).resize(Number(size), Number(size)).png().toBuffer()
    await writeFile(join(iconsetDirectory, String(name)), bytes)
  }))
  await run('iconutil', ['-c', 'icns', '-o', join(buildDirectory, 'icon.icns'), iconsetDirectory])
  await rm(iconsetDirectory, { recursive: true, force: true })
} else {
  console.warn('macOS .icns generation requires iconutil; existing build/icon.icns was left unchanged.')
}

console.info('Generated build/icon.png, build/icon.ico, build/icon.icns when available, and resources/icon.png.')
