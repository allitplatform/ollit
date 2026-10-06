// 2026-10-06 Mig 231 — 협력사 관리자 "기사 관리".
//   할 수 있는 것: 소속 기사 목록 / 추가 / 담당 지역 수정 / 비활성·재활성 / 회사 몫 % 설정.
//   할 수 없는 것(운영자만): 삭제 · 올데이케어 수수료 · 소속 변경 · 관리자 지정.
//   서버가 매번 "호출자의 협력사 소속인지" 확인한다 (화면에서 숨기는 것만으로 막지 않는다).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subManageListStaff, subAddStaff, subUpdateStaffZones, subSetStaffActive,
  subGetCutRates, subSetCutRate,
} from "../lib/subcontractorsDb.js";

const card = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14,
  padding: "14px 14px", marginBottom: 10,
};
const label = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 6px" };
const input = {
  display: "block", width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, minHeight: 44,
  border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)",
  fontSize: 16, fontFamily: "inherit",
};
const btnMain = {
  background: "var(--accent, #FF1B8D)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px",
  fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px",
  fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };

const splitZones = (text) => String(text || "").split(/[,\s·/]+/).map(z => z.trim()).filter(Boolean);
const ymdLabel = (ymd) => (ymd ? `${Number(String(ymd).slice(5, 7))}/${Number(String(ymd).slice(8, 10))}` : "");

function Sheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-secondary)", color: "var(--text-primary)", width: "100%", maxWidth: 560, maxHeight: "86vh", overflowY: "auto",
        borderRadius: "18px 18px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px)", boxSizing: "border-box",
      }}>{children}</div>
    </div>
  );
}

