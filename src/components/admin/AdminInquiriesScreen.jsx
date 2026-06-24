// AdminApp "접수함" 탭 — 홈페이지 폼(inquiries) 운영 화면.
//   · 필터 칩 (전체 / 신규 / 통화함 / 스팸)
//   · 목록 (status별 색 stripe, 시각·서비스·이름·연락처·주소·memo)
//   · 액션: [통화] → contacted, [스팸] → spam, [작업 전환] 이번엔 비활성("준비중")
//
// 읽기/액션 로직은 src/lib/inquiriesDb.js 측에 분리 (HappycallApp 재사용 대비).
// 시각 timestamptz UTC → toKstYmd() 필수.

import { useEffect, useMemo, useState } from "react";
import {
  listInquiries,
  setInquiryStatus,
  serviceLabel,
  statusMeta,
} from "../../lib/inquiriesDb";
import { toKstYmd } from "../../utils/dateLabel";

const FILTERS = [
  { key: "all",       label: "전체" },
  { key: "new",       label: "신규" },
  { key: "contacted", label: "통화함" },
  { key: "spam",      label: "스팸" },
];

// timestamptz → "HH:mm" (KST local — Date 객체가 브라우저 로컬 변환)
function toKstHm(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminInquiriesScreen({ user, onBack }) {
  const [items, setItems]         = useState([]);
  const [filter, setFilter]       = useState("all");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [busyId, setBusyId]       = useState(null);   // 액션 처리 중 row id

  const actorId = user?.user_id;

  async function load() {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      const status = filter === "all" ? null : filter;
      const rows = await listInquiries(actorId, status);
      setItems(rows);
    } catch (e) {
      setError(e?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, actorId]);

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

  const newCount = useMemo(
    () => (filter === "all"
      ? items.filter((x) => x.status === "new").length
      : (filter === "new" ? items.length : null)),
    [items, filter]
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "#fff", borderBottom: "1px solid #E5EAF1",
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 22, color: "#1C2B3A", padding: 4,
          }}>←</button>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.3px" }}>
          접수함
          {newCount != null && newCount > 0 && (
            <span style={{
              marginLeft: 8,
              background: "#DC2626", color: "#fff",
              fontSize: 12, fontWeight: 800,
              padding: "2px 8px", borderRadius: 100,
              verticalAlign: "middle",
            }}>신규 {newCount}</span>
          )}
        </h1>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={load} disabled={loading} style={{
            background: "#EAF2FB", color: "#2563EB",
            border: "none", borderRadius: 8,
            padding: "8px 14px", fontWeight: 700, fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      {/* 필터 칩 */}
      <div style={{ display: "flex", gap: 8, padding: "14px 18px", flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              border: on ? "1.5px solid #2563EB" : "1.5px solid #D6DEE8",
              background: on ? "#2563EB" : "#fff",
              color: on ? "#fff" : "#4A5A70",
              fontSize: 13, fontWeight: 700,
              padding: "8px 14px", borderRadius: 100,
              cursor: "pointer", letterSpacing: "-0.2px",
            }}>{f.label}</button>
          );
        })}
      </div>

      {/* 본문 */}
      <div style={{ padding: "0 18px" }}>
        {error && (
          <div style={{
            background: "#FDECEC", border: "1px solid #F4C7C7",
            color: "#B22222", borderRadius: 10, padding: "12px 14px",
            fontSize: 13, fontWeight: 700, marginBottom: 12,
          }}>{error}</div>
        )}

        {!loading && items.length === 0 && !error && (
          <div style={{
            background: "#fff", border: "1px dashed #D6DEE8",
            borderRadius: 12, padding: "40px 16px",
            textAlign: "center", color: "#6A7D94", fontSize: 14,
          }}>
            접수 내역이 없습니다.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((row) => (
            <InquiryRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onCall={() => act(row.id, "contacted")}
              onSpam={() => act(row.id, "spam")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InquiryRow({ row, busy, onCall, onSpam }) {
  const meta = statusMeta(row.status);
  const isConverted = row.status === "converted";

  return (
    <article style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #E5EAF1",
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: "6px 1fr",
    }}>
      <div style={{ background: meta.color }} />

      <div style={{ padding: "14px 16px" }}>
        {/* 상단 — 상태 배지 + 접수시각 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          marginBottom: 10,
        }}>
          <span style={{
            background: meta.bg, color: meta.color,
            fontSize: 11, fontWeight: 800,
            padding: "3px 9px", borderRadius: 100,
            letterSpacing: "-0.2px",
          }}>{meta.label}</span>
          <span style={{ fontSize: 12, color: "#6A7D94", fontWeight: 600 }}>
            {toKstYmd(row.created_at)} {toKstHm(row.created_at)}
          </span>
          <span style={{
            marginLeft: "auto",
            fontSize: 12, fontWeight: 800,
            color: "#1C2B3A", letterSpacing: "-0.2px",
          }}>{serviceLabel(row.service_type)}</span>
        </div>

        {/* 본문 — 이름/연락처/주소 */}
        <div style={{
          display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px",
          fontSize: 14, color: "#1C2B3A", letterSpacing: "-0.2px",
        }}>
          <span style={{ color: "#93A2B4", fontWeight: 600 }}>이름</span>
          <span style={{ fontWeight: 700 }}>{row.name || "-"}</span>

          <span style={{ color: "#93A2B4", fontWeight: 600 }}>연락처</span>
          <span style={{ fontWeight: 700 }}>
            {row.phone
              ? <a href={`tel:${row.phone}`} style={{ color: "#2563EB", textDecoration: "none" }}>{row.phone}</a>
              : "-"}
          </span>

          <span style={{ color: "#93A2B4", fontWeight: 600 }}>주소</span>
          <span>{row.address || "-"}</span>

          {row.memo && (
            <>
              <span style={{ color: "#93A2B4", fontWeight: 600 }}>메모</span>
              <span style={{ color: "#4A5A70", whiteSpace: "pre-line" }}>{row.memo}</span>
            </>
          )}
        </div>

        {/* 액션 */}
        {!isConverted && (
          <div style={{
            display: "flex", gap: 8, marginTop: 14,
            flexWrap: "wrap",
          }}>
            <ActionBtn
              label="통화"
              color="#2563EB"
              disabled={busy || row.status === "contacted"}
              onClick={onCall}
            />
            <ActionBtn
              label="스팸"
              color="#6B7280"
              disabled={busy || row.status === "spam"}
              onClick={onSpam}
            />
            <ActionBtn
              label="작업 전환 (준비중)"
              color="#B7C3D3"
              disabled
              onClick={() => {}}
              title="이번 범위 X — 별도 RPC 드라이런 후"
            />
          </div>
        )}
      </div>
    </article>
  );
}

function ActionBtn({ label, color, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      style={{
        background: disabled ? "#E5EAF1" : color,
        color: disabled ? "#9CA8B6" : "#fff",
        border: "none", borderRadius: 8,
        padding: "9px 14px",
        fontSize: 13, fontWeight: 800,
        letterSpacing: "-0.2px",
        cursor: disabled ? "not-allowed" : "pointer",
      }}>{label}</button>
  );
}
