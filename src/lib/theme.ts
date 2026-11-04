// 라이트와 다크 테마 판단 로직. 화면과 분리해서 테스트한다.
// 이 파일은 테스트를 바로 돌릴 수 있게 다른 모듈을 가져오지 않는다.
//
// 선택지는 세 가지다. 자동(시간대별), 라이트, 다크. 기본은 자동이다.
// 자동은 접속한 브라우저의 현재 시각을 본다. 브라우저 시간대를 따르므로 서울에서는 서울 시각,
// 도쿄에서는 도쿄 시각 기준이다. 위치 정보(GPS나 IP)를 따로 묻지 않는다. VPN이나 출장 중이어도
// 사용자 기기의 시계가 맞으면 그에 맞게 동작하고, 권한 팝업도 필요 없다.

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'cr-theme'

// 밤: 저녁 7시부터 아침 7시 전까지. 이 값을 바꾸면 index.html의 첫 화면 스크립트도 같이 바꾼다.
export const DARK_FROM_HOUR = 19
export const DARK_UNTIL_HOUR = 7

// 저장된 값이 이상하면(비어 있거나 손상) 자동으로 돌아간다.
export const parseTheme = (raw: unknown): ThemePreference =>
  raw === 'light' || raw === 'dark' ? raw : 'auto'

export const isNightHour = (hour: number) => hour >= DARK_FROM_HOUR || hour < DARK_UNTIL_HOUR

export function resolveTheme(pref: ThemePreference, now: Date = new Date()): ResolvedTheme {
  if (pref !== 'auto') return pref
  return isNightHour(now.getHours()) ? 'dark' : 'light'
}

// 자동 모드에서 다음 전환까지 남은 시간(ms). 낮이면 저녁 7시까지, 밤이면 다음 아침 7시까지.
export function msUntilNextSwitch(now: Date = new Date()): number {
  const next = new Date(now)
  const h = now.getHours()
  if (h >= DARK_UNTIL_HOUR && h < DARK_FROM_HOUR) {
    next.setHours(DARK_FROM_HOUR, 0, 0, 0)
  } else {
    next.setHours(DARK_UNTIL_HOUR, 0, 0, 0)
    if (h >= DARK_FROM_HOUR) next.setDate(next.getDate() + 1)
  }
  return Math.max(next.getTime() - now.getTime(), 1000)
}

export const THEME_LABEL: Record<ThemePreference, string> = {
  auto: '자동',
  light: '라이트',
  dark: '다크',
}

// 자동 모드에서 버튼에 붙일 설명. 지금 어느 테마이고 언제 바뀌는지 알려 준다.
export function describeAuto(now: Date = new Date()): string {
  const night = isNightHour(now.getHours())
  return night
    ? `자동: 지금은 다크예요. 오전 ${DARK_UNTIL_HOUR}시에 라이트로 바뀌어요.`
    : `자동: 지금은 라이트예요. 오후 ${DARK_FROM_HOUR - 12}시에 다크로 바뀌어요.`
}
