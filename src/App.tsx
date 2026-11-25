import { Route, Routes } from 'react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/lib/useTheme'
import { cn } from '@/lib/utils'
import SubmitPage from '@/pages/SubmitPage'
import ValidationPage from '@/pages/ValidationPage'

export default function App() {
  const { pref, resolved, now, setPref } = useTheme()
  return (
    // 다크일 때만 코핏(네온) 스타일을 입힌다. 라이트는 원래의 하얀 화면 그대로다.
    <div className={cn('min-h-screen', resolved === 'dark' && 'gs-cockpit')}>
      <ThemeToggle pref={pref} now={now} onChange={setPref} />
      <Routes>
        <Route path="/" element={<SubmitPage />} />
        <Route path="/validations/:requestId" element={<ValidationPage />} />
      </Routes>
    </div>
  )
}
