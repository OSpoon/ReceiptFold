type FieldDescriptions = Record<string, string>

type WorkerRequest =
  | {
      id: number
      method: 'extract'
      lines: Array<{ text: string }>
      modelDirectory: string
      fields: FieldDescriptions
    }
  | { id: number; method: 'close' | 'shutdown' }

type WorkerResponse =
  | { id: number; event: 'model-download-started' }
  | { id: number; success: true; result?: Record<string, string | null> }
  | { id: number; success: false; error: string }
type OCRTextStructurer = import('rapidocr-node/structured-output').OCRTextStructurer
type OCRStructuredDevice = import('rapidocr-node/structured-output').OCRStructuredDevice

let structurerPromise: Promise<OCRTextStructurer> | null = null
let structurerDirectory: string | null = null
let structurerDevice: OCRStructuredDevice | null = null
let preferredDevice: OCRStructuredDevice = process.platform === 'darwin' && process.arch === 'arm64' ? 'webgpu' : 'cpu'
let requestQueue = Promise.resolve()
let activeRequestId: number | null = null
let downloadReported = false
let modelFetchInstrumented = false

function isModelDownloadRequest(input: string | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input.href
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  if (method !== 'GET' || headers.has('range')) return false

  try {
    const requestUrl = new URL(url)
    return requestUrl.pathname.includes('/onnx-community/Qwen3-0.6B-ONNX/resolve/')
  } catch {
    return false
  }
}

async function instrumentModelDownloads(): Promise<void> {
  if (modelFetchInstrumented) return
  const { env } = await import('@huggingface/transformers')
  const originalFetch = env.fetch
  env.fetch = async (input, init) => {
    if (activeRequestId !== null && !downloadReported && isModelDownloadRequest(input, init)) {
      downloadReported = true
      process.send?.({ id: activeRequestId, event: 'model-download-started' } satisfies WorkerResponse)
    }
    return originalFetch(input, init)
  }
  modelFetchInstrumented = true
}

async function getStructurer(directory: string, device: OCRStructuredDevice): Promise<OCRTextStructurer> {
  if ((structurerDirectory && structurerDirectory !== directory) || (structurerDevice && structurerDevice !== device)) {
    await closeStructurer()
  }
  structurerDirectory = directory
  structurerDevice = device
  if (!structurerPromise) {
    structurerPromise = (async () => {
      await instrumentModelDownloads()
      const { OCRTextStructurer } = await import('rapidocr-node/structured-output')
      return new OCRTextStructurer({ modelDirectory: directory, device, maxNewTokens: 512 })
    })().catch((error) => {
      structurerPromise = null
      structurerDirectory = null
      structurerDevice = null
      throw error
    })
  }
  return structurerPromise
}

async function closeStructurer(): Promise<void> {
  const active = structurerPromise
  structurerPromise = null
  structurerDirectory = null
  structurerDevice = null
  if (active) await (await active).close()
}

async function extract(request: Extract<WorkerRequest, { method: 'extract' }>): Promise<Record<string, string | null>> {
  const keys = Object.keys(request.fields)
  const lines = request.lines.map((line) => line.text)
  const values: Record<string, string | null> = Object.fromEntries(keys.map((key) => [key, null]))
  if (keys.length === 0 || lines.length === 0 || lines.every((line) => line.trim().length === 0)) return values

  let result: Awaited<ReturnType<OCRTextStructurer['extract']>>
  try {
    result = await (await getStructurer(request.modelDirectory, preferredDevice)).extract(request.lines, request.fields)
  } catch (error) {
    if (preferredDevice !== 'webgpu') throw error

    console.warn('WebGPU 结构化提取失败，将在本次运行中切换到 CPU 重试。', error)
    await closeStructurer().catch((closeError: unknown) => {
      console.warn('关闭 WebGPU 结构化模型失败。', closeError)
    })
    preferredDevice = 'cpu'
    result = await (await getStructurer(request.modelDirectory, preferredDevice)).extract(request.lines, request.fields)
  }
  console.info(
    `结构化字段提取完成：设备 ${structurerDevice ?? preferredDevice}，模型加载 ${result.timings.modelLoad.toFixed(2)} 秒，生成 ${result.timings.generation.toFixed(2)} 秒。`
  )
  for (const key of keys) values[key] = result.values[key] ?? null
  return values
}

async function handleRequest(request: WorkerRequest): Promise<void> {
  activeRequestId = request.id
  downloadReported = false
  try {
    let result: Record<string, string | null> | undefined
    if (request.method === 'extract') result = await extract(request)
    else await closeStructurer()
    const response: WorkerResponse = { id: request.id, success: true, result }
    if (request.method === 'shutdown') {
      if (process.send) process.send(response, () => process.exit(0))
      else process.exit(0)
    } else {
      process.send?.(response)
    }
  } catch (error) {
    process.send?.({
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    } satisfies WorkerResponse)
  } finally {
    activeRequestId = null
  }
}

process.on('message', (request: WorkerRequest) => {
  requestQueue = requestQueue.then(() => handleRequest(request)).catch((error: unknown) => {
    console.error('处理结构化字段请求失败。', error)
  })
})
