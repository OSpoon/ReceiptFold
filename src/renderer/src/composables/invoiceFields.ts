export const partySections = [{ key: 'buyer', label: '购买方' }, { key: 'seller', label: '销售方' }] as const
export const partyFields = [
  { key: 'name', label: '名称' },
  { key: 'taxId', label: '统一社会信用代码 / 纳税人识别号' },
  { key: 'address', label: '地址' },
  { key: 'phone', label: '电话' },
  { key: 'bankName', label: '开户行' },
  { key: 'bankAccount', label: '银行账号' }
] as const
export const faceMetadataFields = [
  { key: 'invoiceType', label: '发票类型' },
  { key: 'invoiceCode', label: '发票代码' },
  { key: 'machineNumber', label: '机器编号' },
  { key: 'checkCode', label: '校验码' }
] as const
export const faceAmountFields = [
  { key: 'amountExcludingTax', label: '金额（不含税）' },
  { key: 'taxAmount', label: '税额' },
  { key: 'amountInWords', label: '价税合计大写' }
] as const
export const facePersonFields = [
  { key: 'issuer', label: '开票人' },
  { key: 'reviewer', label: '复核' },
  { key: 'payee', label: '收款人' }
] as const
export const itemFields = [
  { key: 'name', label: '项目名称' },
  { key: 'specification', label: '规格型号' },
  { key: 'unit', label: '单位' },
  { key: 'quantity', label: '数量' },
  { key: 'unitPrice', label: '单价' },
  { key: 'amount', label: '金额' },
  { key: 'taxRate', label: '税率 / 征收率' },
  { key: 'taxAmount', label: '税额' }
] as const
