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
import { Phone, ArrowRight, MoreVertical, RefreshCw, X } from "lucide-react";
import {
  listInquiries,
  setInquiryStatus,
  markInquiryConverted,
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
];

// timestamptz → "HH:mm" (KST local)
function toKstHm(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 주소 → 짧은 지역 라벨 ("서울 강남구 ..." → "강남구")
function shortRegion(address) {
  if (!address) return "";
  const tokens = String(address).trim().split(/\s+/);
  const gu = tokens.find((t) => /^[가-힣]+구$/.test(t));
  if (gu) return gu;
  const siGun = tokens.find(
    (t) => /^[가-힣]+(시|군)$/.test(t) && !/(특별시|광역시|특별자치시|특별자치도)$/.test(t)
  );
  return siGun || tokens[0] || "";
}

// ===========================================================
// 루트 — useIsPc 분기로 모바일/PC 위임
// ===========================================================
export default function AdminInquiriesScreen({
  t,
  user,
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

  if (isPc) {
    return (
      <AdminInquiriesPc
        t={t}
        user={user}
        actorId={actorId}
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
        onSpam={(id) => act(id, "spam")}
        onReload={load}
        onPcSubmitDone={onPcSubmitDone}
      />
    );
  }

  return (
    <AdminInquiriesMobile
      actorId={actorId}
      items={items}
      filter={filter}
      setFilter={setFilter}
      loading={loading}
      error={error}
      busyId={busyId}
      newCount={newCount}
      onBack={onBack}
      onCall={(id) => act(id, "contacted")}
      onSpam={(id) => act(id, "spam")}
      onConvert={convertMobile}
      onReload={load}
    />
  );
}

// ===========================================================
// 모바일 — C 미니멀 카드
// ===========================================================
function AdminInquiriesMobile({
  actorId, items, filter, setFilter, loading, error, busyId, newCount,
  onBack, onCall, onSpam, onConvert, onReload,
}) {
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
        <div style={{ marginLeft: "auto" }}>
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

      {/* 2026-06-28 — 통계 헤더 (Mig 151 RPC) */}
      <div style={{ padding: "0 14px" }}>
        <InquiryStatsHeader t={inqStatsT} actorId={actorId}/>
      </div>

      {/* 본문 */}
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

function MiniCardRow({ row, busy, onCall, onSpam, onConvert }) {
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";
  const phoneClick = row.phone ? `tel:${row.phone}` : null;

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
        {/* 1행 — 아이콘 + 이름 + 상태점 */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <ServiceTypeIcon
            workType={SERVICE_WORKTYPE[row.service_type] || ""}
            size={15}
            showLabel={false}
          />
          <span style={{
            fontSize: 15, fontWeight: 800, color: "#1C2B3A",
            letterSpacing: "-0.3px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
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
          {row.address && <> · {shortRegion(row.address)}</>}
        </div>
      </div>

      {/* 우측 — 3 아이콘 액션 (스팸은 ⋯ 메뉴 안) */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        <IconBtn label="통화" disabled={busy || isSpam} onClick={() => {
          if (row.phone) window.location.href = `tel:${row.phone}`;
          onCall && onCall();
        }}>
          <Phone size={16} />
        </IconBtn>
        <IconBtn label="작업 전환" variant="primary" disabled={busy || isSpam} onClick={onConvert}>
          <ArrowRight size={16} />
        </IconBtn>
        <RowKebab disabled={busy || isSpam} onSpam={onSpam} />
      </div>
    </article>
  );
}

// ===========================================================
// PC — 2단 (좌 270 리스트 + 우 상세/폼)
// ===========================================================
function AdminInquiriesPc({
  t, user, actorId, items, filter, setFilter, loading, error, busyId, newCount,
  selectedRow, onSelect, onBack,
  onCall, onSpam, onReload, onPcSubmitDone,
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
        <InquiryStatsHeader t={inqStatsT} actorId={actorId}/>

        {selectedRow ? (
          <PcDetailPanel
            t={t}
            user={user}
            row={selectedRow}
            busy={busyId === selectedRow.id}
            onCall={() => onCall(selectedRow.id)}
            onSpam={() => onSpam(selectedRow.id)}
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
  const isNew = row.status === "new";
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <ServiceTypeIcon
          workType={SERVICE_WORKTYPE[row.service_type] || ""}
          size={14}
          showLabel={false}
        />
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
        {row.address && <> · {shortRegion(row.address)}</>}
      </div>
    </button>
  );
}

function PcDetailPanel({ t, user, row, busy, onCall, onSpam, onClose, onSubmitDone }) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <ServiceTypeIcon
            workType={SERVICE_WORKTYPE[row.service_type] || ""}
            size={18}
            showLabel={true}
          />
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

        {/* 액션 — PC 는 공간 여유라 통화함/스팸 직접 노출 */}
        {!isSpam && (
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
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} style={{
      width: 36, height: 36, borderRadius: 8,
      background: disabled ? "#E5EAF1" : (primary ? "#2563EB" : "#F4F8FD"),
      color: disabled ? "#9CA8B6" : (primary ? "#fff" : "#2563EB"),
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
