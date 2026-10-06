// 2026-10-06 Mig 231, 235 — 협력사 관리자 "기사 관리".
//   할 수 있는 것: 소속 기사 목록 / 추가 / 정보 수정(이름·지역·가능 종목·메모) / 비활성·재활성 / 회사 몫 % 설정
//                  / 기사 상세 보기(기사가 직접 입력한 계좌·사업자 정보 — 보기만).
//   할 수 없는 것(운영자만): 삭제 · 전화번호 변경 · 올데이케어 수수료 · 소속 변경 · 관리자 지정.
//   서버가 매번 "호출자의 협력사 소속인지" 확인한다 (화면에서 숨기는 것만으로 막지 않는다).
//   운영자 화면(협력사 관리)도 StaffDetailSheet / SubStaffReadOnlyList 를 같이 쓴다.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subManageListStaff, subAddStaff, subUpdateStaffZones, subSetStaffActive,
  subGetCutRates, subSetCutRate,
  subStaffDirectory, subGetStaffDetail, subRevealStaffAccount, subUpdateStaff,
} from "../lib/subcontractorsDb.js";
import BottomSheet, { SheetButtons } from "./BottomSheet.jsx";
import { ZONE_GROUPS, zoneSummaryParts, zoneSummaryText, zoneRegionLabel } from "../utils/zoneGroups.js";

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
const chipStyle = (on) => ({
  padding: "7px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
  background: on ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
  color: "var(--text-primary)",
});

const splitZones = (text) => String(text || "").split(/[,\s·/]+/).map(z => z.trim()).filter(Boolean);
const ymdLabel = (ymd) => (ymd ? `${Number(String(ymd).slice(5, 7))}/${Number(String(ymd).slice(8, 10))}` : "");
const catNames = (codes, subCats) => (codes || []).map(c => (subCats.find(x => x.code === c) || {}).name || c);

// 담당 지역 요약 한 줄 — "서울 전체 · 경기 31곳". 누르면 펼쳐서 전체 지역을 보여 준다.
export function ZoneSummary({ zones, region }) {
  const [open, setOpen] = useState(false);
  const list = Array.isArray(zones) ? zones : [];
  if (list.length === 0) return <span style={small}>{region || "담당 지역 없음"}</span>;
  const few = list.length <= 3;
  return (
    <span>
      <span
        onClick={few ? undefined : (e) => { e.stopPropagation(); setOpen(v => !v); }}
        style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, cursor: few ? "default" : "pointer" }}
      >
        {zoneSummaryText(list)}
        {!few && <span style={{ color: "var(--text-secondary)", marginLeft: 4 }}>{open ? "▲" : "▼"}</span>}
      </span>
      {open && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {[...list].sort((a, b) => a.localeCompare(b, "ko")).map(z => (
            <span key={z} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{z}</span>
          ))}
        </span>
      )}
    </span>
  );
}

// 전화 · 문자 아이콘 버튼 (번호가 없으면 그리지 않는다)
export function ContactIcons({ phone, size = 36 }) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  const a = {
    width: size, height: size, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)",
    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none", flexShrink: 0,
  };
  return (
    <span style={{ display: "inline-flex", gap: 6 }} onClick={e => e.stopPropagation()}>
      <a href={`tel:${digits}`} aria-label="전화" title="전화" style={a}>📞</a>
      <a href={`sms:${digits}`} aria-label="문자" title="문자" style={a}>💬</a>
    </span>
  );
}

