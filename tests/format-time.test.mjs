// 시간대를 먼저 고정한다. Date를 처음 쓰기 전에 설정해야 해서 import보다 앞에 둔다.
process.env.TZ = 'Asia/Seoul'

import { test } from 'node:test'
import assert from 'node:assert/strict'
const { parseServerTime, formatServerTime, elapsedMs, nextAnchor, liveElapsedMs, nonDecreasing } = await import('../.runtime/testbuild/format.js')

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

test('진행 중 경과 시간은 서버가 준 기준에 화면이 본 뒤 흐른 시간을 더한다', () => {
  const a = nextAnchor(null, '2026-11-04T10:00:00', '2026-11-04T10:01:05', 1000)
  assert.equal(a.baseMs, 65000)
  assert.equal(liveElapsedMs(a, 1000), 65000) // 막 봤을 때
  assert.equal(liveElapsedMs(a, 4500), 68500) // 3.5초 뒤
})

test('같은 갱신이면 기준을 유지하고, 새 갱신이 오면 다시 잡는다', () => {
  const a = nextAnchor(null, '2026-11-04T10:00:00', '2026-11-04T10:01:05', 1000)
  assert.equal(nextAnchor(a, '2026-11-04T10:00:00', '2026-11-04T10:01:05', 9000), a)
  const b = nextAnchor(a, '2026-11-04T10:00:00', '2026-11-04T10:01:25', 21000)
  assert.equal(b.baseMs, 85000)
  assert.equal(b.seenAt, 21000)
  // 오차가 쌓이지 않는다: 새 기준에서 다시 시작한다
  assert.equal(liveElapsedMs(b, 21000), 85000)
})

test('서버 시간대가 어떻든 경과 시간은 같다 (두 서버 시각의 차이만 쓴다)', () => {
  const utc = nextAnchor(null, '2026-11-04T10:00:00Z', '2026-11-04T10:00:30Z', 0)
  const kst = nextAnchor(null, '2026-11-04T19:00:00+09:00', '2026-11-04T19:00:30+09:00', 0)
  assert.equal(utc.baseMs, 30000)
  assert.equal(kst.baseMs, 30000)
})

test('접수 시각이 없거나 거꾸로면 경과 시간을 만들지 않는다', () => {
  assert.equal(nextAnchor(null, null, '2026-11-04T10:01:05', 0), null)
  assert.equal(nextAnchor(null, '2026-11-04T10:05:00', '2026-11-04T10:01:05', 0), null)
})

test('보여주는 경과 시간은 거꾸로 가지 않는다', () => {
  assert.equal(nonDecreasing(51000, 50000), 51000) // 기준을 다시 잡아 1초 낮게 계산돼도 유지
  assert.equal(nonDecreasing(51000, 52000), 52000) // 따라잡으면 다시 올라간다
  assert.equal(nonDecreasing(0, 0), 0)
})
