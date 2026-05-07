/**
 * V14 Week 1 1C/1E — api-backend.gs (V14 부분만 / 기존 파일에 merge)
 * 작성: 2026-05-07
 *
 * 박는 내용:
 *   1C 작업번호 형식: 260428-O-001 → O260428-001 (약자 + YYMMDD - 순번)
 *   1E 정책 catch + 동적 계산:
 *      - getPolicyForTask: 수수료정책 시트 read (V6 CLEAN 8열)
 *      - parsePolicy: 텍스트 → 구조화
 *      - calculateFee: 견적 × 정책 = 분배 동적 계산
 *      - 새 API actions: getPolicy / calculateFee / getAllPolicies
 *   검증: testGenerateTaskId_AllPrincipals / testCalculateFee_AllPrincipals
 *
 * 사장님 진행:
 *   1) 사장님 시트 → 확장 → Apps Script → api-backend 파일 열기
 *   2) 본 파일 함수 = 기존 동일 함수 위에 덮어쓰기 (변경):
 *        - generateTaskId
 *        - createTask (선택 — 기존 createTask와 비교 후 merge)
 *        - doPost (action 분기 3개 추가)
 *   3) 신규 함수 = 그대로 추가:
 *        - getPolicyForTask / parsePolicy / calculateFee / getAllPolicies
 *        - testGenerateTaskId_AllPrincipals / testCalculateFee_AllPrincipals
 *   4) 그대로 유지 (변경 X):
 *        - handleLogin (시뮬 5명 / Week 1 끝까지)
 *        - parseKakao (별도 / 6번대 진행)
 *        - 기타 유지 함수
 *
 * 검증 순서:
 *   1) testGenerateTaskId_AllPrincipals → ▶ 실행 → Logger 캡처
 *   2) testCalculateFee_AllPrincipals → ▶ 실행 → Logger 캡처
 *   3) 두 캡처 사장님께 전달 → 검증
 */

// ═════════════════════════════════════════════
// V14 헌법 — 7개 원청 (사장님 spec / 세스코 폐기)
// ═════════════════════════════════════════════
const V14_PRINCIPAL_CODES = {
  '올데이케어':       'O',
  '에어컨프로 (KA)':  'A',
  '쿨가이 (KB)':      'K',
  '용인컴퍼니':       'Y',
  '유솔홈케어 H':     'YS',
  '유솔홈케어 N':     'YS-N',
  '크리크린':         'CK',
};

// ═════════════════════════════════════════════
// [1C] generateTaskId — V14 형식 (약자 + YYMMDD - 순번)
//   예: O260507-001 / A260507-001 / YS-N260507-001 / CK260507-001
// ═════════════════════════════════════════════
function generateTaskId(principalName, dateInput) {
  const code = V14_PRINCIPAL_CODES[principalName];
  if (!code) {
    throw new Error(`알 수 없는 원청: ${principalName} — 7개 원청만 박힘`);
  }

  // dateInput 정규화 (Date 객체 / 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:MM:SS' 모두 OK)
  let d;
  if (dateInput instanceof Date) d = dateInput;
  else if (typeof dateInput === 'string') {
    d = new Date(dateInput);
    if (isNaN(d.getTime())) throw new Error(`잘못된 날짜: ${dateInput}`);
  } else if (dateInput == null) {
    d = new Date();
  } else {
    throw new Error(`dateInput 타입 X: ${typeof dateInput}`);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const yymmdd = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
  const prefix = `${code}${yymmdd}-`;

  // 작업DB 1열 카운트 → 다음 순번
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('작업DB');
  if (!sheet) return `${prefix}001`;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return `${prefix}001`;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let count = 0;
  ids.forEach((row) => {
    const v = row[0];
    if (v && String(v).startsWith(prefix)) count++;
  });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// ═════════════════════════════════════════════
// [1E-1] getPolicyForTask — 수수료정책 시트 read (V6 CLEAN 8열)
// ═════════════════════════════════════════════
function getPolicyForTask(principalName, workType, applianceOrLabel) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('수수료정책');
  if (!sheet) throw new Error('수수료정책 시트 없음');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('수수료정책 시트 비어있음 (헤더만 박혀있음)');

  // V6 CLEAN 8열: 원청 / 작업유형 / 기종 / 평균판매가 / 기사단가 / 가짜단가 / 정책 / 비고
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const matchKey = applianceOrLabel || '';

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (String(r[0]).trim() === String(principalName).trim()
      && String(r[1]).trim() === String(workType).trim()
      && String(r[2]).trim() === String(matchKey).trim()) {
      return {
        rowNum:        i + 2,
        principalName: r[0],
        workType:      r[1],
        appliance:     r[2],
        planSale:      r[3] === '' ? null : Number(r[3]),
        engUnitPrice:  r[4] === '' ? null : Number(r[4]),
        fakeUnitPrice: r[5] === '' ? null : Number(r[5]),
        policyText:    String(r[6] || ''),
        note:          String(r[7] || ''),
      };
    }
  }
  throw new Error(`정책 catch X: ${principalName} / ${workType} / ${matchKey}`);
}