// 담당 지역 입력 — 이미 쓰는 지역은 칩으로 고르고, 없는 지역은 글자로 추가
function ZonePicker({ known, value, onChange }) {
  const [text, setText] = useState("");
  const set = new Set(value);
  const toggle = (z) => { const n = new Set(set); if (n.has(z)) n.delete(z); else n.add(z); onChange([...n]); };
  const addText = () => {
    const add = splitZones(text);
    if (add.length === 0) return;
    onChange([...new Set([...value, ...add])]);
    setText("");
  };
  const all = [...new Set([...known, ...value])].sort((a, b) => a.localeCompare(b, "ko"));
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
        {all.length === 0 && <span style={small}>아래에 지역 이름을 적어 추가해 주세요.</span>}
        {all.map(z => (
          <button key={z} type="button" onClick={() => toggle(z)} style={{
            padding: "7px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
            border: set.has(z) ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
            background: set.has(z) ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
            color: "var(--text-primary)",
          }}>{z}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="지역 추가 (예: 강남구, 수원시)" style={{ ...input, flex: 1 }}/>
        <button type="button" onClick={addText} style={btnGhost}>추가</button>
      </div>
      <div style={{ ...small, marginTop: 6 }}>선택 {value.length}곳</div>
    </>
  );
}

// ── 회사 몫 % ────────────────────────────────────────────────
function CutRateCard({ subName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState("");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const res = await subGetCutRates();
    if (!res.ok) { setError(res.error || "회사 몫을 불러오지 못했습니다."); return; }
    setError(""); setData(res);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openEdit() {
    setPct(String(data?.current_pct ?? 0));
    setFrom(data?.today || "");
    setOpen(true);
  }

  async function save() {
    if (busy) return;
    const n = Number(pct);
    if (pct === "" || !Number.isInteger(n) || n < 0 || n > 100) { window.alert("비율은 0~100 사이 정수로 입력해 주세요."); return; }
    if (!from) { window.alert("적용 시작일을 정해 주세요."); return; }
    if (data?.today && from < data.today) { window.alert("적용 시작일은 오늘 또는 그 이후 날짜만 가능합니다."); return; }
    if (!window.confirm(`${ymdLabel(from)}부터 완료하는 작업에 회사 몫 ${n}%를 적용할까요?\n이미 완료한 작업은 바뀌지 않습니다.`)) return;
    setBusy(true);
    const res = await subSetCutRate(n, from);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    setOpen(false);
    load();
  }

  const history = (data && data.history) || [];
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{subName} 회사 몫</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{data ? `${data.current_pct}%` : "…"}</div>
        </div>
        <button type="button" onClick={openEdit} disabled={!data} style={btnGhost}>변경</button>
      </div>
      {error && <div style={{ ...small, color: "var(--danger, #E5484D)", marginTop: 6 }}>{error}</div>}
      {data?.upcoming && (
        <div style={{ ...small, marginTop: 6, color: "var(--text-primary)" }}>
          {ymdLabel(data.upcoming.from)}부터 {data.upcoming.pct}% 적용 예정
        </div>
      )}
      <div style={{ ...small, marginTop: 8 }}>
        기사 수익 = 공급가 − 올데이케어 수수료 − 회사 몫(공급가 × 이 비율).
        올데이케어 수수료와는 무관한, {subName} 안의 분배입니다. 작업을 완료한 날의 비율이 그 작업에 고정됩니다.
      </div>
      {history.length > 0 && (
        <button type="button" onClick={() => setShowHistory(v => !v)} style={{ ...btnGhost, border: "none", padding: "8px 0 0", color: "var(--text-secondary)" }}>
          변경 이력 {history.length}건 {showHistory ? "접기" : "보기"}
        </button>
      )}
      {showHistory && history.map((h, i) => (
        <div key={i} style={{ ...small, display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
          <span>{String(h.from) <= "2000-01-01" ? "처음부터" : `${h.from}부터`} {h.pct}%</span>
          <span>{h.by || "시작 값"} · {String(h.created_at || "").slice(0, 10)}</span>
        </div>
      ))}

      {open && (
        <Sheet onClose={() => { if (!busy) setOpen(false); }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>회사 몫 변경</div>
          <div style={{ ...small, margin: "4px 0 6px" }}>적용 시작일부터 완료하는 작업에만 적용됩니다. 이미 완료한 작업은 바뀌지 않습니다.</div>
          <label style={label}>비율 (0~100, 정수)</label>
          <input type="number" inputMode="numeric" min={0} max={100} step={1} value={pct} onChange={e => setPct(e.target.value)} style={input}/>
          <label style={label}>적용 시작일 (오늘 또는 그 이후)</label>
          <input type="date" min={data?.today || undefined} value={from} onChange={e => setFrom(e.target.value)} style={input}/>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} style={{ ...btnGhost, flex: 1, padding: "12px 0" }}>닫기</button>
            <button type="button" disabled={busy} onClick={save} style={{ ...btnMain, flex: 1 }}>{busy ? "저장 중…" : "저장"}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ── 기사 관리 본문 ───────────────────────────────────────────
export default function SubStaffManage({ subName = "협력사" }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);     // 지역 수정 대상
  const [form, setForm] = useState({ name: "", phone: "", region: "", zones: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await subManageListStaff();
    if (!res.ok) setError(res.error || "기사 목록을 불러오지 못했습니다.");
    else { setError(""); setStaff(Array.isArray(res.staff) ? res.staff : []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const knownZones = useMemo(() => {
    const set = new Set();
    for (const s of staff) for (const z of (Array.isArray(s.zones) ? s.zones : [])) if (z) set.add(z);
    return [...set];
  }, [staff]);

  const shown = useMemo(() => {
    const kw = q.trim();
    const digits = kw.replace(/\D/g, "");
    if (!kw) return staff;
    return staff.filter(s => String(s.name || "").includes(kw)
      || (!!digits && String(s.phone || "").replace(/\D/g, "").endsWith(digits)));
  }, [staff, q]);
  const activeCount = staff.filter(s => s.is_active).length;

  function openAdd() { setForm({ name: "", phone: "", region: "", zones: [] }); setAdding(true); }
  function openEdit(s) { setForm({ name: s.name, phone: s.phone, region: s.region || "", zones: Array.isArray(s.zones) ? s.zones : [] }); setEditing(s); }

  async function saveAdd() {
    if (busy) return;
    if (!form.name.trim()) { window.alert("이름을 입력해 주세요."); return; }
    if (!/^01\d{8,9}$/.test(form.phone.replace(/\D/g, ""))) { window.alert("휴대폰 번호를 확인해 주세요."); return; }
    setBusy(true);
    const res = await subAddStaff(form.name.trim(), form.phone, form.region, form.zones);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "추가하지 못했습니다."); return; }
    setAdding(false);
    window.alert(`${res.name} 기사를 추가했습니다.\n처음 로그인할 때 비밀번호는 전화번호 뒤 4자리이고, 로그인하면 바로 바꾸게 됩니다.`);
    load();
  }

  async function saveEdit() {
    if (busy || !editing) return;
    setBusy(true);
    const res = await subUpdateStaffZones(editing.id, form.region, form.zones);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    setEditing(null);
    load();
  }

  async function toggleActive(s) {
    if (busy) return;
    const next = !s.is_active;
    if (!window.confirm(next
      ? `${s.name} 기사를 다시 활성으로 바꿀까요?`
      : `${s.name} 기사를 비활성으로 바꿀까요?\n로그인할 수 없게 되고 배정 목록에서 빠집니다. 지난 작업·정산 기록은 그대로 남습니다.`)) return;
    setBusy(true);
    const res = await subSetStaffActive(s.id, next);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    load();
  }

  return (
    <div style={{ padding: "12px 12px 24px", color: "var(--text-primary)" }}>
      <CutRateCard subName={subName}/>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 2px 8px" }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>
          소속 기사 <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{activeCount}명{staff.length > activeCount ? ` · 비활성 ${staff.length - activeCount}` : ""}</span>
        </div>
        <button type="button" onClick={load} disabled={loading} style={btnGhost}>{loading ? "…" : "새로고침"}</button>
        <button type="button" onClick={openAdd} style={btnMain}>기사 추가</button>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 또는 전화 뒷자리" style={{ ...input, background: "var(--bg-elevated)", marginBottom: 10 }}/>

      {error && <div style={{ ...small, color: "var(--danger, #E5484D)", padding: "10px 2px" }}>{error}</div>}
      {!error && !loading && shown.length === 0 && <div style={{ ...small, textAlign: "center", padding: "22px 0" }}>해당하는 기사가 없습니다.</div>}

      {shown.map(s => {
        const zones = Array.isArray(s.zones) ? s.zones : [];
        const zoneLine = zones.length > 6 ? `${zones.slice(0, 6).join("·")} 외 ${zones.length - 6}` : zones.join("·");
        const isManager = s.sub_role === "manager";
        return (
          <div key={s.id} style={{ ...card, opacity: s.is_active ? 1 : 0.55 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</span>
              {isManager && <span style={{ ...small, fontWeight: 800 }}>관리자</span>}
              {!s.is_active && <span style={{ ...small, fontWeight: 800 }}>비활성</span>}
              <span style={{ ...small, marginLeft: "auto" }}>{s.code}</span>
            </div>
            <div style={{ ...small, marginTop: 4 }}>
              {s.phone}{Number(s.open_tasks) > 0 ? ` · 진행할 작업 ${s.open_tasks}건` : ""}
            </div>
            <div style={{ ...small, marginTop: 4, color: "var(--text-primary)" }}>
              {s.region ? `${s.region} · ` : ""}{zoneLine || "담당 지역 없음"}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={() => openEdit(s)} style={btnGhost}>지역 수정</button>
              {!isManager && (
                <button type="button" disabled={busy} onClick={() => toggleActive(s)}
                  style={{ ...btnGhost, color: s.is_active ? "var(--danger, #E5484D)" : "var(--text-primary)" }}>
                  {s.is_active ? "비활성" : "다시 활성"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ ...small, padding: "6px 2px" }}>
        삭제 · 소속 변경 · 관리자 지정은 올데이케어 운영자에게 요청해 주세요.
      </div>

      {(adding || editing) && (
        <Sheet onClose={() => { if (!busy) { setAdding(false); setEditing(null); } }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{adding ? "기사 추가" : `${editing.name} · 담당 지역`}</div>
          {adding && (
            <>
              <label style={label}>이름</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input}/>
              <label style={label}>휴대폰 번호 (로그인 아이디)</label>
              <input type="tel" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" style={input}/>
            </>
          )}
          <label style={label}>지역 표시 이름 (예: 경기남부)</label>
          <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={input}/>
          <label style={label}>담당 지역</label>
          <ZonePicker known={knownZones} value={form.zones} onChange={zones => setForm(f => ({ ...f, zones }))}/>
          {adding && <div style={{ ...small, marginTop: 10 }}>초기 비밀번호는 전화번호 뒤 4자리이며, 처음 로그인할 때 바꾸게 됩니다.</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" disabled={busy} onClick={() => { setAdding(false); setEditing(null); }} style={{ ...btnGhost, flex: 1, padding: "12px 0" }}>닫기</button>
            <button type="button" disabled={busy} onClick={adding ? saveAdd : saveEdit} style={{ ...btnMain, flex: 1 }}>{busy ? "저장 중…" : "저장"}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
