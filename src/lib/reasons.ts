// 판정 사유 코드와 사용자 문구. 코드 목록은 AI 모듈의 정규 집합
// (ai-core/app/agents/schemas.py REASON_CATEGORIES)을 그대로 옮긴 것이고,
// 근거 기준표는 docs/judge-policy.md 3절·6절이다.
// 서버가 코드를 추가해도 화면이 죽지 않아야 하므로 아래 맵은 Record<string, _>이고,
// 모르는 코드는 호출부에서 중립 문구로 떨어진다.
export const REASON_CATEGORIES = [
  // preflight
  'repository_not_found',
  'ref_not_found',
  'private_repository_not_supported',
  'repository_not_accessible',
  'invalid_repository_input',
  'no_manifest_detected',
  'ambiguous_monorepo_path',
  'empty_repository',
  'unsupported_project_stack',
  // sandbox
  'timeout',
  'sandbox_nonzero_exit',
  'sandbox_not_executed',
  'test_failure',
  'no_tests_detected',
  'dependency_install_failed',
  'docker_build_failed',
  // runtime
  'service_smoke_failed',
  'browser_smoke_failed',
  // metrics
  'latency_slo_violation',
  'error_rate_slo_violation',
  'availability_slo_violation',
  'cpu_saturation',
  'memory_pressure',
  'unexpected_restart',
  'database_connection_errors',
  'redis_connection_errors',
  'no_traffic_observed',
  'missing_metrics',
  // chaos
  'chaos_not_recovered',
  'chaos_error_budget_exhausted',
  'chaos_recovery_exceeds_expected_bound',
  'chaos_recovered_within_budget',
  // pass
  'all_checks_passed',
] as const

// 문구는 원인 주체를 드러낸다. "코드 결함"으로 뭉뚱그리면 우리 쪽 장애와
// 검증할 것이 없던 경우까지 레포 탓이 되고, 실제로 그렇게 보이고 있었다.
export const REASON_LABEL: Record<string, string> = {
  repository_not_found: '레포를 찾지 못했어요. URL을 확인해 주세요.',
  ref_not_found: '지정한 브랜치나 커밋이 레포에 없어요.',
  private_repository_not_supported: '비공개 레포는 아직 검증할 수 없어요.',
  repository_not_accessible: '레포를 받아오지 못해 검증을 시작하지 못했어요.',
  invalid_repository_input: '입력한 레포 주소나 커밋 형식이 올바르지 않아요.',
  no_manifest_detected: '빌드 설정 파일이 없어서 무엇을 검증할지 정할 수 없었어요.',
  ambiguous_monorepo_path: '모노레포에서 검증할 경로를 특정하지 못했어요.',
  empty_repository: '레포가 비어 있어서 검증할 코드가 없어요.',
  unsupported_project_stack:
    '아직 지원하지 않는 스택이라 검증하지 못했어요. 코드 결함은 아니에요.',
  timeout: '제한 시간 안에 실행이 끝나지 않아 중단했어요.',
  sandbox_nonzero_exit: '빌드나 테스트 명령이 0이 아닌 종료 코드로 끝났어요.',
  sandbox_not_executed:
    '샌드박스가 실행되지 않아 아무것도 관측하지 못했어요. 코드 결함이 아니에요.',
  test_failure: '레포의 테스트가 실패했어요.',
  no_tests_detected:
    '테스트가 없어서 통과 여부를 확인할 수 없었어요. 실패가 아니라 검증 불가예요.',
  dependency_install_failed: '의존성 설치가 실패해서 빌드까지 가지 못했어요.',
  docker_build_failed: 'Docker 이미지 빌드가 실패했어요.',
  service_smoke_failed: '서비스를 띄운 뒤 스모크 테스트에 응답하지 않았어요.',
  browser_smoke_failed: '브라우저 스모크 테스트가 실패했어요.',
  latency_slo_violation: '응답 지연이 목표치를 넘었어요.',
  error_rate_slo_violation: '오류율이 목표치를 넘었어요.',
  availability_slo_violation: '가용성이 목표치에 못 미쳤어요.',
  cpu_saturation: 'CPU 사용률이 한계에 닿았어요.',
  memory_pressure: '메모리 사용률이 한계에 닿았어요.',
  unexpected_restart: '관측 중에 예상하지 못한 재시작이 있었어요.',
  database_connection_errors: '데이터베이스 연결 오류가 관측됐어요.',
  redis_connection_errors: 'Redis 연결 오류가 관측됐어요.',
  no_traffic_observed: '관측 구간에 트래픽이 없어서 메트릭을 판단할 수 없었어요.',
  missing_metrics:
    '필요한 메트릭이 수집되지 않아 판정할 수 없었어요. 코드 결함이 아니에요.',
  // 카오스 판정은 fixture 앱을 대상으로 한다(docs/judge-policy.md 6.3).
  // 제출한 레포의 복원력이 아니므로 문구에서 주체를 "검증 대상 앱"으로 못 박는다.
  chaos_not_recovered: '장애를 주입한 뒤 검증 대상 앱이 정상 상태로 복구되지 않았어요.',
  chaos_error_budget_exhausted:
    '장애 구간의 불가용 시간이 월간 에러 버짓을 다 썼어요.',
  chaos_recovery_exceeds_expected_bound:
    '복구 시간이 워크로드 설정에서 계산한 기대 상한을 넘었어요.',
  chaos_recovered_within_budget: '장애를 주입했고 에러 버짓 안에서 복구했어요.',
  all_checks_passed: '모든 검사를 통과했어요.',
  // judge-policy 6.2에는 있지만 schemas.py REASON_CATEGORIES에는 아직 없는 코드.
  // 추가되는 날 화면이 "코드 결함"으로 오역하지 않도록 먼저 넣어 둔다.
  chaos_evidence_missing:
    '카오스 실험의 baseline이나 복구 관측값이 없어서 판정할 수 없었어요.',
}