// ═════════════════════════════════════════════
// [1E-2] parsePolicy — 텍스트 → 구조화
// ═════════════════════════════════════════════
function parsePolicy(policyText) {
  if (!policyText) return { type: 'unknown', raw: '' };
  const t = String(policyText).trim();

  // 직영
  if (t === '직영 (0)')      return { type: 'direct' };
  if (t === '직영 (50/50)')  return { type: 'direct_5050' };

  // 차감후 50% (가짜단가) — KA / KB 세척
  if (t.indexOf('차감후 50%') === 0) return { type: 'fake_deduct', ratio: 0.5 };

  // 정액 10K
  if (t === '정액 10K')              return { type: 'fixed', amount: 10000 };
  if (t === '정액 10K / 기사 50%')    return { type: 'fixed_eng_half', amount: 10000 };

  // 비율 N% / 기사 ×1.10 (유솔N 세척)
  const m110 = t.match(/^비율 (\d+)% \/ 기사 ×1\.10/);
  if (m110) return { type: 'ratio_eng_x110', principalRatio: Number(m110[1]) / 100 };

  // 비율 N% / 기사 50% (KA/KB/CK 냉매)
  const mhalf = t.match(/^비율 (\d+)% \/ 기사 50%/);
  if (mhalf) return { type: 'ratio_eng_half', principalRatio: Number(mhalf[1]) / 100 };

  // 비율 N% (유솔H 15% / 크리크린 20%)
  const mr = t.match(/^비율 (\d+)%$/);
  if (mr) return { type: 'ratio', principalRatio: Number(mr[1]) / 100 };

  // 특수 (YS-N 냉매)
  if (t.indexOf('특수') === 0) return { type: 'special_ysn_refrig' };

  // 기사 100% (출장비 / 냉매점검 출장비)
  if (t.indexOf('기사 100%') === 0) return { type: 'engineer_only' };

  // 기사 85% / 원청 15% (추가선택 YS-N)
  if (t.indexOf('기사 85%') === 0) {
    return { type: 'engineer_majority', engineerRatio: 0.85, principalRatio: 0.15 };
  }

  // 유솔 100% (네이버 1만원) (냉매점검 기본)
  if (t.indexOf('유솔 100%') === 0) {
    return { type: 'principal_only_fixed', amount: 10000 };
  }

  // 기사 50% / 회사 50% (원청 X) (냉매점검 추가발생)
  if (t.indexOf('기사 50% / 회사 50%') === 0) return { type: 'eng_company_half' };

  return { type: 'unknown', raw: t };
}

