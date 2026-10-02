import type { AgentStep } from '@/lib/api'

// 정상 진행 순서. REFINING은 패치 루프로 BASELINE에 되돌아가므로 진행 표시줄에서는 JUDGING 뒤에 둔다.
export const PIPELINE_STEPS = [
  'QUEUED',
  'PREFLIGHT',
  'BASELINE',
  'CHAOS',
  'JUDGING',
  'REFINING',
] as const satisfies readonly AgentStep[]

export const STEP_LABEL: Record<AgentStep, string> = {
  QUEUED: '대기 중',
  PREFLIGHT: '사전 점검',
  BASELINE: '기준 실행',
  CHAOS: '카오스 실험',
  JUDGING: '판정',
  REFINING: '개선 중',
  PASSED: '통과',
  FAILED: '실패',
  ERROR: '판정 불가',
}

export const STEP_HINT: Record<AgentStep, string> = {
  QUEUED: '샌드박스가 동시에 1건만 처리해서 대기열이 길어질 수 있어요.',
  PREFLIGHT: '레포 URL과 브랜치를 확인하고 있어요. (실행 없음)',
  BASELINE: '클론, 빌드, 스모크 테스트로 기준 상태를 확인하고 있어요.',
  CHAOS: '기준 검증을 통과한 앱에 장애를 주입하고 있어요.',
  JUDGING: 'Judge가 결과와 메트릭으로 합격 여부를 판단하고 있어요.',
  REFINING: '수정안을 만들어 다시 검증하고 있어요.',
  PASSED: '검증을 통과했어요.',
  FAILED: '코드 결함으로 검증에 실패했어요.',
  ERROR: '인프라 문제로 판정할 수 없었어요. 코드 결함이 아니에요.',
}
