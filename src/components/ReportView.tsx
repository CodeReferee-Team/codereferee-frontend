import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  patchCheck,
  policyWarnings,
  type AiReports,
  type ChaosObservation,
} from '@/lib/api'
import { POLICY_WARNING_LABEL } from '@/lib/reasons'

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
      </CardContent>
    </Card>
  )
}

export function ReportView({ reports }: { reports: AiReports }) {
  const {
    judge_report,
    critic_feedback,
    refiner_report,
    refine_rounds,
    metrics,
    events,
  } = reports
  const patch = patchCheck(reports)
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
  // 경고는 판정을 뒤집지 않지만 사용자가 알아야 한다. 특히 단일 replica 경고는
  // "통과"의 의미를 좁힌다. 1대짜리 앱은 그 1대가 멈추면 끊긴다.
  const warnings = policyWarnings(reports)

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>판정 경고</CardTitle>
            <CardDescription>
              합격 여부를 바꾸지는 않지만 알아 두어야 할 내용이에요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li key={w} className="text-sm">
                  {POLICY_WARNING_LABEL[w] ?? w}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {w}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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
            {patch && (
              <dl>
                {/* 패치가 샌드박스까지 가지 못한 경우 그 이유가 여기만 남는다. */}
                <Field label="패치 검사">
                  {patch.accepted
                    ? '적용 가능'
                    : `반려 (${patch.reason_code ?? '사유 없음'})`}
                  {patch.reason && (
                    <span className="text-muted-foreground"> · {patch.reason}</span>
                  )}
                </Field>
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {refine_rounds && refine_rounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>재검증 라운드</CardTitle>
            <CardDescription>
              Refiner 패치를 샌드박스에 적용해 다시 돌린 기록. 제출된 커밋의 판정은
              바뀌지 않는다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {refine_rounds.map((r) => (
                <li key={r.round} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{r.round}라운드</p>
                  <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="패치 크기">
                      <span className="font-mono">{r.patch_bytes}B</span>
                    </Field>
                    {/* null은 그 라운드가 판정까지 가지 못한 것이다. Pass도 Fail도 아니다. */}
                    <Field label="판정">
                      <span className="font-mono">
                        {r.before_judge_status ?? '—'} →{' '}
                        {r.after_judge_status ?? '—'}
                      </span>
                    </Field>
                    <Field label="종료 코드">
                      <span className="font-mono">
                        {r.sandbox_exit_code ?? '—'}
                      </span>
                    </Field>
                    <Field label="실패 단계">
                      <span className="font-mono">{r.failed_step ?? '—'}</span>
                    </Field>
                  </dl>
                </li>
              ))}
            </ul>
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
