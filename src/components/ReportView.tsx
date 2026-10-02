import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AiReports } from '@/lib/api'

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
  const { judge_report, critic_feedback, refiner_report, metrics, events } =
    reports

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

      {critic_feedback && (
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
