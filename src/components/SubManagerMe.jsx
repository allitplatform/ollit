// 2026-10-06 Mig 239 — 협력사 관리자 "내 정보" (모바일·PC 공용).
//   내 이름·회사 / 회사 계좌(보기·변경) / 화면(밝게·어둡게·기기 설정, 글자 크기) / 알림 설정 / 로그아웃.
//   · 회사 계좌 = 소속 기사가 [보냄] 할 때 보낼 계좌. 관리자만 바꿀 수 있고, 계좌번호 전체 보기는 열람 기록이 남는다.
//   · 화면 모드·글자 크기는 기사 앱과 같은 설정(같은 저장 키)을 쓴다.
//   · 알림 설정은 서버에 저장한다. 서버가 종류별로 "켜 둔 관리자에게만" 푸시를 보낸다.
import { useCallback, useEffect, useState } from "react";
import {
  subGetCompanyAccount, subSetCompanyAccount, subGetNotifyPrefs, subSetNotifyPrefs,
} from "../lib/subcontractorsDb.js";
import { applyTheme, loadTheme } from "../styles/themes.js";
import { loadFontSize, applyFontSize } from "../utils/fontSize.js";
import BottomSheet, { SheetButtons } from "./BottomSheet.jsx";

const card = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10 };
const ttl = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 };
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const label = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 6px" };
const input = {
  display: "block", width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, minHeight: 44,
  border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 16, fontFamily: "inherit",
};
const ghost = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px",
  fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const seg = (on) => ({
  flex: 1, minWidth: 0, padding: "10px 0", borderRadius: 10, fontFamily: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 800,
  border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
  background: on ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)", color: "var(--text-primary)",
});

// 계좌 한 줄 (복사 버튼 포함) — 정산 화면에서도 쓴다
export function AccountLine({ bank, number, holder, onCopy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, wordBreak: "break-all" }}>{[bank, number].filter(Boolean).join(" ")}</div>
        {holder && <div style={small}>예금주 {holder}</div>}
      </div>
      {onCopy && <button type="button" onClick={onCopy} style={ghost}>복사</button>}
    </div>
  );
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(String(text || "")); return true; } catch (_e) { return false; }
}

// ── 회사 계좌 ──
function CompanyAccountCard({ subName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [full, setFull] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank: "", number: "", holder: "" });

  const load = useCallback(async () => {
    const res = await subGetCompanyAccount(false);
    if (!res.ok) { setError(res.error || "계좌 정보를 불러오지 못했습니다."); return; }
    setError(""); setData(res); setFull("");
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reveal() {
    if (busy) return;
    if (!window.confirm("계좌번호 전체를 표시합니다.\n누가 언제 봤는지 열람 기록이 남습니다.")) return;
    setBusy(true);
    const res = await subGetCompanyAccount(true);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "표시하지 못했습니다."); return; }
    setFull((res.account && res.account.number) || "");
  }
  function openEdit() {
    setForm({ bank: (data?.account?.bank) || "", number: "", holder: (data?.account?.holder) || "" });
    setOpen(true);
  }
  async function save() {
    if (busy) return;
    if (!form.bank.trim() || !form.number.trim() || !form.holder.trim()) { window.alert("은행 · 계좌번호 · 예금주를 모두 입력해 주세요."); return; }
    if (!window.confirm(`회사 계좌를 아래로 바꿉니다.\n소속 기사의 정산 화면에 이 계좌가 "보낼 계좌"로 나옵니다.\n\n${form.bank.trim()} ${form.number.trim()}\n예금주 ${form.holder.trim()}`)) return;
    setBusy(true);
    const res = await subSetCompanyAccount(form.bank.trim(), form.number.trim(), form.holder.trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    setOpen(false);
    load();
  }

  const acc = data && data.account;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ ...ttl, marginBottom: 0, flex: 1 }}>회사 계좌 <span style={{ fontWeight: 600 }}>· 기사가 {subName}로 보낼 계좌</span></div>
        {data && data.can_edit && <button type="button" onClick={openEdit} style={ghost}>{acc ? "변경" : "등록"}</button>}
      </div>
      {error && <div style={{ ...small, color: "var(--danger, #E5484D)", marginTop: 8 }}>{error}</div>}
      {data && !acc && <div style={{ ...small, marginTop: 8 }}>아직 등록하지 않았습니다. 등록하면 소속 기사의 정산 화면에 나옵니다.</div>}
      {acc && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, wordBreak: "break-all" }}>
              {acc.bank || ""} {full || acc.number_masked}
            </div>
            {/* 👁 — 전체 보기 (열람 기록) */}
            {!full && <button type="button" disabled={busy} onClick={reveal} aria-label="계좌번호 전체 보기" title="전체 보기" style={{ ...ghost, width: 40, height: 40, padding: 0, fontSize: 16 }}>👁</button>}
            {full && <button type="button" onClick={async () => { const ok = await copyText(full); window.alert(ok ? "계좌번호를 복사했습니다." : "복사하지 못했습니다."); }} style={ghost}>복사</button>}
          </div>
          <div style={small}>예금주 {acc.holder || "—"}</div>
        </div>
      )}
      {open && (
        <BottomSheet
          onClose={() => { if (!busy) setOpen(false); }}
          title="회사 계좌 변경"
          subtitle="소속 기사가 수수료를 보낼 계좌입니다. 바꾼 사람과 시각이 기록됩니다."
          footer={<SheetButtons onCancel={() => setOpen(false)} onOk={save} busy={busy}/>}
        >
          <label style={label}>은행</label>
          <input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="예: 국민은행" style={input}/>
          <label style={label}>계좌번호 (숫자와 - 만)</label>
          <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} inputMode="numeric" placeholder="계좌번호를 다시 입력해 주세요" style={input}/>
          <label style={label}>예금주</label>
          <input value={form.holder} onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} style={input}/>
        </BottomSheet>
      )}
    </div>
  );
}

