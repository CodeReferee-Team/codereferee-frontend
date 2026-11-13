// 대기 순번 문구. 그릴 값이 없으면 null을 돌려준다.
//
// 서버가 이 키를 아예 안 보낼 수도 있어서 undefined까지 받는다. 프론트는 Vercel이 머지
// 즉시 배포하고 BE는 버튼을 눌러야 나가므로, 두 쪽 버전이 어긋난 구간이 항상 생긴다.
// 그 구간에 "앞에 undefined건"이 찍혔던 적이 있다. 타입만 number | null로 적어두면
// 컴파일은 통과하고 실행 중에만 드러난다.
//
// 0을 그대로 쓴다. 1부터 세면 "바로 다음 차례"를 영영 못 보여준다.
export function queueLabel(queuedAhead: number | null | undefined): string | null {
  if (typeof queuedAhead !== 'number' || !Number.isFinite(queuedAhead) || queuedAhead < 0) {
    return null
  }
  return queuedAhead === 0 ? '바로 다음 차례' : `앞에 ${queuedAhead}건`
}
