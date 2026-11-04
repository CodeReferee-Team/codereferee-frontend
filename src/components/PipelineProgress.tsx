import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, Minus, RotateCw } from 'lucide-react'
import { applyReveal, buildStepper, settledCount } from '@/lib/stepper'
import { cn } from '@/lib/utils'

interface Props {
  current: string
  iterationCount: number
  /** 요청에 장애 주입 옵션이 있었는가. 있으면 기준 실행과 카오스를 한 칸으로 묶는다. */
  chaosRequested: boolean
  /** 장애 주입을 실제로 관측했는가. 카오스는 선택 단계라 안 돌린 검증이 정상 경로로 존재한다. */
  chaosObserved: boolean
}

// 한꺼번에 온 완료 단계를 이 간격으로 하나씩 채운다.
const REVEAL_MS = 260

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function PipelineProgress({ current, iterationCount, chaosRequested, chaosObserved }: Props) {
  const nodes = useMemo(
    () => buildStepper({ current, iterationCount, chaosRequested, chaosObserved }),
    [current, iterationCount, chaosRequested, chaosObserved],
  )
  const settled = settledCount(nodes)

  // 샌드박스가 한 번에 끝나서 3단계에서 6단계로 건너뛰어도 순간이동처럼 보이지 않게,
  // 이미 끝난 단계만 차례로 채운다. 화면을 처음 열었을 때(이미 끝난 요청)는 바로 보여준다.
  const [revealed, setRevealed] = useState(settled)
  const reduced = prefersReducedMotion()
  const shown = reduced ? settled : Math.min(revealed, settled)

  useEffect(() => {
    if (reduced || revealed >= settled) return
    const t = setTimeout(() => setRevealed((r) => Math.min(r + 1, settled)), REVEAL_MS)
    return () => clearTimeout(t)
  }, [revealed, settled, reduced])

  const view = applyReveal(nodes, shown)

  return (
    <ol className="flex items-start overflow-x-auto pb-1">
      {view.map(({ key, label, sub, state }, i) => {
        const done = state === 'done'
        const active = state === 'active'
        const skipped = state === 'skipped'
        return (
          <Fragment key={key}>
            {i > 0 && (
              // 앞 칸이 완료면 연결선을 채운다 = 데이터가 거기까지 흘렀다는 표시.
              <div
                className={cn(
                  'mt-2.5 h-px min-w-5 flex-1 transition-colors duration-300',
                  view[i - 1].state === 'done' ? 'bg-emerald-500' : 'bg-border',
                )}
              />
            )}
            <li
              className={cn(
                'flex shrink-0 flex-col items-center gap-1.5 text-sm',
                done || active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'relative flex size-5 items-center justify-center rounded-full border text-[11px]',
                  done && 'border-emerald-500 bg-emerald-500 text-white',
                  active && 'border-primary/25',
                  skipped && 'border-dashed',
                )}
              >
                {skipped ? (
                  <Minus className="size-3" />
                ) : done ? (
                  <Check className="size-3 animate-in zoom-in-50 duration-300" />
                ) : active ? (
                  <>
                    {/* 진행 중: 회전 링으로 "지금 이 단계가 일하는 중"을 표현. 모션 끄면 링 숨김. */}
                    <span className="absolute inset-[-1px] animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary [animation-duration:0.9s] motion-reduce:hidden" />
                    <span className="size-2 rounded-full bg-primary motion-reduce:animate-pulse" />
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <span className="whitespace-nowrap text-[11px]">{label}</span>
              {sub && (
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{sub}</span>
              )}
              {key === 'REFINING' && !skipped && (
                // 개선 단계는 패치를 만들어 기준 실행으로 되돌아가는 루프다.
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <RotateCw className="size-2.5" />
                  {active && iterationCount > 0 ? `라운드 ${iterationCount}` : '재검증 루프'}
                </span>
              )}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
