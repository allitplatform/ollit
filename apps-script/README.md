# Apps Script — 사장님 운영 시트 도구

## 파일

| 파일 | 용도 |
|---|---|
| `v14_week1_reset.gs` | V14 Week 1 (1A 설정_원청 7개 + 1C 작업번호 형식 + 1D 데이터 폐기) |

## 사용 (V14 Week 1 처음 박을 때)

1. **백업 사전 확인** — 사장님 운영 스프레드시트 = 어떤 시트인지 catch.
2. **Apps Script 에디터 열기** — 사장님 시트에서 `확장 → Apps Script`.
3. **`v14_week1_reset.gs` 내용 붙여넣기** — 새 파일 만들고 그대로 복사.
4. **`resetSheet_OllitV14_Week1_DryRun` 실행** — 변경 사항 알림창 → 캡처해서 사장님께 전달.
5. **사장님 승인** — DryRun 결과 OK 받고 진행.
6. **`resetSheet_OllitV14_Week1_Apply` 실행** — 백업 자동 + 변경 박힘.
7. **`_demo_generateTaskNumber` 실행** — 작업번호 형식 7개 원청 모두 검증.
8. **결과 캡처** — Logger 보고 + 시트 캡처.

## 안전 장치

- `Apply` 실행 전 자동으로 `_백업_시트명_YYYYMMDD_HHmmss` 사본 생성.
- 30일 지난 백업은 `cleanupOldBackups_OllitV14`로 정리.
- 모든 함수 = Logger.log + 알림창 보고 (실패 시 추적 가능).

## V14 헌법 v6 — 7개 원청 (코드 박혀있음)

| 약자 | id | 회사명 | 구분 | 색 |
|---|---|---|---|---|
| O | allday | 올데이케어 | 직영 | #FF1B8D |
| A | aircon_pro | 에어컨프로 (KA) | 직영 | #06B6D4 |
| K | coolguy | 쿨가이 (KB) | 직영 | #0891B2 |
| Y | yongin | 용인컴퍼니 | 직영 | #888780 |
| YS | usol_h | 유솔홈케어 H | 위탁 | #10B981 |
| YS-N | usol_n | 유솔홈케어 N | 위탁 | #03C75A |
| CK | crikrin | 크리크린 | 위탁 | #7F77DD |

## 작업번호 형식 (1C)

- 약자 + YYMMDD + `-` + 3자리 순번
- 예: `O260507-001`, `A260507-001`, `YS-N260507-001`
- 일별 순번 (날짜 바뀌면 001부터 리셋)
- `generateTaskNumber(principalId, dateStr)` 호출 = 작업DB 1열 카운트 → 다음 순번
