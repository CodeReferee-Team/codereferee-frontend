// 진행 표시줄의 단계 상태를 정하는 판단 로직. 화면과 분리해서 테스트한다.
// 이 파일은 테스트를 바로 돌릴 수 있게 다른 모듈을 가져오지 않는다.
//
// 배경: AI는 샌드박스를 한 번의 호출로 부른다. 그 안에서 clone, 빌드, 배포, 장애 주입이
// 몇 분간 진행되고, CHAOS 단계는 호출이 끝난 뒤에야 알려준다(실시간 보고 불가).
// 그래서 서버가 주는 단계로는 '기준 실행'에서 오래 멈췄다가 4, 5단계가 한꺼번에 지나간다.
// 이 모듈은 그 사실을 화면이 거짓말하지 않도록 세 가지를 한다.
//   1. 장애 주입을 요청했으면 기준 실행과 카오스를 한 칸으로 묶는다
//   2. 실제로 안 돈 단계(카오스, 개선)는 완료가 아니라 건너뜀으로 표시한다
//   3. 한꺼번에 온 완료 단계를 순서대로 채울 수 있게 계산을 돕는다(applyReveal)

export type NodeState = 'done' | 'active' | 'skipped' | 'pending'

export interface StepperNode {
  key: string
  label: string
  baseLabel: string // 건너뜀 같은 결과가 붙기 전의 이름. 채워지기 전 칸에 쓴다
  sub?: string // 라벨 아래 보조 문구
  state: NodeState
}

export interface StepperInput {
  current: string // 서버가 준 현재 단계(AgentStep)
  iterationCount: number // 개선 라운드 수
  chaosRequested: boolean // 요청에 장애 주입 옵션이 있었는가
  chaosObserved: boolean // 결과에 장애 관측이 실제로 있었는가
}

const TERMINAL = ['PASSED', 'FAILED', 'ERROR']
export const isTerminalStep = (s: string) => TERMINAL.includes(s)

const LABEL: Record<string, string> = {
  QUEUED: '대기 중',
  PREFLIGHT: '사전 점검',
  BASELINE: '기준 실행',
  CHAOS: '카오스 실험',
  JUDGING: '판정',
  REFINING: '개선 중',
}

export const SANDBOX_LABEL = '빌드와 장애 주입'
export const SANDBOX_SUB = '샌드박스 안에서 진행'
export const CHAOS_SKIPPED = '카오스 실험 (건너뜀)'
export const REFINING_SKIPPED = '개선 (건너뜀)'

// 화면에 그릴 단계 목록과 각 상태.
export function buildStepper(input: StepperInput): StepperNode[] {
  const { current, iterationCount, chaosRequested, chaosObserved } = input
  const terminal = isTerminalStep(current)
  const merged = chaosRequested

  // 장애 주입을 요청하면 기준 실행과 카오스를 한 칸으로 묶는다.
  const keys = merged
    ? ['QUEUED', 'PREFLIGHT', 'SANDBOX', 'JUDGING', 'REFINING']
    : ['QUEUED', 'PREFLIGHT', 'BASELINE', 'CHAOS', 'JUDGING', 'REFINING']

  const currentKey = merged && (current === 'BASELINE' || current === 'CHAOS') ? 'SANDBOX' : current
  const currentIndex = keys.indexOf(currentKey)

  return keys.map((key, i): StepperNode => {
    // 요청하지 않은 카오스, 돌지 않은 개선은 완료로 칠하지 않는다.
    // 사용자가 받지 않은 보증을 받았다고 믿으면 안 된다.
    const chaosSkipped = key === 'CHAOS' && terminal && !chaosObserved
    const refiningSkipped = key === 'REFINING' && terminal && iterationCount === 0
    const skipped = chaosSkipped || refiningSkipped
    // 종결 시: PASSED면 돈 단계는 전부 완료, FAILED나 ERROR면 어디까지 갔는지 알 수 없어 중립 표시.
    const done = !skipped && (terminal ? current === 'PASSED' : i < currentIndex)
    const active = !terminal && i === currentIndex

    const baseLabel = key === 'SANDBOX' ? SANDBOX_LABEL : LABEL[key]
    const label =
      key === 'SANDBOX' ? SANDBOX_LABEL
        : chaosSkipped ? CHAOS_SKIPPED
          : refiningSkipped ? REFINING_SKIPPED
            : LABEL[key]
    const sub = key === 'SANDBOX' ? SANDBOX_SUB : undefined

    return { key, label, baseLabel, sub, state: skipped ? 'skipped' : done ? 'done' : active ? 'active' : 'pending' }
  })
}

// 끝난 것으로 확정된 단계의 수(마지막으로 done이나 skipped인 칸의 다음 위치).
export function settledCount(nodes: StepperNode[]): number {
  let last = -1
  nodes.forEach((n, i) => {
    if (n.state === 'done' || n.state === 'skipped') last = i
  })
  return last + 1
}

// 완료 단계를 shown개까지만 보여준다. 한꺼번에 온 완료를 순서대로 채우는 데 쓴다.
// shown번째 칸은 '곧 채워질 칸'이라 진행 중처럼 보여서 채워지는 흐름이 이어진다.
export function applyReveal(nodes: StepperNode[], shown: number): StepperNode[] {
  const settled = settledCount(nodes)
  if (shown >= settled) return nodes
  return nodes.map((n, i) => {
    if (i < shown || (n.state !== 'done' && n.state !== 'skipped')) return n
    // 아직 채워지기 전이라 '건너뜀' 같은 결과 문구는 숨기고 원래 이름으로 보여준다.
    return { ...n, label: n.baseLabel, state: i === shown ? 'active' : 'pending' }
  })
}

// 현재 단계에 맞는 안내 문구. 장애 주입을 요청했으면 그 사실을 말해 준다.
export function stepHintOverride(current: string, chaosRequested: boolean): string | null {
  if (chaosRequested && (current === 'BASELINE' || current === 'CHAOS')) {
    return '샌드박스 안에서 클론, 빌드, 배포, 장애 주입을 차례로 진행하고 있어요. 시나리오에 따라 몇 분 걸릴 수 있고, 안에서 진행되는 동안 단계가 바뀌지 않아요.'
  }
  return null
}