// ═════════════════════════════════════════════
// [1E-3] calculateFee — 견적 × 정책 = 분배
// ═════════════════════════════════════════════
function calculateFee(quote, parsedPolicy, engUnitPrice, fakeUnitPrice) {
  const q = Number(quote) || 0;
  const eng = engUnitPrice == null ? 0 : Number(engUnitPrice);
  const fake = fakeUnitPrice == null ? 0 : Number(fakeUnitPrice);

  switch (parsedPolicy.type) {
    case 'direct': {
      // 올데이 세척 — 원청 0 / 기사 = 기사단가 / 회사 = 나머지
      return { principalFee: 0, engineerAmount: eng, companyProfit: q - eng };
    }
    case 'direct_5050': {
      // 올데이 냉매 — 원청 0 / 기사 50% / 회사 50%
      const engHalf = Math.round(q * 0.5);
      return { principalFee: 0, engineerAmount: engHalf, companyProfit: q - engHalf };
    }
    case 'fake_deduct': {
      // KA/KB 세척 — 원청 = (견적 - 가짜단가) × 0.5 / 기사 = 실제 단가 / 회사 = 나머지
      const principalFee = Math.round((q - fake) * parsedPolicy.ratio);
      return { principalFee, engineerAmount: eng, companyProfit: q - principalFee - eng };
    }
    case 'fixed': {
      // 용인 세척 — 원청 정액 / 기사 = 기사단가 / 회사 = 나머지
      return { principalFee: parsedPolicy.amount, engineerAmount: eng, companyProfit: q - parsedPolicy.amount - eng };
    }
    case 'fixed_eng_half': {
      // 용인/유솔H 냉매 — 원청 정액 / 기사 50% / 회사 = 나머지
      const engHalf = Math.round(q * 0.5);
      return { principalFee: parsedPolicy.amount, engineerAmount: engHalf, companyProfit: q - parsedPolicy.amount - engHalf };
    }
    case 'ratio': {
      // 유솔H 15% / 크리크린 20% 세척 — 원청 = 견적 × 비율 / 기사 = 기사단가 / 회사 = 나머지
      const principalFee = Math.round(q * parsedPolicy.principalRatio);
      return { principalFee, engineerAmount: eng, companyProfit: q - principalFee - eng };
    }
    case 'ratio_eng_x110': {
      // 유솔N 세척 — 원청 = 견적 × 15% / 기사 = 기사단가 × 1.10 / 회사 = 나머지
      const principalFee = Math.round(q * parsedPolicy.principalRatio);
      const engX110      = Math.round(eng * 1.10);
      return { principalFee, engineerAmount: engX110, companyProfit: q - principalFee - engX110 };
    }
    case 'ratio_eng_half': {
      // KA 10% / KB 35% / CK 20% 냉매 — 원청 = 견적 × 비율 / 기사 50% / 회사 = 나머지
      const principalFee = Math.round(q * parsedPolicy.principalRatio);
      const engHalf      = Math.round(q * 0.5);
      return { principalFee, engineerAmount: engHalf, companyProfit: q - principalFee - engHalf };
    }
    case 'engineer_only': {
      // 출장비 / 냉매점검 출장비 — 기사 100%
      return { principalFee: 0, engineerAmount: q, companyProfit: 0 };
    }
    case 'engineer_majority': {
      // 추가선택(YS-N) — 기사 85% / 원청 15% / 회사 0
      return {
        principalFee: Math.round(q * parsedPolicy.principalRatio),
        engineerAmount: Math.round(q * parsedPolicy.engineerRatio),
        companyProfit: 0,
      };
    }
    case 'principal_only_fixed': {
      // 냉매점검(YS-N) 기본 — 유솔 100% (네이버 1만원)
      return { principalFee: parsedPolicy.amount, engineerAmount: 0, companyProfit: 0 };
    }
    case 'eng_company_half': {
      // 냉매점검(YS-N) 추가발생 — 기사 50% / 회사 50% / 원청 0
      const engHalf = Math.round(q * 0.5);
      return { principalFee: 0, engineerAmount: engHalf, companyProfit: q - engHalf };
    }
    case 'special_ysn_refrig': {
      throw new Error('YS-N 냉매충전은 별도 row catch — 냉매점검(YS-N) 기본/추가발생/출장비 row 사용');
    }
    default: {
      throw new Error(`Unknown policy type: ${parsedPolicy.type} / raw: ${parsedPolicy.raw || ''}`);
    }
  }
}

// ═════════════════════════════════════════════
// [1E-4] getAllPolicies — 모든 정책 catch (Admin / Happycall용)
// ═════════════════════════════════════════════
function getAllPolicies() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('수수료정책');
  if (!sheet) throw new Error('수수료정책 시트 없음');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  return data
    .filter((r) => r[0] && r[1] && r[2])  // 빈 row skip
    .map((r) => ({
      principalName: r[0],
      workType:      r[1],
      appliance:     r[2],
      planSale:      r[3] === '' ? null : Number(r[3]),
      engUnitPrice:  r[4] === '' ? null : Number(r[4]),
      fakeUnitPrice: r[5] === '' ? null : Number(r[5]),
      policyText:    String(r[6] || ''),
      note:          String(r[7] || ''),
    }));
}

