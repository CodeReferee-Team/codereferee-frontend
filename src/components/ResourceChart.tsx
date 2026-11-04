import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AiReports } from '@/lib/api'
import {
  extractTimeseries,
  nearestPoint,
  peakOf,
  thin,
  type FaultWindow,
  type ResourceSeries,
} from '@/lib/timeseries'

// 장애를 주입하는 동안 앱의 CPU와 메모리가 어떻게 움직였는지 그린다.
// 데이터는 샌드박스가 1초 간격으로 조회한 값이고, 차트 라이브러리 없이 SVG로 직접 그린다.

const PANEL_H = 118
const GAP = 14
const PAD = { l: 46, r: 12, t: 26, b: 4 }
const AXIS_H = 22
const DASHES = ['', '5 3', '1.5 2.5']

// 샌드박스 시나리오 이름(container_kill 등)을 사람이 읽는 말로. 모르면 원문 그대로 쓴다.
const SCENARIO_LABEL: Record<string, string> = {
  container_kill: 'Container Kill',
  pod_delete: 'Pod 삭제',
  pod_kill: 'Pod 삭제',
  pod_cpu_hog: 'CPU Stress',
  pod_network_latency: '네트워크 지연',
  pod_network_loss: '패킷 손실',
  pod_memory_hog: '메모리 압박',
  pod_memory_oom: '메모리 한도 초과',
  deployment_scale_down: '배포 스케일 다운',
  service_selector_blackhole: 'Service 라우팅 단절',
  rollout_restart: '롤아웃 재시작',
  dependency_database_outage: 'DB 의존성 장애',
  dependency_redis_outage: 'Redis 의존성 장애',
}
const scenarioLabel = (s: string) => SCENARIO_LABEL[s] ?? SCENARIO_LABEL[s.replace(/^litmus_/, '')] ?? (s || '장애 구간')

const fmtCpu = (v: number) => `${v >= 1 ? v.toFixed(2) : v.toFixed(3)}코어`
const fmtMem = (v: number) => `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}MB`
// 축 눈금은 단위를 제목에 두고 숫자만 쓴다
// 눈금끼리 같은 숫자로 보이지 않도록 자릿수는 축의 최댓값에 맞춘다
const tickCpu = (v: number, max: number) => v.toFixed(max >= 1 ? 1 : max >= 0.1 ? 2 : max >= 0.01 ? 3 : 4)
const tickMem = (v: number, max: number) => (v / 1e6).toFixed(max >= 1e7 ? 0 : 1)
const shortPod = (label: string) => label.split('-').slice(-2).join('-')

function fmtRel(sec: number) {
  const s = Math.round(sec)
  if (s < 120) return `+${s}초`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `+${m}분` : `+${m}분${r}초`
}

