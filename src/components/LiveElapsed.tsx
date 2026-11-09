import { useEffect, useState } from 'react'
import { formatDuration, liveElapsedMs, nextAnchor, nonDecreasing, type ElapsedAnchor } from '@/lib/format'

interface Props {
  createdAt: string | null
  updatedAt: string
  terminal: boolean
  queued: boolean
}

// 경과 시간 한 칸. 진행 중에는 1초마다 올라가고, 끝나면 소요 시간으로 고정된다.
// 이 칸만 다시 그리므로 상세 화면 전체가 1초마다 렌더되지 않는다.
export function LiveElapsed({ createdAt, updatedAt, terminal, queued }: Props) {
  const [now, setNow] = useState(() => performance.now())
  // 마지막으로 보여준 값. 틱 때마다 앞으로만 간다.
  const [shown, setShown] = useState(0)
  const [anchor, setAnchor] = useState<ElapsedAnchor | null>(() =>
    nextAnchor(null, createdAt, updatedAt, performance.now()),
  )

  // 새 갱신이 오면 기준을 다시 잡는다. 같은 갱신이면 nextAnchor가 이전 값을 그대로 돌려줘서
  // 아무 일도 일어나지 않는다. effect가 아니라 렌더 중에 바로 맞추면 한 번 덜 그린다.
  // 기준 시각은 1초 단위로 갱신되는 now를 쓴다. 최대 1초 정도 더 세지만 렌더 중에 시계를 부르지 않는다.
  const next = nextAnchor(anchor, createdAt, updatedAt, now)
  if (next !== anchor) setAnchor(next)

  useEffect(() => {
    if (terminal) return
    const id = setInterval(() => {
      const t = performance.now()
      setNow(t)
      setShown((prev) => nonDecreasing(prev, anchor ? liveElapsedMs(anchor, t) : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [terminal, anchor])

  if (!anchor) return null // 옛 레코드는 접수 시각이 없어 알 수 없다
  const text = formatDuration(terminal ? anchor.baseMs : nonDecreasing(shown, liveElapsedMs(anchor, now)))
  if (!text) return null

  return (
    <div className="flex gap-1.5">
      <dt>{terminal ? '소요 시간' : '경과 시간'}</dt>
      <dd className="text-foreground tabular-nums">
        {text}
        {!terminal && queued && (
          <span className="ml-1 text-muted-foreground">(대기열에서 기다린 시간 포함)</span>
        )}
      </dd>
    </div>
  )
}
