import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const guide = readFileSync('public/guides/validation/index.html', 'utf8')
const submit = readFileSync('src/pages/SubmitPage.tsx', 'utf8')

test('메인과 가이드에 같은 시연 영상 QR을 노출한다', () => {
  assert.ok(existsSync('public/demo-video-qr.png'))
  for (const page of [guide, submit]) {
    assert.match(page, /demo-video-qr\.png/)
    assert.match(page, /https:\/\/qrfy\.io\/0ty_n9HeFI/)
    assert.match(page, /시연 영상/)
  }
})

test('가이드는 메인 화면의 제목과 돌아가기 링크를 사용한다', () => {
  assert.match(guide, /SRE Reliability Check/)
  assert.match(guide, /Code<span>Referee<\/span>/)
  assert.match(guide, /검증 화면으로 돌아가기/)
})
