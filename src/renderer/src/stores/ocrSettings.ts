import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ocrModelPresets, type OcrModelPreset, type OcrSettings, type StorageFolder } from '../../../common/contracts'
import { useToast } from '../composables/useToast'

export const useOcrSettingsStore = defineStore('ocr-settings', () => {
  const ocrSettings = ref<OcrSettings | null>(null)
  const isLoadingOcrSettings = ref(true)
  const ocrSettingsError = ref('')
  const selectedOcrModel = ref<OcrModelPreset>('small')
  const isSwitchingOcrModel = ref(false)
  const currentOcrModel = computed(() => ocrModelPresets.find((preset) => preset.value === ocrSettings.value?.modelPreset) ?? ocrModelPresets[1])
  let initializationStarted = false

  async function refreshOcrSettings(): Promise<void> {
    isLoadingOcrSettings.value = true
    ocrSettingsError.value = ''
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const settings = await Promise.race([
        window.api.getOcrSettings(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('timeout')), 8000)
        })
      ])
      ocrSettings.value = settings
      selectedOcrModel.value = settings.modelPreset
    } catch (error) {
      ocrSettings.value = null
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      ocrSettingsError.value = message.includes('timeout')
        ? '读取超时，请重启发票夹后重试。'
        : '读取失败，请重启发票夹后重试。'
    } finally {
      if (timeout) clearTimeout(timeout)
      isLoadingOcrSettings.value = false
    }
  }

  function initializeOcrSettings(): void {
    if (initializationStarted) return
    initializationStarted = true
    void refreshOcrSettings()
  }

  async function switchOcrModel(value: string): Promise<void> {
    const preset = ocrModelPresets.find((option) => option.value === value)?.value
    if (!ocrSettings.value || !preset || isSwitchingOcrModel.value) return
    if (preset === ocrSettings.value.modelPreset) return

    const { notify } = useToast()
    selectedOcrModel.value = preset
    isSwitchingOcrModel.value = true
    try {
      ocrSettings.value = await window.api.setOcrModelPreset(preset)
      selectedOcrModel.value = ocrSettings.value.modelPreset
      ocrSettingsError.value = ''
      notify('识别模型已切换。尚未缓存的规格会在首次识别时下载。')
    } catch (error) {
      selectedOcrModel.value = ocrSettings.value.modelPreset
      notify(error instanceof Error ? error.message : '切换模型失败，请重试。')
    } finally {
      isSwitchingOcrModel.value = false
    }
  }

  async function openLocalFolder(folder: StorageFolder): Promise<void> {
    const { notify } = useToast()
    try {
      await window.api.openStorageFolder(folder)
      notify(folder === 'models' ? '已在访达中打开模型文件夹。' : '已在访达中打开数据文件夹。')
    } catch (error) {
      notify(error instanceof Error ? error.message : '无法打开本地文件夹。')
    }
  }

  return {
    ocrSettings,
    isLoadingOcrSettings,
    ocrSettingsError,
    selectedOcrModel,
    isSwitchingOcrModel,
    currentOcrModel,
    initializeOcrSettings,
    refreshOcrSettings,
    switchOcrModel,
    openLocalFolder
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOcrSettingsStore, import.meta.hot))
}
