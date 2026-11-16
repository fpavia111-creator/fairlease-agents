# Keystone 물류 에이전트

*Claude가 번역했으며 원어민 검토가 남아 있습니다. 영어 [README](README.md)가 기준입니다.*

운임과 배송 비용을 위한 작은 MCP 에이전트 30개입니다. 각 에이전트는 운임 청구서 감사, 월말 운임 미지급 계상, 운송사 지급 정산, 수입 신고 확인처럼 **한 가지 일**만 맡으며 그 밖에서는 움직일 수 없습니다. TMS, ERP, WMS, 운송사 포털, EDI 사업자에서 이미 내보내는 파일을 읽고, 고객의 컴퓨터에 보고서를 쓰며, 돈을 움직이거나 메시지를 보내거나 운영 시스템을 바꾸는 일 앞에서는 지정된 담당자를 기다립니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 의존성 없음

## 사용해 보기

```bash
npx -y polaris-of-bills demo        # 가상 데이터로 운임 청구 감사
npx -y procyon-of-accruals demo     # 가상 데이터로 운임 미지급 계상
```

각 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스로 확인하는 `eval`, Claude Desktop, Claude Code, Cursor 등 MCP 호스트용 MCP 서버(`npx -y <agent> mcp --root <폴더>`)가 있습니다. 현재 열 이름과 보고서는 영어입니다.

## 에이전트

**운송사 청구:** `polaris-of-bills`(FTL·LTL 청구서와 계약 대조), `sirius-of-parcels`(택배), `vega-of-detention`(대기 요금), `spica-of-fuel`(유류할증료), `betelgeuse-of-accessorials`(부대 비용의 원인), `bellatrix-of-reweighs`(재계량과 등급 변경), `algol-of-duplicates`(이중 지급), `adhara-of-ocean`(해상), `canopus-of-air`(항공), `alcor-of-pods`(배송 증빙), `fomalhaut-of-demurrage`(컨테이너 프리타임과 체선료), `antares-of-entries`(수입 신고와 상업 송장 대조, 품목 분류 자문 없음).

**계획, 구매, 운영:** `altair-of-bids`(입찰), `regulus-of-tariffs`(계약별 과거 실적 재계산), `nunki-of-quotes`(스팟 견적), `mizar-of-lanes`(노선별 지출과 합적), `rigel-of-scorecards`(운송사 성과표), `aldebaran-of-carriers`(사기 경고 신호), `mira-of-tracking`(지연 화물), `hadar-of-docks`(도크 예약), `deneb-of-cartons`(상자 크기), `arcturus-of-edi`(X12 파일 읽기와 대사).

**결산과 원가:** `procyon-of-accruals`(운임 미지급 계상), `castor-of-allocations`(주문·코스트센터별 운임 배부), `pollux-of-costing`(품목 원가의 운임 표준), `elnath-of-margins`(고객별 청구 운임과 실제 운임), `alnilam-of-settlements`(브로커용 운송사 지급), `capella-of-claims`(화물 사고 청구), `achernar-of-returns`(반품부터 환불까지), `shaula-of-emissions`(고객이 고른 계수로 배출량 추정).

## 안전 장치

- **에이전트별 허용 목록.** 각 에이전트는 자신의 도구만 호출할 수 있습니다.
- **거부하는 도구.** 지급, 이메일 발송, TMS 변경, 총계정원장 전기, 세관 신고는 이름을 지정해 차단합니다.
- **지정된 담당자의 클릭 한 번.** 지급, 발송, 운영 변경, 전표 승인은 Auto 모드에서도 지정된 담당자를 기다리며, 검토한 초안의 sha256에 묶입니다.
- **감사 로그**는 `.keystone/`에 해시 체인으로 기록되며, Ed25519 키를 설정하면 서명됩니다.
- **긴급 정지:** `<agent> kill`은 `<agent> unkill` 전까지 모든 도구를 멈춥니다.

## 한계

- 각 에이전트는 제공된 파일로만 작동하며 운송사, TMS, ERP, 은행, 정부 시스템에 로그인하지 않습니다.
- 법률·세무·통관·회계 자문이 아닙니다. 결정과 실행은 사람이 합니다.