// 눈금이 보기 좋은 값(1, 2, 5의 배수)으로 떨어지는 최댓값
function niceMax(v: number) {
  if (!(v > 0)) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

function niceStep(span: number) {
  const steps = [5, 10, 15, 30, 60, 120, 300, 600, 1200]
  return steps.find((s) => span / s <= 6) ?? 1800
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

interface PanelProps {
  title: string
  series: ResourceSeries[]
  limit: number | null
  fmt: (v: number) => string
  tick: (v: number, max: number) => string
  dashOf: (label: string) => string
  lineClass: string
  dotClass: string
  windows: FaultWindow[]
  width: number
  tMin: number
  tMax: number
  top: number
  hoverT: number | null
}

function Panel({ title, series, limit, fmt, tick, dashOf, lineClass, dotClass, windows, width, tMin, tMax, top, hoverT }: PanelProps) {
  const innerW = width - PAD.l - PAD.r
  const innerH = PANEL_H - PAD.t - PAD.b
  const x = (t: number) => PAD.l + ((t - tMin) / Math.max(tMax - tMin, 1e-9)) * innerW

  const dataMax = peakOf(series) ?? 0
  // 한도가 사용량의 2배 안에 있을 때만 축에 넣는다. 한도가 훨씬 멀면 곡선이 바닥에 눌려 안 보인다.
  const showLimit = limit !== null && limit > 0 && limit <= dataMax * 2
  const yMax = niceMax(Math.max(dataMax * 1.1, showLimit ? (limit as number) * 1.05 : 0))
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH

  return (
    <g transform={`translate(0 ${top})`}>
      <text x={PAD.l} y={14} className="fill-muted-foreground text-[11px]">
        {title}
      </text>

      {/* 장애 구간 음영. 장애를 건 구간은 진하게, 거둔 뒤 복구까지는 연하게 */}
      {windows.map((w, i) => {
        const activeEnd = w.revertedAt ?? w.recoveredAt ?? tMax
        const x1 = x(Math.max(w.start, tMin))
        const x2 = x(Math.min(activeEnd, tMax))
        const tailEnd = w.revertedAt !== null && w.recoveredAt !== null ? Math.min(w.recoveredAt, tMax) : null
        return (
          <g key={i}>
            <rect x={x1} y={PAD.t} width={Math.max(x2 - x1, 2)} height={innerH} className="fill-red-500/12" />
            {tailEnd !== null && tailEnd > activeEnd && (
              <rect x={x2} y={PAD.t} width={Math.max(x(tailEnd) - x2, 0)} height={innerH} className="fill-red-500/5" />
            )}
          </g>
        )
      })}

      {/* y축 눈금 */}
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} className="stroke-border" strokeWidth={1} />
          <text x={PAD.l - 6} y={y(yMax * f)} textAnchor="end" dy="0.32em" className="fill-muted-foreground text-[10px]">
            {tick(yMax * f, yMax)}
          </text>
        </g>
      ))}

      {showLimit && (
        <g>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(limit as number)} y2={y(limit as number)}
            className="stroke-destructive" strokeWidth={1} strokeDasharray="4 3" />
          <text x={width - PAD.r - 2} y={y(limit as number) - 3} textAnchor="end" className="fill-destructive text-[10px]">
            한도 {fmt(limit as number)}
          </text>
        </g>
      )}

      {series.map((s) => {
        const pts = thin(s.points)
        const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
        return pts.length === 1 ? (
          <circle key={s.id} cx={x(pts[0].t)} cy={y(pts[0].v)} r={2} className={dotClass} />
        ) : (
          <path key={s.id} d={d} fill="none" strokeWidth={1.6} strokeLinejoin="round"
            strokeDasharray={dashOf(s.label)} className={lineClass} />
        )
      })}

      {hoverT !== null && (
        <line x1={x(hoverT)} x2={x(hoverT)} y1={PAD.t} y2={PAD.t + innerH} className="stroke-foreground/40" strokeWidth={1} />
      )}
    </g>
  )
}

