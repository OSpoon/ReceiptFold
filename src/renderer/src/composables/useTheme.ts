import { computed, shallowRef } from 'vue'
import { useColorMode } from '@vueuse/core'
import { Monitor, Moon, Sun } from '@lucide/vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const themeStorageKey = 'receipt-fold-theme'
const colorMode = shallowRef<ReturnType<typeof useColorMode>>()
const themeMode = computed<ThemeMode>(() => {
  const mode = colorMode.value?.store.value
  return mode === 'light' || mode === 'dark' ? mode : 'system'
})
const themeOptions = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon }
] as const

function initializeTheme(): void {
  if (colorMode.value) return

  const savedTheme = localStorage.getItem(themeStorageKey)
  if (savedTheme === 'system' || (savedTheme && !['auto', 'light', 'dark'].includes(savedTheme))) {
    localStorage.setItem(themeStorageKey, 'auto')
  }

  colorMode.value = useColorMode({
    attribute: 'class',
    initialValue: 'auto',
    storageKey: themeStorageKey
  })
}

function setThemeMode(mode: ThemeMode): void {
  if (!colorMode.value) initializeTheme()
  if (colorMode.value) colorMode.value.store.value = mode === 'system' ? 'auto' : mode
}

function disposeTheme(): void {
  colorMode.value = undefined
}

const themeApi = { themeMode, themeOptions, initializeTheme, setThemeMode, disposeTheme }

export function useTheme(): typeof themeApi {
  return themeApi
}
