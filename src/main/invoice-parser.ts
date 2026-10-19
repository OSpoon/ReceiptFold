import {
  emptyInvoiceDetails,
  emptyInvoiceParty,
  type Invoice,
  type InvoiceCategory,
  type InvoiceDetails,
  type InvoiceExtraField,
  type InvoiceLineItem,
  type InvoicePartyDetails,
  type InvoiceStatus,
  type OcrLine
} from '../common/contracts'

const categoryKeywords: Record<InvoiceCategory, string[]> = {
  餐饮: ['餐饮', '餐厅', '饭店', '咖啡', '奶茶', '食品'],
  交通: ['出租车', '网约车', '滴滴', '铁路', '航空', '客运', '加油', '停车'],
  办公: ['办公', '文具', '打印', '电脑', '软件', '设备'],
  住宿: ['酒店', '宾馆', '住宿', '客房'],
  通讯: ['通信', '电信', '移动', '联通', '话费'],
  房产: ['不动产', '房地产', '房屋', '产权', '物业', '住房', '房产'],
  其他: []
}

const partyHeadings = {
  buyer: /购买方信息|购方信息|购货单位信息|购方单位信息/,
  seller: /销售方信息|销方信息|销货单位信息|销方单位信息/
}

const lineItemHeaderPatterns: Array<[keyof InvoiceLineItem, RegExp]> = [
  ['name', /项目名称|货物或应税劳务.?服务名称|货物或劳务名称|商品名称/],
  ['specification', /规格型号|型号规格/],
  ['unit', /单位/],
  ['quantity', /数量/],
  ['unitPrice', /单价/],
  ['amount', /金额/],
  ['taxRate', /税率|征收率/],
  ['taxAmount', /税额/]
]

export const structuredInvoiceFieldDescriptions = {
  invoiceType: '发票类型或票面标题',
  invoiceNumber: '发票号码，不是发票代码',
  issueDate: '开票日期或开具日期',
  invoiceCode: '发票代码',
  machineNumber: '机器编号或税控盘编号',
  checkCode: '校验码',
  buyerName: '购买方名称',
  buyerTaxId: '购买方统一社会信用代码或纳税人识别号',
  buyerAddress: '购买方地址',
  buyerPhone: '购买方电话',
  buyerBankName: '购买方开户行',
  buyerBankAccount: '购买方银行账号',
  sellerName: '销售方或开票方名称',
  sellerTaxId: '销售方统一社会信用代码或纳税人识别号',
  sellerAddress: '销售方地址',
  sellerPhone: '销售方电话',
  sellerBankName: '销售方开户行',
  sellerBankAccount: '销售方银行账号',
  amountExcludingTax: '合计金额或不含税金额',
  taxAmount: '合计税额，不是税率',
  totalAmount: '价税合计小写金额',
  amountInWords: '价税合计大写金额',
  remarks: '票面备注',
  payee: '收款人',
  reviewer: '复核人',
  issuer: '开票人'
} as const

export type StructuredInvoiceFields = Partial<{
  [Key in keyof typeof structuredInvoiceFieldDescriptions]: string | null
}>

function cleanField(value: string | undefined): string {
  return (value ?? '').replace(/^[\s:：,，。;；]+|[\s,，。;；]+$/g, '').trim()
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.replace(/[¥￥,，\s]/g, '')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const number = Number(match[0])
  return Number.isFinite(number) ? number : undefined
}

const fieldLabels = '(?:发票代码|发票号码|发票号|开票日期|开具日期|日期|机器编号|税控盘编号|校验码|购买方信息|销售方信息|购方信息|销方信息|统一社会信用代码|纳税人识别号|纳税人识别码|税号|名称|地址|电话|开户行及账号|开户行|银行账号|账号|价税合计|合计金额|应付金额|实付金额|项目名称|货物或应税劳务.?服务名称|货物或劳务名称|商品名称|规格型号|型号规格|单位|数量|单价|金额|税率|征收率|税额|收款人|复核人?|开票人|备注)'
const valueBoundary = new RegExp(`${fieldLabels}\\s*[:：]`)
const fieldLabelPrefix = new RegExp(`^${fieldLabels}\\s*[:：]?`)

