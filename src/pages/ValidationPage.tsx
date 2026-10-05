import { Link, useParams } from 'react-router'
import { PipelineProgress } from '@/components/PipelineProgress'
import { ReportView } from '@/components/ReportView'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, chaosObserved, infraError, isTerminal } from '@/lib/api'
import { modeLabel } from '@/lib/chaos'
import {
  describeError,
  elapsedMs,
  failureReason,
  formatDuration,
  parseServerTime,
} from '@/lib/format'
import { useValidation } from '@/lib/queries'
import { REASON_LABEL } from '@/lib/reasons'
import { CHAOS_SKIPPED_HINT, STEP_HINT } from '@/lib/steps'

export default function ValidationPage() {
  const { requestId = '' } = useParams()
  const { data, error, isPending } = useValidation(requestId)
  const chaosRan = chaosObserved(data?.aiReports)
  const failure = data ? failureReason(data.errorMessage) : null
  // 종결된 요청만 소요 시간을 보여준다. 옛 레코드는 createdAt이 없어 표시하지 않는다.
  const elapsed =
    data && isTerminal(data.currentAgent)
      ? (() => {
          const ms = elapsedMs(data.createdAt, data.updatedAt)
          return ms === null ? null : formatDuration(ms)
        })()
      : null
  // 사유 코드가 있으면 단계 문구보다 정확하다. 모르는 코드는 단계 문구로 돌아간다.
  const reasonCategory = data?.aiReports?.judge_report?.reason_category
  // ERROR면 Judge를 건너뛰어 judge_report가 비어 있다. 사유는 infra_error에만 있다.
  const infra = infraError(data?.aiReports)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Button variant="ghost" size="sm" render={<Link to="/" />}>
        ← 새 검증
      </Button>

      {isPending && <Skeleton className="h-40 w-full" />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>
            {error instanceof ApiError && error.status === 404
              ? '존재하지 않는 검증 요청이에요'
              : '상태를 불러오지 못했어요'}
          </AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {data.repositoryUrl ?? '(레포 정보 없음)'}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {data.branch ?? 'default'}
                    {data.commitSha && ` @ ${data.commitSha.slice(0, 8)}`}
                  </p>
                </div>
                <StatusBadge step={data.currentAgent} />
              </div>

              <PipelineProgress
                current={data.currentAgent}
                iterationCount={data.iterationCount}
                chaosObserved={chaosRan}
              />

              <p className="text-sm text-muted-foreground">
                {(reasonCategory && REASON_LABEL[reasonCategory]) ||
                  (infra && REASON_LABEL[infra]) ||
                  STEP_HINT[data.currentAgent]}
              </p>
              {isTerminal(data.currentAgent) && !chaosRan && (
                <p className="text-sm text-muted-foreground">
                  {CHAOS_SKIPPED_HINT}
                </p>
              )}
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt>카오스</dt>
                  <dd className="text-foreground">
                    {modeLabel(data.chaosOptions?.mode)}
                    {data.chaosOptions?.deploymentProfile && (
                      <span className="ml-1 font-mono text-muted-foreground">
                        ({data.chaosOptions.deploymentProfile})
                      </span>
                    )}
                  </dd>
                </div>
                {elapsed && (
                  <div className="flex gap-1.5">
                    <dt>소요 시간</dt>
                    <dd className="text-foreground">{elapsed}</dd>
                  </div>
                )}
              </dl>
              <p className="font-mono text-xs text-muted-foreground">
                {data.taskId} · 갱신 {parseServerTime(data.updatedAt).toLocaleString()}
                {!isTerminal(data.currentAgent) && ' · 2초마다 갱신 중'}
              </p>
            </CardContent>
          </Card>

          {data.currentAgent === 'ERROR' && (
            <Alert className="border-amber-500/50">
              <AlertTitle>판정 불가 (인프라 오류)</AlertTitle>
              <AlertDescription>
                {describeError(
                  data.errorMessage,
                  data.aiReports?.metrics?.infra_error,
                )}
              </AlertDescription>
            </Alert>
          )}
          {data.currentAgent === 'FAILED' && failure && (
            <Alert variant="destructive">
              <AlertTitle>실패 사유</AlertTitle>
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          )}

          {data.aiReports && <ReportView reports={data.aiReports} />}
        </>
      )}
    </main>
  )
}
