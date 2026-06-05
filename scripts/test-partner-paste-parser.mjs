// 파서 self-test — 사장님 실제 KA / crikrin 메시지 샘플.
//
// KA: 한 메시지 통째로 1회 파싱(여러 건 반환).
// crikrin: 각각 별도 메시지라 5번 따로 파싱.
//
// 실행: node scripts/test-partner-paste-parser.mjs

import { parsePartnerPaste, APPLIANCE_CODE_TO_LABEL, extractPhone } from "../src/utils/partnerPasteParser.js";

function out(label, text, principalCode) {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("샘플:", label, "/ principalCode:", principalCode);
  console.log("──────────────────────────────────────────────────────────");
  console.log("입력:");
  console.log(text);
  console.log("──────────────────────────────────────────────────────────");
  const recs = parsePartnerPaste(text, principalCode);
  console.log(`결과: ${recs.length}건`);
  recs.forEach((r, i) => {
    console.log(`\n[${i + 1}]`);
    console.log("  customerName :", JSON.stringify(r.customerName));
    console.log("  phone        :", JSON.stringify(r.phone));
    console.log("  address      :", JSON.stringify(r.address));
    console.log("  items        :", JSON.stringify(r.items));
    if (r.items?.length > 0) {
      const labels = r.items.map(it => `${APPLIANCE_CODE_TO_LABEL[it.appliance] || "(불명)"}×${it.qty}${it.price != null ? ` ₩${it.price.toLocaleString()}` : ""}`);
      console.log("  items(폼라벨):", labels.join(" / "));
    }
    console.log("  desiredText  :", JSON.stringify(r.desiredText));
    console.log("  memo         :", JSON.stringify(r.memo));
    console.log("  workType     :", JSON.stringify(r.workType));
  });
}

// ═══════════ KA (쿨가이) ══════════════════════════════════

// KA-A: 한 메시지 = 4건 (관악구 ~ 은평구)
out("KA-A: 4건 한 메시지", `관악구서림3길19
벽걸이.가.충 70.000
01043448043

신람로36길23-7. 302호
스탠드 가.충80.000
01037357838.
5시이후가능하다고함

서대문구연희동연희로82
연희브라운스톤. 비동 308호
원웨이 물떨어짐 150.000
01077742688

은평구 진관2로 90
322동 503호
스탠드.가.충 80.000
01025511717
내일아침 일빠로부탁합니다`, "KA");

// KA-B: 한 메시지 = 1건, 기종 2개 (강남구양재대로55길10)
out("KA-B: 1건 다기종", `강남구양재댸로55길10
102동306호
스탠드 가.충 80.000
벽걸이가.충 70.000
01029513739
금일중`, "KA");

// KA-C: 약어 기종 '벽' (상계주공 케이스 — 사장님 추가 샘플)
out("KA-C: 약어 '벽' 인식", `상계주공5단지502동504호
벽.가.충 70.000
01053396228
토요일오전중예약`, "KA");

// ═══════════ crikrin (각각 별도 파싱) ════════════════════════

out("CR-1 김민성 (무라벨, 메모 안 빈 줄)", `김민성
서울시 관악구 인헌21길6 대성파크빌라 302호
010 3045 9453
스탠드형 에어컨

저희가 컨테이너를 2층으로 쌓아서 사용중인데 2층 컨테이너 문 바로 앞에 있다고 합니다~ 작업하시는데 어렵지는 않을거에요! `, "crikrin");

out("CR-2 황진주", `황진주
하남시 감일동 342번지 로젠택배 사무실
010-2004-2484 (오시는 날에는 이 번호로 연락 부탁드려요!)
벽걸이 에어컨1대
5월 28일 목요일 오후 3시쯤
감사합니다~`, "crikrin");

out("CR-3 안재현 (전화+기종+희망일 한 줄)", `안재현
종로39길54
태성산업 1층
010-8298-5761  스탠드1대 오늘 냉매충전`, "crikrin");

out("CR-4 김수진 (라벨)", `성함 : 김수진 / 냉매충전
주소 : 강서로 405 우성르보아 1005호
연락처 : 01086163481
가전 종류 : 천장형 에어컨 1대 1웨이
희망 날짜 : 26년5월 30일 오후1시
오후`, "crikrin");

out("CR-5 전지수 (라벨, 위니아=기종 불명)", `성함:전지수
주소: 서울시 관악구 중앙길 34 (201호)
연락처: 010.9100.0906
가전 종류 및 갯수: 위니아 1대
희망 날짜 및 시간대 (오전/오후): 5.23 토 오전`, "crikrin");

// ═══════════ KA 단위 테스트 (item 줄만 / KA single-line 파싱) ════════════════════════

function unitItem(label, line, expected) {
  const recs = parsePartnerPaste(line, "KA");
  const rec  = recs[0] || {};
  const item = (rec.items || [])[0] || {};
  const got = {
    appliance: item.appliance ?? null,
    qty:       item.qty ?? null,
    price:     item.price ?? null,
    memo:      rec.memo ?? null,
  };
  const pass = JSON.stringify(got) === JSON.stringify(expected);
  const flag = pass ? "✓" : "✗";
  console.log(`${flag} ${label}`);
  console.log(`    input: ${JSON.stringify(line)}`);
  console.log(`    got:   ${JSON.stringify(got)}`);
  if (!pass) console.log(`    want:  ${JSON.stringify(expected)}`);
}