// ═════════════════════════════════════════════
// [1C-2] createTask 예시 (작업DB 29열 catch / 사장님 기존 layout 보존)
//   ※ 이 함수는 참고용. 사장님 기존 createTask가 컬럼 mapping을 따로 박고 있을 수 있음.
//   ※ 차이점 = generateTaskId 호출만 V14 형식으로 변경. 작업DB 29열은 그대로.
// ═════════════════════════════════════════════
function createTask(taskData) {
  if (!taskData || !taskData.principal) throw new Error('taskData.principal 없음');

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('작업DB');
  if (!sheet) throw new Error('작업DB 시트 없음');

  // V14: generateTaskId — 약자 + YYMMDD - 순번
  const id = generateTaskId(taskData.principal, taskData.workDate || new Date());

  // 작업DB 29열 catch — 헤더 순서대로 mapping (사장님 기존 layout 보존)
  const lastCol = sheet.getLastColumn();
  const header  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = header.map((col) => {
    const c = String(col || '').trim();
    if (c === '작업번호' || c === 'task_id' || c === 'id')           return id;
    if (c === '원청'    || c === 'principal')                          return taskData.principal;
    if (c === '작업유형' || c === 'workType')                          return taskData.workType || '';
    if (c === '기종'    || c === 'appliance')                          return taskData.appliance || '';
    if (c === '수량'    || c === 'qty')                                return taskData.qty || 1;
    if (c === '견적금액' || c === 'quote' || c === 'estimateTotal')    return taskData.quote || 0;
    if (c === '고객명'  || c === 'customer')                           return taskData.customer || '';
    if (c === '전화'    || c === 'phone')                              return taskData.phone || '';
    if (c === '주소'    || c === 'address')                            return taskData.address || '';
    if (c === '예약일'  || c === 'workDate' || c === 'scheduledDate')  return taskData.workDate || '';
    if (c === '예약시간' || c === 'scheduledTime' || c === '시간')      return taskData.scheduledTime || '';
    if (c === '상태'    || c === 'status')                             return taskData.status || '약속대기';
    if (c === '비고'    || c === 'memo' || c === 'note')               return taskData.memo || '';
    // 그 외 컬럼은 taskData에서 직접 catch
    return taskData[c] != null ? taskData[c] : '';
  });

  sheet.appendRow(row);
  return id;
}

