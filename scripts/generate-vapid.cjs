// Step 6-1 (1단계) — VAPID 키 발급 스크립트
// 사용법: node scripts/generate-vapid.js
// 한 번만 실행 → 출력된 키 보관 필수
// VITE_VAPID_PUBLIC : 클라이언트 측 (브라우저 / .env.local + Vercel)
// VAPID_PRIVATE     : 서버 측만 (다음 단계 / Vercel 서버 환경변수만)

const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();

console.log("");
console.log("=== VAPID 키 (한 번만 발급 / 보관 필수) ===");
console.log("");
console.log("VITE_VAPID_PUBLIC=" + keys.publicKey);
console.log("VAPID_PRIVATE="    + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:admin@allday-care.com");
console.log("");
console.log("=== 다음 단계 ===");
console.log("1. .env.local 에 VITE_VAPID_PUBLIC 박음 (커밋 X / .gitignore 박혀있음)");
console.log("2. Vercel 환경 변수 (Settings → Environment Variables):");
console.log("   - VITE_VAPID_PUBLIC = (위 publicKey) [Production / Preview / Development]");
console.log("   - VAPID_PRIVATE     = (위 privateKey) [Production / Preview / Development] / Sensitive");
console.log("   - VAPID_SUBJECT     = mailto:admin@allday-care.com");
console.log("3. Vercel 재배포 (자동 또는 수동)");
console.log("");
