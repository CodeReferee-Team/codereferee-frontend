import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyReveal, buildStepper, settledCount, stepHintOverride } from '../.runtime/testbuild/stepper.js'

const base = { iterationCount: 0, chaosRequested: true, chaosObserved: true }
const states = (nodes) => nodes.map((n) => n.state)
const keys = (nodes) => nodes.map((n) => n.key)

test('장애 주입을 요청하면 기준 실행과 카오스를 한 칸으로 묶는다', () => {
  const nodes = buildStepper({ ...base, current: 'BASELINE' })
  assert.deepEqual(keys(nodes), ['QUEUED', 'PREFLIGHT', 'SANDBOX', 'JUDGING', 'REFINING'])
  assert.equal(nodes[2].label, '빌드와 장애 주입')
  assert.equal(nodes[2].sub, '샌드박스 안에서 진행')
})

test('묶은 칸은 BASELINE과 CHAOS 모두에서 진행 중이다', () => {
  for (const current of ['BASELINE', 'CHAOS']) {
    assert.deepEqual(states(buildStepper({ ...base, current })), ['done', 'done', 'active', 'pending', 'pending'])
  }
})

test('장애 주입을 요청하지 않으면 여섯 칸을 그대로 둔다', () => {
  const nodes = buildStepper({ ...base, chaosRequested: false, chaosObserved: false, current: 'BASELINE' })
  assert.deepEqual(keys(nodes), ['QUEUED', 'PREFLIGHT', 'BASELINE', 'CHAOS', 'JUDGING', 'REFINING'])
})

test('안 돈 카오스는 끝난 뒤 건너뜀이다', () => {
  const nodes = buildStepper({ ...base, chaosRequested: false, chaosObserved: false, current: 'PASSED' })
  assert.equal(nodes[3].state, 'skipped')
  assert.equal(nodes[3].label, '카오스 실험 (건너뜀)')
})

test('개선 라운드가 0이면 통과해도 개선 칸은 건너뜀이다', () => {
  const nodes = buildStepper({ ...base, current: 'PASSED', iterationCount: 0 })
  assert.deepEqual(states(nodes), ['done', 'done', 'done', 'done', 'skipped'])
  assert.equal(nodes[4].label, '개선 (건너뜀)')
})

test('개선을 실제로 돌렸으면 통과 때 개선 칸도 완료다', () => {
  const nodes = buildStepper({ ...base, current: 'PASSED', iterationCount: 2 })
  assert.deepEqual(states(nodes), ['done', 'done', 'done', 'done', 'done'])
})

test('실패나 판정 불가에서는 완료로 칠하지 않는다', () => {
  for (const current of ['FAILED', 'ERROR']) {
    const nodes = buildStepper({ ...base, current, iterationCount: 1 })
    assert.ok(nodes.every((n) => n.state === 'pending'), current)
  }
})

test('진행 중에는 개선 칸을 건너뜀으로 보지 않는다', () => {
  const nodes = buildStepper({ ...base, current: 'JUDGING' })
  assert.equal(nodes[4].state, 'pending')
})

test('끝난 칸 수와 순서대로 채우기', () => {
  const nodes = buildStepper({ ...base, current: 'PASSED', iterationCount: 1 })
  assert.equal(settledCount(nodes), 5)
  // 0개만 보이는 시점: 첫 칸이 채워질 차례라 진행 중으로 보인다
  assert.deepEqual(states(applyReveal(nodes, 0)), ['active', 'pending', 'pending', 'pending', 'pending'])
  assert.deepEqual(states(applyReveal(nodes, 2)), ['done', 'done', 'active', 'pending', 'pending'])
  // 다 채워졌으면 그대로다
  assert.deepEqual(states(applyReveal(nodes, 5)), states(nodes))
})

test('진행 중인 칸은 채우기 대상이 아니다', () => {
  const nodes = buildStepper({ ...base, current: 'JUDGING' })
  assert.equal(settledCount(nodes), 3)
  assert.equal(applyReveal(nodes, 3), nodes)
})

test('장애 주입 중 안내 문구', () => {
  assert.match(stepHintOverride('BASELINE', true), /샌드박스 안에서/)
  assert.equal(stepHintOverride('BASELINE', false), null)
  assert.equal(stepHintOverride('JUDGING', true), null)
})

test('채워지기 전의 건너뜀 칸은 결과 문구 없이 원래 이름이다', () => {
  const nodes = buildStepper({ ...base, current: 'PASSED', iterationCount: 0 })
  assert.equal(nodes[4].label, '개선 (건너뜀)')
  // 마지막 칸(개선)이 채워질 차례일 때
  const view = applyReveal(nodes, 4)
  assert.equal(view[4].state, 'active')
  assert.equal(view[4].label, '개선 중')
  // 다 채워지면 결과 문구가 붙는다
  assert.equal(applyReveal(nodes, 5)[4].label, '개선 (건너뜀)')
})
