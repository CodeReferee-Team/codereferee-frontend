# codereferee-frontend

CodeReferee의 웹 화면입니다. GitHub 레포가 사용자가 늘고 장애가 나도 버티는지 검사를 요청하고, 진행 상황과 결과 리포트를 봅니다. Vercel에 배포되어 있고, 모든 요청은 BE(`codereferee-server`)의 `/api`로 갑니다.

## 화면

| 경로 | 화면 |
| --- | --- |
| `/` | 검증 요청. 레포 URL, 브랜치, 검사 종류, 예상 동시 사용자 수, 알림 이메일을 받습니다 |
| `/validations/:requestId` | 진행 단계, 판정(통과·실패·판정 불가), 부하·장애 관측 결과, 경고, 검증된 수정안 |

- **검사 종류**: 빠른 검사(`suite_quick`), 중간 검사(`suite_standard`), 정밀 검사(`suite_deep`)를 고르거나 시나리오를 직접 골라 묶을 수 있습니다. 목록은 `src/lib/chaos.ts`에 있고, 샌드박스에 시나리오가 추가되면 이 파일만 고치면 됩니다.
- **예상 동시 사용자 수**: 선택 입력(1~500)입니다. 넣으면 부하 시나리오가 그 인원에서 버티는지 재고, 버티지 못하면 실패로 판정합니다. 비우면 실패 대신 경고로만 알려줍니다.
- **판정 문구**: 판정 사유와 경고 코드를 사람이 읽는 문장으로 바꾸는 표는 `src/lib/reasons.ts`에 있습니다.

## 개발

```bash
npm install
npm run dev     # vite dev 서버. /api는 vite.config.ts의 프록시로 BE에 붙습니다
npm run build
npm run lint    # oxlint
npm test        # 검사 묶음 구성 테스트 (tests/*.test.mjs)
```

React 19 + TypeScript + Vite, Tailwind CSS, TanStack Query를 씁니다.

## 백엔드 연결 (vercel.json)

브라우저는 Vercel 과만 HTTPS 로 통신하고, **Vercel 엣지가 서버 쪽에서** BE 를
평문으로 호출한다. 브라우저가 평문을 보지 않으므로 mixed content 가 생기지 않는다.
도메인과 인증서를 사지 않고 HTTPS 를 지키는 방법이다.

```
브라우저 --HTTPS--> Vercel 엣지 --HTTP--> EC2 nginx --> Spring Boot
```

`src/lib/api.ts` 가 이미 상대 경로(`/api/...`)만 쓰고 `vite.config.ts` 의 dev
프록시도 같은 구조라서, 이 파일 하나 말고 **코드 변경이 없다.**

### 주소가 하드코딩된 이유

`vercel.json` 의 rewrite 대상에는 환경변수를 쓸 수 없다. 그래서 BE 인스턴스에
Elastic IP 를 붙여 고정했다. 인스턴스를 재시작해도 주소가 바뀌지 않는다.

**BE 인스턴스를 새로 만들면 이 파일의 IP 를 고쳐야 한다.** 고치지 않으면 화면은
뜨는데 모든 요청이 실패한다.

### 두 번째 규칙은 SPA fallback

react-router 를 쓰므로 `/history` 같은 주소로 새로고침해도 `index.html` 이
나와야 한다. Vercel 은 rewrite 보다 파일시스템을 먼저 보기 때문에 `/assets/*.js`
같은 정적 파일은 그대로 서빙된다.

### 아직 인증이 없다

BE API 는 인터넷에 열려 있다. Vercel 송신 IP 가 고정 목록이 아니라 보안그룹으로
좁힐 수 없고, 도메인을 사도 같다. nginx 에 초당 10회 제한을 걸어 피해를 줄였을
뿐이고 근본 해결은 API 인증이다. `codereferee-infra/docs/open-questions.md` 3번.
