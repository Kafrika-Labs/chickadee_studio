# 운영자 승인 검사기 인증

[한국어](scanner-authentication.ko.md) | [English](scanner-authentication.md)

자기 서비스를 검사하는 보안담당자가 WAF에 검사기 전용 토큰을 등록하는 기능입니다. 외부 사이트의 접근 제한을 자동으로 해제하지 않습니다.

## 앱 설정

1. **설정 → 인증**을 엽니다.
2. 정확한 HTTPS origin(예: `https://example.com`)과 허용 경로(예: `/boards`)를 입력합니다. 포트가 다르면 별도 origin입니다. 하위 도메인은 자동 포함하지 않습니다.
3. **토큰 생성 → 토큰 복사**로 32바이트 난수 토큰을 만들고, 운영하는 WAF의 규칙에 등록합니다. 이미 발급한 토큰도 입력할 수 있습니다(영문·숫자·`-`·`_`, 32~256자).
4. 1·4·8·24시간 중 클라이언트 유효 시간을 선택하고 **인증 적용**을 누릅니다.
5. 등록한 경로의 URL로 검사하고, WAF 이벤트에서 해당 규칙이 일치했는지 확인합니다. 앱의 ‘등록됨’은 서버가 인증을 수락했다는 뜻이 아닙니다.

헤더는 `X-Chickadee-Token`입니다. `/boards`와 `/boards/...`에 적용하며 `/boardsevil`에는 적용하지 않습니다. HTML·스크립트·CSS·이미지 요청에 같은 범위를 적용합니다. HTTP, 다른 origin, 범위 밖 경로, GET/HEAD 이외 요청에는 토큰을 보내지 않습니다. 리다이렉트 자동 추적을 끄고 다음 요청의 범위를 다시 확인합니다. 이미지 수집은 기존대로 HTTP 리다이렉트를 따라가지 않습니다.

경로 밖 CSS나 이미지가 WAF에 막히면 일부 근거를 수집하지 못할 수 있습니다. 필요한 자원을 포함하도록 운영자가 범위를 조정하세요. 인증 경로는 헤더 전송 범위이며, 크롤링 자체의 경로 제한을 대신하지 않습니다.

토큰은 백엔드 프로세스의 메모리에만 보관합니다. 최대 20개 origin을 등록할 수 있고 같은 origin은 새 등록으로 교체합니다. 시작 URL이 등록 범위 밖이거나 등록이 만료되면 검사를 시작하지 않습니다. 실행 중 유효 시간이 지나면 이후 요청부터 토큰 전송을 중지합니다. 앱을 재시작하면 다시 등록해야 하므로 무인 예약 검사의 영구 인증 용도로 사용하지 마세요. 별도 AI 추가 탐색과 로그인 창에는 이 헤더를 전달하지 않습니다.

## Cloudflare 규칙 예시

아래는 운영자가 검토·수정할 조건 예시입니다. `example.com`, `/boards`, IP와 토큰 자리표시자를 실제 값으로 교체하세요. 고정 IP를 확보하지 못한 경우 IP 조건을 제거할 수 있지만 토큰이 유출되면 다른 클라이언트도 사용할 수 있습니다. User-Agent만으로 검사기를 인증하지 마세요.

```text
(ssl and http.host eq "example.com"
 and http.request.method in {"GET" "HEAD"}
 and (http.request.uri.path eq "/boards" or starts_with(http.request.uri.path, "/boards/"))
 and ip.src eq 203.0.113.10
 and any(http.request.headers["x-chickadee-token"][*] eq "REPLACE_WITH_GENERATED_TOKEN"))
```

해당 조건에 **필요한 봇 검사만 Skip**하는 규칙을 구성하세요. 다른 보안 규칙의 순서와 실제 차단 사유를 확인해야 하며 로그인 권한·요청량 제한·모든 관리형 WAF 규칙을 일괄 해제하지 마세요. 헤더 존재 여부만 검사하면 안 됩니다.

Cloudflare **Bot Fight Mode는 사용자 지정 Skip 규칙으로 예외 처리할 수 없습니다.** Super Bot Fight Mode 등 Skip을 지원하는 제품인지 먼저 확인하세요. 제품·플랜에 따라 사용할 수 있는 예외 옵션이 다릅니다. [Cloudflare Bot Fight Mode 제한](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations), [Skip 옵션](https://developers.cloudflare.com/waf/custom-rules/skip/options/).

## 검증 및 폐기

- 정상 토큰으로 허용 경로의 게시판과 다음 페이지, 필요한 이미지를 검사합니다.
- 토큰 없음·오류 토큰·다른 IP·범위 밖 경로가 예외 대상에 포함되지 않는지 WAF 이벤트로 확인합니다.
- 클라이언트 만료는 **서버 토큰 만료가 아닙니다**. 검사 후 앱에서 인증을 해제하고 WAF 규칙도 비활성화하거나 토큰을 교체하세요.
- 토큰은 공유 비밀입니다. WAF 설정과 원본 서버의 헤더 로그 접근을 제한하고, 응답 본문이나 진단 페이지에 토큰을 반사하지 마세요. OS 클립보드·히스토리에 복사본이 남을 수 있습니다.
- 앱은 일반 요청 오류의 토큰을 가리지만, 서버가 토큰을 콘텐츠에 그대로 반사하면 그 콘텐츠가 수집될 수 있습니다.

이 버전은 mTLS, 인증서 발급, WAF 자동 설정 또는 운영자 소유권 검증을 구현하지 않습니다. 실제 사이트의 정책 적용 및 허용 범위 승인 책임은 운영자에게 있습니다.
