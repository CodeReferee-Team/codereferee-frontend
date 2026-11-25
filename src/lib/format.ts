// 경과 시간을 "1분 5초" 형태로. 음수나 비정상 값은 null.
export function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}초`
  return s === 0 ? `${m}분` : `${m}분 ${s}초`
}

// 서버의 LocalDateTime은 "2026-10-06T07:56:17.969295175"처럼 나노초 9자리에 타임존 표시가 없다.
// 서버가 시간대를 따로 설정하지 않은 컨테이너(Docker, EC2)에서 돌아서 값은 UTC 기준이다.
// 표시 없이 그냥 Date에 넣으면 브라우저 로컬 시각으로 읽어서, UTC 숫자가 내 시각처럼 보인다
// (한국이면 9시간 어긋난다). 그래서 표시가 없으면 UTC로 간주한다.
// 나중에 서버가 Z나 +09:00 같은 오프셋을 붙여 보내면 그 값을 그대로 존중한다.
// JS Date는 소수 3자리까지만 보장해서 밀리초로 자른 뒤 파싱한다.
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i
export const parseServerTime = (value: string) => {
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1')
  return new Date(HAS_OFFSET.test(trimmed) ? trimmed : `${trimmed}Z`)
}

// 화면에 보여줄 시각. 시간대는 접속한 브라우저의 설정(OS 시간대)을 따르므로
// 서울에서 열면 서울 시각, 도쿄에서 열면 도쿄 시각이 된다. 위치 정보를 따로 묻지 않는다.
// 어느 시간대 기준인지 헷갈리지 않게 GMT+9 같은 표시를 붙인다. 읽지 못하면 원문을 그대로 돌려준다.
export function formatServerTime(value: string): string {
  const d = parseServerTime(value)
  if (Number.isNaN(d.getTime())) return value
  // 날짜와 시각은 기존 화면과 같은 기본 형식으로 두고, 시간대 이름(GMT+9)만 덧붙인다.
  // dateStyle/timeStyle은 timeZoneName과 같이 쓰면 TypeError라서 따로 구한다.
  const zone = new Intl.DateTimeFormat('ko-KR', { timeZoneName: 'short' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  const text = d.toLocaleString('ko-KR')
  return zone ? `${text} ${zone}` : text
}

// 접수부터 마지막 갱신까지 (서버 TaskStatus.elapsed()와 같은 정의).
// 현재 시각(브라우저)과는 섞지 않는다. 시간대가 다르면 틀리기 때문이다.
export function elapsedMs(createdAt: string | null, updatedAt: string): number | null {
  if (!createdAt) return null
  const diff = parseServerTime(updatedAt).getTime() - parseServerTime(createdAt).getTime()
  return Number.isNaN(diff) ? null : diff
}

// 진행 중 경과 시간.
// 서버 시각(타임존 표시 없음)과 브라우저 시계를 직접 빼면 서버 시간대나 시계 오차만큼 틀린다.
// 그래서 서버가 알려준 "접수부터 마지막 갱신까지"(두 서버 시각의 차이라 시간대와 무관)를 기준으로 삼고,
// 그 갱신을 화면이 처음 본 뒤 흐른 시간만 브라우저의 단조 시계(performance.now)로 더한다.
// 갱신이 오면(진행 단계 전환, AI의 20초 간격 heartbeat) 기준을 다시 잡아 오차가 쌓이지 않는다.
// 화면을 막 열었을 때는 마지막 갱신 이후 최대 20초 정도 덜 셀 수 있다.
export interface ElapsedAnchor {
  baseMs: number // 접수부터 이 갱신까지
  updatedAt: string // 이 기준이 만들어진 갱신 시각 (같은 값이면 기준을 유지한다)
  seenAt: number // 화면이 이 갱신을 처음 본 시각 (performance.now 값)
}

export function nextAnchor(
  prev: ElapsedAnchor | null,
  createdAt: string | null,
  updatedAt: string,
  nowMs: number,
): ElapsedAnchor | null {
  const baseMs = elapsedMs(createdAt, updatedAt)
  if (baseMs === null || baseMs < 0) return null // 옛 레코드(접수 시각 없음)나 비정상 값
  if (prev && prev.updatedAt === updatedAt) return prev
  return { baseMs, updatedAt, seenAt: nowMs }
}

export const liveElapsedMs = (anchor: ElapsedAnchor, nowMs: number) =>
  anchor.baseMs + Math.max(0, nowMs - anchor.seenAt)

// 화면에 보여줄 경과 시간은 거꾸로 가지 않는다. 서버 갱신으로 기준을 다시 잡을 때 방금 센 값이
// 1초쯤 앞서 있으면 그 값을 유지하다가 따라잡게 한다. 진짜로 앞서간 게 아니라 계산 오차 때문이다.
export const nonDecreasing = (prevShown: number, computed: number) => Math.max(prevShown, computed)

// 샌드박스가 내려주는 오류 코드(aiReports.metrics.infra_error)를 사용자용 문장으로.
const INFRA_ERROR_MESSAGE: Record<string, string> = {
  sandbox_observation_unavailable:
    '샌드박스에서 결과를 관측하지 못했어요. 코드 문제가 아니라 실행 환경 문제예요.',
  sandbox_process_failed:
    '샌드박스 실험 프로세스가 비정상 종료했어요. 코드 문제가 아니라 실행 환경 문제예요.',
  sandbox_disk_low:
    '샌드박스 서버의 디스크가 모자라 빌드를 시작하지 않았어요. 코드 문제가 아니에요. 정리한 뒤 다시 시도해 주세요.',
  sandbox_cpu_insufficient:
    '샌드박스 서버의 CPU가 모자라 예상 사용자 수를 공정하게 잴 수 없었어요. 앱이 아니라 검사 환경의 한계라 판정하지 않았어요.',
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
