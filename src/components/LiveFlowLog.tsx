import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { isTerminal, type AgentStep } from '@/lib/api'
import { STEP_HINT, STEP_LABEL } from '@/lib/steps'

interface Entry {
  time: string
  label: string
  hint: string
  tone: 'run' | 'pass' | 'fail'
}

// 서버는 처리 중 상세 이벤트(aiReports.events)를 안 내려준다 — 끝나야 채워진다. 하지만
// currentAgent는 2초마다 갱신되므로, 그 단계 전이를 실시간 로그 라인으로 합성한다. 파이프라인이
// 흐르는 걸 "로그가 한 줄씩 쌓이는" 형태로 보여줘, 작동 중임이 직관적으로 드러난다.
// 상세 이벤트 전체는 종료 후 ReportView의 이벤트 로그가 그대로 보여준다.
export function LiveFlowLog({
  current,
  iterationCount,
}: {
  current: AgentStep
  iterationCount: number
}) {
  const [log, setLog] = useState<Entry[]>([])
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    const key =
      current === 'REFINING' ? `REFINING#${iterationCount}` : current
    if (seen.current.has(key)) return
    seen.current.add(key)
    const tone: Entry['tone'] =
      current === 'PASSED' ? 'pass' : current === 'FAILED' || current === 'ERROR' ? 'fail' : 'run'
    const label =
      current === 'REFINING' && iterationCount > 0
        ? `${STEP_LABEL.REFINING} · 라운드 ${iterationCount}`
        : STEP_LABEL[current]
    setLog((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString('ko-KR', { hour12: false }), label, hint: STEP_HINT[current], tone },
    ])
  }, [current, iterationCount])

  if (!log.length) return null
  const running = !isTerminal(current)

  return (
    <div className="gs-flowlog">
      <div className="gs-flowlog-head">실행 로그 · live</div>
      <ol className="gs-log">
        {log.map((e, i) => (
          <li
            key={i}
            style={{ ['--i' as string]: i } as CSSProperties}
            className={`gs-flowlog-line gs-flowlog-${e.tone}`}
          >
            <span className="gs-flowlog-time">{e.time}</span>
            <span className="gs-flowlog-arrow">›</span>
            <span className="gs-flowlog-label">{e.label}</span>
            <span className="gs-flowlog-hint">{e.hint}</span>
          </li>
        ))}
      </ol>
      {running && (
        <div className="gs-flowlog-run">
          <span className="gs-caret">▋</span> 진행 중…
        </div>
      )}
    </div>
  )
}
