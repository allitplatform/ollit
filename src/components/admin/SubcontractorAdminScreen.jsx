// 2026-10-06 Mig 212~214 — 협력사 관리 화면 (운영자 전용).
//   · 협력사 = 올데이케어가 일을 주는 회사. 원청 관리와 별개.
//   · 협력사 정보·사업자 정보 수정, 새 협력사 등록, 사용 중지.
//   · 직원 소속 지정은 기사 편집 화면의 "소속 협력사" 카드에서.
//   · 전부 RPC — 운영자 확인 + 세션 값은 서버에서 검사.
import { useCallback, useEffect, useState } from "react";
import {
  adminListSubcontractors, adminUpsertSubcontractor, loadSubcontractorIndex, subGetCutRates,
  listSubcontractorCategories, adminSetSubcontractorCategories, subGetCompanyAccount,
} from "../../lib/subcontractorsDb.js";
import { SubStaffReadOnlyList } from "../SubStaffManage.jsx";

// 2026-10-06 Mig 239 — 협력사 회사 계좌 (협력사 관리자가 등록, 운영자는 보기만). 계좌번호는 가려서 보여 준다.
function SubAccountLine({ subId }) {
  const [acc, setAcc] = useState(undefined);
  useEffect(() => {
    let alive = true;
    subGetCompanyAccount(false, subId).then(res => { if (alive) setAcc(res.ok ? (res.account || null) : undefined); });
    return () => { alive = false; };
  }, [subId]);
  if (acc === undefined) return null;
  return (
    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
      회사 계좌 {acc ? `${acc.bank || ""} ${acc.number_masked || ""} · 예금주 ${acc.holder || "—"}` : "미등록"} (협력사 관리자가 등록 · 보기 전용)
    </div>
  );
}

// 2026-10-06 Mig 235 — 협력사가 맡는 종목 (운영자만 설정) + 소속 기사 보기.
//   맡는 종목은 새 작업의 수행 추천과 기사별 "가능 종목" 의 범위로 쓰인다.
function SubExtras({ sub, cats, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = (cats.by_sub || []).filter(x => x.subcontractor_id === sub.id).map(x => x.code);
  async function toggle(code) {
    if (busy) return;
    const next = mine.includes(code) ? mine.filter(c => c !== code) : [...mine, code];
    setBusy(true);
    const res = await adminSetSubcontractorCategories(sub.id, next);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    onSaved();
  }
  const all = cats.all || [];
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      {all.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>맡는 종목</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {all.map(c => {
              const on = mine.includes(c.code);
              return (
                <button key={c.code} type="button" disabled={busy} onClick={() => toggle(c.code)} style={{
                  padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                  border: on ? "1.5px solid #8B5CF6" : "1px solid var(--border)",
                  background: on ? "rgba(139,92,246,0.12)" : "transparent", color: "var(--text-primary)",
                }}>{c.name}</button>
              );
            })}
          </div>
        </>
      )}
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        background: "transparent", border: "none", padding: "10px 0 0", fontSize: 12, fontWeight: 700,
        color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer", textDecoration: "underline",
      }}>소속 기사 {open ? "접기" : "보기"}</button>
      {open && <SubStaffReadOnlyList subId={sub.id}/>}
    </div>
  );
}

// 2026-10-06 Mig 231 — 회사 몫 %(협력사가 소속 기사에게서 떼는 비율). 운영자는 보기만 한다.
function CutRateLine({ subId }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    subGetCutRates(subId).then(res => { if (alive && res.ok) setD(res); });
    return () => { alive = false; };
  }, [subId]);
  if (!d) return null;
  return (
    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
      협력사 회사 몫 {d.current_pct}%
      {d.upcoming ? ` → ${d.upcoming.from}부터 ${d.upcoming.pct}%` : ""}
      {" "}(협력사 관리자가 설정 · 보기 전용 · 올데이케어 수수료와 무관)
    </div>
  );
}

const FIELDS = [
  { key: "name",                label: "협력사 이름",              required: true },
  { key: "phone",               label: "대표 연락처" },
  { key: "business_name",       label: "상호 (사업자등록증)" },
  { key: "representative_name", label: "대표자명" },
  { key: "business_no",         label: "사업자번호 (000-00-00000)" },
  { key: "business_address",    label: "사업장 주소" },
  { key: "tax_type",            label: "과세유형 (일반 / 간이)" },
  { key: "memo",                label: "메모" },
];
const BIZNO_RE = /^\d{3}-\d{2}-\d{5}$/;

