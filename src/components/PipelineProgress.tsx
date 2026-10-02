import { Check } from 'lucide-react'
import { isTerminal, type AgentStep } from '@/lib/api'
import { PIPELINE_STEPS, STEP_LABEL } from '@/lib/steps'
import { cn } from '@/lib/utils'

interface Props {
  current: AgentStep
  iterationCount: number
}

export function PipelineProgress({ current, iterationCount }: Props) {
  const terminal = isTerminal(current)
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s === current)

  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-3">
      {PIPELINE_STEPS.map((step, i) => {
        // 종결 시: PASSED면 전부 완료, FAILED/ERROR면 어디까지 갔는지 알 수 없으므로 중립 표시
        const done = terminal ? current === 'PASSED' : i < currentIndex
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
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : active ? (
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              ) : (
                i + 1
              )}
            </span>
            {STEP_LABEL[step]}
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
