/**
 * V14 Week 1 — 1B 수수료정책 V6 (V5 11열 폐기 → V6 9열 박기)
 * 작성: 2026-05-07
 * 대상: 사장님 운영 스프레드시트 (활성 스프레드시트 / "수수료정책" 시트)
 *
 * 박는 내용:
 *   - V5 ~60 row 폐기 (세스코 포함 모두) — 헤더까지 clear
 *   - V6 새 9열 헤더 박기
 *   - V6 ~90 row 박기 (49 세척 + 28 냉매 + 7 출장비 + 3 유솔N 추가선택 + 3 유솔N 냉매점검)
 *   - 빈 셀은 비워둠 (사장님 직접 catch — 시스템멀티 기사단가/가짜단가 등)
 *
 * 안전 원칙:
 *   - 자동 백업 (`_백업_수수료정책_YYYYMMDD_HHmmss`)
 *   - DryRun 함수로 미리 보고 → 사장님 승인 후 Apply
 *   - 빈 셀 위치 정확히 보고 (사장님 catch 필요 부분)
 *
 * 사용:
 *   1) Apps Script 에디터에 새 파일 박기
 *   2) `createPolicyV6_DryRun` 실행 → 알림창 캡처해서 사장님께 전달
 *   3) 승인 후 `createPolicyV6_Apply` 실행
 *
 * 헌법 박힘 (V14 v6 명세):
 *   원청 7개 (O / A / K / Y / YS / YS-N / CK)
 *   기종 7개 (벽걸이 / 1way / 스탠드 / 4way / 원형 / 투인원 / 시스템멀티)
 *   작업유형 = 세척 / 냉매충전 / 출장비 / 추가선택(YS-N) / 냉매점검(YS-N)
 */

// ─────────────────────────────────────────────
// 상수 — 시트 / 헤더
// ─────────────────────────────────────────────
const POLICY_SHEET = '수수료정책';

const POLICY_V6_HEADER = [
  '원청', '작업유형', '기종', '평균판매가', '기사단가', '가짜단가',
  '원청수수료', '회사이익', '비고',
];

// ─────────────────────────────────────────────
// 상수 — 원청 7개
// ─────────────────────────────────────────────
const POLICY_PRINCIPALS = [
  { code: 'O',    name: '올데이케어',          cleaningType: '직영',   refrigType: '직영' },
  { code: 'A',    name: '에어컨프로 (KA)',      cleaningType: '가짜단가', refrigType: '예상비율10' },
  { code: 'K',    name: '쿨가이 (KB)',         cleaningType: '가짜단가', refrigType: '예상비율35' },
  { code: 'Y',    name: '용인컴퍼니',          cleaningType: '정액10K', refrigType: '정액10K' },
  { code: 'YS',   name: '유솔홈케어 H',         cleaningType: '비율15',  refrigType: '정액10K' },
  { code: 'YS-N', name: '유솔홈케어 N',         cleaningType: '유솔N15', refrigType: '특수' },
  { code: 'CK',   name: '크리크린',            cleaningType: '비율20',  refrigType: '비율20' },
];

// ─────────────────────────────────────────────
// 상수 — 기종 평균 판매가
// ─────────────────────────────────────────────
// 세척: 7 기종
const CLEANING_APPLIANCES = ['벽걸이', '1way', '스탠드', '4way', '원형', '투인원', '시스템멀티'];
const CLEANING_PRICE = {
  '벽걸이':     60000,
  '1way':       80000,
  '스탠드':    110000,
  '4way':      130000,
  '원형':      110000,
  '투인원':    160000,
  '시스템멀티':100000,
};

// 냉매충전: 4 기종 (1way / 원형은 빈 셀 — 사장님 catch)
const REFRIG_APPLIANCES = ['벽걸이', '스탠드', '4way', '투인원'];
const REFRIG_PRICE = {
  '벽걸이':  80000,
  '스탠드':  90000,
  '4way':   100000,
  '투인원': 100000,
};

