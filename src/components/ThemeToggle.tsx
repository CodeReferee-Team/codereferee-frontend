import { Moon, Sun, SunMoon } from 'lucide-react'
import { describeAuto, THEME_LABEL, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'auto', Icon: SunMoon },
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
]

interface Props {
  pref: ThemePreference
  now: Date
  onChange: (next: ThemePreference) => void
}

// 오른쪽 위에 떠 있는 세 칸짜리 선택 버튼: 자동, 라이트, 다크.
export function ThemeToggle({ pref, now, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className="fixed top-3 right-3 z-50 flex gap-0.5 rounded-lg border border-border bg-card/80 p-0.5 shadow-sm backdrop-blur"
    >
      {OPTIONS.map(({ value, Icon }) => {
        const selected = pref === value
        const title = value === 'auto' ? describeAuto(now) : `${THEME_LABEL[value]} 테마`
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={THEME_LABEL[value]}
            title={title}
            onClick={() => onChange(value)}
            className={cn(
              'flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {/* 좁은 화면에서는 아이콘만, 넓으면 이름도 보여 준다 */}
            <span className="hidden sm:inline">{THEME_LABEL[value]}</span>
          </button>
        )
      })}
    </div>
  )
}