// 담당 지역 입력 — 맨 위 권역 버튼으로 한 번에 고르고, "세부 조정" 을 펼치면 개별 지역 칩.
//   저장되는 값은 지금처럼 개별 시·군·구 이름이다.
function ZonePicker({ known, value, onChange }) {
  const [text, setText] = useState("");
  const [detail, setDetail] = useState(false);
  const set = new Set(value);
  const toggle = (z) => { const n = new Set(set); if (n.has(z)) n.delete(z); else n.add(z); onChange([...n]); };
  const groupOn = (g) => g.zones.every(z => set.has(z));
  const toggleGroup = (g) => {
    const n = new Set(set);
    if (groupOn(g)) {
      // 끌 때: 다른 켜진 권역에도 들어 있는 지역은 남긴다 (경기동부·북부가 겹치는 남양주 등)
      const keep = new Set();
      for (const o of ZONE_GROUPS) if (o.key !== g.key && o.zones.every(z => set.has(z))) for (const z of o.zones) keep.add(z);
      for (const z of g.zones) if (!keep.has(z)) n.delete(z);
    } else {
      for (const z of g.zones) n.add(z);
    }
    onChange([...n]);
  };
  const addText = () => {
    const add = splitZones(text);
    if (add.length === 0) return;
    onChange([...new Set([...value, ...add])]);
    setText("");
  };
  const grouped = new Set(ZONE_GROUPS.flatMap(g => g.zones));
  const all = [...new Set([...grouped, ...known, ...value])].sort((a, b) => a.localeCompare(b, "ko"));
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ZONE_GROUPS.map(g => (
          <button key={g.key} type="button" onClick={() => toggleGroup(g)} style={{ ...chipStyle(groupOn(g)), padding: "9px 12px", fontSize: 13 }}>{g.label}</button>
        ))}
      </div>
      <div style={{ ...small, marginTop: 8, color: "var(--text-primary)" }}>
        선택 {value.length}곳{value.length > 0 ? ` — ${zoneSummaryParts(value).join(" · ")}` : ""}
      </div>
      <button type="button" onClick={() => setDetail(v => !v)} style={{ ...btnGhost, border: "none", padding: "8px 0", color: "var(--text-secondary)", textDecoration: "underline" }}>
        세부 조정 {detail ? "접기" : "펼치기"}
      </button>
      {detail && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {all.map(z => <button key={z} type="button" onClick={() => toggle(z)} style={chipStyle(set.has(z))}>{z}</button>)}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="지역 추가 (예: 천안시)" style={{ ...input, flex: 1, width: "auto", minWidth: 0 }}/>
            <button type="button" onClick={addText} style={btnGhost}>추가</button>
          </div>
        </>
      )}
    </>
  );
}

