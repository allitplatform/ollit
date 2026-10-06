// 2026-10-06 Mig 225·227·228 — 협력사 일일 정산 화면 3종 (방식 B: 협력사 관리자가 날짜별 1회 송금 보고).
//   · SubStaffSettleTab     협력사 기사 — 이번 주/이번 달 내 수익 + 날짜별 한 줄 (보기 전용)
//   · SubManagerSettleView  협력사 관리자 — 오늘 보낼 수수료 + 날짜별 [송금 보고]
//   · SubFeeAdminScreen     운영자 — 미확인 수수료 합계 + 협력사·날짜별 [입금 확인] / [보고 취소]
//
// 화면 원칙 (3화면 공통, 2026-10-06 사장님 확정)
//   · 맨 위 요약 카드 1개: 가장 중요한 숫자 1개만 크게 + 상태 + 주 버튼
//   · 설명은 제목 옆 "ⓘ 안내" 를 눌렀을 때만
//   · 상태 필터 칩: 처리 필요 / 보고됨 / 완료 / 전체 (기본: 처리 필요)
//   · 처리 필요한 날만 카드로 펼침. 확인 완료는 "지난 정산" 아래 한 줄 요약
//   · 내역은 표: 이름 | 건수 | 금액 (숫자 오른쪽 정렬, 고정폭 숫자), 합계 줄 맨 아래
//   · 조정(추가분·차감분)은 표 안의 한 줄 + "조정" 태그, 음수는 파란색
//   · 카드당 주 숫자 1개(강조색), 나머지는 작은 회색
//   색·모양은 기존 디자인 토큰(CSS 변수)만 사용.
//
// 금액 기준: 내 수익 = 공급가 − 올데이케어 수수료 − 협력사 회사 몫. 부가세는 별도 표시(신고·납부용).
//   조정 줄은 수수료 변동만 뜻하므로 기사 수익 계산에 넣지 않는다.
//   합계가 0 이하인 날은 송금 보고 없이 다음 날로 자동 이월 (상태 "이월").
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subStaffListSettlement, subListDailySettlements, subReportDailyFee,
  adminListSubDailyFees, adminConfirmSubDailyFee, adminCancelSubDailyReport, adminCloseSubCarryRefund,
} from "../lib/subcontractorsDb.js";
import { fmtWon, fmtWonSigned } from "../utils/money.js";

const NEG = "#3B82F6";   // 음수(차감분) 표시색
const todayKst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const dayLabel = (ymd) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
};

// 상태 → 색 (기존 상태 배지 패턴: 글자색 + 옅은 배경)
const STATUS_STYLE = {
  "대기":      { fg: "var(--text-secondary)", bg: "var(--bg-inset)" },
  "이월":      { fg: NEG,                      bg: "rgba(59,130,246,0.12)" },
  "보낼 금액 없음": { fg: "var(--text-secondary)", bg: "var(--bg-inset)" },
  "환급 완료": { fg: "var(--success, #10B981)", bg: "rgba(16,185,129,0.12)" },
  "보고됨":    { fg: "var(--accent)",          bg: "var(--accent-bg)" },
  "확인 완료": { fg: "var(--success, #10B981)", bg: "rgba(16,185,129,0.12)" },
  "차액":      { fg: "var(--danger, #EF4444)",  bg: "rgba(239,68,68,0.12)" },
  "미입금":    { fg: "var(--danger, #EF4444)",  bg: "rgba(239,68,68,0.12)" },
};
// 합계가 정확히 0인 날은 "이월"이 아니라 "보낼 금액 없음"(회색, 버튼 없음). 음수일 때만 "이월".
//   서버(mig 228)는 0 이하를 모두 "이월"로 돌려주므로 화면에서 나눈다.
const ZERO = "보낼 금액 없음";
// 환급 처리로 닫은 날(mig 233)은 서버가 "확인 완료" + 음수 합계로 돌려준다 → "환급 완료"로 표시.
const REFUNDED = "환급 완료";
const isClosed = (status) => status === "확인 완료" || status === REFUNDED;
const fixDay = (d) => {
  if (!d) return d;
  if (d.status === "이월" && Number(d.fee) === 0) return { ...d, status: ZERO };
  if (d.status === "확인 완료" && Number(d.fee) < 0) return { ...d, status: REFUNDED };
  return d;
};
// 이월이 며칠째인지 (가장 오래된 이월 날짜 기준, 한국 시간)
const carryAgeDays = (d) => {
  const first = (Array.isArray(d.carry_from) && d.carry_from[0]) || d.date;
  const t0 = new Date(`${first}T00:00:00+09:00`).getTime();
  return Number.isNaN(t0) ? 0 : Math.floor((Date.now() - t0) / 86400000);
};
// 필터 묶음
const NEEDS  = (role) => role === "admin" ? ["보고됨", "차액", "미입금"] : ["대기", "미입금", "차액"];
const FILTERS = [
  { key: "todo",     label: "처리 필요" },
  { key: "reported", label: "보고됨" },
  { key: "done",     label: "완료" },
  { key: "all",      label: "전체" },
];
function matchFilter(status, key, role) {
  if (key === "all") return true;
  if (key === "done") return isClosed(status);
  if (key === "reported") return status === "보고됨" || status === "차액";
  return NEEDS(role).includes(status) || status === "이월";
}

