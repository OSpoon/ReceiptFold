import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ImportProgress, InvoiceApi, InvoicePatch, OcrModelPreset, StorageFolder, UpdateStatus } from '../common/contracts'

const api: InvoiceApi = {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('app:update-check'),
  installUpdate: () => ipcRenderer.invoke('app:update-install'),
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => listener(status)
    ipcRenderer.on('app:update-status', handler)
    return () => ipcRenderer.removeListener('app:update-status', handler)
  },
  list: () => ipcRenderer.invoke('invoice:list'),
  importFiles: () => ipcRenderer.invoke('invoice:import'),
  importDroppedFiles: (files: File[]) => {
    const paths = files.flatMap((file) => {
      try {
        const path = webUtils.getPathForFile(file)
        return path ? [path] : []
      } catch {
        return []
      }
    })
    return ipcRenderer.invoke('invoice:import-files', paths)
  },
  onImportProgress: (listener: (progress: ImportProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportProgress): void => listener(progress)
    ipcRenderer.on('invoice:import-progress', handler)
    return () => ipcRenderer.removeListener('invoice:import-progress', handler)
  },
  save: (id: string, patch: InvoicePatch) => ipcRenderer.invoke('invoice:save', id, patch),
  remove: (id: string) => ipcRenderer.invoke('invoice:remove', id),
  preview: (id: string) => ipcRenderer.invoke('invoice:preview', id),
  exportCsv: () => ipcRenderer.invoke('invoice:export-csv'),
  getStorageInfo: () => ipcRenderer.invoke('invoice:storage-info'),
  openStorageFolder: (folder: StorageFolder) => ipcRenderer.invoke('storage:open-folder', folder),
  getOcrSettings: () => ipcRenderer.invoke('ocr:settings'),
  setOcrModelPreset: (preset: OcrModelPreset) => ipcRenderer.invoke('ocr:model-set', preset)
}

contextBridge.exposeInMainWorld('api', api)
