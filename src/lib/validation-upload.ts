export const VALIDATION_YAML_MAX_BYTES = 64 * 1024

export async function readValidationUpload(file: File): Promise<string> {
  if (!/\.ya?ml$/i.test(file.name)) throw new Error('.yaml 또는 .yml 파일을 선택해 주세요.')
  if (file.size > VALIDATION_YAML_MAX_BYTES) throw new Error('설정 파일은 64KiB 이하여야 해요.')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error('파일을 읽지 못했어요. UTF-8로 저장한 YAML 파일을 선택해 주세요.')
  }
  if (!text.trim() || text.includes('\0')) throw new Error('비어 있지 않은 YAML 텍스트 파일을 선택해 주세요.')
  return text
}
