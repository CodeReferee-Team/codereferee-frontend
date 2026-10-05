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

// aiReports 내부 구조는 AI 모듈 출력 스키마(agent-output-schema.md)를 따르며 서버는 Map으로 그대로 전달한다.
// 실패 경로에서는 일부 키가 없을 수 있으므로 전부 optional로 둔다.
export interface AiReports {
  preflight_report?: Record<string, unknown>
  execution_result?: Record<string, unknown>
  validation_plan?: Record<string, unknown>
  metrics?: Record<string, unknown>
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
export function chaosObserved(reports: AiReports | null | undefined): boolean {
  const observation = reports?.execution_result?.chaos_observation
  return !!observation && typeof observation === 'object'
    && Object.keys(observation as object).length > 0
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
  updatedAt: string
  repositoryUrl: string | null
  branch: string | null
  commitSha: string | null
  aiReports: AiReports | null
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
  // 선택이다. 없으면 빌드와 테스트만 검증하고 장애는 주입하지 않는다.
  chaos_mode?: ChaosMode
  deployment_profile?: string
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

export const getValidation = (requestId: string) =>
  request<TaskStatus>(`/api/validations/${encodeURIComponent(requestId)}`)

export const getValidationHistory = (repositoryUrl: string, commitSha: string) =>
  request<TaskStatus[]>(
    `/api/validations/history?repository_url=${encodeURIComponent(repositoryUrl)}&commit_sha=${encodeURIComponent(commitSha)}`,
  )
