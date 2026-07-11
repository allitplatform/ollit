// AdminApp "접수함" 탭 — 홈페이지 폼(inquiries) 운영 화면.
// 2026-06-24 디자인 개편:
//   · 모바일: C 미니멀 카드 (2행 요약 + 우측 3 아이콘 액션)
//   · PC: 2단 (좌 270px 리스트 + 우 상세/폼 패널, 화면 이동 없이 처리)
//   · 공통 ServiceTypeIcon 재사용 (코드→workType 매핑은 inquiriesDb.SERVICE_WORKTYPE)
//
// 흐름:
//   모바일 [작업 전환] → 부모(AdminApp) onConvertToForm → screen=newReceptionForm prefill 라우팅
//   PC 우 패널에 NewReceptionPcForm 임베드 → 등록 성공 시 markInquiryConverted (best-effort)

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, ArrowRight, MoreVertical, RefreshCw, X, BarChart3, Trash2 } from "lucide-react";
import {
  listInquiries,
  setInquiryStatus,
  markInquiryConverted,
  deleteInquiry,          // 2026-07-10 — 스팸 영구 삭제 (Mig 169)
  SPAM_REASON_PRESETS,    // 2026-07-11 — 스팸 사유 빠른 선택 (Mig 170)
  serviceLabel,
  statusMeta,
  SERVICE_WORKTYPE,
} from "../../lib/inquiriesDb";
import { toKstYmd, toKstYmdHm } from "../../utils/dateLabel.js";
import { useIsPc } from "../../utils/useIsPc.js";
import ServiceTypeIcon from "../ServiceTypeIcon.jsx";
import { NewReceptionPcForm } from "./NewReceptionPcForm.jsx";
// 2026-06-28 — 통계 헤더 (Mig 151 RPC). 카드 4 + 일별 막대 + 현재상태 분포.
import { InquiryStatsHeader } from "./InquiryStatsHeader.jsx";

const FILTERS = [
  { key: "all",       label: "전체" },
  { key: "new",       label: "신규" },
  { key: "contacted", label: "통화함" },
  // 2026-07-10 — 사장님 spec: 스팸 필터 노출. 삭제(영구) 버튼도 이 필터에서 접근.
  //   'all' 은 여전히 스팸 제외. 'spam' 선택 시 status='spam' 만 조회.
  { key: "spam",      label: "스팸" },
];

