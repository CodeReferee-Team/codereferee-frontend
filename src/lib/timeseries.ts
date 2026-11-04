// 샌드박스가 응답에 싣는 1초 간격 자원 시계열(Prometheus range query 결과)을 화면용으로 바꾼다.
//
// 위치: aiReports.execution_result.source.metrics_observation
//       (AI가 aiReports.metrics.source에도 같은 객체를 넣어서 둘 다 본다)
// 모양: cpu_cores, memory_working_set_bytes = [{ metric: { pod, container, ... },
//       values: [[epoch초(소수), "문자열 값"], ...] }]. 파드마다 한 줄이고,
//       컨테이너가 죽어 파드가 바뀌면 새 파드의 줄이 이어서 생긴다.
// 출처: codereferee-sandbox scripts/metrics_lifecycle.py, codereferee-AI의 실서버 캡처
//       ai-core/tests/fixtures/chaos_actual
//
// 이 파일은 테스트를 바로 돌릴 수 있게 다른 모듈을 가져오지 않는다.

type Obj = Record<string, unknown>

export interface SeriesPoint {
  t: number // epoch 초
  v: number
}

export interface ResourceSeries {
  id: string
  label: string // 보통 파드 이름
  points: SeriesPoint[]
}

// 장애를 건 구간. 시각은 모두 epoch 초.
export interface FaultWindow {
  label: string
  start: number
  revertedAt: number | null // 장애를 거둔 시각
  recoveredAt: number | null // 서비스가 정상으로 돌아온 시각
}

export interface ResourceLimits {
  cpuCores: number | null
  memoryBytes: number | null
}

export interface ResourceTimeseries {
  cpu: ResourceSeries[]
  memory: ResourceSeries[]
  windows: FaultWindow[]
  limits: ResourceLimits
  tMin: number
  tMax: number
}

