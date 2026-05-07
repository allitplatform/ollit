// === V14 — 기사 정보 시트 마이그레이션 (코드 → 시트) ===
//
// 작성: 2026-05-07
// 대상: 사장님 운영 스프레드시트
//   - 설정_기사 (6열 V2 / 세척·냉매 지역 분리)
//   - 설정_기사단가 (5열 / 단가 override / 현재 비어있음)
//
// 박는 내용:
//   1) 설정_기사 시트 V14 v2 헤더 박기 (지역/직급 → 세척_지역/냉매_지역)
//   2) src/data/engineers.js의 20명 박기 (SEED_ENGINEERS catch / V14 헌법 박힌 거)
//   3) 설정_기사단가 = 빈 (모두 정책 catch / override 박지 X)
//
// V14 v2 6열 (지역/직급 → 세척_지역/냉매_지역):
//   기사ID | 이름 | 연락처 | 세척_지역 | 냉매_지역 | 활성
//
// 박지 X (사장님 catch 박을 차례):
//   - 백업 기사 (권창용/이상준/김재현 등) = 세척_지역 비음 (기종 전문 / 지역 무관)
//   - 단가 override = 모두 정책 catch (수수료정책 시트 박힘)
//   - 24명 = 코드 X (현재 20명 / 4명 추가 catch 박을 차례)
//
// 사장님 진행:
//   1) Apps Script 에디터에 본 파일 박기
//   2) `runAll_engineers_v2()` 실행 (한 번에 박힘)
//   3) Logger 캡처 → 마이그레이션 N명 박힘 catch
//   4) 시트 catch — 설정_기사 (20명 / 세척·냉매 지역 박혀있어)

// ─────────────────────────────────────────────
// 코드 → 시트 박을 20명 (src/data/engineers.js SEED_ENGINEERS 그대로)
// ─────────────────────────────────────────────
const V14_ENGINEERS_FROM_CODE = [
  // [기사ID, 이름, 연락처, 세척_지역, 냉매_지역, 활성]
  ['yang_seungmoon',  '양승문', '010-3749-0294', '고양시, 은평구, 서대문구',                '은평구',                                    true],
  ['kim_yunseop',     '김윤섭', '010-2063-4980', '마포구, 용산구, 중구',                     '용산구, 중구',                              true],
  ['jung_sanghyun',   '정상현', '010-2273-0976', '종로구, 성북구, 동대문구',                 '강북구, 도봉구, 노원구',                    true],
  ['an_seungwoong',   '안승웅', '010-5399-3651', '성동구, 광진구, 중랑구',                   '성동구, 광진구',                            true],
  ['kim_youngsoo',    '김영수', '010-2635-5772', '의정부, 구리, 남양주, 양주',               '동대문구, 중랑구',                          true],
  ['kim_hyundong',    '김현동', '',              '강북구, 도봉구, 노원구',                    '',                                          true],
  ['lim_jongil',      '임종일', '',              '동작구, 관악구, 시흥시',                    '',                                          true],
  ['ryu_geunhak',     '류근학', '',              '서초구, 강남구, 용인, 하남',                '',                                          true],
  ['jung_hoon',       '정훈',   '010-2143-9620', '송파구, 강동구, 용인, 하남',                '서초구, 강남구',                            true],
  ['jeon_hyunjin',    '전현진', '010-7764-4402', '양천구, 구로구, 금천구, 강서구',            '강서구, 양천구, 구로구',                    true],
  ['kwon_changyong',  '권창용', '',              '(벽걸이 전문 / 지역 무관)',                 '',                                          true],
  ['lee_sangjun',     '이상준', '010-4729-8079', '(벽걸이 전문 / 지역 무관)',                 '종로구, 성북구',                            true],
  ['kim_jaehyun',     '김재현', '',              '(벽걸이 전문 / 지역 무관)',                 '',                                          true],
  ['kim_taeseung',    '김태승', '010-8185-9700', '(보조) 서대문구, 중구',                     '마포구, 서대문구',                          true],
  ['moon_seongmok',   '문성목', '',              '(보조) 성동구, 광진구, 중랑구',             '',                                          true],
  ['son_dongsik',     '손동식', '',              '(보조) 고양시, 은평구',                     '',                                          true],
  ['kim_byeongchul',  '김병철', '',              '(보조) 남양주, 구리, 의정부',               '',                                          true],
  ['kim_donghyo',     '김동효', '010-9238-0412', '(보조) 관악구, 동작구, 시흥시, 금천구, 강서구', '송파구, 강동구',                          true],
  ['byun_kihyun',     '변기현', '010-6351-8818', '',                                          '금천구, 관악구',                            true],
  ['kang_byeongik',   '강병익', '010-9089-1726', '',                                          '동작구, 영등포구',                          true],
];