/** 실패 사유의 원인 주체.
 *
 * - `defect`: 제출된 레포의 결함
 * - `unverifiable`: 결함이 아니라 검증할 것이 없거나 검증을 시작할 수 없던 상태
 * - `infrastructure`: 우리 파이프라인·샌드박스·관측 쪽 문제
 *
 * 통과 사유(`all_checks_passed`, `chaos_recovered_within_budget`)는 실패 주체가
 * 없으므로 일부러 비워 둔다. 세 값 중 하나를 억지로 붙이면 집계가 오염된다. */
export const REASON_KIND: Record<string, 'defect' | 'unverifiable' | 'infrastructure'> = {
  // 입력이 틀렸거나 받을 수 없는 레포. 결함 판정이 아니라 시작조차 못 한 상태다.
  repository_not_found: 'unverifiable',
  ref_not_found: 'unverifiable',
  // 우리 미지원이지만 해소는 레포 쪽(공개 전환·권한 부여)에서 일어난다.
  private_repository_not_supported: 'unverifiable',
  // 애매하다. 권한·삭제(레포 쪽)와 네트워크 장애(우리 쪽)가 같은 코드로 들어온다.
  // 결함으로 두면 우리 네트워크 장애가 레포 탓이 되므로 검증 불가로 둔다.
  repository_not_accessible: 'unverifiable',
  invalid_repository_input: 'unverifiable',
  no_manifest_detected: 'unverifiable',
  ambiguous_monorepo_path: 'unverifiable',
  empty_repository: 'unverifiable',
  // 지원 범위를 넓히는 건 우리 일이지만 장애는 아니다. 결함이 아니라는 점이 요점이다.
  unsupported_project_stack: 'unverifiable',
  timeout: 'infrastructure',
  sandbox_nonzero_exit: 'defect',
  sandbox_not_executed: 'infrastructure',
  test_failure: 'defect',
  no_tests_detected: 'unverifiable',
  // 애매하다. lockfile·사설 의존성(레포 쪽)과 레지스트리·네트워크 장애(우리 쪽)가
  // 구분되지 않는다. 결함으로 단정하면 우리 장애를 레포 탓으로 돌린다.
  dependency_install_failed: 'unverifiable',
  docker_build_failed: 'defect',
  service_smoke_failed: 'defect',
  browser_smoke_failed: 'defect',
  latency_slo_violation: 'defect',
  error_rate_slo_violation: 'defect',
  availability_slo_violation: 'defect',
  cpu_saturation: 'defect',
  memory_pressure: 'defect',
  unexpected_restart: 'defect',
  database_connection_errors: 'defect',
  redis_connection_errors: 'defect',
  // 애매하다. 부하 생성이 안 돌았을 수도, 서비스가 안 떴을 수도 있다.
  // 어느 쪽이든 측정이 성립하지 않은 것이라 결함으로 세지 않는다.
  no_traffic_observed: 'infrastructure',
  missing_metrics: 'infrastructure',
  // judge-policy 6.2가 Fail로 분류하는 축이라 결함으로 둔다. 단 6.3이 밝힌 대로
  // Chaos v1 대상은 fixture 앱이므로 주체가 제출 레포가 아닐 수 있다. 재검토 대상.
  chaos_not_recovered: 'defect',
  chaos_error_budget_exhausted: 'defect',
  chaos_recovery_exceeds_expected_bound: 'defect',
  // 같은 6.2에서 Error로 분류한다. 증거가 없으면 대상 시스템 결함이 아니다.
  chaos_evidence_missing: 'infrastructure',
}
