# Keystone 부동산 관리 에이전트

부동산 관리를 위한 작은 MCP 에이전트 30개입니다. 상업용 부동산과 중간 규모 주거용 부동산을 관리하는 회사를 위해 만들었습니다. 각 에이전트는 **한 가지 일만** 맡습니다. 예를 들어 렌트롤을 임대차 계약과 대조하기, 예치금 계좌 대사, 공용 관리비(CAM) 재계산, 임차인 보험 증명서 독촉 같은 일입니다. 맡은 일 밖의 일은 할 수 없습니다. AppFolio, Yardi, Buildium, Rent Manager 등에서 이미 내보내는 파일을 읽고, 보고서를 사용자 컴퓨터에 저장하며, 돈을 움직이거나 메시지를 보내거나 운영 시스템을 바꾸는 일 앞에서는 이름이 확인된 담당자를 기다립니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 사용 · 인증 정보 불필요 · 의존성 없음

다른 언어: [English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) (Claude가 번역함, 원어민 검토 대기 중)

## 사용해 보기

이 저장소를 받은 위치에서:

```bash
npm ci
node packages/granite-of-rentrolls/bin/granite-of-rentrolls.js demo     # 렌트롤과 계약 요약 대조, 가상 데이터
node packages/obsidian-of-trust/bin/obsidian-of-trust.js demo           # 예치금 계좌 3자 대사, 가상 데이터
```

패키지가 npm에 올라간 뒤에는 `npx -y granite-of-rentrolls demo`로도 됩니다. 모든 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스로 확인하는 `eval`, 파일의 열을 어떻게 읽었는지 보여 주는 `inspect <파일>`, 그리고 Claude Desktop, Claude Code, Cursor 등 MCP 호스트용 MCP 서버(`<agent> mcp --root <폴더>`)가 있습니다. `--lang ko`를 주면 보고서가 한국어로 나옵니다(9개 언어 지원). 각 에이전트의 README에 도구 목록이 있습니다.

## 에이전트

**렌트롤, 임대차 계약, 수입**

| 에이전트 | 하는 일 | 절대 하지 않는 일(차단) |
|---|---|---|
| [`granite-of-rentrolls`](packages/granite-of-rentrolls) | 렌트롤을 계약 요약과 호실별로 대조: 임대료, 단계별 인상, 날짜, 보증금, 면적, 임차인, 공실, 계약 만료 후 계속 거주 | 관리 시스템 변경, 청구 기록 |
| [`slate-of-leases`](packages/slate-of-leases) | 상업용 임대차 계약을 조항별로 출처와 함께 요약하고, 기존 요약을 원문과 대조 | 시스템 변경, 서명 요청 발송 |
| [`jade-of-escalations`](packages/jade-of-escalations) | 청구된 임대료를 각 계약의 인상 일정(고정 단계, 비율, 하한과 상한이 있는 물가지수)과 대조. 다가오는 인상 목록 | 청구 기록 |
| [`garnet-of-renewals`](packages/garnet-of-renewals) | 갱신이 다가오는 계약, 제안 기한, 사용자가 정한 상한 안의 임대료 제안, 갱신 제안서 초안 | 서명 요청이나 이메일 발송 |
| [`shale-of-vacancy`](packages/shale-of-vacancy) | 렌트롤에서 점유율, 계약률, 노출, 공실 손실, 시장 임대료 대비 손실 산출 | 시스템 변경, 매물 게시 |
| [`talc-of-overage`](packages/talc-of-overage) | 임차인 매출 보고서로 매출 연동 임대료 계산, 늦거나 빠진 보고서, 정산서 초안 | 청구 기록, 매출 감사 시작 |
| [`feldspar-of-estoppels`](packages/feldspar-of-estoppels) | 매각이나 재융자 전에 회신된 임차인 확인서(에스토펠)를 계약 요약과 대조 | 서명 요청 발송, 데이터룸 업로드 |
| [`zircon-of-diligence`](packages/zircon-of-diligence) | 매입이나 대출 전에 매도인의 렌트롤을 최근 12개월 수입과 대조 | 매수 제안 제출, 데이터룸 업로드 |
| [`tourmaline-of-migration`](packages/tourmaline-of-migration) | 전환 시점에 구 시스템과 새 시스템의 렌트롤 비교: 호실, 임차인, 임대료, 보증금, 잔액, 날짜, 맞지 않는 합계 | 운영 전환 승인, 구 데이터 삭제 |

**입주자, 임대 마케팅, 수납**

