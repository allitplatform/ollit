// 2026-06-03 — Phase 2a: 운영자 "냉매 미처리" 별도 화면 (목록 표시만, 쓰기 0).
//   tasks.category_data.refrigerant_addon (processed=false) 항목 측측.
//   Phase 1 측측 기사 PWA 측측 세척 완료 측 입력. Phase 2b 측측 측측 [냉매 작업 만들기] 측측 측측.
//
// 사장님 spec:
//   카드 = 고객명 / 지역 / 기사명 / 기종 / 받은 현금 / 원본 완료일 / 원본 task_no / 라우팅 측측.
//   라우팅: principalCode==='usol_n' → "usol_h로 생성" / 측측 → "{원청} 그대로".
//   정렬: 완료일 오래된 순 (빠뜨림 측측).
//   [냉매 작업 만들기] 측측 측측 자리 — 측측 측측 (2b 측측 측측).
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { fetchUnprocessedRefriAddons } from "../../lib/refrigerantAddonsDb.js";

function fmtKstDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // KST 변환 후 YYYY-MM-DD HH:mm
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${h}:${mi}`;
}

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function RefrigerantAddonListScreen({ t, onBack, onTaskClick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchUnprocessedRefriAddons()
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "측측 실패");
          setItems([]);
        } else {
          setItems(res.items || []);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick]);

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + (Number(it.addon_amount) || 0), 0),
    [items]
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          ⚡ 냉매 미처리
        </div>
        <button
          onClick={() => setReloadTick(v => v + 1)}
          disabled={loading}
          style={{
            background: "transparent", border: "none", padding: 6,
            cursor: loading ? "default" : "pointer", color: t.textMuted,
            display: "flex", alignItems: "center",
          }}
          aria-label="새로고침"
        >
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* 요약 */}
      <div style={{ padding: "14px 16px 8px" }}>
        <div style={{
          background: "rgba(255,184,0,0.08)",
          border: "1px solid rgba(255,184,0,0.30)",
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: t.text, fontWeight: 700, lineHeight: 1.5 }}>
            기사 PWA에서 세척 완료 때 같이 입력한 냉매충전입니다.<br/>
            아직 별도 작업으로 만들지 않은 항목만 보입니다.
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>합계</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: "#FFB800" }}>
              {fmtKRW(totalAmount)}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
              {items.length}건
            </div>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div style={{ padding: "8px 16px" }}>
        {loading ? (
          <EmptyBox t={t}>측측 중...</EmptyBox>
        ) : error ? (
          <EmptyBox t={t}><span style={{ color: t.danger || "#EF4444" }}>⚠️ {error}</span></EmptyBox>
        ) : items.length === 0 ? (
          <EmptyBox t={t}>✓ 미처리 냉매충전 0건.</EmptyBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(it => (
              <RefriCard key={it.id} t={t} item={it} onClickTask={() => onTaskClick && onTaskClick(it)}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RefriCard({ t, item, onClickTask }) {
  const isUsolN = item.principal_code === "usol_n";
  return (
    <div style={{
      background: t.bgElevated || t.bg,
      border: `1px solid ${t.border}`,
      borderLeft: "4px solid #FFB800",
      borderRadius: 12,
      padding: "12px 14px",
    }}>
      {/* 상단: 고객 + 기종 + 금액 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: t.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.customer_name || "—"}
          </div>
          <div style={{
            fontSize: 11, color: t.textMuted, fontWeight: 600,
            marginTop: 2,
          }}>
            {item.district || "—"} · 기사 {item.engineer_name || "—"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(255,184,0,0.12)",
            color: "#B07E00",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 11, fontWeight: 800,
            marginBottom: 4,
          }}>
            ⚡ {item.addon_appliance || "—"}
          </div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
            {fmtKRW(item.addon_amount)}
          </div>
        </div>
      </div>

      {/* 라우팅 안내 */}
      <div style={{
        fontSize: 11, color: t.textMuted, fontWeight: 600,
        background: isUsolN ? "rgba(3,199,90,0.08)" : t.bgInset || "rgba(255,255,255,0.03)",
        border: `1px solid ${isUsolN ? "rgba(3,199,90,0.25)" : t.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        marginBottom: 8,
      }}>
        {isUsolN
          ? <>측측: <b style={{ color: "#03C75A" }}>유솔홈케어 H</b>로 생성 (usol_n 세척 → usol_h 측측)</>
          : <>측측: <b style={{ color: t.text }}>{item.principal_name || item.principal_code || "—"}</b> 그대로</>
        }
      </div>

      {/* 원본 task 정보 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        fontSize: 11, color: t.textMuted, fontWeight: 600,
        paddingTop: 8, borderTop: `1px dashed ${t.border}`,
      }}>
        <button
          type="button"
          onClick={onClickTask}
          style={{
            background: "transparent", border: "none", padding: 0,
            color: t.textMuted, fontSize: 11, fontWeight: 600,
            cursor: onClickTask ? "pointer" : "default",
            fontFamily: "inherit", textAlign: "left",
            textDecoration: onClickTask ? "underline dotted" : "none",
          }}
        >
          📄 원본: {item.task_no || "—"}
        </button>
        <span className="mono">완료 {fmtKstDate(item.completed_at)}</span>
      </div>

      {/* Phase 2b 측측 측측 — 측측 측측 */}
      <button
        type="button"
        disabled
        title="Phase 2b 측측 측측 — 측 측측 측측측 측측 측측"
        style={{
          width: "100%", marginTop: 10,
          padding: "10px 12px",
          background: t.bgInset || "rgba(255,255,255,0.04)",
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          color: t.textMuted,
          fontSize: 12, fontWeight: 700,
          cursor: "not-allowed",
          fontFamily: "inherit",
        }}
      >
        🛠️ 냉매 작업 만들기 (측측 측측)
      </button>
    </div>
  );
}

function EmptyBox({ t, children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: t.textMuted, fontSize: 13,
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
    }}>
      {children}
    </div>
  );
}

export default RefrigerantAddonListScreen;