// ═════════════════════════════════════════════
// [1E-5] doPost 분기 추가 — 새 API actions 3개
//   ※ 사장님 기존 doPost에 아래 case 박기 (또는 doPost 자체 교체)
// ═════════════════════════════════════════════
function doPost(e) {
  let body = {};
  try {
    body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'JSON parse 실패' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const action = body.action || '';

  try {
    switch (action) {
      // ── 신규 V14 actions ──
      case 'getPolicy': {
        const policy = getPolicyForTask(body.principal, body.workType, body.appliance);
        const parsed = parsePolicy(policy.policyText);
        return _v14_jsonOk_({ policy, parsed });
      }
      case 'calculateFee': {
        const policy = getPolicyForTask(body.principal, body.workType, body.appliance);
        const parsed = parsePolicy(policy.policyText);
        const fee    = calculateFee(body.quote, parsed, policy.engUnitPrice, policy.fakeUnitPrice);
        return _v14_jsonOk_({ policy, parsed, fee });
      }
      case 'getAllPolicies': {
        const all = getAllPolicies();
        return _v14_jsonOk_({ policies: all, count: all.length });
      }
      case 'createTask': {
        const id = createTask(body.task || body);
        return _v14_jsonOk_({ taskId: id });
      }
      // ── 기존 actions ──
      // case 'login': return handleLogin(body);
      // case 'parseKakao': return parseKakao(body);
      // ... 사장님 기존 case들 그대로 박기
      default:
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: `unknown action: ${action}` }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message, stack: err.stack || '' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _v14_jsonOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═════════════════════════════════════════════
// [TEST 1] testGenerateTaskId_AllPrincipals
//   7개 원청 모두 generateTaskId 호출 / 형식 검증
// ═════════════════════════════════════════════
function testGenerateTaskId_AllPrincipals() {
  const today = new Date();
  const lines = [];
  lines.push('━━━ generateTaskId 검증 (7개 원청) ━━━');
  lines.push(`실행 시각: ${today.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  lines.push('');

  Object.keys(V14_PRINCIPAL_CODES).forEach((principalName) => {
    try {
      const id = generateTaskId(principalName, today);
      const code = V14_PRINCIPAL_CODES[principalName];
      lines.push(`  ✓ ${principalName.padEnd(18)} (${code.padEnd(4)}) → ${id}`);
    } catch (e) {
      lines.push(`  ✗ ${principalName} → 에러: ${e.message}`);
    }
  });
  lines.push('');
  lines.push('━━━ 검증 끝 ━━━');

  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert('testGenerateTaskId_AllPrincipals', report, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // UI 없는 환경 — Logger.log만
  }
  return report;
}

// ═════════════════════════════════════════════
// [TEST 2] testCalculateFee_AllPrincipals
//   7개 원청 × 2 작업유형 = 13 케이스 (YS-N 냉매 = 특수 / throws 별도)
//   견적 100K / 벽걸이 박을 때 분배 검증
// ═════════════════════════════════════════════
function testCalculateFee_AllPrincipals() {
  const lines = [];
  lines.push('━━━ calculateFee 검증 (견적 100K / 벽걸이) ━━━');
  lines.push(`실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  lines.push('');

  const cases = [
    // 세척 (7 원청)
    { p: '올데이케어',       wt: '세척', app: '벽걸이' },
    { p: '에어컨프로 (KA)',  wt: '세척', app: '벽걸이' },
    { p: '쿨가이 (KB)',      wt: '세척', app: '벽걸이' },
    { p: '용인컴퍼니',       wt: '세척', app: '벽걸이' },
    { p: '유솔홈케어 H',     wt: '세척', app: '벽걸이' },
    { p: '유솔홈케어 N',     wt: '세척', app: '벽걸이' },
    { p: '크리크린',         wt: '세척', app: '벽걸이' },
    // 냉매충전 (7 원청 / YS-N은 특수 throws)
    { p: '올데이케어',       wt: '냉매충전', app: '벽걸이' },
    { p: '에어컨프로 (KA)',  wt: '냉매충전', app: '벽걸이' },
    { p: '쿨가이 (KB)',      wt: '냉매충전', app: '벽걸이' },
    { p: '용인컴퍼니',       wt: '냉매충전', app: '벽걸이' },
    { p: '유솔홈케어 H',     wt: '냉매충전', app: '벽걸이' },
    { p: '유솔홈케어 N',     wt: '냉매충전', app: '벽걸이', expectError: true },
    { p: '크리크린',         wt: '냉매충전', app: '벽걸이' },
  ];

  const QUOTE = 100000;
  cases.forEach((c) => {
    try {
      const policy = getPolicyForTask(c.p, c.wt, c.app);
      const parsed = parsePolicy(policy.policyText);
      const fee    = calculateFee(QUOTE, parsed, policy.engUnitPrice, policy.fakeUnitPrice);
      const fmt = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;
      lines.push(`  [${c.p} / ${c.wt} / ${c.app}]`);
      lines.push(`    정책: ${policy.policyText} → ${parsed.type}`);
      lines.push(`    원청 ${fmt(fee.principalFee)} / 기사 ${fmt(fee.engineerAmount)} / 회사 ${fmt(fee.companyProfit)} (총 ${fmt(QUOTE)})`);
      lines.push('');
    } catch (e) {
      const expectMark = c.expectError ? '✓ 예상 error' : '✗ 에러';
      lines.push(`  [${c.p} / ${c.wt} / ${c.app}] ${expectMark}: ${e.message}`);
      lines.push('');
    }
  });

  lines.push('━━━ 검증 끝 ━━━');
  const report = lines.join('\n');
  Logger.log(report);
  try {
    SpreadsheetApp.getUi().alert('testCalculateFee_AllPrincipals', report, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // UI 없는 환경 — Logger.log만
  }
  return report;
}
