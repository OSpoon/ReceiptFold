import type { Invoice } from '../../../common/contracts'

export function invoiceStatusDisplay(invoice: Pick<Invoice, 'status' | 'ocrStatus'>): { label: string; className: string } {
  if (invoice.ocrStatus === 'failed') return { label: '识别失败', className: 'status-failed' }
  if (invoice.status === 'confirmed') return { label: '已归档', className: 'status-confirmed' }
  return { label: '待核对', className: 'status-review' }
}
