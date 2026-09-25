# Canonical Release Public Access & Consumer Independence 정책

Status: Approved  
Consumer: SC_WEP  
Canonical release authority: SC_Linked_App

## 1. 목적

Simple Connection의 릴리스 정보와 다운로드 기능은 "SC_Linked_App"가 소유하는 Canonical HTTPS contract를 통해 외부 Consumer에게 제공한다.

"SC_WEP"은 이 contract를 사용하는 presentation consumer이며, release infrastructure를 직접 소유하거나 접근하지 않는다.

이 정책의 목적은 다음 두 가지를 동시에 보장하는 것이다.

1. "SC_Linked_App"가 실제로 접근 가능한 public release interface를 제공한다.
2. "SC_WEP"이 Cloudflare를 포함한 특정 infrastructure provider에 의존하지 않는다.

## 2. Authority

Canonical release contract의 유일한 authority는 다음이다.

SC_Linked_App

SC_Linked_App가 소유하는 책임:

- Canonical release URL
- Release catalog schema
- Latest release 상태
- Release history
- Download URL
- Public API availability
- Browser 접근 가능성
- Production endpoint 검증
- Infrastructure와 public contract 사이의 연결

SC_WEP은 release authority가 아니다.

SC_WEP은 다음 정보를 생성하거나 재해석하지 않는다.

- latest version
- release ordering
- download path
- R2 object key
- stable pointer
- release database
- fallback release metadata

## 3. Canonical Public Interface

다음 경로는 SC_Linked_App가 제공하는 public machine-readable interface이다.

Release catalog

    /application/simple_connection/releases