export function ResourceChart({ reports }: { reports: AiReports }) {
  const ts = useMemo(() => extractTimeseries(reports), [reports])
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hoverT, setHoverT] = useState<number | null>(null)
  if (!ts) return null

  const panels = [
    ts.cpu.length > 0 && { key: 'cpu', title: 'CPU 사용량 (코어)', series: ts.cpu, limit: ts.limits.cpuCores, fmt: fmtCpu, tick: tickCpu, lineClass: 'stroke-primary', dotClass: 'fill-primary' },
    ts.memory.length > 0 && { key: 'mem', title: '메모리 사용량 (MB, working set)', series: ts.memory, limit: ts.limits.memoryBytes, fmt: fmtMem, tick: tickMem, lineClass: 'stroke-teal-600 dark:stroke-teal-400', dotClass: 'fill-teal-600 dark:fill-teal-400' },
  ].filter((p) => !!p)

  // 같은 파드는 두 그래프에서 같은 선 모양으로 그린다. 순서가 달라도 어긋나지 않게 이름으로 정한다.
  // 파드가 처음 나타난 시각 순으로 정렬해서, 범례가 교체 순서(이전 파드, 새 파드)대로 보이게 한다.
  const podOrder = [...new Set(
    [...ts.cpu, ...ts.memory].sort((a, b) => a.points[0].t - b.points[0].t).map((s) => s.label),
  )]
  const dashOf = (label: string) => DASHES[podOrder.indexOf(label) % DASHES.length]

  const span = ts.tMax - ts.tMin
  const plotH = panels.length * PANEL_H + (panels.length - 1) * GAP
  const totalH = plotH + AXIS_H
  const innerW = width - PAD.l - PAD.r
  const xOf = (t: number) => PAD.l + ((t - ts.tMin) / Math.max(span, 1e-9)) * innerW

  const step = niceStep(span)
  const ticks: number[] = []
  for (let s = 0; s <= span; s += step) ticks.push(s)

  const faultFrom = ts.windows.length ? Math.min(...ts.windows.map((w) => w.start)) : null
  const faultTo = ts.windows.length
    ? Math.max(...ts.windows.map((w) => w.recoveredAt ?? w.revertedAt ?? ts.tMax))
    : null
  const peak = (series: ResourceSeries[], from?: number, to?: number) => peakOf(series, from, to)
  const cpuAll = peak(ts.cpu)
  const memAll = peak(ts.memory)
  const cpuFault = faultFrom !== null ? peak(ts.cpu, faultFrom, faultTo ?? ts.tMax) : null
  const memFault = faultFrom !== null ? peak(ts.memory, faultFrom, faultTo ?? ts.tMax) : null

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    if (px < PAD.l || px > width - PAD.r) return setHoverT(null)
    setHoverT(ts.tMin + ((px - PAD.l) / innerW) * span)
  }

  const readout = hoverT === null ? null : (
    <p className="min-h-5 whitespace-pre font-mono text-xs text-muted-foreground">
      {fmtRel(hoverT - ts.tMin)}
      {[...ts.cpu.map((s) => ({ s, name: 'CPU', fmt: fmtCpu })), ...ts.memory.map((s) => ({ s, name: '메모리', fmt: fmtMem }))]
        .map(({ s, name, fmt }) => {
          const p = nearestPoint(s.points, hoverT)
          return p ? `  ${name}${ts.cpu.length + ts.memory.length > 2 ? ` ${shortPod(s.label)}` : ''} ${fmt(p.v)}` : null
        })
        .filter(Boolean)
        .join('')}
    </p>
  )

  const summary = [
    cpuAll !== null && `전체 최대 CPU ${fmtCpu(cpuAll)}`,
    memAll !== null && `메모리 ${fmtMem(memAll)}`,
    cpuFault !== null && `장애 구간 최대 CPU ${fmtCpu(cpuFault)}`,
    memFault !== null && `메모리 ${fmtMem(memFault)}`,
  ].filter(Boolean).join(', ')

  const multi = podOrder.length > 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>자원 사용 추이</CardTitle>
        <CardDescription>
          샌드박스가 1초 간격으로 조회한 값이에요. 붉은 음영이 장애를 주입한 구간입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{summary}</p>

        <div ref={ref} className="w-full">
          <svg
            width={width}
            height={totalH}
            role="img"
            aria-label={`자원 사용 추이. ${summary}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHoverT(null)}
            className="touch-pan-y select-none"
          >
            {panels.map((p, i) => (
              <Panel
                key={p.key}
                title={p.title}
                series={p.series}
                limit={p.limit}
                fmt={p.fmt}
                tick={p.tick}
                dashOf={dashOf}
                lineClass={p.lineClass}
                dotClass={p.dotClass}
                windows={ts.windows}
                width={width}
                tMin={ts.tMin}
                tMax={ts.tMax}
                top={i * (PANEL_H + GAP)}
                hoverT={hoverT}
              />
            ))}

            {/* 시나리오 이름: 장애 구간 위쪽에 붙인다. 구간이 너무 좁으면 생략 */}
            {ts.windows.map((w, i) => {
              const x1 = xOf(Math.max(w.start, ts.tMin))
              const x2 = xOf(Math.min(w.recoveredAt ?? w.revertedAt ?? ts.tMax, ts.tMax))
              return x2 - x1 > 56 ? (
                <text key={i} x={x1 + 4} y={PAD.t + 11} className="fill-red-600 text-[10px] dark:fill-red-400">
                  {scenarioLabel(w.label)}
                </text>
              ) : null
            })}

            {/* 시간 축: 첫 점 기준 경과 시간 */}
            <g transform={`translate(0 ${plotH})`}>
              {ticks.map((s) => (
                <text key={s} x={xOf(ts.tMin + s)} y={AXIS_H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {fmtRel(s)}
                </text>
              ))}
            </g>
          </svg>
        </div>

        {readout ?? <p className="min-h-5 text-xs text-muted-foreground">그래프 위에 마우스를 올리면 그 시각의 값을 볼 수 있어요.</p>}

        {multi && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {podOrder.map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden>
                  <line x1="0" x2="22" y1="3" y2="3" strokeWidth="1.6" strokeDasharray={dashOf(label)} className="stroke-foreground" />
                </svg>
                <span className="font-mono" title={label}>{shortPod(label)}</span>
              </li>
            ))}
            <li>컨테이너가 죽으면 새 파드가 이어서 나타나요.</li>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
