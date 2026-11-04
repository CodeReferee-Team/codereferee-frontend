import { useCallback, useEffect, useState } from 'react'
import {
  msUntilNextSwitch,
  parseTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

// 저장소는 막혀 있을 수 있다(사생활 보호 모드, 차단). 못 읽으면 자동으로 둔다.
function readStored(): ThemePreference {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

// 선택한 테마를 문서에 적용한다. shadcn의 .dark 색 변수를 켜고, 기본 스크롤바와 입력창 색도 맞춘다.
function applyToDocument(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePreference>(readStored)
  // 자동 모드가 시각 변화를 알아채도록 현재 시각을 상태로 들고 있는다.
  const [now, setNow] = useState(() => new Date())
  const resolved = resolveTheme(pref, now)

  useEffect(() => {
    applyToDocument(resolved)
  }, [resolved])

  // 자동 모드: 다음 전환 시각에 맞춰 한 번만 깨어난다. 화면이 다시 보이면(절전에서 복귀 등) 바로 확인한다.
  useEffect(() => {
    if (pref !== 'auto') return
    const timer = setTimeout(() => setNow(new Date()), msUntilNextSwitch(new Date()) + 500)
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pref, now])

  // 다른 탭에서 바꾸면 이 탭도 따라간다.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) setPrefState(parseTheme(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setPref = useCallback((next: ThemePreference) => {
    setPrefState(next)
    setNow(new Date())
    try {
      if (next === 'auto') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // 저장하지 못해도 이번 접속 동안은 선택이 유지된다
    }
  }, [])

  return { pref, resolved, now, setPref }
}