// 기사 단가 (실제 / 모든 원청 동일) — 시스템멀티 빈 (사장님 catch)
const ENG_UNIT_PRICE = {
  '벽걸이':     40000,
  '1way':       50000,
  '스탠드':     60000,
  '4way':       70000,
  '원형':       80000,
  '투인원':    100000,
  '시스템멀티':null, // 빈 셀
};

// 가짜 단가 (KA/KB만 / 운영자 비밀) — 시스템멀티 빈
const FAKE_UNIT_PRICE = {
  '벽걸이':     50000,
  '1way':       60000,
  '스탠드':     70000,
  '4way':       80000,
  '원형':       90000,
  '투인원':    110000,
  '시스템멀티':null, // 빈 셀
};

// 냉매충전 기사 단가 (= 평균판매가 × 50% / 모든 원청 공통)
function _refrigEngAmount_(price) {
  return price ? Math.round(price * 0.5) : null;
}

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
function _v14p_timestamp_() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function _v14p_blank_(v) {
  return v == null ? '' : v;
}

// ─────────────────────────────────────────────
// 1. 세척 49 row 생성 (7 원청 × 7 기종)
// ─────────────────────────────────────────────
function _buildCleaningRows_() {
  const rows = [];
  POLICY_PRINCIPALS.forEach((p) => {
    CLEANING_APPLIANCES.forEach((app) => {
      const sale     = CLEANING_PRICE[app];
      const eng      = ENG_UNIT_PRICE[app];     // null = 시스템멀티
      const fake     = FAKE_UNIT_PRICE[app];    // null = 시스템멀티
      const showFake = (p.code === 'A' || p.code === 'K') ? fake : null;

      let principalFee = null, engineerAmt = null, companyProfit = null, note = '';

      if (p.code === 'O') {
        // O 올데이 — 직영 (수수료 0)
        principalFee  = 0;
        engineerAmt   = eng;  // 기사단가
        companyProfit = (eng != null) ? sale - eng : null;
        note = '직영 (수수료 0)';
      }
      else if (p.code === 'A' || p.code === 'K') {
        // KA / KB — 차감후비율 (가짜단가)
        if (fake != null && eng != null) {
          principalFee  = Math.round((sale - fake) * 0.5);
          engineerAmt   = eng; // 실제 단가 (운영자 비밀)
          companyProfit = sale - principalFee - engineerAmt;
        }
        note = `(판매가 - 가짜단가) × 50% / 기사 = 실제 단가${(p.code === 'A') ? ' (KA)' : ' (KB)'}`;
      }
      else if (p.code === 'Y') {
        // Y 용인 — 정액 10K
        principalFee  = 10000;
        engineerAmt   = eng;
        companyProfit = (eng != null) ? sale - 10000 - eng : null;
        note = '정액 10K';
      }
      else if (p.code === 'YS') {
        // YS 유솔H — 비율 15%
        principalFee  = Math.round(sale * 0.15);
        engineerAmt   = eng;
        companyProfit = (eng != null) ? sale - principalFee - eng : null;
        note = '비율 15%';
      }
      else if (p.code === 'YS-N') {
        // YS-N 유솔N — 비율 15% / 기사 = 기사단가 × 1.10 (부가세 별도)
        principalFee  = Math.round(sale * 0.15);
        engineerAmt   = (eng != null) ? Math.round(eng * 1.10) : null;
        companyProfit = (engineerAmt != null) ? sale - principalFee - engineerAmt : null;
        note = '비율 15% / 기사 = 기사단가 × 1.10 (예: 벽걸이 44K)';
      }
      else if (p.code === 'CK') {
        // CK 크리크린 — 비율 20%
        principalFee  = Math.round(sale * 0.20);
        engineerAmt   = eng;
        companyProfit = (eng != null) ? sale - principalFee - eng : null;
        note = '비율 20%';
      }

      rows.push([
        p.name, '세척', app,
        sale,
        _v14p_blank_(eng),
        _v14p_blank_(showFake),
        _v14p_blank_(principalFee),
        _v14p_blank_(companyProfit),
        note,
      ]);
    });
  });
  return rows;
}

