import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import jsQR from 'jsqr'
import sharp from 'sharp'
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import { emptyInvoiceDetails, emptyInvoiceParty, ocrModelPresets, type AppInfo, type ImportProgress, type Invoice, type InvoiceDetails, type InvoicePatch, type OcrModelPreset, type OcrSettings, type StorageInfo } from '../common/contracts'
import { LocalInvoiceDatabase } from './invoice-database'
import { parseOcr, structuredInvoiceFieldDescriptions } from './invoice-parser'
import type { StructuredInvoiceFields } from './invoice-parser'
import { OcrWorkerClient } from './ocr-worker-client'
import { StructuredFieldsWorkerClient } from './structured-fields-worker-client'
import { checkForUpdates, checkForUpdatesOnStartup, getUpdateStatus, installDownloadedUpdate, setupUpdater } from './updater'

const applicationName = '发票夹'
app.setName(applicationName)
app.setPath('userData', join(app.getPath('appData'), 'receipt-fold'))

const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff']

const ocrWorker = new OcrWorkerClient(join(__dirname, 'ocr-worker.js'))
const runtimeExecutableName = process.platform === 'win32' ? 'node.exe' : 'node'
const structuredFieldsWorkerPath = app.isPackaged
  ? join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'structured-fields-worker.js')
  : join(__dirname, 'structured-fields-worker.js')
const standaloneNodePath = app.isPackaged
  ? join(process.resourcesPath, 'node-runtime', runtimeExecutableName)
  : join(app.getAppPath(), 'node_modules', 'node', 'bin', runtimeExecutableName)
const structuredFieldsWorker = new StructuredFieldsWorkerClient(structuredFieldsWorkerPath, standaloneNodePath)
let selectedOcrModelPreset: OcrModelPreset = 'small'
let structuredExtractionEnabled = false
let ocrSettingsLoaded = false
let ocrModelSwitching = false
let invoiceImportActive = false
let invoiceDatabase: LocalInvoiceDatabase | null = null
let shutdownRequested = false
let shutdownStarted = false
let shutdownComplete = false
let activeIpcHandlers = 0
let resolveIpcHandlersDrained: (() => void) | null = null

type IpcHandler = Parameters<typeof ipcMain.handle>[1]

function handleIpc(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (shutdownRequested) throw new Error('应用正在退出。')
    activeIpcHandlers += 1
    try {
      return await handler(event, ...args)
    } finally {
      activeIpcHandlers -= 1
      if (activeIpcHandlers === 0) {
        resolveIpcHandlersDrained?.()
        resolveIpcHandlersDrained = null
      }
    }
  })
}

function waitForIpcHandlers(): Promise<void> {
  if (activeIpcHandlers === 0) return Promise.resolve()
  return new Promise((resolve) => {
    resolveIpcHandlersDrained = resolve
  })
}

function dataDirectory(): string {
  return join(app.getPath('userData'), 'receipt-fold')
}

function invoiceDirectory(): string {
  return join(dataDirectory(), 'invoices')
}

function legacyDatabasePath(): string {
  return join(dataDirectory(), 'invoices.json')
}

function sqliteDatabasePath(): string {
  return join(dataDirectory(), 'invoices.sqlite')
}

function ocrSettingsPath(): string {
  return join(dataDirectory(), 'ocr-settings.json')
}

function ocrModelDirectory(): string {
  return join(dataDirectory(), 'models')
}

function isOcrModelPreset(value: unknown): value is OcrModelPreset {
  return ocrModelPresets.some((preset) => preset.value === value)
}

async function loadOcrSettings(): Promise<void> {
  if (ocrSettingsLoaded) return
  try {
    const saved: unknown = JSON.parse(await readFile(ocrSettingsPath(), 'utf8'))
    if (saved && typeof saved === 'object') {
      if ('modelPreset' in saved && isOcrModelPreset(saved.modelPreset)) selectedOcrModelPreset = saved.modelPreset
      if ('structuredExtractionEnabled' in saved && typeof saved.structuredExtractionEnabled === 'boolean') {
        structuredExtractionEnabled = saved.structuredExtractionEnabled
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
  }
  ocrSettingsLoaded = true
}

async function getDirectorySize(directory: string): Promise<number> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
  const sizes = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return getDirectorySize(path)
    if (!entry.isFile()) return 0
    try {
      return (await stat(path)).size
    } catch {
      return 0
    }
  }))
  return sizes.reduce((total, size) => total + size, 0)
}