function formatBizNo(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function SubcontractorAdminScreen({ onBack }) {
  const [rows, setRows] = useState([]);
  // 종목 목록 · 협력사별 맡는 종목 (Mig 235). 읽지 못하면 그 부분만 빠진다.
  const [cats, setCats] = useState({ all: [], by_sub: [] });
  const loadCats = useCallback(async () => {
    const res = await listSubcontractorCategories();
    if (res.ok) setCats({ all: res.all || [], by_sub: res.by_sub || [] });
  }, []);
  useEffect(() => { loadCats(); }, [loadCats]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);     // { id|null, form }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminListSubcontractors();
    if (!res.ok) setError(res.error || "불러오지 못했습니다.");
    else setRows(Array.isArray(res.subcontractors) ? res.subcontractors : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(row) {
    const form = { code: row ? row.code : "", active: row ? row.active !== false : true };
    for (const f of FIELDS) form[f.key] = (row && row[f.key]) || "";
    setEditing({ id: row ? row.id : null, form });
  }

  function setField(key, value) {
    setEditing(e => ({ ...e, form: { ...e.form, [key]: key === "business_no" ? formatBizNo(value) : value } }));
  }

  async function save() {
    if (!editing || busy) return;
    const f = editing.form;
    if (!String(f.name || "").trim()) { window.alert("협력사 이름을 입력해 주세요."); return; }
    if (!editing.id && !/^[a-z0-9_]{2,30}$/.test(String(f.code || ""))) {
      window.alert("코드는 영문 소문자·숫자·밑줄 2~30자로 입력해 주세요. (예: whitecore)");
      return;
    }
    if (f.business_no && !BIZNO_RE.test(f.business_no)) {
      window.alert("사업자번호 형식이 맞지 않습니다. (000-00-00000)");
      return;
    }
    const patch = { active: !!f.active };
    for (const fd of FIELDS) patch[fd.key] = String(f[fd.key] || "").trim();
    if (!editing.id) patch.code = String(f.code).trim();

    setBusy(true);
    const res = await adminUpsertSubcontractor(editing.id, patch);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    setEditing(null);
    loadSubcontractorIndex(true);   // 이름표 색인 갱신 (목록 표기·넘기기 버튼)
    load();
  }

  const card = {
    background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12,
  };
  const input = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
    fontSize: 14, fontFamily: "inherit",
  };
  const label = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "12px 0 6px", display: "block" };
  const ghost = {
    padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent",
    color: "var(--text-primary)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  };
  const main = { ...ghost, border: "none", background: "#8B5CF6", color: "#fff" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 60px", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {onBack && <button type="button" onClick={onBack} style={ghost}>← 뒤로</button>}
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>협력사 관리</div>
        {!editing && <button type="button" onClick={() => openEdit(null)} style={main}>+ 협력사 추가</button>}
      </div>

      {!editing && (
        <>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            협력사는 올데이케어가 일을 맡기는 회사입니다. 기사 소속은 기사 편집 화면의 "소속 협력사"에서 정합니다.
          </div>
          {loading && <div style={{ fontSize: 14, color: "var(--text-secondary)", padding: "30px 0", textAlign: "center" }}>불러오는 중…</div>}
          {error && <div style={{ ...card, color: "#E5484D", fontWeight: 700, lineHeight: 1.5 }}>{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div style={{ fontSize: 14, color: "var(--text-secondary)", padding: "30px 0", textAlign: "center" }}>등록된 협력사가 없습니다.</div>
          )}
          {rows.map(r => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {r.name}
                    {r.active === false && <span style={{ marginLeft: 8, fontSize: 11, color: "#E5484D" }}>사용 중지</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    관리자 {r.manager_count || 0}명 · 기사 {r.staff_count || 0}명 · 코드 {r.code}
                  </div>
                </div>
                <button type="button" onClick={() => openEdit(r)} style={ghost}>수정</button>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.7 }}>
                {r.business_name
                  ? <>{r.business_name} · {r.representative_name || "대표자 미입력"}<br/>사업자번호 {r.business_no || "미입력"} · {r.tax_type || "과세유형 미입력"}</>
                  : "사업자 정보 미입력"}
              </div>
              <CutRateLine subId={r.id}/>
              <SubAccountLine subId={r.id}/>
              <SubExtras sub={r} cats={cats} onSaved={loadCats}/>
            </div>
          ))}
        </>
      )}

      {editing && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{editing.id ? "협력사 정보 수정" : "새 협력사 등록"}</div>
          {!editing.id && (
            <>
              <label style={label}>코드 (영문 소문자, 등록 후 변경 불가)</label>
              <input style={input} value={editing.form.code} onChange={e => setField("code", e.target.value.toLowerCase())} placeholder="예: whitecore"/>
            </>
          )}
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={label}>{f.label}{f.required ? " *" : ""}</label>
              <input style={input} value={editing.form[f.key]} onChange={e => setField(f.key, e.target.value)}/>
            </div>
          ))}
          {editing.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 14, fontWeight: 600 }}>
              <input type="checkbox" checked={!!editing.form.active} onChange={e => setField("active", e.target.checked)}/>
              사용 중 (끄면 이 협력사 계정은 협력사 화면을 쓸 수 없고, 새 작업을 넘길 수 없습니다)
            </label>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => setEditing(null)} disabled={busy} style={{ ...ghost, flex: 1 }}>취소</button>
            <button type="button" onClick={save} disabled={busy} style={{ ...main, flex: 2 }}>{busy ? "저장 중…" : "저장"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubcontractorAdminScreen;