// ─────────────────────────────────────────────
// 2. 냉매충전 28 row 생성 (7 원청 × 4 기종)
// ─────────────────────────────────────────────
function _buildRefrigRows_() {
  const rows = [];
  POLICY_PRINCIPALS.forEach((p) => {
    REFRIG_APPLIANCES.forEach((app) => {
      const sale = REFRIG_PRICE[app];
      const eng  = _refrigEngAmount_(sale); // 기사 50% (모든 원청 공통, YS-N 제외)
      let principalFee = null, engineerAmt = null, companyProfit = null, note = '';

      if (p.code === 'O') {
        principalFee  = 0;
        engineerAmt   = eng;
        companyProfit = sale - eng; // 50%
        note = '직영 / 기사 50% / 회사 50%';
      }
      else if (p.code === 'A') {
        // KA — 예상금액비율 10%
        principalFee  = Math.round(sale * 0.10);
        engineerAmt   = eng;
        companyProfit = sale - principalFee - eng;
        note = 'KA 가스 / 원청 10% / 기사 50% / 회사 40%';
      }
      else if (p.code === 'K') {
        // KB — 예상금액비율 35%
        principalFee  = Math.round(sale * 0.35);
        engineerAmt   = eng;
        companyProfit = sale - principalFee - eng;
        note = 'KB 가스 / 원청 35% / 기사 50% / 회사 15%';
      }
      else if (p.code === 'Y') {
        principalFee  = 10000;
        engineerAmt   = eng;
        companyProfit = sale - 10000 - eng;
        note = '정액 10K / 기사 50% / 회사 나머지';
      }
      else if (p.code === 'YS') {
        principalFee  = 10000;
        engineerAmt   = eng;
        companyProfit = sale - 10000 - eng;
        note = '정액 10K / 기사 50% / 회사 나머지';
      }
      else if (p.code === 'YS-N') {
        // YS-N 냉매 = 특수 (별도 row 3건 — 냉매점검 기본/추가발생/출장비)
        principalFee  = null;
        engineerAmt   = null;
        companyProfit = null;
        note = '특수 — 유솔N 냉매점검 row 참조 (기본/추가발생/출장비)';
      }
      else if (p.code === 'CK') {
        principalFee  = Math.round(sale * 0.20);
        engineerAmt   = eng;
        companyProfit = sale - principalFee - eng;
        note = '비율 20% / 기사 50% / 회사 30%';
      }

      rows.push([
        p.name, '냉매충전', app,
        sale,
        _v14p_blank_(engineerAmt),
        '', // 가짜단가 = 냉매에는 X
        _v14p_blank_(principalFee),
        _v14p_blank_(companyProfit),
        note,
      ]);
    });
  });
  return rows;
}

// ─────────────────────────────────────────────
// 3. 출장비 7 row (모든 원청 / 30K / 기사 100%)
// ─────────────────────────────────────────────
function _buildTravelFeeRows_() {
  const rows = [];
  POLICY_PRINCIPALS.forEach((p) => {
    rows.push([
      p.name, '출장비', '(공통)',
      30000,    // 평균판매가 = 출장비 30K
      30000,    // 기사단가 = 30K (100%)
      '',       // 가짜단가 X
      0,        // 원청수수료 = 0
      0,        // 회사이익 = 0
      '기사 100% (모든 원청 공통)',
    ]);
  });
  return rows;
}

