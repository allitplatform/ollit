// 회귀 검증 — 새 동적 판정 로직을 기존 데이터에 시뮬레이션 (read-only)
// 5/24 이전 132행 변화 0 / 5/25 이후 13행만 정정인지 확인.
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";
const CUT = "2026-05-25T00:00:00Z";

// 새 동적 판정 로직 — 코드 수정안과 1:1 동일해야 회귀 검증 의미 있음
function normalizeUnitPrice(settlement, customerPaid, qty) {
  const perUnitPaid = (customerPaid && qty) ? customerPaid / qty : null;
  let unitPrice = settlement;
  if (qty >= 2 && perUnitPaid && settlement > perUnitPaid * 1.1) {
    unitPrice = Math.round(settlement / qty);
  }
  return unitPrice;
}

(async () => {
  const all = [];
  for (let off = 0; off < 5000; off += 1000) {
    const { data } = await sb.from("task_items")
      .select("id, qty, unit_price, customer_paid_amount, tasks!inner(task_no, principal_id, created_at)")
      .eq("tasks.principal_id", PID)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`전체 usol_n task_items: ${all.length}행\n`);

  const before = all.filter(i => i.tasks.created_at < CUT);
  const after  = all.filter(i => i.tasks.created_at >= CUT);

  // 시뮬레이션 — 기존 unit_price를 settlement로 간주 (DB에 박힌 값이 CSV settlement 그대로)
  function simulate(items, label) {
    let changed = 0, unchanged = 0, skipped = 0;
    const changedRows = [];
    for (const i of items) {
      const cur = i.unit_price;
      const next = normalizeUnitPrice(cur, i.customer_paid_amount, i.qty);
      if (next !== cur) { changed++; changedRows.push({ i, next }); }
      else if (i.qty < 2 || !i.customer_paid_amount) skipped++;
      else unchanged++;
    }
    console.log(`[${label}] ${items.length}행`);
    console.log(`  변화 없음 (qty>=2 + cp 있음 + 판정 false): ${unchanged}행`);
    console.log(`  skip (qty<2 또는 cp 없음 — 분기 안 탐): ${skipped}행`);
    console.log(`  ★ 변경 발생: ${changed}행`);
    return changedRows;
  }

  console.log("=".repeat(100));
  console.log("회귀 검증 — 새 로직을 기존 데이터에 시뮬레이션");
  console.log("=".repeat(100));
  const chBefore = simulate(before, "5/24 이전 (기대: 변경 0건)");
  console.log("");
  const chAfter  = simulate(after,  "5/25 이후 (기대: 13건 정정)");

  console.log("\n" + "=".repeat(100));
  console.log("판정 — 회귀 안전성");
  console.log("=".repeat(100));
  if (chBefore.length === 0) console.log(`  ✓ 5/24 이전 정상 데이터 0건 변경 — 회귀 안전`);
  else {
    console.log(`  ✗ 5/24 이전 ${chBefore.length}건 변경 — 회귀 위험! 샘플:`);
    for (const c of chBefore.slice(0, 10)) {
      console.log(`    ${c.i.tasks.task_no} | qty=${c.i.qty} | up=${c.i.unit_price} | cp=${c.i.customer_paid_amount} → 새 up=${c.next}`);
    }
  }
  console.log("");
  if (chAfter.length === 13) console.log(`  ✓ 5/25 이후 13건 정정 — 진단과 정확히 일치`);
  else console.log(`  ⚠ 5/25 이후 ${chAfter.length}건 변경 (기대 13건)`);

  console.log("\n  5/25 이후 정정 예상 (각 행 dump):");
  for (const c of chAfter) {
    const oldSub = c.i.qty * c.i.unit_price;
    const newSub = c.i.qty * c.next;
    const recover = oldSub - newSub;
    console.log(`    ${c.i.tasks.task_no} | qty=${c.i.qty} | up: ${c.i.unit_price} → ${c.next} | subtotal: ${oldSub.toLocaleString()} → ${newSub.toLocaleString()} | 보정액 ₩${recover.toLocaleString()}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });
