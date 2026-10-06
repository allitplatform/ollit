// 2026-10-06 Mig 230 — 협력사 작업 담당 기사 지정 시트 (기사 50명 대응).
//   협력사 관리자 화면과 운영자 상세 화면이 같이 쓴다.
//   · 목록은 서버(sub_list_staff_for_task)가 "그 작업의 협력사 소속"만 돌려준다.
//   · 추천 3명: 작업 지역 담당 + 작업일 휴무 아님 + 이 종목 가능 + 작업일 일정 적은 순.
//   · 이 종목을 못 하는 기사(Mig 235 can_do = false)는 회색으로 맨 아래, 배정은 확인 후 가능.
//   · 검색(이름·전화 뒷자리), 지역 칩, 휴무는 회색으로 맨 아래.
//   mode: "sub"(협력사 관리자) | "admin"(운영자)
import { useEffect, useMemo, useState } from "react";
import { subListStaffForTask, subAssignTask, adminAssignSubTask } from "../lib/subcontractorsDb.js";
import { zoneSummaryText } from "../utils/zoneGroups.js";
import BottomSheet from "./BottomSheet.jsx";

function fmtNext(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const hm = `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
  const same = k.getUTCFullYear() === now.getUTCFullYear() && k.getUTCMonth() === now.getUTCMonth() && k.getUTCDate() === now.getUTCDate();
  return same ? `오늘 ${hm}` : `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${hm}`;
}

// 표시만 요약한다 ("서울 전체 · 경기 31곳"). 추천 계산은 서버가 개별 지역으로 한다.
function zoneText(s) {
  const zones = Array.isArray(s.zones) ? s.zones : [];
  return zones.length === 0 ? (s.region || "") : zoneSummaryText(zones);
}

export default function SubAssignSheet({ taskId, title, subtitle, mode = "sub", onClose, onAssigned }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await subListStaffForTask(taskId);
      if (!alive) return;
      if (!res.ok) setError(res.error || "기사 목록을 불러오지 못했습니다.");
      else { setStaff(Array.isArray(res.staff) ? res.staff : []); setInfo(res.task || null); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [taskId]);

  const currentId = info?.assigned_engineer_id || null;
  const otherDay = !!(info && info.day && info.today && info.day !== info.today);
  const dayLabel = otherDay ? `${Number(info.day.slice(5, 7))}/${Number(info.day.slice(8, 10))}` : "";

  // 지역 칩 — 기사들의 담당 지역 전체 (작업 지역과 맞는 칩을 맨 앞에)
  const zoneChips = useMemo(() => {
    const set = new Set();
    for (const s of staff) for (const z of (Array.isArray(s.zones) ? s.zones : [])) if (z) set.add(z);
    const district = info?.district || "";
    return [...set].sort((a, b) => {
      const am = district && district.endsWith(a) ? 0 : 1;
      const bm = district && district.endsWith(b) ? 0 : 1;
      return am - bm || a.localeCompare(b, "ko");
    });
  }, [staff, info]);

  const recommended = useMemo(() => (
    staff.filter(s => s.zone_match && !s.off && s.can_do !== false)
      .sort((a, b) => (a.day_tasks || 0) - (b.day_tasks || 0) || String(a.name).localeCompare(String(b.name), "ko"))
      .slice(0, 3)
  ), [staff]);

  const filtering = !!(q.trim() || zone);
  const rest = useMemo(() => {
    const kw = q.trim();
    const digits = kw.replace(/\D/g, "");
    const recIds = new Set(filtering ? [] : recommended.map(s => s.id));
    return staff.filter(s => {
      if (recIds.has(s.id)) return false;
      if (zone && !(Array.isArray(s.zones) && s.zones.includes(zone))) return false;
      if (!kw) return true;
      if (String(s.name || "").includes(kw)) return true;
      return !!digits && String(s.phone || "").replace(/\D/g, "").endsWith(digits);
    }).sort((a, b) =>
      (a.can_do === false ? 1 : 0) - (b.can_do === false ? 1 : 0)     // 이 종목 불가는 맨 아래
      || (a.off ? 1 : 0) - (b.off ? 1 : 0)
      || (b.zone_match ? 1 : 0) - (a.zone_match ? 1 : 0)
      || (a.day_tasks || 0) - (b.day_tasks || 0)
      || String(a.name).localeCompare(String(b.name), "ko"));
  }, [staff, q, zone, filtering, recommended]);

  async function assign(engineerId) {
    if (busy) return;
    // 이 종목을 못 하는 기사 — 막지는 않고 한 번 확인한다 (Mig 235)
    const target = engineerId ? staff.find(s => s.id === engineerId) : null;
    if (target && target.can_do === false
        && !window.confirm(`${target.name} 기사는 이 종목이 "가능 종목"에 없습니다.\n그래도 배정할까요?`)) return;
    setBusy(true);
    const res = mode === "admin" ? await adminAssignSubTask(taskId, engineerId) : await subAssignTask(taskId, engineerId);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "배정에 실패했습니다."); return; }
    if (typeof onAssigned === "function") onAssigned(engineerId);
  }

  const row = (s, rec) => {
    const on = currentId === s.id;
    const next = fmtNext(s.next_at);
    const parts = [
      zoneText(s),
      `오늘 ${s.today_tasks || 0}건`,
      otherDay ? `${dayLabel} ${s.day_tasks || 0}건` : "",
      next ? `다음 ${next}` : "",
    ].filter(Boolean);
    return (
      <div key={s.id} role="button" tabIndex={0} onClick={() => assign(s.id)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", boxSizing: "border-box",
        background: on ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
        border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
        borderRadius: 12, padding: "11px 14px", marginBottom: 8, minHeight: 56,
        color: "var(--text-primary)", fontFamily: "inherit", cursor: busy ? "default" : "pointer",
        opacity: (s.off || s.can_do === false) ? 0.5 : 1,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{s.name}{s.sub_role === "manager" ? " (관리자)" : ""}</span>
          {rec && <span style={tag("var(--accent, #FF1B8D)")}>추천</span>}
          {!rec && s.zone_match && <span style={tag("var(--success, #16A34A)")}>지역 담당</span>}
          {on && <span style={tag("var(--text-secondary)")}>현재 담당</span>}
          {s.can_do === false && <span style={tag("var(--text-secondary)")}>이 종목 불가</span>}
          {s.off && <span style={tag("var(--text-secondary)")}>휴무</span>}
          {!s.off && s.off_part && <span style={tag("var(--text-secondary)")}>휴무 {s.off_part}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
          {parts.join(" · ")}
        </div>
        </div>
        {/* 배정 전에 통화로 확인 — 누르면 전화만 걸리고 배정은 되지 않는다 */}
        {String(s.phone || "").replace(/[^0-9]/g, "") && (
          <a href={`tel:${String(s.phone).replace(/[^0-9]/g, "")}`} onClick={e => e.stopPropagation()} aria-label={`${s.name} 전화`} title="전화" style={{
            width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none", flexShrink: 0,
          }}>📞</a>
        )}
      </div>
    );
  };

  return (
    <BottomSheet
      onClose={() => { if (!busy) onClose(); }}
      title={title || "담당 기사 지정"}
      subtitle={[subtitle, info?.district].filter(Boolean).join(" · ")}
      header={(!loading && !error && staff.length > 0) ? (
        <>
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="이름 또는 전화 뒷자리"
            style={{
              display: "block", width: "100%", boxSizing: "border-box", marginTop: 12,
              padding: "11px 12px", borderRadius: 10, minHeight: 44,
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
              fontSize: 16, fontFamily: "inherit",
            }}
          />
          {zoneChips.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8, paddingBottom: 2 }}>
              {["", ...zoneChips].map(z => (
                <button key={z || "all"} type="button" onClick={() => setZone(z)} style={{
                  flexShrink: 0, padding: "7px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                  border: zone === z ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                  background: zone === z ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                  color: "var(--text-primary)",
                }}>{z || "전체"}</button>
              ))}
            </div>
          )}
        </>
      ) : null}
      footer={(
        <>
          {currentId && (
            <button type="button" disabled={busy} onClick={() => assign(null)} style={{ ...ghost, color: "var(--danger, #E5484D)", marginBottom: 8 }}>
              배정 해제 (미배정으로)
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose} style={ghost}>닫기</button>
        </>
      )}
    >
      {loading && <div style={hint}>불러오는 중…</div>}
      {!loading && error && <div style={{ ...hint, color: "var(--danger, #E5484D)" }}>{error}</div>}
      {!loading && !error && staff.length === 0 && <div style={hint}>등록된 기사가 없습니다.</div>}
      {!loading && !error && !filtering && recommended.length > 0 && (
        <>
          <div style={sect}>추천</div>
          {recommended.map(s => row(s, true))}
          {rest.length > 0 && <div style={sect}>전체 기사</div>}
        </>
      )}
      {!loading && !error && rest.map(s => row(s, false))}
      {!loading && !error && staff.length > 0 && filtering && rest.length === 0 && (
        <div style={hint}>조건에 맞는 기사가 없습니다.</div>
      )}
    </BottomSheet>
  );
}

const tag = (color) => ({
  fontSize: 10, fontWeight: 800, color, border: `1px solid ${color}`, borderRadius: 999, padding: "1px 7px", lineHeight: 1.6,
});
const hint = { fontSize: 13, color: "var(--text-secondary)", padding: "22px 0", textAlign: "center" };
const sect = { fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", margin: "8px 0 8px" };
const ghost = {
  display: "block", width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 10,
  padding: "11px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer",
};
