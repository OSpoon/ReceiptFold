import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DbContext, Dbo, type DbMigration } from 'sqlite3-queries'
import type { Invoice } from '../common/contracts'

const migrations: DbMigration[] = [
  {
    version: 1,
    sqls: [
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY NOT NULL,
        sort_order INTEGER NOT NULL,
        invoice_number TEXT NOT NULL DEFAULT '',
        issue_date TEXT NOT NULL DEFAULT '',
        seller TEXT NOT NULL DEFAULT '',
        buyer TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT '其他',
        status TEXT NOT NULL DEFAULT 'review',
        file_key TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS invoices_sort_order_idx ON invoices(sort_order)',
      'CREATE INDEX IF NOT EXISTS invoices_number_idx ON invoices(invoice_number)',
      'CREATE INDEX IF NOT EXISTS invoices_date_idx ON invoices(issue_date)',
      'CREATE INDEX IF NOT EXISTS invoices_seller_idx ON invoices(seller)',
      'CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status)',
      'CREATE INDEX IF NOT EXISTS invoices_category_idx ON invoices(category)',
      `CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`
    ]
  },
  {
    version: 2,
    sqls: [
      `UPDATE invoices
      SET status = 'review', payload = json_set(payload, '$.status', 'review')
      WHERE status = 'confirmed'
        AND json_valid(payload)
        AND json_extract(payload, '$.ocrStatus') = 'done'
        AND COALESCE(json_extract(payload, '$.createdAt'), '') <> ''
        AND json_extract(payload, '$.createdAt') = json_extract(payload, '$.updatedAt')`
    ]
  }
]

type InvoiceRow = {
  payload: string
}

type InvoiceFields = {
  id: string
  invoiceNumber: string
  date: string
  seller: string
  buyer: string
  amount: number
  category: string
  status: string
  fileKey: string
  updatedAt: string
}

const insertInvoiceSql = `INSERT INTO invoices (
  id, sort_order, invoice_number, issue_date, seller, buyer, amount,
  category, status, file_key, updated_at, payload
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

export class LocalInvoiceDatabase extends DbContext {
  private operationQueue: Promise<void> = Promise.resolve()
  private closePromise: Promise<void> | null = null
  private closing = false

  constructor(filePath: string) {
    super(new Dbo(filePath), migrations)
  }

  async initialize(legacyJsonPath: string): Promise<void> {
    await mkdir(dirname(this.dbo.fileName), { recursive: true })
    await this.open()
    await this.dbo.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    await this.importLegacyJson(legacyJsonPath)
  }

  async listInvoices(): Promise<unknown[]> {
    return this.enqueue(async () => {
      const rows = await this.dbo.all<InvoiceRow>('SELECT payload FROM invoices ORDER BY sort_order ASC, rowid ASC')
      return rows.map((row) => JSON.parse(row.payload) as unknown)
    })
  }

  async replaceInvoices(invoices: Invoice[]): Promise<void> {
    return this.enqueue(() => this.replaceInvoicesNow(invoices))
  }

  override close(): Promise<void> {
    if (this.closePromise) return this.closePromise
    this.closing = true
    const operation = this.operationQueue.then(() => super.close())
    this.operationQueue = operation.catch(() => undefined)
    this.closePromise = operation
    return operation
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('本地发票数据库正在关闭。'))
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.then(() => undefined, () => undefined)
    return result
  }

  private async importLegacyJson(legacyJsonPath: string): Promise<void> {
    const migration = await this.dbo.get<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      ['legacy-json-imported']
    )
    if (migration) return

    let legacyInvoices: unknown[] = []
    try {
      const parsed: unknown = JSON.parse(await readFile(legacyJsonPath, 'utf8'))
      if (Array.isArray(parsed)) legacyInvoices = parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    await this.withTransaction(async () => {
      const existing = await this.dbo.get<{ count: number }>('SELECT COUNT(*) AS count FROM invoices')
      if (Number(existing?.count ?? 0) === 0) {
        for (const [sortOrder, invoice] of legacyInvoices.entries()) {
          await this.insertInvoice(invoice, sortOrder)
        }
      }
      await this.dbo.run('INSERT INTO app_metadata (key, value) VALUES (?, ?)', ['legacy-json-imported', '1'])
    })
  }

  private async replaceInvoicesNow(invoices: Invoice[]): Promise<void> {
    await this.withTransaction(async () => {
      await this.dbo.exec('DELETE FROM invoices')
      for (const [sortOrder, invoice] of invoices.entries()) {
        await this.insertInvoice(invoice, sortOrder)
      }
    })
  }

  private async insertInvoice(value: unknown, sortOrder: number): Promise<void> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const raw = value as Partial<Invoice>
    const invoice = { ...raw, id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID() }
    if (
      invoice.status === 'confirmed' &&
      invoice.ocrStatus === 'done' &&
      typeof invoice.createdAt === 'string' &&
      invoice.createdAt.length > 0 &&
      invoice.createdAt === invoice.updatedAt
    ) {
      invoice.status = 'review'
    }
    const fields: InvoiceFields = {
      id: invoice.id,
      invoiceNumber: stringValue(invoice.invoiceNumber),
      date: stringValue(invoice.date),
      seller: stringValue(invoice.seller),
      buyer: stringValue(invoice.buyer),
      amount: Number.isFinite(Number(invoice.amount)) ? Number(invoice.amount) : 0,
      category: stringValue(invoice.category) || '其他',
      status: stringValue(invoice.status) || 'review',
      fileKey: stringValue(invoice.fileKey),
      updatedAt: stringValue(invoice.updatedAt)
    }
    await this.dbo.run(insertInvoiceSql, [
      fields.id,
      sortOrder,
      fields.invoiceNumber,
      fields.date,
      fields.seller,
      fields.buyer,
      fields.amount,
      fields.category,
      fields.status,
      fields.fileKey,
      fields.updatedAt,
      JSON.stringify(invoice)
    ])
  }

  private async withTransaction(operation: () => Promise<void>): Promise<void> {
    await this.dbo.exec('BEGIN IMMEDIATE TRANSACTION')
    try {
      await operation()
      await this.dbo.exec('COMMIT')
    } catch (error) {
      await this.dbo.exec('ROLLBACK').catch(() => undefined)
      throw error
    }
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
