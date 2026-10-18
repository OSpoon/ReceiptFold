import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { emptyInvoiceDetails, emptyInvoiceParty, type ImportProgress, type Invoice, type InvoiceDetails } from '../../../common/contracts'
import { useOcrSettingsStore } from './ocrSettings'
import { useToast } from '../composables/useToast'

const supportedInvoiceExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'])

export const useInvoiceLibraryStore = defineStore('invoice-library', () => {
  const invoices = ref<Invoice[]>([])
  const isLoading = ref(true)
  const storageInfo = ref({ invoiceCount: 0, reviewCount: 0, imageBytes: 0 })
  const isImporting = ref(false)
  const isImportRequestActive = ref(false)
  const isImportDialogOpen = ref(false)
  const isImportDragOver = ref(false)
  const importError = ref('')
  const importWarning = ref('')
  const progress = ref<ImportProgress | null>(null)
  const isExportDialogOpen = ref(false)
  const isExporting = ref(false)
  const reviewCount = computed(() => invoices.value.filter((invoice) => invoice.status === 'review').length)
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const cumulativeTotal = computed(() => invoices.value.reduce((sum, invoice) => sum + invoice.amount, 0))
  const monthTotal = computed(() => invoices.value
    .filter((invoice) => invoice.date.startsWith(currentMonth))
    .reduce((sum, invoice) => sum + invoice.amount, 0))
  const progressPercent = computed(() => {
    if (!progress.value?.total) return 0
    return Math.min(100, Math.round((progress.value.current / progress.value.total) * 100))
  })
  let initialized = false
  let removeProgressListener: (() => void) | undefined

  function normalizeInvoiceForUi(invoice: Invoice): Invoice {
    const source = invoice as Invoice & { details?: Partial<InvoiceDetails>; ocrLines?: Invoice['ocrLines'] }
    const details = source.details ?? {}
    return {
      ...source,
      ocrLines: Array.isArray(source.ocrLines) ? source.ocrLines : [],
      details: {
        ...emptyInvoiceDetails(),
        ...details,
        buyer: { ...emptyInvoiceParty(), ...details.buyer },
        seller: { ...emptyInvoiceParty(), ...details.seller },
        items: Array.isArray(details.items) ? details.items : [],
        extraFields: Array.isArray(details.extraFields) ? details.extraFields : []
      }
    }
  }

  async function refresh(): Promise<void> {
    const [rows, info] = await Promise.all([window.api.list(), window.api.getStorageInfo()])
    invoices.value = rows.map(normalizeInvoiceForUi)
    storageInfo.value = info
  }

  async function refreshStorage(): Promise<void> {
    storageInfo.value = await window.api.getStorageInfo()
  }

  function initializeInvoiceLibrary(): void {
    if (initialized) return
    initialized = true
    removeProgressListener = window.api.onImportProgress((nextProgress) => {
      progress.value = nextProgress
      isImporting.value = true
    })
    void refresh()
      .catch((error: unknown) => {
        const { notify } = useToast()
        notify(error instanceof Error ? error.message : '无法读取发票数据。')
      })
      .finally(() => { isLoading.value = false })
  }

  function disposeInvoiceLibrary(): void {
    removeProgressListener?.()
    removeProgressListener = undefined
    initialized = false
  }

  function openImportDialog(): void {
    if (!isImportRequestActive.value) {
      importError.value = ''
      importWarning.value = ''
    }
    isImportDialogOpen.value = true
  }

  async function runImport(importer: () => ReturnType<typeof window.api.importFiles>): Promise<void> {
    if (isImportRequestActive.value) return
    isImportRequestActive.value = true
    isImporting.value = false
    progress.value = null
    importError.value = ''
    importWarning.value = ''
    try {
      const result = await importer()
      if (result) {
        invoices.value = result.invoices.map(normalizeInvoiceForUi)
        await refreshStorage()
        void useOcrSettingsStore().refreshOcrSettings()
        const completionMessage = result.failedOcr > 0
          ? `已保存 ${result.added} 张发票，其中 ${result.failedOcr} 张识别失败，已加入待核对。`
          : `已导入 ${result.added} 张发票。`
        if (result.failedOcr > 0 && isImportDialogOpen.value) {
          importWarning.value = `${completionMessage}可手动补录，或继续导入。`
        } else {
          isImportDialogOpen.value = false
          useToast().notify(completionMessage)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败，请重试。'
      if (isImportDialogOpen.value) importError.value = message
      else useToast().notify(message)
    } finally {
      isImportRequestActive.value = false
      isImporting.value = false
      progress.value = null
    }
  }

  async function importFiles(): Promise<void> {
    await runImport(() => window.api.importFiles())
  }

  async function importDroppedFiles(files: File[]): Promise<void> {
    const supportedFiles = files.filter((file) => {
      const extension = file.name.split('.').at(-1)?.toLowerCase() ?? ''
      return supportedInvoiceExtensions.has(extension)
    })
    if (supportedFiles.length === 0) {
      importWarning.value = ''
      importError.value = '请拖入 JPG、PNG、WEBP、BMP 或 TIFF 图片。'
      return
    }
    await runImport(() => window.api.importDroppedFiles(supportedFiles))
  }

  function handleImportDragOver(event: DragEvent): void {
    event.preventDefault()
    if (!isImportRequestActive.value) isImportDragOver.value = true
  }

  function handleImportDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement
    if (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget)) isImportDragOver.value = false
  }

  function handleImportDrop(event: DragEvent): void {
    event.preventDefault()
    isImportDragOver.value = false
    if (isImportRequestActive.value) return
    void importDroppedFiles(Array.from(event.dataTransfer?.files ?? []))
  }

  function openExportDialog(): void {
    isExportDialogOpen.value = true
  }

  async function exportCsv(): Promise<void> {
    if (isExporting.value) return
    isExporting.value = true
    try {
      const saved = await window.api.exportCsv()
      if (saved) {
        isExportDialogOpen.value = false
        useToast().notify('发票清单已导出。')
      }
    } catch (error) {
      useToast().notify(error instanceof Error ? error.message : '导出失败，请重试。')
    } finally {
      isExporting.value = false
    }
  }

  return {
    invoices,
    isLoading,
    storageInfo,
    isImporting,
    isImportRequestActive,
    isImportDialogOpen,
    isImportDragOver,
    importError,
    importWarning,
    progress,
    progressPercent,
    isExportDialogOpen,
    isExporting,
    reviewCount,
    cumulativeTotal,
    monthTotal,
    initializeInvoiceLibrary,
    disposeInvoiceLibrary,
    refresh,
    refreshStorage,
    normalizeInvoiceForUi,
    openImportDialog,
    importFiles,
    importDroppedFiles,
    handleImportDragOver,
    handleImportDragLeave,
    handleImportDrop,
    openExportDialog,
    exportCsv
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useInvoiceLibraryStore, import.meta.hot))
}
