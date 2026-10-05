import { Check, Minus } from 'lucide-react'
import { isTerminal, type AgentStep } from '@/lib/api'
import { CHAOS_SKIPPED_LABEL, PIPELINE_STEPS, STEP_LABEL } from '@/lib/steps'
import { cn } from '@/lib/utils'

interface Props {
  current: AgentStep
  iterationCount: number
  /** 장애 주입을 실제로 관측했는가. 카오스는 선택 단계라 안 돌린 검증이 정상 경로로 존재한다. */
  chaosObserved: boolean
}

export function PipelineProgress({
  current,
  iterationCount,
  chaosObserved,
}: Props) {
  const terminal = isTerminal(current)
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s === current)

  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-3">
      {PIPELINE_STEPS.map((step, i) => {
        // 카오스는 요청에 옵션이 있을 때만 돈다. 안 돌린 단계를 완료로 칠하면 사용자가
        // 받지 않은 보증을 받았다고 믿는다.
        const skipped = step === 'CHAOS' && terminal && !chaosObserved
        // 종결 시: PASSED면 전부 완료, FAILED/ERROR면 어디까지 갔는지 알 수 없으므로 중립 표시
        const done = !skipped && (terminal ? current === 'PASSED' : i < currentIndex)
        const active = !terminal && i === currentIndex
        return (
          <li
            key={step}
            className={cn(
              'flex items-center gap-2 text-sm',
              done || active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full border text-[11px]',
                done && 'border-emerald-500 bg-emerald-500 text-white',
                active && 'border-primary',
                skipped && 'border-dashed',
              )}
            >
              {skipped ? (
                <Minus className="size-3" />
              ) : done ? (
                <Check className="size-3" />
              ) : active ? (
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              ) : (
                i + 1
              )}
            </span>
            {skipped ? CHAOS_SKIPPED_LABEL : STEP_LABEL[step]}
            {step === 'REFINING' && active && iterationCount > 0 && (
              <span className="text-muted-foreground">
                (라운드 {iterationCount})
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
