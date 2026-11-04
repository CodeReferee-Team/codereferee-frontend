// 시간대를 먼저 고정한다. Date를 처음 쓰기 전에 설정해야 해서 import보다 앞에 둔다.
process.env.TZ = 'Asia/Seoul'

import { test } from 'node:test'
import assert from 'node:assert/strict'
const { parseServerTime, formatServerTime, elapsedMs } = await import('../.runtime/testbuild/format.js')

test('시간대 표시가 없는 서버 시각은 UTC로 읽는다', () => {
  assert.equal(parseServerTime('2026-11-04T10:07:18').toISOString(), '2026-11-04T10:07:18.000Z')
})

test('나노초 9자리도 읽는다', () => {
  assert.equal(parseServerTime('2026-10-29T14:36:40.123456789').toISOString(), '2026-10-29T14:36:40.123Z')
})

test('서버가 오프셋을 붙여 보내면 그대로 존중한다', () => {
  assert.equal(parseServerTime('2026-11-04T10:07:18Z').toISOString(), '2026-11-04T10:07:18.000Z')
  assert.equal(parseServerTime('2026-11-04T19:07:18+09:00').toISOString(), '2026-11-04T10:07:18.000Z')
  assert.equal(parseServerTime('2026-10-29T14:36:52.918845Z').toISOString(), '2026-10-29T14:36:52.918Z')
})

test('서울 브라우저에서는 UTC 10:07이 오후 7:07로 보인다', () => {
  const text = formatServerTime('2026-11-04T10:07:18.5')
  assert.match(text, /오후 7:07:18/)
  assert.match(text, /GMT\+9/)
  assert.match(text, /2026\. 11\. 4\./)
})

test('읽을 수 없는 값은 원문을 그대로 돌려준다', () => {
  assert.equal(formatServerTime('not-a-date'), 'not-a-date')
})

test('소요 시간은 시간대와 무관하다', () => {
  assert.equal(elapsedMs('2026-11-04T10:00:00', '2026-11-04T10:01:05'), 65000)
  assert.equal(elapsedMs(null, '2026-11-04T10:01:05'), null)
})