// ── 기사 상세 (보기 전용) — 협력사 관리자·운영자 공용 ─────────
//   기사가 직접 입력한 정산 계좌·사업자 정보를 보여 준다. 수정은 기사 본인만.
//   계좌번호는 가려서 오고, [전체 보기] 를 누르면 서버가 조회 기록을 남기고 번호를 준다.
export function StaffDetailSheet({ userId, onClose, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [full, setFull] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    subGetStaffDetail(userId).then(res => {
      if (!alive) return;
      if (!res.ok) setError(res.error || "기사 정보를 불러오지 못했습니다.");
      else setData(res);
    });
    return () => { alive = false; };
  }, [userId]);

  async function reveal() {
    if (busy) return;
    if (!window.confirm("계좌번호 전체를 표시합니다.\n누가 언제 봤는지 조회 기록이 남습니다.")) return;
    setBusy(true);
    const res = await subRevealStaffAccount(userId);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "표시하지 못했습니다."); return; }
    setFull(res.number || "");
  }

  const s = data && data.staff;
  const subCats = (data && data.sub_categories) || [];
  const row = (k, v) => (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13 }}>
      <span style={{ width: 84, flexShrink: 0, color: "var(--text-secondary)", fontWeight: 600 }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, wordBreak: "break-all" }}>{v || "—"}</span>
    </div>
  );
  const empty = (text) => <div style={{ ...small, padding: "4px 0" }}>{text}</div>;
  const sect = (title) => <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", margin: "16px 0 4px", paddingTop: 12, borderTop: "1px solid var(--border)" }}>{title}</div>;

  return (
    <BottomSheet
      onClose={onClose}
      title={s ? s.name : "기사 상세"}
      header={s ? <div style={{ marginTop: 8 }}><ContactIcons phone={s.phone}/></div> : null}
      footer={<SheetButtons onCancel={onClose} cancelLabel="닫기" onOk={s && onEdit ? () => onEdit(s) : null} okLabel="수정"/>}
    >
      {!data && !error && <div style={{ ...small, padding: "22px 0", textAlign: "center" }}>불러오는 중…</div>}
      {error && <div style={{ ...small, color: "var(--danger, #E5484D)", padding: "22px 0", textAlign: "center" }}>{error}</div>}
      {s && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={small}>{s.code}</span>
            <span style={{ ...small, fontWeight: 800 }}>{s.sub_role === "manager" ? "관리자" : "기사"} · {s.is_active ? "활성" : "비활성"}</span>
          </div>
          {row("전화", s.phone)}
          {row("담당 지역", <ZoneSummary zones={s.zones} region={s.region}/>)}
          {row("가능 종목", catNames(s.categories, subCats).join(" · ") || (subCats.length === 0 ? "종목 구분 없음" : "없음"))}
          {row("메모", s.memo)}

          {sect("정산 계좌 (기사가 입력)")}
          {!data.account ? empty("기사가 아직 입력하지 않음") : (
            <>
              {row("은행", data.account.bank)}
              {row("예금주", data.account.holder)}
              {row("계좌번호", full || data.account.number_masked)}
              {!full && <button type="button" disabled={busy} onClick={reveal} style={{ ...btnGhost, marginTop: 4 }}>{busy ? "…" : "전체 보기"}</button>}
            </>
          )}

          {sect("사업자 정보 (기사가 입력)")}
          {!data.business ? empty("기사가 아직 입력하지 않음 — 입력 전에는 이 기사 이름으로 영수증을 발급할 수 없습니다.") : (
            <>
              {row("상호", data.business.business_name)}
              {row("대표자", data.business.representative_name)}
              {row("사업자번호", data.business.business_no)}
              {row("사업장 주소", data.business.business_address)}
              {row("과세유형", data.business.tax_type)}
            </>
          )}
          <div style={{ ...small, marginTop: 10 }}>계좌·사업자 정보는 기사 본인이 앱 설정에서 입력·수정합니다. 전화번호 변경은 올데이케어에 요청해 주세요.</div>

          {(data.changes || []).length > 0 && (
            <>
              {sect("처리 이력")}
              {data.changes.map((c, i) => (
                <div key={i} style={{ ...small, display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" }}>
                  <span>{c.action === "view_account" ? "계좌번호 전체 조회" : "정보 수정"}</span>
                  <span>{c.actor || ""} · {String(c.created_at || "").slice(0, 10)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}

// ── 운영자용: 협력사 기사 목록 (보기 전용) ───────────────────
export function SubStaffReadOnlyList({ subId }) {
  const [staff, setStaff] = useState(null);
  const [subCats, setSubCats] = useState([]);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    let alive = true;
    subStaffDirectory(subId).then(res => {
      if (!alive) return;
      if (!res.ok) { setError(res.error || "기사 목록을 불러오지 못했습니다."); return; }
      setStaff(Array.isArray(res.staff) ? res.staff : []);
      setSubCats(Array.isArray(res.sub_categories) ? res.sub_categories : []);
    });
    return () => { alive = false; };
  }, [subId]);
  if (error) return <div style={{ ...small, color: "var(--danger, #E5484D)", marginTop: 8 }}>{error}</div>;
  if (!staff) return <div style={{ ...small, marginTop: 8 }}>불러오는 중…</div>;
  return (
    <div style={{ marginTop: 8 }}>
      {staff.length === 0 && <div style={small}>등록된 기사가 없습니다.</div>}
      {staff.map(s => (
        <button key={s.id} type="button" onClick={() => setViewing(s.id)} style={{
          display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none",
          borderTop: "1px solid var(--border)", padding: "9px 0", fontFamily: "inherit", cursor: "pointer",
          color: "var(--text-primary)", opacity: s.is_active ? 1 : 0.55,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
          <span style={{ ...small, marginLeft: 6 }}>
            {s.sub_role === "manager" ? "관리자 · " : ""}{s.phone}
            {catNames(s.categories, subCats).length > 0 ? ` · ${catNames(s.categories, subCats).join("·")}` : ""}
            {!s.is_active ? " · 비활성" : ""}
          </span>
          {!s.business_set && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger, #E5484D)", marginLeft: 6 }}>사업자 미입력</span>}
        </button>
      ))}
      {viewing && <StaffDetailSheet userId={viewing} onClose={() => setViewing(null)}/>}
    </div>
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
        <BottomSheet
          onClose={() => { if (!busy) setOpen(false); }}
          title="회사 몫 변경"
          subtitle="적용 시작일부터 완료하는 작업에만 적용됩니다. 이미 완료한 작업은 바뀌지 않습니다."
          footer={<SheetButtons onCancel={() => setOpen(false)} onOk={save} busy={busy}/>}
        >
          <label style={label}>비율 (0~100, 정수)</label>
          <input type="number" inputMode="numeric" min={0} max={100} step={1} value={pct} onChange={e => setPct(e.target.value)} style={input}/>
          <label style={label}>적용 시작일 (오늘 또는 그 이후)</label>
          <input type="date" min={data?.today || undefined} value={from} onChange={e => setFrom(e.target.value)} style={input}/>
        </BottomSheet>
      )}
    </div>
  );
}

// ── 기사 관리 본문 ───────────────────────────────────────────
export default function SubStaffManage({ subName = "협력사" }) {
  const [staff, setStaff] = useState([]);
  const [subCats, setSubCats] = useState([]);       // 협력사가 맡는 종목 [{code, name}]
  const [extended, setExtended] = useState(false);  // mig 235 사용 가능 여부 (없으면 지역 수정만)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", region: "", zones: [], categories: [], memo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    // mig 235 의 목록을 먼저 쓰고, 아직 없으면 mig 231 목록으로 (화면이 비지 않게)
    let res = await subStaffDirectory();
    let ext = !!res.ok;
    if (!res.ok) res = await subManageListStaff();
    if (!res.ok) setError(res.error || "기사 목록을 불러오지 못했습니다.");
    else {
      setError("");
      setStaff(Array.isArray(res.staff) ? res.staff : []);
      setSubCats(Array.isArray(res.sub_categories) ? res.sub_categories : []);
      setExtended(ext);
    }
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

  // 추가 화면의 가능 종목 기본값 = 협력사가 맡는 종목 전부
  function openAdd() { setForm({ name: "", phone: "", region: "", zones: [], categories: subCats.map(c => c.code), memo: "" }); setAdding(true); }
  function openEdit(s) {
    setViewing(null);
    setForm({
      name: s.name || "", phone: s.phone || "", region: s.region || "",
      zones: Array.isArray(s.zones) ? s.zones : [],
      categories: Array.isArray(s.categories) ? s.categories : subCats.map(c => c.code),
      memo: s.memo || "",
    });
    setEditing(s);
  }

  async function saveAdd() {
    if (busy) return;
    if (!form.name.trim()) { window.alert("이름을 입력해 주세요."); return; }
    if (!/^01\d{8,9}$/.test(form.phone.replace(/\D/g, ""))) { window.alert("휴대폰 번호를 확인해 주세요."); return; }
    setBusy(true);
    const res = await subAddStaff(form.name.trim(), form.phone, zoneRegionLabel(form.zones), form.zones);
    if (!res.ok) { setBusy(false); window.alert(res.error || "추가하지 못했습니다."); return; }
    // 가능 종목·메모는 추가 직후 같은 수정 RPC 로 한 번에 반영한다 (전부 체크 + 메모 없음이면 기본값이라 생략)
    const allChecked = subCats.length > 0 && subCats.every(c => form.categories.includes(c.code));
    if (extended && res.id && (form.memo.trim() || (subCats.length > 0 && !allChecked))) {
      const up = await subUpdateStaff(res.id, {
        name: form.name.trim(), region: zoneRegionLabel(form.zones), zones: form.zones,
        categories: subCats.length > 0 && !allChecked ? form.categories : null,
        memo: form.memo,
      });
      if (!up.ok) window.alert(`기사는 추가했지만 가능 종목·메모를 저장하지 못했습니다.\n[수정]에서 다시 저장해 주세요.\n(${up.error || "오류"})`);
    }
    setBusy(false);
    setAdding(false);
    window.alert(`${res.name} 기사를 추가했습니다.\n처음 로그인할 때 비밀번호는 전화번호 뒤 4자리이고, 로그인하면 바로 바꾸게 됩니다.`);
    load();
  }

  async function saveEdit() {
    if (busy || !editing) return;
    if (extended && !form.name.trim()) { window.alert("이름을 입력해 주세요."); return; }
    setBusy(true);
    const res = extended
      ? await subUpdateStaff(editing.id, {
          name: form.name.trim(), region: zoneRegionLabel(form.zones), zones: form.zones,
          // 맡는 종목이 없는 협력사는 종목을 건드리지 않는다 (null)
          categories: subCats.length > 0 ? form.categories : null,
          memo: form.memo,
        })
      : await subUpdateStaffZones(editing.id, zoneRegionLabel(form.zones), form.zones);
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

  const toggleCat = (code) => setForm(f => ({
    ...f, categories: f.categories.includes(code) ? f.categories.filter(c => c !== code) : [...f.categories, code],
  }));

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
        const isManager = s.sub_role === "manager";
        const cats = catNames(s.categories, subCats);
        return (
          <div key={s.id} style={{ ...card, opacity: s.is_active ? 1 : 0.55 }}>
            {/* 줄을 누르면 상세 (mig 235 가 있을 때) */}
            <div onClick={extended ? () => setViewing(s.id) : undefined} style={{ cursor: extended ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</span>
                {isManager && <span style={{ ...small, fontWeight: 800 }}>관리자</span>}
                {!s.is_active && <span style={{ ...small, fontWeight: 800 }}>비활성</span>}
                {extended && !s.business_set && (
                  <span title="사업자 정보를 입력해야 이 기사 이름으로 영수증을 발급할 수 있습니다" style={{ fontSize: 11, fontWeight: 700, color: "var(--danger, #E5484D)" }}>
                    사업자 미입력
                  </span>
                )}
                <span style={{ ...small, marginLeft: "auto" }}>{s.code}</span>
              </div>
              <div style={{ ...small, marginTop: 4 }}>
                {s.phone}{Number(s.open_tasks) > 0 ? ` · 진행할 작업 ${s.open_tasks}건` : ""}
              </div>
              <div style={{ marginTop: 4 }}>
                <ZoneSummary zones={s.zones} region={s.region}/>
              </div>
              {extended && subCats.length > 0 && (
                <div style={{ ...small, marginTop: 4 }}>가능 종목: {cats.join(" · ") || "없음"}</div>
              )}
              {s.memo && <div style={{ ...small, marginTop: 4 }}>메모: {s.memo}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <ContactIcons phone={s.phone}/>
              {extended && <button type="button" onClick={() => setViewing(s.id)} style={btnGhost}>상세</button>}
              <button type="button" disabled={busy} onClick={() => openEdit(s)} style={btnGhost}>{extended ? "수정" : "지역 수정"}</button>
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
        삭제 · 전화번호 변경 · 소속 변경 · 관리자 지정은 올데이케어 운영자에게 요청해 주세요.
      </div>

      {viewing && (
        <StaffDetailSheet
          userId={viewing}
          onClose={() => setViewing(null)}
          onEdit={(s) => openEdit({ ...(staff.find(x => x.id === s.id) || {}), ...s })}
        />
      )}

      {(adding || editing) && (
        <BottomSheet
          onClose={() => { if (!busy) { setAdding(false); setEditing(null); } }}
          title={adding ? "기사 추가" : `${editing.name} · 정보 수정`}
          footer={<SheetButtons onCancel={() => { setAdding(false); setEditing(null); }} onOk={adding ? saveAdd : saveEdit} busy={busy}/>}
        >
          {(adding || extended) && (
            <>
              <label style={label}>이름</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input}/>
            </>
          )}
          {adding ? (
            <>
              <label style={label}>휴대폰 번호 (로그인 아이디)</label>
              <input type="tel" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" style={input}/>
            </>
          ) : (
            <>
              <label style={label}>휴대폰 번호 (로그인 아이디)</label>
              <div style={{ ...input, display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>{form.phone}</div>
              <div style={{ ...small, marginTop: 4 }}>전화번호 변경은 올데이케어에 요청해 주세요.</div>
            </>
          )}
          <label style={label}>담당 지역</label>
          <ZonePicker known={knownZones} value={form.zones} onChange={zones => setForm(f => ({ ...f, zones }))}/>
          {extended && subCats.length > 0 && (
            <>
              <label style={label}>가능 종목</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {subCats.map(c => (
                  <button key={c.code} type="button" onClick={() => toggleCat(c.code)} style={chipStyle(form.categories.includes(c.code))}>{c.name}</button>
                ))}
              </div>
              <div style={{ ...small, marginTop: 6 }}>체크하지 않은 종목의 작업은 배정 시트에서 "이 종목 불가"로 맨 아래에 나옵니다.</div>
            </>
          )}
          {extended && (
            <>
              <label style={label}>메모 (관리자·운영자만 봄)</label>
              <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={3} maxLength={1000}
                style={{ ...input, minHeight: 80, resize: "vertical", lineHeight: 1.5 }}/>
            </>
          )}
          {adding && <div style={{ ...small, marginTop: 10 }}>초기 비밀번호는 전화번호 뒤 4자리이며, 처음 로그인할 때 바꾸게 됩니다.</div>}
        </BottomSheet>
      )}
    </div>
  );
}