async function getOcrSettings(): Promise<OcrSettings> {
  await loadOcrSettings()
  return {
    modelPreset: selectedOcrModelPreset,
    structuredExtractionEnabled,
    modelStorageBytes: await getDirectorySize(ocrModelDirectory())
  }
}

async function saveOcrSettings(): Promise<void> {
  await mkdir(dataDirectory(), { recursive: true })
  const target = ocrSettingsPath()
  const temporary = `${target}.tmp`
  await writeFile(temporary, JSON.stringify({ modelPreset: selectedOcrModelPreset, structuredExtractionEnabled }, null, 2), 'utf8')
  await rename(temporary, target)
}

async function ensureStorage(): Promise<void> {
  await mkdir(invoiceDirectory(), { recursive: true })
}

async function readInvoices(): Promise<Invoice[]> {
  await ensureStorage()
  if (!invoiceDatabase) throw new Error('本地发票数据库尚未准备好。')
  const parsed = await invoiceDatabase.listInvoices()
  return parsed.map(normalizeInvoice).filter((invoice): invoice is Invoice => invoice !== null)
}

function normalizeInvoice(value: unknown): Invoice | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<Invoice>
  const text = typeof raw.text === 'string' ? raw.text : ''
  const base = emptyInvoiceDetails()
  const rawDetails = (raw.details && typeof raw.details === 'object' ? raw.details : {}) as Partial<InvoiceDetails>
  const migratedDetails = !raw.details && text ? parseOcr(text.split(/\n+/).filter(Boolean), []).details : base
  const details = {
    ...migratedDetails,
    ...rawDetails,
    buyer: { ...emptyInvoiceParty(), ...migratedDetails.buyer, ...rawDetails.buyer },
    seller: { ...emptyInvoiceParty(), ...migratedDetails.seller, ...rawDetails.seller },
    items: Array.isArray(rawDetails.items) ? rawDetails.items : migratedDetails.items,
    extraFields: Array.isArray(rawDetails.extraFields) ? rawDetails.extraFields : migratedDetails.extraFields
  }
  if (!details.buyer.name) details.buyer.name = raw.buyer ?? ''
  if (!details.seller.name) details.seller.name = raw.seller ?? ''
  const ocrLines = Array.isArray(raw.ocrLines) ? raw.ocrLines : text.split(/\n+/).filter(Boolean).map((line) => ({
    text: line,
    confidence: Number(raw.confidence) || 0,
    box: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] as const
  }))
  return {
    ...raw,
    ocrLines,
    details,
    text
  } as Invoice
}

async function writeInvoices(invoices: Invoice[]): Promise<void> {
  await ensureStorage()
  if (!invoiceDatabase) throw new Error('本地发票数据库尚未准备好。')
  await invoiceDatabase.replaceInvoices(invoices)
}

async function setOcrModelPreset(preset: unknown): Promise<OcrSettings> {
  await loadOcrSettings()
  if (!isOcrModelPreset(preset)) throw new TypeError('不支持的 OCR 模型规格。')
  if (invoiceImportActive) throw new Error('发票导入完成后才能切换模型。')
  if (ocrModelSwitching) throw new Error('模型正在切换，请稍候。')

  ocrModelSwitching = true
  try {
    if (preset !== selectedOcrModelPreset) {
      await ocrWorker.closeOcr()
      const previousPreset = selectedOcrModelPreset
      selectedOcrModelPreset = preset
      try {
        await saveOcrSettings()
      } catch (error) {
        selectedOcrModelPreset = previousPreset
        throw error
      }
    }
    return getOcrSettings()
  } finally {
    ocrModelSwitching = false
  }
}

async function setStructuredExtraction(enabled: unknown): Promise<OcrSettings> {
  await loadOcrSettings()
  if (typeof enabled !== 'boolean') throw new TypeError('结构化字段识别设置无效。')
  if (invoiceImportActive) throw new Error('发票导入完成后才能切换结构化字段识别。')
  if (ocrModelSwitching) throw new Error('识别设置正在切换，请稍候。')

  ocrModelSwitching = true
  try {
    if (enabled !== structuredExtractionEnabled) {
      if (!enabled) await structuredFieldsWorker.close()
      const previousValue = structuredExtractionEnabled
      structuredExtractionEnabled = enabled
      try {
        await saveOcrSettings()
      } catch (error) {
        structuredExtractionEnabled = previousValue
        throw error
      }
    }
    return getOcrSettings()
  } finally {
    ocrModelSwitching = false
  }
}

