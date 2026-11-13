interface Props {
  queuedAhead: number | null
}

// 대기 순번 한 칸. 대기 중일 때만 나온다.
//
// 파이프라인이 직렬이라 차례가 올 때까지 화면이 '대기 중'에서 멈춰 있다. 그때 사용자가
// 품는 의심은 "얼마나 남았나"가 아니라 "고장난 것 아닌가"다. 순번과 그 이유를 같이
// 보여주면 그 의심이 사라진다.
//
// 남은 시간을 분으로 환산해 보여주지 않는다. 한 건의 소요 시간이 설정 오류로 3분 만에
// 끝나는 경우부터 자동 수정 3회까지 가는 경우까지 몇 배씩 갈려서, 평균을 곱한 숫자는
// 어느 쪽에도 맞지 않는다. 틀린 카운트다운은 아무것도 안 보여주는 것보다 나쁘다.
export function QueuePosition({ queuedAhead }: Props) {
  if (queuedAhead === null) return null

  return (
    <div className="flex gap-1.5">
      <dt>대기 순번</dt>
      <dd className="text-foreground tabular-nums">
        {queuedAhead === 0 ? '바로 다음 차례' : `앞에 ${queuedAhead}건`}
        <span className="ml-1 text-muted-foreground tabular-nums">
          (측정이 섞이지 않도록 한 번에 한 건씩 처리해요)
        </span>
      </dd>
    </div>
  )
}
