import { ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { invoiceCategories, type Invoice, type InvoicePatch } from '../../../common/contracts'
import { faceAmountFields, faceMetadataFields, facePersonFields, itemFields, partyFields, partySections } from './invoiceFields'
import { shortDate } from './useFormatters'
import { useInvoiceLibrary } from './useInvoiceLibrary'
import { useToast } from './useToast'

const selectedInvoice = ref<Invoice | null>(null)
const previewImage = ref<string | null>(null)
const isEditing = ref(false)
const isSaving = ref(false)
const draft = ref<InvoicePatch | null>(null)
const { copy } = useClipboard({ legacy: true })

function formatInvoiceContent(invoice: Invoice): string {
  const lines = ['发票内容']
  const append = (label: string, value: string | number | undefined): void => {
    if (value === undefined || value === null || String(value).trim() === '') return
    lines.push(`${label}：${value}`)
  }
  const appendParty = (label: string, party: Invoice['details']['buyer']): void => {
    lines.push('', `${label}信息`)
    for (const field of partyFields) append(field.label, party[field.key])
  }

  lines.push('', '基础信息')
  append('发票类型', invoice.details.invoiceType)
  append('发票代码', invoice.details.invoiceCode)
  append('机器编号', invoice.details.machineNumber)
  append('校验码', invoice.details.checkCode)
  append('发票号码', invoice.invoiceNumber)
  append('开票日期', invoice.date)
  append('类别', invoice.category)
  append('价税合计', invoice.amount)

  appendParty('购买方', invoice.details.buyer)
  appendParty('销售方', invoice.details.seller)

  lines.push('', `项目明细（${invoice.details.items.length}）`)
  invoice.details.items.forEach((item, index) => {
    lines.push(`明细 ${index + 1}`)
    for (const field of itemFields) append(field.label, item[field.key])
  })

  lines.push('', '金额与税额')
  for (const field of faceAmountFields) append(field.label, invoice.details[field.key])

  lines.push('', '备注与开票人员')
  for (const field of facePersonFields) append(field.label, invoice.details[field.key])
  append('票面备注', invoice.details.remarks)
  append('内部备注', invoice.note)

  if (invoice.details.extraFields.length) {
    lines.push('', '其他票面字段')
    invoice.details.extraFields.forEach((field) => append(field.label, field.value))
  }
  append('二维码内容', invoice.details.qrCodeText)
  return lines.join('\n')
}

async function copyInvoiceContent(): Promise<void> {
  const invoice = selectedInvoice.value
  if (!invoice) return
  try {
    await copy(formatInvoiceContent(invoice))
    useToast().notify('发票内容已复制。')
  } catch (error) {
    useToast().notify(error instanceof Error ? error.message : '复制失败，请重试。')
  }
}

async function selectInvoice(invoice: Invoice): Promise<void> {
  selectedInvoice.value = invoice
  previewImage.value = null
  isEditing.value = false
  const preview = await window.api.preview(invoice.id)
  if (selectedInvoice.value?.id === invoice.id) previewImage.value = preview
}

function closeDetails(): void {
  selectedInvoice.value = null
  previewImage.value = null
  isEditing.value = false
}

function onSheetOpenChange(open: boolean): void {
  if (!open) closeDetails()
}

function editInvoice(): void {
  if (!selectedInvoice.value) return
  const invoice = selectedInvoice.value
  draft.value = {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    seller: invoice.seller,
    buyer: invoice.buyer,
    amount: invoice.amount,
    category: invoice.category,
    note: invoice.note,
    details: JSON.parse(JSON.stringify(invoice.details)) as Invoice['details']
  }
  isEditing.value = true
}

async function saveInvoice(values: InvoicePatch): Promise<void> {
  if (!selectedInvoice.value) return
  isSaving.value = true
  try {
    const patch: InvoicePatch = {
      ...values,
      seller: values.details.seller.name,
      buyer: values.details.buyer.name
    }
    const saved = await window.api.save(selectedInvoice.value.id, patch)
    if (saved) {
      const library = useInvoiceLibrary()
      const normalized = library.normalizeInvoiceForUi(saved)
      const index = library.invoices.value.findIndex((invoice) => invoice.id === normalized.id)
      if (index >= 0) library.invoices.value[index] = normalized
      selectedInvoice.value = normalized
      await library.refreshStorage()
      isEditing.value = false
      useToast().notify(normalized.status === 'confirmed' ? '信息已保存，发票已归档。' : '信息已保存，还需要补充必填项。')
    }
  } catch (error) {
    useToast().notify(error instanceof Error ? error.message : '保存失败，请重试。')
  } finally {
    isSaving.value = false
  }
}

async function removeInvoice(): Promise<void> {
  const invoice = selectedInvoice.value
  if (!invoice) return
  const confirmed = window.confirm(`确定删除「${invoice.seller || invoice.fileName}」？这会同时删除保存在本机的图片。`)
  if (!confirmed) return
  try {
    const removed = await window.api.remove(invoice.id)
    if (!removed) return
    const library = useInvoiceLibrary()
    library.invoices.value = library.invoices.value.filter((item) => item.id !== invoice.id)
    await library.refreshStorage()
    closeDetails()
    useToast().notify('发票和本地图片已删除。')
  } catch (error) {
    useToast().notify(error instanceof Error ? error.message : '删除失败，请重试。')
  }
}

const invoiceDetailApi = {
  selectedInvoice,
  previewImage,
  isEditing,
  isSaving,
  draft,
  invoiceCategories,
  faceAmountFields,
  faceMetadataFields,
  facePersonFields,
  itemFields,
  partyFields,
  partySections,
  shortDate,
  selectInvoice,
  closeDetails,
  onSheetOpenChange,
  editInvoice,
  saveInvoice,
  removeInvoice,
  copyInvoiceContent
}

export function useInvoiceDetail(): typeof invoiceDetailApi {
  return invoiceDetailApi
}
