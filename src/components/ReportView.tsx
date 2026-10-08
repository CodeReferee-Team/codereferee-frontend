import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChaosRecoveryPanel } from '@/components/ChaosRecoveryPanel'
import { patchCheck, policyWarnings, type AiReports } from '@/lib/api'
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
  // 경고는 판정을 뒤집지 않지만 사용자가 알아야 한다. 특히 단일 replica 경고는
  // "통과"의 의미를 좁힌다. 1대짜리 앱은 그 1대가 멈추면 끊긴다.
  const warnings = policyWarnings(reports)
  // 통과면 Critic/Refiner/패치검사는 숨긴다. 이들은 실패 원인 분석·개선안이라
  // 합격한 검증에 붙으면 "통과 + 당신 코드 고쳐라"라는 모순된 화면이 된다.
  const isPass = judge_report?.status === 'Pass'

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
          <CardContent>
            <Badge
              variant={judge_report.status === 'Pass' ? 'secondary' : 'destructive'}
            >
              {judge_report.status}
            </Badge>
            <p className="mt-3 text-sm">{judge_report.reason}</p>
            <EvidenceList items={judge_report.evidence} />
          </CardContent>
        </Card>
      )}

      <ChaosRecoveryPanel reports={reports} />

      {!isPass && critic_feedback && (
        <Card>
          <CardHeader>
            <CardTitle>Critic 분석</CardTitle>
            <CardDescription>실패 원인과 신뢰성 공백</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Field label="문제">{critic_feedback.issue}</Field>
              <Field label="근본 원인">{critic_feedback.root_cause}</Field>
              <Field label="권장 조치">{critic_feedback.recommended_action}</Field>
            </dl>
            <EvidenceList items={critic_feedback.evidence} />
          </CardContent>
        </Card>
      )}

      {!isPass && refiner_report && (
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

      {metrics && Object.keys(metrics).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>메트릭</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(metrics).map(([k, v]) => (
                <Field key={k} label={k}>
                  {/* 서버가 null 메트릭을 줄 수 있다 (로드맵 13번) */}
                  <span className="font-mono">
                    {v === null || v === undefined ? '—' : String(v)}
                  </span>
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
