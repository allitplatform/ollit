// 2026-10-07 Mig 254·255 — 쿨가이(KB) 원청 전용 화면.
//   · 기존 원청 앱(PrincipalApp)은 표를 직접 읽는다. 이 화면의 작업·수수료는 서버 함수(partner_kb_*)만 부른다.
//     → 수행 협력사·기사·받은 금액·실제 공급가·협력사 수수료·올데이케어 몫은 아예 내려오지 않는다.
//   · 보이는 작업 = 원청 KB + 주방후드 전체 (협력사로 넘긴 것 + 직영 + 미배정). 고객 정보는 전부 보인다 (쿨가이 고객).
//   · 수행은 "올데이케어" 고정. 금액은 견적 · 쿨가이 수수료만.
//   · 접수 가능(주방후드 단가표에서 고르기, 견적 자동). 취소는 배정 전까지만.
//   탭: 작업 · 접수 · 수수료 · 내 정보(기존 원청 앱의 내 정보, 계좌는 보기 전용)
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Wallet, User, RefreshCw, X, ChevronDown, ChevronUp, Plus, Phone } from "lucide-react";
import SafeTopCover from "../components/SafeTopCover.jsx";
import { applyTheme as applyThemeVars, loadTheme } from "../styles/themes.js";
import { THEMES, InfoTab } from "./PrincipalApp.jsx";
import { getCategoryMetaOfRow } from "../lib/serviceCatalog.js";
import { partnerKbListTasks, partnerKbGetTask, partnerKbListRemits, partnerKbCancelTask } from "../lib/subcontractorsDb.js";
import { KbReception } from "../components/principal/KbReception.jsx";
import { fmtWon, fmtWonSigned } from "../utils/money.js";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function kstParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return { m: k.getUTCMonth() + 1, d: k.getUTCDate(), w: WEEK[k.getUTCDay()], hh: k.getUTCHours(), mm: k.getUTCMinutes() };
}
function fmtSchedule(iso) {
  const p = kstParts(iso);
  if (!p) return "일정 미정";
  return `${p.m}/${p.d} (${p.w}) ${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}
function fmtDateTime(iso) {
  const p = kstParts(iso);
  return p ? `${p.m}/${p.d} ${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}` : "";
}
function fmtYmd(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return String(ymd || "");
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${w})`;
}

const STATUS_LABEL = { "미배정": "접수", "약속대기": "접수", "확정": "일정 확정", "진행중": "진행 중", "완료": "완료", "취소": "취소", "visit_only": "출장만" };
function statusOf(t, status) {
  const label = STATUS_LABEL[status] || status || "";
  const color = status === "완료" ? t.success : status === "취소" ? t.danger : status === "진행중" ? t.info : t.textSecondary;
  return { label, color };
}
// 수수료 칸: 완료 전 "완료 후 계산" / 완료 후 금액 / 완료인데 아직 없으면 "확인 중"
function feeOf(t, row) {
  if (row.fee_state === "done") return { text: fmtWon(row.fee), color: t.accent, strong: true };
  if (row.fee_state === "checking") return { text: "확인 중", color: t.warning, strong: false };
  if (row.fee_state === "pending") return { text: "완료 후 계산", color: t.textMuted, strong: false };
  return { text: "—", color: t.textDim, strong: false };
}

function useLoad(fn) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fn();
    setLoading(false);
    if (!res.ok) { setError(res.error || "불러오지 못했습니다."); return; }
    setError(""); setData(res);
  }, [fn]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, load };
}