| 에이전트 | 하는 일 | 절대 하지 않는 일(차단) |
|---|---|---|
| [`quartz-of-delinquency`](packages/quartz-of-delinquency) | 연체 경과표나 임차인 원장을 사용자 정책의 단계에 따른 작업 목록으로 정리, 연체료 확인, 독촉문 초안 | 법적 통지 송달, 명도 소송 제기, 신용평가기관 보고 |
| [`jasper-of-deposits`](packages/jasper-of-deposits) | 퇴거 보증금을 사용자 규칙(기한, 내역, 통상 마모, 내용연수)과 대조. 정산서 초안 | 환불, 채권 추심 이관 |
| [`amber-of-insurance`](packages/amber-of-insurance) | 임차인 보험 증명서를 계약이 요구하는 한도, 추가 피보험자, 기간과 대조 | 대리 보험 가입, 계약 위반 통지 송달 |
| [`topaz-of-utilities`](packages/topaz-of-utilities) | 공과금 배분(RUBS)을 사용자 방식으로 재계산. 과다 회수, 공실 호실 청구, 급증 | 청구 기록, 공급사 포털 변경 |
| [`cobalt-of-listings`](packages/cobalt-of-listings) | 여러 사이트의 매물 광고를 렌트롤과 대조. 문구는 사람이 검토하도록 표시만 함 | 매물 게시, 제시 임대료 변경, 문의 답장 |
| [`mica-of-leads`](packages/mica-of-leads) | 방문 카드로 임대 퍼널 분석: 느리거나 없는 응답, 후속 연락 기한, 유입 경로별 계약 전환율과 계약당 비용 | 입주 신청 결정, 신용 조사 실행, 예비 임차인에게 문자 발송 |
| [`malachite-of-recerts`](packages/malachite-of-recerts) | 공공·저렴 주택 재인증 날짜와 통지를 사용자 정책 파일의 일정과 대조. 날짜만 다룸 | 가구 인증, 기관 제출, 임대료 변경 |
| [`lapis-of-payouts`](packages/lapis-of-payouts) | Airbnb, Vrbo 등 단기 임대 정산금을 예약 및 은행 입금과 대조 | 게스트 환불, 소유주 지급, 채널 매물 변경 |

**소유주, 예치금 계좌, 회계**

| 에이전트 | 하는 일 | 절대 하지 않는 일(차단) |
|---|---|---|
| [`obsidian-of-trust`](packages/obsidian-of-trust) | 3자 대사: 은행 명세서, 장부 기록, 소유주 및 임차인 원장 | 자금 이체, 수표 무효화, 총계정원장 기장 |
| [`onyx-of-statements`](packages/onyx-of-statements) | 발송 전 소유주 보고서 점검: 계산, 이월, 유보금, 송금 | 소유주 지급, 보고서 게시 |
| [`pyrite-of-fees`](packages/pyrite-of-fees) | 관리 수수료, 임대 수수료, 가산 수수료를 각 관리 위탁 계약으로 재계산 | 소유주 대변 기록, 수수료 설정 변경 |
| [`marble-of-cam`](packages/marble-of-cam) | 공용 관리비(CAM) 정산: 비용 풀, 분담 비율, 점유율 보정, 상한, 기준 연도, 관리 수수료 | 청구 기록, 시스템 변경 |
| [`beryl-of-budgets`](packages/beryl-of-budgets) | 예산 대비 실적, 계약상 설명해야 하는 차이, 연말 전망, 소유주용 메모 초안 | 예산 변경, 총계정원장 기장 |
| [`pearl-of-filings`](packages/pearl-of-filings) | 미국 1099 양식 준비: 사용자가 정한 기준액 대비 수취인별 합계, 누락되거나 형식이 틀린 납세자 번호와 주소. 납세자 번호는 항상 가림 | 1099 제출, 납세자 번호 조회 신청, 원천징수 시작 |
| [`coral-of-associations`](packages/coral-of-associations) | 관리단(HOA, 집합건물) 소유자 계정을 사용자 부과·징수 정책과 대조. 위반 사항을 통지 단계와 대조 | 유치권 등기, 과태료 부과 |
| [`chert-of-taxes`](packages/chert-of-taxes) | 재산세 평가, 분납, 사용자가 입력한 이의신청 기한. 납부 일정 달력 | 이의신청 제출, 세금 납부 |

**운영과 협력업체**

