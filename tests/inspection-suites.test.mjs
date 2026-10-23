import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHAOS_MODES, inspectionMode, SUITES } from '../.runtime/testbuild/chaos.js'

test('a preset without extras preserves the existing wire field', () => {
  assert.equal(inspectionMode('suite_standard', []), 'suite_standard')
})

test('extras merge with mandatory scenarios without duplicates', () => {
  assert.equal(inspectionMode('suite_quick', ['litmus_container_kill', 'litmus_pod_cpu_hog']),
    'suite_custom__ck__cpu')
})

test('all selections fit the Backend 64 character contract', () => {
  const extras = CHAOS_MODES.filter((m) => !m.value.startsWith('suite_')).map((m) => m.value)
  const mode = inspectionMode('suite_deep', extras)
  assert.ok(mode.length <= 64)
  assert.match(mode, /^[a-z0-9_]+$/)
  assert.equal(mode, 'suite_custom__v1_fff')
})

test('every preset scenario is selectable', () => {
  const modes = new Set(CHAOS_MODES.map((m) => m.value))
  for (const suite of Object.values(SUITES)) {
    for (const mode of suite) assert.ok(modes.has(mode))
  }
})

test('an ERROR names the stage and scenario where the sandbox stopped', async () => {
  const { describeStop } = await import('../.runtime/testbuild/chaos.js')
  assert.equal(describeStop('deploy', 'no space left on device'),
    '레포 배포 단계(clone·빌드·기동)에서 멈췄어요. 마지막 오류: no space left on device')
  assert.equal(describeStop('scenario:litmus_pod_network_latency', null),
    "장애 시나리오 '네트워크 지연'에서 멈췄어요.")
  assert.equal(describeStop(undefined, 'x'), null)
})
