# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

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
