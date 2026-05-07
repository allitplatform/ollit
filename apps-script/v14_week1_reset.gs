/**
 * V14 Week 1 — 시트 새 시작 (1A + 1C + 1D)
 * 작성: 2026-05-07
 * 대상: 사장님 운영 스프레드시트 (활성 스프레드시트)
 *
 * 박는 내용:
 *   1A. 설정_원청 7개 row 초기화 (세스코 폐기 / KA·KB 분리)
 *   1C. 작업번호 형식 = 약자 + YYMMDD-NNN (예: A260507-001)
 *   1D. 작업DB / 작업내역DB / 기사휴무DB / 취소DB 데이터 row 모두 삭제 (헤더 유지)
 *
 * 안전 원칙:
 *   - 모든 변경 = 백업 시트 자동 생성 후 (`_백업_시트명_YYYYMMDD_HHmmss`)
 *   - DryRun 함수로 변경 사항 미리 확인 → 사장님 승인 후 Apply
 *   - 시트 이름 catch (한글 정확)
 *
 * 사용:
 *   1) Apps Script 에디터에 이 파일 붙여넣기
 *   2) `resetSheet_OllitV14_Week1_DryRun` 실행 → 알림창 보고 사장님께 전달
 *   3) 승인 후 `resetSheet_OllitV14_Week1_Apply` 실행
 *   4) `_demo_generateTaskNumber` 실행해서 작업번호 형식 검증
 */

// ─────────────────────────────────────────────
// 상수: V14 헌법 v6 — 7개 원청 (사장님 spec)
// ─────────────────────────────────────────────
const V14_PRINCIPALS_HEADER = ['약자', 'id', '회사명', '구분', '색', '비고'];

const V14_PRINCIPALS_ROWS = [
  ['O',     'allday',     '올데이케어',         '직영', '#FF1B8D', '직영 - 자체 운영'],
  ['A',     'aircon_pro', '에어컨프로 (KA)',    '직영', '#06B6D4', '직영 - 가짜단가 적용'],
  ['K',     'coolguy',    '쿨가이 (KB)',        '직영', '#0891B2', '직영 - 가짜단가 적용'],
  ['Y',     'yongin',     '용인컴퍼니',         '직영', '#888780', '직영 - 정액 10K'],
  ['YS',    'usol_h',     '유솔홈케어 H',       '위탁', '#10B981', '위탁 - 현금 / 15%'],
  ['YS-N',  'usol_n',     '유솔홈케어 N',       '위탁', '#03C75A', '위탁 - 네이버 / 특수'],
  ['CK',    'crikrin',    '크리크린',           '위탁', '#7F77DD', '위탁 - 20%'],
];

// id → 약자 매핑 (generateTaskNumber에서 사용)
const V14_PRINCIPAL_PREFIX_MAP = {
  allday:     'O',
  aircon_pro: 'A',
  coolguy:    'K',
  yongin:     'Y',
  usol_h:     'YS',
  usol_n:     'YS-N',
  crikrin:    'CK',
};

// 데이터 row 폐기 대상 시트 (헤더만 유지)
const V14_DATA_SHEETS_TO_CLEAR = [
  '작업DB',
  '작업내역DB',
  '기사휴무DB',
  '취소DB',
];

const V14_PRINCIPALS_SHEET = '설정_원청';

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
function _v14_timestamp_() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function _v14_getSheetSafe_(ss, name) {
  const sheet = ss.getSheetByName(name);
  return sheet; // null 가능 — 호출부에서 처리
}

function _v14_getDataRowCount_(sheet) {
  if (!sheet) return 0;
  const last = sheet.getLastRow();
  return Math.max(0, last - 1); // 헤더 1행 빼고
}