// ── 알림 설정 ──
const KINDS = [
  { key: "new_task",      label: "새 작업 들어옴",        sub: "미배정 작업이 생기면" },
  { key: "staff_remit",   label: "기사 송금 보고",        sub: "기사가 [보냄] 을 누르면" },
  { key: "fee_reminder",  label: "오늘 보낼 수수료",      sub: "매일 정한 시각에 (보낼 금액이 있을 때만)" },
  { key: "cancel_change", label: "작업 취소 · 일정 변경", sub: "발송 준비 중 — 설정만 저장됩니다", soon: true },
  { key: "task_done",     label: "기사 작업 완료",        sub: "발송 준비 중 — 설정만 저장됩니다", soon: true },
];
function NotifyCard() {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // 기기의 알림 권한 — 꺼져 있으면 서버가 보내도 휴대폰에 뜨지 않는다
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";

  useEffect(() => {
    let alive = true;
    subGetNotifyPrefs().then(res => {
      if (!alive) return;
      if (!res.ok) setError(res.error || "알림 설정을 불러오지 못했습니다.");
      else setPrefs(res.prefs || {});
    });
    return () => { alive = false; };
  }, []);

  async function change(patch) {
    if (!prefs || saving) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    const res = await subSetNotifyPrefs(next);
    setSaving(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); setPrefs(prefs); }
  }

  return (
    <div style={card}>
      <div style={ttl}>알림</div>
      {perm !== "granted" && (
        <div style={{ ...small, color: "var(--danger, #E5484D)", fontWeight: 700, padding: "8px 10px", borderRadius: 8, background: "rgba(229,72,77,0.10)", marginBottom: 10 }}>
          휴대폰 알림이 꺼져 있습니다{" "}
          <button type="button" onClick={() => window.alert(
            "알림 켜는 방법\n\n아이폰: 사파리에서 공유 버튼 → '홈 화면에 추가'로 설치한 올잇 앱에서만 알림을 받을 수 있습니다. 설정 → 알림 → 올잇 → 알림 허용.\n\n안드로이드: 설정 → 애플리케이션 → 올잇(또는 Chrome) → 알림 허용.\n\n허용한 뒤 앱을 완전히 껐다 다시 열어 주세요."
          )} style={{ background: "transparent", border: "none", padding: 0, color: "inherit", fontWeight: 800, textDecoration: "underline", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>[켜는 방법]</button>
        </div>
      )}
      {error && <div style={{ ...small, color: "var(--danger, #E5484D)" }}>{error}</div>}
      {prefs && KINDS.map(k => (
        <div key={k.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border)", opacity: k.soon ? 0.6 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{k.label}</div>
            <div style={small}>{k.sub}</div>
            {k.key === "fee_reminder" && prefs.fee_reminder && (
              <input type="time" step={600} value={prefs.fee_reminder_time || "20:00"} onChange={e => e.target.value && change({ fee_reminder_time: e.target.value })}
                aria-label="알림 시각" style={{ ...input, width: 140, minHeight: 40, marginTop: 6 }}/>
            )}
          </div>
          <button type="button" role="switch" aria-checked={!!prefs[k.key]} aria-label={k.label} disabled={saving} onClick={() => change({ [k.key]: !prefs[k.key] })} style={{
            width: 48, height: 28, flex: "none", borderRadius: 99, border: "none", cursor: "pointer", padding: 3, boxSizing: "border-box",
            background: prefs[k.key] ? "var(--accent, #FF1B8D)" : "var(--border)", display: "flex", justifyContent: prefs[k.key] ? "flex-end" : "flex-start",
          }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "block" }}/></button>
        </div>
      ))}
    </div>
  );
}

export default function SubManagerMe({ user, subName, onLogout }) {
  const [theme, setTheme] = useState(() => loadTheme());
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  return (
    <div style={{ padding: 12 }}>
      <div style={card}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{user?.name || "—"}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subName} · 관리자</div>
        {user?.phone && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{user.phone}</div>}
      </div>

      <CompanyAccountCard subName={subName}/>

      <div style={card}>
        <div style={ttl}>화면</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["light", "밝게"], ["dark", "어둡게"], ["auto", "기기 설정"]].map(([k, label2]) => (
            <button key={k} type="button" onClick={() => { applyTheme(k); setTheme(k); }} style={seg(theme === k)}>{label2}</button>
          ))}
        </div>
        <div style={{ ...ttl, margin: "12px 0 8px" }}>글자 크기</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["small", "작게"], ["medium", "기본"], ["large", "크게"]].map(([k, label2]) => (
            <button key={k} type="button" onClick={() => { applyFontSize(k); setFontSize(k); }} style={seg(fontSize === k)}>{label2}</button>
          ))}
        </div>
      </div>

      <NotifyCard/>

      <div style={{ ...card, ...small }}>
        기사 삭제 · 전화번호 변경 · 관리자 지정은 올데이케어 운영자에게 요청해 주세요.
      </div>
      <button type="button" onClick={onLogout} style={{ ...ghost, display: "block", width: "100%", padding: "13px 0", fontSize: 13, color: "#E5484D" }}>로그아웃</button>
    </div>
  );
}
