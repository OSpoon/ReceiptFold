import { ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'

const toastMessage = ref('')
const { start: restartToastTimer, stop: stopToastTimer } = useTimeoutFn(
  () => {
    toastMessage.value = ''
  },
  3000,
  { immediate: false }
)

function notify(message: string): void {
  toastMessage.value = message
  restartToastTimer()
}

function clearToast(): void {
  stopToastTimer()
}

const toastApi = { toastMessage, notify, clearToast }

export function useToast(): typeof toastApi {
  return toastApi
}
