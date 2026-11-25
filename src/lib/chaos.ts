// 카오스 실험 어휘. BE는 형식만 검증하고 의미는 샌드박스가 안다.
// 출처: codereferee-sandbox app/main.py (experiment_command, deploy_repository), profiles/*.json
// 샌드박스에 시나리오나 프로필이 추가되면 여기만 고치면 된다.

export interface ChaosModeInfo {
  value: string
  label: string
  description: string
  // 레포를 배포해서 실험하는 모드. deployment_profile이 있어야 샌드박스가 대상을 찾을 수 있다.
  needsProfile: boolean
}

export const CHAOS_MODES: readonly ChaosModeInfo[] = [
  { value: 'suite_quick', label: '빠른 검사', needsProfile: true,
    description: 'Container Kill로 컨테이너 재시작과 복구를 확인해요.' },
  { value: 'suite_standard', label: '중간 검사', needsProfile: true,
    description: '동시 사용자 10·50·100·200명 부하를 먼저 걸어 몇 명까지 버티는지 재고, 이어서 Container Kill, CPU 부하, 네트워크 지연을 검사해요.' },
  { value: 'suite_deep', label: '정밀 검사', needsProfile: true,
    description: '동시 사용자 부하와 등록된 8개 장애 시나리오를 순서대로 검사해요. 빌드와 복구에 따라 수 분 이상 걸릴 수 있어요.' },
  { value: 'load_concurrent_users', label: '동시 사용자 부하', needsProfile: true,
    description: '동시 사용자를 10·50·100·200명으로 늘려 가며 요청을 보내고, 실패 없이 답한 최대 인원과 응답 시간을 재요.' },
  { value: 'litmus_container_kill', label: 'Container Kill', needsProfile: true,
    description: '컨테이너 프로세스를 종료하고 같은 Pod 안에서 재시작되는지 확인해요.' },
  { value: 'litmus_pod_cpu_hog', label: 'CPU Stress', needsProfile: true,
    description: '컨테이너에 CPU 부하를 주입하고 HTTP 응답과 복구를 관측해요.' },
  { value: 'litmus_pod_network_latency', label: '네트워크 지연', needsProfile: true,
    description: 'Pod 네트워크에 지연을 주입하고 cluster 내부에서 응답 시간을 측정해요.' },
  { value: 'litmus_pod_network_loss', label: '패킷 손실', needsProfile: true,
    description: 'Pod 네트워크에 패킷 손실을 주입하고 요청 실패와 복구를 관측해요.' },
  { value: 'litmus_pod_memory_hog', label: '메모리 압박', needsProfile: true,
    description: '선언된 컨테이너 메모리 한도 안에서 부하를 주입해요.' },
  { value: 'litmus_pod_memory_oom', label: '메모리 한도 초과', needsProfile: true,
    description: '메모리 한도를 넘는 부하를 주입하고 실제 OOM 발생 여부와 복구를 기록해요.' },
  { value: 'dependency_database_outage', label: 'DB 의존성 장애', needsProfile: true,
    description: '선언된 DB의 네트워크를 차단하고 업무 API 실패와 복구를 확인해요.' },
  { value: 'dependency_redis_outage', label: 'Redis 의존성 장애', needsProfile: true,
    description: '선언된 Redis의 네트워크를 차단하고 큐를 사용하는 업무 흐름을 확인해요.' },
  {
    value: 'litmus_pod_delete',
    label: 'Pod 삭제',
    description: 'LitmusChaos로 앱 Pod를 삭제하고 복구를 관측해요.',
    needsProfile: true,
  },
  {
    value: 'deployment_scale_down',
    label: '배포 스케일 다운',
    description: 'Deployment 복제본을 0으로 줄이고 복구를 관측해요.',
    needsProfile: true,
  },
  {
    value: 'service_selector_blackhole',
    label: 'Service 라우팅 단절',
    description: 'Service selector를 끊어 트래픽이 닿지 않게 해요.',
    needsProfile: true,
  },
  {
    value: 'rollout_restart',
    label: '롤아웃 재시작',
    description: 'Deployment를 재시작하는 동안의 가용성을 관측해요.',
    needsProfile: true,
  },
]

