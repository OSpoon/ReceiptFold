import { fork, type ChildProcess } from 'node:child_process'
import process from 'node:process'
import type { StructuredInvoiceFields } from './invoice-parser'

type FieldDescriptions = Readonly<Record<string, string>>

type WorkerRequest =
  | {
      id: number
      method: 'extract'
      lines: Array<{ text: string }>
      modelDirectory: string
      fields: FieldDescriptions
    }
  | { id: number; method: 'close' | 'shutdown' }
type WorkerRequestPayload = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never

type WorkerResponse =
  | { id: number; event: 'model-download-started' }
  | { id: number; success: true; result?: unknown }
  | { id: number; success: false; error: string }

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  onModelDownload?: () => void
}

interface WorkerInstance {
  process: ChildProcess
  expectedExit: boolean
}

export class StructuredFieldsWorkerClient {
  private worker: WorkerInstance | null = null
  private nextRequestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private unavailableReason: string | null = null

  constructor(
    private readonly workerPath: string,
    private readonly nodePath: string
  ) {}

  async extract(
    lines: Array<{ text: string }>,
    modelDirectory: string,
    fields: FieldDescriptions,
    onModelDownload?: () => void
  ): Promise<StructuredInvoiceFields> {
    const result = await this.request<StructuredInvoiceFields>({ method: 'extract', lines, modelDirectory, fields }, onModelDownload)
    if (!result) throw new Error('本地结构化字段模型没有返回识别结果。')
    return result
  }

  async close(): Promise<void> {
    if (this.worker) await this.request({ method: 'close' })
  }

  async shutdown(): Promise<void> {
    const worker = this.worker
    if (!worker) return
    worker.expectedExit = true
    const exited = new Promise<void>((resolve) => worker.process.once('exit', () => resolve()))
    try {
      await this.request({ method: 'shutdown' })
    } catch (error) {
      console.error('关闭本地结构化字段进程失败。', error)
      worker.process.kill()
    }
    await exited
    if (this.worker === worker) this.worker = null
  }

  private getWorker(): WorkerInstance {
    if (this.unavailableReason) throw new Error(this.unavailableReason)
    if (this.worker) return this.worker

    const childEnvironment = { ...process.env }
    delete childEnvironment.ELECTRON_RUN_AS_NODE
    const child = fork(this.workerPath, [], {
      execPath: this.nodePath,
      execArgv: [],
      env: childEnvironment,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    })
    const worker: WorkerInstance = { process: child, expectedExit: false }
    this.worker = worker

    child.on('message', (message: WorkerResponse) => {
      if (!message || typeof message !== 'object' || !('id' in message)) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      if ('event' in message) {
        pending.onModelDownload?.()
        return
      }
      this.pending.delete(message.id)
      if (message.success) pending.resolve(message.result)
      else pending.reject(new Error(message.error))
    })

    child.on('error', (error) => {
      console.error('本地结构化字段进程发生错误。', error)
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (message: string) => {
      const details = message.trim()
      if (details) console.error('本地结构化字段进程输出：', details)
    })

    child.on('exit', (code, signal) => {
      if (this.worker === worker) this.worker = null
      const reason = worker.expectedExit
        ? '本地结构化字段进程已关闭。'
        : `本地结构化字段模型异常退出（${code ?? signal ?? 'unknown'}）。`
      if (!worker.expectedExit) this.unavailableReason = reason
      for (const [id, pending] of this.pending) {
        this.pending.delete(id)
        pending.reject(new Error(reason))
      }
      if (!worker.expectedExit) console.error(reason)
    })

    return worker
  }

  private request<Result = undefined>(request: WorkerRequestPayload, onModelDownload?: () => void): Promise<Result | undefined> {
    const worker = this.getWorker()
    const id = ++this.nextRequestId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (result) => resolve(result as Result | undefined), reject, onModelDownload })
      try {
        worker.process.send({ ...request, id }, (error) => {
          if (!error) return
          this.pending.delete(id)
          reject(error)
        })
      } catch (error) {
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