function trimAtNextLabel(value: string): string {
  const boundaryIndex = value.search(valueBoundary)
  return cleanField(boundaryIndex < 0 ? value : value.slice(0, boundaryIndex))
}

function findLabeledValue(text: string, label: RegExp): string {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = label.exec(line)
    label.lastIndex = 0
    if (!match) continue
    const remainder = trimAtNextLabel(line.slice(match.index + match[0].length))
    if (remainder) return remainder
    for (const next of lines.slice(index + 1, index + 3)) {
      if (fieldLabelPrefix.test(next)) break
      const candidate = trimAtNextLabel(next)
      if (candidate) return candidate
    }
  }
  return ''
}

function normalizeDateValue(value: string): string {
  const match = value.match(/(?:^|[^\d])((?:19|20)\d{2})\s*(?:年|[./-]|\s)\s*(\d{1,2})\s*(?:月|[./-]|\s)\s*(\d{1,2})\s*日?(?:$|[^\d])/)?.slice(1)
    ?? value.match(/(?:^|[^\d])((?:19|20)\d{2})(\d{2})(\d{2})(?:$|[^\d])/i)?.slice(1)
  if (!match) return ''

  const [year, month, day] = match.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractDate(text: string, structuredValue?: string | null): string {
  return normalizeDateValue(structuredValue ?? '') || normalizeDateValue(findLabeledValue(text, /开票日期?|开具日期?/))
}

function extractInvoiceNumber(text: string, structuredValue?: string | null): string {
  const pattern = /(?:^|[^0-9A-Za-z])([0-9A-Za-z]{8,24})(?:$|[^0-9A-Za-z])/
  return structuredValue?.match(pattern)?.[1] ?? findLabeledValue(text, /发票号码|发票号/).match(pattern)?.[1] ?? ''
}

function parseAmount(value: string | null | undefined): number | undefined {
  return toNumber(value ?? undefined)
}

function extractAmount(text: string, structuredValue?: string | null): number {
  const structuredAmount = parseAmount(structuredValue)
  if (structuredAmount !== undefined) return structuredAmount
  const labels = [/小写/, /价税合计/, /合计金额|应付金额|实付金额/]
  for (const label of labels) {
    const value = findLabeledValue(text, label)
    const amount = toNumber(value.match(/[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/)?.[1])
    if (amount !== undefined) return amount
  }
  return 0
}

function partySection(lines: string[], party: 'buyer' | 'seller'): string {
  const heading = partyHeadings[party]
  const otherHeading = partyHeadings[party === 'buyer' ? 'seller' : 'buyer']
  const start = lines.findIndex((line) => heading.test(line))
  if (start < 0) return ''
  if (otherHeading.test(lines[start])) return ''
  const boundaries = [
    lines.findIndex((line, index) => index > start && otherHeading.test(line)),
    lines.findIndex((line, index) => index > start && /项目名称|货物或应税劳务|商品名称/.test(line))
  ].filter((index) => index >= 0)
  const end = boundaries.length ? Math.min(...boundaries) : lines.length
  return lines.slice(start, end).join('\n')
}

function extractParty(lines: string[], party: 'buyer' | 'seller', ocrLines: OcrLine[], structuredFields: StructuredInvoiceFields): InvoicePartyDetails {
  const maxX = Math.max(...ocrLines.flatMap((line) => line.box.map((point) => point.x)), 0)
  const heading = ocrLines.find((line) => partyHeadings[party].test(line.text))
  const tableHeading = ocrLines.find((line) => /项目名称|货物或应税劳务|商品名称/.test(line.text))
  const headingY = heading ? lineGeometry(heading).y : 0
  const tableY = tableHeading ? lineGeometry(tableHeading).y : Number.POSITIVE_INFINITY
  const hasGeometry = ocrLines.length > 0 && maxX > 0 && heading && tableHeading
  const section = hasGeometry
    ? ocrLines.filter((line) => {
        const position = lineGeometry(line)
        const isBuyerSide = position.x < maxX * 0.5
        return isBuyerSide === (party === 'buyer') && position.y >= headingY - 100 && position.y < tableY
      }).map((line) => line.text).join('\n')
    : partySection(lines, party)
  const result = emptyInvoiceParty()
  const taxIdLabel = /(?:统一社会信用代码\s*[/／]?\s*纳税人识别号|统一社会信用代码|纳税人识别号|纳税人识别码|税号)\s*[:：]?/i
  const taxIdRaw = findLabeledValue(section, taxIdLabel)
  result.taxId = taxIdRaw.match(/[0-9A-Z]{8,24}/i)?.[0] ?? ''
  result.name = findLabeledValue(section, /名称\s*[:：]?/)
    .replace(/(?:统一社会信用代码|纳税人识别号|地址|电话|开户行及账号|开户行|账号).*$/i, '')
  const addressPhone = findLabeledValue(section, /地址\s*(?:[、/／]?\s*电话)?\s*[:：]?/)
  const phoneFromAddress = addressPhone.match(/(?:\+?86[-\s]?)?(?:1\d{10}|0\d{2,3}[-\s]?\d{7,8})/)?.[0] ?? ''
  result.phone = findLabeledValue(section, /电话\s*[:：]?/) || phoneFromAddress
  result.address = addressPhone
  if (phoneFromAddress) result.address = cleanField(addressPhone.replace(phoneFromAddress, '').replace(/[，,;；\s]+$/, ''))
  const bankAndAccount = findLabeledValue(section, /开户行及账号|开户行\s*[:：]?/)
  result.bankName = findLabeledValue(section, /开户行\s*[:：]?/) || bankAndAccount
  result.bankAccount = findLabeledValue(section, /(?:银行)?账号\s*[:：]?/)
  if (!result.bankAccount) {
    const accountMatch = bankAndAccount.match(/(?:\d[ -]?){8,}/)?.[0]
    if (accountMatch) {
      result.bankAccount = accountMatch.replace(/[ -]/g, '')
      result.bankName = cleanField(bankAndAccount.replace(accountMatch, ''))
    }
  }
  result.name = cleanField(result.name)
  result.taxId = cleanField(result.taxId)
  result.address = cleanField(result.address)
  result.phone = cleanField(result.phone)
  result.bankName = cleanField(result.bankName)
  result.bankAccount = cleanField(result.bankAccount)

  const structuredParty = party === 'buyer' ? 'buyer' : 'seller'
  const modelField = (field: string): string => cleanField(structuredFields[`${structuredParty}${field}` as keyof StructuredInvoiceFields] ?? '')
  const modelTaxId = modelField('TaxId').match(/[0-9A-Z]{8,24}/i)?.[0]
  const modelPhone = modelField('Phone').match(/(?:\+?86[-\s]?)?(?:1\d{10}|0\d{2,3}[-\s]?\d{7,8})/)?.[0]
  const modelBankAccount = modelField('BankAccount').match(/(?:\d[ -]?){8,}/)?.[0]?.replace(/[ -]/g, '')
  result.name = modelField('Name') || result.name
  result.taxId = modelTaxId || result.taxId
  result.address = modelField('Address') || result.address
  result.phone = modelPhone || result.phone
  result.bankName = modelField('BankName') || result.bankName
  result.bankAccount = modelBankAccount || result.bankAccount
  return result
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function lineGeometry(line: OcrLine): { x: number; y: number; height: number } {
  const xs = line.box.map((point) => point.x)
  const ys = line.box.map((point) => point.y)
  return {
    x: average(xs),
    y: average(ys),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys))
  }
}

function emptyItem(): InvoiceLineItem {
  return { name: '', specification: '', unit: '', quantity: '', unitPrice: '', amount: '', taxRate: '', taxAmount: '' }
}

function groupOcrLines(ocrLines: OcrLine[]): Array<Array<ReturnType<typeof lineGeometry> & { line: OcrLine }>> {
  const geometry = ocrLines.map((line) => ({ line, ...lineGeometry(line) }))
  const typicalHeight = average(geometry.map((entry) => entry.height)) || 12
  const tolerance = Math.max(4, typicalHeight * 0.58)
  const rows: Array<typeof geometry> = []
  for (const entry of geometry.sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find((candidate) => Math.abs(average(candidate.map((item) => item.y)) - entry.y) <= tolerance)
    if (!row) {
      row = []
      rows.push(row)
    }
    row.push(entry)
  }
  return rows
}

function rowIsSubtotal(row: Array<{ line: OcrLine }>): boolean {
  const rowText = row.map((entry) => entry.line.text.trim()).join(' ')
  const amountCount = [...rowText.matchAll(/[¥￥]?\s*[\d,]+\.\d{2}/g)].length
  return amountCount >= 2 && (/合\s*计|价税合计/.test(rowText) || row.some((entry) => /^(?:合|计)$/.test(entry.line.text.trim())))
}

function extractLineItems(ocrLines: OcrLine[]): InvoiceLineItem[] {
  const geometry = ocrLines.map((line) => ({ line, ...lineGeometry(line) }))
  const headers = geometry.flatMap((entry) => {
    const match = lineItemHeaderPatterns.find(([, pattern]) => pattern.test(entry.line.text))
    return match ? [{ field: match[0], x: entry.x, y: entry.y }] : []
  })
  if (!headers.some((header) => header.field === 'name')) return []

  const headerY = Math.min(...headers.map((header) => header.y))
  const subtotal = groupOcrLines(ocrLines).find((row) => average(row.map((entry) => entry.y)) > headerY && rowIsSubtotal(row))
  const subtotalLines = new Set(subtotal?.map((entry) => entry.line) ?? [])
  const totalY = subtotal ? average(subtotal.map((entry) => entry.y)) : geometry
    .filter((entry) => entry.y > headerY && /^(?:\s*合计|\s*价税合计|\s*备注)/.test(entry.line.text))
    .map((entry) => entry.y)
    .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
  const candidates = geometry.filter((entry) => !subtotalLines.has(entry.line) && entry.y > headerY + 2 && entry.y < totalY && entry.line.text.trim())
  const typicalHeight = average(candidates.map((entry) => entry.height)) || average(geometry.map((entry) => entry.height)) || 12
  const tolerance = Math.max(4, typicalHeight * 0.58)
  const rows: Array<typeof candidates> = []

  for (const entry of candidates.sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.find((candidate) => Math.abs(average(candidate.map((item) => item.y)) - entry.y) <= tolerance)
    if (!row) {
      row = []
      rows.push(row)
    }
    row.push(entry)
  }

  const items: InvoiceLineItem[] = []
  for (const row of rows) {
    const item = emptyItem()
    for (const entry of row.sort((a, b) => a.x - b.x)) {
      const xs = entry.line.box.map((point) => point.x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const spanningHeaders = headers.filter((header) => header.x >= minX - typicalHeight * 0.4 && header.x <= maxX + typicalHeight * 0.4).sort((left, right) => left.x - right.x)
      const tokens = entry.line.text.trim().split(/\s+/).filter(Boolean)
      const numericTokens = tokens.length > 1 && tokens.every((token) => /[\d]/.test(token))
      if (numericTokens && spanningHeaders.length >= tokens.length) {
        tokens.forEach((token, index) => {
          const field = spanningHeaders[index].field
          item[field] = cleanField(item[field] ? `${item[field]} ${token}` : token)
        })
        continue
      }
      const nearestHeader = [...headers].sort((left, right) => Math.abs(left.x - entry.x) - Math.abs(right.x - entry.x))[0]
      if (!nearestHeader || (Math.abs(nearestHeader.x - entry.x) > typicalHeight * 12 && headers.length > 1)) continue
      const field = nearestHeader.field
      item[field] = cleanField(item[field] ? `${item[field]} ${entry.line.text}` : entry.line.text)
    }
    const hasValues = Object.entries(item).some(([key, value]) => key !== 'name' && Boolean(value))
    if (hasValues || item.name) {
      const amountValues = item.amount.match(/[\d,]+(?:\.\d+)?/g) ?? []
      if (item.quantity && !item.unitPrice && amountValues.length >= 2) {
        const quantity = toNumber(item.quantity)
        const first = toNumber(amountValues[0])
        const remaining = first !== undefined && first === quantity ? amountValues.slice(1) : amountValues
        if (remaining.length >= 2) {
          item.unitPrice = remaining[0]
          item.amount = remaining.at(-1) ?? ''
        }
      }
      const onlyName = item.name && !hasValues
      if (onlyName && items.length) items.at(-1)!.name = cleanField(`${items.at(-1)!.name} ${item.name}`)
      else items.push(item)
    }
  }

  return items.filter((item) => item.name || item.amount || item.taxAmount)
}

function parseTotalAmounts(text: string, ocrLines: OcrLine[], items: InvoiceLineItem[]): { excludingTax: string; tax: string } {
  const totalLine = text.split(/\n+/).find((line) => /合计/.test(line) && !/价税合计/.test(line)) ?? ''
  const subtotalRow = groupOcrLines(ocrLines).find(rowIsSubtotal)
  const rowText = subtotalRow?.map((entry) => entry.line.text).join(' ') ?? ''
  const values = [...(rowText || totalLine).matchAll(/(?:[¥￥]\s*)?([\d,]+\.\d{2})/g)].map((match) => match[1].replaceAll(',', ''))
  const itemAmount = items.reduce((sum, item) => sum + (toNumber(item.amount) ?? 0), 0)
  const itemTax = items.reduce((sum, item) => sum + (toNumber(item.taxAmount) ?? 0), 0)
  return {
    excludingTax: values[0] ?? (itemAmount > 0 ? itemAmount.toFixed(2) : ''),
    tax: values[1] ?? (itemTax > 0 ? itemTax.toFixed(2) : '')
  }
}

function extractAmountInWords(text: string): string {
  return cleanField(text.match(/(?:价税合计[^\n]{0,24})?\s*[（(]大写[）)]\s*[:：]?\s*([^\n（(]*?)(?=\s*[（(]小写[）)]|$)/)?.[1])
}

function extractRemarks(text: string): string {
  return cleanField(text.match(/备注\s*[:：]?\s*([\s\S]*?)(?=(?:收款人|复核|开票人)\s*[:：]|$)/)?.[1])
}

function extractExtraFields(lines: string[]): InvoiceExtraField[] {
  const excluded = /^(?:名称|统一社会信用代码|纳税人识别号|税号|地址|电话|开户行|账号|发票代码|发票号码|发票号|开票日期|日期|收款人|复核|开票人|备注|项目名称|规格型号|单位|数量|单价|金额|税率|征收率|税额)$/
  const results: InvoiceExtraField[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    for (const match of line.matchAll(/([^:：\s]{2,18})\s*[:：]\s*([^:：\n]{1,100})/g)) {
      const label = cleanField(match[1])
      const value = cleanField(match[2])
      const key = `${label}:${value}`
      if (!label || !value || excluded.test(label) || seen.has(key)) continue
      seen.add(key)
      results.push({ label, value })
    }
  }
  return results
}

function extractInvoiceType(lines: string[]): string {
  const title = lines.slice(0, 20).find((line) =>
    /发票/.test(line) && /增值税|电子|普通|专用|数电|全电/.test(line) && !/号码|代码|日期|查验/.test(line)
  )?.trim()
  if (title) return title
  const fragment = lines.slice(0, 20).find((line) => /^(?:电子发|数电发|增值税发)$/.test(line.trim()))
  return fragment ? `${fragment.trim()}票` : ''
}

function inferCategory(text: string): InvoiceCategory {
  for (const [category, keywords] of Object.entries(categoryKeywords) as [InvoiceCategory, string[]][]) {
    if (category !== '其他' && keywords.some((keyword) => text.includes(keyword))) return category
  }
  return '其他'
}

export function parseOcr(
  lines: string[],
  scores: number[],
  ocrLines: OcrLine[] = [],
  qrCodeText = '',
  structuredFields: StructuredInvoiceFields = {}
): Pick<
  Invoice,
  | 'invoiceNumber'
  | 'date'
  | 'seller'
  | 'buyer'
  | 'amount'
  | 'category'
  | 'status'
  | 'ocrStatus'
  | 'confidence'
  | 'text'
  | 'ocrLines'
  | 'details'
> {
  const text = lines.join('\n')
  const confidence = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  const invoiceNumber = extractInvoiceNumber(text, structuredFields.invoiceNumber)
  const date = extractDate(text, structuredFields.issueDate)
  const buyer = extractParty(lines, 'buyer', ocrLines, structuredFields)
  const seller = extractParty(lines, 'seller', ocrLines, structuredFields)
  const amount = extractAmount(text, structuredFields.totalAmount)
  const details: InvoiceDetails = emptyInvoiceDetails()
  details.invoiceType = cleanField(structuredFields.invoiceType ?? '') || extractInvoiceType(lines)
  details.invoiceCode = structuredFields.invoiceCode?.match(/[0-9A-Za-z]{8,24}/)?.[0] ?? findLabeledValue(text, /发票代码\s*[:：]?/).match(/[0-9A-Za-z]{8,24}/)?.[0] ?? ''
  details.machineNumber = cleanField(structuredFields.machineNumber ?? '') || findLabeledValue(text, /机器编号|税控盘编号|机器编号\s*[:：]?/)
  details.checkCode = cleanField(structuredFields.checkCode ?? '') || findLabeledValue(text, /校验码\s*[:：]?/)
  details.buyer = buyer
  details.seller = seller
  details.items = extractLineItems(ocrLines)
  const totals = parseTotalAmounts(text, ocrLines, details.items)
  details.amountExcludingTax = parseAmount(structuredFields.amountExcludingTax)?.toFixed(2) ?? totals.excludingTax
  details.taxAmount = parseAmount(structuredFields.taxAmount)?.toFixed(2) ?? totals.tax
  details.amountInWords = cleanField(structuredFields.amountInWords ?? '') || extractAmountInWords(text)
  details.remarks = cleanField(structuredFields.remarks ?? '') || extractRemarks(text)
  details.payee = cleanField(structuredFields.payee ?? '') || findLabeledValue(text, /收款人\s*[:：]?/)
  details.reviewer = cleanField(structuredFields.reviewer ?? '').replace(/^人\s*[:：]?\s*/, '') || findLabeledValue(text, /复核人?\s*[:：]?/).replace(/^人\s*[:：]?\s*/, '')
  details.issuer = cleanField(structuredFields.issuer ?? '') || findLabeledValue(text, /开票人\s*[:：]?/)
  details.qrCodeText = qrCodeText
  details.extraFields = extractExtraFields(lines)

  const status: InvoiceStatus = 'review'

  return {
    invoiceNumber,
    date,
    seller: seller.name,
    buyer: buyer.name,
    amount,
    category: inferCategory(text),
    status,
    ocrStatus: 'done',
    confidence,
    text,
    ocrLines,
    details
  }
}