// timestamptz → "HH:mm" (KST local)
function toKstHm(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 2026-07-10 — shortRegion 폐기. 지역 표시는 "지역별 접수 현황" 화면으로 일원화.
//   호출처 (row 카드 2행) 도 함께 제거됨. 함수 body 는 옛 호출 대비 no-op 유지.
function shortRegion() { return ""; }

// ===========================================================
// 루트 — useIsPc 분기로 모바일/PC 위임
// ===========================================================
export default function AdminInquiriesScreen({
  t,
  user,
  apiTasks = [],           // 2026-07-10 — InquiryStatsHeader 성사/완료 판별용
  onBack,
  onConvertToForm,         // 모바일 — 부모(AdminApp) 가 새 접수 폼 prefill 라우팅
  onAfterEmbedConvert,     // PC — 임베드 폼 등록 후 부모 알림 (optional)
}) {
  const isPc = useIsPc();
  const [items, setItems]     = useState([]);
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [busyId, setBusyId]   = useState(null);
  const [selectedId, setSelectedId] = useState(null);   // PC 모드 선택

  const actorId = user?.user_id;

  async function load() {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      const status = filter === "all" ? null : filter;
      const rows = await listInquiries(actorId, status);
      // 스팸 + 전환됨은 어떤 칩에서도 안 보임 — 'all' 일 때 클라 측에서 제외.
      //   2026-06-28 — Mig 152 로 mark_inquiry_converted 가 DELETE 에서 UPDATE 로 변경.
      //   전환된 행이 inquiries 에 보존되어 통계(전환율/퍼널) 가능. 단 접수함 화면엔 안 보이게.
      const visible = filter === "all"
        ? rows.filter((r) => r.status !== "spam" && r.status !== "converted")
        : rows;
      setItems(visible);
      // 선택된 행이 사라졌으면(전환·스팸·필터 변경) 선택 해제
      if (selectedId && !visible.find((x) => x.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (e) {
      setError(e?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter, actorId]);

  async function act(id, newStatus) {
    if (busyId) return;
    setBusyId(id);
    try {
      await setInquiryStatus(actorId, id, newStatus);
      await load();
    } catch (e) {
      alert("처리 실패: " + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  // 2026-07-11 — 스팸 사유 모달 상태 (Mig 170).
  //   markSpamOpen: 대상 row (id/이름 표시용) or null.
  //   onSubmit(reason) → setInquiryStatus + reload.
  const [markSpamOpen, setMarkSpamOpen] = useState(null); // row | null
  function requestSpam(rowOrId) {
    if (busyId) return;
    const row = typeof rowOrId === "string"
      ? items.find(x => x.id === rowOrId)
      : rowOrId;
    if (!row) return;
    setMarkSpamOpen(row);
  }
  async function confirmSpam(reason) {
    const row = markSpamOpen;
    if (!row) return;
    setMarkSpamOpen(null);
    setBusyId(row.id);
    try {
      await setInquiryStatus(actorId, row.id, "spam", reason || null);
      await load();
    } catch (e) {
      alert("스팸 처리 실패: " + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  // 2026-07-10 — 스팸 문의 영구 삭제 (Mig 169 RPC).
  //   확인 1회 (사장님 spec). converted 실데이터는 서버가 거부 (task_id IS NOT NULL).
  async function removeSpam(row) {
    if (busyId) return;
    if (!row || row.status !== "spam") {
      alert("스팸 상태만 영구 삭제 가능합니다.");
      return;
    }
    if (row.task_id) {
      alert("전환된 실데이터 (task_id 존재) — 삭제 불가.");
      return;
    }
    const nameHint = row.name || row.phone || "이 문의";
    const ok = window.confirm(`정말 삭제할까요?\n\n${nameHint}\n\n※ 이 작업은 되돌릴 수 없습니다.`);
    if (!ok) return;
    setBusyId(row.id);
    try {
      const res = await deleteInquiry(actorId, row.id);
      if (!res.ok) {
        alert("삭제 실패: " + (res.error || "unknown"));
        return;
      }
      // 선택 상태 해제 (PC 우 패널).
      if (selectedId === row.id) setSelectedId(null);
      await load();
    } catch (e) {
      alert("삭제 실패: " + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  // 모바일 [작업 전환] — 부모 prefill 라우팅에 위임
  function convertMobile(row) {
    if (busyId) return;
    if (!onConvertToForm) return;
    const ok = window.confirm("새 접수 폼이 열립니다.\n기종·수량·일정·금액을 보강하여 등록해 주세요.");
    if (!ok) return;
    onConvertToForm(row);
  }

  // PC 우 패널 — 임베드 폼 등록 성공 시 (form.taskId 보유)
  async function onPcSubmitDone(form, selectedRow) {
    if (form?._v14ApiOk && form?.taskId && selectedRow?.id) {
      markInquiryConverted(actorId, selectedRow.id, form.taskId)
        .catch((e) => console.warn("[inquiries] mark_inquiry_converted 실패 — 작업은 살림", e));
    }
    setSelectedId(null);
    await load();
    if (onAfterEmbedConvert) onAfterEmbedConvert();
  }

  const newCount = useMemo(
    () => items.filter((x) => x.status === "new").length,
    [items]
  );

  const selectedRow = selectedId ? items.find((x) => x.id === selectedId) : null;

  // 2026-07-11 — 스팸 사유 모달 (Mig 170). PC/모바일 공용.
  const spamModal = markSpamOpen ? (
    <SpamReasonModal
      row={markSpamOpen}
      onClose={() => setMarkSpamOpen(null)}
      onConfirm={confirmSpam}
    />
  ) : null;

  if (isPc) {
    return (
      <>
        <AdminInquiriesPc
          t={t}
          user={user}
          actorId={actorId}
          apiTasks={apiTasks}
          items={items}
          filter={filter}
          setFilter={setFilter}
          loading={loading}
          error={error}
          busyId={busyId}
          newCount={newCount}
          selectedRow={selectedRow}
          onSelect={setSelectedId}
          onBack={onBack}
          onCall={(id) => act(id, "contacted")}
          onSpam={(id) => requestSpam(id)}
          onDelete={removeSpam}
          onReload={load}
          onPcSubmitDone={onPcSubmitDone}
        />
        {spamModal}
      </>
    );
  }

  return (
    <>
      <AdminInquiriesMobile
        actorId={actorId}
        apiTasks={apiTasks}
        items={items}
        filter={filter}
        setFilter={setFilter}
        loading={loading}
        error={error}
        busyId={busyId}
        newCount={newCount}
        onBack={onBack}
        onCall={(id) => act(id, "contacted")}
        onSpam={(id) => requestSpam(id)}
        onDelete={removeSpam}
        onConvert={convertMobile}
        onReload={load}
      />
      {spamModal}
    </>
  );
}

// ===========================================================
// 모바일 — C 미니멀 카드
// ===========================================================
function AdminInquiriesMobile({
  actorId, apiTasks = [], items, filter, setFilter, loading, error, busyId, newCount,
  onBack, onCall, onSpam, onDelete, onConvert, onReload,
}) {
  // 2026-06-28 — 모바일은 통계를 별도 화면으로 분리 (좁은 폭에서 목록 밀림 차단).
  //   헤더 우측 📊 아이콘 → showStats=true → 통계 전용 화면. 뒤로 → 접수함 복귀.
  const [showStats, setShowStats] = useState(false);

  if (showStats) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4F6FA", paddingBottom: 40 }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 5,
          background: "#fff", borderBottom: "1px solid #E5EAF1",
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <button onClick={() => setShowStats(false)} aria-label="뒤로" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 22, color: "#1C2B3A", padding: 4,
          }}>←</button>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.3px" }}>
            📊 접수함 통계
          </h1>
        </div>
        <div style={{ padding: "14px" }}>
          <InquiryStatsHeader t={inqStatsT} actorId={actorId} apiTasks={apiTasks}/>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "#fff", borderBottom: "1px solid #E5EAF1",
        padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
      }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 22, color: "#1C2B3A", padding: 4,
          }}>←</button>
        )}
        <h1 style={{ fontSize: 17, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.3px" }}>
          접수함
          {newCount > 0 && (
            <span style={{
              marginLeft: 7,
              background: "#DC2626", color: "#fff",
              fontSize: 11, fontWeight: 800,
              padding: "2px 7px", borderRadius: 100,
              verticalAlign: "middle",
            }}>신규 {newCount}</span>
          )}
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {/* 2026-06-28 — 통계 화면 진입 */}
          <button onClick={() => setShowStats(true)} aria-label="통계" title="통계" style={{
            background: "#F4F6FA", color: "#4A5A70",
            border: "none", borderRadius: 8,
            padding: "8px 10px", cursor: "pointer",
            display: "inline-flex", alignItems: "center",
          }}>
            <BarChart3 size={14}/>
          </button>
          <button onClick={onReload} disabled={loading} aria-label="새로고침" style={{
            background: "#EAF2FB", color: "#2563EB",
            border: "none", borderRadius: 8,
            padding: "8px 10px", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "inline-flex", alignItems: "center",
          }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 필터 칩 */}
      <FilterChips filter={filter} setFilter={setFilter} compact />

      {/* 본문 — 2026-06-28: 통계는 별도 화면으로 분리 (📊 아이콘 진입) */}
      <div style={{ padding: "0 14px" }}>
        {error && <ErrorBox text={error} />}
        {!loading && items.length === 0 && !error && <EmptyBox />}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((row) => (
            <MiniCardRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onCall={() => onCall(row.id)}
              onSpam={() => onSpam(row.id)}
              onDelete={() => onDelete && onDelete(row)}
              onConvert={() => onConvert(row)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// 2026-06-28 — InquiryStatsHeader 용 테마 (모바일 화면 #F4F6FA 배경에 맞춘 색).
const inqStatsT = {
  bg:             "#FFFFFF",
  bgElevated:     "#FFFFFF",
  bgInset:        "#F4F6FA",
  bgSecondary:    "#F4F6FA",
  text:           "#1C2B3A",
  textSecondary:  "#4A5A70",
  textMuted:      "#7A8499",
  border:         "#E5EAF1",
  accent:         "#FF1B8D",
};

function MiniCardRow({ row, busy, onCall, onSpam, onDelete, onConvert }) {
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";
  const phoneClick = row.phone ? `tel:${row.phone}` : null;
  const canDelete = isSpam && !row.task_id; // 2026-07-10 — 스팸 + 미전환만 삭제 가능

  return (
    <article style={{
      background: "#fff",
      borderRadius: 10,
      border: "1px solid #E5EAF1",
      borderLeft: isNew ? "3px solid #DC2626" : "1px solid #E5EAF1",
      padding: "11px 12px 11px 13px",
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "center",
    }}>
      <div style={{ minWidth: 0 }}>
        {/* 1행 — 아이콘 + 종목 라벨 + 이름 + 상태점.
              2026-07-11 — 사장님 spec: 종목 라벨 (한글) 병기. 아이콘 유지. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
          <ServiceTypeIcon
            workType={SERVICE_WORKTYPE[row.service_type] || ""}
            size={15}
            showLabel={false}
          />
          <span style={{
            fontSize: 11.5, fontWeight: 800, color: "#2563EB",
            background: "#EAF2FB", padding: "2px 8px", borderRadius: 999,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{serviceLabel(row.service_type)}</span>
          <span style={{
            fontSize: 15, fontWeight: 800, color: "#1C2B3A",
            letterSpacing: "-0.3px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            minWidth: 0,
          }}>{row.name || "이름 미입력"}</span>
          {isNew && (
            <span aria-label="신규" style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#DC2626", flexShrink: 0,
            }} />
          )}
          {row.status === "contacted" && (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: "-0.2px" }}>
              통화함
            </span>
          )}
        </div>
        {/* 2행 — 연락처 · 지역 (서비스 구분은 좌측 ServiceTypeIcon — 텍스트 중복 X) */}
        <div style={{
          fontSize: 12.5, color: "#6A7D94",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {phoneClick ? (
            <a href={phoneClick} style={{ color: "#6A7D94", textDecoration: "none" }}>{row.phone}</a>
          ) : (
            <span>연락처 없음</span>
          )}
          {/* 2026-07-10 — 지역 표시 제거 (지역별 접수 현황 화면으로 일원화, 사장님 spec) */}
        </div>
        {/* 2026-07-11 — 스팸 사유 표시 (Mig 170). 없으면 "사유 없음". */}
        {isSpam && (
          <div style={{
            marginTop: 4, fontSize: 11.5, color: "#93A2B4", fontWeight: 700,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            사유: <span style={{
              color: row.spam_reason ? "#6B7280" : "#B7C1CE",
              fontWeight: row.spam_reason ? 800 : 600,
            }}>{row.spam_reason || "사유 없음"}</span>
          </div>
        )}
      </div>

      {/* 우측 — 액션. 스팸이면 삭제(영구) 버튼 노출. 아니면 통화/전환/스팸. */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        {isSpam ? (
          <IconBtn
            label="삭제 (영구)"
            variant="danger"
            disabled={busy || !canDelete}
            onClick={onDelete}
          >
            <Trash2 size={16}/>
          </IconBtn>
        ) : (
          <>
            <IconBtn label="통화" disabled={busy} onClick={() => {
              if (row.phone) window.location.href = `tel:${row.phone}`;
              onCall && onCall();
            }}>
              <Phone size={16} />
            </IconBtn>
            <IconBtn label="작업 전환" variant="primary" disabled={busy} onClick={onConvert}>
              <ArrowRight size={16} />
            </IconBtn>
            <RowKebab disabled={busy} onSpam={onSpam} />
          </>
        )}
      </div>
    </article>
  );
}

// ===========================================================
// PC — 2단 (좌 270 리스트 + 우 상세/폼)
// ===========================================================
function AdminInquiriesPc({
  t, user, actorId, apiTasks = [], items, filter, setFilter, loading, error, busyId, newCount,
  selectedRow, onSelect, onBack,
  onCall, onSpam, onDelete, onReload, onPcSubmitDone,
}) {
  return (
    <div style={{ display: "flex", height: "calc(100vh)", background: "#F4F6FA" }}>
      {/* === 좌 리스트 270px === */}
      <aside style={{
        width: 270, flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid #E5EAF1",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #E5EAF1",
                       display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && (
            <button onClick={onBack} aria-label="뒤로" style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 18, color: "#1C2B3A", padding: 2,
            }}>←</button>
          )}
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.3px" }}>
            접수함
            {newCount > 0 && (
              <span style={{
                marginLeft: 7, background: "#DC2626", color: "#fff",
                fontSize: 11, fontWeight: 800,
                padding: "2px 7px", borderRadius: 100,
              }}>신규 {newCount}</span>
            )}
          </h2>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={onReload} disabled={loading} aria-label="새로고침" style={{
              background: "#EAF2FB", color: "#2563EB",
              border: "none", borderRadius: 7,
              padding: "6px 8px", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              display: "inline-flex", alignItems: "center",
            }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <FilterChips filter={filter} setFilter={setFilter} compact pcMode />

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 16px" }}>
          {error && <ErrorBox text={error} />}
          {!loading && items.length === 0 && !error && <EmptyBox compact />}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((row) => (
              <PcListRow
                key={row.id}
                row={row}
                selected={selectedRow?.id === row.id}
                onClick={() => onSelect(row.id)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* === 우 패널 === */}
      <main style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        {/* 2026-06-28 — 통계 헤더 (Mig 151 RPC) — 항상 노출, 선택 무관 */}
        <InquiryStatsHeader t={inqStatsT} actorId={actorId} apiTasks={apiTasks}/>

        {selectedRow ? (
          <PcDetailPanel
            t={t}
            user={user}
            row={selectedRow}
            busy={busyId === selectedRow.id}
            onCall={() => onCall(selectedRow.id)}
            onSpam={() => onSpam(selectedRow.id)}
            onDelete={() => onDelete && onDelete(selectedRow)}
            onClose={() => onSelect(null)}
            onSubmitDone={(form) => onPcSubmitDone(form, selectedRow)}
          />
        ) : (
          <div style={{
            marginTop: 40, textAlign: "center", color: "#93A2B4",
            fontSize: 14, fontWeight: 600,
          }}>
            좌측에서 접수를 선택하세요.
          </div>
        )}
      </main>
    </div>
  );
}

function PcListRow({ row, selected, onClick }) {
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%",
      background: selected ? "#EAF2FB" : "#fff",
      border: selected ? "2px solid #2563EB" : "1px solid #E5EAF1",
      borderLeft: isNew && !selected ? "3px solid #DC2626" : (selected ? "2px solid #2563EB" : "1px solid #E5EAF1"),
      borderRadius: 8,
      padding: "10px 11px",
      cursor: "pointer", textAlign: "left",
      fontFamily: "inherit",
      minWidth: 0,
    }}>
      {/* 1행 — 아이콘 + 종목 라벨 pill + 이름 + 상태점.
            2026-07-11 — 사장님 spec: 종목 한글 라벨 병기. */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
        <ServiceTypeIcon
          workType={SERVICE_WORKTYPE[row.service_type] || ""}
          size={14}
          showLabel={false}
        />
        <span style={{
          fontSize: 10.5, fontWeight: 800, color: "#2563EB",
          background: "#EAF2FB", padding: "1px 7px", borderRadius: 999,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>{serviceLabel(row.service_type)}</span>
        <span style={{
          fontSize: 14, fontWeight: 800, color: "#1C2B3A",
          letterSpacing: "-0.3px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          flex: 1, minWidth: 0,
        }}>{row.name || "이름 미입력"}</span>
        {isNew && (
          <span aria-label="신규" style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#DC2626", flexShrink: 0,
          }} />
        )}
        {row.status === "contacted" && (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#2563EB" }}>통화함</span>
        )}
      </div>
      <div style={{
        fontSize: 12, color: "#6A7D94",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {row.phone || "연락처 없음"}
        {/* 2026-07-10 — 지역 표시 제거 (지역별 접수 현황 화면으로 일원화, 사장님 spec) */}
      </div>
      {/* 2026-07-11 — 스팸 사유 (Mig 170). */}
      {isSpam && (
        <div style={{
          marginTop: 3, fontSize: 11, color: "#93A2B4", fontWeight: 700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          사유: <span style={{
            color: row.spam_reason ? "#6B7280" : "#B7C1CE",
            fontWeight: row.spam_reason ? 800 : 600,
          }}>{row.spam_reason || "사유 없음"}</span>
        </div>
      )}
    </button>
  );
}

function PcDetailPanel({ t, user, row, busy, onCall, onSpam, onDelete, onClose, onSubmitDone }) {
  const at = toKstYmdHm(row.created_at);
  const initial = {
    principal: "올데이케어",   // PRINCIPALS[0].id 정확 일치
    customer:  row.name    || "",
    phone:     row.phone   || "",
    address:   row.address || "",
    workItems: [],
    memo: `[홈페이지 접수${at ? " " + at : ""}] 희망 서비스: ${serviceLabel(row.service_type)}`,
  };
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";

  return (
    <div>
      {/* 상단 요약 */}
      <div style={{
        background: "#fff", border: "1px solid #E5EAF1",
        borderRadius: 12, padding: "16px 18px", marginBottom: 14,
      }}>
        {/* 상단 1행 — 아이콘 + 종목 pill + 이름 + 신규 + 접수시각.
              2026-07-11 — 사장님 spec: 종목 한글 라벨 명확 표시 (SERVICE_LABEL). */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <ServiceTypeIcon
            workType={SERVICE_WORKTYPE[row.service_type] || ""}
            size={18}
            showLabel={false}
          />
          <span style={{
            fontSize: 12.5, fontWeight: 800, color: "#2563EB",
            background: "#EAF2FB", padding: "3px 10px", borderRadius: 999,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{serviceLabel(row.service_type)}</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#1C2B3A", letterSpacing: "-0.5px" }}>
            {row.name || "이름 미입력"}
          </span>
          {isNew && (
            <span style={{
              background: "#DC2626", color: "#fff",
              fontSize: 11, fontWeight: 800,
              padding: "3px 9px", borderRadius: 100,
            }}>신규</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6A7D94", fontWeight: 600 }}>
            접수 {toKstYmd(row.created_at)} {toKstHm(row.created_at)}
          </span>
          <button onClick={onClose} aria-label="닫기" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#93A2B4", padding: 2, display: "inline-flex",
          }}>
            <X size={16} />
          </button>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px",
          fontSize: 14, color: "#1C2B3A",
        }}>
          <span style={{ color: "#93A2B4", fontWeight: 600 }}>연락처</span>
          <span style={{ fontWeight: 700 }}>
            {row.phone
              ? <a href={`tel:${row.phone}`} style={{ color: "#2563EB", textDecoration: "none" }}>{row.phone}</a>
              : "-"}
          </span>
          <span style={{ color: "#93A2B4", fontWeight: 600 }}>주소</span>
          <span>{row.address || "-"}</span>
          {row.memo && (<>
            <span style={{ color: "#93A2B4", fontWeight: 600 }}>메모</span>
            <span style={{ color: "#4A5A70", whiteSpace: "pre-line" }}>{row.memo}</span>
          </>)}
        </div>

        {/* 2026-07-11 — 스팸 사유 표시 (Mig 170). */}
        {isSpam && (
          <div style={{
            marginTop: 12, padding: "9px 12px",
            background: "#F4F6FA", border: "1px solid #E5EAF1",
            borderRadius: 8, fontSize: 13, color: "#4A5A70",
          }}>
            <span style={{ color: "#93A2B4", fontWeight: 700, marginRight: 6 }}>사유</span>
            <span style={{
              fontWeight: row.spam_reason ? 800 : 600,
              color: row.spam_reason ? "#1C2B3A" : "#B7C1CE",
            }}>{row.spam_reason || "사유 없음"}</span>
          </div>
        )}

        {/* 액션 — 스팸이면 삭제(영구), 아니면 통화함/스팸 처리. */}
        {isSpam ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <SmallBtn
              label="삭제 (영구)"
              color="#DC2626"
              disabled={busy || !!row.task_id}
              onClick={onDelete}
            />
            {row.task_id && (
              <span style={{ fontSize: 11, color: "#93A2B4", fontWeight: 600 }}>
                전환된 실데이터는 삭제 불가
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <SmallBtn label="통화함으로 처리" color="#2563EB"
              disabled={busy || row.status === "contacted"} onClick={onCall}/>
            <SmallBtn label="스팸 처리" color="#6B7280" disabled={busy} onClick={onSpam}/>
          </div>
        )}
      </div>

      {/* 하단 — 새 접수 폼 임베드 (prefill) */}
      <div style={{
        background: "#fff", border: "1px solid #E5EAF1", borderRadius: 12,
        padding: 0, overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 18px", borderBottom: "1px solid #E5EAF1",
          fontSize: 13, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.2px",
          background: "#F8FBFF",
        }}>
          작업 전환 — 기종·수량·일정·금액 보강 후 등록
        </div>
        <div>
          <NewReceptionPcForm
            t={t}
            user={user}
            initial={initial}
            onBack={onClose}
            onSubmit={onSubmitDone}
          />
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// 공통 UI 부품
// ===========================================================
function FilterChips({ filter, setFilter, compact, pcMode }) {
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap",
      padding: pcMode ? "10px 12px" : (compact ? "10px 14px" : "14px 18px"),
      borderBottom: pcMode ? "1px solid #E5EAF1" : "none",
    }}>
      {FILTERS.map((f) => {
        const on = filter === f.key;
        return (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            border: on ? "1.5px solid #2563EB" : "1.5px solid #D6DEE8",
            background: on ? "#2563EB" : "#fff",
            color: on ? "#fff" : "#4A5A70",
            fontSize: 12.5, fontWeight: 700,
            padding: "6px 12px", borderRadius: 100,
            cursor: "pointer", letterSpacing: "-0.2px",
          }}>{f.label}</button>
        );
      })}
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{
      background: "#FDECEC", border: "1px solid #F4C7C7",
      color: "#B22222", borderRadius: 10, padding: "12px 14px",
      fontSize: 13, fontWeight: 700, marginBottom: 12,
    }}>{text}</div>
  );
}

function EmptyBox({ compact }) {
  return (
    <div style={{
      background: "#fff", border: "1px dashed #D6DEE8",
      borderRadius: 12, padding: compact ? "20px 12px" : "40px 16px",
      textAlign: "center", color: "#6A7D94", fontSize: compact ? 13 : 14,
    }}>접수 내역이 없습니다.</div>
  );
}

function IconBtn({ children, label, onClick, disabled, variant }) {
  const primary = variant === "primary";
  const danger  = variant === "danger";  // 2026-07-10 — 삭제(영구) 스팸 액션
  const bg  = disabled ? "#E5EAF1"
            : danger   ? "#DC2626"
            : primary  ? "#2563EB"
            : "#F4F8FD";
  const fg  = disabled ? "#9CA8B6"
            : danger   ? "#fff"
            : primary  ? "#fff"
            : "#2563EB";
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} style={{
      width: 36, height: 36, borderRadius: 8,
      background: bg,
      color: fg,
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>{children}</button>
  );
}

function SmallBtn({ label, color, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#E5EAF1" : color,
      color: disabled ? "#9CA8B6" : "#fff",
      border: "none", borderRadius: 7,
      padding: "8px 14px",
      fontSize: 13, fontWeight: 800,
      letterSpacing: "-0.2px",
      cursor: disabled ? "not-allowed" : "pointer",
    }}>{label}</button>
  );
}

function RowKebab({ disabled, onSpam }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled} aria-label="더보기" style={{
        width: 36, height: 36, borderRadius: 8,
        background: "transparent", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: "#93A2B4",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", right: 0, top: "100%",
          marginTop: 4, background: "#fff",
          border: "1px solid #E5EAF1", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(28,43,58,0.10)",
          minWidth: 120, zIndex: 10,
          overflow: "hidden",
        }}>
          <button role="menuitem" onClick={() => { setOpen(false); onSpam && onSpam(); }}
            style={{
              display: "block", width: "100%",
              padding: "10px 14px",
              background: "transparent", border: "none",
              cursor: "pointer", textAlign: "left",
              fontSize: 13, fontWeight: 700, color: "#6B7280",
              letterSpacing: "-0.2px",
            }}>스팸 처리</button>
        </div>
      )}
    </div>
  );
}

// ===========================================================
// 2026-07-11 — 스팸 사유 입력 모달 (Mig 170).
//   자유 텍스트 + 빠른 선택 5개 (SPAM_REASON_PRESETS).
//   [스팸 처리] 클릭 → onConfirm(reason). 사유 없이도 가능 ("사유 없음" 저장).
// ===========================================================
function SpamReasonModal({ row, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const nameHint = row?.name || row?.phone || "이 문의";

  function pick(preset) {
    setReason(preset);
  }
  function submit() {
    onConfirm(reason.trim() || null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}>
      <div style={{
        background: "#fff", borderRadius: 14,
        width: "100%", maxWidth: 440,
        padding: "18px 20px 16px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#1C2B3A", letterSpacing: "-0.4px" }}>
            스팸으로 처리
          </div>
          <button onClick={onClose} aria-label="닫기" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#93A2B4", padding: 2, display: "inline-flex",
          }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#6A7D94", fontWeight: 700 }}>
          대상: <span style={{ color: "#1C2B3A", fontWeight: 800 }}>{nameHint}</span>
        </div>

        {/* 빠른 선택 */}
        <div>
          <div style={{
            fontSize: 11, color: "#93A2B4", fontWeight: 800,
            marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase",
          }}>빠른 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SPAM_REASON_PRESETS.map(preset => {
              const on = reason === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => pick(preset)}
                  style={{
                    padding: "6px 12px",
                    background: on ? "#DC2626" : "#F4F6FA",
                    border: `1px solid ${on ? "#DC2626" : "#E5EAF1"}`,
                    borderRadius: 999,
                    color: on ? "#fff" : "#4A5A70",
                    fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{preset}</button>
              );
            })}
          </div>
        </div>

        {/* 자유 텍스트 */}
        <div>
          <div style={{
            fontSize: 11, color: "#93A2B4", fontWeight: 800,
            marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase",
          }}>사유 (선택)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="직접 입력하거나 빠른 선택 클릭"
            rows={2}
            maxLength={200}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 11px",
              background: "#fff",
              border: "1px solid #E5EAF1",
              borderRadius: 8,
              color: "#1C2B3A",
              fontSize: 13, fontFamily: "inherit",
              resize: "vertical", minHeight: 48,
              outline: "none",
            }}
          />
          <div style={{
            fontSize: 10, color: "#93A2B4", fontWeight: 600,
            marginTop: 3, textAlign: "right",
          }}>{reason.length}/200</div>
        </div>

        {/* 액션 */}
        <div style={{
          display: "flex", gap: 8, justifyContent: "flex-end",
          paddingTop: 4,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 16px",
            background: "#F4F6FA", border: "1px solid #E5EAF1",
            borderRadius: 8, color: "#4A5A70",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>취소</button>
          <button onClick={submit} style={{
            padding: "9px 18px",
            background: "#DC2626", border: "none",
            borderRadius: 8, color: "#fff",
            fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "-0.2px",
          }}>스팸 처리</button>
        </div>
      </div>
    </div>
  );
}