| 에이전트 | 하는 일 | 절대 하지 않는 일(차단) |
|---|---|---|
| [`agate-of-workorders`](packages/agate-of-workorders) | 미완료 작업 지시를 목표 기한 대비 경과 관리. 반복 문제, 일반 건으로 접수된 긴급 건, 느린 업체 | 업체 배정, 청구서 승인, 작업 지시 종료 |
| [`basalt-of-turns`](packages/basalt-of-turns) | 퇴거부터 입주까지의 원상 복구: 일수, 공종별 비용, 임차인 청구 항목, 잃은 임대료 | 업체 배정, 청구 기록 |
| [`flint-of-inspections`](packages/flint-of-inspections) | 퇴거 점검과 입주 점검을 항목별로 비교. 기한이 지난 점검, 작업 지시 없는 불량 항목 | 청구 기록, 업체 배정 |
| [`gypsum-of-capex`](packages/gypsum-of-capex) | 자본 프로젝트를 예산, 약정액, 일정, 적립금과 대조 | 변경 계약이나 청구서 승인 |
| [`opal-of-vendors`](packages/opal-of-vendors) | 협력업체의 보험, 면허, 세금 서류를 사용자 요건과 대조. 요건 미충족 기간의 지급 | 청구서 승인, 업체 상태 변경 |

## 안전 장치

- **에이전트별 허용 목록.** 각 에이전트는 자기 도구만 호출할 수 있습니다. 모델이 지어낸 도구를 포함해 나머지는 모두 차단됩니다.
- **거부하는 도구.** 각 에이전트는 맡은 일과 가까운 실제 작업(환불, 청구, 명도, 신고, 이메일 발송)을 이름으로 지정해 차단하고, 모델이 요청하면 분명하게 거절합니다.
- **이름이 남는 한 번의 클릭.** 초안 발송, 에이전트가 기억할 내용 승인, 운영 전환 승인은 Auto 모드에서도 이름이 확인된 담당자를 기다립니다. 승인은 검토한 초안의 sha256에 묶이며, 초안이 바뀌면 승인이 더 이상 맞지 않습니다.
- **감사 로그.** 모든 호출은 `.keystone/` 아래 해시 체인 로그에 기록되고, 키를 설정하면 Ed25519로 서명됩니다.
- **비상 정지.** `<agent> kill`은 `<agent> unkill` 전까지 모든 도구를 멈춥니다.
- **악의적 입력 테스트.** 스프레드시트 수식, HTML, 경로 조작, 모델을 겨냥한 문장을 모든 에이전트의 데이터에 심어 확인합니다(`npm run hostile`).
- **개인정보 최소화.** 납세자 번호는 모든 보고서에서 가려집니다. 감사 로그는 인수 자체가 아니라 해시를 저장하며, 에이전트는 파일 사본을 보관하지 않습니다.

## Claude Code에서 사용하기

이 저장소는 Claude Code 플러그인 마켓플레이스입니다. 각 에이전트는 `npx`로 MCP 서버를 시작하는 플러그인입니다:

```text
/plugin marketplace add <이 저장소의 경로 또는 git URL>
/plugin install granite-of-rentrolls@keystone-property
```

플러그인은 `npx -y <agent>@<version>`을 시작하므로 해당 버전이 npm에 있어야 합니다. 그 전까지는 로컬 사본에서 추가하세요:

```bash
claude mcp add granite-of-rentrolls -- node /path/to/keystone-agents/packages/granite-of-rentrolls/bin/granite-of-rentrolls.js mcp --root .
```

## 개발

```bash
npm ci
npm test                       # 모든 패키지의 테스트와 eval
npm run hostile                # 모든 에이전트에 악의적 입력 심기
npm run bench                  # 1,000행과 10,000행 처리 시간
npm run plugin:check           # 플러그인 파일과 패키지 일치 확인
npm run intl                   # 다른 8개 시장 형식의 파일로 모든 eval 재실행
npm run mcp:check              # 공식 MCP SDK 클라이언트로 모든 에이전트 확인
npm run release:check:offline  # 패키지 내용, 라이선스, 문서, 버전
```

CI는 Node 20, 22, 24와 Linux, Windows에서 실행됩니다.

## 한계

- 각 에이전트는 사용자가 준 파일로만 작업합니다. 관리 시스템, 은행, 매물 사이트, 예약 채널, 공공기관에 로그인하지 않습니다.
- 이름이 붙은 내보내기 형식은 해당 시스템의 내보내기에 대한 지식으로 작성했으며 실제 계정에서 확인하지 않았습니다. 머리글이 다르면 `inspect`가 매칭 결과를 보여 주고, `keystone-sources.json`으로 열을 직접 지정할 수 있습니다.
- 결과는 그 파일들만큼만 정확합니다. 각 보고서는 무엇을 가정했는지 밝힙니다.
- 법률, 세무, 회계 자문이 아니며 광고가 적법한지도 판단하지 않습니다. 기준액, 기한, 수수료 규칙은 사용자 정책 파일에서 가져옵니다. 결정하고 실행하는 것은 사람입니다.
