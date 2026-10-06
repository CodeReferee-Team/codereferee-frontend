import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AiReports, ChaosObservation } from '@/lib/api'

function EvidenceList({ items }: { items?: string[] }) {
  if (!items?.length) return null
  return (
    <ul className="mt-2 space-y-1">
      {items.map((e, i) => (
        <li
          key={i}
          className="rounded bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap"
        >
          {e}
        </li>
      ))}
    </ul>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

const RISK_LABEL = { low: '낮음', medium: '보통', high: '높음' } as const

const METRIC_LABEL: Record<string, string> = {
  availability: '가용성',
  error_rate: '오류율',
  p95_latency_ms: 'p95 지연 (ms)',
  recovery_seconds: '복구 시간 (초)',
  restart_count: '재시작 횟수',
  cpu_usage_percent: 'CPU (%)',
  memory_usage_mb: '메모리 (MB)',
  duration_ms: '실행 시간 (ms)',
  exit_code: '종료 코드',
  observation_status: '관측 상태',
  infra_error: '인프라 오류',
  probe_transport: 'probe 경로',
}

// 서버가 null 메트릭을 줄 수 있다 (로드맵 13번). 값이 없다는 것과 0은 다르게 보여준다.
const formatValue = (v: unknown) =>
  v === null || v === undefined ? '—' : String(v)

const CHAOS_TYPE_LABEL: Record<string, string> = {
  pod_kill: 'Pod 삭제',
  pod_delete: 'Pod 삭제',
  container_kill: '컨테이너 종료',
  pod_cpu_hog: 'CPU Stress',
  pod_network_latency: '네트워크 지연',
  pod_network_loss: '패킷 손실',
  scenario_suite: '시나리오 묶음 검사',
  pod_memory_hog: '메모리 압박',
  pod_memory_oom: '메모리 한도 초과',
  dependency_database_outage: 'DB 의존성 장애',
  dependency_redis_outage: 'Redis 의존성 장애',
  deployment_scale_down: '배포 스케일 다운',
  service_selector_blackhole: 'Service 라우팅 단절',
  rollout_restart: '롤아웃 재시작',
}

// 요약에 따로 보여주는 키. 나머지 스칼라는 "그 밖의 관측값"으로 이어서 보여준다.
const CHAOS_SUMMARY_KEYS = new Set([
  'type',
  'target_kind',
  'target_name',
  'namespace',
  'replicas',
  'started_at',
  'replacement_pod_created',
  'replacement_pod_name',
  'recovered',
])

function ChaosObservationCard({ observation: o }: { observation: ChaosObservation }) {
  const scenarios = Array.isArray(o.scenarios) ? o.scenarios as Record<string, unknown>[] : []
  const extra = Object.entries(o).filter(
    ([k, v]) => !CHAOS_SUMMARY_KEYS.has(k) && (v === null || typeof v !== 'object'),
  )
  const target = [o.target_kind, o.target_name].filter(Boolean).join(' / ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>카오스 관측</CardTitle>
        <CardDescription>
          샌드박스가 장애를 주입하고 복구를 관측한 사실이에요. 합격 여부는 Judge가 판단해요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {o.recovered !== undefined && (
          <Badge variant={o.recovered ? 'secondary' : 'destructive'}>
            {o.recovered ? '복구됨' : '복구되지 않음'}
          </Badge>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {o.type && (
            <Field label="실험">{CHAOS_TYPE_LABEL[o.type] ?? o.type}</Field>
          )}
          {target && <Field label="대상">{target}</Field>}
          {o.namespace && <Field label="네임스페이스">{o.namespace}</Field>}
          {o.replicas !== undefined && (
            <Field label="복제본">{formatValue(o.replicas)}</Field>
          )}
          {o.started_at && <Field label="시작">{o.started_at}</Field>}
          {o.replacement_pod_name && (
            <Field label="교체된 Pod">{o.replacement_pod_name}</Field>
          )}
          {extra.map(([k, v]) => (
            <Field key={k} label={k}>
              {formatValue(v)}
            </Field>
          ))}
        </dl>
        {scenarios.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">시나리오별 실행 결과</h3>
            {scenarios.map((scenario, index) => {
              const observation = (scenario.chaos_observation ?? {}) as Record<string, unknown>
              const metrics = (scenario.metrics ?? {}) as Record<string, unknown>
              const type = String(observation.type ?? scenario.chaosMode ?? '')
              return (
                <div key={index} className="rounded border p-3 text-sm">
                  <p className="font-medium">{index + 1}. {CHAOS_TYPE_LABEL[type] ?? type}</p>
                  <p>관측: {formatValue(scenario.observationStatus)} · 종료 코드: {formatValue(scenario.exitCode)}</p>
                  <p>가용성: {formatValue(metrics.availability)} · 오류율: {formatValue(metrics.error_rate)}</p>
                  <p>p95(ms): {formatValue(metrics.p95_latency_ms)} · 복구(초): {formatValue(observation.recovery_seconds)}</p>
                </div>
              )
            })}
            {Array.isArray(o.not_executed) && o.not_executed.length > 0 && (
              <p className="text-sm text-muted-foreground">앞선 실험 실패로 실행하지 않은 시나리오: {o.not_executed.join(', ')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ReportView({ reports }: { reports: AiReports }) {
  const { judge_report, critic_feedback, refiner_report, metrics, events } =
    reports
  // 객체 값(baseline, chaos_observation, source)은 별도 카드나 원본 JSON에서 보여준다.
  // 그대로 String()하면 "[object Object]"가 찍힌다.
  const scalarMetrics = Object.entries(metrics ?? {}).filter(
    ([, v]) => v === null || typeof v !== 'object',
  )
  const JUDGE_KEYS = ['status', 'reason', 'evidence']
  const judgeExtras = Object.entries(judge_report ?? {}).filter(
    ([k, v]) =>
      !JUDGE_KEYS.includes(k) && (v === null || typeof v !== 'object'),
  )

  return (
    <div className="space-y-4">
      {judge_report && (
        <Card>
          <CardHeader>
            <CardTitle>Judge 판정</CardTitle>
            <CardDescription>
              실행 결과와 메트릭을 근거로 한 합격 여부
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {judge_report.status && (
              <Badge
                variant={judge_report.status === 'Pass' ? 'secondary' : 'destructive'}
              >
                {judge_report.status}
              </Badge>
            )}
            {judge_report.reason && (
              <p className="text-sm">{judge_report.reason}</p>
            )}
            <EvidenceList items={judge_report.evidence} />
            {/* 스키마(status/reason/evidence)에 없는 값은 버리지 않고 그대로 보여준다. */}
            {judgeExtras.length > 0 && (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {judgeExtras.map(([k, v]) => (
                  <Field key={k} label={k}>
                    <span className="font-mono">{formatValue(v)}</span>
                  </Field>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {critic_feedback && (
        <Card>
          <CardHeader>
            <CardTitle>Critic 분석</CardTitle>
            <CardDescription>실패 원인과 신뢰성 공백</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {critic_feedback.issue && (
                <Field label="문제">{critic_feedback.issue}</Field>
              )}
              {critic_feedback.root_cause && (
                <Field label="근본 원인">{critic_feedback.root_cause}</Field>
              )}
              {critic_feedback.recommended_action && (
                <Field label="권장 조치">{critic_feedback.recommended_action}</Field>
              )}
            </dl>
            <EvidenceList items={critic_feedback.evidence} />
          </CardContent>
        </Card>
      )}

      {refiner_report && (
        <Card>
          <CardHeader>
            <CardTitle>Refiner 개선안</CardTitle>
            <CardDescription>{refiner_report.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">
                수정 가이드
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {refiner_report.patch_guidance?.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">
                재검증 절차
              </h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                {refiner_report.verification_steps?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
            <div className="text-sm">
              위험도:{' '}
              <Badge variant="outline">
                {RISK_LABEL[refiner_report.risk] ?? refiner_report.risk}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {metrics?.chaos_observation && (
        <ChaosObservationCard observation={metrics.chaos_observation} />
      )}

      {scalarMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>메트릭</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {scalarMetrics.map(([k, v]) => (
                <Field key={k} label={METRIC_LABEL[k] ?? k}>
                  <span className="font-mono">{formatValue(v)}</span>
                </Field>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {events && events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>이벤트 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 font-mono text-xs">
              {events.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          원본 JSON 보기
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(reports, null, 2)}
        </pre>
      </details>
    </div>
  )
}
