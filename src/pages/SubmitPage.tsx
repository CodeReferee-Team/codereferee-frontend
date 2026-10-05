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
  DEPLOYING_CHAOS_MODES,
  type ChaosMode,
} from '@/lib/api'
import { useSubmitValidation } from '@/lib/queries'

export default function SubmitPage() {
  const navigate = useNavigate()
  const submit = useSubmitValidation()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  // 카오스는 선택이다. 비워 두면 빌드와 테스트만 검증한다.
  const [chaosMode, setChaosMode] = useState<ChaosMode | ''>('')
  const [profile, setProfile] = useState('')

  // Sandbox는 프로필을 받으면 배포 경로가 있는 모드만 받는다. 아니면 422로 돌려준다.
  const profileNeedsOtherMode =
    profile.trim() !== '' &&
    !DEPLOYING_CHAOS_MODES.includes(chaosMode as ChaosMode)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit.mutate(
      {
        repository_url: url.trim(),
        branch: branch.trim() || undefined,
        commit_sha: commitSha.trim() || undefined,
        chaos_mode: chaosMode || undefined,
        deployment_profile: profile.trim() || undefined,
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

            <div className="space-y-2">
              <Label htmlFor="chaos">장애 주입 (선택)</Label>
              <select
                id="chaos"
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
                value={chaosMode}
                onChange={(e) => setChaosMode(e.target.value as ChaosMode | '')}
              >
                <option value="">주입하지 않음 (빌드와 테스트만)</option>
                {CHAOS_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                비워 두면 장애를 주입하지 않아요. 그때는 빌드와 테스트만 확인한
                결과예요.
              </p>
            </div>

            {chaosMode && (
              <div className="space-y-2">
                <Label htmlFor="profile">배포 프로필 (선택)</Label>
                <Input
                  id="profile"
                  className="font-mono"
                  placeholder="quickbyte-demo"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  레포를 Kubernetes에 띄워 장애를 주입할 때 쓰는 프로필이에요.
                  Sandbox에 등록된 이름만 받아요.
                </p>
              </div>
            )}

            {profileNeedsOtherMode && (
              <Alert variant="destructive">
                <AlertTitle>이 조합은 Sandbox가 받지 않아요</AlertTitle>
                <AlertDescription>
                  배포 프로필은 litmus_pod_delete, deployment_scale_down,
                  service_selector_blackhole, rollout_restart 중 하나와 함께
                  보내야 해요.
                </AlertDescription>
              </Alert>
            )}

            {submit.error && (
              <Alert variant="destructive">
                <AlertTitle>제출하지 못했어요</AlertTitle>
                <AlertDescription>{submit.error.message}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submit.isPending || profileNeedsOtherMode}
            >
              {submit.isPending ? '제출 중…' : '검증 시작'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