Update 및 release artifact

    /application/simple_connection/update/*

Stable update policy

    /application/update-policy/simple_connection/stable.json

이 경로들은 외부 Consumer가 별도의 사용자 인증이나 사람 개입 없이 접근할 수 있어야 한다.

## 4. Public Access 요구사항

Canonical release interface는 최소한 다음 HTTP method를 지원해야 한다.

- GET
- HEAD

다음 Consumer 환경에서 정상 접근 가능해야 한다.

- SC_WEP browser
- GitHub Actions
- Simple Connection updater
- 일반 HTTP client
- 배포 검증 도구

사람이 브라우저에서 수동으로 Challenge를 해결해야만 접근할 수 있는 상태는 public API 정상 상태로 인정하지 않는다.

## 5. Cloudflare Challenge 금지

Canonical machine-readable release interface에는 사람 확인을 요구하는 interstitial challenge를 적용해서는 안 된다.

예를 들어 다음 응답은 정상 API 응답이 아니다.

- HTTP 403
- Just a moment...
- Cloudflare Challenge HTML
- Turnstile 요구
- Access 로그인 요구

Canonical Release API는 요청된 JSON 또는 artifact를 직접 반환해야 한다.

## 6. Infrastructure 보안 경계

Canonical API를 공개하기 위해 전체 사이트의 보안을 해제해서는 안 된다.

다음 방식은 허용하지 않는다.

    www.kswdeveloper.cloud 전체 보안 해제

Infrastructure에서 예외가 필요하다면 machine-readable public interface에 필요한 최소 경로 범위에서 처리한다.

즉:

    일반 웹 서비스
    → 기존 보안 정책 유지

    Canonical public release interface
    → machine client 접근을 차단하는 Challenge 금지

Infrastructure 보안 구성은 SC_Linked_App 또는 해당 Delivery/Infrastructure 계층의 책임이다.

## 7. SC_WEP Infrastructure Provider Independence

SC_WEP은 Cloudflare 서비스를 사용하지 않는다.

이는 단순히 Cloudflare API를 직접 호출하지 않는다는 의미가 아니다.

SC_WEP의 release consumer 실행 경로에는 Cloudflare 또는 다른 특정 infrastructure provider에 대한 기능, 인증, 설정, SDK 또는 fallback을 직접·간접적으로 포함해서는 안 된다.

다음 사용을 금지한다.

- Cloudflare API
- Cloudflare SDK
- Wrangler
- Cloudflare Workers 전용 API
- Cloudflare Access
- Cloudflare Challenge 처리
- Turnstile
- Cloudflare Bot/WAF 우회
- Cloudflare API Token
- Cloudflare Account ID
- Cloudflare Zone ID
- R2 직접 접근
- KV 직접 접근
- Cloudflare 전용 header
- Cloudflare 전용 environment variable
- Cloudflare 전용 fallback endpoint
- Cloudflare provider 상태 조회

## 8. SC_WEP의 유일한 Upstream Dependency

SC_WEP의 release consumer가 의존할 수 있는 upstream contract는 다음 하나뿐이다.

    SC_Linked_App
            ↓
    Canonical HTTPS contract
            ↓
    SC_WEP

SC_WEP 입장에서 이 HTTPS URL 뒤에 어떤 infrastructure가 존재하는지는 계약의 일부가 아니다.

다음과 같은 infrastructure 변경은 SC_WEP 변경 사유가 되어서는 안 된다.

- Cloudflare → AWS
- Cloudflare → Azure
- Cloudflare → 자체 서버
- R2 → 다른 object storage
- Worker → 다른 application runtime
- CDN 변경
- DNS 변경
- Reverse proxy 변경

Canonical HTTPS contract가 유지되는 한 SC_WEP의 release consumer는 변경되지 않아야 한다.

## 9. Infrastructure 정보 역류 금지

SC_Linked_App 내부 infrastructure 정보는 canonical application contract를 넘어 SC_WEP으로 전달되어서는 안 된다.

금지:

    SC_Linked_App
        ↓
    R2 key
    KV namespace
    Worker route
    Cloudflare token
    Cloudflare challenge state
    provider-specific identifier
        ↓
    SC_WEP

허용:

    SC_Linked_App
        ↓
    Canonical HTTPS response
        ↓
    SC_WEP

SC_WEP이 사용할 수 있는 정보는 application-level contract 필드에 한정한다.

예:

- schemaVersion
- latestVersion
- version
- fileName
- downloadUrl
- releasedAt
- latest
- platform
- arch

## 10. Provider-specific Fallback 금지

Canonical API가 실패했을 때 SC_WEP이 infrastructure를 직접 조회해서 데이터를 복원해서는 안 된다.

다음 구조는 금지한다.

    Canonical API 실패
    → R2 직접 조회

    Canonical API 실패
    → KV 직접 조회

    Canonical API 실패
    → Cloudflare API 조회

    Canonical API 실패
    → 별도 Worker endpoint 사용

정상 흐름은 다음뿐이다.

    Canonical API 성공
    → catalog 사용

    Canonical API 실패
    → Consumer 오류 상태

Canonical authority의 장애를 Consumer가 infrastructure 우회로 보정하지 않는다.

## 11. Provider-specific 오류 처리 금지

SC_WEP은 특정 infrastructure provider의 오류 코드나 응답 형식을 해석해서 동작을 변경하지 않는다.

예를 들어 다음과 같은 처리를 추가하지 않는다.

- Cloudflare 1020이면 다른 endpoint 사용
- cf-ray가 존재하면 재시도
- Challenge이면 Turnstile 실행
- Access login 수행
- Cloudflare-specific cookie 사용

SC_WEP이 판단하는 오류 수준은 표준 HTTP 및 Canonical contract 수준으로 제한한다.

- Network error
- HTTP 4xx
- HTTP 5xx
- Invalid JSON
- Unsupported schema
- Invalid release contract

## 12. Browser Cross-Origin Access

SC_WEP이 다른 origin에서 실행될 수 있으므로 Canonical Release Catalog는 browser cross-origin read를 지원해야 한다.

Release catalog는 공개 metadata이며 사용자 credential을 요구하지 않는다.

기본 계약:

    Credential:
    사용하지 않음

    Allowed methods:
    GET
    HEAD

허용 origin 범위는 별도의 보안 검토를 통해 정할 수 있지만, 실제 SC_WEP browser consumer가 읽을 수 없는 상태는 public contract 충족으로 인정하지 않는다.

## 13. Verification Failure 조건

다음은 모두 public release verification 실패이다.

HTTP 403

    HTTP 403
    → 실패

실행 환경이 GitHub Actions라는 이유로 성공으로 변경하지 않는다.

Challenge HTML

    Just a moment...
    Cloudflare Challenge
    기타 browser verification HTML

을 반환하면 실패이다.

HTTP 200 + 잘못된 Content

    HTTP 200
    + HTML

도 release catalog 성공으로 인정하지 않는다.

JSON Schema 불일치

다음 문제가 있으면 실패한다.

- schemaVersion 불일치
- 필수 필드 누락
- invalid downloadUrl
- latest 상태 불일치
- 잘못된 JSON

Browser Consumer 접근 불가

Server-to-server 요청은 성공하지만 SC_WEP browser에서 읽을 수 없다면 실패이다.

## 14. Release Gate

다음만 성공했다고 공식 public release가 완료된 것으로 판단해서는 안 된다.

- Worker deploy 성공
- R2 upload 성공
- KV write 성공
- CI build 성공

최종 검증은 실제 public consumer boundary까지 수행해야 한다.

    Release publication
            ↓
    Infrastructure
            ↓
    Canonical public URL
            ↓
    실제 HTTP request
            ↓
    HTTP 정상 응답
            ↓
    올바른 content type
            ↓
    Canonical schema 검증
            ↓
    release metadata 검증
            ↓
    downloadUrl 접근 검증
            ↓
    Browser consumer 접근 검증

이 전체 흐름이 성공해야 public release를 정상으로 판정한다.

## 15. Forbidden-success 우회 금지

HTTP 403 또는 public access failure를 release 성공으로 승격하는 기능은 허용하지 않는다.

다음 정책은 금지한다.

    403 발생
    → GitHub runner 특성으로 간주
    → warning
    → exit 0

정상 판정은 다음이다.

    403 발생
    → Canonical public API 접근 실패
    → Release verification 실패

"AllowForbidden"과 같이 public 접근 실패를 정상 결과로 바꾸는 compatibility path는 제거 대상이다.

## 16. Cloudflare 문제 소유권

현재 production infrastructure가 Cloudflare를 사용하더라도 다음 문제는 SC_WEP 책임이 아니다.

- WAF
- Bot protection
- Managed Challenge
- Turnstile
- Access
- Workers routing
- R2
- KV
- DNS
- CDN
- Cloudflare authentication
- Cloudflare deployment

이 문제들은 SC_Linked_App 또는 Infrastructure/Delivery 계층에서 해결한다.

Cloudflare 문제를 해결하기 위해 SC_WEP 코드를 수정해야 한다면 먼저 책임 경계 위반 여부를 검토한다.

## 17. SC_WEP 정적 정책 검사

SC_WEP release consumer 실행 코드 또는 runtime configuration에서 다음 문자열·의존성이 발견되면 정책 위반 후보로 판단한다.

- cloudflare
- wrangler
- r2
- turnstile
- cf-ray
- cloudflare access
- CLOUDFLARE_*
- CF_API_*

단, 다음 용도의 문서상 언급은 허용한다.

- 정책 설명
- 장애 evidence
- migration 기록
- 금지된 dependency 설명

실행 코드, runtime dependency, secret, configuration, fallback 구현으로 존재하는 것은 허용하지 않는다.

## 18. 최종 책임 구조

    SC_Linked_App
    │
    ├─ Canonical release authority
    ├─ Release catalog
    ├─ Download contract
    ├─ Public availability
    ├─ Browser accessibility
    └─ Production verification

    Infrastructure / Delivery
    │
    ├─ Provider 구성
    ├─ Routing
    ├─ Storage
    ├─ Security configuration
    └─ Canonical contract 전달 보장

    SC_WEP
    │
    ├─ Canonical HTTPS URL 호출
    ├─ Contract 검증
    ├─ Release UI 표시
    └─ API가 제공한 downloadUrl 사용

SC_WEP과 Infrastructure 사이에는 직접 dependency를 만들지 않는다.

## 19. 최종 원칙

Canonical release 기능은 다음 구조를 유지한다.

    Infrastructure
            ↓
    SC_Linked_App
    Canonical HTTPS Contract
            ↓
    SC_WEP

다음 구조는 허용하지 않는다.

    SC_WEP
       ↓
    Infrastructure Provider
       ↓
    Release Data

따라서 SC_WEP에서는 Cloudflare를 사용하지 않으며, Cloudflare뿐 아니라 특정 infrastructure provider에 대한 직접 또는 간접 의존도 생성하지 않는다.

Canonical HTTPS contract가 유지되는 한 infrastructure implementation이 무엇으로 변경되더라도 SC_WEP은 영향을 받지 않아야 한다.

이 원칙을 위반하는 provider-specific 코드, 설정, 인증, SDK, secret 및 fallback은 신규 추가를 금지하고 기존 구현이 발견되면 제거 대상으로 분류한다.
