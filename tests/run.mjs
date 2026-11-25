// 테스트 실행기. 단위 테스트가 쓰는 src/lib 파일을 tests/libs/*.txt 에 한 줄씩 적어 두면
// 모아서 컴파일한 뒤 tests/*.test.mjs 를 돌린다.
// package.json 의 test 줄을 고치지 않고 기능마다 자기 목록 파일만 추가하게 해서, 여러 브랜치가
// 동시에 테스트를 늘려도 병합 충돌이 나지 않게 한다. Windows에서도 돌도록 셸 문법은 쓰지 않는다.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const win = process.platform === 'win32'
const list = (dir, ext) => readdirSync(dir).filter((f) => f.endsWith(ext)).sort()
const libs = list('tests/libs', '.txt').flatMap((f) =>
  readFileSync(`tests/libs/${f}`, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
)
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: win })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npx', ['tsc', '--ignoreConfig', ...libs, '--outDir', '.runtime/testbuild',
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'])
run(process.execPath, ['--test', ...list('tests', '.test.mjs').map((f) => `tests/${f}`)])
