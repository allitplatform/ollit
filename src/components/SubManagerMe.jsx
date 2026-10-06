// 2026-10-06 — 협력사 관리자 "내 정보" (모바일·PC 공용). 기사 앱 내 정보(EngineerMeTab)와 같은 모양 · 같은 부품(MeParts).
//   프로필 / 회사(회사 계좌 · 보낼 곳) / 설정(다크 모드 · 푸시 알림 · 글자 크기 · 비밀번호 변경) / 정보 / 로그아웃.
//   · 회사 계좌 = 소속 기사가 [보냄] 할 때 보낼 계좌. 관리자만 바꿀 수 있고, 계좌번호 전체 보기는 열람 기록이 남는다 (Mig 239).
//   · 다크 모드 · 글자 크기는 기사 앱과 같은 저장 값을 쓴다.
//   · 푸시 알림 토글 = 이 기기의 구독 켜기/끄기 (기사 앱과 같음). 줄을 누르면 "알림 종류" 화면 (종류별 설정은 서버 저장).
import { useCallback, useEffect, useState } from "react";
import {
  subGetCompanyAccount, subSetCompanyAccount, subGetNotifyPrefs, subSetNotifyPrefs,
} from "../lib/subcontractorsDb.js";
import { applyTheme, loadTheme } from "../styles/themes.js";
import { loadFontSize, applyFontSize } from "../utils/fontSize.js";
import { useIsDark } from "../hooks/useIsDark.js";
import {
  subscribePushWithSync, unsubscribePushWithSync, isPushSupported, isStandalone, isIOS,
  getPermissionState, getCurrentSubscription,
} from "../utils/pushNotification.js";
import { ME_APP_VERSION } from "../lib/meConstants.js";
import BottomSheet, { SheetButtons } from "./BottomSheet.jsx";
import { PasswordChangeScreen } from "./PasswordChangeScreen.jsx";
import { meCardStyle, SectionHeader, SettingRow, Toggle, FontSizeButton, Chevron, RowValue, LogoutButton } from "./MeParts.jsx";

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

