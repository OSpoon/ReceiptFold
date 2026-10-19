import { computed, ref, watch } from 'vue'
import type { AppInfo, UpdateStatus } from '../../../common/contracts'

const appInfo = ref<AppInfo | null>(null)
const updateStatus = ref<UpdateStatus>({ phase: 'idle' })
const manualUpdate = computed(() => appInfo.value?.updateMode === 'manual')
const isUpdateDialogOpen = ref(false)
const promptedVersion = ref<string>()
const updateButtonLabel = computed(() => {
  if (manualUpdate.value) {
    switch (updateStatus.value.phase) {
      case 'checking': return '检查中…'
      case 'available': return '前往 GitHub 下载'
      case 'error': return '打开 GitHub Releases'
      default: return '检查更新'
    }
  }
  switch (updateStatus.value.phase) {
    case 'checking': return '检查中…'
    case 'available': return '发现新版本'
    case 'downloading': return `下载更新 ${updateStatus.value.percent}%`
    case 'downloaded': return '重启安装'
    case 'not-available': return '已是最新'
    case 'error': return '重试更新'
    default: return '检查更新'
  }
})
const updateButtonDisabled = computed(() => updateStatus.value.phase === 'checking'
  || (!manualUpdate.value && ['available', 'downloading'].includes(updateStatus.value.phase)))
const updateStatusDescription = computed(() => {
  if (manualUpdate.value) {
    switch (updateStatus.value.phase) {
      case 'checking': return '正在检查 GitHub 上的最新正式版本。'
      case 'available': return `发现新版本 v${updateStatus.value.version}，请前往 GitHub Releases 下载并手动安装。`
      case 'not-available': return `当前已是最新版本${updateStatus.value.version ? `（v${updateStatus.value.version}）` : ''}。`
      case 'error': return '暂时无法检查更新。你可以打开 GitHub Releases 查看并下载最新版本。'
      default: return '应用会检查 GitHub 上的正式版本；macOS 版本需手动下载和安装。'
    }
  }
  switch (updateStatus.value.phase) {
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
let stopAvailableWatch: (() => void) | undefined
let initialized = false
let receivedUpdateEvent = false

function initializeAppUpdates(): void {
  if (initialized) return
  initialized = true
  stopAvailableWatch = watch([manualUpdate, updateStatus], ([isManual, status]) => {
    if (!isManual || status.phase !== 'available' || promptedVersion.value === status.version) return
    promptedVersion.value = status.version
    isUpdateDialogOpen.value = true
  }, { immediate: true })
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
  stopAvailableWatch?.()
  stopAvailableWatch = undefined
  initialized = false
}

function handleUpdateButton(): void {
  if (manualUpdate.value && ['available', 'error'].includes(updateStatus.value.phase)) {
    openReleasePage()
    return
  }
  if (updateStatus.value.phase === 'downloaded') void window.api.installUpdate()
  else void window.api.checkForUpdates()
}

function openReleasePage(): void {
  void window.api.openReleasePage()
  isUpdateDialogOpen.value = false
}

function dismissUpdateDialog(): void {
  isUpdateDialogOpen.value = false
}

const appUpdatesApi = {
  appInfo,
  manualUpdate,
  isUpdateDialogOpen,
  updateStatus,
  updateButtonLabel,
  updateButtonDisabled,
  updateStatusDescription,
  initializeAppUpdates,
  disposeAppUpdates,
  handleUpdateButton,
  openReleasePage,
  dismissUpdateDialog
}

export function useAppUpdates(): typeof appUpdatesApi {
  return appUpdatesApi
}
