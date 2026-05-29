// 2026-05-29 — 운영자 PWA 발주 원본 archive (Phase 1, Migration 080).
//   사장님 spec:
//     · 작업 상세 화면은 깨끗 유지 (자주 안 보는 정보)
//     · 별도 archive 페이지에서 검색 → 급할 때만 진입
//     · task 가 삭제돼도 발주 원본은 검색 가능
//
//   계기: 2026-05-29 sync_trg 사고로 usol_n 9건 task_items 손실 → 시트에서만 추적되던 답답함 해소.
//
//   진입: AdminApp.jsx 헤더 측 📄 아이콘 → setScreen("rawOrdersArchive")
//   데이터: src/lib/rawOrdersDb.js searchRawOrders + getRawOrderById

import { useState, useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { searchRawOrders } from "../../lib/rawOrdersDb.js";
import { PRINCIPAL_LABELS_KR } from "../../data/cancelReasons.js";
import { formatDateTimeKST } from "../../utils/dateLabel.js";

const PRINCIPAL_OPTIONS = [
  { code: "",         label: "전체 원청" },
  { code: "usol_n",   label: "유솔홈케어(N)" },
  { code: "usol_h",   label: "유솔홈케어" },
  { code: "allday",   label: "올데이케어" },
  { code: "KA",       label: "쿨가이" },
  { code: "KB",       label: "KB" },
  { code: "yongin",   label: "용인컴퍼니" },
  { code: "crikrin",  label: "크리크린" },
];

export function RawOrdersArchiveScreen({ t, onBack, onTaskClick }) {
  const [externalOrderNo, setExternalOrderNo] = useState("");
  const [customerName,    setCustomerName]    = useState("");
  const [phone,           setPhone]           = useState("");
  const [principalCode,   setPrincipalCode]   = useState("");
  const [startDate,       setStartDate]       = useState("");
  const [endDate,         setEndDate]         = useState("");

  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [searchTick, setSearchTick] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // 초기 진입 시 최근 50건 자동 로드
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    searchRawOrders({
      externalOrderNo: externalOrderNo || null,
      customerName:    customerName    || null,
      phone:           phone           || null,
      principalCode:   principalCode   || null,
      startDate:       startDate ? `${startDate}T00:00:00+09:00` : null,
      endDate:         endDate   ? `${endDate}T23:59:59+09:00`   : null,
      limit: 50,
    }).then(res => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error || "검색 실패");
        setRows([]);
      } else {
        setRows(res.rows || []);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTick]);

  function handleSearch() {
    setExpandedId(null);
    setSearchTick(v => v + 1);
  }

  return (
    <div className="fade-in" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--bg-primary)", borderBottom: `1px solid ${t.border}`,
        padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onBack} style={{
          padding: 6, background: "transparent", border: "none",
          color: t.text, cursor: "pointer", display: "flex",
        }}><ArrowLeft size={18}/></button>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>📄 발주 원본 archive</div>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
          {loading ? "..." : `${rows.length}건`}
        </span>
      </div>

      {/* 검색 영역 */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <input type="text" value={externalOrderNo}
          onChange={(e) => setExternalOrderNo(e.target.value)}
          placeholder="외부 주문번호 (부분 일치)"
          style={inputStyle(t)}/>
        <input type="text" value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="고객명 (부분 일치)"
          style={inputStyle(t)}/>
        <input type="tel" value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="전화번호 (정확히)"
          style={inputStyle(t)}/>
        <select value={principalCode}
          onChange={(e) => setPrincipalCode(e.target.value)}
          style={inputStyle(t)}>
          {PRINCIPAL_OPTIONS.map(p => (
            <option key={p.code} value={p.code}>{p.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ ...inputStyle(t), flex: 1 }}/>
          <input type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...inputStyle(t), flex: 1 }}/>
        </div>
        <button onClick={handleSearch} style={{
          padding: "10px 14px",
          background: t.accent, color: "#fff",
          border: "none", borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "inherit",
        }}>
          <Search size={14}/> 검색
        </button>
      </div>

      {/* 결과 리스트 */}
      <div style={{ padding: "0 12px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
        {error && (
          <div style={{ fontSize: 12, color: t.danger || "#ff4444", padding: 10 }}>
            ⚠️ {error}
          </div>
        )}
        {!error && !loading && rows.length === 0 && (
          <div style={{
            padding: 30, textAlign: "center",
            color: t.textSecondary, fontSize: 12,
            background: t.bgElevated || "var(--bg-secondary)",
            border: `1px dashed ${t.border}`,
            borderRadius: 10,
          }}>검색 결과 없음</div>
        )}
        {rows.map(row => (
          <RawOrderCard
            key={row.id}
            row={row}
            t={t}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}

function RawOrderCard({ row, t, expanded, onToggle, onTaskClick }) {
  const linked  = !!row.task_id;
  const taskNo  = row.task?.task_no || null;
  const status  = row.task?.status || null;
  const noteIs중복 = row.notes && row.notes.startsWith("중복");

  return (
    <div style={{
      background: t.bgElevated || "var(--bg-secondary)",
      border: `1px solid ${t.border}`,
      borderRadius: 8,
      padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
        <span className="mono">{formatDateTimeKST(row.uploaded_at) || "—"}</span>
        <span>·</span>
        <span>{PRINCIPAL_LABELS_KR[row.principal_code] || row.principal_code || "—"}</span>
        <span>·</span>
        <span>{row.source || "—"}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
        {row.customer_name || "고객명 없음"}
        {row.phone && <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 500, marginLeft: 6 }}>· {row.phone}</span>}
      </div>
      {row.external_order_no && (
        <div className="mono" style={{ fontSize: 11, color: t.textSecondary }}>
          외부주문 {row.external_order_no}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        {linked ? (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: "#5DCAA5",
            background: "rgba(93,202,165,0.12)",
            padding: "2px 7px", borderRadius: 6,
          }}>✓ task 연결 {taskNo ? `(${taskNo})` : ""} {status ? `· ${status}` : ""}</span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: "#9CA3AF",
            background: "rgba(156,163,175,0.18)",
            padding: "2px 7px", borderRadius: 6,
          }}>⚠ task 없음{noteIs중복 ? ` (${row.notes})` : ""}</span>
        )}
        <div style={{ flex: 1 }}/>
        <button onClick={onToggle} style={{
          fontSize: 11, fontWeight: 700,
          color: t.accent,
          background: "transparent", border: "none",
          cursor: "pointer", padding: 0, fontFamily: "inherit",
        }}>{expanded ? "▲ 접기" : "▼ 펴기"}</button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px dashed ${t.border}`,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>─── 원본 데이터 ───</div>
          <pre className="mono" style={{
            fontSize: 10, color: t.textSecondary,
            background: t.bgInset || "var(--bg-primary)",
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            padding: 8,
            margin: 0,
            overflow: "auto",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>{JSON.stringify(row.raw_payload, null, 2)}</pre>
          {linked && onTaskClick && (
            <button onClick={() => onTaskClick(row.task)} style={{
              padding: "8px 12px",
              background: t.accent, color: "#fff",
              border: "none", borderRadius: 6,
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit",
              alignSelf: "flex-start",
            }}>작업 상세 보기 →</button>
          )}
        </div>
      )}
    </div>
  );
}

function inputStyle(t) {
  return {
    width: "100%", padding: "8px 10px",
    background: t.bgElevated || "var(--bg-secondary)",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12, fontWeight: 500,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };
}

export default RawOrdersArchiveScreen;
