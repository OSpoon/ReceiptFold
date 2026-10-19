import { utilityProcess, type UtilityProcess } from 'electron'
import type { OcrModelPreset } from '../common/contracts'

export interface OcrWorkerLine {
  text: string
  confidence: number
  box: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
}

export type OcrWorkerResult =
  | {
      type: 'ocr'
      txts: string[]
      scores: number[]
      lines: OcrWorkerLine[]
    }
  | { type: 'empty' }

type WorkerRequest =
  | {
      id: number
      method: 'recognize'
      imagePath: string
      modelDirectory: string
      modelPreset: OcrModelPreset
    }
  | { id: number; method: 'close-ocr' | 'shutdown' }
type WorkerRequestPayload = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never

type WorkerResponse = { id: number; success: true; result?: unknown } | { id: number; success: false; error: string }

interface PendingRequest {
  method: WorkerRequest['method']
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

interface WorkerInstance {
  process: UtilityProcess
  expectedExit: boolean
}

export class OcrWorkerClient {
  private worker: WorkerInstance | null = null
  private nextRequestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private unavailableReason: string | null = null

  constructor(private readonly workerPath: string) {}

  async recognize(options: {
    imagePath: string
    modelDirectory: string
    modelPreset: OcrModelPreset
  }): Promise<OcrWorkerResult> {
    const result = await this.request<OcrWorkerResult>({ method: 'recognize', ...options })
    if (!result) throw new Error('本地识别进程没有返回识别结果。')
    return result
  }

  async closeOcr(): Promise<void> {
    if (this.worker) await this.request({ method: 'close-ocr' })
  }

  async shutdown(): Promise<void> {
    const worker = this.worker
    if (!worker) return
    worker.expectedExit = true
    try {
      await this.request({ method: 'shutdown' })
    } catch (error) {
      console.error('关闭本地识别进程失败。', error)
      worker.process.kill()
    }
    if (this.worker === worker) this.worker = null
  }

  private getWorker(): WorkerInstance {
    if (this.unavailableReason) throw new Error(this.unavailableReason)
    if (this.worker) return this.worker

    const child = utilityProcess.fork(this.workerPath, [], { serviceName: 'ReceiptFold OCR' })
    const worker: WorkerInstance = { process: child, expectedExit: false }
    this.worker = worker

    child.on('message', (message: WorkerResponse) => {
      if (!message || typeof message !== 'object' || !('id' in message)) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.success) pending.resolve(message.result)
      else pending.reject(new Error(message.error))
    })

    child.on('error', (type, location) => {
      console.error('本地识别进程发生致命错误。', type, location)
    })

    child.on('exit', (code) => {
      if (this.worker === worker) this.worker = null
      if (!worker.expectedExit) {
        this.unavailableReason = '本地 OCR 进程异常退出，已停止后续识别以保护应用。请重新启动应用后重试。'
      }
      const reason = worker.expectedExit
        ? '本地识别进程已关闭。'
        : `本地 OCR 进程异常退出（${code}），已停止后续识别以保护应用。请重新启动应用后重试。`
      for (const [id, pending] of this.pending) {
        this.pending.delete(id)
        pending.reject(new Error(reason))
      }
      if (!worker.expectedExit) console.error(reason)
    })

    return worker
  }

  private request<Result = undefined>(request: WorkerRequestPayload): Promise<Result | undefined> {
    const worker = this.getWorker()
    const id = ++this.nextRequestId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method: request.method, resolve: (result) => resolve(result as Result | undefined), reject })
      try {
        worker.process.postMessage({ ...request, id } as WorkerRequest)
      } catch (error) {
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
