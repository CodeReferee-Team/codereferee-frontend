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
import { useSubmitValidation } from '@/lib/queries'

export default function SubmitPage() {
  const navigate = useNavigate()
  const submit = useSubmitValidation()
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [commitSha, setCommitSha] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit.mutate(
      {
        repository_url: url.trim(),
        branch: branch.trim() || undefined,
        commit_sha: commitSha.trim() || undefined,
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

            {submit.error && (
              <Alert variant="destructive">
                <AlertTitle>제출하지 못했어요</AlertTitle>
                <AlertDescription>{submit.error.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? '제출 중…' : '검증 시작'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
