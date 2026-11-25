import { useRef, useState, type FormEvent } from 'react'
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
import { HelpTip } from '@/components/ui/help-tip'
import {
  CHAOS_MODES,
  DEFAULT_MODE_LABEL,
  DEPLOYMENT_PROFILE_PATTERN,
  KNOWN_DEPLOYMENT_PROFILES,
  modeInfo,
  inspectionMode,
  SUITES,
} from '@/lib/chaos'
import { useSubmitValidation, useValidationCapabilities } from '@/lib/queries'
import { readValidationUpload } from '@/lib/validation-upload'
import { cn } from '@/lib/utils'

// shadcn Input과 같은 모양의 네이티브 select
const SELECT_CLASS =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export default function SubmitPage() {
  const navigate = useNavigate()
  const submit = useSubmitValidation()
  const capabilities = useValidationCapabilities()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [chaosMode, setChaosMode] = useState('')
  const [profile, setProfile] = useState('')
  const [email, setEmail] = useState('')
  const [targetUsers, setTargetUsers] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [validationYaml, setValidationYaml] = useState<string>()
  const [validationName, setValidationName] = useState('')
  const [uploadError, setUploadError] = useState<string>()
  const [uploadReading, setUploadReading] = useState(false)
  const uploadSequence = useRef(0)
  const [uploadKey, setUploadKey] = useState(0)
  const uploadSupported = capabilities.data?.validationYaml === true

  const clearUpload = () => {
    uploadSequence.current += 1
    setValidationYaml(undefined)
    setValidationName('')
    setUploadError(undefined)
    setUploadReading(false)
    setUploadKey((key) => key + 1)
  }

  const selectUpload = async (file: File | undefined) => {
    if (!file) { clearUpload(); return }
    const sequence = ++uploadSequence.current
    setValidationYaml(undefined)
    setValidationName('')
    setUploadError(undefined)
    setUploadReading(true)
    try {
      const text = await readValidationUpload(file)
      if (sequence !== uploadSequence.current) return
      setValidationYaml(text)
      setValidationName(file.name)
      setProfile('')
    } catch (error) {
      if (sequence === uploadSequence.current) setUploadError(error instanceof Error ? error.message : '파일을 읽지 못했어요.')
    } finally {
      if (sequence === uploadSequence.current) setUploadReading(false)
    }
  }

  const selectedMode = modeInfo(chaosMode)
  const selectedExtras = CHAOS_MODES.filter((mode) => extras.includes(mode.value))
  const needsProfile = selectedMode?.needsProfile ?? false
  const profileValue = profile.trim()
  // 프로필을 비워도 된다. 샌드박스가 레포의 .codereferee/validation.yaml에서 읽거나
  // Dockerfile로 자동 감지한다. 값을 넣었을 때만 형식을 검사한다(오타 조기 차단).
  const targetUsersValue = targetUsers.trim() === '' ? undefined : Number(targetUsers)
  const targetUsersInvalid =
    targetUsersValue !== undefined && !(Number.isInteger(targetUsersValue) && targetUsersValue >= 1 && targetUsersValue <= 500)
  const runsLoad = (SUITES[chaosMode] ?? [chaosMode]).concat(extras).includes('load_concurrent_users')
  const profileInvalid =
    needsProfile &&
    profileValue !== '' &&
    !DEPLOYMENT_PROFILE_PATTERN.test(profileValue)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (uploadReading || uploadError || (validationYaml !== undefined && !uploadSupported)) return
    const shouldEmailReport = email.trim() !== ''
    submit.mutate(
      {
        repository_url: url.trim(),
        branch: branch.trim() || undefined,
        commit_sha: commitSha.trim() || undefined,
        chaos_mode: inspectionMode(chaosMode, extras) || undefined,
        // 프로필은 레포 배포형 모드에서만 보낸다. 비우면 보내지 않고, 샌드박스가
        // 레포 설정(.codereferee/validation.yaml)이나 Dockerfile로 자동 해소한다.
        deployment_profile: needsProfile && profileValue ? profileValue : undefined,
        email: email.trim() || undefined,
        target_users: runsLoad ? targetUsersValue : undefined,
        ...(validationYaml !== undefined ? { validation_yaml: validationYaml } : {}),
      },
      {
        onSuccess: ({ requestId }) =>
          navigate(`/validations/${requestId}`, {
            state: { shouldEmailReport },
          }),
      },
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            SRE Reliability Check
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Code<span className="text-primary">Referee</span>
          </h1>
          <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
            GitHub 레포를 샌드박스에서 실행하고 장애를 주입해 신뢰성을 검증해요.
          </p>
        </div>
        <a
          className="mt-2 shrink-0 text-center text-[0.65rem] text-muted-foreground hover:text-foreground"
          href="https://qrfy.io/0ty_n9HeFI"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="시연 영상 열기"
        >
          <img className="size-14 rounded-md border bg-white p-1 sm:size-16" src="/demo-video-qr.png" alt="시연 영상 QR 코드" />
          <span className="mt-1 block">시연 영상</span>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>레포지토리 검증</CardTitle>
          <CardDescription>
            공개 GitHub 레포를 검증하고 결과 리포트를 이메일로 받아보세요.
          </CardDescription>
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

            <aside className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p>설정 없이 실행할 수 있는 레포인지 먼저 확인하세요.</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <a className="underline underline-offset-4" href="/guides/validation/index.html" target="_blank" rel="noopener noreferrer">지원 범위와 설정 작성 가이드</a>
                <a className="underline underline-offset-4" href="/guides/validation/guide.pdf" target="_blank" rel="noopener noreferrer">PDF 안내서</a>
                <a className="underline underline-offset-4" href="/guides/validation/validation-templates.zip" download>YAML 양식 받기</a>
              </div>
            </aside>

            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="validation-yaml">검증 설정 YAML (선택)</Label>
              <Input key={uploadKey} id="validation-yaml" type="file" accept=".yaml,.yml"
                disabled={!uploadSupported || submit.isPending}
                aria-describedby="validation-upload-hint"
                onChange={(e) => { void selectUpload(e.target.files?.[0]) }} />
              <p id="validation-upload-hint" className="text-xs text-muted-foreground">
                UTF-8 YAML 파일 1개, 최대 64KiB. 사용자 GitHub에 커밋하지 않고 이번 검사와 재검증에만 적용해요.
                레포에 같은 설정이 있으면 업로드한 설정을 우선 사용해요. 운영 비밀번호·API 키 대신 테스트용 값을 사용하세요.
              </p>
              {!uploadSupported && <p className="text-xs text-muted-foreground">
                {capabilities.isPending ? '서버의 설정 업로드 지원 여부를 확인하고 있어요.' : '현재 서버에서 설정 업로드를 사용할 수 없어요. 설정 없이 URL 검사는 계속할 수 있어요.'}
              </p>}
              {uploadReading && <p role="status" className="text-xs">설정 파일을 읽고 있어요.</p>}
              {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
              {(validationName || uploadError) && <Button type="button" variant="outline" size="sm" onClick={clearUpload}>설정 파일 제거</Button>}
              {validationYaml !== undefined && <details className="text-xs">
                <summary className="cursor-pointer">선택한 설정: {validationName}</summary>
                <pre className="mt-2 max-h-52 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{validationYaml}</pre>
              </details>}
            </div>

            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">카오스 실험</legend>
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
                    : '제출한 레포의 설치·빌드·실행 가능한 테스트와 HTTP 응답을 확인해요. 장애는 주입하지 않아요.'}
                </p>
              </div>

              {needsProfile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>추가 시나리오 (선택)</Label>
                    <HelpTip label="추가 시나리오">
                      선택한 기본 검사에 장애 시나리오를 더해 순서대로 실행해요. 앞선 시나리오가 실패하면 뒤 시나리오는 실행하지 않을 수 있어요.
                    </HelpTip>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {CHAOS_MODES.filter((m) => !m.value.startsWith('suite_') &&
                      !(SUITES[chaosMode] ?? [chaosMode]).includes(m.value)).map((m) => (
                      <label key={m.value} className="flex items-center gap-2">
                        <input type="checkbox" checked={extras.includes(m.value)}
                          onChange={(e) => setExtras((items) => e.target.checked ?
                            [...items, m.value] : items.filter((item) => item !== m.value))} />
                        <span>{m.label}</span>
                      </label>
                    ))}
                  </div>
                  {selectedExtras.length > 0 && (
                    <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {selectedExtras.map((mode) => (
                        <p key={mode.value}>
                          <span className="font-medium">{mode.label}:</span>{' '}
                          {mode.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {runsLoad && (
                <div className="space-y-2">
                  <Label htmlFor="target-users">예상 동시 사용자 수 (선택)</Label>
                  <Input
                    id="target-users"
                    type="number"
                    min={1}
                    max={500}
                    inputMode="numeric"
                    className={cn(targetUsersInvalid && 'border-destructive')}
                    placeholder="예: 100"
                    value={targetUsers}
                    onChange={(e) => setTargetUsers(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    적으면 그 인원을 꼭 재고, 그 인원에서 요청이 실패하면 불합격으로 판정한 뒤 고친 수정안을 같은
                    부하로 다시 검증해요. 비우면 몇 명까지 버티는지만 알려 드려요. 1~500명.
                  </p>
                </div>
              )}

              {needsProfile && (
                <div className="space-y-2">
                  <Label htmlFor="profile">배포 프로필 (선택)</Label>
                  <Input
                    id="profile"
                    disabled={validationYaml !== undefined}
                    list="deployment-profiles"
                    className={cn('font-mono', profileInvalid && profile && 'border-destructive')}
                    placeholder="비워두면 자동 — 레포 설정에서 읽어요"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                  <datalist id="deployment-profiles">
                    {KNOWN_DEPLOYMENT_PROFILES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    업로드한 설정이 있으면 별도 프로필은 사용하지 않아요. 비워두면 레포의 <code className="font-mono">.codereferee/validation.yaml</code>이나
                    Dockerfile로 샌드박스가 자동 감지해요. 설정이 없는 레포(예: QuickByte)만
                    등록된 프로필명을 넣으세요.
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
              disabled={submit.isPending || profileInvalid || uploadReading || !!uploadError || (validationYaml !== undefined && !uploadSupported) || (runsLoad && targetUsersInvalid)}
            >
              {submit.isPending ? '제출 중…' : '검증 시작'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
