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
  judge_report?: { status: 'Pass' | 'Fail'; reason: string; evidence: string[] }
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
  }
  events?: string[]
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

export interface SubmitValidationRequest {
  repository_url: string
  branch?: string
  commit_sha?: string
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