function _v14_getHeader_(sheet) {
  if (!sheet) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

// ─────────────────────────────────────────────
// 1. DryRun — 변경 사항 보고 (시트 변경 X)
// ─────────────────────────────────────────────
function resetSheet_OllitV14_Week1_DryRun() {
  const ss = SpreadsheetApp.getActive();
  const lines = [];
  lines.push('━━━ V14 Week 1 — DRY RUN ━━━');
  lines.push(`스프레드시트: ${ss.getName()}`);
  lines.push(`실행 시각: ${_v14_timestamp_()}`);
  lines.push('');

  // [1A] 설정_원청 변경
  lines.push('━━━ [1A] 설정_원청 ━━━');
  const principalsSheet = _v14_getSheetSafe_(ss, V14_PRINCIPALS_SHEET);
  if (!principalsSheet) {
    lines.push(`  ⚠️ 시트 없음 — Apply 시 신규 생성됨`);
  } else {
    const curRow = principalsSheet.getLastRow();
    const curCol = principalsSheet.getLastColumn();
    const curHeader = _v14_getHeader_(principalsSheet);
    lines.push(`  현재: ${curRow} row × ${curCol} col`);
    lines.push(`  현재 헤더: ${JSON.stringify(curHeader)}`);
  }
  lines.push(`  변경 후: 헤더 6열 + 7 row (총 8 row)`);
  lines.push(`  새 헤더: ${JSON.stringify(V14_PRINCIPALS_HEADER)}`);
  lines.push(`  새 데이터 7행:`);
  V14_PRINCIPALS_ROWS.forEach((r, i) => {
    lines.push(`    ${i + 1}. ${r.join(' | ')}`);
  });
  lines.push('');

  // [1D] 데이터 시트 폐기
  lines.push('━━━ [1D] 데이터 시트 폐기 (헤더만 유지) ━━━');
  let totalDelete = 0;
  V14_DATA_SHEETS_TO_CLEAR.forEach((name) => {
    const sheet = _v14_getSheetSafe_(ss, name);
    if (!sheet) {
      lines.push(`  [${name}] ⚠️ 시트 없음 — Apply 시 건너뜀`);
      return;
    }
    const dataRows = _v14_getDataRowCount_(sheet);
    const header = _v14_getHeader_(sheet);
    lines.push(`  [${name}]`);
    lines.push(`    헤더 (${header.length}열): ${JSON.stringify(header.slice(0, 8))}${header.length > 8 ? ' ...' : ''}`);
    lines.push(`    데이터 row 수: ${dataRows} → 0 (모두 삭제)`);
    totalDelete += dataRows;
  });
  lines.push(`  ─────────────────────────`);
  lines.push(`  삭제 합계: ${totalDelete} row`);
  lines.push('');

  // [백업 예정]
  lines.push('━━━ [백업] Apply 실행 시 자동 생성 ━━━');
  const ts = _v14_timestamp_();
  lines.push(`  _백업_${V14_PRINCIPALS_SHEET}_${ts}`);
  V14_DATA_SHEETS_TO_CLEAR.forEach((name) => {
    lines.push(`  _백업_${name}_${ts}  ← 데이터 있으면 백업`);
  });
  lines.push('');

  // [1C] 작업번호 형식
  lines.push('━━━ [1C] 작업번호 형식 (코드 변경 — 시트 변경 X) ━━━');
  lines.push(`  옛: 260429-K-001 (날짜-약자-순번)`);
  lines.push(`  새: K260507-001 (약자+YYMMDD-순번)`);
  lines.push(`  generateTaskNumber 함수: 본 .gs 파일에 박혀있음 (라인 하단)`);
  lines.push('');

  lines.push('━━━ DRY RUN 끝. 변경 X. Apply 호출 시 박힘. ━━━');

  const report = lines.join('\n');
  Logger.log(report);

  // UI 알림 (실행 환경에서 가능할 때만)
  try {
    SpreadsheetApp.getUi().alert(
      'V14 Week 1 DRY RUN',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // UI 없는 환경 (예: 트리거) — Logger.log만 사용
  }
  return report;
}

// ─────────────────────────────────────────────
// 2. Apply — 실제 적용 (백업 → 변경 → 보고)
// ─────────────────────────────────────────────
function resetSheet_OllitV14_Week1_Apply() {
  const ss = SpreadsheetApp.getActive();
  const ts = _v14_timestamp_();
  const lines = [];
  lines.push('━━━ V14 Week 1 — APPLY 시작 ━━━');
  lines.push(`스프레드시트: ${ss.getName()}`);
  lines.push(`실행 시각: ${ts}`);
  lines.push('');

  // [백업] 모든 영향 시트 = 사본 생성
  lines.push('━━━ [백업] 영향 시트 사본 생성 ━━━');
  const principalsSheet = _v14_getSheetSafe_(ss, V14_PRINCIPALS_SHEET);
  if (principalsSheet) {
    const backupName = `_백업_${V14_PRINCIPALS_SHEET}_${ts}`;
    const copy = principalsSheet.copyTo(ss);
    copy.setName(backupName);
    lines.push(`  ✓ ${backupName}`);
  } else {
    lines.push(`  ⚠️ ${V14_PRINCIPALS_SHEET} 시트 없음 — 백업 건너뜀 (신규 생성됨)`);
  }
  V14_DATA_SHEETS_TO_CLEAR.forEach((name) => {
    const sheet = _v14_getSheetSafe_(ss, name);
    if (!sheet) {
      lines.push(`  ⚠️ ${name} 시트 없음 — 백업 X`);
      return;
    }
    const dataRows = _v14_getDataRowCount_(sheet);
    if (dataRows === 0) {
      lines.push(`  · ${name} 데이터 0 row — 백업 생략`);
      return;
    }
    const backupName = `_백업_${name}_${ts}`;
    const copy = sheet.copyTo(ss);
    copy.setName(backupName);
    lines.push(`  ✓ ${backupName} (${dataRows} row)`);
  });
  lines.push('');

  // [1A] 설정_원청 박기 (clear → 헤더 + 7 row)
  lines.push('━━━ [1A] 설정_원청 박기 ━━━');
  let pSheet = _v14_getSheetSafe_(ss, V14_PRINCIPALS_SHEET);
  if (!pSheet) {
    pSheet = ss.insertSheet(V14_PRINCIPALS_SHEET);
    lines.push(`  ✓ 시트 신규 생성: ${V14_PRINCIPALS_SHEET}`);
  } else {
    pSheet.clear();
    lines.push(`  ✓ 기존 시트 clear`);
  }
  // 헤더 박기
  pSheet.getRange(1, 1, 1, V14_PRINCIPALS_HEADER.length).setValues([V14_PRINCIPALS_HEADER]);
  pSheet.getRange(1, 1, 1, V14_PRINCIPALS_HEADER.length)
    .setFontWeight('bold')
    .setBackground('#F5F2ED');
  // 데이터 7행 박기
  pSheet.getRange(2, 1, V14_PRINCIPALS_ROWS.length, V14_PRINCIPALS_HEADER.length)
    .setValues(V14_PRINCIPALS_ROWS);
  // 색 컬럼 (5열) 배경색 박기 — 시각 확인용
  V14_PRINCIPALS_ROWS.forEach((row, i) => {
    const colorHex = row[4]; // '색' 컬럼
    if (colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
      pSheet.getRange(2 + i, 5).setBackground(colorHex);
      // 어두운 배경엔 흰 글자
      pSheet.getRange(2 + i, 5).setFontColor('#FFFFFF').setFontWeight('bold');
    }
  });
  pSheet.autoResizeColumns(1, V14_PRINCIPALS_HEADER.length);
  lines.push(`  ✓ 헤더 6열 + 7 row 박힘`);
  lines.push('');

  // [1D] 데이터 시트 데이터 row 삭제 (헤더 유지)
  lines.push('━━━ [1D] 데이터 시트 폐기 ━━━');
  let totalDeleted = 0;
  V14_DATA_SHEETS_TO_CLEAR.forEach((name) => {
    const sheet = _v14_getSheetSafe_(ss, name);
    if (!sheet) {
      lines.push(`  ⚠️ [${name}] 시트 없음 — 건너뜀`);
      return;
    }
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1) {
      lines.push(`  · [${name}] 데이터 0 row — 변경 X`);
      return;
    }
    const dataRows = lastRow - 1;
    // 헤더(1행) 빼고 모든 데이터 row 삭제
    sheet.getRange(2, 1, dataRows, Math.max(1, lastCol)).clearContent();
    // 빈 행도 정리 — 헤더 외 row 모두 삭제
    if (lastRow > 1) {
      sheet.deleteRows(2, dataRows);
    }
    totalDeleted += dataRows;
    lines.push(`  ✓ [${name}] ${dataRows} row 삭제 (헤더 유지)`);
  });
  lines.push(`  ─────────────────────────`);
  lines.push(`  삭제 합계: ${totalDeleted} row`);
  lines.push('');

  lines.push('━━━ V14 Week 1 APPLY 완료 ━━━');
  lines.push(`다음: 1B 수수료정책 v6 박기 / 1D AdminApp 작업 입력 폼 / 1E API`);

  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert(
      'V14 Week 1 APPLY 완료',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // 무시
  }
  return report;
}

// ─────────────────────────────────────────────
// 3. generateTaskNumber — V14 형식 (api-backend.gs로 이동 가능)
//    포맷: 약자 + YYMMDD + - + 3자리 순번
//    예: A260507-001 / YS260507-002 / YS-N260507-001 / CK260507-001
// ─────────────────────────────────────────────
function generateTaskNumber(principalId, dateStr) {
  const prefix = V14_PRINCIPAL_PREFIX_MAP[principalId];
  if (!prefix) {
    throw new Error(`알 수 없는 원청 id: ${principalId}`);
  }
  // dateStr = '2026-05-07' or Date 객체 / 시각 박혀있어도 OK
  let d;
  if (dateStr instanceof Date) {
    d = dateStr;
  } else if (typeof dateStr === 'string') {
    // '2026-05-07' or '2026-05-07T...' 모두 처리
    d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      throw new Error(`잘못된 날짜 형식: ${dateStr}`);
    }
  } else {
    throw new Error(`dateStr 타입 X: ${typeof dateStr}`);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const yymmdd = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const todayPattern = `${prefix}${yymmdd}-`;

  // 작업DB에서 해당 날짜 + 원청 row 카운트 → 다음 순번
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('작업DB');
  if (!sheet) {
    // 작업DB 시트 없으면 -001부터
    return `${todayPattern}001`;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return `${todayPattern}001`;
  }
  // 1열 = 작업번호 가정
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let count = 0;
  ids.forEach((row) => {
    const v = row[0];
    if (v && String(v).startsWith(todayPattern)) {
      count++;
    }
  });
  const seq = String(count + 1).padStart(3, '0');
  return `${todayPattern}${seq}`;
}

// ─────────────────────────────────────────────
// 4. 데모 — generateTaskNumber 검증
// ─────────────────────────────────────────────
function _demo_generateTaskNumber() {
  const today = new Date();
  const lines = [];
  lines.push('━━━ generateTaskNumber 검증 ━━━');
  Object.keys(V14_PRINCIPAL_PREFIX_MAP).forEach((id) => {
    try {
      const num = generateTaskNumber(id, today);
      lines.push(`  ${id.padEnd(12)} → ${num}`);
    } catch (e) {
      lines.push(`  ${id} → 에러: ${e.message}`);
    }
  });
  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert('generateTaskNumber 검증', report, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // 무시
  }
  return report;
}

// ─────────────────────────────────────────────
// 5. 백업 시트 정리 (선택 — 30일 지난 백업 삭제)
//    필요할 때만 수동 실행
// ─────────────────────────────────────────────
function cleanupOldBackups_OllitV14() {
  const ss = SpreadsheetApp.getActive();
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const lines = ['━━━ 백업 시트 정리 (30일 이상) ━━━'];
  let removed = 0;
  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    const m = name.match(/^_백업_.+_(\d{8})_\d{6}$/);
    if (!m) return;
    const ymd = m[1]; // YYYYMMDD
    const y = parseInt(ymd.slice(0, 4), 10);
    const mo = parseInt(ymd.slice(4, 6), 10) - 1;
    const d = parseInt(ymd.slice(6, 8), 10);
    const t = new Date(y, mo, d).getTime();
    if (now - t > THIRTY_DAYS_MS) {
      ss.deleteSheet(sheet);
      lines.push(`  ✓ 삭제: ${name}`);
      removed++;
    }
  });
  lines.push(`  ─────────────────────────`);
  lines.push(`  삭제: ${removed} 시트`);
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}
