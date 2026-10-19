import process from 'node:process'
import type { OcrModelPreset } from '../common/contracts'
import type { OcrWorkerLine, OcrWorkerResult } from './ocr-worker-client'

type WorkerRequest =
  | {
      id: number
      method: 'recognize'
      imagePath: string
      modelDirectory: string
      modelPreset: OcrModelPreset
    }
  | { id: number; method: 'close-ocr' | 'shutdown' }

let ocrPromise: ReturnType<typeof createOcr> | null = null
let ocrModelPreset: OcrModelPreset | null = null
let modelDirectory: string | null = null
let requestQueue = Promise.resolve()

async function createOcr(directory: string, preset: OcrModelPreset): Promise<Awaited<ReturnType<typeof import('rapidocr-node').RapidOCR.create>>> {
  const { RapidOCR } = await import('rapidocr-node')
  const model = { ocrVersion: 'PP-OCRv6', langType: 'ch', modelType: preset } as const
  return RapidOCR.create({
    modelDirectory: directory,
    detectionModel: model,
    recognitionModel: model,
    classifierModel: { ocrVersion: 'PP-OCRv4', langType: 'ch', modelType: 'mobile' },
    executionProviders: ['cpu'],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    enableCpuMemArena: false
  })
}

async function getOcr(directory: string, preset: OcrModelPreset): Promise<Awaited<ReturnType<typeof createOcr>>> {
  if (modelDirectory && modelDirectory !== directory) await closeOcr()
  if (ocrModelPreset && ocrModelPreset !== preset) await closeOcr()
  modelDirectory = directory
  ocrModelPreset = preset
  if (!ocrPromise) {
    ocrPromise = createOcr(directory, preset).catch((error) => {
      ocrPromise = null
      ocrModelPreset = null
      throw error
    })
  }
  return ocrPromise
}

async function closeOcr(): Promise<void> {
  const active = ocrPromise
  ocrPromise = null
  ocrModelPreset = null
  if (active) await (await active).close()
}

async function recognize(request: Extract<WorkerRequest, { method: 'recognize' }>): Promise<OcrWorkerResult> {
  const ocr = await getOcr(request.modelDirectory, request.modelPreset)
  const result = await ocr.recognize(request.imagePath)
  if (result.type !== 'ocr') return { type: 'empty' }

  const lines: OcrWorkerLine[] = result.lines.map((line) => ({
    text: line.text,
    confidence: line.confidence,
    box: line.box.map((point) => ({ x: point.x, y: point.y })) as OcrWorkerLine['box']
  }))
  return { type: 'ocr', txts: result.txts, scores: result.scores, lines }
}

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    let result: OcrWorkerResult | undefined
    if (request.method === 'recognize') {
      result = await recognize(request)
    } else if (request.method === 'close-ocr') {
      await closeOcr()
    } else {
      await closeOcr()
    }
    process.parentPort.postMessage({ id: request.id, success: true, result })
    if (request.method === 'shutdown') setImmediate(() => process.exit(0))
  } catch (error) {
    process.parentPort.postMessage({
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

process.parentPort.on('message', (event) => {
  const request = event.data as WorkerRequest
  requestQueue = requestQueue.then(() => handleRequest(request)).catch((error: unknown) => {
    console.error('处理本地识别请求失败。', error)
  })
})
