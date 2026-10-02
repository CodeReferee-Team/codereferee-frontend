import { Badge } from '@/components/ui/badge'
import { isTerminal, type AgentStep } from '@/lib/api'
import { STEP_LABEL } from '@/lib/steps'
import { cn } from '@/lib/utils'

const STYLE: Partial<Record<AgentStep, string>> = {
  PASSED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  // FAILED(코드 결함)와 ERROR(인프라 문제)는 색으로도 구분한다.
  ERROR: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
}

export function StatusBadge({ step }: { step: AgentStep }) {
  const running = !isTerminal(step)
  return (
    <Badge
      variant={step === 'FAILED' ? 'destructive' : 'secondary'}
      className={cn(STYLE[step])}
    >
      {running && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STEP_LABEL[step]}
    </Badge>
  )
}
