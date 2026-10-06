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
    description: 'Container Kill, CPU 부하, 네트워크 지연을 순서대로 검사해요.' },
  { value: 'suite_deep', label: '정밀 검사', needsProfile: true,
    description: '등록된 8개 장애 시나리오를 순서대로 검사해요. 빌드와 복구에 따라 수 분 이상 걸릴 수 있어요.' },
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
  suite_standard: ['litmus_container_kill', 'litmus_pod_cpu_hog', 'litmus_pod_network_latency'],
  suite_deep: ['litmus_container_kill', 'litmus_pod_delete', 'litmus_pod_cpu_hog',
    'litmus_pod_network_latency', 'litmus_pod_network_loss', 'service_selector_blackhole',
    'deployment_scale_down', 'rollout_restart'],
}
const ALIASES: Record<string, string> = {
  litmus_container_kill: 'ck', litmus_pod_delete: 'pd', litmus_pod_cpu_hog: 'cpu',
  litmus_pod_network_latency: 'lat', litmus_pod_network_loss: 'loss',
  service_selector_blackhole: 'route', deployment_scale_down: 'scale', rollout_restart: 'roll',
  dependency_database_outage: 'db', dependency_redis_outage: 'redis',
  litmus_pod_memory_hog: 'mem', litmus_pod_memory_oom: 'oom',
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
