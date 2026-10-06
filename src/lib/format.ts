// 경과 시간을 "1분 5초" 형태로. 음수나 비정상 값은 null.
export function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}초`
  return s === 0 ? `${m}분` : `${m}분 ${s}초`
}

// 서버의 LocalDateTime은 "2026-10-06T07:56:17.969295175"처럼 나노초 9자리, 타임존 없음.
// JS Date는 소수 3자리까지만 보장하고(브라우저에 따라 그 이상은 Invalid Date) 타임존 없는 값은 브라우저 로컬로 해석한다.
// 그래서 밀리초로 자른 뒤 파싱하고, 두 값에 같은 방식을 쓰는 차이 계산에만 믿고 쓴다.
export const parseServerTime = (value: string) =>
  new Date(value.replace(/(\.\d{3})\d+$/, '$1'))

// 접수부터 마지막 갱신까지 (서버 TaskStatus.elapsed()와 같은 정의).
// 현재 시각(브라우저)과는 섞지 않는다. 시간대가 다르면 틀리기 때문이다.
export function elapsedMs(createdAt: string | null, updatedAt: string): number | null {
  if (!createdAt) return null
  const diff = parseServerTime(updatedAt).getTime() - parseServerTime(createdAt).getTime()
  return Number.isNaN(diff) ? null : diff
}

// 샌드박스가 내려주는 오류 코드(aiReports.metrics.infra_error)를 사용자용 문장으로.
const INFRA_ERROR_MESSAGE: Record<string, string> = {
  sandbox_observation_unavailable:
    '샌드박스에서 결과를 관측하지 못했어요. 코드 문제가 아니라 실행 환경 문제예요.',
  sandbox_process_failed:
    '샌드박스 실험 프로세스가 비정상 종료했어요. 코드 문제가 아니라 실행 환경 문제예요.',
}

const GENERIC_ERROR =
  '샌드박스나 파이프라인 문제로 관측할 수 없었어요. 코드 결함으로 판단하지 않았으니 다시 시도해 보세요.'

// 서버가 ResultQueueConsumer에서 만드는 영문 기계 문구. 사용자에게 그대로 보여주면 의미가 없다.
//   ERROR : "Pipeline error (판정 불가): <status>"
//   FAILED: "Validation failed. status: <status>"
// 스위퍼가 만드는 한국어 문장("결과를 받지 못한 채 …")은 사람이 읽는 문장이라 그대로 쓴다.
const isMachineMessage = (m: string) =>
  m.startsWith('Pipeline error') || m.startsWith('Validation failed.')

// ERROR 사유: 알려진 infra_error 코드 → 사람이 쓴 서버 문장 → 일반 안내 순으로 고른다.
export function describeError(
  errorMessage: string | null,
  infraError?: string,
): string {
  if (infraError && INFRA_ERROR_MESSAGE[infraError]) {
    return INFRA_ERROR_MESSAGE[infraError]
  }
  if (errorMessage && !isMachineMessage(errorMessage)) return errorMessage
  return GENERIC_ERROR
}

// FAILED 사유: 기계 문구는 숨긴다. (판정 이유는 Judge 카드가 이미 보여준다)
export const failureReason = (errorMessage: string | null) =>
  errorMessage && !isMachineMessage(errorMessage) ? errorMessage : null
