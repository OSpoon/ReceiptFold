import type { InvoiceApi } from '../common/contracts'

declare global {
  interface Window {
    api: InvoiceApi
  }
}

export {}
