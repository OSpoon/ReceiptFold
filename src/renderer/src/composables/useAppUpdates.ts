import { computed, ref } from 'vue'
import type { AppInfo, UpdateStatus } from '../../../common/contracts'

const appInfo = ref<AppInfo | null>(null)
const updateStatus = ref<UpdateStatus>({ phase: 'idle' })
const updateButtonLabel = computed(() => {
  switch (updateStatus.value.phase) {
    case 'manual-only': return '手动下载'
    case 'checking': return '检查中…'
    case 'available': return '发现新版本'
    case 'downloading': return `下载更新 ${updateStatus.value.percent}%`
    case 'downloaded': return '重启安装'
    case 'not-available': return '已是最新'
    case 'error': return '重试更新'
    default: return '检查更新'
  }
})
const updateButtonDisabled = computed(() => ['checking', 'available', 'downloading'].includes(updateStatus.value.phase))
const updateStatusDescription = computed(() => {
  switch (updateStatus.value.phase) {
    case 'manual-only': return '此 macOS 版本未签名，暂不支持应用内更新。请前往 GitHub Releases 下载新版本。'
    case 'checking': return '正在检查是否有可用更新。'
    case 'available': return `发现新版本 v${updateStatus.value.version}，正在准备下载。`
    case 'downloading': return `正在下载更新，已完成 ${updateStatus.value.percent}%。`
    case 'downloaded': return `v${updateStatus.value.version} 已下载完成，重启应用即可安装。`
    case 'not-available': return `当前已是最新版本${updateStatus.value.version ? `（v${updateStatus.value.version}）` : ''}。`
    case 'error': return '检查更新失败，请确认网络连接后重试。'
    default: return '保持发票夹为最新版本。'
  }
})
let removeUpdateListener: (() => void) | undefined
let initialized = false
let receivedUpdateEvent = false

function initializeAppUpdates(): void {
  if (initialized) return
  initialized = true
  removeUpdateListener = window.api.onUpdateStatus((nextStatus) => {
    receivedUpdateEvent = true
    updateStatus.value = nextStatus
  })
  void window.api.getAppInfo().then((info) => {
    appInfo.value = info
    if (!receivedUpdateEvent) updateStatus.value = info.updateStatus
  })
}

function disposeAppUpdates(): void {
  removeUpdateListener?.()
  removeUpdateListener = undefined
  initialized = false
}

function handleUpdateButton(): void {
  if (updateStatus.value.phase === 'downloaded') void window.api.installUpdate()
  else void window.api.checkForUpdates()
}

function openReleasePage(): void {
  void window.api.openReleasePage()
}

const appUpdatesApi = {
  appInfo,
  updateStatus,
  updateButtonLabel,
  updateButtonDisabled,
  updateStatusDescription,
  initializeAppUpdates,
  disposeAppUpdates,
  handleUpdateButton,
  openReleasePage
}

export function useAppUpdates(): typeof appUpdatesApi {
  return appUpdatesApi
}
