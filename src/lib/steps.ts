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
  // 사유 코드를 모르는 상태의 문구다. 불합격은 테스트 실패뿐 아니라 테스트 부재나
  // 우리 쪽 관측 실패로도 나오므로 원인 주체를 단정하면 안 된다.
  // 코드가 오면 REASON_LABEL 문구가 이 자리를 대신한다(reasons.ts).
  FAILED: '검증을 통과하지 못했어요. 아래 판정 사유를 확인해 주세요.',
  ERROR: '인프라 문제로 판정할 수 없었어요. 코드 결함이 아니에요.',
}

// 요청에 카오스 옵션이 없으면 이 단계는 수행되지 않는다. 완료와 구분해 표시한다.
export const CHAOS_SKIPPED_LABEL = '카오스 실험 (건너뜀)'
export const CHAOS_SKIPPED_HINT =
  '이번 검증은 장애를 주입하지 않았어요. 빌드와 테스트만 확인한 결과예요.'
