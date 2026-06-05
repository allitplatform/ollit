// 파서 self-test — 사장님 실제 KA / crikrin 메시지 샘플.
//
// KA: 한 메시지 통째로 1회 파싱(여러 건 반환).
// crikrin: 각각 별도 메시지라 5번 따로 파싱.
//
// 실행: node scripts/test-partner-paste-parser.mjs

import { parsePartnerPaste, APPLIANCE_CODE_TO_LABEL } from "../src/utils/partnerPasteParser.js";

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