function TopBar({ t, title, sub, onReload, loading }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 16px 10px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      {onReload && (
        <button type="button" onClick={onReload} disabled={loading} aria-label="새로 고침" style={{
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: 9,
          color: t.textSecondary, cursor: "pointer", display: "flex", opacity: loading ? 0.5 : 1,
        }}><RefreshCw size={16}/></button>
      )}
    </div>
  );
}
function Notice({ t, text, color }) {
  return <div style={{ margin: "24px 16px", textAlign: "center", fontSize: 13, color: color || t.textMuted }}>{text}</div>;
}
function KV({ t, label, value, color, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", fontSize: 14 }}>
      <span style={{ color: t.textMuted }}>{label}</span>
      <span style={{ color: color || t.text, fontWeight: strong ? 800 : 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── 작업 탭 ──
function TaskCard({ t, row, onClick }) {
  const meta = getCategoryMetaOfRow(row);
  const st = statusOf(t, row.status);
  const fee = feeOf(t, row);
  return (
    <button type="button" onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, background: `${meta.color}22`,
        }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{row.task_no}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.customer}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: st.color, whiteSpace: "nowrap" }}>{st.label}</span>
      </div>
      {row.address && (
        <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.address}</div>
      )}
      <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: row.address ? 2 : 8 }}>
        {meta.label} · {fmtSchedule(row.scheduled_at)} · 수행 {row.performer || "올데이케어"}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${t.borderStrong}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>견적 (부가세 별도)</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: row.quote != null ? t.text : t.warning }}>{row.quote != null ? fmtWon(row.quote) : "견적 미정"}</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>쿨가이 수수료</div>
          <div style={{ fontSize: fee.strong ? 16 : 13.5, fontWeight: fee.strong ? 800 : 700, color: fee.color }}>{fee.text}</div>
        </div>
      </div>
    </button>
  );
}

const TASK_FILTERS = [
  { key: "open", label: "진행", test: r => !["완료", "취소", "visit_only"].includes(r.status) },
  { key: "done", label: "완료", test: r => r.status === "완료" },
  { key: "all",  label: "전체", test: () => true },
];

function TasksTab({ t, onOpen, reloadKey = 0 }) {
  const fn = useCallback(() => partnerKbListTasks(), []);
  const { data, error, loading, load } = useLoad(fn);
  useEffect(() => { if (reloadKey > 0) load(); }, [reloadKey, load]);
  const rows = (data && data.rows) || [];
  const [filter, setFilter] = useState("open");
  const f = TASK_FILTERS.find(x => x.key === filter) || TASK_FILTERS[0];
  const shown = rows.filter(f.test);
  return (
    <div>
      <TopBar t={t} title="작업" sub="주방후드 · 올데이케어가 수행합니다" onReload={load} loading={loading}/>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
        {TASK_FILTERS.map(x => {
          const on = x.key === filter;
          return (
            <button key={x.key} type="button" onClick={() => setFilter(x.key)} style={{
              border: `1px solid ${on ? t.accent : t.border}`, background: on ? t.accentBg : "transparent",
              color: on ? t.accent : t.textSecondary, borderRadius: 999, padding: "7px 14px",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
            }}>{x.label} {rows.filter(x.test).length}</button>
          );
        })}
      </div>
      <div style={{ padding: "0 16px" }}>
        {error && <Notice t={t} text={error} color={t.danger}/>}
        {!error && loading && rows.length === 0 && <Notice t={t} text="불러오는 중..."/>}
        {!error && !loading && shown.length === 0 && <Notice t={t} text="해당하는 작업이 없습니다."/>}
        {shown.map(r => <TaskCard key={r.id} t={t} row={r} onClick={() => onOpen(r)}/>)}
      </div>
    </div>
  );
}

