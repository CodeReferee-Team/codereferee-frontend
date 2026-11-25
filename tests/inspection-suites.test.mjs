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
  assert.equal(mode, 'suite_custom__v1_1fff')
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

test('the 12 fault scenarios keep their v1 bits after load joins as the 13th', () => {
  const faults = CHAOS_MODES.filter((m) => !m.value.startsWith('suite_') && m.value !== 'load_concurrent_users')
    .map((m) => m.value)
  assert.equal(inspectionMode('suite_quick', faults), 'suite_custom__v1_fff')
  assert.equal(inspectionMode('suite_quick', ['load_concurrent_users']), 'suite_custom__ck__load')
})

test('load results are found inside a suite and summarised in one sentence', async () => {
  const { findLoad, describeLoad } = await import('../.runtime/testbuild/chaos.js')
  const load = { stages: [{ users: 10, error_rate: 0 }, { users: 100, error_rate: 0 },
    { users: 200, error_rate: 0.194 }], max_users_without_errors: 100, first_users_with_errors: 200 }
  const observation = { type: 'scenario_suite', scenarios: [{ chaos_observation: { type: 'container_kill' } },
    { chaos_observation: { type: 'load_concurrent_users', load } }] }
  assert.deepEqual(findLoad(observation), load)
  assert.equal(findLoad({ type: 'container_kill' }), null)
  assert.equal(describeLoad(load), '동시 사용자 100명까지는 모두 답했고, 200명에서 요청의 19.4%가 실패했어요.')
  assert.equal(describeLoad({ ...load, max_users_without_errors: null, first_users_with_errors: null }),
    '동시 사용자 200명까지 모든 요청에 답했어요.')
  const measured = { ...load, latency_growth: { from_users: 10, from_p95_ms: 53, to_users: 200, to_p95_ms: 351, ratio: 6.6 },
    overload_behavior: { users: 200, kind: 'rejected' } }
  assert.equal(describeLoad(measured), '동시 사용자 100명까지는 모두 답했고, 200명에서 요청의 19.4%가 실패했어요.'
    + ' 응답 시간(p95)은 10명일 때 53ms에서 200명일 때 351ms로 6.6배가 됐어요.'
    + ' 넘친 요청은 바로 거절했어요(503·429). 사용자를 붙잡아 두지 않는 건 좋은 신호예요.')
})

test('the requester\'s expected users are named in the load sentence', async () => {
  const { describeLoad } = await import('../.runtime/testbuild/chaos.js')
  const load = { stages: [{ users: 10, error_rate: 0 }, { users: 150, error_rate: 0.05 }],
    max_users_without_errors: 10, first_users_with_errors: 150, target_users: 150, target_met: false }
  assert.ok(describeLoad(load).endsWith(' 예상하신 150명을 버티지 못했어요.'))
  assert.ok(describeLoad({ ...load, target_met: null }).indexOf('예상하신') === -1)
})

