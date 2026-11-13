import { test } from 'node:test'
import assert from 'node:assert/strict'
import { queueLabel } from '../.runtime/testbuild/queue.js'

test('맨 앞이면 0건이 아니라 "바로 다음 차례"다', () => {
  assert.equal(queueLabel(0), '바로 다음 차례')
})

test('앞에 사람이 있으면 건수를 센다', () => {
  assert.equal(queueLabel(1), '앞에 1건')
  assert.equal(queueLabel(3), '앞에 3건')
})

// 운영에서 "앞에 undefined건"이 찍혔던 자리. 서버가 키를 안 보내는 구간이 실제로 있다.
test('값이 없으면 아무것도 그리지 않는다', () => {
  assert.equal(queueLabel(undefined), null)
  assert.equal(queueLabel(null), null)
})

test('숫자가 아니거나 말이 안 되는 값도 그리지 않는다', () => {
  assert.equal(queueLabel(Number.NaN), null)
  assert.equal(queueLabel(-1), null)
  assert.equal(queueLabel('3'), null)
})
