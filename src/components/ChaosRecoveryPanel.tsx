import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AiReports } from '@/lib/api'
import { cn } from '@/lib/utils'

// 서버는 probe별 시계열이 아니라 집계값만 내려준다(availability, recovery_seconds,
// started/recovered_at). 그래서 이 패널은 "진짜 측정 곡선"이 아니라 집계로 그린
// 복구 스키매틱이다. 실제 요청 단위 곡선은 서버가 raw probe를 패스스루하면 올린다.

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

function chaosObservation(reports: AiReports): Record<string, unknown> | null {
  const m = reports.metrics as Record<string, unknown> | undefined
  const e = reports.execution_result as Record<string, unknown> | undefined
  const co = (m?.chaos_observation ?? e?.chaos_observation) as
    | Record<string, unknown>
    | undefined
  return co && typeof co === 'object' ? co : null
}

const FAULT_LABEL: Record<string, string> = {
  pod_kill: 'Pod 종료',
  pod_delete: 'Pod 삭제',
  container_kill: '컨테이너 종료',
  rollout_restart: '롤링 재시작',
  deployment_scale_down: '레플리카 축소',
  service_selector_blackhole: '라우팅 차단',
  scenario_suite: '시나리오 묶음',
}

export function ChaosRecoveryPanel({ reports }: { reports: AiReports }) {
  const co = chaosObservation(reports)
  const metrics = (reports.metrics ?? {}) as Record<string, unknown>
  if (!co) return null

  const recovered = co.recovered === true
  const recoverySeconds = num(co.recovery_seconds)
  const windowSeconds =
    num(co.experiment_duration_seconds) ??
    (recoverySeconds != null ? recoverySeconds + 10 : null)
  const availability = num(metrics.availability)
  const errorRate = num(metrics.error_rate)
  const p95 = num(metrics.p95_latency_ms)
  const fail = num(metrics.failure_count)
  const total = num(metrics.probe_count)
  const restarts = num(metrics.restart_count)
  const faultType = String(co.kill_method ?? co.type ?? 'chaos')
  const faultLabel = FAULT_LABEL[faultType] ?? faultType

  const availPct = availability != null ? availability * 100 : null
  // 가동률 색: 99%+ 무중단 녹색, 90%+ 양호, 그 아래 경고.
  const availTone =
    availPct == null
      ? 'text-muted-foreground'
      : availPct >= 99
        ? 'text-emerald-600 dark:text-emerald-400'
        : availPct >= 90
          ? 'text-foreground'
          : 'text-amber-600 dark:text-amber-400'

  // 복구 스트립: 전체 창 중 복구 구간이 차지하는 비율. 창을 모르면 복구만 작게 표시.
  const dipPct =
    windowSeconds && recoverySeconds != null && windowSeconds > 0
      ? Math.min(100, Math.max(2, (recoverySeconds / windowSeconds) * 100))
      : recoverySeconds === 0
        ? 0
        : 8
  // 장애 주입 지점은 baseline 뒤. 시각적으로 창의 앞 ~20%를 baseline으로 둔다.
  const injectAt = 20
  const dipWidth = Math.min(100 - injectAt, dipPct)

  return (
    <Card>
      <CardHeader>
        <CardTitle>카오스 복구</CardTitle>
        <CardDescription>
          장애를 주입하고 서비스가 회복하는 과정을 관측한 결과예요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 헤드라인: 가동률 + 복구 + 장애 종류 */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className={cn('text-3xl font-semibold tabular-nums', availTone)}>
              {availPct != null ? `${availPct.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">장애 중 가동률</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">
              {recoverySeconds != null ? `${recoverySeconds.toFixed(1)}s` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">복구 시간</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-sm font-medium">{faultLabel}</div>
            <div
              className={cn(
                'text-xs',
                recovered
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {recovered ? '복구 완료' : '복구 미확인'}
            </div>
          </div>
        </div>

        {/* 복구 타임라인 스트립 */}
        <div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-emerald-500/20">
            {/* 장애·복구 구간 */}
            <div
              className="absolute inset-y-0 bg-amber-500/70"
              style={{ left: `${injectAt}%`, width: `${dipWidth}%` }}
            />
            {/* 장애 주입 지점 표시 */}
            <div
              className="absolute inset-y-0 w-0.5 bg-amber-600"
              style={{ left: `${injectAt}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>정상</span>
            <span className="text-amber-600 dark:text-amber-400">
              ← 장애 주입 · 복구 {recoverySeconds != null ? `${recoverySeconds.toFixed(1)}s` : ''} →
            </span>
            <span>회복</span>
          </div>
        </div>

        {/* 보조 지표 */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="실패 요청" value={fail != null && total != null ? `${fail}/${total}` : '—'} />
          <Stat label="오류율" value={errorRate != null ? `${(errorRate * 100).toFixed(1)}%` : '—'} />
          <Stat label="p95 지연" value={p95 != null ? `${p95.toFixed(0)}ms` : '—'} />
          <Stat label="재시작" value={restarts != null ? String(restarts) : '—'} />
        </dl>

        <p className="text-[11px] text-muted-foreground">
          집계 지표로 그린 복구 스키매틱이에요. 요청 단위 실측 곡선은 준비 중이에요.
        </p>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
