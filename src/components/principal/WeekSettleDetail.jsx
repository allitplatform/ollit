// 2026-06-02 — 주차별 정산 드릴인 공유 컴포넌트 (운영자 ① + 유솔 PWA 공유).
//
// 사장님 spec:
//   · 헤더 + 검색창 + 필터 칩 [전체 / 대기 / 네이버결제완료 / 회사입금완료] + 작업 리스트.
//   · actionMode prop 측 분기:
//       "principal" → [입금했습니다] / [보고 취소] / 확인 완료 메시지
//       "admin"     → [입금 확인] / "유솔 보고 대기" 비활성 / 확인 완료 메시지
//   · 검색·필터·리스트·날짜(kstYmd)·헤더 건수(cancel 제외) 모두 동일.
//
// ⚠️ 측 측 측 — deposit 날짜 자동 완료/예정 표시 측 보고/확인 흐름 측 충돌 가능. 일단 화면·버튼만 구현.
//
// 사용처:
//   · PrincipalSettleTab.WeekDetailView (principal mode)
//   · UsolNToCompanySection 측 admin wrapper (admin mode, fullscreen)
import { useMemo, useState } from "react";
import { Search, ChevronLeft, Check, Download } from "lucide-react";
import {
  USOL_N_PID,
  NAVER_NET_TO_COMPANY_FACTOR,
  kstYmd,
  mdLabel,
  C_GREEN_DONE,
} from "../../lib/usolNWeeklyData.js";