export const SUITES: Record<string, readonly string[]> = {
  suite_quick: ['litmus_container_kill'],
  suite_standard: ['load_concurrent_users', 'litmus_container_kill', 'litmus_pod_cpu_hog',
    'litmus_pod_network_latency'],
  suite_deep: ['load_concurrent_users', 'litmus_container_kill', 'litmus_pod_delete', 'litmus_pod_cpu_hog',
    'litmus_pod_network_latency', 'litmus_pod_network_loss', 'service_selector_blackhole',
    'deployment_scale_down', 'rollout_restart'],
}
const ALIASES: Record<string, string> = {
  litmus_container_kill: 'ck', litmus_pod_delete: 'pd', litmus_pod_cpu_hog: 'cpu',
  litmus_pod_network_latency: 'lat', litmus_pod_network_loss: 'loss',
  service_selector_blackhole: 'route', deployment_scale_down: 'scale', rollout_restart: 'roll',
  dependency_database_outage: 'db', dependency_redis_outage: 'redis',
  litmus_pod_memory_hog: 'mem', litmus_pod_memory_oom: 'oom',
  // v1 비트마스크는 이 순서를 쓴다. 새 시나리오는 끝에만 붙인다(샌드박스 CUSTOM_V1과 같은 순서).
  load_concurrent_users: 'load',
}

export function inspectionMode(mode: string, extras: readonly string[]): string {
  if (!extras.length) return mode
  const modes = [...new Set([...(SUITES[mode] ?? [mode]), ...extras])]
  const shortMode = 'suite_custom__' + modes.map((item) => ALIASES[item]).join('__')
  if (shortMode.length <= 64) return shortMode
  const order = Object.keys(ALIASES)
  const bits = modes.reduce((value, item) => value | (1 << order.indexOf(item)), 0)
  return 'suite_custom__v1_' + bits.toString(16)
}

// 모드를 고르지 않으면 샌드박스가 제어된 fixture 서비스를 대상으로 기본 실험(Pod Kill)을 한다.
// 사용자 레포를 실제로 실행하는 실험이 아니라는 점을 화면에서 분명히 보여준다.
export const DEFAULT_MODE_LABEL = '기본 (fixture 서비스)'

// 샌드박스가 profiles/{name}.json으로 조회하는 배포 프로필.
export const KNOWN_DEPLOYMENT_PROFILES = ['quickbyte-demo', 'quickbyte-demo-ha']

// BE 검증 규칙과 같은 정규식 (RepositoryValidationRequest)
export const CHAOS_MODE_PATTERN = /^[a-z0-9_]+$/
export const DEPLOYMENT_PROFILE_PATTERN = /^[a-z0-9-]+$/

export const modeInfo = (mode: string | null | undefined) =>
  CHAOS_MODES.find((m) => m.value === mode)

// 알 수 없는 모드(샌드박스에 새로 생긴 것)도 값 그대로 보여준다.
export const modeLabel = (mode: string | null | undefined) =>
  mode ? (modeInfo(mode)?.label ?? mode) : DEFAULT_MODE_LABEL

// 판정 불가일 때 샌드박스가 밝힌 멈춘 곳(metrics.stopped_at)을 문장으로.
// 값은 deploy | smoke | scenario:<chaosMode>. 모르는 값은 그대로 보여준다.
export function describeStop(stoppedAt: unknown, reason: unknown): string | null {
  if (typeof stoppedAt !== 'string' || !stoppedAt) return null
  let where = stoppedAt
  if (stoppedAt === 'deploy') where = '레포 배포 단계(clone·빌드·기동)'
  else if (stoppedAt === 'smoke') where = '기동 확인 단계'
  else if (stoppedAt.startsWith('scenario:')) where = `장애 시나리오 '${modeLabel(stoppedAt.slice(9))}'`
  const detail = typeof reason === 'string' && reason ? ` 마지막 오류: ${reason}` : ''
  return `${where}에서 멈췄어요.${detail}`
}

