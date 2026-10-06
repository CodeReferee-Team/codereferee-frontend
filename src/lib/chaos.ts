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
