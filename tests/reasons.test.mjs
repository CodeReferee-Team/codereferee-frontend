import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REASON_LABEL } from '../.runtime/testbuild/reasons.js'

test('배포 불가 안내는 설정 제한과 미지원 의존성을 설명한다', () => {
  const label = REASON_LABEL.service_not_deployable
  assert.match(label, /서비스 6개/)
  assert.match(label, /추가 레포 5개/)
  assert.match(label, /미지원 의존성/)
})
