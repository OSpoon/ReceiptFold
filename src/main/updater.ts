import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../common/contracts'

const { autoUpdater } = electronUpdater
let status: UpdateStatus = { phase: 'idle' }
let initialized = false
let startupCheckStarted = false

function publish(nextStatus: UpdateStatus): void {
  status = nextStatus
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('app:update-status', status)
  }
}

export function getUpdateStatus(): UpdateStatus {
  // macOS releases are intentionally unsigned and cannot use electron-updater.
  return process.platform === 'darwin' ? { phase: 'manual-only' } : status
}

export function setupUpdater(): void {
  if (initialized) return
  initialized = true
  if (!app.isPackaged || process.platform === 'darwin') return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking' }))
  autoUpdater.on('update-available', (info) => publish({ phase: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => publish({ phase: 'not-available', version: info.version }))
  autoUpdater.on('download-progress', (progress) => publish({ phase: 'downloading', percent: Math.round(progress.percent) }))
  autoUpdater.on('update-downloaded', (info) => publish({ phase: 'downloaded', version: info.version }))
  autoUpdater.on('error', () => publish({ phase: 'error' }))
}

export function checkForUpdates(): void {
  if (!app.isPackaged || process.platform === 'darwin') return
  void autoUpdater.checkForUpdates().catch(() => publish({ phase: 'error' }))
}

export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged || process.platform === 'darwin' || startupCheckStarted) return
  startupCheckStarted = true
  checkForUpdates()
}

export function installDownloadedUpdate(): void {
  if (app.isPackaged && process.platform !== 'darwin' && status.phase === 'downloaded') autoUpdater.quitAndInstall(false, true)
}