console.log("\n══════════════════════════════════════════════════════════");
console.log("KA 단위 케이스 (사장님 spec)");
console.log("══════════════════════════════════════════════════════════");

unitItem("1. 벽걸이 가스충전 70.000",
  "벽걸이 가스충전 70.000",
  { appliance: "wall", qty: 1, price: 70000, memo: null });

unitItem("2. 벽걸이 가충. 70.000",
  "벽걸이 가충. 70.000",
  { appliance: "wall", qty: 1, price: 70000, memo: null });

unitItem("3. 스탠드가.충 80.000",
  "스탠드가.충 80.000",
  { appliance: "stand", qty: 1, price: 80000, memo: null });

unitItem("4. 원웨이 가.충100.000",
  "원웨이 가.충100.000",
  { appliance: "1way", qty: 1, price: 100000, memo: null });

unitItem("5. 벽걸이 .가.충 70.000",
  "벽걸이 .가.충 70.000",
  { appliance: "wall", qty: 1, price: 70000, memo: null });

unitItem("6. 벽걸이.가.충 .70.000",
  "벽걸이.가.충 .70.000",
  { appliance: "wall", qty: 1, price: 70000, memo: null });

unitItem("7. 스탠드. 가.충 3대 80.000씩",
  "스탠드. 가.충 3대 80.000씩",
  { appliance: "stand", qty: 3, price: 80000, memo: null });

unitItem("8. 벽걸이 가.충  2대 70.000씩",
  "벽걸이 가.충  2대 70.000씩",
  { appliance: "wall", qty: 2, price: 70000, memo: null });

unitItem("9. 포웨이 가.충 150.000",
  "포웨이 가.충 150.000",
  { appliance: "4way", qty: 1, price: 150000, memo: null });

unitItem("10. 투인원가.충. 100.000",
  "투인원가.충. 100.000",
  { appliance: "2in1", qty: 1, price: 100000, memo: null });

unitItem("11. 벽.가.충 70.000",
  "벽.가.충 70.000",
  { appliance: "wall", qty: 1, price: 70000, memo: null });

unitItem("12. 스탠드물호수교환 80.000 + memo '물호수교환'",
  "스탠드물호수교환 80.000",
  { appliance: "stand", qty: 1, price: 80000, memo: "물호수교환" });

unitItem("13. 스탠드 안시원함 (가격 없음 → price:null)",
  "스탠드 안시원함",
  { appliance: "stand", qty: 1, price: null, memo: "안시원함" });

// 폰 단위
function unitPhone(label, line, expected) {
  const got = extractPhone(line);
  const pass = got === expected;
  const flag = pass ? "✓" : "✗";
  console.log(`${flag} ${label}: input=${JSON.stringify(line)} got=${JSON.stringify(got)}`);
  if (!pass) console.log(`    want: ${JSON.stringify(expected)}`);
}

console.log("\n──── 폰 (휴대폰 010) ────");
unitPhone("14. '010 53648000'",      "010 53648000",      "010-5364-8000");
unitPhone("    '01094471547'",       "01094471547",       "010-9447-1547");
unitPhone("    '010-5111-3573.'",    "010-5111-3573.",    "010-5111-3573");
unitPhone("    '010.9100.0906'",     "010.9100.0906",     "010-9100-0906");
unitPhone("    +82 10-1234-5678",    "+82 10-1234-5678",  "010-1234-5678");

console.log("\n──── 폰 (일반전화) ────");
unitPhone("15. '029216483' (서울 9)",   "029216483",      "02-921-6483");
unitPhone("    '02 921 6483' (서울)",   "02 921 6483",    "02-921-6483");
unitPhone("    '0212345678' (서울 10)", "0212345678",     "02-1234-5678");
unitPhone("    '0319216483' (지역 10)", "0319216483",     "031-921-6483");
unitPhone("    '031-921-6483'",         "031-921-6483",   "031-921-6483");
unitPhone("    '070-1234-5678'",        "070-1234-5678",  "070-1234-5678");

console.log("\n──── 폰 오인 차단 (null이어야 함) ────");
function unitNoPhone(label, line) {
  const got = extractPhone(line);
  const pass = got === null;
  const flag = pass ? "✓" : "✗";
  console.log(`${flag} ${label}: input=${JSON.stringify(line)} got=${JSON.stringify(got)}${pass ? "" : "  (null 기대)"}`);
}
unitNoPhone("16. 주소번지 '123-45'",     "강남구 역삼동 123-45");
unitNoPhone("    가격 '70.000원'",       "70.000원");
unitNoPhone("    '2층'",                 "2층");
unitNoPhone("    '101동 1001호'",        "101동 1001호");
unitNoPhone("    날짜 '20240228'",       "20240228");
unitNoPhone("    임베드 '202401012345'",  "주문번호: 202401012345");
