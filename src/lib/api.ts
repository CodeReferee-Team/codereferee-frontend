// codereferee-server(Spring Boot) API 계약. 서버 코드의 JSON 필드명을 그대로 따른다.
// 참고: RefereeController, TaskStatus, AgentStep, ResultQueueConsumer.buildAiReports

export type AgentStep =
  | 'QUEUED'
  | 'PREFLIGHT'
  | 'BASELINE'
  | 'CHAOS'
  | 'JUDGING'
  | 'REFINING'
  | 'PASSED'
  | 'FAILED'
  | 'ERROR'

const TERMINAL_STEPS: readonly AgentStep[] = ['PASSED', 'FAILED', 'ERROR']

export const isTerminal = (step: AgentStep) => TERMINAL_STEPS.includes(step)

// 샌드박스의 카오스 관측 원시 데이터 (codereferee-sandbox docs/chaos-v1-contract.md).
// 실험 종류(pod_kill, scale_down 등)마다 필드가 달라서 알려진 키만 optional로 두고 나머지는 허용한다.
export interface ChaosObservation {
  type?: string
  target_kind?: string
  target_name?: string
  namespace?: string
  replicas?: number
  started_at?: string
  replacement_pod_created?: boolean
  replacement_pod_name?: string
  recovered?: boolean
  [key: string]: unknown
}

// AI가 만든 metrics: 숫자·문자·null 같은 스칼라와 baseline/chaos_observation/source 객체가 섞여 있다.
export interface Metrics {
  observation_status?: 'observed' | 'infrastructure_error' | string
  infra_error?: string
  chaos_observation?: ChaosObservation
  baseline?: Record<string, unknown>
  source?: Record<string, unknown>
  [key: string]: unknown
}

// aiReports 내부 구조는 AI 모듈 출력 스키마(agent-output-schema.md)를 따르며 서버는 Map으로 그대로 전달한다.
// 실패 경로에서는 일부 키가 없을 수 있으므로 전부 optional로 둔다.
export interface AiReports {
  preflight_report?: Record<string, unknown>
  execution_result?: Record<string, unknown>
  validation_plan?: Record<string, unknown>
  metrics?: Metrics
  judge_report?: {
    status: 'Pass' | 'Fail'
    // 판정 사유의 정규 코드. 정규 집합은 reasons.ts의 REASON_CATEGORIES에 있지만
    // 서버가 집합을 넓혀도 응답 파싱이 깨지면 안 되므로 유니온으로 좁히지 않는다.
    // 구버전 응답에는 없을 수 있어 optional이다.
    reason_category?: string
    reason: string
    evidence: string[]
  }
  critic_feedback?: {
    issue: string
    root_cause: string
    evidence: string[]
    recommended_action: string
  }
  refiner_report?: {
    summary: string
    patch_guidance: string[]
    verification_steps: string[]
    risk: 'low' | 'medium' | 'high'
    // LLM 없이 도는 fallback 경로는 diff를 만들지 못해 둘 다 비어서 온다.
    patch_diff?: string | null
    edits?: Array<{ path: string; find: string[]; replace: string[] }> | null
  }
  // Refiner 패치를 적용해 다시 돌린 기록. 패치가 없었으면 빈 배열이다.
  refine_rounds?: Array<{
    round: number
    patch_bytes: number
    before_judge_status: string | null
    after_judge_status: string | null
    sandbox_exit_code: number | null
    failed_step: string | null
  }>
  events?: string[]
}

/** 장애 주입을 실제로 관측했는가.
 *
 * 카오스는 선택 단계다. `chaos_mode` 없이 보낸 요청은 빌드와 테스트만 검증한다.
 * 그 경우 이 값이 false이고, 진행 표시줄은 해당 단계를 완료가 아니라 건너뜀으로 그려야 한다.
 * 안 돌린 검사를 통과로 보여주면 사용자가 받지 않은 보증을 받았다고 믿는다. */
/** 우리 쪽 문제로 판정을 못 한 사유.
 *
 * status가 ERROR면 워크플로가 Judge를 건너뛰므로 `judge_report`가 비어 있다. 그때
 * 사용자에게 보여줄 사유는 여기에만 있다. 레포 결함이 아니라는 것을 말해 줘야 한다. */
export function infraError(reports: AiReports | null | undefined): string | null {
  const fromSandbox = reports?.execution_result?.infra_error
  if (typeof fromSandbox === 'string' && fromSandbox) return fromSandbox
  const fromPreflight = reports?.preflight_report?.infra_error
  return typeof fromPreflight === 'string' && fromPreflight ? fromPreflight : null
}

export function configurationIssue(reports: AiReports | null | undefined): string | null {
  const code = infraError(reports)
  if (code === 'uploaded_configuration_invalid') return '업로드한 validation.yaml의 문법·버전·크기와 지원 필드를 확인해 주세요. 이번에는 실행 설정을 적용하지 못해 판정하지 않았어요.'
  if (code === 'uploaded_configuration_not_applied') return '서버가 업로드한 설정의 적용을 확인해 주지 못했어요. 서버 배포 버전을 확인해야 하며, 레포 코드 결함으로 판단한 결과는 아니에요.'
  if (code === 'sandbox_configuration_unsupported') return '현재 실행 환경이 설정 업로드를 지원하지 않아요. 외부 Sandbox 연결과 배포 상태를 확인해 주세요.'
  if (code || reports?.judge_report?.reason_category !== 'service_not_deployable') return null
  const stderr = reports.execution_result?.stderr
  if (typeof stderr === 'string' && stderr.includes('Compose needs explicit safe reproduction settings for:') && stderr.includes('env_file')) {
    return 'Compose의 .env 파일은 자동으로 가져오지 않아요. 테스트용 환경변수와 의존성을 validation.yaml에 선언해 업로드해 주세요. 운영 비밀값을 GitHub에 올릴 필요는 없어요.'
  }
  return '실행할 HTTP 서비스와 의존성 설정을 확인해 주세요. 설정 파일을 업로드하거나 레포에 선언할 수 있어요. 서비스·레포 수 제한과 미지원 의존성도 확인해 주세요. 코드 결함으로 판단한 결과는 아니에요.'
}