function TaskSheet({ t, row, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 접수 취소 — 배정 전까지만 (서버가 다시 확인한다)
  async function cancel() {
    if (busy) return;
    const reason = window.prompt("접수를 취소합니다.\n취소 사유를 입력해 주세요.");
    if (reason == null) return;
    if (!String(reason).trim()) { window.alert("취소 사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await partnerKbCancelTask(row.id, String(reason).trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "취소하지 못했습니다."); return; }
    if (onChanged) onChanged();
    onClose();
  }
  useEffect(() => {
    let alive = true;
    partnerKbGetTask(row.id).then(res => {
      if (!alive) return;
      if (!res.ok) { setError(res.error || "불러오지 못했습니다."); return; }
      setDetail(res);
    });
    return () => { alive = false; };
  }, [row.id]);
  const task = (detail && detail.task) || row;
  const remits = (detail && detail.remits) || [];
  const meta = getCategoryMetaOfRow(task);
  const st = statusOf(t, task.status);
  const fee = feeOf(t, task);
  const items = (task.workItems || []).filter(w => !w.isCanceled);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", background: t.bg,
        borderRadius: "18px 18px 0 0", padding: "16px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>{meta.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{task.task_no}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{task.customer}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ background: "transparent", border: "none", color: t.textSecondary, cursor: "pointer", padding: 6, display: "flex" }}><X size={20}/></button>
        </div>
        {error && <Notice t={t} text={error} color={t.danger}/>}
        <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "6px 14px", marginTop: 14 }}>
          <KV t={t} label="상태" value={st.label} color={st.color} strong/>
          <KV t={t} label="종목" value={meta.label}/>
          <KV t={t} label="주소" value={task.address || "—"}/>
          {task.phone && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", fontSize: 14 }}>
              <span style={{ color: t.textMuted }}>전화</span>
              <a href={`tel:${String(task.phone).replace(/[^0-9+]/g, "")}`} style={{ color: t.accent, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Phone size={14}/>{task.phone}
              </a>
            </div>
          )}
          <KV t={t} label="일정" value={fmtSchedule(task.scheduled_at)}/>
          {task.completed_at && <KV t={t} label="완료" value={fmtDateTime(task.completed_at)}/>}
          <KV t={t} label="수행" value={task.performer || "올데이케어"}/>
        </div>
        {items.length > 0 && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "10px 14px", marginTop: 10 }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>작업 내용</div>
            {items.map((w, i) => (
              <div key={i} style={{ fontSize: 14, color: t.text, padding: "3px 0" }}>
                {[w.workType, w.appliance].filter(Boolean).join(" · ") || "항목"} × {w.qty || 1}
              </div>
            ))}
          </div>
        )}
        <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "6px 14px", marginTop: 10 }}>
          <KV t={t} label="견적 (부가세 별도)" value={task.quote != null ? fmtWon(task.quote) : "견적 미정"} color={task.quote != null ? undefined : t.warning}/>
          <KV t={t} label="쿨가이 수수료" value={fee.text} color={fee.color} strong/>
          {task.fee_state === "checking" && (
            <div style={{ fontSize: 12, color: t.textMuted, paddingBottom: 8 }}>완료는 됐고 수수료를 확인하고 있습니다. 올데이케어에 문의해 주세요.</div>
          )}
        </div>
        {task.can_cancel && (
          <button type="button" onClick={cancel} disabled={busy} style={{
            width: "100%", marginTop: 12, padding: 13, borderRadius: 12, fontFamily: "inherit", cursor: "pointer",
            background: "transparent", border: `1px solid ${t.danger}`, color: t.danger, fontSize: 14, fontWeight: 800, opacity: busy ? 0.6 : 1,
          }}>접수 취소</button>
        )}
        {!task.can_cancel && !["완료", "취소", "visit_only"].includes(task.status) && (
          <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", marginTop: 12 }}>
            이미 배정된 작업입니다. 취소·변경은 올데이케어에 연락해 주세요.
          </div>
        )}
        {remits.length > 0 && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "10px 14px", marginTop: 10 }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>올데이케어 → 쿨가이 송금</div>
            {remits.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, padding: "4px 0" }}>
                <span style={{ color: t.text }}>{fmtYmd(r.date)} · {fmtWonSigned(r.amount)}</span>
                <span style={{ fontWeight: 700, color: r.paid_at ? t.success : t.warning }}>
                  {r.paid_at ? `송금 완료 ✓ ${fmtDateTime(r.paid_at)}` : "송금 예정"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 수수료 탭 ──
function RemitRow({ t, r }) {
  const [open, setOpen] = useState(false);
  const paid = !!r.paid_at;
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 14, background: "transparent", border: "none",
        fontFamily: "inherit", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{fmtYmd(r.date)}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>작업 {r.task_count || 0}건</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{fmtWon(r.amount)}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: paid ? t.success : t.warning }}>
            {paid ? `송금 완료 ✓ ${fmtDateTime(r.paid_at)}` : "송금 예정"}
          </div>
        </div>
        {open ? <ChevronUp size={16} color={t.textMuted}/> : <ChevronDown size={16} color={t.textMuted}/>}
      </button>
      {open && (
        <div style={{ padding: "2px 14px 12px", borderTop: `1px dashed ${t.borderStrong}` }}>
          {Number(r.carried_in) !== 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", color: t.textSecondary }}>
              <span>앞 날짜에서 넘어온 조정</span><span>{fmtWonSigned(r.carried_in)}</span>
            </div>
          )}
          {(r.lines || []).map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
              <span style={{ color: t.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}>{l.task_no}</span>
              <span style={{ color: t.text, fontWeight: 700 }}>{fmtWonSigned(l.amount)}</span>
            </div>
          ))}
          {(r.lines || []).length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: "6px 0" }}>작업 줄이 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