// ─────────────────────────────────────────────
// 4. 유솔N 추가선택 3 row
//    송풍팬분해 / 실외기 / 피톤치드 — 기사 85% / 원청 15% / 회사 0%
// ─────────────────────────────────────────────
function _buildUsolNAddOnRows_() {
  const items = ['송풍팬분해', '실외기', '피톤치드'];
  return items.map((label) => [
    '유솔홈케어 N', '추가선택(YS-N)', label,
    '',  // 평균판매가 = 빈 (사장님 catch — 시트별 가격)
    '',  // 기사단가 = 빈 (= 판매가 × 85% / 시트 catch 후)
    '',  // 가짜단가 X
    '',  // 원청수수료 = 빈 (= 판매가 × 15%)
    0,   // 회사이익 = 0
    '기사 85% / 원청 15% / 회사 0% (기사 동기 부여)',
  ]);
}

// ─────────────────────────────────────────────
// 5. 유솔N 냉매점검 3 row
//    기본 / 추가발생 / 출장비 — AG전체_AD반반 케이스
// ─────────────────────────────────────────────
function _buildUsolNRefrigCheckRows_() {
  return [
    [
      '유솔홈케어 N', '냉매점검(YS-N)', '기본',
      10000,   // 평균판매가 = 네이버 1만원
      0,       // 기사단가 = 0 (유솔 100%)
      '',      // 가짜단가 X
      10000,   // 원청수수료 = 10K (유솔 100%)
      0,       // 회사이익 = 0
      '유솔 100% / 기사 0 / 회사 0 (네이버 기본 1만원)',
    ],
    [
      '유솔홈케어 N', '냉매점검(YS-N)', '추가발생',
      '',      // 평균판매가 = variable (현장 추가 발생분)
      '',      // 기사단가 = 50% (사장님 catch)
      '',      // 가짜단가 X
      0,       // 원청수수료 = 0 (원청 X)
      '',      // 회사이익 = 50% (사장님 catch)
      '기사 50% + 회사 50% (원청 X) — 현장 추가 발생분',
    ],
    [
      '유솔홈케어 N', '냉매점검(YS-N)', '출장비',
      30000,   // 작업 불가 시 출장비 3만원
      30000,   // 기사 100%
      '',
      0,
      0,
      '기사 100% (작업 불가 시 출장비 3만원)',
    ],
  ];
}

// ─────────────────────────────────────────────
// 모든 row 합치기 (~90 row)
// ─────────────────────────────────────────────
function _buildAllPolicyRows_() {
  const cleaning      = _buildCleaningRows_();         // 49
  const refrig        = _buildRefrigRows_();           // 28
  const travel        = _buildTravelFeeRows_();        // 7
  const usolNAddOn    = _buildUsolNAddOnRows_();       // 3
  const usolNRefrigCk = _buildUsolNRefrigCheckRows_(); // 3
  return [
    ...cleaning,
    ...refrig,
    ...travel,
    ...usolNAddOn,
    ...usolNRefrigCk,
  ];
}

// ─────────────────────────────────────────────
// 빈 셀 위치 보고
// ─────────────────────────────────────────────
function _detectBlankCells_(rows) {
  const blanks = [];
  rows.forEach((row, idx) => {
    POLICY_V6_HEADER.forEach((col, cIdx) => {
      const v = row[cIdx];
      if (v === '' && col !== '가짜단가' /* 가짜단가는 KA/KB 외 일반 빈 = 정상 */) {
        const principal  = row[0];
        const workType   = row[1];
        const appliance  = row[2];
        blanks.push(`  · row ${idx + 2} [${principal} / ${workType} / ${appliance}] · ${col} 빈`);
      }
    });
  });
  return blanks;
}

