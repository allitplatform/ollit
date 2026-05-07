// === V14 — 설정_기사 시트 V14 박기 (옛 → 6열 마이그레이션) ===
//
// 작성: 2026-05-07
// 대상: 사장님 운영 스프레드시트 (활성 스프레드시트 / 설정_기사 시트)
//
// 박는 내용:
//   - 옛 시트 catch (설정_기사 / 기사 / Engineers — 시트명 다양성)
//   - 옛 데이터 catch (이름 / 전화 — 첫 3열 read)
//   - 옛 시트 백업 (시트명 rename: _백업_설정_기사_YYYYMMDD_HHmmss)
//   - V14 새 시트 박기 (6열 / 핑크 헤더)
//   - 옛 데이터 → V14 형식 마이그레이션 (이름 → 기사ID + 이름 / 지역·직급 빈)
//   - 활성 컬럼 데이터 검증 (TRUE/FALSE)
//
// V14 헌법 6열:
//   기사ID | 이름 | 연락처 | 지역 | 직급 | 활성
//
// 사장님 진행:
//   1) Apps Script 에디터에 본 파일 박기
//   2) `setupSheet_설정기사_V14` 실행
//   3) 옛 시트 = 백업 시트로 rename / 새 V14 시트 박힘
//   4) 사장님 catch 박을 차례: 지역 / 직급 박기 (현재 빈)

function setupSheet_설정기사_V14() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 옛 시트 catch (시트명 다양성 박기)
  let oldSheet = ss.getSheetByName('설정_기사')
              || ss.getSheetByName('기사')
              || ss.getSheetByName('Engineers');

  if (!oldSheet) {
    Logger.log('⚠️ 옛 기사 시트 catch X — 빈 V14 시트 박기');
  }

  // 2. 옛 데이터 catch (이름 / 전화 / 이메일)
  let oldData = [];
  if (oldSheet) {
    const lastRow = oldSheet.getLastRow();
    if (lastRow >= 2) {
      oldData = oldSheet.getRange(2, 1, lastRow - 1, 3).getValues()
        .filter(row => row[0] && String(row[0]).trim());
      Logger.log('옛 데이터 catch: ' + oldData.length + '명');
    }
  }

  // 3. 옛 시트 백업 (이름 변경)
  if (oldSheet) {
    const backupName = '_백업_설정_기사_' + Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss');
    oldSheet.setName(backupName);
    Logger.log('✅ 백업 박혔어: ' + backupName);
  }

  // 4. V14 시트 박기
  const sheet = ss.insertSheet('설정_기사');

  // V14 헌법 박은 거 (6열)
  const headers = ['기사ID', '이름', '연락처', '지역', '직급', '활성'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 헤더 스타일
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#FF1B8D')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // 5. 옛 데이터 → V14 형식 박기
  if (oldData.length > 0) {
    const v14Data = oldData.map(row => {
      const name = String(row[0]).trim();
      const phone = String(row[1] || '').trim();
      // 기사ID = 이름 (또는 자동 / 박을 차례)
      // 지역 / 직급 / 활성 = 기본값
      return [name, name, phone, '', '기사', true];
    });
    sheet.getRange(2, 1, v14Data.length, headers.length).setValues(v14Data);
    Logger.log('✅ V14 데이터 박혔어: ' + v14Data.length + '명');
  }

  // 6. 컬럼 너비
  sheet.setColumnWidth(1, 100);  // 기사ID
  sheet.setColumnWidth(2, 100);  // 이름
  sheet.setColumnWidth(3, 130);  // 연락처
  sheet.setColumnWidth(4, 100);  // 지역
  sheet.setColumnWidth(5, 80);   // 직급
  sheet.setColumnWidth(6, 60);   // 활성

  // 7. 활성 컬럼 데이터 검증 (TRUE/FALSE)
  if (oldData.length > 0) {
    const activeRange = sheet.getRange(2, 6, oldData.length, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList([true, false], true)
      .setAllowInvalid(false)
      .build();
    activeRange.setDataValidation(rule);
  }

  Logger.log('✅ 설정_기사 V14 박혔어 (6열 / ' + oldData.length + '명)');
  Logger.log('📝 사장님 catch 박을 차례: 지역 / 직급 박기 (현재 빈)');
}