function FeeTab({ t }) {
  const fn = useCallback(() => partnerKbListRemits(), []);
  const { data, error, loading, load } = useLoad(fn);
  const month = (data && data.month) || null;
  const rows = useMemo(() => (data && data.rows) || [], [data]);
  const waiting = rows.filter(r => !r.paid_at);
  const paid = rows.filter(r => r.paid_at);
  return (
    <div>
      <TopBar t={t} title="수수료" sub="올데이케어 → 쿨가이 송금" onReload={load} loading={loading}/>
      <div style={{ padding: "0 16px" }}>
        {error && <Notice t={t} text={error} color={t.danger}/>}
        {month && (
          <div style={{ background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: t.textMuted }}>{month.label} 쿨가이 수수료 합계</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: t.accent, marginTop: 2 }}>{fmtWon(month.total)}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${t.borderStrong}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.textMuted }}>{month.label} 받은 금액</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.success }}>{fmtWon(month.received)}</div>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 11, color: t.textMuted }}>송금 예정</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: Number(month.waiting) > 0 ? t.warning : t.text }}>{fmtWon(month.waiting)}</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 10, lineHeight: 1.5 }}>
              합계는 이번 달에 완료된 작업 기준, 받은 금액은 이번 달에 송금된 금액 기준입니다.
              송금 예정은 올데이케어가 작업분 입금을 확인해 줄이 생긴 금액입니다.
            </div>
          </div>
        )}
        {!error && loading && !data && <Notice t={t} text="불러오는 중..."/>}
        {!error && !loading && rows.length === 0 && <Notice t={t} text="아직 송금 줄이 없습니다."/>}
        {waiting.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, margin: "4px 2px 8px" }}>송금 예정</div>}
        {waiting.map(r => <RemitRow key={r.id} t={t} r={r}/>)}
        {paid.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, margin: "12px 2px 8px" }}>송금 완료</div>}
        {paid.map(r => <RemitRow key={r.id} t={t} r={r}/>)}
      </div>
    </div>
  );
}

// ── 본체 ──
const TABS = [
  { id: "tasks", icon: ClipboardList, label: "작업" },
  { id: "new",   icon: Plus,          label: "접수" },
  { id: "fee",   icon: Wallet,        label: "수수료" },
  { id: "info",  icon: User,          label: "내 정보" },
];

export default function KbPartnerApp({ user, onLogout }) {
  const [mode, setMode] = useState(() => loadTheme());
  const [tab, setTab] = useState("tasks");
  const [openTask, setOpenTask] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = THEMES[mode] || THEMES.dark;
  const afterReception = ({ taskNo, tbd }) => {
    window.alert(`접수했습니다${taskNo ? ` (${taskNo})` : ""}.\n${tbd ? "견적은 올데이케어가 확인한 뒤 넣습니다." : "올데이케어가 일정을 잡습니다."}`);
    setTab("tasks");
    setReloadKey(k => k + 1);
  };
  useEffect(() => { applyThemeVars(mode); }, [mode]);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, paddingTop: "env(safe-area-inset-top, 12px)" }}>
      <SafeTopCover background={t.bg}/>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}>
        {tab === "tasks" && <TasksTab t={t} onOpen={setOpenTask} reloadKey={reloadKey}/>}
        {tab === "new" && (
          <div>
            <TopBar t={t} title="접수" sub="주방후드 작업을 올데이케어에 접수합니다"/>
            <KbReception t={t} user={user} onDone={afterReception}/>
          </div>
        )}
        {tab === "fee" && <FeeTab t={t}/>}
        {tab === "info" && <InfoTab t={t} user={user} mode={mode} setMode={setMode} onLogout={onLogout} accountReadOnly/>}
      </div>
      {openTask && <TaskSheet t={t} row={openTask} onClose={() => setOpenTask(null)} onChanged={() => setReloadKey(k => k + 1)}/>}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: t.bgElevated, borderTop: `1px solid ${t.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", padding: "8px 8px 10px" }}>
          {TABS.map(b => {
            const Icon = b.icon;
            const on = tab === b.id;
            return (
              <button key={b.id} type="button" onClick={() => setTab(b.id)} style={{
                flex: 1, background: "transparent", border: "none", padding: "8px 6px", cursor: "pointer", fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: on ? t.accent : t.textMuted,
              }}>
                <Icon size={20}/>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
