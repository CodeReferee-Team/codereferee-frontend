import { Fragment } from 'react'
import { Check, Minus, RotateCw } from 'lucide-react'
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

  // 노드와 연결선이 같은 판단을 공유하도록 각 단계 상태를 미리 계산한다.
  const stepState = PIPELINE_STEPS.map((step, i) => {
    // 카오스는 요청에 옵션이 있을 때만 돈다. 안 돌린 단계를 완료로 칠하면 사용자가
    // 받지 않은 보증을 받았다고 믿는다.
    const skipped = step === 'CHAOS' && terminal && !chaosObserved
    // 종결 시: PASSED면 전부 완료, FAILED/ERROR면 어디까지 갔는지 알 수 없어 중립 표시.
    const done = !skipped && (terminal ? current === 'PASSED' : i < currentIndex)
    const active = !terminal && i === currentIndex
    return { step, skipped, done, active }
  })

  return (
    <ol className="flex items-start overflow-x-auto pb-1">
      {stepState.map(({ step, skipped, done, active }, i) => (
        <Fragment key={step}>
          {i > 0 && (
            // 앞 노드가 완료면 연결선을 채운다 = 데이터가 거기까지 흘렀다는 표시.
            <div
              className={cn(
                'mt-2.5 h-px min-w-5 flex-1',
                stepState[i - 1].done ? 'bg-emerald-500' : 'bg-border',
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
            <span className="whitespace-nowrap text-[11px]">
              {skipped ? CHAOS_SKIPPED_LABEL : STEP_LABEL[step]}
            </span>
            {step === 'REFINING' && (
              // 개선 단계는 패치를 만들어 BASELINE으로 되돌아가는 루프다.
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <RotateCw className="size-2.5" />
                {active && iterationCount > 0 ? `라운드 ${iterationCount}` : '재검증 루프'}
              </span>
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
