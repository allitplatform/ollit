// 2026-10-06 Mig 225 — 협력사 일일 정산 화면 3종 (방식 B: 협력사 관리자가 날짜별 1회 송금 보고).
//   · SubStaffSettleTab     협력사 기사 — 날짜별 받은 금액 / 내 수익 / 수수료 (송금 보고 버튼 없음)
//   · SubManagerSettleView  협력사 관리자 — 기사별 금액 + 날짜별 [송금 보고]
//   · SubFeeAdminScreen     운영자 — 협력사·날짜별 [입금 확인], 작업별 내역
//   금액 기준 (공통): 내 수익 = 공급가 − 올데이케어 수수료 − 협력사 회사 몫. 부가세는 별도 표시(신고·납부용).
//   수수료는 올잇 계산값. 보고·확인된 날짜는 잠기고, 이후 변동은 다음 정산일의 추가분/차감분으로 나온다.
//   모든 조회·쓰기는 RPC (서버가 소속 확인).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subStaffListSettlement, subListDailySettlements, subReportDailyFee,
  adminListSubDailyFees, adminConfirmSubDailyFee,
} from "../lib/subcontractorsDb.js";

const won = (n) => `₩${Number(n || 0).toLocaleString("ko-KR")}`;
const signed = (n) => `${Number(n) < 0 ? "−" : "+"} ${won(Math.abs(Number(n) || 0))}`;
const dayLabel = (ymd) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
};
const STATUS_COLOR = {
  "대기":      { bg: "rgba(148,163,184,0.18)", fg: "var(--text-secondary)" },
  "보고됨":    { bg: "rgba(59,130,246,0.16)",  fg: "#3B82F6" },
  "확인 완료": { bg: "rgba(16,185,129,0.16)",  fg: "#059669" },
  "차액":      { bg: "rgba(229,72,77,0.14)",   fg: "#E5484D" },
  "미입금":    { bg: "rgba(229,72,77,0.14)",   fg: "#E5484D" },
};

