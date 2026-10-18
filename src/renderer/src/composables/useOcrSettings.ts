import { storeToRefs } from 'pinia'
import { ocrModelPresets } from '../../../common/contracts'
import { fileSize } from './useFormatters'
import { useOcrSettingsStore } from '@/stores/ocrSettings'

type OcrSettingsStore = ReturnType<typeof useOcrSettingsStore>
type OcrSettingsApi = ReturnType<typeof storeToRefs<OcrSettingsStore>> & Pick<OcrSettingsStore,
  | 'initializeOcrSettings'
  | 'refreshOcrSettings'
  | 'switchOcrModel'
  | 'openLocalFolder'
> & {
  ocrModelPresets: typeof ocrModelPresets
  fileSize: typeof fileSize
}

export function useOcrSettings(): OcrSettingsApi {
  const store = useOcrSettingsStore()
  return {
    ...storeToRefs(store),
    ocrModelPresets,
    fileSize,
    initializeOcrSettings: store.initializeOcrSettings,
    refreshOcrSettings: store.refreshOcrSettings,
    switchOcrModel: store.switchOcrModel,
    openLocalFolder: store.openLocalFolder
  }
}
