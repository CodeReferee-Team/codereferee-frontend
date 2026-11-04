import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractTimeseries, nearestPoint, parseQuantity, peakOf, thin } from '../.runtime/testbuild/timeseries.js'

// 실서버 캡처(codereferee-AI ai-core/tests/fixtures/chaos_actual/server-20261029-e01)와 같은 모양
const observation = {
  cpu_cores: [
    { metric: { pod: 'api-aaa-old', container: 'api' }, values: [[1000.8, '0'], [1001.8, '0.1'], [1002.8, 'NaN'], [1003.8, '0.3']] },
    { metric: { pod: 'api-aaa-new', container: 'api' }, values: [[1003.8, '0.05'], [1004.8, '0.2']] },
  ],
  memory_working_set_bytes: [
    { metric: { pod: 'api-aaa-old' }, values: [[1000.8, '2854912'], [1001.8, '33497088']] },
  ],
  pod_bindings: [{ pod: 'api-aaa-new', resources: { limits: { cpu: '1', memory: '512Mi' } } }],
}

const chaos = {
  type: 'scenario_suite',
  scenarios: [
    { scenario: 'container_kill', chaos_observation: { started_at: '1970-01-01T00:16:41.123456789Z', fault_reverted_at: null, recovered_at: '1970-01-01T00:16:43Z' } },
    { scenario: 'pod_delete', chaos_observation: { started_at: '1970-01-01T00:16:44Z' } },
  ],
}

const reports = { execution_result: { source: { metrics_observation: observation }, chaos_observation: chaos }, metrics: {} }

test('시계열은 execution_result.source.metrics_observation에서 읽는다', () => {
  const ts = extractTimeseries(reports)
  assert.equal(ts.cpu.length, 2)
  assert.equal(ts.memory.length, 1)
  assert.equal(ts.cpu[0].label, 'api-aaa-old')
})

test('metrics.source에만 있어도 읽는다 (AI가 두 군데에 넣는다)', () => {
  const ts = extractTimeseries({ metrics: { source: { metrics_observation: observation } } })
  assert.equal(ts.cpu.length, 2)
})

test('문자열 값을 숫자로 바꾸고 NaN 점은 버린다', () => {
  const ts = extractTimeseries(reports)
  assert.deepEqual(ts.cpu[0].points.map((p) => p.v), [0, 0.1, 0.3])
  assert.equal(ts.memory[0].points[1].v, 33497088)
})

test('시각 범위는 모든 시리즈의 처음과 끝이다', () => {
  const ts = extractTimeseries(reports)
  assert.equal(ts.tMin, 1000.8)
  assert.equal(ts.tMax, 1004.8)
})

test('묶음 검사의 시나리오별 장애 구간을 읽는다', () => {
  const { windows } = extractTimeseries(reports)
  assert.equal(windows.length, 2)
  assert.equal(windows[0].label, 'container_kill')
  assert.equal(windows[0].start, 1001.123) // 소수 9자리 시각도 읽는다
  assert.equal(windows[0].revertedAt, null)
  assert.equal(windows[0].recoveredAt, 1003)
  assert.equal(windows[1].recoveredAt, null)
})

test('단독 검사는 chaos_observation 자체가 구간이다', () => {
  const single = { type: 'dependency_redis_outage', started_at: '1970-01-01T00:16:41Z', fault_reverted_at: '1970-01-01T00:16:43Z' }
  const ts = extractTimeseries({ execution_result: { source: { metrics_observation: observation }, chaos_observation: single } })
  assert.equal(ts.windows.length, 1)
  assert.equal(ts.windows[0].label, 'dependency_redis_outage')
  assert.equal(ts.windows[0].revertedAt, 1003)
})

test('파드 자원 한도를 읽는다', () => {
  const { limits } = extractTimeseries(reports)
  assert.equal(limits.cpuCores, 1)
  assert.equal(limits.memoryBytes, 512 * 2 ** 20)
})

test('쿠버네티스 수량 표기', () => {
  assert.equal(parseQuantity('500m'), 0.5)
  assert.equal(parseQuantity('1Gi'), 2 ** 30)
  assert.equal(parseQuantity('2'), 2)
  assert.equal(parseQuantity('abc'), null)
  assert.equal(parseQuantity(undefined), null)
})

test('시계열이 없으면 null이다 (카오스를 안 돌린 요청)', () => {
  assert.equal(extractTimeseries({ metrics: {} }), null)
  assert.equal(extractTimeseries({}), null)
  assert.equal(extractTimeseries({ execution_result: { source: { metrics_observation: { cpu_cores: [] } } } }), null)
})

test('구간 최댓값과 가장 가까운 점', () => {
  const ts = extractTimeseries(reports)
  assert.equal(peakOf(ts.cpu), 0.3)
  assert.equal(peakOf(ts.cpu, 1004, 1005), 0.2)
  assert.equal(peakOf(ts.cpu, 2000, 3000), null)
  assert.equal(nearestPoint(ts.cpu[0].points, 1001.9).v, 0.1)
  assert.equal(nearestPoint(ts.cpu[0].points, 1100), null) // 시리즈가 없던 시각은 채우지 않는다
})

test('점이 많으면 줄이되 처음과 끝은 남긴다', () => {
  const pts = Array.from({ length: 2000 }, (_, i) => ({ t: i, v: i }))
  const out = thin(pts, 600)
  assert.ok(out.length <= 601)
  assert.equal(out[0].t, 0)
  assert.equal(out[out.length - 1].t, 1999)
})
