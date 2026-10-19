import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../common/contracts'

const { autoUpdater } = electronUpdater
const latestReleaseApi = 'https://api.github.com/repos/OSpoon/ReceiptFold/releases/latest'
let status: UpdateStatus = { phase: 'idle' }
let initialized = false
let startupCheckStarted = false
let macCheckInFlight: Promise<void> | undefined

interface LatestRelease {
  tag_name?: unknown
  draft?: unknown
  prerelease?: unknown
}

function parseStableVersion(version: string): [number, number, number] | undefined {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseStableVersion(candidate)
  const currentParts = parseStableVersion(current)
  if (!candidateParts || !currentParts) return false
  for (let index = 0; index < candidateParts.length; index++) {
    if (candidateParts[index] !== currentParts[index]) return candidateParts[index] > currentParts[index]
  }
  return false
}

function publish(nextStatus: UpdateStatus): void {
  status = nextStatus
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('app:update-status', status)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return status
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
  if (!app.isPackaged) return
  if (process.platform === 'darwin') {
    if (macCheckInFlight) return
    publish({ phase: 'checking' })
    macCheckInFlight = (async () => {
      try {
        const response = await fetch(latestReleaseApi, {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'ReceiptFold'
          },
          signal: AbortSignal.timeout(10_000)
        })
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
        const release = (await response.json()) as LatestRelease
        if (release.draft || release.prerelease || typeof release.tag_name !== 'string') {
          throw new Error('GitHub did not return a stable release')
        }
        const latestVersion = release.tag_name.replace(/^v/, '')
        if (!parseStableVersion(latestVersion)) throw new Error('GitHub returned an invalid release version')
        publish(
          isNewerVersion(latestVersion, app.getVersion())
            ? { phase: 'available', version: latestVersion }
            : { phase: 'not-available', version: latestVersion }
        )
      } catch {
        publish({ phase: 'error' })
      } finally {
        macCheckInFlight = undefined
      }
    })()
    return
  }
  void autoUpdater.checkForUpdates().catch(() => publish({ phase: 'error' }))
}

export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged || startupCheckStarted) return
  startupCheckStarted = true
  checkForUpdates()
}

export function installDownloadedUpdate(): void {
  if (app.isPackaged && process.platform !== 'darwin' && status.phase === 'downloaded') autoUpdater.quitAndInstall(false, true)
}
