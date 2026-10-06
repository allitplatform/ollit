// 2026-10-06 Mig 212~214 — 기사 편집 화면의 "소속 협력사" 카드 (운영자 전용).
//   · 소속 없음 = 올데이케어 직영. 소속을 정하면 직영 추천·자동배정·푸시 후보에서 빠진다.
//   · 구분: 직원 / 관리자(협력사 화면에서 자기 직원 배정 가능).
//   · 저장은 RPC(admin_set_user_subcontractor) — 운영자 확인 + 세션 값은 서버에서 검사.
//   · 다른 저장 버튼과 독립 — 이 카드의 [소속 저장] 만 소속을 바꾼다.
import { useEffect, useState } from "react";
import { useSubcontractorIndex, adminSetUserSubcontractor } from "../lib/subcontractorsDb.js";

export function EngineerSubcontractorCard({ userId, cardStyle }) {
  const idx = useSubcontractorIndex();
  const subs = [...idx.names.values()];
  const curSub  = idx.byUserId.get(userId) || "";
  const curRole = idx.roleByUserId.get(userId) || "staff";

  const [subId, setSubId] = useState(curSub);
  const [role, setRole] = useState(curRole);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 색인이 늦게 도착하거나 저장 후 갱신되면 현재 값으로 맞춘다.
  useEffect(() => { setSubId(curSub); setRole(curRole); }, [curSub, curRole]);

  if (!userId) return null;
  // 등록된 협력사가 하나도 없으면 카드를 그리지 않는다.
  if (idx.ready && subs.length === 0) return null;

  const dirty = subId !== curSub || (subId && role !== curRole);

  async function save() {
    if (busy || !dirty) return;
    const name = subId ? ((idx.names.get(subId) || {}).name || "협력사") : "올데이케어 직영";
    if (!window.confirm(`소속을 "${name}"(으)로 저장할까요?`)) return;
    setBusy(true);
    setMsg("");
    const res = await adminSetUserSubcontractor(userId, subId || null, role);
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error || "저장하지 못했습니다.");
      return;
    }
    setMsg(Number(res.open_tasks) > 0
      ? `저장했습니다. 이미 배정된 진행 중 작업 ${res.open_tasks}건은 수행처가 그대로입니다 — 필요하면 작업 상세에서 넘기기/회수해 주세요.`
      : "저장했습니다.");
  }

  const selectStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-elevated)",
    color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" };

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14,
      padding: 16, ...(cardStyle || {}),
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>🤝 소속 협력사</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
        협력사 소속 기사는 그 협력사 작업만 받고, 직영 작업 추천·자동배정에는 나오지 않습니다.
      </div>

      <label style={labelStyle}>소속</label>
      <select value={subId} onChange={e => setSubId(e.target.value)} disabled={busy} style={selectStyle}>
        <option value="">올데이케어 직영 (소속 없음)</option>
        {subs.map(s => (
          <option key={s.id} value={s.id}>{s.name}{s.active === false ? " (사용 중지)" : ""}</option>
        ))}
      </select>

      {subId && (
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>구분</label>
          <select value={role} onChange={e => setRole(e.target.value)} disabled={busy} style={selectStyle}>
            <option value="staff">기사</option>
            <option value="manager">관리자 (협력사 화면에서 기사 배정)</option>
          </select>
        </div>
      )}

      <button
        type="button" onClick={save} disabled={busy || !dirty}
        style={{
          marginTop: 14, width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
          background: dirty ? "#8B5CF6" : "var(--border)", color: dirty ? "#fff" : "var(--text-secondary)",
          fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: dirty && !busy ? "pointer" : "default",
        }}
      >{busy ? "저장 중…" : "소속 저장"}</button>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>{msg}</div>
      )}
    </div>
  );
}

export default EngineerSubcontractorCard;