export function uploadedConfiguration(reports: AiReports): { uploaded_sha256: string; effective_sha256?: string } | null {
  const source = reports.execution_result?.source ?? reports.metrics?.source
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  const input = (source as Record<string, unknown>).configuration_input
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  if (value.source !== 'request_upload' || typeof value.uploaded_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.uploaded_sha256)) return null
  return { uploaded_sha256: value.uploaded_sha256,
    ...(typeof value.effective_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.effective_sha256) ? { effective_sha256: value.effective_sha256 } : {}) }
}

/** 판정을 뒤집지 않는 경고. `metrics.policy_warnings`로 온다. */
export function policyWarnings(reports: AiReports | null | undefined): string[] {
  const raw = reports?.metrics?.policy_warnings
  return Array.isArray(raw) ? raw.filter((w): w is string => typeof w === 'string') : []
}

export function chaosObserved(reports: AiReports | null | undefined): boolean {
  const observation = reports?.execution_result?.chaos_observation
  return !!observation && typeof observation === 'object'
    && Object.keys(observation as object).length > 0
}

// BE는 값의 의미를 모르고 형식만 검증해 그대로 보존한다. 어휘는 샌드박스 소관.
export interface ChaosOptions {
  mode: string | null
  deploymentProfile: string | null
  // 서버 ChaosOptions.isEmpty()가 Jackson에 의해 같이 직렬화돼 온다. 의존하지 말고 mode/deploymentProfile로 판단한다.
  empty?: boolean
}

export interface PatchCheck {
  accepted?: boolean
  reason_code?: string
  reason?: string
  touched_paths?: string[]
}

/** 패치가 샌드박스에 들어가기 전에 받은 내용 검사 결과.
 *
 * `metrics`는 서버가 Map을 그대로 넘기는 자리라 타입을 좁혀 두지 않았다.
 * 이 키만 화면에서 문구로 쓰므로 읽는 지점을 한 곳으로 모은다. */
export function patchCheck(
  reports: AiReports | null | undefined,
): PatchCheck | null {
  const check = reports?.metrics?.patch_check
  return check && typeof check === 'object' ? (check as PatchCheck) : null
}

export interface TaskStatus {
  taskId: string
  currentAgent: AgentStep
  isExecutable: boolean
  iterationCount: number
  errorMessage: string | null
  // 접수 시각. 칼럼 추가 이전에 저장된 옛 레코드에는 없다(null).
  createdAt: string | null
  updatedAt: string
  repositoryUrl: string | null
  branch: string | null
  commitSha: string | null
  chaosOptions: ChaosOptions
  aiReports: AiReports | null
  // 내 앞에 남은 미완료 요청 수. 대기 중일 때만 들어오고, 그 밖에는 null이다.
  // 접수 시각이 없는 옛 레코드도 순서를 알 수 없어 null이다.
  // 이 키를 모르는 옛 서버를 보고 있으면 아예 오지 않으므로 선택 항목으로 둔다.
  queuedAhead?: number | null
}

// Sandbox가 받는 값은 닫힌 집합이다(codereferee-sandbox app/main.py).
// deployment_profile을 주면 배포 경로가 있는 네 가지 중 하나여야 한다.
export const CHAOS_MODES = [
  'litmus_pod_delete',
  'litmus_container_kill',
  'deployment_scale_down',
  'service_selector_blackhole',
  'rollout_restart',
] as const
export type ChaosMode = (typeof CHAOS_MODES)[number]

export const DEPLOYING_CHAOS_MODES: readonly ChaosMode[] = [
  'litmus_pod_delete',
  'deployment_scale_down',
  'service_selector_blackhole',
  'rollout_restart',
]

export interface SubmitValidationRequest {
  repository_url: string
  branch?: string
  commit_sha?: string
  // 소문자·숫자·밑줄, 최대 64자
  chaos_mode?: string
  // 소문자·숫자·하이픈, 최대 64자
  deployment_profile?: string
  // 입력하면 검증이 끝났을 때 서버가 이 주소로 PDF 리포트를 보낸다. 비우면 보내지 않는다.
  email?: string
  // 예상 동시 사용자 수(1~500). 적으면 그 인원에서 실패할 때 Fail이 된다. 비우면 측정값만 나온다.
  target_users?: number
  // 사용자 레포를 수정하지 않고 이번 검사에만 적용하는 설정.
  validation_yaml?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    // 서버 에러 형식: { error: { code, message } }
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      body?.error?.message ?? res.statusText,
      body?.error?.code,
    )
  }
  return res.json() as Promise<T>
}

export const submitValidation = (body: SubmitValidationRequest) =>
  request<{ requestId: string }>('/api/validations/repository', {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const getValidationCapabilities = () =>
  request<{ validationYaml?: boolean; validationYamlMaxBytes?: number }>('/api/validations/capabilities')

export const getValidation = (requestId: string) =>
  request<TaskStatus>(`/api/validations/${encodeURIComponent(requestId)}`)

export const getValidationHistory = (repositoryUrl: string, commitSha: string) =>
  request<TaskStatus[]>(
    `/api/validations/history?repository_url=${encodeURIComponent(repositoryUrl)}&commit_sha=${encodeURIComponent(commitSha)}`,
  )
