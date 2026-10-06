import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CHAOS_MODES,
  DEFAULT_MODE_LABEL,
  DEPLOYMENT_PROFILE_PATTERN,
  KNOWN_DEPLOYMENT_PROFILES,
  modeInfo,
  inspectionMode,
  SUITES,
} from '@/lib/chaos'
import { useSubmitValidation } from '@/lib/queries'
import { cn } from '@/lib/utils'

// shadcn Input과 같은 모양의 네이티브 select
const SELECT_CLASS =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export default function SubmitPage() {
  const navigate = useNavigate()
  const submit = useSubmitValidation()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [chaosMode, setChaosMode] = useState('')
  const [profile, setProfile] = useState('')
  const [email, setEmail] = useState('')
  const [extras, setExtras] = useState<string[]>([])

  const selectedMode = modeInfo(chaosMode)
  const needsProfile = selectedMode?.needsProfile ?? false
  const profileValue = profile.trim()
  const profileInvalid =
    needsProfile &&
    (profileValue === '' || !DEPLOYMENT_PROFILE_PATTERN.test(profileValue))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit.mutate(
      {
        repository_url: url.trim(),
        branch: branch.trim() || undefined,
        commit_sha: commitSha.trim() || undefined,
        chaos_mode: inspectionMode(chaosMode, extras) || undefined,
        // 프로필은 레포 배포형 모드에서만 의미가 있다. 기본(fixture) 모드에 보내면 샌드박스가 거절한다.
        deployment_profile: needsProfile ? profileValue : undefined,
        email: email.trim() || undefined,
      },
      { onSuccess: ({ requestId }) => navigate(`/validations/${requestId}`) },
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">CodeReferee</h1>
        <p className="mt-1 text-muted-foreground">
          GitHub 레포를 샌드박스에서 실행하고 장애를 주입해 신뢰성을 검증해요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>레포지토리 검증</CardTitle>
          <CardDescription>공개 GitHub 레포 URL을 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">레포지토리 URL</Label>
              <Input
                id="url"
                type="url"
                required
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">브랜치 (선택)</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sha">커밋 SHA (선택)</Label>
                <Input
                  id="sha"
                  className="font-mono"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                />
              </div>
            </div>

            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">카오스 실험</legend>
              <div className="space-y-2">
                <Label htmlFor="chaos-mode">실험 종류</Label>
                <select
                  id="chaos-mode"
                  className={SELECT_CLASS}
                  value={chaosMode}
                  onChange={(e) => { setChaosMode(e.target.value); setExtras([]) }}
                >
                  <option value="">{DEFAULT_MODE_LABEL}</option>
                  {CHAOS_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {selectedMode
                    ? selectedMode.description
                    : '레포를 직접 실행하지 않고, 준비된 테스트 서비스로 기본 실험(Pod Kill)을 해요.'}
                </p>
              </div>

              {needsProfile && (
                <div className="space-y-2">
                  <Label>추가 시나리오 (선택)</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {CHAOS_MODES.filter((m) => !m.value.startsWith('suite_') &&
                      !(SUITES[chaosMode] ?? [chaosMode]).includes(m.value)).map((m) => (
                      <label key={m.value} className="flex items-center gap-2">
                        <input type="checkbox" checked={extras.includes(m.value)}
                          onChange={(e) => setExtras((items) => e.target.checked ?
                            [...items, m.value] : items.filter((item) => item !== m.value))} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {needsProfile && (
                <div className="space-y-2">
                  <Label htmlFor="profile">배포 프로필</Label>
                  <Input
                    id="profile"
                    list="deployment-profiles"
                    required
                    className={cn('font-mono', profileInvalid && profile && 'border-destructive')}
                    placeholder="quickbyte-demo"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                  <datalist id="deployment-profiles">
                    {KNOWN_DEPLOYMENT_PROFILES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    샌드박스가 이 이름으로 배포 설정을 찾아요. 소문자, 숫자, 하이픈만 쓸 수 있어요.
                  </p>
                </div>
              )}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="email">결과 메일로 받기 (선택)</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                입력하면 검증이 끝났을 때 PDF 리포트를 보내요. 탭을 닫아도 돼요.
              </p>
            </div>

            {submit.error && (
              <Alert variant="destructive">
                <AlertTitle>제출하지 못했어요</AlertTitle>
                <AlertDescription>{submit.error.message}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submit.isPending || profileInvalid}
            >
              {submit.isPending ? '제출 중…' : '검증 시작'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