async function readQrCode(imagePath: string): Promise<string> {
  try {
    const { data, info } = await sharp(imagePath)
      .rotate()
      .resize({ width: 2800, height: 2800, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
    return jsQR(pixels, info.width, info.height, { inversionAttempts: 'dontInvert' })?.data ?? ''
  } catch {
    return ''
  }
}

function mimeTypeFor(extension: string): string {
  const normalized = extension.toLowerCase()
  if (normalized === '.png') return 'image/png'
  if (normalized === '.webp') return 'image/webp'
  if (normalized === '.bmp') return 'image/bmp'
  if (normalized === '.tif' || normalized === '.tiff') return 'image/tiff'
  return 'image/jpeg'
}

function notifyProgress(window: BrowserWindow, progress: ImportProgress): void {
  if (!window.isDestroyed()) window.webContents.send('invoice:import-progress', progress)
}

async function importInvoices(window: BrowserWindow, sourcePaths?: string[]): Promise<{
  added: number
  failedOcr: number
  invoices: Invoice[]
} | null> {
  if (ocrModelSwitching) throw new Error('模型正在切换，请稍候再导入。')
  if (invoiceImportActive) throw new Error('已有发票正在导入，请稍候。')
  invoiceImportActive = true
  try {
    return await processInvoiceImport(window, sourcePaths)
  } finally {
    invoiceImportActive = false
  }
}

async function processInvoiceImport(window: BrowserWindow, sourcePaths?: string[]): Promise<{
  added: number
  failedOcr: number
  invoices: Invoice[]
} | null> {
  let filePaths = sourcePaths
  if (!filePaths) {
    const selection = await dialog.showOpenDialog(window, {
      title: '导入发票图片',
      buttonLabel: '导入发票',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '发票图片', extensions: imageExtensions }]
    })
    if (selection.canceled || selection.filePaths.length === 0) return null
    filePaths = selection.filePaths
  }

  const validPaths: string[] = []
  for (const sourcePath of filePaths) {
    const extension = extname(sourcePath).toLowerCase()
    if (!imageExtensions.includes(extension.slice(1))) continue
    const fileStat = await stat(sourcePath).catch(() => null)
    if (fileStat?.isFile()) validPaths.push(sourcePath)
  }
  if (validPaths.length === 0) throw new Error('没有找到可导入的图片。请使用 JPG、PNG、WEBP、BMP 或 TIFF 格式。')

  await ensureStorage()
  const total = validPaths.length
  const existing = await readInvoices()
  const added: Invoice[] = []
  let failedOcr = 0

  notifyProgress(window, { phase: 'prepare', current: 0, total, fileName: validPaths[0].split(/[\\/]/).at(-1) ?? '' })

  for (const [index, sourcePath] of validPaths.entries()) {
    const extension = extname(sourcePath).toLowerCase()

    const id = randomUUID()
    const fileKey = `${id}${extension}`
    const fileName = sourcePath.split(/[\\/]/).at(-1) ?? fileKey
    await copyFile(sourcePath, join(invoiceDirectory(), fileKey))

    const now = new Date().toISOString()
    const invoice: Invoice = {
      id,
      createdAt: now,
      updatedAt: now,
      fileName,
      fileKey,
      mimeType: mimeTypeFor(extension),
      invoiceNumber: '',
      date: '',
      seller: '',
      buyer: '',
      amount: 0,
      category: '其他',
      note: '',
      status: 'review',
      ocrStatus: 'failed',
      ocrError: '',
      confidence: 0,
      text: '',
      ocrLines: [],
      details: emptyInvoiceDetails()
    }

    try {
      notifyProgress(window, { phase: index === 0 ? 'prepare' : 'processing', current: index, total, fileName })
      await loadOcrSettings()
      const result = await ocrWorker.recognize({
        imagePath: join(invoiceDirectory(), fileKey),
        modelDirectory: ocrModelDirectory(),
        modelPreset: selectedOcrModelPreset
      })
      if (result.type === 'ocr') {
        const qrCodeText = await readQrCode(join(invoiceDirectory(), fileKey))
        let structuredFields: StructuredInvoiceFields = {}
        let structureError = false
        if (structuredExtractionEnabled) {
          notifyProgress(window, { phase: 'structuring', current: index, total, fileName })
          try {
            structuredFields = await structuredFieldsWorker.extract(
              result.lines,
              ocrModelDirectory(),
              structuredInvoiceFieldDescriptions,
              () => notifyProgress(window, { phase: 'structuring-downloading', current: index, total, fileName })
            )
          } catch (error) {
            structureError = true
            console.warn('本地结构化字段提取失败，将使用基础票面解析。', error)
          }
        }
        Object.assign(invoice, parseOcr(result.txts, result.scores, result.lines, qrCodeText, structuredFields))
        if (structureError) invoice.ocrError = '结构化字段模型暂不可用，已回退到基础票面解析。'
      }
      else {
        invoice.ocrStatus = 'done'
        invoice.ocrError = '图片中没有识别到文字，可在右侧手动填写信息。'
      }
    } catch (error) {
      failedOcr += 1
      invoice.ocrStatus = 'failed'
      invoice.ocrError = error instanceof Error ? error.message : 'OCR 暂时不可用，请稍后重试。'
    }

    added.push(invoice)
    existing.unshift(invoice)
    await writeInvoices(existing)
    notifyProgress(window, { phase: 'processing', current: index + 1, total, fileName })
  }

  return { added: added.length, failedOcr, invoices: existing }
}

