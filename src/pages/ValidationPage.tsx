import { Link, useParams } from 'react-router'
import { PipelineProgress } from '@/components/PipelineProgress'
import { ReportView } from '@/components/ReportView'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, isTerminal } from '@/lib/api'
import { useValidation } from '@/lib/queries'
import { STEP_HINT } from '@/lib/steps'

export default function ValidationPage() {
  const { requestId = '' } = useParams()
  const { data, error, isPending } = useValidation(requestId)

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
              />

              <p className="text-sm text-muted-foreground">
                {STEP_HINT[data.currentAgent]}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {data.taskId} · 갱신 {new Date(data.updatedAt).toLocaleString()}
                {!isTerminal(data.currentAgent) && ' · 2초마다 갱신 중'}
              </p>
            </CardContent>
          </Card>

          {data.currentAgent === 'ERROR' && (
            <Alert className="border-amber-500/50">
              <AlertTitle>판정 불가 (인프라 오류)</AlertTitle>
              <AlertDescription>
                {data.errorMessage ??
                  '샌드박스나 파이프라인 문제로 관측할 수 없었어요. 코드 결함으로 판단하지 않았으니 다시 시도해 보세요.'}
              </AlertDescription>
            </Alert>
          )}
          {data.currentAgent === 'FAILED' && data.errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>실패 사유</AlertTitle>
              <AlertDescription>{data.errorMessage}</AlertDescription>
            </Alert>
          )}

          {data.aiReports && <ReportView reports={data.aiReports} />}
        </>
      )}
    </main>
  )
}