const card = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10 };
const subText = { fontSize: 12, color: "var(--text-secondary)" };
const btnMain = {
  background: "var(--accent, #FF1B8D)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px",
  fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost = {
  background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px",
  fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};

function Row({ label, value, strong, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: strong ? 16 : 13, fontWeight: strong ? 800 : 700, color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR["대기"];
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function useLoader(fn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fn();
    if (!res.ok) setError(res.error || "불러오지 못했습니다.");
    else setData(res);
    setLoading(false);
  }, [fn]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, load };
}

// ─────────────────────────────────────────────────────────────
// 1) 협력사 기사 — 정산 탭 (보기 전용)
// ─────────────────────────────────────────────────────────────
export function SubStaffSettleTab({ user }) {
  const fn = useCallback(() => subStaffListSettlement(), []);
  const { data, loading, error, load } = useLoader(fn);
  const days = (data && data.days) || [];
  const [open, setOpen] = useState(null);
  const subName = user?.subcontractor?.name || "협력사";

  return (
    <div style={{ padding: "16px 14px 40px", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>내 정산</div>
        <button onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
      </div>
      <div style={{ ...subText, lineHeight: 1.6, marginBottom: 12 }}>
        수수료는 {subName}에 내고, {subName}가 올데이케어에 모아서 보냅니다. 이 화면은 금액 확인용입니다.
      </div>
      {error && <div style={{ ...card, color: "#E5484D", fontWeight: 700 }}>{error}</div>}
      {!error && !loading && days.length === 0 && (
        <div style={{ ...subText, textAlign: "center", padding: "40px 0" }}>최근 한 달 완료한 작업이 없습니다.</div>
      )}
      {days.map(d => (
        <div key={d.date} style={card}>
          <div onClick={() => setOpen(open === d.date ? null : d.date)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{dayLabel(d.date)}</span>
              <span style={subText}>{d.task_count}건 {open === d.date ? "▲" : "▼"}</span>
            </div>
            <Row label="받은 금액" value={won(d.received)}/>
            <Row label="내 수익 (부가세 제외)" value={won(d.net)} strong color="var(--accent, #FF1B8D)"/>
            <Row label={`${subName}에 낼 수수료`} value={won(d.fee)}/>
            {Number(d.staff_cut) > 0 && <Row label={`${subName} 회사 몫`} value={won(d.staff_cut)}/>}
            {Number(d.vat) > 0 && <Row label="부가세 (신고·납부용)" value={won(d.vat)}/>}
          </div>
          {open === d.date && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              {(d.tasks || []).map((t, i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.customer_name} <span style={subText}>{t.task_no}</span></div>
                  <div style={{ ...subText, marginTop: 2 }}>
                    받은 금액 {won(t.received)}{t.vat_included ? ` (부가세 ${won(t.vat)} 포함)` : ""} · 수수료 {won(t.fee)} · 내 수익 {won(t.net)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2) 협력사 관리자 — 정산 (기사별 금액 + 날짜별 송금 보고)
// ─────────────────────────────────────────────────────────────
function groupByEngineer(lines) {
  const m = new Map();
  for (const l of lines || []) {
    const key = l.engineer_id || "none";
    if (!m.has(key)) m.set(key, { name: l.engineer_name || "기사 미정", count: 0, received: 0, supply: 0, vat: 0, fee: 0, net: 0 });
    const g = m.get(key);
    if (l.kind === "base") { g.count += 1; g.received += Number(l.received) || 0; g.supply += Number(l.supply) || 0; g.vat += Number(l.vat) || 0; }
    g.fee += Number(l.fee) || 0;
    g.net += Number(l.net) || 0;
  }
  return [...m.values()];
}

export function SubManagerSettleView() {
  const fn = useCallback(() => subListDailySettlements(), []);
  const { data, loading, error, load } = useLoader(fn);
  const days = (data && data.days) || [];
  const [reporting, setReporting] = useState(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !reporting) return;
    const n = Number(String(amount).replace(/[^0-9]/g, ""));
    if (!Number.isFinite(n) || String(amount).trim() === "") { alert("실제 보낸 금액을 입력해 주세요."); return; }
    const diff = n - Number(reporting.fee || 0);
    const msg = diff === 0
      ? `${dayLabel(reporting.date)} 수수료 ${won(n)} 송금을 보고할까요?\n보고하면 이 날짜는 잠깁니다.`
      : `계산된 수수료는 ${won(reporting.fee)} 인데 ${won(n)} 로 보고합니다 (차액 ${signed(diff)}).\n그대로 보고할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await subReportDailyFee(reporting.date, n);
    setBusy(false);
    if (!res.ok) { alert(res.error || "보고하지 못했습니다."); return; }
    setReporting(null);
    load();
  }

  return (
    <div style={{ padding: "12px 12px 40px", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>수수료 정산</div>
        <button onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
      </div>
      <div style={{ ...subText, lineHeight: 1.6, marginBottom: 12 }}>
        날짜별로 올데이케어에 보낼 수수료입니다. 기사에게 걷은 뒤 하루에 한 번 송금하고 [송금 보고]를 눌러 주세요.
        보고한 날짜는 잠기고, 그 뒤 바뀐 금액은 다음 날짜에 추가분·차감분으로 나옵니다.
      </div>
      {error && <div style={{ ...card, color: "#E5484D", fontWeight: 700 }}>{error}</div>}
      {!error && !loading && days.length === 0 && (
        <div style={{ ...subText, textAlign: "center", padding: "40px 0" }}>정산할 내역이 없습니다.</div>
      )}
      {days.map(d => {
        const engs = groupByEngineer(d.lines);
        const adjust = (d.lines || []).filter(l => l.kind === "adjust");
        return (
          <div key={d.date} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{dayLabel(d.date)}</span>
              <StatusBadge status={d.status}/>
            </div>
            <Row label={`완료 ${d.task_count}건 · 받은 금액`} value={won(d.received)}/>
            <Row label="올데이케어에 보낼 수수료" value={won(d.fee)} strong color="var(--accent, #FF1B8D)"/>
            {d.reported_amount != null && <Row label="보고한 금액" value={won(d.reported_amount)}/>}
            {d.diff != null && Number(d.diff) !== 0 && <Row label="차액 (보고 − 계산)" value={signed(d.diff)} color="#E5484D"/>}

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              <div style={{ ...subText, fontWeight: 700, marginBottom: 4 }}>기사별 (기사에게 걷을 수수료)</div>
              {engs.map((g, i) => (
                <div key={i} style={{ padding: "5px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                    <span>{g.name} · {g.count}건</span><span>{won(g.fee)}</span>
                  </div>
                  <div style={{ ...subText, marginTop: 2 }}>
                    받은 금액 {won(g.received)} · 기사 수익 {won(g.net)}{g.vat > 0 ? ` · 부가세 ${won(g.vat)} 별도` : ""}
                  </div>
                </div>
              ))}
              {adjust.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ ...subText, fontWeight: 700, color: "#D97706", marginBottom: 2 }}>추가분 · 차감분</div>
                  {adjust.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                      <span>{l.customer_name} · {l.memo || ""}{l.origin_date ? ` (${dayLabel(l.origin_date)} 작업)` : ""}</span>
                      <span style={{ fontWeight: 700, color: Number(l.fee) < 0 ? "#3B82F6" : "#E5484D" }}>{signed(l.fee)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!d.locked && (
              <button
                onClick={() => { setReporting(d); setAmount(String(d.fee || 0)); }}
                style={{ ...btnMain, width: "100%", marginTop: 12 }}
              >송금 보고</button>
            )}
          </div>
        );
      })}

      {reporting && (
        <div onClick={() => { if (!busy) setReporting(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-secondary)", color: "var(--text-primary)", width: "100%", maxWidth: 560, boxSizing: "border-box",
            borderRadius: "18px 18px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>송금 보고 · {dayLabel(reporting.date)}</div>
            <div style={{ ...subText, margin: "4px 0 12px" }}>계산된 수수료 {won(reporting.fee)} · 실제 보낸 금액을 입력해 주세요</div>
            <input
              type="text" inputMode="numeric" autoComplete="off"
              value={amount === "" ? "" : Number(String(amount).replace(/[^0-9]/g, "") || 0).toLocaleString("ko-KR")}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              style={{
                display: "block", width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: 12,
                border: "2px solid var(--accent, #FF1B8D)", background: "var(--bg-elevated)", color: "var(--text-primary)",
                fontSize: 22, fontWeight: 800, textAlign: "right", fontFamily: "inherit",
              }}
            />
            <button disabled={busy} onClick={submit} style={{ ...btnMain, width: "100%", marginTop: 14, padding: "14px" }}>
              {busy ? "보고 중…" : "보고하기"}
            </button>
            <button disabled={busy} onClick={() => setReporting(null)} style={{ ...btnGhost, width: "100%", marginTop: 8 }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3) 운영자 — 협력사 수수료 (협력사·날짜별, 입금 확인)
// ─────────────────────────────────────────────────────────────
export function SubFeeAdminScreen({ onBack, onOpenTask }) {
  const fn = useCallback(() => adminListSubDailyFees(), []);
  const { data, loading, error, load } = useLoader(fn);
  const subs = (data && data.subcontractors) || [];
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const out = [];
    for (const s of subs) for (const d of (s.days || [])) out.push({ ...d, subId: s.id, subName: s.name, key: `${s.id}|${d.date}` });
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.subName.localeCompare(b.subName, "ko"));
    return out;
  }, [subs]);

  const totals = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    let todayCount = 0, todayReceived = 0, todayFee = 0, unpaid = 0;
    for (const r of rows) {
      if (r.date === today) { todayCount += r.task_count || 0; todayReceived += r.received || 0; todayFee += r.fee || 0; }
      if (r.status !== "확인 완료") unpaid += r.fee || 0;
    }
    return { todayCount, todayReceived, todayFee, unpaid };
  }, [rows]);

  async function confirmRow(r, confirm) {
    if (busy) return;
    const msg = confirm
      ? `${r.subName} · ${dayLabel(r.date)}\n보고 금액 ${won(r.reported_amount)} 입금을 확인할까요?${Number(r.diff) !== 0 ? `\n(계산 수수료 ${won(r.fee)} 과 차액 ${signed(r.diff)})` : ""}`
      : `${r.subName} · ${dayLabel(r.date)} 입금 확인을 취소할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await adminConfirmSubDailyFee(r.subId, r.date, confirm);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    load();
  }

  const stat = (label, value, color) => (
    <div style={{ ...card, marginBottom: 0, flex: "1 1 140px" }}>
      <div style={subText}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px 60px", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {onBack && <button type="button" onClick={onBack} style={btnGhost}>← 뒤로</button>}
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>협력사 수수료</div>
        <button onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {stat("오늘 완료", `${totals.todayCount}건`)}
        {stat("오늘 받은 금액 합계", won(totals.todayReceived))}
        {stat("오늘 받을 수수료", won(totals.todayFee), "var(--accent, #FF1B8D)")}
        {stat("미확인 수수료 누적", won(totals.unpaid), totals.unpaid > 0 ? "#E5484D" : undefined)}
      </div>

      {error && <div style={{ ...card, color: "#E5484D", fontWeight: 700 }}>{error}</div>}
      {!error && !loading && rows.length === 0 && (
        <div style={{ ...subText, textAlign: "center", padding: "40px 0" }}>최근 한 달 협력사 정산 내역이 없습니다.</div>
      )}

      {rows.map(r => (
        <div key={r.key} style={card}>
          <div onClick={() => setOpen(open === r.key ? null : r.key)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{r.subName}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>{dayLabel(r.date)}</span>
              <StatusBadge status={r.status}/>
            </div>
            <Row label={`완료 ${r.task_count}건 · 받은 금액 합계`} value={won(r.received)}/>
            <Row label="받을 수수료 (올잇 계산)" value={won(r.fee)} strong color="var(--accent, #FF1B8D)"/>
            <Row label="보고 금액" value={r.reported_amount != null ? won(r.reported_amount) : "보고 전"}/>
            {r.diff != null && Number(r.diff) !== 0 && <Row label="차액 (보고 − 계산)" value={signed(r.diff)} color="#E5484D"/>}
            <div style={{ ...subText, textAlign: "right", marginTop: 2 }}>{open === r.key ? "접기 ▲" : "작업별 내역 ▼"}</div>
          </div>

          {open === r.key && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              {(r.lines || []).map((l, i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 700 }}>
                    <span>
                      {l.kind === "adjust" && <span style={{ color: "#D97706" }}>[{Number(l.fee) < 0 ? "차감분" : "추가분"}] </span>}
                      {l.task_no} · {l.engineer_name || "기사 미정"}
                    </span>
                    <span style={{ color: l.kind === "adjust" ? (Number(l.fee) < 0 ? "#3B82F6" : "#E5484D") : "var(--text-primary)" }}>
                      {l.kind === "adjust" ? signed(l.fee) : won(l.fee)}
                    </span>
                  </div>
                  <div style={{ ...subText, marginTop: 2, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>
                      {l.customer_name} · 받은 금액 {won(l.received)} · 공급가 {won(l.supply)}
                      {l.kind === "adjust" && l.memo ? ` · ${l.memo}` : ""}
                    </span>
                    {onOpenTask && (
                      <button type="button" onClick={() => onOpenTask(l.task_id)} style={{ ...btnGhost, padding: "2px 8px", fontSize: 11 }}>
                        사진 {l.photo_count || 0}장 · 열기
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {r.locked && !r.confirmed_at && (
              <button disabled={busy} onClick={() => confirmRow(r, true)} style={{ ...btnMain, flex: 1 }}>입금 확인</button>
            )}
            {r.confirmed_at && (
              <button disabled={busy} onClick={() => confirmRow(r, false)} style={{ ...btnGhost, flex: 1 }}>확인 취소</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
