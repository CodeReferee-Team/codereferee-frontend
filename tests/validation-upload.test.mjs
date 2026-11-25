import { test } from 'node:test'
import assert from 'node:assert/strict'
const { readValidationUpload, VALIDATION_YAML_MAX_BYTES } = await import('../.runtime/testbuild/validation-upload.js')
const { configurationIssue, uploadedConfiguration } = await import('../.runtime/testbuild/api.js')

test('UTF-8 YAML content is read without changing the source file', async () => {
  const text = 'version: 1\n# 재현용 설정\nservice: {}\n'
  assert.equal(await readValidationUpload(new File([text], 'validation.yaml')), text)
  assert.equal(await readValidationUpload(new File([text], 'custom.YML')), text)
})

test('wrong format, size, encoding and empty input are blocked before submission', async () => {
  for (const file of [new File(['secret=value'], '.env'), new File(['x'.repeat(VALIDATION_YAML_MAX_BYTES + 1)], 'v.yaml'),
    new File(['가'.repeat(22000)], 'v.yaml'), new File([new Uint8Array([0xff])], 'v.yaml'),
    new File([' '], 'v.yaml'), new File(['a\0b'], 'v.yaml')]) {
    await assert.rejects(readValidationUpload(file))
  }
})

test('missing reproduction configuration is distinguished from infrastructure and code failures', () => {
  const report = { judge_report: { reason_category: 'service_not_deployable' }, execution_result: {
    stderr: 'Compose needs explicit safe reproduction settings for: env_file' } }
  assert.match(configurationIssue(report), /운영 비밀값을 GitHub에 올릴 필요는 없어요/)
  assert.equal(configurationIssue({ ...report, execution_result: { infra_error: 'sandbox_disk_low' } }), null)
  assert.equal(configurationIssue({ judge_report: { reason_category: 'test_failure' } }), null)
  assert.ok(configurationIssue({ execution_result: { infra_error: 'uploaded_configuration_not_applied' } }))
})

test('only a Sandbox upload acknowledgement produces configuration metadata', () => {
  const input = { source: 'request_upload', uploaded_sha256: 'a'.repeat(64), effective_sha256: 'b'.repeat(64) }
  assert.deepEqual(uploadedConfiguration({ execution_result: { source: { configuration_input: input } } }),
    { uploaded_sha256: input.uploaded_sha256, effective_sha256: input.effective_sha256 })
  assert.equal(uploadedConfiguration({ execution_result: { source: { configuration_input: { ...input, source: 'repository' } } } }), null)
  assert.equal(uploadedConfiguration({}), null)
})