const isObj = (v: unknown): v is Obj =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function num(v: unknown): number | null {
  if (typeof v === 'string' && v.trim() === '') return null
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

// 서버 시각은 소수 9자리까지 올 수 있다. Date는 3자리까지만 보장해서 자른다.
function toEpoch(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const ms = Date.parse(v.replace(/(\.\d{3})\d+/, '$1'))
  return Number.isNaN(ms) ? null : ms / 1000
}

// 쿠버네티스 수량 표기를 기본 단위(코어, 바이트)로. 모르는 표기는 null.
export function parseQuantity(q: unknown): number | null {
  if (typeof q === 'number') return Number.isFinite(q) ? q : null
  if (typeof q !== 'string') return null
  const m = q.trim().match(/^([0-9.]+)\s*(Ki|Mi|Gi|Ti|k|M|G|T|m)?$/)
  if (!m) return null
  const base = Number(m[1])
  if (!Number.isFinite(base)) return null
  const unit: Record<string, number> = {
    '': 1, Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40,
    k: 1e3, M: 1e6, G: 1e9, T: 1e12, m: 1e-3,
  }
  return base * unit[m[2] ?? '']
}

function parseMatrix(raw: unknown): ResourceSeries[] {
  if (!Array.isArray(raw)) return []
  const out: ResourceSeries[] = []
  raw.forEach((item, i) => {
    if (!isObj(item) || !Array.isArray(item.values)) return
    const points: SeriesPoint[] = []
    for (const p of item.values) {
      if (!Array.isArray(p) || p.length < 2) continue
      const t = num(p[0])
      const v = num(p[1]) // 'NaN'이나 빈 값은 건너뛴다
      if (t !== null && v !== null) points.push({ t, v })
    }
    if (points.length === 0) return
    points.sort((a, b) => a.t - b.t)
    const metric = isObj(item.metric) ? item.metric : {}
    const label =
      typeof metric.pod === 'string' ? metric.pod
        : typeof metric.instance === 'string' ? metric.instance
          : `시리즈 ${i + 1}`
    out.push({ id: String(i), label, points })
  })
  return out
}

function findObservation(reports: { metrics?: unknown; execution_result?: unknown }): Obj | null {
  const fromExec = isObj(reports.execution_result) && isObj(reports.execution_result.source)
    ? reports.execution_result.source.metrics_observation : undefined
  const fromMetrics = isObj(reports.metrics) && isObj(reports.metrics.source)
    ? reports.metrics.source.metrics_observation : undefined
  const obs = isObj(fromExec) ? fromExec : isObj(fromMetrics) ? fromMetrics : null
  return obs
}

function limitsOf(observation: Obj): ResourceLimits {
  const bindings = Array.isArray(observation.pod_bindings) ? observation.pod_bindings : []
  for (const b of bindings) {
    const limits = isObj(b) && isObj(b.resources) && isObj(b.resources.limits) ? b.resources.limits : null
    if (!limits) continue
    const cpuCores = parseQuantity(limits.cpu)
    const memoryBytes = parseQuantity(limits.memory)
    if (cpuCores !== null || memoryBytes !== null) return { cpuCores, memoryBytes }
  }
  return { cpuCores: null, memoryBytes: null }
}

function windowOf(label: string, co: Obj): FaultWindow | null {
  const start = toEpoch(co.started_at)
  if (start === null) return null
  return {
    label,
    start,
    revertedAt: toEpoch(co.fault_reverted_at),
    recoveredAt: toEpoch(co.recovered_at),
  }
}

// 묶음 검사는 scenarios 배열에 시나리오별 구간이 있고, 단독 검사는 chaos_observation 자체가 구간이다.
function findWindows(reports: { metrics?: unknown; execution_result?: unknown }): FaultWindow[] {
  const candidates = [
    isObj(reports.metrics) ? reports.metrics.chaos_observation : undefined,
    isObj(reports.execution_result) ? reports.execution_result.chaos_observation : undefined,
  ]
  const co = candidates.find(isObj)
  if (!co) return []
  if (Array.isArray(co.scenarios) && co.scenarios.length > 0) {
    const out: FaultWindow[] = []
    for (const sc of co.scenarios) {
      if (!isObj(sc)) continue
      const inner = isObj(sc.chaos_observation) ? sc.chaos_observation : sc
      const label = String(sc.scenario ?? sc.chaosMode ?? inner.type ?? '')
      const w = windowOf(label, inner)
      if (w) out.push(w)
    }
    return out
  }
  const w = windowOf(String(co.type ?? ''), co)
  return w ? [w] : []
}

// 그릴 시계열이 없으면 null. CPU와 메모리 중 하나만 있어도 그린다.
export function extractTimeseries(
  reports: { metrics?: unknown; execution_result?: unknown },
): ResourceTimeseries | null {
  const obs = findObservation(reports)
  if (!obs) return null
  const cpu = parseMatrix(obs.cpu_cores)
  const memory = parseMatrix(obs.memory_working_set_bytes)
  const all = [...cpu, ...memory].flatMap((s) => s.points)
  if (all.length === 0) return null
  let tMin = Infinity
  let tMax = -Infinity
  for (const p of all) {
    if (p.t < tMin) tMin = p.t
    if (p.t > tMax) tMax = p.t
  }
  return { cpu, memory, windows: findWindows(reports), limits: limitsOf(obs), tMin, tMax }
}

// 구간 [from, to] 안의 최댓값. 점이 없으면 null.
export function peakOf(series: ResourceSeries[], from = -Infinity, to = Infinity): number | null {
  let best: number | null = null
  for (const s of series) {
    for (const p of s.points) {
      if (p.t >= from && p.t <= to && (best === null || p.v > best)) best = p.v
    }
  }
  return best
}

// 시각 t에 가장 가까운 점. maxGap초보다 멀면 null (파드가 없던 시각을 거짓으로 채우지 않는다).
export function nearestPoint(points: SeriesPoint[], t: number, maxGap = 2): SeriesPoint | null {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t < t) lo = mid + 1
    else hi = mid
  }
  const cands = [points[lo - 1], points[lo]].filter((p): p is SeriesPoint => !!p)
  const best = cands.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0]
  return best && Math.abs(best.t - t) <= maxGap ? best : null
}

// 점이 너무 많으면 SVG가 무거워서 균등하게 줄인다. 처음과 끝은 남긴다.
export function thin(points: SeriesPoint[], maxPoints = 600): SeriesPoint[] {
  if (points.length <= maxPoints) return points
  const stride = Math.ceil(points.length / maxPoints)
  const out = points.filter((_, i) => i % stride === 0)
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}