// ── 공통 조각 ────────────────────────────────────────────────
const S = {
  page:   { padding: "12px 12px 40px", color: "var(--text-primary)" },
  card:   { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  label:  { fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" },
  small:  { fontSize: 11, color: "var(--text-secondary)" },
  btnMain:  { padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", background: "var(--accent)", color: "#fff", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
  btnSub:   { padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid var(--border)", background: "var(--bg-inset)", color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
  btnLink:  { background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: 0 },
};

function Badge({ status }) {
  const c = STATUS_STYLE[status] || STATUS_STYLE["대기"];
  return <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 9px", borderRadius: 5, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>{status}</span>;
}

function Num({ value, signed = false, strong = false, color }) {
  const v = Number(value) || 0;
  return (
    <span className="mono" style={{
      fontVariantNumeric: "tabular-nums", fontWeight: strong ? 800 : 600,
      color: color || (v < 0 ? NEG : "var(--text-primary)"),
    }}>{signed ? fmtWonSigned(v) : fmtWon(v)}</span>
  );
}

// 제목 줄: 제목 + ⓘ 안내(눌렀을 때만) + 새로고침
function TitleBar({ title, help, onReload, loading, left }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {left}
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{title}</div>
        {help && <button type="button" onClick={() => setOpen(v => !v)} style={S.btnLink}>ⓘ 안내</button>}
        <button type="button" onClick={onReload} disabled={loading} style={S.btnSub}>{loading ? "…" : "새로고침"}</button>
      </div>
      {open && help && (
        <div style={{ ...S.small, lineHeight: 1.6, marginTop: 8, padding: "10px 12px", background: "var(--bg-inset)", borderRadius: 8 }}>{help}</div>
      )}
    </div>
  );
}

// 맨 위 요약 카드: 주 숫자 1개 + 상태 + 주 버튼
function HeroCard({ label, value, status, sub, action }) {
  return (
    <div style={{ ...S.card, padding: "16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...S.label, flex: 1 }}>{label}</span>
        {status && <Badge status={status}/>}
      </div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 800, marginTop: 6, fontVariantNumeric: "tabular-nums", color: Number(value) < 0 ? NEG : "var(--accent)" }}>
        {fmtWon(value)}
      </div>
      {sub && <div style={{ ...S.small, marginTop: 4 }}>{sub}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

function FilterChips({ value, onChange, counts }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
      {FILTERS.map(f => {
        const on = value === f.key;
        return (
          <button key={f.key} type="button" onClick={() => onChange(f.key)} style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
            border: on ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: on ? "var(--accent)" : "var(--bg-inset)",
            color: on ? "#fff" : "var(--text-secondary)",
          }}>{f.label}{counts && counts[f.key] != null ? ` ${counts[f.key]}` : ""}</button>
        );
      })}
    </div>
  );
}

// 표: columns = [{ key, label, align }], rows = [{ ...cells, tag, tone }], foot = 합계 줄
function Table({ columns, rows, foot }) {
  const cell = (align) => ({ padding: "6px 4px", textAlign: align || "left", fontSize: 12, verticalAlign: "top" });
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead>
        <tr>
          {columns.map(c => (
            <th key={c.key} style={{ ...cell(c.align), fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map(c => <td key={c.key} style={cell(c.align)}>{r[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>
            {columns.map(c => <td key={c.key} style={{ ...cell(c.align), fontWeight: 800 }}>{foot[c.key]}</td>)}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

const Tag = ({ children }) => (
  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, marginRight: 4, background: "rgba(59,130,246,0.12)", color: NEG }}>{children}</span>
);

// 지난 정산 한 줄 요약
function PastLine({ left, count, amount, status, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 4px", borderBottom: "1px solid var(--border)", cursor: onClick ? "pointer" : "default" }}>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      <span style={{ ...S.small, whiteSpace: "nowrap" }}>{count}건</span>
      <span style={{ fontSize: 12, minWidth: 84, textAlign: "right" }}><Num value={amount}/></span>
      <Badge status={status}/>
    </div>
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

const ErrorBox = ({ text }) => <div style={{ ...S.card, color: "var(--danger, #EF4444)", fontWeight: 700, fontSize: 13 }}>{text}</div>;
const Empty = ({ text }) => <div style={{ ...S.small, textAlign: "center", padding: "36px 0" }}>{text}</div>;

// 날짜 줄 → 기사별 묶음 (조정 줄은 수익에 넣지 않는다)
function groupByEngineer(lines) {
  const m = new Map();
  for (const l of lines || []) {
    if (l.kind !== "base") continue;
    const key = l.engineer_id || "none";
    if (!m.has(key)) m.set(key, { name: l.engineer_name || "기사 미정", count: 0, received: 0, fee: 0, net: 0, vat: 0 });
    const g = m.get(key);
    g.count += 1;
    g.received += Number(l.received) || 0;
    g.fee += Number(l.fee) || 0;
    g.net += Number(l.net) || 0;
    g.vat += Number(l.vat) || 0;
  }
  return [...m.values()];
}

// ─────────────────────────────────────────────────────────────
// 1) 협력사 기사 — 정산 탭 (보기 전용)
// ─────────────────────────────────────────────────────────────
export function SubStaffSettleTab({ user }) {
  const fn = useCallback(() => subStaffListSettlement(), []);
  const { data, loading, error, load } = useLoader(fn);
  const days = ((data && data.days) || []).map(fixDay);
  const [open, setOpen] = useState(null);
  const subName = user?.subcontractor?.name || "협력사";

  const sums = useMemo(() => {
    const today = todayKst();
    const d0 = new Date(`${today}T00:00:00+09:00`);
    // 한국 시간 기준 요일 (0=일). 주는 월요일 시작.
    const kstDow = new Date(d0.getTime() + 9 * 3600 * 1000).getUTCDay();
    const monOffset = kstDow === 0 ? 6 : kstDow - 1;
    const weekStart = new Date(d0.getTime() - monOffset * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const monthStart = today.slice(0, 8) + "01";
    let week = 0, month = 0, weekCnt = 0, monthCnt = 0;
    for (const d of days) {
      if (d.date >= monthStart) { month += Number(d.net) || 0; monthCnt += Number(d.task_count) || 0; }
      if (d.date >= weekStart)  { week  += Number(d.net) || 0; weekCnt  += Number(d.task_count) || 0; }
    }
    return { week, month, weekCnt, monthCnt };
  }, [days]);

  return (
    <div style={S.page}>
      <TitleBar
        title="내 정산" onReload={load} loading={loading}
        help={`내 수익 = 공급가 − 수수료. 수수료는 ${subName}에 내고, ${subName}가 올데이케어에 모아서 보냅니다. 부가세를 포함해 받은 건의 부가세는 수익에 넣지 않고 따로 보여 줍니다(신고·납부용). 이 화면은 금액 확인용입니다.`}
      />
      <HeroCard
        label="이번 주 내 수익" value={sums.week}
        sub={`이번 주 ${sums.weekCnt}건 · 이번 달 ${fmtWon(sums.month)} (${sums.monthCnt}건)`}
      />
      {error && <ErrorBox text={error}/>}
      {!error && !loading && days.length === 0 && <Empty text="최근 한 달 완료한 작업이 없습니다."/>}

      {days.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>날짜별</div>
          {days.map(d => (
            <div key={d.date}>
              <div onClick={() => setOpen(open === d.date ? null : d.date)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{dayLabel(d.date)}</span>
                <span style={S.small}>{d.task_count}건</span>
                <span style={{ fontSize: 13, minWidth: 90, textAlign: "right" }}><Num value={d.net} strong/></span>
                <span style={S.small}>{open === d.date ? "▲" : "▼"}</span>
              </div>
              {open === d.date && (
                <div style={{ padding: "4px 0 10px" }}>
                  <Table
                    columns={[
                      { key: "name", label: "고객" },
                      { key: "received", label: "받은 금액", align: "right" },
                      { key: "fee", label: "수수료", align: "right" },
                      { key: "net", label: "내 수익", align: "right" },
                    ]}
                    rows={(d.tasks || []).map(t => ({
                      name: t.customer_name,
                      received: <Num value={t.received}/>,
                      fee: <Num value={t.fee}/>,
                      net: <Num value={t.net} strong/>,
                    }))}
                    foot={{ name: "합계", received: <Num value={d.received}/>, fee: <Num value={d.fee}/>, net: <Num value={d.net} strong/> }}
                  />
                  {Number(d.vat) > 0 && <div style={{ ...S.small, marginTop: 6 }}>부가세 {fmtWon(d.vat)} (신고·납부용, 수익에 미포함)</div>}
                  {Number(d.staff_cut) > 0 && <div style={{ ...S.small, marginTop: 2 }}>{subName} 회사 몫 {fmtWon(d.staff_cut)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 날짜 카드 본문 (관리자·운영자 공용): 기사별 표 또는 작업별 표
// ─────────────────────────────────────────────────────────────
function DayTable({ day, mode, onOpenTask }) {
  const lines = day.lines || [];
  const adjust = lines.filter(l => l.kind !== "base" || l.origin_date);
  if (mode === "engineer") {
    const engs = groupByEngineer(lines.filter(l => !l.origin_date));
    const rows = engs.map(g => ({
      name: g.name,
      count: <span className="mono">{g.count}</span>,
      fee: <Num value={g.fee}/>,
      net: <Num value={g.net}/>,
    }));
    for (const l of adjust) {
      rows.push({
        name: <><Tag>{l.kind === "base" ? "이월" : "조정"}</Tag>{l.customer_name}{l.origin_date ? ` (${dayLabel(l.origin_date)})` : ""}</>,
        count: "",
        fee: <Num value={l.fee} signed/>,
        net: "",      // 조정·이월 줄은 기사 수익 칸을 비운다
      });
    }
    if (Number(day.carry_in) !== 0 && !day.locked) {
      rows.push({ name: <><Tag>이월</Tag>지난 날짜에서 넘어온 금액</>, count: "", fee: <Num value={day.carry_in} signed/>, net: "" });
    }
    return (
      <Table
        columns={[
          { key: "name", label: "기사" }, { key: "count", label: "건수", align: "right" },
          { key: "fee", label: "걷을 수수료", align: "right" }, { key: "net", label: "기사 수익", align: "right" },
        ]}
        rows={rows}
        foot={{ name: "합계", count: <span className="mono">{day.task_count}</span>, fee: <Num value={day.fee} strong/>, net: "" }}
      />
    );
  }
  // 작업별 (운영자)
  const rows = lines.map(l => ({
    name: (
      <>
        {(l.kind !== "base" || l.origin_date) && <Tag>{l.kind === "base" ? "이월" : "조정"}</Tag>}
        <span className="mono">{l.task_no}</span> · {l.engineer_name || "기사 미정"}
        {onOpenTask && (
          <button type="button" onClick={() => onOpenTask(l.task_id)} style={{ ...S.btnLink, fontSize: 11, marginLeft: 6 }}>사진 {l.photo_count || 0} · 열기</button>
        )}
      </>
    ),
    received: l.kind === "base" ? <Num value={l.received}/> : "",
    supply: l.kind === "base" ? <Num value={l.supply}/> : "",
    fee: <Num value={l.fee} signed={l.kind !== "base"}/>,
  }));
  if (Number(day.carry_in) !== 0 && !day.locked) {
    rows.push({ name: <><Tag>이월</Tag>지난 날짜에서 넘어온 금액</>, received: "", supply: "", fee: <Num value={day.carry_in} signed/> });
  }
  return (
    <Table
      columns={[
        { key: "name", label: "작업 · 기사" }, { key: "received", label: "받은 금액", align: "right" },
        { key: "supply", label: "공급가", align: "right" }, { key: "fee", label: "수수료", align: "right" },
      ]}
      rows={rows}
      foot={{ name: "합계", received: <Num value={day.received}/>, supply: <Num value={day.supply}/>, fee: <Num value={day.fee} strong/> }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 2) 협력사 관리자 — 정산
// ─────────────────────────────────────────────────────────────
export function SubManagerSettleView() {
  const fn = useCallback(() => subListDailySettlements(), []);
  const { data, loading, error, load } = useLoader(fn);
  const days = ((data && data.days) || []).map(fixDay);
  const [filter, setFilter] = useState("todo");
  const [reporting, setReporting] = useState(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pastOpen, setPastOpen] = useState(null);

  const today = todayKst();
  const todayRow = days.find(d => d.date === today) || null;
  const counts = useMemo(() => {
    const c = {};
    for (const f of FILTERS) c[f.key] = days.filter(d => matchFilter(d.status, f.key, "sub")).length;
    return c;
  }, [days]);
  const active = days.filter(d => !isClosed(d.status) && matchFilter(d.status, filter, "sub"));
  const past = days.filter(d => isClosed(d.status) && (filter === "done" || filter === "all"));

  const canReport = (d) => !d.locked && Number(d.fee) > 0;

  async function submit() {
    if (busy || !reporting) return;
    const n = Number(String(amount).replace(/[^0-9]/g, ""));
    if (String(amount).trim() === "" || !Number.isFinite(n)) { alert("실제 보낸 금액을 입력해 주세요."); return; }
    const diff = n - Number(reporting.fee || 0);
    const msg = diff === 0
      ? `${dayLabel(reporting.date)} 수수료 ${fmtWon(n)} 송금을 보고할까요?\n보고하면 이 날짜는 잠깁니다.`
      : `계산된 수수료는 ${fmtWon(reporting.fee)} 인데 ${fmtWon(n)} 로 보고합니다 (차액 ${fmtWonSigned(diff)}).\n그대로 보고할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await subReportDailyFee(reporting.date, n);
    setBusy(false);
    if (!res.ok) { alert(res.error || "보고하지 못했습니다."); return; }
    setReporting(null);
    load();
  }
  const openReport = (d) => { setReporting(d); setAmount(String(d.fee || 0)); };

  return (
    <div style={S.page}>
      <TitleBar
        title="수수료 정산" onReload={load} loading={loading}
        help="날짜별로 올데이케어에 보낼 수수료입니다. 기사에게 걷은 뒤 하루에 한 번 송금하고 [송금 보고]를 눌러 주세요. 보고한 날짜는 잠기고, 그 뒤 바뀐 금액은 다음 날짜에 조정(추가분·차감분) 줄로 나옵니다. 합계가 0 이하인 날은 보고 없이 다음 송금에서 자동으로 차감됩니다(이월)."
      />
      <HeroCard
        label="오늘 보낼 수수료" value={todayRow ? todayRow.fee : 0}
        status={todayRow ? todayRow.status : "대기"}
        sub={todayRow ? `오늘 완료 ${todayRow.task_count}건 · 받은 금액 ${fmtWon(todayRow.received)}` : "오늘 완료한 작업이 없습니다"}
        action={todayRow && canReport(todayRow)
          ? <button type="button" onClick={() => openReport(todayRow)} style={{ ...S.btnMain, width: "100%" }}>송금 보고</button>
          : null}
      />
      <FilterChips value={filter} onChange={setFilter} counts={counts}/>
      {error && <ErrorBox text={error}/>}
      {!error && !loading && active.length === 0 && past.length === 0 && <Empty text="해당 상태의 정산이 없습니다."/>}

      {active.map(d => (
        <div key={d.date} style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{dayLabel(d.date)}</span>
            <Badge status={d.status}/>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: Number(d.fee) < 0 ? NEG : "var(--accent)" }}>{fmtWon(d.fee)}</span>
            <span style={S.small}>
              {d.status === "이월" ? "다음 송금에서 차감" : "보낼 수수료"}
              {d.reported_amount != null ? ` · 보고 ${fmtWon(d.reported_amount)}` : ""}
              {d.diff != null && Number(d.diff) !== 0 ? ` · 차액 ${fmtWonSigned(d.diff)}` : ""}
            </span>
          </div>
          <DayTable day={d} mode="engineer"/>
          {canReport(d) && (
            <button type="button" onClick={() => openReport(d)} style={{ ...S.btnMain, width: "100%", marginTop: 12 }}>송금 보고</button>
          )}
        </div>
      ))}

      {past.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>지난 정산</div>
          {past.map(d => (
            <div key={d.date}>
              <PastLine left={dayLabel(d.date)} count={d.task_count} amount={d.fee} status={d.status} onClick={() => setPastOpen(pastOpen === d.date ? null : d.date)}/>
              {pastOpen === d.date && <DayTable day={d} mode="engineer"/>}
            </div>
          ))}
        </div>
      )}

      {reporting && (
        <div onClick={() => { if (!busy) setReporting(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-secondary)", color: "var(--text-primary)", width: "100%", maxWidth: 560, boxSizing: "border-box",
            borderRadius: "18px 18px 0 0", padding: "18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>송금 보고 · {dayLabel(reporting.date)}</div>
            <div style={{ ...S.small, margin: "4px 0 12px" }}>계산된 수수료 {fmtWon(reporting.fee)} · 실제 보낸 금액을 입력해 주세요</div>
            <input
              type="text" inputMode="numeric" autoComplete="off" className="mono"
              value={amount === "" ? "" : Number(String(amount).replace(/[^0-9]/g, "") || 0).toLocaleString("ko-KR")}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              style={{
                display: "block", width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10,
                border: "1.5px solid var(--accent)", background: "var(--bg-elevated)", color: "var(--text-primary)",
                fontSize: 22, fontWeight: 800, textAlign: "right", outline: "none",
              }}
            />
            <button type="button" disabled={busy} onClick={submit} style={{ ...S.btnMain, width: "100%", marginTop: 14, padding: 16 }}>
              {busy ? "보고 중…" : "보고하기"}
            </button>
            <button type="button" disabled={busy} onClick={() => setReporting(null)} style={{ ...S.btnSub, width: "100%", marginTop: 8 }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3) 운영자 — 협력사 수수료
// ─────────────────────────────────────────────────────────────
export function SubFeeAdminScreen({ onBack, onOpenTask }) {
  const fn = useCallback(() => adminListSubDailyFees(), []);
  const { data, loading, error, load } = useLoader(fn);
  const subs = (data && data.subcontractors) || [];
  const [filter, setFilter] = useState("todo");
  const [busy, setBusy] = useState(false);
  const [pastOpen, setPastOpen] = useState(null);

  const rows = useMemo(() => {
    const out = [];
    for (const s of subs) for (const d of (s.days || [])) out.push({ ...fixDay(d), subId: s.id, subName: s.name, key: `${s.id}|${d.date}` });
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.subName.localeCompare(b.subName, "ko"));
    return out;
  }, [subs]);

  const summary = useMemo(() => {
    let unconfirmed = 0, waitingConfirm = 0, unpaid = 0;
    for (const r of rows) {
      if (isClosed(r.status) || r.status === "이월" || r.status === ZERO) continue;
      unconfirmed += Number(r.fee) || 0;
      if (r.status === "보고됨" || r.status === "차액") waitingConfirm += 1;
      if (r.status === "미입금") unpaid += 1;
    }
    return { unconfirmed, waitingConfirm, unpaid };
  }, [rows]);

  const counts = useMemo(() => {
    const c = {};
    for (const f of FILTERS) c[f.key] = rows.filter(r => matchFilter(r.status, f.key, "admin")).length;
    return c;
  }, [rows]);
  const active = rows.filter(r => !isClosed(r.status) && matchFilter(r.status, filter, "admin"));
  const past = rows.filter(r => isClosed(r.status) && (filter === "done" || filter === "all"));
  // 협력사별 "가장 마지막 이월 날짜" — 환급 처리로 닫을 수 있는 날 (뒤에 열린 날이 있으면 그날로 넘어간다)
  const lastCarry = useMemo(() => {
    const open = new Map();     // subId → 가장 늦은 열린 날짜
    for (const r of rows) if (!r.locked && (!open.has(r.subId) || r.date > open.get(r.subId))) open.set(r.subId, r.date);
    const set = new Set();
    for (const r of rows) if (r.status === "이월" && Number(r.fee) < 0 && open.get(r.subId) === r.date) set.add(r.key);
    return set;
  }, [rows]);

  // 환급 처리로 닫기 (Mig 233) — 이월 금액을 협력사에 돌려준 뒤 마감. 사유 필수.
  async function closeRefund(r) {
    if (busy) return;
    const amount = -Number(r.fee);
    if (!window.confirm(`가계부에 지출 ${fmtWon(amount)}이 기록됩니다.
${r.subName} · ${dayLabel(r.date)} 이월 금액을 환급 처리로 닫을까요?`)) return;
    const reason = window.prompt(`${r.subName} · ${dayLabel(r.date)} 이월 금액 ${fmtWon(amount)}을 협력사에 환급하고 닫습니다.
가계부에 지출 ${fmtWon(amount)}이 기록됩니다. 닫은 뒤에는 화면에서 되돌릴 수 없습니다.

사유를 입력해 주세요.`);
    if (reason == null) return;
    if (!String(reason).trim()) { window.alert("사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await adminCloseSubCarryRefund(r.subId, r.date, amount, String(reason).trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    if (res.cashflow_error) window.alert("환급 처리는 닫았지만 가계부 기록에 실패했습니다. 가계부에 직접 입력해 주세요.");
    load();
  }

  async function confirmRow(r, confirm) {
    if (busy) return;
    const msg = confirm
      ? `${r.subName} · ${dayLabel(r.date)}\n보고 금액 ${fmtWon(r.reported_amount)} 입금을 확인할까요?${Number(r.diff) !== 0 ? `\n(계산 수수료 ${fmtWon(r.fee)} 과 차액 ${fmtWonSigned(r.diff)})` : ""}`
      : `${r.subName} · ${dayLabel(r.date)} 입금 확인을 취소할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await adminConfirmSubDailyFee(r.subId, r.date, confirm);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    load();
  }

  // 보고 취소 (Mig 227) — 보고됨/차액 상태를 다시 대기로. 사유 필수, 취소자·사유는 서버가 기록.
  async function cancelReport(r) {
    if (busy) return;
    const reason = window.prompt(`${r.subName} · ${dayLabel(r.date)} 송금 보고(${fmtWon(r.reported_amount)})를 취소합니다.\n취소 사유를 입력해 주세요.`);
    if (reason == null) return;
    if (!String(reason).trim()) { window.alert("취소 사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await adminCancelSubDailyReport(r.subId, r.date, String(reason).trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "취소하지 못했습니다."); return; }
    load();
  }

  return (
    <div style={{ ...S.page, maxWidth: 860, margin: "0 auto", padding: "16px 16px 60px" }}>
      <TitleBar
        title="협력사 수수료" onReload={load} loading={loading}
        left={onBack ? <button type="button" onClick={onBack} style={S.btnSub}>← 뒤로</button> : null}
        help="협력사가 날짜별로 한 번 송금 보고한 수수료를 확인합니다. 받을 수수료는 협력사 신고액이 아니라 완료 작업 기준 올잇 계산값입니다. 보고 금액이 계산과 다르면 '차액', 다음 날 정오까지 보고가 없으면 '미입금'으로 표시됩니다. 합계가 0 이하인 날은 다음 송금에서 자동으로 차감됩니다(이월)."
      />
      <HeroCard
        label="미확인 수수료 합계" value={summary.unconfirmed}
        status={summary.unpaid > 0 ? "미입금" : summary.waitingConfirm > 0 ? "보고됨" : "대기"}
        sub={`입금 확인 대기 ${summary.waitingConfirm}건 · 미입금 ${summary.unpaid}건`}
      />
      <FilterChips value={filter} onChange={setFilter} counts={counts}/>
      {error && <ErrorBox text={error}/>}
      {!error && !loading && active.length === 0 && past.length === 0 && <Empty text="해당 상태의 정산이 없습니다."/>}

      {active.map(r => (
        <div key={r.key} style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{r.subName}</span>
            <span style={{ ...S.small, flex: 1 }}>{dayLabel(r.date)} · {r.task_count}건</span>
            <Badge status={r.status}/>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: Number(r.fee) < 0 ? NEG : "var(--accent)" }}>{fmtWon(r.fee)}</span>
            <span style={S.small}>
              받을 수수료
              {r.reported_amount != null ? ` · 보고 ${fmtWon(r.reported_amount)}` : " · 보고 전"}
              {r.diff != null && Number(r.diff) !== 0 ? ` · 차액 ${fmtWonSigned(r.diff)}` : ""}
            </span>
          </div>
          <DayTable day={r} mode="task" onOpenTask={onOpenTask}/>
          {lastCarry.has(r.key) && (
            <div style={{ marginTop: 12 }}>
              {carryAgeDays(r) >= 14 && (
                <div style={{ ...S.small, color: "var(--danger, #EF4444)", fontWeight: 700, marginBottom: 8 }}>
                  이월 {carryAgeDays(r)}일째 — 차감할 송금이 생기지 않고 있습니다.
                </div>
              )}
              <button type="button" disabled={busy} onClick={() => closeRefund(r)} style={S.btnSub}>환급 처리로 닫기</button>
            </div>
          )}
          {r.locked && !r.confirmed_at && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" disabled={busy} onClick={() => confirmRow(r, true)} style={{ ...S.btnMain, flex: 1 }}>입금 확인</button>
              <button type="button" disabled={busy} onClick={() => cancelReport(r)} style={{ ...S.btnSub, color: "var(--danger, #EF4444)" }}>보고 취소</button>
            </div>
          )}
        </div>
      ))}

      {past.length > 0 && (
        <div style={S.card}>
          <div style={S.label}>지난 정산</div>
          {past.map(r => (
            <div key={r.key}>
              <PastLine left={`${dayLabel(r.date)} · ${r.subName}`} count={r.task_count} amount={r.fee} status={r.status} onClick={() => setPastOpen(pastOpen === r.key ? null : r.key)}/>
              {pastOpen === r.key && (
                <div style={{ paddingBottom: 10 }}>
                  <DayTable day={r} mode="task" onOpenTask={onOpenTask}/>
                  {r.status !== REFUNDED && (
                    <button type="button" disabled={busy} onClick={() => confirmRow(r, false)} style={{ ...S.btnSub, marginTop: 8 }}>확인 취소</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