function csvCell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

async function exportCsv(window: BrowserWindow): Promise<boolean> {
  const invoices = await readInvoices()
  if (invoices.length === 0) return false

  const suggestedName = `发票清单-${new Date().toISOString().slice(0, 10)}.csv`
  const selection = await dialog.showSaveDialog(window, {
    title: '导出发票清单',
    defaultPath: join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
  })
  if (selection.canceled || !selection.filePath) return false

  const headers = [
    '发票类型', '发票代码', '发票号码', '机器编号', '校验码', '开票日期',
    '销售方', '销售方税号', '销售方地址', '销售方电话', '销售方开户行', '销售方账号',
    '购买方', '购买方税号', '购买方地址', '购买方电话', '购买方开户行', '购买方账号',
    '合计金额（不含税）', '税额', '价税合计', '价税合计大写', '开票人', '复核人', '收款人',
    '票面备注', '内部备注', '明细行', '其他票面字段', '二维码内容', '类别', '状态'
  ]
  const rows = invoices.map((invoice) => [
    invoice.details.invoiceType,
    invoice.details.invoiceCode,
    invoice.invoiceNumber,
    invoice.details.machineNumber,
    invoice.details.checkCode,
    invoice.date,
    invoice.details.seller.name || invoice.seller,
    invoice.details.seller.taxId,
    invoice.details.seller.address,
    invoice.details.seller.phone,
    invoice.details.seller.bankName,
    invoice.details.seller.bankAccount,
    invoice.details.buyer.name || invoice.buyer,
    invoice.details.buyer.taxId,
    invoice.details.buyer.address,
    invoice.details.buyer.phone,
    invoice.details.buyer.bankName,
    invoice.details.buyer.bankAccount,
    invoice.details.amountExcludingTax,
    invoice.details.taxAmount,
    invoice.amount.toFixed(2),
    invoice.details.amountInWords,
    invoice.details.issuer,
    invoice.details.reviewer,
    invoice.details.payee,
    invoice.details.remarks,
    invoice.note,
    invoice.details.items.map((item) => [item.name, item.specification, item.unit, item.quantity, item.unitPrice, item.amount, item.taxRate, item.taxAmount].join(' / ')).join('；'),
    invoice.details.extraFields.map((field) => `${field.label}：${field.value}`).join('；'),
    invoice.details.qrCodeText,
    invoice.category,
    invoice.status === 'confirmed' ? '已确认' : '待核对'
  ])
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  await writeFile(selection.filePath, `\uFEFF${csv}`, 'utf8')
  return true
}

