// 시간대를 먼저 고정한다. Date를 처음 쓰기 전에 설정해야 해서 import보다 앞에 둔다.
process.env.TZ = 'Asia/Seoul'

import { test } from 'node:test'
import assert from 'node:assert/strict'
const { describeAuto, msUntilNextSwitch, parseTheme, resolveTheme } = await import('../.runtime/testbuild/theme.js')

// 서울 시각으로 Date를 만든다 (TZ를 고정했으므로 로컬 생성자를 쓰면 된다)
const at = (h, m = 0) => new Date(2026, 10, 4, h, m, 0)

test('자동 모드: 낮은 라이트, 밤은 다크', () => {
  assert.equal(resolveTheme('auto', at(12)), 'light')
  assert.equal(resolveTheme('auto', at(23)), 'dark')
  assert.equal(resolveTheme('auto', at(3)), 'dark')
})

test('자동 모드 경계: 오전 7시부터 라이트, 저녁 7시부터 다크', () => {
  assert.equal(resolveTheme('auto', at(6, 59)), 'dark')
  assert.equal(resolveTheme('auto', at(7, 0)), 'light')
  assert.equal(resolveTheme('auto', at(18, 59)), 'light')
  assert.equal(resolveTheme('auto', at(19, 0)), 'dark')
})

test('직접 고르면 시간과 상관없이 그 값이다', () => {
  assert.equal(resolveTheme('light', at(23)), 'light')
  assert.equal(resolveTheme('dark', at(12)), 'dark')
})

test('저장된 값이 이상하면 자동으로 돌아간다', () => {
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('dark'), 'dark')
  for (const bad of [null, undefined, '', 'auto', 'blue', 1, {}]) assert.equal(parseTheme(bad), 'auto')
})

test('다음 전환까지 남은 시간', () => {
  const min = 60 * 1000
  assert.equal(msUntilNextSwitch(at(18, 30)), 30 * min) // 낮 -> 저녁 7시
  assert.equal(msUntilNextSwitch(at(6, 30)), 30 * min) // 밤 -> 아침 7시
  assert.equal(msUntilNextSwitch(at(23, 0)), 8 * 60 * min) // 밤 -> 다음 날 아침 7시
  assert.equal(msUntilNextSwitch(at(7, 0)), 12 * 60 * min) // 정각 낮 시작 -> 저녁 7시
})

test('자동 모드 설명은 지금 테마와 다음 전환 시각을 말한다', () => {
  assert.match(describeAuto(at(12)), /지금은 라이트.*오후 7시에 다크/)
  assert.match(describeAuto(at(22)), /지금은 다크.*오전 7시에 라이트/)
})