// 2026-06-09 — usol_n 주정산 엑셀 다운로드 헬퍼.
//   sunday 가 속한 달 기준 N월 N주차 라벨 (PrincipalSettleTab getKoreanWeekLabel 과 동일 산식).
function getKoreanWeekLabelStr(mondayYmd, sundayYmd) {
  if (!mondayYmd || !sundayYmd) return "주차";
  const [sy, sm, sd] = sundayYmd.split("-").map(Number);
  const sun = new Date(sy, sm - 1, sd);
  const year = sun.getFullYear();
  const month = sun.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayDow = firstDay.getDay() || 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - (firstDayDow - 1));
  const [my, mm, md] = mondayYmd.split("-").map(Number);
  const mon = new Date(my, mm - 1, md);
  const diff = Math.round((mon.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${month + 1}월 ${diff + 1}주차`;
}
import {
  getSettleStageKey,
  getItemLabel,
  SETTLE_STAGES,
} from "../../lib/principalSettleDb.js";

const C_MAGENTA = "#FF4D9E";
const C_GREEN   = C_GREEN_DONE;
const C_AMBER   = "#E6A33A";
const C_GRAY    = "#9CA3AF";

// 주차 remit 상태 — principal_id별 remit row 측 measurement.
//   기존 PrincipalSettleTab 측 spec 측 공유.
export function getWeekRemitStatus(items, remitMap) {
  const principalIds = [...new Set(items.map(it => it.principal_id).filter(Boolean))];
  if (principalIds.length === 0) return { kind: "expected", remits: [] };
  const remits = principalIds.map(pid => remitMap.get(pid));
  const anyExist = remits.some(r => r);
  if (!anyExist) return { kind: "expected", remits: [] };
  const allConfirmed = remits.every(r => r && r.confirmed_at);
  if (allConfirmed) return { kind: "done", remits };
  const allReported = remits.every(r => r && r.remitted_at);
  if (allReported) return { kind: "reported", remits };
  return { kind: "reported", remits: remits.filter(Boolean) };
}

export function WeekSettleDetail({
  // 데이터
  week,
  items,                       // 측 측 측 측 (admin wrapper 측 측 측). null 측 week.items 측 fallback.
  loading = false,
  error = "",
  // 검색·필터 state (parent 측 측)
  search = "",
  setSearch,
  stageFilter = "all",
  setStageFilter,
  dateFilter = "",
  setDateFilter,
  // 액션
  actionMode = "principal",    // "principal" | "admin"
  remitStatus,                  // { kind, remits }
  onReport,                     // principal — [입금했습니다]
  onUndo,                       // principal — [보고 취소]
  onConfirm,                    // admin — [입금 확인]
  // 측 spec
  onBack,
  onItemClick,
}) {
  // submitting state — WeekSettleDetail 자체 측 측 (confirm + async 측).
  const [submitting, setSubmitting] = useState(false);
  // cancel-strict 필터 (safety, 이미 measure 측 측 측 측 redundant).
  const baseItems = useMemo(() => {
    const src = items || week?.items || [];
    return src.filter(it => it.is_canceled !== true && it.task_status !== "취소");
  }, [items, week?.items]);

  // 검색·필터.
  const filtered = useMemo(() => {
    let list = baseItems;
    if (stageFilter !== "all") list = list.filter(it => getSettleStageKey(it) === stageFilter);
    if (dateFilter) list = list.filter(it => kstYmd(it.naver_settled_at) === dateFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(it => {
        const cust = String(it.customer_name || "").toLowerCase();
        const addr = String(it.address || "").toLowerCase();
        const tno  = String(it.task_no || "").toLowerCase();
        const poid = String(it.product_order_id || "").toLowerCase();
        return cust.includes(q) || addr.includes(q) || tno.includes(q) || poid.includes(q);
      });
    }
    return list;
  }, [baseItems, stageFilter, dateFilter, search]);

  // 날짜 옵션 (KST 변환).
  const dateOptions = useMemo(() => {
    const set = new Set();
    for (const it of baseItems) {
      const ymd = kstYmd(it.naver_settled_at);
      if (ymd) set.add(ymd);
    }
    return [...set].sort();
  }, [baseItems]);

  const isPending = week?.key === "pending";
  // 2026-06-15 — 상단 합계 = 회사 받을 합 (= Σ _company_receive, item.subtotal − 분배 principal).
  //   _company_receive 있으면 그걸로, 없으면 subtotal 폴백.
  //   옛: pending=Σsubtotal / 기타=ΣnetAmount×0.85 → 둘 다 회사 실수령 의미와 안 맞음.
  //   사장님 spec a248fc9 (저장된 principal_amount 사용, 고정 ×0.85 금지).
  const sumSubtotal = filtered.reduce((s, it) => {
    const v = it._company_receive != null
      ? Number(it._company_receive)
      : Number(it.subtotal);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  const headerLabel = isPending
    ? "정산 대기"
    : `${koreanWeekLabel(week)}  네이버 정산 ${dateRangeLabel(week)}`;

  // 2026-06-09 — 유솔 PWA 주정산 엑셀 다운로드.
  //   대상: 그 주차의 usol_n 정산건 (principal_id === USOL_N_PID && naver_settled_at 있음).
  //   pending 버킷 / 비-usol_n 주차 / 다운로드 대상 0 건 → 버튼 미노출.
  //   xlsx 동적 import — 초기 번들 영향 0.
  const downloadableItems = useMemo(() => {
    return baseItems.filter(it => it.principal_id === USOL_N_PID && it.naver_settled_at);
  }, [baseItems]);
  const canDownload = !isPending && downloadableItems.length > 0;
  const [downloading, setDownloading] = useState(false);

  async function downloadWeekExcel() {
    if (downloading || !canDownload) return;
    setDownloading(true);
    try {
      const XLSX = await import("xlsx");
      const label = getKoreanWeekLabelStr(week?.mondayStr, week?.sundayStr);
      const range = week?.mondayStr && week?.sundayStr
        ? `${mdLabel(week.mondayStr)}~${mdLabel(week.sundayStr)}`
        : "";
      const detail = downloadableItems.map(it => {
        const base = Number(it.net_amount) || 0;
        return {
          "정산완료일":     kstYmd(it.naver_settled_at) || "",
          "상품주문번호":   String(it.product_order_id ?? ""),
          "구매자명":       it.customer_name || "",
          "서비스종류":     it.work_types?.name || "",
          "배정기사":       it.assigned_engineer_name || "",
          "정산원금":       base,
          "유솔수수료(15%)": Math.round(base * 0.15),
          "실입금(85%)":    Math.round(base * NAVER_NET_TO_COMPANY_FACTOR),
        };
      });
      const tot = detail.reduce((s, d) => s + d["정산원금"], 0);
      const summary = [{
        "정산주차":       label,
        "기간":           range,
        "네이버 건수":    detail.length,
        "정산원금":       tot,
        "유솔수수료(15%)": Math.round(tot * 0.15),
        "실입금(85%)":    Math.round(tot * NAVER_NET_TO_COMPANY_FACTOR),
      }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "요약");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "건별 상세");
      XLSX.writeFile(wb, `유솔N_주정산_${label}.xlsx`);
    } catch (err) {
      console.error("[WeekSettleDetail.downloadWeekExcel]", err);
      alert("엑셀 다운로드 실패: " + (err?.message || "알 수 없는 오류"));
    } finally {
      setDownloading(false);
    }
  }

  // 액션 wrapper — confirm + submitting state 측 측.
  async function doReport() {
    if (typeof onReport !== "function") return;
    if (!confirm(`이번 주차(₩${sumSubtotal.toLocaleString()})에 입금했습니까?`)) return;
    setSubmitting(true);
    try { await onReport(); } finally { setSubmitting(false); }
  }
  async function doUndo() {
    if (typeof onUndo !== "function") return;
    if (!confirm("보고를 취소하시겠습니까?")) return;
    setSubmitting(true);
    try { await onUndo(); } finally { setSubmitting(false); }
  }
  async function doConfirm() {
    if (typeof onConfirm !== "function") return;
    const reportedAmount = remitStatus?.remits?.reduce((s, r) => s + (Number(r.remitted_amount) || 0), 0) || 0;
    if (!confirm(`유솔 보고 ₩${reportedAmount.toLocaleString()} 입금 확인 처리합니까?`)) return;
    setSubmitting(true);
    try { await onConfirm(); } finally { setSubmitting(false); }
  }

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 뒤로 + 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={backButtonStyle} aria-label="뒤로">
          <ChevronLeft size={14}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {headerLabel}
          </div>
          <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
            {loading ? "..." : `${filtered.length}건`} · <span style={{ color: C_MAGENTA, fontWeight: 700 }}>₩{sumSubtotal.toLocaleString()}</span>
          </div>
        </div>
        {/* 2026-06-09 — 유솔 주정산 엑셀 다운로드 (usol_n 정산건 있을 때만) */}
        {canDownload && (
          <button
            onClick={downloadWeekExcel}
            disabled={downloading}
            aria-label="엑셀 다운로드"
            style={{
              flexShrink: 0,
              padding: "6px 10px",
              background: "var(--bg-secondary, #1A1A1A)",
              border: `1px solid ${C_GREEN}`,
              borderRadius: 8,
              color: C_GREEN,
              fontSize: 11, fontWeight: 700,
              fontFamily: "inherit",
              cursor: downloading ? "not-allowed" : "pointer",
              opacity: downloading ? 0.5 : 1,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <Download size={12} strokeWidth={2.5}/>
            {downloading ? "..." : "엑셀"}
          </button>
        )}
      </div>

      {/* RemitAction — actionMode 분기 */}
      {!isPending && remitStatus && (
        <RemitAction
          actionMode={actionMode}
          status={remitStatus}
          submitting={submitting}
          onReport={doReport}
          onUndo={doUndo}
          onConfirm={doConfirm}
        />
      )}

      {/* 검색창 */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: C_GRAY, pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={search}
          onChange={e => setSearch && setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호 / 상품주문번호"
          style={searchInputStyle}
        />
      </div>

      {/* 날짜 필터 */}
      {!isPending && dateOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <FilterChip active={dateFilter === ""} onClick={() => setDateFilter && setDateFilter("")}>전체 날짜</FilterChip>
          {dateOptions.map(d => {
            const md = d.slice(5).replace("-", "/");
            return <FilterChip key={d} active={dateFilter === d} onClick={() => setDateFilter && setDateFilter(d)}>{md}</FilterChip>;
          })}
        </div>
      )}

      {/* 단계 필터 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterChip active={stageFilter === "all"} onClick={() => setStageFilter && setStageFilter("all")}>전체</FilterChip>
        {SETTLE_STAGES.map(s => (
          <FilterChip key={s.key} active={stageFilter === s.key} onClick={() => setStageFilter && setStageFilter(s.key)}>
            {s.dot} {s.label}
          </FilterChip>
        ))}
      </div>

      {/* 리스트 */}
      {loading ? (
        <EmptyBox>불러오는 중...</EmptyBox>
      ) : error ? (
        <EmptyBox><span style={{ color: "#EF4444" }}>⚠️ {error}</span></EmptyBox>
      ) : filtered.length === 0 ? (
        <EmptyBox>해당 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(it => (
            <SettleItemRow
              key={it.id}
              item={it}
              onClick={onItemClick ? () => onItemClick(it) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── RemitAction (actionMode 분기) ─────────────────────────
function RemitAction({ actionMode, status, submitting, onReport, onUndo, onConfirm }) {
  const isDone     = status.kind === "done";
  const isReported = status.kind === "reported";
  const isExpected = status.kind === "expected";

  if (isDone) {
    const lastConfirm = status.remits.map(r => r.confirmed_at).filter(Boolean).sort().pop();
    const ymd = kstYmd(lastConfirm);
    return (
      <div style={{
        marginBottom: 12, padding: "10px 12px",
        background: "rgba(93,202,165,0.10)",
        border: `1px solid ${C_GREEN}55`,
        borderRadius: 10,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: C_GREEN,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <Check size={14} strokeWidth={3}/>회사 입금 확인 완료
          {ymd && <span style={{ color: C_GRAY, fontWeight: 500, marginLeft: 4 }}>{mdLabel(ymd)}</span>}
        </span>
      </div>
    );
  }

  // ─── admin mode ───
  if (actionMode === "admin") {
    if (isExpected) {
      return (
        <button disabled style={{
          width: "100%", marginBottom: 12, padding: 12,
          background: "#3A3A3A",
          border: "none", borderRadius: 10,
          color: "#888", fontSize: 13, fontWeight: 700,
          cursor: "not-allowed", fontFamily: "inherit",
        }}>
          ⏳ 유솔 보고 대기 중
        </button>
      );
    }
    if (isReported) {
      const lastReport = status.remits.map(r => r.remitted_at).filter(Boolean).sort().pop();
      const ymd = kstYmd(lastReport);
      const reportedAmount = status.remits.reduce((s, r) => s + (Number(r.remitted_amount) || 0), 0);
      return (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            padding: "10px 12px", marginBottom: 8,
            background: "rgba(230,163,58,0.08)",
            border: `1px solid ${C_AMBER}55`,
            borderRadius: 10,
            fontSize: 11,
          }}>
            <div style={{ color: C_AMBER, fontWeight: 700, marginBottom: 2 }}>📣 유솔 보고 — 회사 확인 대기</div>
            <div style={{ color: "var(--text-secondary)" }}>
              보고 금액 <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>₩{reportedAmount.toLocaleString()}</span>
              {ymd && <> · 보고 시각 {mdLabel(ymd)}</>}
            </div>
          </div>
          <button onClick={onConfirm} disabled={submitting} style={{
            width: "100%", padding: 12,
            background: C_GREEN, border: "none", borderRadius: 10,
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? "확인 처리 중..." : `✓ 입금 확인 (₩${reportedAmount.toLocaleString()})`}
          </button>
        </div>
      );
    }
    return null;
  }

  // ─── principal mode ───
  if (isReported) {
    const lastReport = status.remits.map(r => r.remitted_at).filter(Boolean).sort().pop();
    const ymd = kstYmd(lastReport);
    return (
      <div style={{
        marginBottom: 12, padding: "10px 12px",
        background: "rgba(230,163,58,0.08)",
        border: `1px solid ${C_AMBER}55`,
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C_AMBER }}>입금 보고 완료 · 회사 확인 대기</div>
          {ymd && <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>보고 시각 {mdLabel(ymd)}</div>}
        </div>
        <button onClick={onUndo} disabled={submitting} style={{
          background: "transparent", border: `1px solid ${C_AMBER}`, color: C_AMBER,
          padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
          opacity: submitting ? 0.5 : 1, whiteSpace: "nowrap",
        }}>보고 취소</button>
      </div>
    );
  }
  // expected → [입금했습니다]
  return (
    <button onClick={onReport} disabled={submitting} style={{
      width: "100%", marginBottom: 12, padding: 12,
      background: C_MAGENTA, border: "none", borderRadius: 10,
      color: "#fff", fontSize: 13, fontWeight: 700,
      cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
      opacity: submitting ? 0.5 : 1,
    }}>
      {submitting ? "보고 중..." : "💸 입금했습니다"}
    </button>
  );
}

// ── SettleItemRow (KST 변환) ─────────────────────────────
// 2026-06-15 — 행 금액 = 회사 실수령 (= subtotal − 분배 principal_amount).
//   유솔 정산금(subtotal) 은 작은 회색 부제로 유지 (사장님 spec a248fc9 동일).
//   회사 실수령 = item._company_receive (fetchJuneLiveWeeks / fetchWeekItemsByMonday 가 부착).
//   _company_receive 없으면 subtotal 폴백 (W14-W22 시트 데이터 등).
function SettleItemRow({ item, onClick }) {
  const stageKey = getSettleStageKey(item);
  const stage = SETTLE_STAGES.find(s => s.key === stageKey) || SETTLE_STAGES[0];
  const label = getItemLabel(item);
  const qty = item.qty || 1;
  const subtotal = Number(item.subtotal) || 0;
  const hasCompRcv = item._company_receive != null;
  const companyRcv = hasCompRcv ? (Number(item._company_receive) || 0) : subtotal;
  const naverYmd = kstYmd(item.naver_settled_at);
  const naverDate = naverYmd ? naverYmd.slice(5).replace("-", "/") : "";
  const orderId = item.product_order_id || "";

  return (
    <div onClick={onClick || undefined} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderLeft: `3px solid ${stage.color}`,
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: 38,
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flexShrink: 0, fontSize: 14 }}>{stage.dot}</div>
        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 500,
          color: "var(--text-primary, #FAF8F5)",
          maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{item.customer_name || "—"}</span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 11, fontWeight: 400, color: "#888",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          ({label}{qty > 1 ? `×${qty}` : ""})
          {item.district ? ` · ${item.district}` : ""}
          {naverDate && (<>{" · "}<span style={{ color: "#BA7517", fontWeight: 600 }}>{naverDate}</span></>)}
        </span>
        {/* 회사 실수령 — 메인 금액 (굵게) */}
        <span className="mono" style={{
          flexShrink: 0, fontSize: 12, fontWeight: 800,
          color: C_MAGENTA, fontFamily: "ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
        }}>₩{companyRcv.toLocaleString()}</span>
      </div>
      {/* 부제 — 유솔 정산금 (회색, 작은 글자, 우측 정렬) */}
      {hasCompRcv && (
        <div style={{
          display: "flex", justifyContent: "flex-end",
          fontSize: 9, color: "#666", fontWeight: 500, paddingRight: 1,
        }}>
          유솔 정산금 ₩{subtotal.toLocaleString()}
        </div>
      )}
      {orderId && (
        <div className="mono" style={{
          fontSize: 10, color: "#666", paddingLeft: 22, letterSpacing: 0.2,
        }}>{orderId}</div>
      )}
    </div>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 10px",
      background: active ? C_MAGENTA : "var(--bg-secondary, #1A1A1A)",
      color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
      border: `1px solid ${active ? C_MAGENTA : "var(--border, #2A2A2A)"}`,
      borderRadius: 100,
      fontSize: 11, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function EmptyBox({ children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: C_GRAY, fontSize: 12,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
    }}>{children}</div>
  );
}

// ── label 헬퍼 (string-based, KST timezone-safe) ─────────
function koreanWeekLabel(week) {
  if (!week?.monday || !week?.sunday) return "";
  const year  = week.sunday.getFullYear();
  const month = week.sunday.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayDow = firstDay.getDay() || 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - (firstDayDow - 1));
  const diff = Math.round((week.monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${month + 1}월 ${diff + 1}주차`;
}

function dateRangeLabel(week) {
  if (week?.mondayStr && week?.sundayStr) {
    return `${mdLabel(week.mondayStr)}~${mdLabel(week.sundayStr)}`;
  }
  if (week?.monday && week?.sunday) {
    return `${week.monday.getMonth()+1}/${week.monday.getDate()}~${week.sunday.getMonth()+1}/${week.sunday.getDate()}`;
  }
  return "";
}

// ── 측 측 ──────────────────────────────────────────────
const backButtonStyle = {
  background: "var(--bg-secondary, #1A1A1A)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 8, padding: "6px 8px",
  color: "var(--text-primary, #FAF8F5)",
  cursor: "pointer", display: "flex", alignItems: "center", gap: 2,
  fontFamily: "inherit", fontSize: 11, fontWeight: 600,
};

const searchInputStyle = {
  width: "100%", padding: "9px 12px 9px 32px",
  background: "var(--bg-secondary, #1A1A1A)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 10,
  color: "var(--text-primary, #FAF8F5)",
  fontSize: 12, fontWeight: 600,
  fontFamily: "inherit", outline: "none",
};

export default WeekSettleDetail;