function registerHandlers(): void {
  handleIpc('app:info', (): AppInfo => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    updateMode: process.platform === 'darwin' ? 'manual' : 'automatic',
    updateStatus: getUpdateStatus()
  }))
  handleIpc('app:update-check', () => checkForUpdates())
  handleIpc('app:update-install', () => installDownloadedUpdate())
  handleIpc('app:open-releases', () => shell.openExternal('https://github.com/OSpoon/ReceiptFold/releases/latest'))
  handleIpc('invoice:list', () => readInvoices())
  handleIpc('invoice:import', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return importInvoices(window)
  })
  handleIpc('invoice:import-files', (event, paths: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const filePaths = Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : []
    return importInvoices(window, filePaths)
  })
  handleIpc('invoice:save', async (_event, id: string, patch: InvoicePatch) => {
    const invoices = await readInvoices()
    const invoice = invoices.find((item) => item.id === id)
    if (!invoice) return null

    invoice.invoiceNumber = String(patch.invoiceNumber ?? '').trim()
    invoice.date = String(patch.date ?? '').trim()
    invoice.seller = String(patch.seller ?? '').trim()
    invoice.buyer = String(patch.buyer ?? '').trim()
    invoice.amount = Number.isFinite(Number(patch.amount)) ? Math.max(0, Number(patch.amount)) : 0
    invoice.category = patch.category
    invoice.note = String(patch.note ?? '').trim()
    invoice.details = normalizeInvoice({ ...invoice, details: patch.details })!.details
    invoice.details.seller.name = invoice.seller
    invoice.details.buyer.name = invoice.buyer
    invoice.status = invoice.invoiceNumber && invoice.date && invoice.seller && invoice.amount > 0 ? 'confirmed' : 'review'
    invoice.updatedAt = new Date().toISOString()
    await writeInvoices(invoices)
    return invoice
  })
  handleIpc('invoice:remove', async (_event, id: string) => {
    const invoices = await readInvoices()
    const invoice = invoices.find((item) => item.id === id)
    if (!invoice) return false
    await unlink(join(invoiceDirectory(), invoice.fileKey)).catch(() => undefined)
    await writeInvoices(invoices.filter((item) => item.id !== id))
    return true
  })
  handleIpc('invoice:preview', async (_event, id: string) => {
    const invoice = (await readInvoices()).find((item) => item.id === id)
    if (!invoice) return null
    try {
      const data = await readFile(join(invoiceDirectory(), invoice.fileKey))
      const preview = await sharp(data)
        .rotate()
        .resize({ width: 1400, height: 1600, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      return `data:image/png;base64,${preview.toString('base64')}`
    } catch {
      return null
    }
  })
  handleIpc('invoice:export-csv', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window ? exportCsv(window) : false
  })
  handleIpc('invoice:storage-info', async (): Promise<StorageInfo> => {
    const invoices = await readInvoices()
    const files = await readdir(invoiceDirectory()).catch(() => [])
    const stats = await Promise.all(files.map((file) => stat(join(invoiceDirectory(), file)).catch(() => null)))
    return {
      invoiceCount: invoices.length,
      reviewCount: invoices.filter((invoice) => invoice.status === 'review').length,
      imageBytes: stats.reduce((total, entry) => total + (entry?.isFile() ? entry.size : 0), 0)
    }
  })
  handleIpc('storage:open-folder', async (_event, target: unknown): Promise<void> => {
    const directory = target === 'data' ? dataDirectory() : target === 'models' ? ocrModelDirectory() : null
    if (!directory) throw new TypeError('无法打开未知的本地文件夹。')
    await mkdir(directory, { recursive: true })
    const error = await shell.openPath(directory)
    if (error) throw new Error(`无法打开本地文件夹：${error}`)
  })
  handleIpc('ocr:settings', () => getOcrSettings())
  handleIpc('ocr:model-set', (_event, preset: unknown) => setOcrModelPreset(preset))
  handleIpc('ocr:structured-set', (_event, enabled: unknown) => setStructuredExtraction(enabled))
}

function createWindow(): void {
  const appIconPath = join(app.getAppPath(), 'resources/icon.png')
  const window = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 900,
    minHeight: 620,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f6f7f4',
    title: applicationName,
    ...(is.dev ? { icon: appIconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.removeMenu()
  window.on('ready-to-show', () => window.show())
  window.webContents.once('did-finish-load', () => checkForUpdatesOnStartup())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ospoon.receiptfold')
  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(join(app.getAppPath(), 'resources/icon.png'))
  }
  await ensureStorage()
  invoiceDatabase = new LocalInvoiceDatabase(sqliteDatabasePath())
  await invoiceDatabase.initialize(legacyDatabasePath())
  setupUpdater()
  registerHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (shutdownComplete) return
  event.preventDefault()
  if (shutdownStarted) return

  shutdownStarted = true
  shutdownRequested = true
  void (async () => {
    await waitForIpcHandlers()
    try {
      await invoiceDatabase?.close()
    } catch (error) {
      console.error('关闭本地发票数据库失败。', error)
    }
    await Promise.all([ocrWorker.shutdown(), structuredFieldsWorker.shutdown()])
    shutdownComplete = true
    app.quit()
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
