import { storeToRefs } from 'pinia'
import { useInvoiceLibraryStore } from '@/stores/invoiceLibrary'

type InvoiceLibraryStore = ReturnType<typeof useInvoiceLibraryStore>
type InvoiceLibraryApi = ReturnType<typeof storeToRefs<InvoiceLibraryStore>> & Pick<InvoiceLibraryStore,
  | 'initializeInvoiceLibrary'
  | 'disposeInvoiceLibrary'
  | 'refresh'
  | 'refreshStorage'
  | 'normalizeInvoiceForUi'
  | 'openImportDialog'
  | 'importFiles'
  | 'importDroppedFiles'
  | 'handleImportDragOver'
  | 'handleImportDragLeave'
  | 'handleImportDrop'
  | 'openExportDialog'
  | 'exportCsv'
>

export function useInvoiceLibrary(): InvoiceLibraryApi {
  const store = useInvoiceLibraryStore()
  return {
    ...storeToRefs(store),
    initializeInvoiceLibrary: store.initializeInvoiceLibrary,
    disposeInvoiceLibrary: store.disposeInvoiceLibrary,
    refresh: store.refresh,
    refreshStorage: store.refreshStorage,
    normalizeInvoiceForUi: store.normalizeInvoiceForUi,
    openImportDialog: store.openImportDialog,
    importFiles: store.importFiles,
    importDroppedFiles: store.importDroppedFiles,
    handleImportDragOver: store.handleImportDragOver,
    handleImportDragLeave: store.handleImportDragLeave,
    handleImportDrop: store.handleImportDrop,
    openExportDialog: store.openExportDialog,
    exportCsv: store.exportCsv
  }
}
