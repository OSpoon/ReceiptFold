export const invoiceCategories = ['餐饮', '交通', '办公', '住宿', '通讯', '房产', '其他'] as const
export const ocrModelPresets = [
  { value: 'tiny', label: '轻量', modelName: 'PP-OCRv6 Tiny', description: '模型占用较少，适合快速识别清晰票面。' },
  { value: 'small', label: '标准', modelName: 'PP-OCRv6 Small', description: '日常发票识别的默认规格，兼顾速度和效果。' },
  { value: 'medium', label: '增强', modelName: 'PP-OCRv6 Medium', description: '模型规格更大，首次下载和识别耗时会增加。' }
] as const

export type InvoiceCategory = (typeof invoiceCategories)[number]
export type OcrModelPreset = (typeof ocrModelPresets)[number]['value']
export type InvoiceStatus = 'review' | 'confirmed'
export type OcrStatus = 'done' | 'failed' | 'manual'

export interface InvoicePoint {
  x: number
  y: number
}

export interface OcrLine {
  text: string
  confidence: number
  box: [InvoicePoint, InvoicePoint, InvoicePoint, InvoicePoint]
}

export interface InvoicePartyDetails {
  name: string
  taxId: string
  address: string
  phone: string
  bankName: string
  bankAccount: string
}

export interface InvoiceLineItem {
  name: string
  specification: string
  unit: string
  quantity: string
  unitPrice: string
  amount: string
  taxRate: string
  taxAmount: string
}

export interface InvoiceExtraField {
  label: string
  value: string
}

export interface InvoiceDetails {
  invoiceType: string
  invoiceCode: string
  machineNumber: string
  checkCode: string
  buyer: InvoicePartyDetails
  seller: InvoicePartyDetails
  items: InvoiceLineItem[]
  amountExcludingTax: string
  taxAmount: string
  amountInWords: string
  remarks: string
  payee: string
  reviewer: string
  issuer: string
  qrCodeText: string
  extraFields: InvoiceExtraField[]
}

export function emptyInvoiceParty(): InvoicePartyDetails {
  return { name: '', taxId: '', address: '', phone: '', bankName: '', bankAccount: '' }
}

export function emptyInvoiceDetails(): InvoiceDetails {
  return {
    invoiceType: '',
    invoiceCode: '',
    machineNumber: '',
    checkCode: '',
    buyer: emptyInvoiceParty(),
    seller: emptyInvoiceParty(),
    items: [],
    amountExcludingTax: '',
    taxAmount: '',
    amountInWords: '',
    remarks: '',
    payee: '',
    reviewer: '',
    issuer: '',
    qrCodeText: '',
    extraFields: []
  }
}

export interface Invoice {
  id: string
  createdAt: string
  updatedAt: string
  fileName: string
  fileKey: string
  mimeType: string
  invoiceNumber: string
  date: string
  seller: string
  buyer: string
  amount: number
  category: InvoiceCategory
  note: string
  status: InvoiceStatus
  ocrStatus: OcrStatus
  ocrError: string
  confidence: number
  text: string
  ocrLines: OcrLine[]
  details: InvoiceDetails
}

export type InvoicePatch = Pick<Invoice, 'invoiceNumber' | 'date' | 'seller' | 'buyer' | 'amount' | 'category' | 'note' | 'details'>

export interface ImportProgress {
  phase: 'prepare' | 'processing' | 'structuring' | 'structuring-downloading'
  current: number
  total: number
  fileName: string
}

export interface ImportResult {
  added: number
  failedOcr: number
  invoices: Invoice[]
}

export interface StorageInfo {
  invoiceCount: number
  reviewCount: number
  imageBytes: number
}

export interface OcrSettings {
  modelPreset: OcrModelPreset
  structuredExtractionEnabled: boolean
  modelStorageBytes: number
}

export type StorageFolder = 'data' | 'models'

export interface AppInfo {
  version: string
  packaged: boolean
  updateMode: 'manual' | 'automatic'
  updateStatus: UpdateStatus
}

export type UpdateStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error' }

export interface InvoiceApi {
  getAppInfo: () => Promise<AppInfo>
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  openReleasePage: () => Promise<void>
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void
  list: () => Promise<Invoice[]>
  importFiles: () => Promise<ImportResult | null>
  importDroppedFiles: (files: File[]) => Promise<ImportResult | null>
  onImportProgress: (listener: (progress: ImportProgress) => void) => () => void
  save: (id: string, patch: InvoicePatch) => Promise<Invoice | null>
  remove: (id: string) => Promise<boolean>
  preview: (id: string) => Promise<string | null>
  exportCsv: () => Promise<boolean>
  getStorageInfo: () => Promise<StorageInfo>
  openStorageFolder: (folder: StorageFolder) => Promise<void>
  getOcrSettings: () => Promise<OcrSettings>
  setOcrModelPreset: (preset: OcrModelPreset) => Promise<OcrSettings>
  setStructuredExtraction: (enabled: boolean) => Promise<OcrSettings>
}