// ─────────────────────────────────────────────
// 1. DryRun — 변경 사항 보고 (시트 변경 X)
// ─────────────────────────────────────────────
function createPolicyV6_DryRun() {
  const ss = SpreadsheetApp.getActive();
  const lines = [];
  lines.push('━━━ V14 Week 1 — 1B 수수료정책 V6 DRY RUN ━━━');
  lines.push(`스프레드시트: ${ss.getName()}`);
  lines.push(`실행 시각: ${_v14p_timestamp_()}`);
  lines.push('');

  // V5 현재 상태
  lines.push('━━━ V5 현재 상태 ━━━');
  const sheet = ss.getSheetByName(POLICY_SHEET);
  if (!sheet) {
    lines.push(`  ⚠️ ${POLICY_SHEET} 시트 없음 — Apply 시 신규 생성됨`);
  } else {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const header  = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    lines.push(`  현재: ${lastRow} row × ${lastCol} col`);
    lines.push(`  현재 헤더: ${JSON.stringify(header)}`);
    lines.push(`  변경 후: 헤더 9열 + V6 row (V5 폐기)`);
  }
  lines.push('');

  // V6 row 생성 + 카운트
  const rows = _buildAllPolicyRows_();
  const cleaningCount = _buildCleaningRows_().length;
  const refrigCount   = _buildRefrigRows_().length;
  const travelCount   = _buildTravelFeeRows_().length;
  const addOnCount    = _buildUsolNAddOnRows_().length;
  const refrigCkCount = _buildUsolNRefrigCheckRows_().length;

  lines.push('━━━ V6 새 헤더 (9열) ━━━');
  lines.push(`  ${JSON.stringify(POLICY_V6_HEADER)}`);
  lines.push('');

  lines.push('━━━ V6 row 생성 ━━━');
  lines.push(`  세척         : ${cleaningCount} row (7 원청 × 7 기종)`);
  lines.push(`  냉매충전     : ${refrigCount} row (7 원청 × 4 기종 / YS-N 특수)`);
  lines.push(`  출장비       : ${travelCount} row (7 원청 / 모든 원청 공통)`);
  lines.push(`  유솔N 추가선택: ${addOnCount} row (송풍팬분해 / 실외기 / 피톤치드)`);
  lines.push(`  유솔N 냉매점검: ${refrigCkCount} row (기본 / 추가발생 / 출장비)`);
  lines.push(`  ─────────────────────────`);
  lines.push(`  합계: ${rows.length} row`);
  lines.push('');

  // 빈 셀 위치 보고
  const blanks = _detectBlankCells_(rows);
  lines.push('━━━ 빈 셀 (사장님 catch 필요) ━━━');
  if (blanks.length === 0) {
    lines.push('  · 빈 셀 X (모두 박힘)');
  } else {
    lines.push(`  총 ${blanks.length} 셀 — 사장님 시트에서 직접 입력 필요:`);
    blanks.slice(0, 30).forEach((b) => lines.push(b));
    if (blanks.length > 30) {
      lines.push(`  · ... 외 ${blanks.length - 30} 셀`);
    }
  }
  lines.push('');

  // 백업 예정
  lines.push('━━━ [백업] Apply 실행 시 자동 생성 ━━━');
  lines.push(`  _백업_${POLICY_SHEET}_${_v14p_timestamp_()}`);
  lines.push('');

  // V6 데이터 sample (첫 5 row)
  lines.push('━━━ V6 데이터 sample (첫 5 row) ━━━');
  rows.slice(0, 5).forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r.map(v => v === '' ? '_' : v).join(' | ')}`);
  });
  lines.push('  ...');
  lines.push('');

  lines.push('━━━ DRY RUN 끝. 변경 X. createPolicyV6_Apply 호출 시 박힘. ━━━');

  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert(
      'V14 1B 수수료정책 V6 DRY RUN',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // UI 없는 환경 — Logger.log만
  }
  return report;
}

// ─────────────────────────────────────────────
// 2. Apply — 실제 적용 (백업 → V5 폐기 → V6 박기)
// ─────────────────────────────────────────────
function createPolicyV6_Apply() {
  const ss = SpreadsheetApp.getActive();
  const ts = _v14p_timestamp_();
  const lines = [];
  lines.push('━━━ V14 Week 1 — 1B 수수료정책 V6 APPLY 시작 ━━━');
  lines.push(`스프레드시트: ${ss.getName()}`);
  lines.push(`실행 시각: ${ts}`);
  lines.push('');

  // [백업]
  lines.push('━━━ [백업] 수수료정책 사본 ━━━');
  let sheet = ss.getSheetByName(POLICY_SHEET);
  if (sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 0) {
      const backupName = `_백업_${POLICY_SHEET}_${ts}`;
      const copy = sheet.copyTo(ss);
      copy.setName(backupName);
      lines.push(`  ✓ ${backupName} (${lastRow} row)`);
    } else {
      lines.push(`  · 빈 시트 — 백업 생략`);
    }
  } else {
    lines.push(`  ⚠️ ${POLICY_SHEET} 시트 없음 — 백업 X (신규 생성됨)`);
  }
  lines.push('');

  // [V5 폐기]
  lines.push('━━━ [V5 폐기] 모든 row clear (헤더 포함) ━━━');
  if (!sheet) {
    sheet = ss.insertSheet(POLICY_SHEET);
    lines.push(`  ✓ 시트 신규 생성: ${POLICY_SHEET}`);
  } else {
    sheet.clear();
    lines.push(`  ✓ 기존 V5 ~60 row clear`);
  }
  lines.push('');

  // [V6 헤더 박기]
  lines.push('━━━ [V6 헤더 9열 박기] ━━━');
  sheet.getRange(1, 1, 1, POLICY_V6_HEADER.length).setValues([POLICY_V6_HEADER]);
  sheet.getRange(1, 1, 1, POLICY_V6_HEADER.length)
    .setFontWeight('bold')
    .setBackground('#F5F2ED');
  lines.push(`  ✓ ${JSON.stringify(POLICY_V6_HEADER)}`);
  lines.push('');

  // [V6 데이터 박기]
  lines.push('━━━ [V6 데이터 박기] ━━━');
  const rows = _buildAllPolicyRows_();
  sheet.getRange(2, 1, rows.length, POLICY_V6_HEADER.length).setValues(rows);

  // 시각 분리 — 작업유형별 옅은 배경
  const tagColor = {
    '세척':           '#FFF4FA', // 옅은 핑크
    '냉매충전':       '#FFF8EC', // 옅은 노랑
    '출장비':         '#F0F0F0', // 옅은 회색
    '추가선택(YS-N)': '#E8F8EE', // 옅은 그린
    '냉매점검(YS-N)': '#E8F8EE', // 옅은 그린
  };
  rows.forEach((r, i) => {
    const bg = tagColor[r[1]];
    if (bg) {
      sheet.getRange(2 + i, 1, 1, POLICY_V6_HEADER.length).setBackground(bg);
    }
  });

  // 빈 셀 강조 — 옅은 빨강 배경
  rows.forEach((r, i) => {
    POLICY_V6_HEADER.forEach((col, c) => {
      if (r[c] === '' && col !== '가짜단가') {
        sheet.getRange(2 + i, c + 1).setBackground('#FFE8E8'); // 옅은 빨강 = 사장님 catch
      }
    });
  });

  sheet.autoResizeColumns(1, POLICY_V6_HEADER.length);
  lines.push(`  ✓ ${rows.length} row 박힘 (49 세척 + 28 냉매 + 7 출장비 + 3 추가선택 + 3 냉매점검)`);
  lines.push('');

  // 빈 셀 보고
  const blanks = _detectBlankCells_(rows);
  lines.push('━━━ 빈 셀 (옅은 빨강 배경 — 사장님 직접 입력) ━━━');
  if (blanks.length === 0) {
    lines.push('  · 빈 셀 X');
  } else {
    lines.push(`  총 ${blanks.length} 셀:`);
    blanks.slice(0, 30).forEach((b) => lines.push(b));
    if (blanks.length > 30) {
      lines.push(`  · ... 외 ${blanks.length - 30} 셀 (시트 보면서 catch)`);
    }
  }
  lines.push('');

  lines.push('━━━ V14 1B APPLY 완료 ━━━');
  lines.push(`다음: 1D AdminApp 작업 입력 폼 / 1E API`);

  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert(
      'V14 1B 수수료정책 V6 APPLY 완료',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // 무시
  }
  return report;
}