// 동시 사용자 부하 결과. 단독 실행이면 chaos_observation.load, 묶음이면 scenarios[].chaos_observation.load.
// 출처: codereferee-sandbox scripts/run_load_experiment.py
export interface LoadStage {
  users: number
  requests?: number
  failed_requests?: number
  error_rate?: number
  throughput_rps?: number
  p95_latency_ms?: number | null
}

export interface LoadResult {
  stages: LoadStage[]
  max_users_without_errors?: number | null
  first_users_with_errors?: number | null
  latency_growth?: { from_users: number, from_p95_ms: number, to_users: number, to_p95_ms: number,
    ratio: number | null } | null
  overload_behavior?: { users: number, kind: string | null } | null
  target_users?: number | null
  target_met?: boolean | null
}

// 첫 실패 단계가 어떻게 무너졌는지. 고칠 곳이 다르다.
const OVERLOAD_SENTENCE: Record<string, string> = {
  rejected: '넘친 요청은 바로 거절했어요(503·429). 사용자를 붙잡아 두지 않는 건 좋은 신호예요.',
  timed_out: '넘친 요청을 붙잡고 있다가 시간 초과로 끝냈어요. 사용자가 기다리다 실패하는 모양이에요.',
  connection_failed: '넘치자 연결 자체를 받지 못했어요.',
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function findLoad(observation: unknown): LoadResult | null {
  if (!isObject(observation)) return null
  const candidates = [observation.load, ...(Array.isArray(observation.scenarios)
    ? observation.scenarios.map((s) => isObject(s) && isObject(s.chaos_observation) ? s.chaos_observation.load : null)
    : [])]
  const load = candidates.find((c) => isObject(c) && Array.isArray(c.stages))
  return load ? load as unknown as LoadResult : null
}

// 판정과 같은 근거로 한 문장. 몇 명을 버텨야 하는지는 서비스마다 달라 합격 기준으로 쓰지 않는다.
export function describeLoad(load: LoadResult): string {
  const ok = load.max_users_without_errors
  const first = load.first_users_with_errors
  let sentence: string
  if (first == null) {
    const top = load.stages.at(-1)?.users
    sentence = top ? `동시 사용자 ${top}명까지 모든 요청에 답했어요.` : '부하 단계가 실행되지 않았어요.'
  } else {
    const stage = load.stages.find((s) => s.users === first)
    const rate = stage?.error_rate != null ? ` 요청의 ${(stage.error_rate * 100).toFixed(1)}%가 실패했어요.` : ''
    sentence = ok
      ? `동시 사용자 ${ok}명까지는 모두 답했고, ${first}명에서${rate || ' 실패가 나기 시작했어요.'}`
      : `동시 사용자 ${first}명부터 실패가 났어요.${rate}`
  }
  const growth = load.latency_growth
  if (growth?.ratio != null) {
    sentence += ` 응답 시간(p95)은 ${growth.from_users}명일 때 ${Math.round(growth.from_p95_ms)}ms에서 `
      + `${growth.to_users}명일 때 ${Math.round(growth.to_p95_ms)}ms로 ${growth.ratio}배가 됐어요.`
  }
  if (load.target_users && load.target_met != null) {
    sentence += load.target_met
      ? ` 예상하신 ${load.target_users}명까지 모두 답했어요.`
      : ` 예상하신 ${load.target_users}명을 버티지 못했어요.`
  }
  const kind = load.overload_behavior?.kind
  if (kind && OVERLOAD_SENTENCE[kind]) sentence += ' ' + OVERLOAD_SENTENCE[kind]
  return sentence
}