// ─────────────────────────────────────────────
// 1. 설정_기사 시트 V14 v2 헤더 + 20명 박기
// ─────────────────────────────────────────────
function setupSheet_설정기사_V14_v2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('설정_기사');

  // 옛 시트 백업 (rename) → 새 시트 박기
  if (sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 1 || lastCol > 0) {
      const backupName = '_백업_설정_기사_v2전_' + Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss');
      sheet.setName(backupName);
      Logger.log('✅ 옛 시트 백업: ' + backupName);
      sheet = null;
    } else {
      sheet.clear();
      Logger.log('· 옛 시트 = 빈 / clear');
    }
  }
  if (!sheet) {
    sheet = ss.insertSheet('설정_기사');
    Logger.log('✅ 설정_기사 시트 박힘');
  }

  // V14 v2 6열 (세척·냉매 지역 분리)
  const headers = ['기사ID', '이름', '연락처', '세척_지역', '냉매_지역', '활성'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#FF1B8D')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // 컬럼 너비
  sheet.setColumnWidth(1, 130);  // 기사ID
  sheet.setColumnWidth(2, 80);   // 이름
  sheet.setColumnWidth(3, 130);  // 연락처
  sheet.setColumnWidth(4, 280);  // 세척_지역
  sheet.setColumnWidth(5, 200);  // 냉매_지역
  sheet.setColumnWidth(6, 60);   // 활성

  Logger.log('✅ V14 v2 헤더 박힘 (6열 / 세척·냉매 지역 분리)');
  return sheet;
}

// ─────────────────────────────────────────────
// 2. 코드 → 시트 박기 (20명)
// ─────────────────────────────────────────────
function importEngineers_FromCode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('설정_기사');
  if (!sheet) {
    Logger.log('❌ 설정_기사 시트 catch X — setupSheet_설정기사_V14_v2 먼저 박을 차례');
    return;
  }

  // 헤더 외 row clear (재실행 안전)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent().clearDataValidations();
  }

  // 박기
  const data = V14_ENGINEERS_FROM_CODE;
  if (data.length === 0) {
    Logger.log('⚠️ V14_ENGINEERS_FROM_CODE 박지 X');
    return;
  }
  sheet.getRange(2, 1, data.length, 6).setValues(data);

  // 활성 컬럼 데이터 검증 (TRUE/FALSE)
  const activeRange = sheet.getRange(2, 6, data.length, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([true, false], true)
    .setAllowInvalid(false)
    .build();
  activeRange.setDataValidation(rule);

  Logger.log('✅ 기사 박힘: ' + data.length + '명');
  Logger.log('📝 사장님 catch 박을 차례:');
  Logger.log('   - 24명 (현재 20명 / 4명 추가 박기)');
  Logger.log('   - 백업 기사 = "(벽걸이 전문)" / "(보조)" tag 박혀있어 / 사장님 catch');
}

// ─────────────────────────────────────────────
// 3. 기사 단가 override (현재 비어있음 / 모두 정책 catch)
// ─────────────────────────────────────────────
function importEngineerRates_FromCode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('설정_기사단가');
  if (!sheet) {
    Logger.log('❌ 설정_기사단가 시트 catch X');
    return;
  }

  // V14 5열: 기사ID / 작업유형 / 기종 / 단가 / 비고
  // 정책 (수수료정책 시트) 박은 단가와 다른 기사만 박기 (현재 = 0건)
  const rates = [
    // 예시 (현재 박지 X):
    // ['kang_byeongik', '세척', '벽걸이', 45000, '경험자 +5K'],
  ];

  if (rates.length > 0) {
    // 헤더 외 row clear (재실행 안전)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }
    sheet.getRange(2, 1, rates.length, 5).setValues(rates);
    Logger.log('✅ 단가 override 박힘: ' + rates.length + '건');
  } else {
    Logger.log('· 단가 override 박지 X (모두 정책 catch / 수수료정책 시트 박혀있음)');
  }
}

// ─────────────────────────────────────────────
// 4. 한 번에 박기 (편의 함수)
// ─────────────────────────────────────────────
function runAll_engineers_v2() {
  Logger.log('━━━ V14 기사 마이그레이션 박기 (3 단계) ━━━');
  Logger.log('');
  Logger.log('[1/3] setupSheet_설정기사_V14_v2');
  setupSheet_설정기사_V14_v2();
  Logger.log('');
  Logger.log('[2/3] importEngineers_FromCode');
  importEngineers_FromCode();
  Logger.log('');
  Logger.log('[3/3] importEngineerRates_FromCode');
  importEngineerRates_FromCode();
  Logger.log('');
  Logger.log('━━━ 박기 끝 ━━━');
}

// ─────────────────────────────────────────────
// 5. 검증 — 시트 read해서 박힘 확인
// ─────────────────────────────────────────────
function testGetEngineers_V14_v2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('설정_기사');
  if (!sheet) { Logger.log('❌ 설정_기사 시트 catch X'); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('⚠️ 데이터 row 박지 X'); return; }

  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  Logger.log('━━━ 설정_기사 검증 (' + data.length + '명) ━━━');
  data.forEach((row, i) => {
    const [id, name, phone, cleanZones, refrigZones, active] = row;
    Logger.log(`  ${i + 1}. ${id} (${name}) ${phone || '전화 X'}`);
    Logger.log(`     세척: ${cleanZones || '(없음)'}`);
    Logger.log(`     냉매: ${refrigZones || '(없음)'}`);
    Logger.log(`     활성: ${active}`);
  });
  Logger.log('━━━ 검증 끝 (' + data.length + '명) ━━━');
}