function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── 회사 계좌 시트: 보기(👁 · 열람 기록) ↔ 변경 ──
function CompanyAccountSheet({ data, subName, onClose, onSaved }) {
  const [full, setFull] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ bank: "", number: "", holder: "" });
  const acc = data.account;

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
    setForm({ bank: (acc && acc.bank) || "", number: "", holder: (acc && acc.holder) || "" });
    setEdit(true);
  }
  async function save() {
    if (busy) return;
    if (!form.bank.trim() || !form.number.trim() || !form.holder.trim()) { window.alert("은행 · 계좌번호 · 예금주를 모두 입력해 주세요."); return; }
    if (!window.confirm(`회사 계좌를 아래로 바꿉니다.\n소속 기사의 정산 화면에 이 계좌가 "보낼 계좌"로 나옵니다.\n\n${form.bank.trim()} ${form.number.trim()}\n예금주 ${form.holder.trim()}`)) return;
    setBusy(true);
    const res = await subSetCompanyAccount(form.bank.trim(), form.number.trim(), form.holder.trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "저장하지 못했습니다."); return; }
    onSaved();
  }

  if (edit) {
    return (
      <BottomSheet
        onClose={() => { if (!busy) setEdit(false); }}
        title="회사 계좌 변경"
        subtitle="소속 기사가 수수료를 보낼 계좌입니다. 바꾼 사람과 시각이 기록됩니다."
        footer={<SheetButtons onCancel={() => setEdit(false)} onOk={save} busy={busy}/>}
      >
        <label style={label}>은행</label>
        <input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="예: 국민은행" style={input}/>
        <label style={label}>계좌번호 (숫자와 - 만)</label>
        <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} inputMode="numeric" placeholder="계좌번호를 다시 입력해 주세요" style={input}/>
        <label style={label}>예금주</label>
        <input value={form.holder} onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} style={input}/>
      </BottomSheet>
    );
  }
  const changes = Array.isArray(data.changes) ? data.changes : [];
  return (
    <BottomSheet onClose={onClose} title="회사 계좌" subtitle={`기사가 ${subName}로 보낼 계좌`}>
      {!acc && <div style={small}>아직 등록하지 않았습니다. 등록하면 소속 기사의 정산 화면에 나옵니다.</div>}
      {acc && (
        <div>
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
      {data.can_edit && (
        <button type="button" onClick={openEdit} style={{ ...ghost, display: "block", width: "100%", padding: "12px 0", fontSize: 13, marginTop: 14 }}>
          {acc ? "변경" : "등록"}
        </button>
      )}
      {changes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...small, fontWeight: 700, marginBottom: 4 }}>변경 · 열람 기록</div>
          {changes.map((c, i) => (
            <div key={i} style={{ ...small, display: "flex", gap: 8, padding: "5px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ flex: "none", width: 34, fontWeight: 700 }}>{c.action === "view" ? "열람" : "변경"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{c.actor || "—"}</span>
              <span style={{ flex: "none" }}>{fmtWhen(c.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ── 알림 종류 ──
const KINDS = [
  { key: "new_task",      label: "새 작업 들어옴",        sub: "미배정 작업이 생기면" },
  { key: "staff_remit",   label: "기사 송금 보고",        sub: "기사가 [보냄] 을 누르면" },
  { key: "fee_reminder",  label: "오늘 보낼 수수료",      sub: "매일 정한 시각에 (보낼 금액이 있을 때만)" },
  { key: "cancel_change", label: "작업 취소 · 일정 변경", sub: "협력사 작업이 취소되거나 일정이 바뀌면" },
  { key: "task_done",     label: "기사 작업 완료",        sub: "기사가 작업을 완료하면" },
];

// "알림 종류" 하위 화면 — 5종 켜기/끄기 + 오늘 보낼 수수료 시각. 푸시 전체가 꺼져 있으면 흐리게.
function NotifyKindsPage({ isDark, pushOn, onBack }) {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    <div>
      <button type="button" onClick={onBack} style={{
        background: "transparent", border: "none", padding: "4px 2px 12px", cursor: "pointer", fontFamily: "inherit",
        fontSize: 16, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8,
      }}><span style={{ fontSize: 20 }}>←</span> 알림 종류</button>
      {!pushOn && <div style={{ ...small, padding: "0 4px 10px" }}>푸시 알림이 꺼져 있어 이 기기로는 오지 않습니다. 설정은 저장됩니다.</div>}
      {error && <div style={{ ...small, color: "var(--danger, #E5484D)", padding: "0 4px 10px" }}>{error}</div>}
      {prefs && (
        <div style={{ ...meCardStyle(isDark), padding: "6px 0" }}>
          {KINDS.map((k, i) => (
            <div key={k.key}>
              <SettingRow label={k.label} sub={k.sub} isDark={isDark} dim={!pushOn}
                isLast={i === KINDS.length - 1}
                rightSlot={<Toggle on={!!prefs[k.key]} onChange={(v) => change({ [k.key]: v })}/>}/>
              {k.key === "fee_reminder" && prefs.fee_reminder && (
                <SettingRow label="알림 시각" isDark={isDark} dim={!pushOn}
                  rightSlot={
                    <input type="time" step={600} value={prefs.fee_reminder_time || "20:00"} aria-label="알림 시각"
                      onChange={e => e.target.value && change({ fee_reminder_time: e.target.value })}
                      style={{ ...input, width: 130, minHeight: 36, padding: "6px 10px" }}/>
                  }/>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PUSH_HELP =
  "알림 켜는 방법\n\n아이폰: 사파리에서 공유 버튼 → '홈 화면에 추가'로 설치한 올잇 앱에서만 알림을 받을 수 있습니다. 설정 → 알림 → 올잇 → 알림 허용.\n\n안드로이드: 설정 → 애플리케이션 → 올잇(또는 Chrome) → 알림 허용.\n\n허용한 뒤 앱을 완전히 껐다 다시 열어 주세요.";

export default function SubManagerMe({ user, subName, onLogout }) {
  const isDark = useIsDark();
  const cardStyle = meCardStyle(isDark);
  const [theme, setTheme] = useState(() => loadTheme());
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  const [page, setPage] = useState("main");            // main / notify
  const [sheet, setSheet] = useState(null);            // account / hq
  const [showPw, setShowPw] = useState(false);
  const [accData, setAccData] = useState(null);
  const [accError, setAccError] = useState("");
  const [push, setPush] = useState(false);
  const [perm, setPerm] = useState(() => getPermissionState());
  const [toast, setToast] = useState(null);

  const loadAcc = useCallback(async () => {
    const res = await subGetCompanyAccount(false);
    if (!res.ok) { setAccError(res.error || "불러오지 못했습니다"); return; }
    setAccError(""); setAccData(res);
  }, []);
  useEffect(() => { loadAcc(); }, [loadAcc]);

  // 이 기기의 구독 상태로 토글 맞추기
  useEffect(() => {
    if (!isPushSupported()) return;
    let alive = true;
    getCurrentSubscription().then(sub => {
      if (alive) setPush(!!(sub && getPermissionState() === "granted"));
    });
    return () => { alive = false; };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  // 기사 앱과 같이 토글 하나 (밝게 ↔ 어둡게)
  const darkOn = theme === "dark" || (theme === "auto" && isDark);
  function handleDark(v) { const t = v ? "dark" : "light"; applyTheme(t); setTheme(t); }
  function handleFont(size) { applyFontSize(size); setFontSize(size); }

  async function handlePush(v) {
    const ids = { userId: user?.user_id || user?.userId || user?.id || "", engineerId: user?.code || "" };
    if (v) {
      if (!isPushSupported()) { showToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다"); return; }
      if (isIOS() && !isStandalone()) { showToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요"); return; }
      const res = await subscribePushWithSync({ ...ids, role: "sub_manager" });
      setPerm(getPermissionState());
      if (res.ok || res.reason === "sync_failed") { setPush(true); showToast("✓ 푸시 알림이 활성화되었습니다"); }
      else if (res.reason === "denied") showToast("⚠️ 알림 권한이 거부되었습니다 (휴대폰 설정에서 변경)");
      else if (res.reason === "no_vapid") showToast("⚠️ 푸시 키가 설정되지 않았습니다");
      else showToast(`⚠️ ${res.error || "활성화 실패"}`);
    } else {
      const res = await unsubscribePushWithSync(ids);
      setPush(false);
      showToast(res.ok ? "✓ 푸시 알림이 비활성화되었습니다" : `⚠️ ${res.error || "비활성화 실패"}`);
    }
  }

  function handleLogout() {
    if (window.confirm("로그아웃 하시겠습니까?")) onLogout && onLogout();
  }

  const acc = accData && accData.account;
  const hq = accData && accData.hq_account;
  const initial = (user?.name || "?").charAt(0);

  if (page === "notify") {
    return (
      <div style={{ padding: 16 }}>
        <NotifyKindsPage isDark={isDark} pushOn={push} onBack={() => setPage("main")}/>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 프로필 카드 */}
      <div style={{ ...cardStyle, padding: "22px 18px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#FFB8D6", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 28, color: "#FF1B8D", fontWeight: 700 }}>{initial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: isDark ? "#FAF8F5" : "#1A1A1A", letterSpacing: "-0.3px", marginBottom: 4 }}>
            {user?.name || "—"}
          </div>
          <div style={{ fontSize: 13, color: isDark ? "#C8C8C8" : "#555", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              background: isDark ? "#2D0F1E" : "#FFE5F2", color: isDark ? "#FF4DA6" : "#FF1B8D",
              fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 700,
            }}>관리자</span>
            <span>{subName}</span>
          </div>
          {user?.phone && <div style={{ fontSize: 12, color: isDark ? "#999" : "#6B6359", marginTop: 4 }}>{user.phone}</div>}
        </div>
      </div>

      {/* 회사 카드 */}
      <div style={{ ...cardStyle, padding: "6px 0" }}>
        <SectionHeader isDark={isDark}>회사</SectionHeader>
        <SettingRow icon="🏦" label="회사 계좌" isDark={isDark} onClick={accData ? () => setSheet("account") : undefined}
          rightSlot={<RowValue isDark={isDark}>{accError || (!accData ? "…" : acc ? `${acc.bank || ""} ${acc.number_masked || ""}`.trim() : "미등록")}</RowValue>}/>
        <SettingRow icon="💳" label="보낼 곳(올데이케어)" isDark={isDark} onClick={accData ? () => setSheet("hq") : undefined} isLast
          rightSlot={<RowValue isDark={isDark}>{!accData ? "…" : hq ? `${hq.bank || ""} ****`.trim() : "미등록"}</RowValue>}/>
      </div>

      {/* 휴대폰 알림 권한이 꺼져 있을 때만 */}
      {perm !== "granted" && (
        <div style={{ ...small, color: "var(--danger, #E5484D)", fontWeight: 700, padding: "0 4px 10px" }}>
          휴대폰 알림이 꺼져 있습니다{" "}
          <button type="button" onClick={() => window.alert(PUSH_HELP)} style={{
            background: "transparent", border: "none", padding: 0, color: "inherit", fontWeight: 800,
            textDecoration: "underline", fontFamily: "inherit", fontSize: 12, cursor: "pointer",
          }}>[켜는 방법]</button>
        </div>
      )}

      {/* 설정 카드 — 기사 앱과 같음 */}
      <div style={{ ...cardStyle, padding: "6px 0" }}>
        <SectionHeader isDark={isDark}>설정</SectionHeader>
        <SettingRow icon="🌙" label="다크 모드" isDark={isDark}
          rightSlot={<Toggle on={darkOn} onChange={handleDark}/>}/>
        {/* 글자 부분을 누르면 알림 종류, 토글은 전체 켜기/끄기 */}
        <SettingRow icon="🔔" label={<>푸시 알림 <Chevron isDark={isDark}/></>} isDark={isDark} onClick={() => setPage("notify")}
          rightSlot={<span onClick={e => e.stopPropagation()}><Toggle on={push} onChange={handlePush}/></span>}/>
        <SettingRow icon="🔠" label="글자 크기" isDark={isDark}
          rightSlot={
            <div style={{ display: "flex", gap: 4 }}>
              <FontSizeButton label="작게" size="small"  current={fontSize} onChange={handleFont} isDark={isDark}/>
              <FontSizeButton label="기본" size="medium" current={fontSize} onChange={handleFont} isDark={isDark}/>
              <FontSizeButton label="크게" size="large"  current={fontSize} onChange={handleFont} isDark={isDark}/>
            </div>
          }/>
        <SettingRow icon="🔒" label="비밀번호 변경" isDark={isDark} onClick={() => setShowPw(true)}
          rightSlot={<Chevron isDark={isDark}/>} isLast/>
      </div>

      {/* 정보 카드 */}
      <div style={{ ...cardStyle, padding: "6px 0" }}>
        <SectionHeader isDark={isDark}>정보</SectionHeader>
        <SettingRow icon="📖" label="도움말" isDark={isDark} onClick={() => window.alert("준비 중입니다.\n기사 삭제 · 전화번호 변경 · 관리자 지정은 올데이케어 운영자에게 요청해 주세요.")}
          rightSlot={<Chevron isDark={isDark}/>}/>
        <SettingRow icon="ℹ️" label="버전" isDark={isDark} isLast
          rightSlot={<span style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#999" : "#6B6359" }}>{ME_APP_VERSION}</span>}/>
      </div>

      <LogoutButton isDark={isDark} onClick={handleLogout}/>

      {sheet === "account" && accData && (
        <CompanyAccountSheet data={accData} subName={subName}
          onClose={() => { setSheet(null); loadAcc(); }}
          onSaved={() => { setSheet(null); loadAcc(); }}/>
      )}
      {sheet === "hq" && (
        <BottomSheet onClose={() => setSheet(null)} title="보낼 곳 · 올데이케어" subtitle="수수료를 보낼 계좌입니다. 올데이케어 운영자가 설정합니다.">
          {hq
            ? <AccountLine bank={hq.bank} number={hq.number} holder={hq.holder} onCopy={async () => { const ok = await copyText(hq.number); window.alert(ok ? "계좌번호를 복사했습니다." : "복사하지 못했습니다."); }}/>
            : <div style={small}>올데이케어 입금 계좌가 아직 등록되지 않았습니다. 올데이케어 운영자에게 알려 주세요.</div>}
        </BottomSheet>
      )}

      {/* 비밀번호 변경 — 첫 로그인 때 쓰는 화면을 그대로 */}
      {showPw && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, overflowY: "auto", background: "#0A0A0A" }}>
          <button type="button" onClick={() => setShowPw(false)} aria-label="뒤로" style={{
            position: "absolute", top: "calc(10px + env(safe-area-inset-top))", left: 12, zIndex: 1,
            background: "transparent", border: "none", color: "#fff", fontSize: 24, padding: 8, cursor: "pointer",
          }}>←</button>
          <PasswordChangeScreen user={user} onComplete={() => { setShowPw(false); showToast("✓ 비밀번호를 변경했습니다"); }}/>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: "calc(96px + env(safe-area-inset-bottom))", transform: "translateX(-50%)",
          background: "rgba(0, 135, 90, 0.95)", color: "#fff", padding: "10px 16px", borderRadius: 10,
          fontSize: 12, fontWeight: 600, maxWidth: "85%", textAlign: "center", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 9999, pointerEvents: "none",
        }}>{toast}</div>
      )}
    </div>
  );
}
